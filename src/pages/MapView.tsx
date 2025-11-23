import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Navigation, Fuel, DollarSign, Filter, Search, RefreshCw, ChevronUp, ChevronDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useDatabase } from "@/hooks/useDatabase";
import { useCompetitorResearch } from "@/hooks/useCompetitorResearch";
import { LeafletMap } from "@/components/LeafletMap";
import { SearchWithPreview } from "@/components/SearchWithPreview";
import { Input } from "@/components/ui/input";
import { StationBoard } from "@/components/StationBoard";
import { supabase } from "@/lib/supabase";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImageViewerModal } from "@/components/ImageViewerModal";
import QuotationTable from "@/components/QuotationTable";
import { formatBrazilianCurrency } from "@/lib/utils";

export default function MapView() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { stations, suggestions, priceHistory } = useDatabase();
  const { researchData, stationStats, loading: researchLoading, refetch: refetchResearch } = useCompetitorResearch();
  
  console.log('🔍 Dados dos hooks:');
  console.log('🔍 Stations:', stations?.length || 0, stations);
  console.log('🔍 Suggestions:', suggestions?.length || 0, suggestions);
  console.log('🔍 Price History:', priceHistory?.length || 0, priceHistory);
  console.log('🔍 Research Data:', researchData?.length || 0, researchData);
  console.log('🔍 Station Stats:', stationStats?.length || 0, stationStats);
  
  // Buscar referências
  const [references, setReferences] = useState<any[]>([]);
  const [referencesLoading, setReferencesLoading] = useState(true);
  
  // Buscar estações da tabela sis_empresa
  const [sisEmpresaStations, setSisEmpresaStations] = useState<any[]>([]);
  const [sisEmpresaLoading, setSisEmpresaLoading] = useState(true);

  const fetchReferences = async () => {
    try {
      console.log('🔍 Buscando referências...');
      
      // Buscar referências sem depender de FKs/joins
      const { data, error } = await supabase
        .from('referencias')
        .select('*')
        .order('created_at', { ascending: false });

      console.log('🔍 Erro ao buscar referências:', error);
      console.log('🔍 Referências encontradas:', data?.length, data);

      if (error) {
        console.warn('⚠️ Tabela referencias não disponível ou erro. Tentando fallback em price_suggestions...');
      }

      let normalized: any[] = data || [];

      // Enriquecer com dados de clientes (opcional) — tentar buscar nomes
      try {
        const uniqueClientIds = Array.from(new Set((normalized || []).map((r: any) => r.cliente_id).filter(Boolean)));
        if (uniqueClientIds.length > 0) {
          const { data: clientsList } = await supabase
            .from('clients')
            .select('id, name')
            .in('id', uniqueClientIds as any);
          if (clientsList) {
            const clientMap = new Map(clientsList.map((c: any) => [String(c.id), c]));
            normalized = normalized.map((r: any) => ({
              ...r,
              clients: clientMap.get(String(r.cliente_id)) || null
            }));
          }
        }
      } catch {}

      // Fallback: buscar em price_suggestions e normalizar quando não houver registros
      if (!normalized || normalized.length === 0) {
        const { data: ps, error: psError } = await supabase
          .from('price_suggestions')
          .select(`
            id,
            product,
            final_price,
            created_at,
            attachments,
            stations:station_id ( id, name, latitude, longitude ),
            clients:client_id ( id, name )
          `)
          .order('created_at', { ascending: false });

        console.log('🔍 Fallback price_suggestions erro:', psError);
        console.log('🔍 Fallback price_suggestions encontrados:', ps?.length, ps);

        if (!psError && ps) {
          normalized = ps.map((row: any) => ({
            id: row.id,
            produto: row.product,
            preco_referencia: (row.final_price ?? 0) / 100, // converter de cents
            created_at: row.created_at,
            anexo: Array.isArray(row.attachments) ? row.attachments.join(',') : row.attachments ?? null,
            stations: row.stations,
            clients: row.clients
          }));
        }
      }

      // Enriquecer com dados de concorrentes por id_posto (PK)
      if (normalized && normalized.length > 0) {
        try {
          const uniqueIds = Array.from(new Set(normalized.map((r: any) => r.posto_id))).filter(Boolean);
          if (uniqueIds.length > 0) {
            const numericIds = uniqueIds.map((id: any) => Number(id)).filter((n: any) => !isNaN(n));
            const { data: concorrentes, error: concErr } = await supabase
              .from('concorrentes')
              .select('*')
              .in('id_posto', (numericIds.length > 0 ? numericIds : uniqueIds) as any);

            if (!concErr && concorrentes) {
              const concMap = new Map(concorrentes.map((c: any) => [String(c.id_posto), c]));
              normalized = normalized.map((r: any) => ({
                ...r,
                concorrente: concMap.get(String(r.posto_id)) || null
              }));
            }

            // Fallback adicional: enriquecer por tabela stations (casos antigos)
            const { data: stationsList, error: stationsErr } = await supabase
              .from('stations')
              .select('id, name, latitude, longitude')
              .in('id', (numericIds.length > 0 ? numericIds : uniqueIds) as any);
            if (!stationsErr && stationsList) {
              const stMap = new Map(stationsList.map((s: any) => [String(s.id), s]));
              normalized = normalized.map((r: any) => ({
                ...r,
                stations: r.stations || stMap.get(String(r.posto_id)) || null
              }));
            }
          }
        } catch (e) {
          console.warn('⚠️ Falha no enriquecimento de concorrentes para referências:', e);
        }
      }

      setReferences(normalized || []);
    } catch (err) {
      console.error('Erro:', err);
    } finally {
      setReferencesLoading(false);
    }
  };

  const fetchSisEmpresaStations = async () => {
    try {
      console.log('🔍 Buscando estações da tabela sis_empresa...');
      
      // Buscar diretamente da tabela para ter acesso ao campo UF (mais confiável)
      const { data: directData, error: directError } = await supabase
        .from('sis_empresa' as any)
        .select('nome_empresa, cnpj_cpf, latitude, longitude, bandeira, rede, municipio, uf, registro_ativo')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);
      
      if (!directError && directData && directData.length > 0) {
        console.log('✅ Estações encontradas diretamente:', directData.length);
        setSisEmpresaStations(directData || []);
      } else {
        if (directError) {
          console.error('❌ Erro ao buscar estações diretamente:', directError);
          // Fallback: tentar RPC se busca direta falhar
          const { data: rpcData, error: rpcError } = await supabase.rpc('get_sis_empresa_stations');
          if (!rpcError && rpcData && rpcData.length > 0) {
            console.log('✅ Estações encontradas via RPC (fallback):', rpcData.length);
            setSisEmpresaStations(rpcData || []);
          } else {
            setSisEmpresaStations([]);
          }
        } else {
          console.warn('⚠️ Nenhuma estação encontrada na tabela sis_empresa');
          setSisEmpresaStations([]);
        }
      }
    } catch (err) {
      console.error('❌ Erro ao buscar estações de sis_empresa:', err);
      setSisEmpresaStations([]);
    } finally {
      setSisEmpresaLoading(false);
    }
  };

  useEffect(() => {
    fetchReferences();
    fetchSisEmpresaStations();
  }, []);
  
  const [selectedFilter, setSelectedFilter] = useState<string>("all");
  const [selectedRegion, setSelectedRegion] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"pesquisas" | "referencias">("referencias");
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [imageModalUrl, setImageModalUrl] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Estados para ordenação
  const [sortByPrice, setSortByPrice] = useState<'asc' | 'desc' | null>(null);
  const [sortByUF, setSortByUF] = useState<'asc' | 'desc' | null>(null);
  
  // Estado para data/hora atual
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  
  // Atualizar data/hora a cada minuto
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 60000); // Atualizar a cada minuto
    
    return () => clearInterval(interval);
  }, []);
  
  // Função para determinar região baseada nas coordenadas ou UF
  const getRegionFromCoordinates = (lat: number, lng: number, uf?: string): string => {
    // Se temos UF, usar diretamente (mais confiável)
    if (uf) {
      const ufLower = uf.toLowerCase().trim();
      const ufMap: { [key: string]: string } = {
        'mg': 'mg', 'minas gerais': 'mg',
        'go': 'go', 'goiás': 'go', 'goias': 'go',
        'df': 'df', 'distrito federal': 'df',
        'sp': 'sp', 'são paulo': 'sp', 'sao paulo': 'sp',
        'ba': 'ba', 'bahia': 'ba',
        'rj': 'rj', 'rio de janeiro': 'rj',
        'pr': 'pr', 'paraná': 'pr', 'parana': 'pr',
        'sc': 'sc', 'santa catarina': 'sc',
        'rs': 'rs', 'rio grande do sul': 'rs',
        'es': 'es', 'espírito santo': 'es', 'espirito santo': 'es',
        'ms': 'ms', 'mato grosso do sul': 'ms',
        'mt': 'mt', 'mato grosso': 'mt',
        'to': 'to', 'tocantins': 'to',
        'ac': 'ac', 'acre': 'ac',
        'al': 'al', 'alagoas': 'al',
        'ap': 'ap', 'amapá': 'ap', 'amapa': 'ap',
        'am': 'am', 'amazonas': 'am',
        'ce': 'ce', 'ceará': 'ce', 'ceara': 'ce',
        'ma': 'ma', 'maranhão': 'ma', 'maranhao': 'ma',
        'pb': 'pb', 'paraíba': 'pb', 'paraiba': 'pb',
        'pe': 'pe', 'pernambuco': 'pe',
        'pi': 'pi', 'piauí': 'pi', 'piaui': 'pi',
        'rn': 'rn', 'rio grande do norte': 'rn',
        'ro': 'ro', 'rondônia': 'ro', 'rondonia': 'ro',
        'rr': 'rr', 'roraima': 'rr',
        'se': 'se', 'sergipe': 'se'
      };
      return ufMap[ufLower] || ufLower;
    }
    
    // Fallback: calcular por coordenadas (menos preciso)
    // Minas Gerais: aproximadamente -14 a -22 lat, -39 a -51 lng
    if (lat >= -22 && lat <= -14 && lng >= -51 && lng <= -39) return "mg";
    
    // Goiás: aproximadamente -13 a -19 lat, -50 a -46 lng  
    if (lat >= -19 && lat <= -13 && lng >= -50 && lng <= -46) return "go";
    
    // Distrito Federal: aproximadamente -15.5 a -16 lat, -48 a -47 lng
    if (lat >= -16 && lat <= -15.5 && lng >= -48 && lng <= -47) return "df";
    
    // São Paulo: aproximadamente -20 a -25 lat, -48 a -44 lng
    if (lat >= -25 && lat <= -20 && lng >= -48 && lng <= -44) return "sp";
    
    // Bahia: aproximadamente -9 a -18 lat, -39 a -46 lng
    if (lat >= -18 && lat <= -9 && lng >= -46 && lng <= -39) return "ba";
    
    return "other";
  };
  
  // Convert database data to map markers
  type MarkerStation = { 
    id: string; 
    name: string; 
    lat: number; 
    lng: number; 
    price: string; 
    type: 'nossa' | 'concorrente' | 'cliente' | 'pesquisa'; 
    product: string;
    date?: string;
    source?: string;
    researchCount?: number;
    clientName?: string;
    region?: string;
    researchData?: any[];
  };

  // Convert stations to markers - FILTRAR ponto bugado de SP
  const mapStations: MarkerStation[] = stations
    .filter(station => {
      // Remover postos com coordenadas de São Paulo (ponto bugado)
      const lat = station.latitude || -23.5505;
      const lng = station.longitude || -46.6333;
      
      // Se tem coordenadas de São Paulo, não mostrar
      if (lat === -23.5505 && lng === -46.6333) {
        return false;
      }
      
      return true;
    })
    .map(station => {
      // Find latest price suggestion or history for this station
      const latestSuggestion = suggestions
        .filter(s => s.station_id === station.id && s.status === 'approved')
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

      const latestHistory = priceHistory
        .filter(h => h.station_id === station.id)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

      // Find research stats for this station
      const stationStat = stationStats.find(s => s.station_id === station.id);
      
      // Find latest research price for this station
      const latestResearch = researchData
        .filter(r => r.station_name === station.name || r.station_id === station.id)
        .sort((a, b) => new Date(b.date_observed).getTime() - new Date(a.date_observed).getTime())[0];

      return {
        id: station.id,
        name: station.name,
        lat: station.latitude || -23.5505,
        lng: station.longitude || -46.6333,
        price: latestResearch ? 
          formatBrazilianCurrency(latestResearch.price) : 
          latestSuggestion ? 
          formatBrazilianCurrency(latestSuggestion.final_price || 0) : 
          latestHistory ? 
          formatBrazilianCurrency(latestHistory.new_price || 0) : 
          'R$ 0,00',
        type: 'nossa', // Postos nossos sempre são azuis, mesmo com pesquisa
        product: latestResearch?.product || latestSuggestion?.product || latestHistory?.product || 'Gasolina Comum',
        date: latestResearch?.date_observed || latestSuggestion?.created_at || latestHistory?.created_at,
        source: latestResearch ? 'pesquisa' : 'sistema',
        researchCount: stationStat?.total_research || 0,
        region: getRegionFromCoordinates(station.latitude || -23.5505, station.longitude || -46.6333, station.uf),
        researchData: researchData.filter(r => r.station_id === station.id || r.station_name === station.name)
      };
    });

  // Convert research data to markers - FILTRAR ponto bugado de SP
  const researchMarkers: MarkerStation[] = researchData
    .filter(research => {
      // Remover pesquisas com coordenadas de São Paulo (ponto bugado)
      const lat = research.latitude || -23.5505;
      const lng = research.longitude || -46.6333;
      
      // Se tem coordenadas de São Paulo, não mostrar
      if (lat === -23.5505 && lng === -46.6333) {
        return false;
      }
      
      return true;
    })
    .map(research => ({
      id: `research-${research.id}`,
      name: research.station_name,
      lat: research.latitude || -23.5505,
      lng: research.longitude || -46.6333,
      price: formatBrazilianCurrency(research.price),
      type: research.station_type === 'concorrente' ? 'concorrente' : 'pesquisa',
      product: research.product,
      date: research.date_observed,
      source: 'pesquisa',
      region: getRegionFromCoordinates(research.latitude || -23.5505, research.longitude || -46.6333, research.uf || research.state),
      researchData: [research]
    }));

  // Convert sis_empresa stations to markers
  const sisEmpresaMarkers: MarkerStation[] = sisEmpresaStations
    .filter(station => {
      // Filtrar estações sem coordenadas válidas
      const lat = station.latitude;
      const lng = station.longitude;
      
      if (!lat || !lng || isNaN(Number(lat)) || isNaN(Number(lng))) {
        return false;
      }
      
      // Remover postos com coordenadas de São Paulo (ponto bugado)
      if (Number(lat) === -23.5505 && Number(lng) === -46.6333) {
        return false;
      }
      
      return true;
    })
    .map(station => ({
      id: `sis_empresa-${station.cnpj_cpf || station.nome_empresa}`,
      name: station.nome_empresa || 'Posto sem nome',
      lat: Number(station.latitude),
      lng: Number(station.longitude),
      price: 'R$ 0,00', // Não temos preço direto da sis_empresa
      type: 'nossa' as const,
      product: 'Gasolina Comum',
      source: 'sis_empresa',
      region: getRegionFromCoordinates(Number(station.latitude), Number(station.longitude), station.uf),
      researchData: []
    }));

  // Convert references to markers - tentar múltiplos campos de coordenadas
  const referenceMarkers: MarkerStation[] = references
    .map(reference => {
      // Priorizar coordenadas gravadas na própria referência, depois concorrente, depois stations
      const src = (reference.latitude != null && reference.longitude != null)
        ? { latitude: reference.latitude, longitude: reference.longitude, name: reference.nome || reference.name }
        : (reference.concorrente || reference.stations || {});
      const pick = (obj: any, keys: string[]) => {
        for (const k of keys) {
          if (obj && obj[k] != null) return obj[k];
        }
        return undefined;
      };
      const rawLat = pick(src, ['latitude', 'lat', 'latitude_gps']);
      const rawLng = pick(src, ['longitude', 'lng', 'longitude_gps']);
      const toNum = (v: any) => {
        if (typeof v === 'string') {
          const norm = v.replace(',', '.');
          const n = parseFloat(norm);
          return isNaN(n) ? undefined : n;
        }
        return typeof v === 'number' ? v : undefined;
      };
      const lat = toNum(rawLat);
      const lng = toNum(rawLng);
      return { reference, lat, lng };
    })
    .filter(({ lat, lng }) => {
      if (lat == null || lng == null) return false;
      if (isNaN(lat) || isNaN(lng)) return false;
      return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
    })
    .map(({ reference, lat, lng }) => {
      // Tentar obter UF de várias fontes possíveis
      const uf = reference.uf || 
                 reference.concorrente?.uf || 
                 reference.stations?.uf || 
                 reference.estado ||
                 reference.concorrente?.estado ||
                 reference.stations?.estado;
      
      return {
        id: `reference-${reference.id}`,
        name: reference.concorrente?.razao_social || reference.stations?.name || reference.nome || 'Posto',
        lat,
        lng,
        price: formatBrazilianCurrency(Number(reference.preco_referencia)),
        type: 'cliente',
        product: reference.produto,
        date: reference.created_at,
        source: 'referencia',
        clientName: reference.clients?.name || 'Cliente',
        region: getRegionFromCoordinates(lat, lng, uf),
        researchData: []
      };
    });

  // Combine markers based on active tab and apply region filter
  // Mostrar estações de sis_empresa e referências
  const allStations = [...sisEmpresaMarkers, ...referenceMarkers]
    .filter(station => {
      if (selectedRegion === "all") return true;
      return station.region === selectedRegion;
    });

  console.log('🗺️ Total de estações para o mapa:', allStations.length);
  console.log('🗺️ Estações de sis_empresa:', sisEmpresaMarkers.length);
  console.log('🗺️ Estações próprias:', mapStations.length);
  console.log('🗺️ Estações de pesquisa:', researchMarkers.length);
  console.log('🗺️ Estações de referência:', referenceMarkers.length);
  console.log('🗺️ Tab ativo:', activeTab);

  // Garantir re-render quando references mudarem
  useEffect(() => {
    // no-op, apenas para observar references e referenceMarkers
  }, [references, referenceMarkers.length]);
  
  const [selectedStation, setSelectedStation] = useState<MarkerStation | null>(null);

  const getStationColor = (type: string) => {
    switch (type) {
      case 'nossa': return '#2563eb'; // blue
      case 'concorrente': return '#dc2626'; // red
      case 'cliente': return '#16a34a'; // green
      case 'pesquisa': return '#f59e0b'; // amber
      default: return '#6b7280'; // gray
    }
  };

  const getStationIcon = (type: string) => {
    switch (type) {
      case 'nossa': return '🏪';
      case 'concorrente': return '⛽';
      case 'cliente': return '🚛';
      case 'pesquisa': return '🔍';
      default: return '📍';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-4 sm:py-6 lg:py-8 space-y-4 sm:space-y-6">
      {/* Header padrão com gradiente */}
      <div className="relative overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 p-4 sm:p-6 text-white shadow-2xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold">
              Mapa de Referências
            </h1>
            <p className="text-white/80">
              Visualize referências de clientes
            </p>
            <div className="text-sm text-white/60 mt-1">
              {currentDateTime.toLocaleString('pt-BR', {
                day: '2-digit',
                month: '2-digit', 
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/70" />
              <Input
                placeholder="Buscar postos, referências..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 bg-white/10 border-white/20 text-white placeholder:text-white/70"
              />
            </div>
            <Button 
              variant="secondary" 
              size="icon"
              onClick={() => { refetchResearch(); fetchReferences(); }}
              disabled={researchLoading}
              className="bg-white/20 hover:bg-white/30 text-white border-white/30 backdrop-blur-sm"
            >
              <RefreshCw className={`h-4 w-4 ${researchLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Map Area */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Mapa Interativo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Legenda acima do mapa */}
              <div className="flex items-center gap-4 pb-3 border-b border-slate-200 dark:border-slate-700">
                <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">Legenda:</div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-600"></div>
                    <span className="text-sm text-slate-600 dark:text-slate-400">Nossa Rede</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-600"></div>
                    <span className="text-sm text-slate-600 dark:text-slate-400">Concorrentes</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-600"></div>
                    <span className="text-sm text-slate-600 dark:text-slate-400">Clientes (NF)</span>
                  </div>
                </div>
              </div>
              
              <LeafletMap
                  stations={allStations.map(station => {
                    console.log('🗺️ Enviando estação para o mapa:', station);
                    return {
                      id: parseInt(station.id.replace(/\D/g, '')), // Extract numeric ID
                      name: station.name,
                      lat: station.lat,
                      lng: station.lng,
                      price: station.price,
                      type: station.type,
                      product: station.product,
                      region: station.region,
                      researchData: station.researchData
                    };
                  })}
                  selectedStation={selectedStation ? {
                    id: parseInt(selectedStation.id.replace(/\D/g, '')),
                    name: selectedStation.name,
                    lat: selectedStation.lat,
                    lng: selectedStation.lng,
                    price: selectedStation.price,
                    type: selectedStation.type,
                    product: selectedStation.product,
                    region: selectedStation.region,
                    researchData: selectedStation.researchData
                  } : null}
                  onStationSelect={(station) => {
                    const mappedStation = allStations.find(s => 
                      s.name === station.name && 
                      Math.abs(s.lat - station.lat) < 0.001 && 
                      Math.abs(s.lng - station.lng) < 0.001
                    );
                    if (mappedStation) {
                      setSelectedStation(mappedStation);
                      toast({
                        title: "Posto selecionado",
                        description: `${mappedStation.name} - ${mappedStation.price}`
                      });
                    }
                  }}
                />
            </CardContent>
          </Card>
        </div>

      </div>

      {/* Tabela de Cotação */}
      <div className="mt-6">
        <QuotationTable 
          mode={activeTab}
          sortByPrice={sortByPrice}
          sortByUF={sortByUF}
          onSortPrice={(order) => setSortByPrice(order)}
          onSortUF={(order) => setSortByUF(order)}
        />
      </div>

      {/* Modal de visualização de imagens */}
      <ImageViewerModal 
        isOpen={imageModalOpen}
        onClose={() => { setImageModalOpen(false); setImageModalUrl(null); }}
        imageUrl={imageModalUrl || ''}
      />
      </div>
    </div>
  );
}