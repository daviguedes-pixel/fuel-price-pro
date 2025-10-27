import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { SisEmpresaCombobox } from "@/components/SisEmpresaCombobox";
import { ClientCombobox } from "@/components/ClientCombobox";
import { ImageViewerModal } from "@/components/ImageViewerModal";
import { FileUploader } from "@/components/FileUploader";
import { ApprovalDetailsModal } from "@/components/ApprovalDetailsModal";
import { parseBrazilianDecimal, formatBrazilianCurrency } from "@/lib/utils";
import { useDatabase } from "@/hooks/useDatabase";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Send, Save, Calculator, CheckCircle, AlertCircle, Eye, DollarSign, Clock, Check, X, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Reference {
  id: string;
  codigo_referencia: string;
  posto_id: string;
  cliente_id: string;
  produto: string;
  preco_referencia: number;
  tipo_pagamento_id?: string;
  observacoes?: string;
  anexo?: string;
  criado_por?: string;
  stations?: { name: string; code: string };
  clients?: { name: string; code: string };
  payment_methods?: { name: string };
}

export default function PriceRequest() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { permissions } = usePermissions();
  const { stations, clients, paymentMethods, loading: dbLoadingHook, getPaymentMethodsForStation } = useDatabase();
  
  const [loading, setLoading] = useState(false);
  const [references, setReferences] = useState<Reference[]>([]);
  const [savedSuggestion, setSavedSuggestion] = useState<any>(null);
  const [saveAsDraft, setSaveAsDraft] = useState(false);
  const [stationPaymentMethods, setStationPaymentMethods] = useState<any[]>([]);
  const [attachments, setAttachments] = useState<string[]>([]);

  const initialFormData = {
    station_id: "",
    client_id: "",
    product: "",
    current_price: "",
    reference_id: "none",
    suggested_price: "",
    payment_method_id: "none",
    observations: "",
    attachments: [] as string[],
    // Calculadora de custos
    purchase_cost: "",
    freight_cost: "",
    volume_made: "",
    volume_projected: "",
    arla_purchase_price: "",
    arla_cost_price: "" // Preço de COMPRA do ARLA (cotação)
  };
  const [formData, setFormData] = useState(initialFormData);

  // Carregar tipos de pagamento específicos do posto quando station_id mudar
  useEffect(() => {
    const loadStationPaymentMethods = async () => {
      if (formData.station_id && formData.station_id !== 'none') {
        try {
          const methods = await getPaymentMethodsForStation(formData.station_id);
          setStationPaymentMethods(methods);
        } catch (error) {
          console.error('Erro ao carregar tipos de pagamento do posto:', error);
          setStationPaymentMethods([]);
        }
      } else {
        setStationPaymentMethods([]);
      }
    };

    // Debounce para evitar múltiplas requisições
    const timeout = setTimeout(() => {
      loadStationPaymentMethods();
    }, 300);

    return () => clearTimeout(timeout);
  }, [formData.station_id]);

  // Log para debug - DESABILITADO para reduzir requisições
  // useEffect(() => {
  //   console.log('📦 Dados carregados:', { 
  //     stations: stations.length,
  //     clients: clients.length,
  //     paymentMethods: paymentMethods.length,
  //     stationPaymentMethods: stationPaymentMethods.length,
  //     dbLoading: dbLoadingHook
  //   });
  // }, [stations, clients, paymentMethods, stationPaymentMethods, dbLoadingHook]);

  const [calculatedPrice, setCalculatedPrice] = useState(0);
  const [margin, setMargin] = useState(0);
  const [priceIncreaseCents, setPriceIncreaseCents] = useState(0);
  const [activeTab, setActiveTab] = useState("new");
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [showRequestDetails, setShowRequestDetails] = useState(false);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string>("");
  const [costCalculations, setCostCalculations] = useState({
    finalCost: 0,
    totalRevenue: 0,
    totalCost: 0,
    grossProfit: 0,
    profitPerLiter: 0,
    arlaCompensation: 0,
    netResult: 0
  });

  const [priceOrigin, setPriceOrigin] = useState<{
    base_nome: string;
    base_codigo: string;
    base_uf: string;
    forma_entrega: string;
  } | null>(null);

  const [fetchStatus, setFetchStatus] = useState<{
    type: 'today' | 'latest' | 'reference' | 'none' | 'error';
    date?: string | null;
    message?: string;
  } | null>(null);

  // Load my requests
  useEffect(() => {
    if (activeTab === 'my-requests' && user) {
      loadMyRequests();
    }
  }, [activeTab, user]);

  // Load references when component mounts (realtime desabilitado para reduzir requisições)
  useEffect(() => {
    loadReferences();
    // Realtime desabilitado temporariamente para reduzir requisições
    // const channel = supabase
    //   .channel('referencias-realtime')
    //   .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'referencias' }, () => {
    //     loadReferences();
    //   })
    //   .subscribe();
    // return () => { supabase.removeChannel(channel); };
  }, []);

  // Auto-fill lowest cost + freight when station and product are selected
  const [lastSearchedStation, setLastSearchedStation] = useState<string>('');
  const [lastSearchedProduct, setLastSearchedProduct] = useState<string>('');
  
  useEffect(() => {
    // console.log('🔄 ===== useEffect BUSCA DE CUSTO INICIADO =====');
    // console.log('🔄 station_id:', formData.station_id, 'tipo:', typeof formData.station_id); 
    // console.log('🔄 product:', formData.product, 'tipo:', typeof formData.product);
    // console.log('🔄 stations_length:', stations.length);
    // console.log('🔄 Condição (!formData.station_id):', !formData.station_id);
    // console.log('🔄 Condição (!formData.product):', !formData.product);

    const fetchLowestCostAndFreight = async () => {
      // Só buscar se mudou o posto ou o produto
      if (formData.station_id === lastSearchedStation && formData.product === lastSearchedProduct) {
        return;
      }
      
      if (!formData.station_id || !formData.product) {
        return;
      }
      
      // Atualizar referências
      setLastSearchedStation(formData.station_id);
      setLastSearchedProduct(formData.product);
      
      try {
        const today = new Date().toISOString().split('T')[0];
        
        // Get the posto_id from the selected station
        const selectedStation = stations.find(s => s.id === formData.station_id);
        if (!selectedStation) {
          console.log('⚠️ Estação não encontrada');
          return;
        }
        
        const rawId = selectedStation.code || selectedStation.id;
        const cleanedId = rawId.replace(/-\d+\.\d+$/, '');
        
        // Mapear produto para termos usados na base de cotação
        const productMap: Record<string, string> = {
          gasolina_comum: 'Gasolina Comum',
          gasolina_aditivada: 'Aditivada',
          etanol: 'Etanol',
          diesel_comum: 'S500',
          s10: 'S10',
          arla32_granel: 'ARLA'
        };
        const produtoBusca = productMap[formData.product] || formData.product;

        // Candidatos para identificar o posto na função (prioriza CNPJ/código)
        const candidates: string[] = [];
        if (selectedStation.code) candidates.push(selectedStation.code);
        if (cleanedId && !candidates.includes(cleanedId)) candidates.push(cleanedId);
        if (selectedStation.name && !candidates.includes(selectedStation.name)) candidates.push(selectedStation.name);

        // Tentar resolver CNPJ via public.sis_empresa quando não tivermos código
        try {
          if (!selectedStation.code && selectedStation.name) {
            const { data: se } = await supabase
              .from('sis_empresa' as any)
              .select('cnpj_cpf,nome_empresa')
              .ilike('nome_empresa', `%${selectedStation.name}%`)
              .limit(1);
            const seArr = (se as any[]) || [];
            const seRow = seArr[0] || null;
            if (seRow?.cnpj_cpf && !candidates.includes(seRow.cnpj_cpf)) {
              candidates.unshift(seRow.cnpj_cpf);
            }
          }
        } catch (_e) {}

        // Tentar a função RPC com múltiplos candidatos
        let resultData: any[] | null = null;
        for (const cand of candidates) {
          const { data: d, error: e } = await supabase
            .rpc('get_lowest_cost_freight', {
              p_posto_id: cand,
              p_produto: produtoBusca,
              p_date: today
            });
          
          if (!e && d && Array.isArray(d) && d.length > 0) {
            resultData = d;
            break;
          }
        }

        // Fallback 1: buscar direto na schema cotacao (mais recente do geral + frete)
        let resultError: any = null;
        if (!resultData) {
          try {
            const cot: any = (supabase as any).schema ? (supabase as any).schema('cotacao') : null;
            if (cot) {
              // 1) IDs do produto (ex.: S10)
              const { data: gci } = await cot
                .from('grupo_codigo_item')
                .select('id_grupo_codigo_item,nome,descricao')
                .ilike('nome', `%${produtoBusca}%`)
                .limit(20);
              const ids = (gci as any[])?.map((r: any) => r.id_grupo_codigo_item) || [];

              if (ids.length > 0) {
                // 2) Última data disponível
                const { data: maxRows } = await cot
                  .from('cotacao_geral_combustivel')
                  .select('data_cotacao')
                  .in('id_grupo_codigo_item', ids)
                  .order('data_cotacao', { ascending: false })
                  .limit(1);
                const lastDateStr = maxRows?.[0]?.data_cotacao as string | undefined;
                console.log('🗓️ Última data geral:', lastDateStr);

                // 3) Resolver id_empresa do posto
                const { data: emp } = await cot
                  .from('sis_empresa')
                  .select('id_empresa,nome_empresa,cnpj_cpf')
                  .ilike('nome_empresa', `%${selectedStation.name}%`)
                  .limit(1);
                const idEmpresa = (emp as any[])?.[0]?.id_empresa as number | undefined;
                console.log('🏢 Empresa resolvida:', { idEmpresa, nome: (emp as any[])?.[0]?.nome_empresa });

                if (lastDateStr) {
                  const start = new Date(lastDateStr);
                  const end = new Date(start);
                  end.setDate(end.getDate() + 1);
                  const startIso = start.toISOString();
                  const endIso = end.toISOString();

                  // 4) Cotações do dia mais recente para o produto
                  const { data: cg } = await cot
                    .from('cotacao_geral_combustivel')
                    .select('id_base_fornecedor,valor_unitario,desconto_valor,forma_entrega,data_cotacao')
                    .in('id_grupo_codigo_item', ids)
                    .gte('data_cotacao', startIso)
                    .lt('data_cotacao', endIso);

                  const baseIds = Array.from(new Set((cg as any[])?.map((r: any) => r.id_base_fornecedor) || []));

                  // 5) Fretes ativos para a empresa e bases
                  let freteMap = new Map<number, number>();
                  if (idEmpresa && baseIds.length > 0) {
                    const { data: fretes } = await cot
                      .from('frete_empresa')
                      .select('id_base_fornecedor,frete_real,frete_atual,registro_ativo')
                      .eq('id_empresa', idEmpresa)
                      .in('id_base_fornecedor', baseIds)
                      .eq('registro_ativo', true);
                    (fretes as any[])?.forEach((f: any) => {
                      freteMap.set(f.id_base_fornecedor, Number(f.frete_real ?? f.frete_atual ?? 0));
                    });
                  }

                  // 6) Info de base
                  let baseInfo = new Map<number, { nome: string; codigo: string; uf: string }>();
                  if (baseIds.length > 0) {
                    const { data: bases } = await cot
                      .from('base_fornecedor')
                      .select('id_base_fornecedor,nome,codigo_base,uf')
                      .in('id_base_fornecedor', baseIds);
                    (bases as any[])?.forEach((b: any) => {
                      baseInfo.set(b.id_base_fornecedor, { nome: b.nome, codigo: b.codigo_base, uf: String(b.uf || '') });
                    });
                  }

                  // 7) Calcular menor custo total (aplica frete quando FOB)
                  let best: any = null;
                  (cg as any[])?.forEach((row: any) => {
                    const custo = Number(row.valor_unitario) - Number(row.desconto_valor || 0);
                    const frete = row.forma_entrega === 'FOB' ? (freteMap.get(row.id_base_fornecedor) || 0) : 0;
                    const total = custo + frete;
                    const info = baseInfo.get(row.id_base_fornecedor) || { nome: 'Base', codigo: String(row.id_base_fornecedor), uf: '' };
                    if (!best || total < best.custo_total) {
                      best = {
                        base_codigo: info.codigo,
                        base_id: String(row.id_base_fornecedor),
                        base_nome: info.nome,
                        base_uf: info.uf,
                        custo,
                        frete,
                        custo_total: total,
                        forma_entrega: row.forma_entrega,
                        data_referencia: row.data_cotacao
                      };
                    }
                  });

                  if (best) {
                    resultData = [best];
                    console.log('✅ Fallback cotacao encontrou melhor custo:', best);
                  }
                }
              }
            }
          } catch (e) {
            console.log('⚠️ Erro no fallback cotacao:', (e as any)?.message || e);
          }
        }

        // Fallback 2: última referência manual compatível
        if (!resultData) {
          const { data: ref } = await supabase
            .from('referencias' as any)
            .select('preco_referencia, created_at, posto_id, produto')
            .ilike('posto_id', `%${selectedStation.name}%`)
            .ilike('produto', `%${produtoBusca}%`)
            .order('created_at', { ascending: false })
            .limit(1);
          const refArr = (ref as any[]) || [];
          if (refArr.length > 0) {
            resultData = [{
              base_codigo: refArr[0].posto_id,
              base_id: refArr[0].posto_id,
              base_nome: 'Referência',
              base_uf: '',
              custo: Number(refArr[0].preco_referencia),
              frete: 0,
              custo_total: Number(refArr[0].preco_referencia),
              forma_entrega: 'FOB',
              data_referencia: refArr[0].created_at
            }];
          }
        }

        const data = resultData;
        const error = null;

        console.log('📊 Resposta da função (com fallback):', { data, error });

        if (error) {
          console.error('❌ Erro ao buscar menor custo:', error);
          toast.error(`Erro ao buscar cotação: ${error.message || error}`);
          setFetchStatus({ type: 'error', message: String(error.message || error) });
          return;
        }

        if (data && Array.isArray(data) && data.length > 0) {
          const result = data[0];
          console.log('✅ Resultado encontrado:', result);
          
          const custo = Number(result.custo || 0);
          const frete = Number(result.frete || 0);
          const custoTotal = Number(result.custo_total || 0);
          
          console.log('💰 Valores convertidos:', { custo, frete, custoTotal });
          
          if (custoTotal > 0) {
            setFormData(prev => ({
              ...prev,
              purchase_cost: Math.max(custo, 0).toFixed(4),
              freight_cost: Math.max(frete, 0).toFixed(4)
            }));
            
            // Armazenar informações sobre a origem do preço
            setPriceOrigin({
              base_nome: result.base_nome || '',
              base_codigo: result.base_codigo || '',
              base_uf: result.base_uf || '',
              forma_entrega: result.forma_entrega || ''
            });

            const refDateIso = result.data_referencia ? new Date(result.data_referencia).toISOString().split('T')[0] : null;
            const isReference = (result.base_nome || '').toLowerCase().includes('refer');
            const statusType: 'today' | 'latest' | 'reference' = isReference ? 'reference' : (refDateIso === today ? 'today' : 'latest');
            setFetchStatus({ type: statusType, date: result.data_referencia || null });
            
            // Remover toasts para não incomodar
            // if (frete > 0) {
            //   toast.success(`Menor custo+frete encontrado: R$ ${custo.toFixed(4)} + R$ ${frete.toFixed(4)} = R$ ${custoTotal.toFixed(4)}`);
            // } else {
            //   toast.success(`Preço de referência encontrado: R$ ${custo.toFixed(4)}`);
            // }
            
            // Se for S10, buscar também o preço do ARLA
            if (formData.product === 's10') {
              console.log('🔍 Produto S10 detectado, buscando preço do ARLA...');
              try {
                let arlaData: any[] | null = null;
                
                // Tentar RPC primeiro
                for (const cand of candidates) {
                  const { data: d, error: e } = await supabase
                    .rpc('get_lowest_cost_freight', {
                      p_posto_id: cand,
                      p_produto: 'ARLA',
                      p_date: today
                    });
                  
                  if (!e && d && Array.isArray(d) && d.length > 0) {
                    arlaData = d;
                    console.log('✅ ARLA encontrado via RPC:', arlaData);
                    break;
                  }
                }
                
                // Fallback: buscar direto na tabela cotacao_arla via id_empresa
                if (!arlaData) {
                  console.log('🔄 Fallback: buscando ARLA direto na tabela cotacao.cotacao_arla...');
                  try {
                    // Primeiro, resolver id_empresa
                    let resolvedIdEmpresa: number | null = null;
                    try {
                      const { data: emp } = await (supabase as any).schema('cotacao')
                        .from('sis_empresa')
                        .select('id_empresa')
                        .ilike('nome_empresa', `%${selectedStation.name}%`)
                        .limit(1);
                      resolvedIdEmpresa = (emp as any[])?.[0]?.id_empresa as number | undefined || null;
                    } catch {}
                    
                    if (resolvedIdEmpresa) {
                      const cot: any = (supabase as any).schema ? (supabase as any).schema('cotacao') : null;
                      if (cot) {
                        // Buscar último preço do ARLA para a empresa
                        const { data: arlaRows } = await cot
                          .from('cotacao_arla')
                          .select('valor_unitario,data_cotacao,id_empresa,nome_empresa')
                          .eq('id_empresa', resolvedIdEmpresa)
                          .order('data_cotacao', { ascending: false })
                          .limit(1);
                      
                        if (arlaRows && arlaRows.length > 0) {
                          arlaData = [{
                            custo: Number(arlaRows[0].valor_unitario || 0),
                            data_referencia: arlaRows[0].data_cotacao
                          }];
                          console.log('✅ ARLA encontrado via fallback cotacao_arla:', arlaData);
                        }
                      }
                    }
                  } catch (fallbackErr) {
                    console.error('⚠️ Erro no fallback cotacao_arla:', fallbackErr);
                  }
                }
                
                if (arlaData && arlaData.length > 0) {
                  const arlaResult = arlaData[0];
                  const arlaCusto = Number(arlaResult.custo || 0);
                  console.log('✅ Preço do ARLA encontrado:', arlaCusto);
                  
                  if (arlaCusto > 0) {
                    setFormData(prev => ({
                      ...prev,
                      arla_cost_price: arlaCusto.toFixed(4)
                    }));
                    // Remover toast para não incomodar
                    // toast.success(`Preço do ARLA encontrado: R$ ${arlaCusto.toFixed(4)}`);
                  }
                } else {
                  console.log('⚠️ Preço do ARLA não encontrado');
                }
              } catch (arlaErr) {
                console.error('⚠️ Erro ao buscar preço do ARLA:', arlaErr);
              }
            }
          } else {
            console.log('⚠️ Custo total é zero ou negativo');
            setFetchStatus({ type: 'none' });
          }
        } else {
          console.log('⚠️ Nenhum custo encontrado para os parâmetros fornecidos');
          setPriceOrigin(null);
          setFetchStatus({ type: 'none' });
        }
      } catch (error) {
        console.error('❌ Erro inesperado ao buscar menor custo:', error);
        setFetchStatus({ type: 'none' });
        // Silent fail - just don't auto-fill
      }
    };

    fetchLowestCostAndFreight();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.station_id, formData.product, lastSearchedStation, lastSearchedProduct]);

  const loadMyRequests = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('price_suggestions')
        .select('*')
        .eq('requested_by', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Carregar postos e clientes para enriquecer dados
      const [stationsRes, clientsRes] = await Promise.all([
        supabase.rpc('get_sis_empresa_stations').then(res => ({ data: res.data, error: res.error })),
        supabase.from('clientes' as any).select('id_cliente, nome')
      ]);

      // Enriquecer dados
      const enrichedData = (data || []).map((request: any) => {
        let station = null;
        if (request.station_id) {
          station = (stationsRes.data as any)?.find((s: any) => {
            const stationId = String(s.id || s.id_empresa || s.cnpj_cpf || '');
            const suggId = String(request.station_id);
            return stationId === suggId || s.cnpj_cpf === suggId || s.id_empresa === suggId;
          });
        }
        
        let client = null;
        if (request.client_id) {
          client = (clientsRes.data as any)?.find((c: any) => {
            const clientId = String(c.id_cliente || c.id || '');
            const suggId = String(request.client_id);
            return clientId === suggId;
          });
        }

        return {
          ...request,
          stations: station ? { name: station.nome_empresa || station.name, code: station.cnpj_cpf || station.id || station.id_empresa } : null,
          clients: client ? { name: client.nome || client.name, code: String(client.id_cliente || client.id) } : null
        };
      });

      setMyRequests(enrichedData);
    } catch (error) {
      console.error('Erro ao carregar minhas solicitações:', error);
    }
  };

  const loadReferences = async () => {
    try {
      console.log('Carregando referências...');
      const { data, error } = await supabase
        .from('referencias' as any)
        .select('*' as any)
        .order('created_at', { ascending: false });

      if (error) {
        console.log('Erro ao carregar referências:', error.message);
        // Tentar carregar da tabela price_suggestions como fallback
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('price_suggestions')
          .select(`
            *,
            stations!station_id(name, code),
            clients!client_id(name, code),
            payment_methods!payment_method_id(name)
          `)
          .eq('status', 'approved')
          .order('created_at', { ascending: false });

        if (fallbackError) {
          console.log('Erro no fallback também:', fallbackError.message);
          setReferences([]);
          return;
        }

        // Converter price_suggestions para formato de referências
        const convertedReferences = fallbackData?.map(suggestion => ({
          id: suggestion.id,
          codigo_referencia: `REF-${suggestion.id}`,
          posto_id: suggestion.station_id,
          cliente_id: suggestion.client_id,
          produto: suggestion.product,
          preco_referencia: suggestion.final_price / 100,
          tipo_pagamento_id: suggestion.payment_method_id,
          observacoes: suggestion.observations,
          anexo: suggestion.attachments?.join(',') || null,
          criado_por: suggestion.requested_by || suggestion.created_at,
          stations: Array.isArray(suggestion.stations) ? suggestion.stations[0] : suggestion.stations,
          clients: Array.isArray(suggestion.clients) ? suggestion.clients[0] : suggestion.clients,
          payment_methods: Array.isArray(suggestion.payment_methods) ? suggestion.payment_methods[0] : suggestion.payment_methods,
        })) || [];

        console.log('Referências carregadas do fallback:', convertedReferences.length);
        setReferences(convertedReferences);
        return;
      }

      console.log('Referências carregadas:', data?.length || 0);
      setReferences(data as any[] || []);
    } catch (error) {
      console.error('Erro ao carregar referências:', error);
      setReferences([]);
    }
  };

  const handleInputChange = async (field: string, value: any) => {
    console.log('📝 handleInputChange:', { field, value });
    setFormData(prev => ({ ...prev, [field]: value }));

    // Se mudou o posto, carregar métodos de pagamento dele
    if (field === 'station_id') {
      console.log('🚀 station_id mudou, carregando métodos de pagamento...');
      if (value && value !== 'none' && value !== '') {
        console.log('🔍 Chamando getPaymentMethodsForStation com:', value);
        const methods = await getPaymentMethodsForStation(value);
        console.log('📋 Métodos retornados:', methods);
        setStationPaymentMethods(methods);
      } else {
        console.log('⚠️ station_id vazio ou none, limpando métodos');
        setStationPaymentMethods([]);
      }
    }
  };

  const calculateMargin = useCallback(() => {
    try {
      const suggestedPrice = parseFloat(formData.suggested_price);
      const currentPrice = parseFloat(formData.current_price);
      
      console.log('=== CALCULANDO MARGENS ===');
      console.log('suggestedPrice:', suggestedPrice);
      console.log('currentPrice:', currentPrice);

      // 1) Aumento vs Preço Atual (em centavos)
      if (!isNaN(suggestedPrice) && !isNaN(currentPrice) && currentPrice > 0) {
        const inc = Math.round((suggestedPrice - currentPrice) * 100);
        setPriceIncreaseCents(inc);
      } else {
        setPriceIncreaseCents(0);
      }

      // 2) Margem (Sugerido - Custo final) em centavos
      // Recalcula custo final localmente para evitar dessincronização
      const purchaseCost = parseFloat(formData.purchase_cost) || 0;
      const freightCost = parseFloat(formData.freight_cost) || 0;
      
      // Os custos JÁ estão em R$/L
      const baseCost = purchaseCost + freightCost;
      
      // Buscar taxa específica do posto ou taxa padrão
      let feePercentage = 0;
      if (formData.payment_method_id && formData.payment_method_id !== 'none') {
        const stationMethod = stationPaymentMethods.find(pm => {
          const methodId = String((pm as any).id || (pm as any).ID_POSTO || '');
          return pm.CARTAO === formData.payment_method_id || methodId === String(formData.payment_method_id);
        });
        
        if (stationMethod) {
          feePercentage = stationMethod.TAXA || 0;
        } else {
          const defaultMethod = paymentMethods.find(pm => pm.CARTAO === formData.payment_method_id);
          feePercentage = defaultMethod?.TAXA || 0;
        }
      }
      
      const finalCost = baseCost * (1 + feePercentage / 100);

      if (!isNaN(suggestedPrice) && suggestedPrice > 0) {
        const marginCents = Math.round((suggestedPrice - finalCost) * 100);
        setCalculatedPrice(suggestedPrice);
        setMargin(marginCents);
        console.log('✅ Margem (sugerido - custo final):', marginCents, 'centavos');
      } else {
        setCalculatedPrice(0);
        setMargin(0);
        console.log('❌ Sem preço sugerido válido');
      }
    } catch (error) {
      console.error('❌ Erro ao calcular margem:', error);
      setCalculatedPrice(0);
      setMargin(0);
    }
  }, [formData.suggested_price, formData.current_price, formData.purchase_cost, formData.freight_cost, formData.payment_method_id, paymentMethods, stationPaymentMethods]);

  const calculateCosts = useCallback(() => {
    try {
      const purchaseCost = parseFloat(formData.purchase_cost) || 0;
      const freightCost = parseFloat(formData.freight_cost) || 0;
      const volumeMade = parseFloat(formData.volume_made) || 0;
      const volumeProjected = parseFloat(formData.volume_projected) || 0;
      const suggestedPrice = parseFloat(formData.suggested_price) || 0;
      const arlaPurchase = parseFloat(formData.arla_purchase_price) || 0;
      // Usar o preço sugerido como preço de venda do ARLA quando o produto for ARLA
      const arlaSale = formData.product === 'arla32_granel' ? suggestedPrice : 0;
      
      // Buscar taxa específica do posto ou taxa padrão
      let feePercentage = 0;
      if (formData.payment_method_id && formData.payment_method_id !== 'none') {
        // Buscar tanto pelo ID quanto pelo CARTAO
        const stationMethod = stationPaymentMethods.find(pm => {
          const methodId = String((pm as any).id || (pm as any).ID_POSTO || '');
          return pm.CARTAO === formData.payment_method_id || methodId === String(formData.payment_method_id);
        });
        
        if (stationMethod) {
          feePercentage = stationMethod.TAXA || 0;
        } else {
          // Tentar em paymentMethods padrão
          const defaultMethod = paymentMethods.find(pm => pm.CARTAO === formData.payment_method_id);
          feePercentage = defaultMethod?.TAXA || 0;
        }
      }
      
      // NOTA: Os valores de purchase_cost e freight_cost JÁ VÊM em R$/L
      // O preço sugerido também já vem em R$/L
      
      // Converter m³ para litros (1 m³ = 1000 litros)
      const volumeProjectedLiters = volumeProjected * 1000;
      
      // Os custos JÁ estão em R$/L, então não precisa converter
      // Calcular base cost em R$/L
      const baseCost = purchaseCost + freightCost;
      
      // Calcular custo final em R$/L (aplicando taxa)
      const finalCost = baseCost * (1 + feePercentage / 100);
      
      // Calcular receita total (volume projetado em litros * preço sugerido)
      const totalRevenue = volumeProjectedLiters * suggestedPrice;
      
      // Calcular custo total (volume projetado em litros * custo final)
      const totalCost = volumeProjectedLiters * finalCost;
      
      // Lucro bruto = receita - custo
      const grossProfit = totalRevenue - totalCost;
      
      console.log('🛢️ Cálculo Lucro Diesel:', {
        volumeProjetadoM3: volumeProjected,
        volumeProjetadoLitros: volumeProjectedLiters,
        compraPorL: purchaseCost,
        fretePorL: freightCost,
        baseCostPorL: baseCost,
        taxaPercentual: feePercentage,
        custoFinalPorL: finalCost,
        precoSugerido: suggestedPrice,
        receitaTotal: totalRevenue,
        custoTotal: totalCost,
        lucroBruto: grossProfit,
        lucroPorLitro: grossProfit / volumeProjectedLiters
      });
      
      // Verificação manual
      const expectedLucro = (suggestedPrice - finalCost) * volumeProjectedLiters;
      console.log('✅ Verificação:', {
        'Preço - Custo por L': (suggestedPrice - finalCost).toFixed(4),
        '× Volume (L)': volumeProjectedLiters,
        '= Lucro Esperado': expectedLucro,
        'Lucro Calculado': grossProfit,
        'Diferença': Math.abs(expectedLucro - grossProfit)
      });
      
      // Lucro por litro
      const profitPerLiter = volumeProjectedLiters > 0 ? grossProfit / volumeProjectedLiters : 0;
      
      // Compensação do ARLA (margem ARLA * volume)
      // Para S10: ARLA é vendido junto, então calculamos a margem do ARLA
      // Volume do ARLA é proporcional ao diesel (aprox. 5% do volume)
      const arlaVolume = volumeProjectedLiters * 0.05;
      let arlaCompensation = 0;
      
      if (formData.product === 's10') {
        // Para S10: margem = preço de venda do ARLA - preço de compra do ARLA
        const arlaMargin = parseFloat(formData.arla_purchase_price) - parseFloat(formData.arla_cost_price);
        // Volume de ARLA é 5% do volume de diesel (já em litros)
        // arlaVolume já está em litros (volumeProjectedLiters * 0.05)
        arlaCompensation = arlaVolume * arlaMargin;
        console.log('🔍 Cálculo ARLA S10:', {
          volumeDieselLitros: volumeProjectedLiters,
          volumeARLALitros: arlaVolume,
          arlaPurchasePrice: formData.arla_purchase_price,
          arlaCostPrice: formData.arla_cost_price,
          arlaMargin,
          arlaCompensation
        });
      } else if (formData.product === 'arla32_granel') {
        // Para ARLA: margem = preço sugerido - preço de compra
        const arlaMargin = suggestedPrice - parseFloat(formData.arla_cost_price);
        arlaCompensation = volumeProjectedLiters * arlaMargin;
      }
      
      // Resultado líquido (lucro bruto + compensação ARLA)
      const netResult = grossProfit + arlaCompensation;
      
      setCostCalculations({
        finalCost,
        totalRevenue,
        totalCost,
        grossProfit,
        profitPerLiter,
        arlaCompensation,
        netResult
      });
    } catch (error) {
      console.error('Erro ao calcular custos:', error);
      setCostCalculations({
        finalCost: 0,
        totalRevenue: 0,
        totalCost: 0,
        grossProfit: 0,
        profitPerLiter: 0,
        arlaCompensation: 0,
        netResult: 0
      });
    }
  }, [
    formData.purchase_cost,
    formData.freight_cost,
    formData.volume_made,
    formData.volume_projected,
    formData.suggested_price,
    formData.arla_purchase_price,
    formData.product,
    formData.payment_method_id,
    paymentMethods,
    stationPaymentMethods
  ]);

  // Recalcular margem quando os campos relevantes mudarem (com debounce)
  useEffect(() => {
    const timeout = setTimeout(() => {
      calculateMargin();
    }, 100);
    return () => clearTimeout(timeout);
  }, [
    formData.suggested_price,
    formData.current_price,
    formData.purchase_cost,
    formData.freight_cost,
    formData.payment_method_id,
    stationPaymentMethods,
    paymentMethods
  ]);

  // Recalcular custos quando os campos relevantes mudarem (com debounce)
  useEffect(() => {
    const timeout = setTimeout(() => {
      calculateCosts();
    }, 100);
    return () => clearTimeout(timeout);
  }, [
    formData.purchase_cost,
    formData.freight_cost,
    formData.volume_made,
    formData.volume_projected,
    formData.suggested_price,
    formData.arla_purchase_price,
    formData.product,
    formData.payment_method_id,
    stationPaymentMethods,
    paymentMethods
  ]);

  const getFilteredReferences = () => {
    try {
      if (!Array.isArray(references)) {
        console.log('References não é um array:', references);
        return [];
      }
      
      console.log('Total de referências:', references.length);
      console.log('Filtros:', { station_id: formData.station_id, client_id: formData.client_id, product: formData.product });
      
      const filtered = references.filter(ref => {
        if (!ref) return false;
        return (
          (!formData.station_id || String(ref.posto_id) === String(formData.station_id)) &&
          (!formData.client_id || String(ref.cliente_id) === String(formData.client_id)) &&
          (!formData.product || ref.produto === formData.product)
        );
      });
      
      console.log('Referências filtradas:', filtered.length);
      return filtered;
    } catch (error) {
      console.error('Error filtering references:', error);
      return [];
    }
  };

  const formatPrice = (price: number) => {
    if (typeof price !== 'number' || isNaN(price)) return 'R$ 0,00';
    return price.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  };

  // Formatação com 4 casas decimais para valores unitários (custo/L, preço/L)
  const formatPrice4Decimals = (price: number) => {
    if (typeof price !== 'number' || isNaN(price)) return 'R$ 0,0000';
    return price.toLocaleString('pt-BR', {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
      style: 'currency',
      currency: 'BRL'
    });
  };

  const handleSubmit = async (isDraft: boolean = false) => {
    // Só validar campos obrigatórios se não for rascunho
    if (!isDraft && (!formData.station_id || !formData.client_id || !formData.product || !formData.suggested_price)) {
      toast.error("Por favor, preencha todos os campos obrigatórios");
      return;
    }

    setLoading(true);
    try {
      // Converter preços para formato de reais (NÃO centavos)
      const suggestedPriceNum = parseBrazilianDecimal(formData.suggested_price);
      const currentPriceNum = parseBrazilianDecimal(formData.current_price);
      const purchaseCostNum = parseBrazilianDecimal(formData.purchase_cost);
      const freightCostNum = parseBrazilianDecimal(formData.freight_cost);
      
      // Salvar valores em REAIS (o banco espera numeric(10,4) que já aceita decimais)
      const finalPrice = isNaN(suggestedPriceNum) ? null : suggestedPriceNum;
      const currentPrice = isNaN(currentPriceNum) ? null : currentPriceNum;
      const suggestedPrice = isNaN(suggestedPriceNum) ? null : suggestedPriceNum;
      const costPrice = purchaseCostNum + freightCostNum;
      
      console.log('💰 Valores de preço:', {
        final_price: finalPrice,
        current_price: currentPrice,
        suggested_price: suggestedPrice,
        cost_price: costPrice
      });
      
      // Como as colunas foram alteradas para TEXT, podemos salvar qualquer ID
      const stationIdToSave = (!formData.station_id || formData.station_id === 'none') 
        ? null 
        : String(formData.station_id);
        
      const clientIdToSave = (!formData.client_id || formData.client_id === 'none')
        ? null
        : String(formData.client_id);
        
      const referenceIdToSave = (!formData.reference_id || formData.reference_id === 'none')
        ? null
        : String(formData.reference_id);
      
      const paymentMethodIdToSave = (!formData.payment_method_id || formData.payment_method_id === 'none')
        ? null
        : String(formData.payment_method_id);
      
      console.log('📝 IDs DO FORMULÁRIO:', {
        station_id_form: formData.station_id,
        client_id_form: formData.client_id,
        reference_id_form: formData.reference_id,
        payment_method_id_form: formData.payment_method_id
      });
      console.log('📝 IDs VALIDADOS PARA SALVAR:', {
        station_id: stationIdToSave,
        client_id: clientIdToSave,
        reference_id: referenceIdToSave,
        payment_method_id: paymentMethodIdToSave
      });
      
      const requestData = {
        station_id: stationIdToSave,
        client_id: clientIdToSave,
        product: formData.product as any,
        current_price: currentPrice,
        suggested_price: suggestedPrice,
        final_price: finalPrice ?? 0,
        reference_id: referenceIdToSave,
        payment_method_id: paymentMethodIdToSave,
        observations: formData.observations || null,
        attachments: attachments,
        requested_by: user?.id,
        margin_cents: Math.round(margin * 100), // Margem em centavos para cálculo
        cost_price: costPrice,
        status: isDraft ? 'draft' as any : 'pending' as any,
        // Dados de cálculo para análise
        purchase_cost: parseBrazilianDecimal(formData.purchase_cost) || null,
        freight_cost: parseBrazilianDecimal(formData.freight_cost) || null,
        volume_made: parseBrazilianDecimal(formData.volume_made) || null,
        volume_projected: parseBrazilianDecimal(formData.volume_projected) || null,
        arla_purchase_price: parseBrazilianDecimal(formData.arla_purchase_price) || null,
        arla_cost_price: parseBrazilianDecimal(formData.arla_cost_price) || null,
        // Origem do preço
        price_origin_base: priceOrigin?.base_nome || null,
        price_origin_code: priceOrigin?.base_codigo || null,
        price_origin_uf: priceOrigin?.base_uf || null,
        price_origin_delivery: priceOrigin?.forma_entrega || null,
        // Aprovação multinível - iniciar no nível 1
        approval_level: 1,
        total_approvers: 3,
        approvals_count: 0,
        rejections_count: 0
      };

      console.log('🔍 Dados a serem inseridos:', requestData);
      console.log('📝 isDraft:', isDraft, 'status:', isDraft ? 'draft' : 'pending');
      
      const { data, error } = await supabase
        .from('price_suggestions')
        .insert([requestData])
        .select()
        .single();

      if (error) {
        console.error('❌ Erro completo:', error);
        console.error('❌ Código do erro:', error.code);
        console.error('❌ Detalhes do erro:', error.details);
        console.error('❌ Mensagem:', error.message);
        toast.error("Erro ao salvar solicitação: " + error.message);
        return;
      }

      // Carregar dados completos da solicitação com nomes
      let stationData = null;
      let clientData = null;
      
      console.log('🔍 Buscando dados do posto e cliente...');
      console.log('station_id:', stationIdToSave, 'client_id:', clientIdToSave);
      console.log('stations disponíveis:', stations.length);
      console.log('clients disponíveis:', clients.length);
      
      // Buscar posto - tentar vários campos
      if (stationIdToSave) {
        try {
          // Tentar por cnpj_cpf primeiro
          const { data: seByCnpj, error: cnpjError } = await supabase
            .from('sis_empresa' as any)
            .select('nome_empresa, cnpj_cpf')
            .eq('cnpj_cpf', stationIdToSave)
            .maybeSingle();
          
          if (!cnpjError && seByCnpj) {
            stationData = { name: (seByCnpj as any).nome_empresa, code: (seByCnpj as any).cnpj_cpf };
            console.log('✅ Posto encontrado por CNPJ:', stationData.name);
          } else {
            // Tentar como UUID direto
            const { data: seById, error: idError } = await supabase
              .from('sis_empresa' as any)
              .select('nome_empresa, cnpj_cpf')
              .eq('id', stationIdToSave)
              .maybeSingle();
            
            if (!idError && seById) {
              stationData = { name: (seById as any).nome_empresa, code: (seById as any).cnpj_cpf || stationIdToSave };
              console.log('✅ Posto encontrado por ID:', stationData.name);
            } else {
              // Buscar da lista de stations que já temos carregada
              const foundStation = stations.find(s => s.id === stationIdToSave || s.code === stationIdToSave);
              if (foundStation) {
                stationData = { name: foundStation.name, code: foundStation.code || foundStation.id };
                console.log('✅ Posto encontrado na lista:', stationData.name);
              } else {
                console.warn('⚠️ Posto não encontrado para:', stationIdToSave);
                console.warn('IDs disponíveis:', stations.map(s => ({ id: s.id, code: s.code })));
              }
            }
          }
        } catch (err) {
          console.error('Erro ao buscar dados do posto:', err);
        }
      }
      
      // Buscar cliente
      if (clientIdToSave) {
        try {
          const { data: client, error: clientError } = await supabase
            .from('clientes' as any)
            .select('nome, id_cliente')
            .eq('id_cliente', clientIdToSave)
            .maybeSingle();
          
          if (!clientError && client) {
            clientData = { name: (client as any).nome, code: String((client as any).id_cliente) };
            console.log('✅ Cliente encontrado:', clientData.name);
          } else {
            // Buscar da lista de clients que já temos carregada
            const foundClient = clients.find(c => c.id === clientIdToSave || c.code === clientIdToSave);
            if (foundClient) {
              clientData = { name: foundClient.name, code: foundClient.code || foundClient.id };
              console.log('✅ Cliente encontrado na lista:', clientData.name);
            } else {
              console.warn('⚠️ Cliente não encontrado para:', clientIdToSave);
              console.warn('IDs disponíveis:', clients.map(c => ({ id: c.id, code: c.code })));
            }
          }
        } catch (err) {
          console.error('Erro ao buscar dados do cliente:', err);
        }
      }

      const enrichedData = {
        ...data,
        stations: stationData || { name: formData.station_id, code: formData.station_id },
        clients: clientData || { name: formData.client_id, code: formData.client_id },
        payment_methods: stationPaymentMethods.find(pm => {
          const methodId = String((pm as any).id || (pm as any).ID_POSTO || '');
          return pm.CARTAO === formData.payment_method_id || methodId === String(formData.payment_method_id);
        }) || paymentMethods.find(pm => pm.CARTAO === formData.payment_method_id) || null
      };
      
      console.log('📊 Dados enriquecidos:', enrichedData);

      toast.success(isDraft ? "Rascunho salvo com sucesso!" : "Solicitação enviada para aprovação!");
      setSaveAsDraft(isDraft);
      setSavedSuggestion(enrichedData);
      
    } catch (error) {
      console.error('Erro ao salvar solicitação:', error);
      toast.error("Erro ao salvar solicitação");
    } finally {
      setLoading(false);
    }
  };

  if (dbLoadingHook) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-slate-300 border-t-slate-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Carregando dados...</p>
        </div>
      </div>
    );
  }

  // Success screen
  if (savedSuggestion) {
    const formatDateTime = (dateString: string) => new Date(dateString).toLocaleString('pt-BR');
    const toReais = (cents: number | null | undefined) => {
      const n = Number(cents ?? 0);
      return n >= 20 ? n / 100 : n;
    };
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="container mx-auto px-4 py-8 space-y-8">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-green-600 via-green-500 to-green-600 p-8 text-white shadow-2xl">
            <div className="absolute inset-0 bg-black/10"></div>
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-6">
                <Button 
                  variant="secondary" 
                  onClick={() => navigate("/dashboard")}
                  className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white border-white/30 backdrop-blur-sm"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Voltar ao Dashboard
                </Button>
                <div>
                  <h1 className="text-3xl font-bold mb-2">Solicitação Enviada!</h1>
                  <p className="text-green-100">Sua solicitação de preço foi enviada para aprovação</p>
                </div>
              </div>
            </div>
          </div>

          <Card className="shadow-xl border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
            <CardHeader className="text-center pb-6">
              <div className="flex justify-center mb-6">
                <div className="w-20 h-20 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center shadow-lg">
                  <CheckCircle className="h-12 w-12 text-white" />
                </div>
              </div>
              <CardTitle className="text-2xl font-bold text-green-600 dark:text-green-400 mb-2">
                {saveAsDraft ? "Rascunho Salvo com Sucesso!" : "Solicitação Enviada com Sucesso!"}
              </CardTitle>
              <p className="text-slate-600 dark:text-slate-400">
                {saveAsDraft 
                  ? "O rascunho foi salvo e você pode continuar editando depois" 
                  : "Os dados foram salvos e estão em processo de aprovação"}
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-3 mb-3">
                    <Label className="text-sm font-semibold text-blue-700 dark:text-blue-300">Posto</Label>
                  </div>
                  <p className="text-xl font-bold text-blue-900 dark:text-blue-100">
                    {savedSuggestion.stations?.name || savedSuggestion.station_id || 'N/A'}
                  </p>
                </div>

                <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl p-6 border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-3 mb-3">
                    <Label className="text-sm font-semibold text-green-700 dark:text-green-300">Cliente</Label>
                  </div>
                  <p className="text-xl font-bold text-green-900 dark:text-green-100">
                    {savedSuggestion.clients?.name || savedSuggestion.client_id || 'N/A'}
                  </p>
                </div>

                <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl p-6 border border-purple-200 dark:border-purple-800">
                  <div className="flex items-center gap-3 mb-3">
                    <Label className="text-sm font-semibold text-purple-700 dark:text-purple-300">Produto</Label>
                  </div>
                  <p className="text-lg font-semibold text-purple-900 dark:text-purple-100">{savedSuggestion.product}</p>
                </div>

                <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-xl p-6 border border-amber-200 dark:border-amber-800">
                  <div className="flex items-center gap-3 mb-3">
                    <Label className="text-sm font-semibold text-amber-700 dark:text-amber-300">Preço Sugerido</Label>
                  </div>
                  <p className="text-2xl font-bold text-amber-900 dark:text-amber-100">
                    {formatPrice(toReais(savedSuggestion.final_price))}
                  </p>
                </div>

                <div className="bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/20 rounded-xl p-6 border border-cyan-200 dark:border-cyan-800">
                  <div className="flex items-center gap-3 mb-3">
                    <Label className="text-sm font-semibold text-cyan-700 dark:text-cyan-300">Custo Total</Label>
                  </div>
                  <p className="text-xl font-bold text-cyan-900 dark:text-cyan-100">
                    {formatPrice(toReais(savedSuggestion.cost_price))}
                  </p>
                </div>

                <div className="bg-gradient-to-r from-pink-50 to-rose-50 dark:from-pink-900/20 dark:to-rose-900/20 rounded-xl p-6 border border-pink-200 dark:border-pink-800">
                  <div className="flex items-center gap-3 mb-3">
                    <Label className="text-sm font-semibold text-pink-700 dark:text-pink-300">Data/Hora</Label>
                  </div>
                  <p className="text-lg font-semibold text-pink-900 dark:text-pink-100">
                    {formatDateTime(savedSuggestion.created_at)}
                  </p>
                </div>
              </div>

              {savedSuggestion.observations && (
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-6">
                  <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 block">Observações</Label>
                  <p className="text-slate-600 dark:text-slate-400">{savedSuggestion.observations}</p>
                </div>
              )}

              <div className="flex gap-4 pt-4">
                <Button
                  onClick={() => {
                    setSavedSuggestion(null);
                    setFormData(initialFormData);
                    setCalculatedPrice(0);
                    setMargin(0);
                  }}
                  className="flex-1"
                >
                  Nova Solicitação
                </Button>
                <Button
                  onClick={() => navigate("/approvals")}
                  variant="outline"
                  className="flex-1"
                >
                  Ver Aprovações
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Header com gradiente moderno */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 p-8 text-white shadow-2xl">
          <div className="absolute inset-0 bg-black/10"></div>
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-6">
          <Button 
                variant="secondary" 
            onClick={() => navigate("/dashboard")}
                className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white border-white/30 backdrop-blur-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao Dashboard
          </Button>
              <div>
                <h1 className="text-3xl font-bold mb-2">Solicitação de Preço</h1>
                <p className="text-slate-200">Solicite novos preços para análise e aprovação</p>
              </div>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="new" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Nova Solicitação
            </TabsTrigger>
            <TabsTrigger value="my-requests" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Minhas Solicitações
            </TabsTrigger>
          </TabsList>

          <TabsContent value="new">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Form */}
        <div className="lg:col-span-2">
            <Card className="shadow-xl border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
              <CardHeader className="text-center pb-6">
                <CardTitle className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-2">
                  Nova Solicitação de Preço
                </CardTitle>
                <p className="text-slate-600 dark:text-slate-400">Preencha os dados para solicitar um novo preço</p>
            </CardHeader>
            <CardContent className="space-y-8">
              {/* Seção: Dados Básicos */}
              <div className="space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b border-slate-200 dark:border-slate-700">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg">
                    <span className="text-white font-bold text-sm">1</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200">
                      Dados Básicos da Solicitação
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Informe posto, cliente e produto</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Posto */}
                  <SisEmpresaCombobox
                    label="Posto"
                    value={formData.station_id}
                    onSelect={async (stationId, stationName) => {
                      console.log('🎯 SisEmpresaCombobox onSelect:', { stationId, stationName });
                      await handleInputChange("station_id", stationId);
                    }}
                    required={true}
                  />

                {/* Cliente */}
                  <ClientCombobox
                    label="Cliente"
                    value={formData.client_id}
                    onSelect={(clientId, clientName) => handleInputChange("client_id", clientId)}
                    required={true}
                  />

                {/* Produto */}
                  <div className="space-y-2">
                    <Label htmlFor="product" className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <svg className="h-4 w-4 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                      Produto <span className="text-red-500">*</span>
                    </Label>
                    <Select value={formData.product} onValueChange={(value) => handleInputChange("product", value)}>
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="Selecione o produto" />
                      </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gasolina_comum">Gasolina Comum</SelectItem>
                      <SelectItem value="gasolina_aditivada">Gasolina Aditivada</SelectItem>
                      <SelectItem value="etanol">Etanol</SelectItem>
                      <SelectItem value="diesel_comum">Diesel Comum</SelectItem>
                        <SelectItem value="s10">Diesel S-10</SelectItem>
                        <SelectItem value="arla32_granel">ARLA 32 Granel</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                  {/* Preço Atual */}
                  <div className="space-y-2">
                    <Label htmlFor="current_price" className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <svg className="h-6 w-6 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                      </svg>
                      Preço Atual <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="current_price"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={formData.current_price}
                      onChange={(e) => handleInputChange("current_price", e.target.value)}
                      onWheel={(e) => e.currentTarget.blur()}
                      className="h-11"
                    />
                  </div>

                  {/* Preço Sugerido */}
                  <div className="space-y-2">
                    <Label htmlFor="suggested_price" className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <svg className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                      </svg>
                      Preço Sugerido <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="suggested_price"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={formData.suggested_price}
                      onChange={(e) => handleInputChange("suggested_price", e.target.value)}
                      onWheel={(e) => e.currentTarget.blur()}
                      className="h-11"
                    />
                  </div>

                  {/* Tipo de Pagamento */}
                  <div className="space-y-2">
                    <Label htmlFor="payment_method" className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <svg className="h-4 w-4 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                      Tipo de Pagamento
                    </Label>
                    <Select value={formData.payment_method_id} onValueChange={(value) => handleInputChange("payment_method_id", value)}>
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="Selecione o tipo de pagamento" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {(stationPaymentMethods.filter(m => m.TAXA != null).length > 0 ? 
                          stationPaymentMethods.filter(m => m.TAXA != null) : 
                          paymentMethods?.filter(m => m.TAXA != null) || []
                        ).map((method, index) => {
                          // Use ID_POSTO as the value, or id if available
                          const methodId = (method as any).id || (method as any).ID_POSTO || method.CARTAO;
                          return (
                            <SelectItem key={`payment-${index}`} value={String(methodId)}>
                              {method.CARTAO} {method.TAXA ? `(${method.TAXA}%)` : ''}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* ARLA - Preço de VENDA (aparece ao selecionar ARLA 32 Granel) */}
                  {formData.product === 'arla32_granel' && (
                    <div className="space-y-3 md:col-span-2">
                      <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                        <Label htmlFor="suggested_price_arla" className="text-sm font-semibold text-green-700 dark:text-green-300 mb-2 block">
                          💰 Preço de VENDA do ARLA (R$/L)
                        </Label>
                        <Input
                          id="suggested_price_arla"
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={formData.suggested_price}
                          onChange={(e) => handleInputChange("suggested_price", e.target.value)}
                          onWheel={(e) => e.currentTarget.blur()}
                          className="h-11 bg-white dark:bg-slate-800 text-lg font-semibold"
                        />
                        <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                          💡 Este é o preço pelo qual você venderá o ARLA ao cliente
                        </p>
                      </div>
                    </div>
                  )}

                  {/* ARLA - Preço de VENDA (aparece ao selecionar Diesel S-10) */}
                  {formData.product === 's10' && (
                    <div className="space-y-3 md:col-span-2">
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                        <Label htmlFor="arla_purchase_price" className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-2 block">
                          💧 Preço de VENDA do ARLA (R$/L)
                        </Label>
                        <Input
                          id="arla_purchase_price"
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={formData.arla_purchase_price}
                          onChange={(e) => handleInputChange("arla_purchase_price", e.target.value)}
                          onWheel={(e) => e.currentTarget.blur()}
                          className="h-11 bg-white dark:bg-slate-800"
                        />
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                          ℹ️ Campo obrigatório para diesel S-10 - este é o preço que você paga pelo ARLA
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Volume Feito */}
                  <div className="space-y-2">
                    <Label htmlFor="volume_made" className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <svg className="h-4 w-4 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                      Volume Feito (m³)
                    </Label>
                    <Input
                      id="volume_made"
                      type="number"
                      step="1"
                      placeholder="0"
                      value={formData.volume_made}
                      onChange={(e) => handleInputChange("volume_made", e.target.value)}
                      onWheel={(e) => e.currentTarget.blur()}
                      className="h-11"
                    />
                  </div>

                  {/* Volume Projetado */}
                  <div className="space-y-2">
                    <Label htmlFor="volume_projected" className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <svg className="h-4 w-4 text-teal-600 dark:text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      Volume Projetado (m³)
                    </Label>
                    <Input
                      id="volume_projected"
                      type="number"
                      step="1"
                      placeholder="0"
                      value={formData.volume_projected}
                      onChange={(e) => handleInputChange("volume_projected", e.target.value)}
                      onWheel={(e) => e.currentTarget.blur()}
                      className="h-11"
                    />
                  </div>
                </div>
              </div>

              {/* Seção: Informações Adicionais */}
              <div className="space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b border-slate-200 dark:border-slate-700">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg">
                    <span className="text-white font-bold text-sm">2</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200">
                      Informações Adicionais
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Adicione observações, anexos e informações complementares</p>
                  </div>
                </div>
                
                {/* Documento Anexável */}
                <div className="space-y-2 mb-6">
                  <Label htmlFor="reference_document" className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <svg className="h-4 w-4 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                    Documento de Referência (Opcional)
                  </Label>
                  <div className="p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
                    <FileUploader 
                      onFilesUploaded={setAttachments}
                      maxFiles={5}
                      acceptedTypes="image/*,.pdf"
                      currentFiles={attachments}
                    />
                  </div>
                </div>

                {/* Observações */}
                <div className="space-y-2">
                  <Label htmlFor="observations" className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <svg className="h-4 w-4 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Observações
                  </Label>
                  <Textarea
                    id="observations"
                    placeholder="Adicione observações sobre a solicitação..."
                    value={formData.observations}
                    onChange={(e) => handleInputChange("observations", e.target.value)}
                    rows={3}
                    className="w-full"
                  />
                </div>
              </div>

            {/* Seção: Custo */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b border-slate-200 dark:border-slate-700">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center shadow-lg">
                  <span className="text-white font-bold text-sm">3</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200">Custo</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Análise completa de custos e compensações</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Custo de Compra */}
                  <div className="space-y-2">
                    <Label htmlFor="purchase_cost" className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <svg className="h-6 w-6 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                      </svg>
                      Custo de Compra (R$/L) 🔒
                    </Label>
                    <Input
                      id="purchase_cost"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={formData.purchase_cost}
                      readOnly
                      onWheel={(e) => e.currentTarget.blur()}
                      className="bg-slate-100 dark:bg-slate-700 cursor-not-allowed"
                    />
                    {priceOrigin && (
                      <p className="text-xs text-muted-foreground mt-1">
                        📍 Base: {priceOrigin.base_nome} ({priceOrigin.base_codigo}) - {priceOrigin.base_uf} | {priceOrigin.forma_entrega}
                      </p>
                    )}
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      ⚠️ Campo calculado automaticamente - não editável
                    </p>
                    {fetchStatus && (
                      <Alert className="mt-2">
                        <AlertTitle>
                          {fetchStatus.type === 'today' && 'Cotação de hoje encontrada'}
                          {fetchStatus.type === 'latest' && 'Usando cotação mais recente'}
                          {fetchStatus.type === 'reference' && 'Usando referência manual'}
                          {fetchStatus.type === 'none' && 'Sem dados de cotação'}
                          {fetchStatus.type === 'error' && 'Erro ao buscar cotação'}
                        </AlertTitle>
                        <AlertDescription>
                          {fetchStatus.type === 'latest' && `Data: ${fetchStatus.date ? new Date(fetchStatus.date).toLocaleDateString('pt-BR') : '-'}`}
                          {fetchStatus.type === 'reference' && `Data: ${fetchStatus.date ? new Date(fetchStatus.date).toLocaleDateString('pt-BR') : '-'}`}
                          {fetchStatus.type === 'today' && `Data: ${new Date().toLocaleDateString('pt-BR')}`}
                          {fetchStatus.type === 'none' && 'Não encontramos cotação nem referência para o posto/produto selecionados.'}
                          {fetchStatus.type === 'error' && (fetchStatus.message || 'Falha inesperada ao consultar a base de cotações.')}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>

                  {/* Frete */}
                  <div className="space-y-2">
                    <Label htmlFor="freight_cost" className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <svg className="h-6 w-6 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                      </svg>
                      Frete (R$/L) 🔒
                    </Label>
                    <Input
                      id="freight_cost"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={formData.freight_cost}
                      readOnly
                      onWheel={(e) => e.currentTarget.blur()}
                      className="bg-slate-100 dark:bg-slate-700 cursor-not-allowed"
                    />
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      ⚠️ Campo calculado automaticamente - não editável
                    </p>
                  </div>

                  {/* Custo de Compra do ARLA (somente para S10) */}
                  {formData.product === 's10' && (
                    <div className="space-y-3 md:col-span-2">
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                        <Label htmlFor="arla_cost_price" className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-2 block">
                          💧 Custo de Compra do ARLA (R$/L) 🔒
                        </Label>
                        <Input
                          id="arla_cost_price"
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={formData.arla_cost_price}
                          readOnly
                          onWheel={(e) => e.currentTarget.blur()}
                          className="bg-slate-100 dark:bg-slate-700 cursor-not-allowed"
                        />
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                          ⚠️ Campo calculado automaticamente - não editável
                        </p>
                      </div>
                    </div>
                  )}


                </div>
                </div>
              
              <div className="flex flex-col sm:flex-row gap-4 pt-6">
                <Button
                  onClick={() => handleSubmit(false)}
                  disabled={loading || dbLoadingHook}
                  className="flex items-center gap-3 h-12 px-8 bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-800 hover:to-slate-900 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
                >
                  <Send className="h-5 w-5" />
                  {loading ? "Enviando..." : "Enviar para Aprovação"}
                </Button>
                <Button 
                  type="button"
                  variant="outline"
                  onClick={() => handleSubmit(true)}
                  disabled={loading || dbLoadingHook}
                  className="flex items-center gap-3 h-12 px-8 border-2 border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
                >
                  <Save className="h-5 w-5" />
                  Salvar Rascunho
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Summary Panel */}
        <div className="space-y-6">
            <Card className="shadow-xl border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
              <CardHeader className="text-center pb-6">
                <div className="flex justify-center mb-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-slate-600 to-slate-700 flex items-center justify-center shadow-lg">
                    <Calculator className="h-6 w-6 text-white" />
                  </div>
                </div>
                <CardTitle className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">
                Aumento
              </CardTitle>
                <p className="text-slate-600 dark:text-slate-400">Visualize os valores calculados</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {calculatedPrice > 0 ? (
                <>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                        <span className="text-sm text-slate-600 dark:text-slate-400">Preço Sugerido:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{formatPrice(calculatedPrice)}</span>
                    </div>
                    
                    {formData.current_price && formData.suggested_price && (
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-600 dark:text-slate-400">Preço Atual:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{formatPrice(parseFloat(formData.current_price))}</span>
                      </div>
                    )}
                    
                    {formData.current_price && formData.suggested_price && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-sm text-slate-600 dark:text-slate-400">Margem Custo:</span>
                          <span className={`font-semibold ${margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {margin} centavos
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-slate-600 dark:text-slate-400">
                            {margin > 0 ? 'Ajuste:' : margin < 0 ? 'Ajuste:' : 'Ajuste:'}
                          </span>
                          <span className={`font-semibold ${margin > 0 ? 'text-green-600' : margin < 0 ? 'text-red-600' : 'text-slate-600'}`}>
                            {Math.abs(margin)} centavos
                          </span>
                        </div>
                      </>
                    )}
                    </div>
                    
                    {margin !== 0 && (
                      <div className="pt-4 border-t border-slate-200 dark:border-slate-600">
                        <div className="flex items-center gap-2">
                          {margin >= 0 ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-red-600" />
                          )}
                          <span className={`text-sm font-medium ${margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {margin >= 0 ? 'Ajuste positivo' : 'Ajuste negativo'}
                      </span>
                    </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Preencha os valores para ver o cálculo da margem
                </p>
              )}
            </CardContent>
          </Card>

          {/* Análise de Custos */}
          {(costCalculations.finalCost > 0 || costCalculations.totalRevenue > 0) && (
            <Card className="shadow-xl border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
              <CardHeader className="text-center pb-6">
                <div className="flex justify-center mb-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-700 flex items-center justify-center shadow-lg">
                    <Calculator className="h-6 w-6 text-white" />
                  </div>
                </div>
                <CardTitle className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">
                  Análise de Custos
                </CardTitle>
                <p className="text-slate-600 dark:text-slate-400">Cálculos detalhados de rentabilidade</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {/* Custo Final por Litro */}
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Custo Final/L:</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{formatPrice4Decimals(costCalculations.finalCost)}</span>
                    </div>
                    {(() => {
                      let feePercentage = 0;
                      if (formData.payment_method_id && formData.payment_method_id !== 'none') {
                        const stationMethod = stationPaymentMethods.find(pm => pm.CARTAO === formData.payment_method_id);
                        if (stationMethod) {
                          feePercentage = stationMethod.TAXA || 0;
                        } else {
                          const defaultMethod = paymentMethods.find(pm => pm.CARTAO === formData.payment_method_id);
                          feePercentage = defaultMethod?.TAXA || 0;
                        }
                      }
                      const purchaseCost = parseFloat(formData.purchase_cost) || 0;
                      const freightCost = parseFloat(formData.freight_cost) || 0;
                      // Os custos JÁ estão em R$/L
                      const baseCostTotal = purchaseCost + freightCost;
                      return feePercentage > 0 ? (
                        <div className="text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-600 pt-1 mt-1">
                          <div className="flex justify-between">
                            <span>Base (compra + frete)/L:</span>
                            <span>{formatPrice4Decimals(baseCostTotal)}</span>
                          </div>
                          <div className="flex justify-between text-orange-600 dark:text-orange-400 font-medium">
                            <span>Taxa ({feePercentage.toFixed(2)}%):</span>
                            <span>+{formatPrice4Decimals(costCalculations.finalCost - baseCostTotal)}</span>
                          </div>
                        </div>
                      ) : null;
                    })()}
                    
                    {/* Sempre mostrar informações de taxa se houver */}
                    {(() => {
                      let feePercentage = 0;
                      if (formData.payment_method_id && formData.payment_method_id !== 'none') {
                        const stationMethod = stationPaymentMethods.find(pm => {
                          const methodId = String((pm as any).id || (pm as any).ID_POSTO || '');
                          return pm.CARTAO === formData.payment_method_id || methodId === String(formData.payment_method_id);
                        });
                        
                        if (stationMethod) {
                          feePercentage = stationMethod.TAXA || 0;
                        } else {
                          const defaultMethod = paymentMethods.find(pm => pm.CARTAO === formData.payment_method_id);
                          feePercentage = defaultMethod?.TAXA || 0;
                        }
                      }
                      
                      if (feePercentage > 0) {
                        const purchaseCost = parseFloat(formData.purchase_cost) || 0;
                        const freightCost = parseFloat(formData.freight_cost) || 0;
                        const baseCost = purchaseCost + freightCost;
                        
                        const taxValue = baseCost * (feePercentage / 100);
                        
                        return (
                          <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-2 pt-2 border-t border-slate-300 dark:border-slate-600">
                            <div className="flex justify-between items-center">
                              <span className="font-medium">Taxa aplicada:</span>
                              <span className="font-bold">{feePercentage.toFixed(2)}%</span>
                            </div>
                            <div className="flex justify-between items-center mt-1">
                              <span className="text-slate-500 dark:text-slate-400">Custo base (sem taxa):</span>
                              <span className="text-slate-600 dark:text-slate-300">{formatPrice4Decimals(baseCost)}</span>
                            </div>
                            <div className="flex justify-between items-center mt-1">
                              <span className="text-emerald-600 dark:text-emerald-400 font-medium">Acréscimo da taxa:</span>
                              <span className="text-emerald-700 dark:text-emerald-300 font-bold">+{formatPrice4Decimals(taxValue)}</span>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>

                  {/* Receita Total */}
                  <div className="flex justify-between items-center p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                    <span className="text-sm font-medium text-blue-600 dark:text-blue-400">Receita Total:</span>
                    <span className="font-bold text-blue-700 dark:text-blue-300">{formatPrice(costCalculations.totalRevenue)}</span>
                  </div>

                  {/* Custo Total */}
                  <div className="flex justify-between items-center p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20">
                    <span className="text-sm font-medium text-orange-600 dark:text-orange-400">Custo Total:</span>
                    <span className="font-bold text-orange-700 dark:text-orange-300">{formatPrice(costCalculations.totalCost)}</span>
                  </div>

                  {/* Lucro Bruto */}
                  <div className={`flex justify-between items-center p-3 rounded-lg ${costCalculations.grossProfit >= 0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                    <span className={`text-sm font-medium ${costCalculations.grossProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      Lucro Bruto:
                    </span>
                    <span className={`font-bold ${costCalculations.grossProfit >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                      {formatPrice(costCalculations.grossProfit)}
                    </span>
                  </div>

                  {/* Lucro por Litro */}
                  <div className="flex justify-between items-center p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20">
                    <span className="text-sm font-medium text-purple-600 dark:text-purple-400">Lucro/Litro:</span>
                    <span className="font-bold text-purple-700 dark:text-purple-300">{formatPrice4Decimals(costCalculations.profitPerLiter)}</span>
                  </div>

                  {/* Compensação ARLA */}
                  {costCalculations.arlaCompensation !== 0 && (
                    <div className="border-t border-slate-200 dark:border-slate-600 pt-3 mt-3">
                      <div className="flex justify-between items-center p-3 rounded-lg bg-teal-50 dark:bg-teal-900/20">
                        <span className="text-sm font-medium text-teal-600 dark:text-teal-400">Compensação ARLA:</span>
                        <span className="font-bold text-teal-700 dark:text-teal-300">{formatPrice(costCalculations.arlaCompensation)}</span>
                      </div>
                    </div>
                  )}

                  {/* Resultado Líquido */}
                  <div className={`flex justify-between items-center p-4 rounded-xl border-2 ${costCalculations.netResult >= 0 ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/30' : 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/30'}`}>
                    <div className="flex items-center gap-2">
                      {costCalculations.netResult >= 0 ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-red-600" />
                      )}
                      <span className={`text-sm font-bold ${costCalculations.netResult >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        Resultado Líquido:
                      </span>
                    </div>
                    <span className={`text-lg font-bold ${costCalculations.netResult >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                      {formatPrice(costCalculations.netResult)}
                    </span>
                  </div>

                  {/* Alerta de Compensação */}
                  {costCalculations.grossProfit < 0 && costCalculations.arlaCompensation > 0 && (
                    <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-200 mb-1">
                            ⚠️ Atenção: Ajuste Negativo
                          </p>
                          <p className="text-xs text-yellow-700 dark:text-yellow-300">
                            {costCalculations.netResult >= 0 
                              ? "A operação está sendo compensada pela margem do ARLA, resultando em lucro líquido positivo."
                              : "Mesmo com a compensação do ARLA, a operação resulta em prejuízo líquido."}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Card: Origem do Preço de Custo */}
          {priceOrigin && (
            <Card className="shadow-xl border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
              <CardHeader className="text-center pb-4">
                <CardTitle className="text-xl font-bold text-slate-800 dark:text-slate-200">
                  Origem do Preço de Custo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-semibold text-slate-600 dark:text-slate-400">Base:</Label>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{priceOrigin.base_nome}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold text-slate-600 dark:text-slate-400">Código:</Label>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{priceOrigin.base_codigo}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold text-slate-600 dark:text-slate-400">UF:</Label>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{priceOrigin.base_uf}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold text-slate-600 dark:text-slate-400">Tipo de Entrega:</Label>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{priceOrigin.forma_entrega}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          </div>
          </TabsContent>

          <TabsContent value="my-requests">
            <div className="space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-0 shadow-xl">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-600 dark:text-slate-400">Total</p>
                        <p className="text-2xl font-bold">{myRequests.length}</p>
                      </div>
                      <FileText className="h-6 w-6 text-blue-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-0 shadow-xl">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-600 dark:text-slate-400">Pendentes</p>
                        <p className="text-2xl font-bold text-yellow-600">{myRequests.filter(r => r.status === 'pending').length}</p>
                      </div>
                      <Clock className="h-6 w-6 text-yellow-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-0 shadow-xl">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-600 dark:text-slate-400">Aprovadas</p>
                        <p className="text-2xl font-bold text-green-600">{myRequests.filter(r => r.status === 'approved').length}</p>
                      </div>
                      <Check className="h-6 w-6 text-green-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-0 shadow-xl">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-600 dark:text-slate-400">Rejeitadas</p>
                        <p className="text-2xl font-bold text-red-600">{myRequests.filter(r => r.status === 'rejected').length}</p>
                      </div>
                      <X className="h-6 w-6 text-red-500" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* My Requests List */}
              <div className="space-y-4">
                {myRequests.map((request) => (
                  <Card key={request.id} className="hover:shadow-lg transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 gap-4">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {request.stations?.name || 'Posto'} - {request.clients?.name || 'Cliente'}
                            </span>
                            {request.status === 'pending' && (
                              <Badge variant="secondary" className="bg-yellow-100 text-yellow-800"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>
                            )}
                            {request.status === 'approved' && (
                              <Badge className="bg-green-100 text-green-800"><Check className="h-3 w-3 mr-1" />Aprovado</Badge>
                            )}
                            {request.status === 'rejected' && (
                              <Badge variant="destructive"><X className="h-3 w-3 mr-1" />Rejeitado</Badge>
                            )}
                          </div>
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            Criado em: {new Date(request.created_at).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedRequest(request);
                            setShowRequestDetails(true);
                          }}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Ver Detalhes
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                
                {myRequests.length === 0 && (
                  <Card>
                    <CardContent className="p-12 text-center">
                      <p className="text-slate-600 dark:text-slate-400">Nenhuma solicitação encontrada</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Image Viewer Modal */}
      <ImageViewerModal
        isOpen={imageViewerOpen}
        onClose={() => setImageViewerOpen(false)}
        imageUrl={selectedImage}
        imageName="Anexo da Referência"
      />

      {/* Approval Details Modal - Read Only */}
      {showRequestDetails && selectedRequest && (
        <ApprovalDetailsModal
          isOpen={showRequestDetails}
          onClose={() => {
            setShowRequestDetails(false);
            setSelectedRequest(null);
          }}
          suggestion={selectedRequest}
          onApprove={() => {}}
          onReject={() => {}}
          loading={false}
          readOnly={true}
        />
      )}
    </div>
  );
}