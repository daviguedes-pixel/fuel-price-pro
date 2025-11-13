import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { SisEmpresaCombobox } from "@/components/SisEmpresaCombobox";
import { ClientCombobox } from "@/components/ClientCombobox";
import { ImageViewerModal } from "@/components/ImageViewerModal";
import { FileUploader } from "@/components/FileUploader";
import { ApprovalDetailsModal } from "@/components/ApprovalDetailsModal";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { parseBrazilianDecimal, formatBrazilianCurrency, formatIntegerToPrice, parsePriceToInteger, generateUUID } from "@/lib/utils";
import { useDatabase } from "@/hooks/useDatabase";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Send, Save, TrendingUp, BarChart, MapPin, CheckCircle, AlertCircle, Eye, DollarSign, Clock, Check, X, FileText, ChevronDown, Plus, Download, Maximize2, Loader2 } from "lucide-react";
import { SaoRoqueLogo } from "@/components/SaoRoqueLogo";
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

// Componente para visualização completa da proposta comercial
function ProposalFullView({ batch, proposalNumber, proposalDate, generalStatus, user }: any) {
  const firstRequest = batch[0];
  const client = firstRequest.clients;
  
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
  
  // Calcular totais
  const totalVolume = batch.reduce((sum: number, r: any) => {
    const volume = r.volume_projected || 0;
    return sum + (volume * 1000); // Converter m³ para litros
  }, 0);
  
  // Buscar informações do vendedor
  const sellerName = user?.email || user?.user_metadata?.name || 'Vendedor';
  
  return (
    <div className="p-6 print:p-2 print:min-h-0">
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 0.5cm;
          }
          body {
            margin: 0;
            padding: 0;
          }
          * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
      {/* Cabeçalho com Logo */}
      <div className="flex items-center justify-between mb-6 print:mb-2 print:flex-row">
        <div className="flex items-center gap-3 print:gap-2">
          <SaoRoqueLogo className="h-12 w-auto print:h-6" />
        </div>
        <button
          onClick={() => {
            window.print();
          }}
          className="text-slate-600 hover:text-slate-700 print:hidden p-2 hover:bg-slate-100 rounded"
          title="Imprimir/PDF"
          type="button"
        >
          <Download className="h-5 w-5" />
        </button>
      </div>
      
      {/* Título Principal */}
      <div className="mb-6 print:mb-2">
        <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100 mb-2 uppercase print:text-lg print:mb-0 print:leading-tight">
          PROPOSTA COMERCIAL
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 print:text-[10px] print:mt-0">
          Detalhes da Oferta de Combustível
        </p>
      </div>
      
      {/* Informações Gerais */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 print:mb-2 print:gap-2 print:text-[10px]">
        <div className="space-y-2 print:space-y-1">
          <div>
            <Label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide print:text-[9px] print:font-normal">Data da Proposta:</Label>
            <p className="text-base font-semibold text-slate-900 dark:text-slate-100 mt-1 print:text-[10px] print:mt-0 print:font-normal">{proposalDate}</p>
          </div>
          <div>
            <Label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide print:text-[9px] print:font-normal">Cliente:</Label>
            <p className="text-base font-semibold text-slate-900 dark:text-slate-100 mt-1 print:text-[10px] print:mt-0 print:font-normal">{client?.name || 'N/A'}</p>
          </div>
          <div>
            <Label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide print:text-[9px] print:font-normal">CNPJ:</Label>
            <p className="text-base font-semibold text-slate-900 dark:text-slate-100 mt-1 print:text-[10px] print:mt-0 print:font-normal">{client?.code || 'N/A'}</p>
          </div>
          <div>
            <Label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide print:text-[9px] print:font-normal">Vendedor:</Label>
            <p className="text-base font-semibold text-slate-900 dark:text-slate-100 mt-1 print:text-[10px] print:mt-0 print:font-normal">{sellerName}</p>
          </div>
        </div>
        <div className="space-y-2 print:space-y-1">
          <div>
            <Label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide print:text-[9px] print:font-normal">Número da Proposta:</Label>
            <p className="text-base font-semibold text-slate-900 dark:text-slate-100 mt-1 print:text-[10px] print:mt-0 print:font-normal">#{proposalNumber}</p>
          </div>
          <div>
            <Label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide print:text-[9px] print:font-normal">Status Geral:</Label>
            <div className="mt-1 print:mt-0">
              {generalStatus === 'approved' ? (
                <Badge className="bg-green-100 text-green-800 border-green-300 text-xs font-semibold px-3 py-1 print:text-[9px] print:px-1 print:py-0 print:font-normal">
                  Aprovado
                </Badge>
              ) : generalStatus === 'pending' ? (
                <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300 text-xs font-semibold px-3 py-1 print:text-[9px] print:px-1 print:py-0 print:font-normal">
                  Aguardando Aprovação
                </Badge>
              ) : generalStatus === 'price_suggested' ? (
                <Badge className="bg-blue-100 text-blue-800 border-blue-300 text-xs font-semibold px-3 py-1 print:text-[9px] print:px-1 print:py-0 print:font-normal flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  Preço Sugerido
                </Badge>
              ) : (
                <Badge className="bg-red-100 text-red-800 border-red-300 text-xs font-semibold px-3 py-1 print:text-[9px] print:px-1 print:py-0 print:font-normal">
                  Rejeitado
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Postos e Condições */}
      <div className="mb-6 print:mb-2">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-3 pb-1 border-b-2 border-slate-300 dark:border-slate-600 print:text-xs print:mb-1 print:pb-0.5 print:border-b print:font-semibold">
          Postos e Condições
        </h2>
        <div className="overflow-x-auto print:overflow-visible">
          <table className="w-full border-collapse print:text-[9px] print:table-fixed" style={{ tableLayout: 'fixed' }}>
            <thead>
              <tr className="bg-gradient-to-r from-blue-600 to-blue-700 text-white print:bg-blue-600">
                <th className="text-left p-3 text-sm font-bold uppercase tracking-wide print:p-1 print:text-[9px] print:font-semibold" style={{ width: '18%' }}>POSTO</th>
                <th className="text-left p-3 text-sm font-bold uppercase tracking-wide print:p-1 print:text-[9px] print:font-semibold" style={{ width: '25%' }}>CLIENTE</th>
                <th className="text-left p-3 text-sm font-bold uppercase tracking-wide print:p-1 print:text-[9px] print:font-semibold" style={{ width: '12%' }}>PREÇO (R$/L)</th>
                <th className="text-left p-3 text-sm font-bold uppercase tracking-wide print:p-1 print:text-[9px] print:font-semibold" style={{ width: '10%' }}>VOLUME (M³)</th>
                <th className="text-left p-3 text-sm font-bold uppercase tracking-wide print:p-1 print:text-[9px] print:font-semibold" style={{ width: '12%' }}>STATUS</th>
                <th className="text-center p-3 text-sm font-bold uppercase tracking-wide print:p-1 print:text-[9px] print:font-semibold" style={{ width: '8%' }}>RESULTADO</th>
              </tr>
            </thead>
            <tbody>
              {batch.map((req: any, idx: number) => {
                const station = req.stations || req.stations_list?.[0];
                const client = req.clients;
                const price = req.final_price || req.suggested_price || 0;
                const priceReais = price >= 100 ? price / 100 : price;
                const volume = req.volume_projected || 0;
                const reqStatus = req.status || 'pending';
                
                return (
                  <tr 
                    key={req.id} 
                    className={`border-b border-slate-200 dark:border-slate-700 print:border-gray-300 print:border-t-0 ${idx % 2 === 0 ? 'bg-white dark:bg-slate-800 print:bg-white' : 'bg-slate-50 dark:bg-slate-900/50 print:bg-gray-50'}`}
                  >
                    <td className="p-3 text-sm font-semibold text-slate-900 dark:text-slate-100 print:p-1 print:text-[9px] print:font-normal print:break-words">
                      {station?.name || req.station_id || 'N/A'}
                    </td>
                    <td className="p-3 text-sm text-slate-700 dark:text-slate-300 print:p-1 print:text-[9px] print:break-words">
                      {client?.name || 'N/A'}
                    </td>
                    <td className="p-3 text-sm font-semibold text-slate-900 dark:text-slate-100 print:p-1 print:text-[9px] print:font-normal">
                      {formatPrice4Decimals(priceReais)}
                    </td>
                    <td className="p-3 text-sm text-slate-700 dark:text-slate-300 print:p-1 print:text-[9px]">
                      {volume.toLocaleString('pt-BR')}
                    </td>
                    <td className="p-3 print:p-1">
                      {reqStatus === 'approved' ? (
                        <Badge className="bg-green-100 text-green-800 border-green-300 text-xs font-semibold print:text-[8px] print:px-0.5 print:py-0 print:font-normal print:inline-block">
                          Aprovado
                        </Badge>
                      ) : reqStatus === 'pending' ? (
                        <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300 text-xs font-semibold print:text-[8px] print:px-0.5 print:py-0 print:font-normal print:inline-block">
                          Pendente
                        </Badge>
                      ) : reqStatus === 'price_suggested' ? (
                        <Badge className="bg-blue-100 text-blue-800 border-blue-300 text-xs font-semibold print:text-[8px] print:px-0.5 print:py-0 print:font-normal print:inline-block flex items-center gap-1">
                          <DollarSign className="h-3 w-3 print:h-2 print:w-2" />
                          Preço Sugerido
                        </Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-800 border-red-300 text-xs font-semibold print:text-[8px] print:px-0.5 print:py-0 print:font-normal print:inline-block">
                          Rejeitado
                        </Badge>
                      )}
                    </td>
                    <td className="p-3 text-center print:p-1">
                      {reqStatus === 'approved' ? (
                        <CheckCircle className="h-5 w-5 text-green-600 mx-auto print:h-3 print:w-3" />
                      ) : reqStatus === 'price_suggested' ? (
                        <DollarSign className="h-5 w-5 text-blue-600 mx-auto print:h-3 print:w-3" />
                      ) : (
                        <Clock className="h-5 w-5 text-yellow-600 mx-auto print:h-3 print:w-3" />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Volume Total - Destaque */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-6 mb-4 text-white shadow-lg print:rounded print:p-2 print:mb-2 print:bg-blue-600 print:break-inside-avoid">
        <div>
          <p className="text-sm font-medium opacity-90 mb-0 print:text-[10px] print:font-normal">Volume total projetado: {totalVolume.toLocaleString('pt-BR')} L</p>
        </div>
      </div>
      
      {/* Notas Importantes */}
      <div className="mb-4 print:mb-2 print:break-inside-avoid">
        <div className="space-y-1 text-sm text-slate-700 dark:text-slate-300 print:text-[9px] print:space-y-0.5">
          <p className="flex items-start gap-2 print:gap-1 print:leading-tight">
            <span className="font-bold print:font-normal">•</span>
            <span className="print:leading-tight">Preço sujeito a alteração, conforme anúncio da companhia.</span>
          </p>
          <p className="flex items-start gap-2 print:gap-1 print:leading-tight">
            <span className="font-bold print:font-normal">•</span>
            <span className="print:leading-tight">Posto não negociado, sujeito a cobrança com base no preço da bomba.</span>
          </p>
          <p className="flex items-start gap-2 text-red-700 dark:text-red-300 font-semibold print:gap-1 print:font-normal print:leading-tight">
            <span className="font-bold print:font-normal">•</span>
            <span className="print:leading-tight">Alterações podem ocorrer dentro de um prazo de até 24 horas.</span>
          </p>
        </div>
      </div>
      
      {/* Footer Profissional */}
      <div className="pt-4 print:pt-2 print:break-inside-avoid">
        <div className="text-center space-y-2 print:space-y-0.5">
          <p className="text-sm text-slate-600 dark:text-slate-400 print:text-[9px] print:leading-tight">
            Agradecemos sua atenção e ficamos à disposição para quaisquer esclarecimentos.
          </p>
          <p className="text-lg font-bold text-blue-600 dark:text-blue-400 print:text-xs print:font-semibold print:text-black">
            REDE SÃO ROQUE
          </p>
        </div>
      </div>
    </div>
  );
}

export default function PriceRequest() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { permissions } = usePermissions();
  const { stations, clients, paymentMethods, loading: dbLoadingHook, getPaymentMethodsForStation } = useDatabase();
  
  const [loading, setLoading] = useState(false);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [references, setReferences] = useState<Reference[]>([]);
  const [savedSuggestion, setSavedSuggestion] = useState<any>(null);
  const [saveAsDraft, setSaveAsDraft] = useState(false);
  const [stationPaymentMethods, setStationPaymentMethods] = useState<any[]>([]);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState("my-requests");
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [showRequestDetails, setShowRequestDetails] = useState(false);
  const [expandedProposal, setExpandedProposal] = useState<string | null>(null);
  const [batchName, setBatchName] = useState<string>('');
  
  // Cards adicionados (Resultados Individuais por Posto)
  const [addedCards, setAddedCards] = useState<Array<{
    id: string;
    stationName: string;
    stationCode: string;
    location: string;
    netResult: number;
    suggestionId: string;
    expanded: boolean;
    costAnalysis?: any;
    attachments?: string[];
  }>>([]);
  
  // Custos e cálculos por posto (quando múltiplos postos são selecionados)
  const [stationCosts, setStationCosts] = useState<Record<string, {
    purchase_cost: number;
    freight_cost: number;
    final_cost?: number;
    margin_cents?: number;
    station_name: string;
    total_revenue?: number;
    total_cost?: number;
    gross_profit?: number;
    profit_per_liter?: number;
    arla_compensation?: number;
    net_result?: number;
  }>>({});

  const initialFormData = {
    station_id: "", // Mantido para compatibilidade
    station_ids: [] as string[], // Array de IDs de postos
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
    base_bandeira: string;
    forma_entrega: string;
    base_codigo?: string;
  } | null>(null);

  const [fetchStatus, setFetchStatus] = useState<{
    type: 'today' | 'latest' | 'reference' | 'none' | 'error';
    date?: string | null;
    message?: string;
  } | null>(null);

  // Load my requests
  useEffect(() => {
    if (activeTab === 'my-requests' && user) {
      loadMyRequests(true); // Usar cache por padrão
    }
  }, [activeTab, user]);
  
  // Tempo real para atualizar quando houver mudanças
  useEffect(() => {
    if (!user) return;
    
    const channel = supabase
      .channel('price_suggestions_realtime')
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'price_suggestions',
          filter: `requested_by=eq.${user.id}`
        },
        (payload) => {
          console.log('🔄 Mudança detectada em price_suggestions:', payload.eventType);
          // Invalidar cache e recarregar
          const cacheKey = `price_request_my_requests_cache_${user.id}`;
          localStorage.removeItem(cacheKey);
          if (activeTab === 'my-requests') {
            loadMyRequests(false); // Recarregar sem cache
          }
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, activeTab]);

  const loadMyRequests = async (useCache = true) => {
    if (!user) {
      console.log('⚠️ Usuário não encontrado no loadMyRequests');
      return;
    }

    try {
      // Verificar cache primeiro
      if (useCache) {
        const cacheKey = `price_request_my_requests_cache_${user.id}`;
        const cacheTimestampKey = `price_request_my_requests_cache_timestamp_${user.id}`;
        const cachedData = localStorage.getItem(cacheKey);
        const cacheTimestamp = localStorage.getItem(cacheTimestampKey);
        const cacheExpiry = 5 * 60 * 1000; // 5 minutos
        
        if (cachedData && cacheTimestamp) {
          const now = Date.now();
          const timestamp = parseInt(cacheTimestamp, 10);
          
          if (now - timestamp < cacheExpiry) {
            console.log('📦 Usando dados do cache (minhas solicitações)');
            const parsedData = JSON.parse(cachedData);
            setMyRequests(parsedData);
            setLoadingRequests(false);
            return;
          }
        }
      }
      
      setLoadingRequests(true);
      console.log('📋 Carregando minhas solicitações no PriceRequest...');
      const userId = String(user.id);
      const userEmail = user.email ? String(user.email) : null;
      
      // Buscar todas e filtrar no cliente (mais confiável)
      const { data: allData, error: allError } = await supabase
        .from('price_suggestions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000);
      
      if (allError) {
        console.error('❌ Erro ao buscar solicitações:', allError);
        throw allError;
      }
      
      // Filtrar no cliente
      const data = (allData || []).filter((suggestion: any) => {
        const reqBy = String(suggestion.requested_by || '');
        const creBy = String(suggestion.created_by || '');
        return reqBy === userId || creBy === userId || 
               (userEmail && (reqBy === userEmail || creBy === userEmail));
      }).slice(0, 50); // Limitar a 50 após filtrar

      // Carregar postos e clientes para enriquecer dados
      const [stationsRes, clientsRes] = await Promise.all([
        supabase.rpc('get_sis_empresa_stations').then(res => ({ data: res.data, error: res.error })),
        supabase.from('clientes' as any).select('id_cliente, nome')
      ]);
      
      // Buscar informações completas dos postos (incluindo cidade/UF)
      const stationsWithLocation: any[] = [];
      for (const s of (stationsRes.data || [])) {
        if (s.cnpj_cpf || s.id_empresa) {
          try {
            // Construir filtro corretamente, evitando null
            let query = supabase
              .from('sis_empresa' as any)
              .select('municipio, uf');
            
            // Construir filtro OR apenas com valores válidos
            const conditions: string[] = [];
            if (s.cnpj_cpf) {
              conditions.push(`cnpj_cpf.eq.${s.cnpj_cpf}`);
            }
            if (s.id_empresa) {
              conditions.push(`id_empresa.eq.${s.id_empresa}`);
            }
            
            if (conditions.length > 0) {
              query = query.or(conditions.join(','));
            }
            
            const { data: fullStation } = await query.maybeSingle();
            stationsWithLocation.push({ 
              ...s, 
              municipio: (fullStation as any)?.municipio, 
              uf: (fullStation as any)?.uf 
            });
          } catch (e) {
            console.warn('Erro ao buscar município/UF:', e);
            stationsWithLocation.push(s);
          }
        } else {
          stationsWithLocation.push(s);
        }
      }

      // Enriquecer dados
      const enrichedData = (data || []).map((request: any) => {
        // Buscar múltiplos postos se station_ids existir, senão usar station_id
        let stations = [];
        const stationIds = request.station_ids && Array.isArray(request.station_ids) 
          ? request.station_ids 
          : (request.station_id ? [request.station_id] : []);
        
        stationIds.forEach((stationId: string) => {
          if (stationId) {
            const station = stationsWithLocation.find((s: any) => {
              const sId = String(s.id || s.id_empresa || s.cnpj_cpf || '');
              const reqId = String(stationId);
              return sId === reqId || s.cnpj_cpf === reqId || s.id_empresa === reqId;
            });
            if (station) {
              stations.push({ 
                name: station.nome_empresa || station.name, 
                code: station.cnpj_cpf || station.id || station.id_empresa,
                municipio: station.municipio,
                uf: station.uf
              });
            }
          }
        });
        
        // Manter compatibilidade: stations como primeiro posto ou null
        const firstStation = stations.length > 0 ? stations[0] : null;
        
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
          stations: firstStation, // Compatibilidade
          stations_list: stations, // Lista completa de postos
          clients: client ? { name: client.nome || client.name, code: String(client.id_cliente || client.id) } : null
        };
      });

      // Agrupar solicitações por batch_id - solicitações com o mesmo batch_id foram criadas juntas
      // Se não tem batch_id, tentar agrupar por data/criador/timestamp próximo (compatibilidade com dados antigos)
      const groupedBatches = new Map<string, any[]>();
      
      enrichedData.forEach((request: any) => {
        // Se tem batch_id, agrupar por batch_id
        if (request.batch_id) {
          const batchKey = request.batch_id;
          if (!groupedBatches.has(batchKey)) {
            groupedBatches.set(batchKey, []);
          }
          groupedBatches.get(batchKey)!.push(request);
        } else {
          // Se não tem batch_id, tentar agrupar por data/criador/timestamp próximo (fallback)
          // Isso garante compatibilidade com solicitações criadas antes da migração
          const dateKey = new Date(request.created_at).toISOString().split('T')[0];
          const creatorKey = request.created_by || request.requested_by || 'unknown';
          const timestamp = new Date(request.created_at).getTime();
          
          // Procurar se há um lote existente sem batch_id com timestamp muito próximo (dentro de 10 segundos)
          let foundBatch = false;
          for (const [existingKey, existingBatch] of groupedBatches.entries()) {
            // Se a chave não começa com "individual_" e não é um UUID válido, é um lote sem batch_id
            if (!existingKey.startsWith('individual_') && existingKey.includes('_')) {
              const parts = existingKey.split('_');
              if (parts.length >= 3) {
                const existingDate = parts[0];
                const existingCreator = parts[1];
                const existingTimestampStr = parts.slice(2).join('_');
                const existingTimestamp = parseInt(existingTimestampStr, 10);
                
                // Se for mesmo dia, mesmo criador e timestamp muito próximo (dentro de 10 segundos)
                if (existingDate === dateKey && 
                    existingCreator === creatorKey && 
                    !isNaN(existingTimestamp) &&
                    Math.abs(timestamp - existingTimestamp) < 10000) { // 10 segundos
                  existingBatch.push(request);
                  foundBatch = true;
                  break;
                }
              }
            }
          }
          
          if (!foundBatch) {
            // Criar novo grupo sem batch_id (usando data_criador_timestamp como chave)
            const batchKey = `${dateKey}_${creatorKey}_${timestamp}`;
            groupedBatches.set(batchKey, [request]);
          }
        }
      });
      
      // Agrupar lotes para visualização de proposta comercial
      const batches: any[] = [];
      const individualRequests: any[] = [];
      
      // Função auxiliar para verificar se é UUID válido
      const isUUID = (str: string): boolean => {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        return uuidRegex.test(str);
      };
      
      groupedBatches.forEach((batch, batchKey) => {
        // REGRA CLARA:
        // - Se tem batch_id (UUID válido) → SEMPRE é lote (mesmo com 1 solicitação)
        // - Se não tem batch_id mas foi agrupado por timestamp → é lote se tiver mais de 1
        // - Se começa com "individual_" → é individual
        const isBatch = isUUID(batchKey) || (!batchKey.startsWith('individual_') && batch.length > 1);
        
        if (isBatch) {
          // É um lote - adicionar como proposta comercial
          // Pegar o primeiro cliente para exibição (ou todos se diferentes)
          const uniqueClients = new Set(batch.map((r: any) => r.client_id || 'unknown'));
          const hasMultipleClients = uniqueClients.size > 1;
          
          batches.push({
            type: 'batch',
            batchKey,
            requests: batch,
            created_at: batch[0].created_at,
            client: batch[0].clients, // Primeiro cliente para exibição
            clients: hasMultipleClients ? Array.from(uniqueClients).map((cid: string) => {
              const req = batch.find((r: any) => r.client_id === cid);
              return req?.clients || { name: 'N/A' };
            }) : [batch[0].clients],
            hasMultipleClients,
            created_by: batch[0].created_by || batch[0].requested_by,
            batch_name: batch[0].batch_name || null // Nome do lote (se houver)
          });
        } else {
          // Solicitação individual - adicionar às individuais
          batch.forEach((r: any) => individualRequests.push(r));
        }
      });
      
      // Combinar lotes e solicitações individuais, ordenar por data
      const allRequests = [...batches, ...individualRequests].sort((a, b) => {
        const dateA = new Date(a.created_at || a.requests?.[0]?.created_at || 0).getTime();
        const dateB = new Date(b.created_at || b.requests?.[0]?.created_at || 0).getTime();
        return dateB - dateA;
      });
      
      setMyRequests(allRequests);
      console.log('✅ Solicitações carregadas:', allRequests.length, 'Lotes:', batches.length);
      
      // Salvar no cache
      const cacheKey = `price_request_my_requests_cache_${user.id}`;
      const cacheTimestampKey = `price_request_my_requests_cache_timestamp_${user.id}`;
      try {
        localStorage.setItem(cacheKey, JSON.stringify(allRequests));
        localStorage.setItem(cacheTimestampKey, Date.now().toString());
        console.log('💾 Dados salvos no cache (minhas solicitações)');
      } catch (cacheError) {
        console.warn('Erro ao salvar cache:', cacheError);
      }
    } catch (error: any) {
      console.error('❌ Erro ao carregar minhas solicitações:', error);
      toast.error("Erro ao carregar solicitações: " + (error?.message || 'Erro desconhecido'));
      setMyRequests([]);
    } finally {
      setLoadingRequests(false);
    }
  };

  // Load references when component mounts (com cache e tempo real)
  useEffect(() => {
    loadReferences(true); // Usar cache por padrão
    
    // Tempo real para atualizar quando houver mudanças
    const channel = supabase
      .channel('referencias-realtime')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'referencias' 
      }, () => {
        console.log('🔄 Mudança detectada em referências');
        localStorage.removeItem('price_request_references_cache');
        loadReferences(false); // Recarregar sem cache
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'price_suggestions',
        filter: 'status=eq.approved'
      }, () => {
        console.log('🔄 Preço aprovado detectado');
        localStorage.removeItem('price_request_references_cache');
        loadReferences(false);
      })
      .subscribe();
    
    return () => { 
      supabase.removeChannel(channel); 
    };
  }, []);

  // Auto-fill lowest cost + freight when station and product are selected
  const [lastSearchedStation, setLastSearchedStation] = useState<string>('');
  const [lastSearchedProduct, setLastSearchedProduct] = useState<string>('');
  
  // Buscar custos para todos os postos selecionados
  useEffect(() => {
    // Função para buscar custos de um posto específico
    const fetchCostForStation = async (stationId: string, stationName: string): Promise<{
      purchase_cost: number;
      freight_cost: number;
      station_name: string;
    } | null> => {
      if (!formData.product) return null;
      
      try {
        const today = new Date().toISOString().split('T')[0];
        const selectedStation = stations.find(s => s.id === stationId);
        if (!selectedStation) return null;
        
        const rawId = selectedStation.code || selectedStation.id;
        const cleanedId = rawId.replace(/-\d+\.\d+$/, '');
        
        const productMap: Record<string, string> = {
          gasolina_comum: 'Gasolina Comum',
          gasolina_aditivada: 'Aditivada',
          etanol: 'Etanol',
          diesel_comum: 'S500',
          s10: 'S10',
          arla32_granel: 'ARLA'
        };
        const produtoBusca = productMap[formData.product] || formData.product;
        
        const candidates: string[] = [];
        if (selectedStation.code) candidates.push(selectedStation.code);
        if (cleanedId && !candidates.includes(cleanedId)) candidates.push(cleanedId);
        if (selectedStation.name && !candidates.includes(selectedStation.name)) candidates.push(selectedStation.name);
        
        // Tentar RPC
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
        
        // Fallback similar ao código existente (simplificado)
        if (!resultData) {
          try {
            const cot: any = (supabase as any).schema ? (supabase as any).schema('cotacao') : null;
            if (cot) {
              const { data: gci } = await cot
                .from('grupo_codigo_item')
                .select('id_grupo_codigo_item,nome,descricao')
                .ilike('nome', `%${produtoBusca}%`)
                .limit(20);
              const ids = (gci as any[])?.map((r: any) => r.id_grupo_codigo_item) || [];
              
              if (ids.length > 0) {
                const { data: maxRows } = await cot
                  .from('cotacao_geral_combustivel')
                  .select('data_cotacao')
                  .in('id_grupo_codigo_item', ids)
                  .order('data_cotacao', { ascending: false })
                  .limit(1);
                const lastDateStr = maxRows?.[0]?.data_cotacao as string | undefined;
                
                if (lastDateStr) {
                  const start = new Date(lastDateStr);
                  const end = new Date(start);
                  end.setDate(end.getDate() + 1);
                  
                  const { data: emp } = await cot
                    .from('sis_empresa')
                    .select('id_empresa')
                    .ilike('nome_empresa', `%${selectedStation.name}%`)
                    .limit(1);
                  const idEmpresa = (emp as any[])?.[0]?.id_empresa as number | undefined;
                  
                  if (idEmpresa) {
                    const { data: cg } = await cot
                      .from('cotacao_geral_combustivel')
                      .select('id_base_fornecedor,valor_unitario,desconto_valor,forma_entrega')
                      .in('id_grupo_codigo_item', ids)
                      .gte('data_cotacao', start.toISOString())
                      .lt('data_cotacao', end.toISOString());
                    
                    const baseIds = Array.from(new Set((cg as any[])?.map((r: any) => r.id_base_fornecedor) || []));
                    
                    let freteMap = new Map<number, number>();
                    if (baseIds.length > 0) {
                      const { data: fretes } = await cot
                        .from('frete_empresa')
                        .select('id_base_fornecedor,frete_real,frete_atual')
                        .eq('id_empresa', idEmpresa)
                        .in('id_base_fornecedor', baseIds)
                        .eq('registro_ativo', true);
                      (fretes as any[])?.forEach((f: any) => {
                        freteMap.set(f.id_base_fornecedor, Number(f.frete_real ?? f.frete_atual ?? 0));
                      });
                    }
                    
                    let best: any = null;
                    (cg as any[])?.forEach((row: any) => {
                      const custo = Number(row.valor_unitario) - Number(row.desconto_valor || 0);
                      const frete = row.forma_entrega === 'FOB' ? (freteMap.get(row.id_base_fornecedor) || 0) : 0;
                      const total = custo + frete;
                      if (!best || total < best.custo_total) {
                        best = { custo, frete, custo_total: total };
                      }
                    });
                    
                    if (best) {
                      resultData = [best];
                    }
                  }
                }
              }
            }
          } catch (e) {
            console.error('Erro no fallback:', e);
          }
        }
        
        if (resultData && resultData.length > 0) {
          const result = resultData[0];
          return {
            purchase_cost: Number(result.custo || 0),
            freight_cost: Number(result.frete || 0),
            station_name: stationName
          };
        }
        
        return null;
      } catch (error) {
        console.error(`Erro ao buscar custo para posto ${stationId}:`, error);
        return null;
      }
    };
    
    // Buscar custos apenas se houver station_id selecionado
    const fetchCostForSelectedStation = async () => {
      if (!formData.station_id || formData.station_id === 'none' || !formData.product) {
        setStationCosts({});
        return;
      }
      
      const station = stations.find(s => s.id === formData.station_id);
      if (!station) return;
      
      // Verificar se mudou posto ou produto OU se os custos estão vazios (formulário resetado)
      const stationOrProductChanged = formData.station_id !== lastSearchedStation || formData.product !== lastSearchedProduct;
      const costsAreEmpty = !formData.purchase_cost && !formData.freight_cost;
      
      // Se não mudou e os custos já estão preenchidos, não recarregar
      if (!stationOrProductChanged && !costsAreEmpty) {
        return;
      }
      
      // Atualizar referências apenas se mudou posto ou produto
      if (stationOrProductChanged) {
        setLastSearchedStation(formData.station_id);
        setLastSearchedProduct(formData.product);
      }
      
      const costs = await fetchCostForStation(formData.station_id, station.name);
      if (costs) {
        setStationCosts({ [formData.station_id]: costs });
        
        // Atualizar formData com os custos encontrados
        setFormData(prev => ({
          ...prev,
          purchase_cost: costs.purchase_cost.toFixed(4),
          freight_cost: costs.freight_cost.toFixed(4)
        }));
      }
    };
    
    fetchCostForSelectedStation();
  }, [formData.station_id, formData.product, formData.purchase_cost, formData.freight_cost, stations]);
  
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
            // Buscar bandeira da base_fornecedor se tiver base_id
            if (resultData[0]?.base_id) {
              try {
                const cot: any = (supabase as any).schema ? (supabase as any).schema('cotacao') : null;
                if (cot) {
                  const { data: baseInfo } = await cot
                    .from('base_fornecedor')
                    .select('bandeira,nome')
                    .eq('id_base_fornecedor', resultData[0].base_id)
                    .maybeSingle();
                  
                  if (baseInfo) {
                    // Função auxiliar para extrair bandeira
                    const extractBandeiraFromName = (nome: string, bandeira?: string | null): string => {
                      if (bandeira && bandeira.trim() !== '') {
                        const bandeiraUpper = bandeira.trim().toUpperCase();
                        if (bandeiraUpper.includes('IPIRANGA') || bandeiraUpper.includes('IPP')) return 'IPIRANGA';
                        if (bandeiraUpper.includes('RAIZEN') || bandeiraUpper.includes('RAÍZEN')) return 'RAÍZEN';
                        if (bandeiraUpper.includes('PETROBRAS') || bandeiraUpper.includes('BR ')) return 'PETROBRAS';
                        return bandeiraUpper;
                      }
                      
                      const nomeUpper = nome.toUpperCase();
                      const bandeiras = [
                        { nome: 'VIBRA', patterns: ['VIBRA'] },
                        { nome: 'IPIRANGA', patterns: ['IPIRANGA', 'IPP'] },
                        { nome: 'RAÍZEN', patterns: ['RAIZEN', 'RAÍZEN'] },
                        { nome: 'PETROBRAS', patterns: ['PETROBRAS', 'BR ', ' BR', 'BR-', 'PETRO'] },
                        { nome: 'SHELL', patterns: ['SHELL'] },
                        { nome: 'COOP', patterns: ['COOP'] },
                        { nome: 'UNO', patterns: ['UNO'] },
                        { nome: 'ATEM', patterns: ['ATEM'] },
                        { nome: 'ALE', patterns: ['ALE'] }
                      ];
                      
                      for (const bandeiraItem of bandeiras) {
                        for (const pattern of bandeiraItem.patterns) {
                          if (nomeUpper.includes(pattern)) {
                            return bandeiraItem.nome;
                          }
                        }
                      }
                      return 'N/A';
                    };
                    
                    resultData[0].base_bandeira = extractBandeiraFromName(baseInfo.nome || resultData[0].base_nome || '', baseInfo.bandeira);
                  } else if (resultData[0]?.base_nome) {
                    // Se não encontrou na tabela, tentar extrair do nome
                    const nomeUpper = (resultData[0].base_nome || '').toUpperCase();
                    const bandeiras = [
                      { nome: 'VIBRA', patterns: ['VIBRA'] },
                      { nome: 'IPIRANGA', patterns: ['IPIRANGA', 'IPP'] },
                      { nome: 'RAÍZEN', patterns: ['RAIZEN', 'RAÍZEN'] },
                      { nome: 'PETROBRAS', patterns: ['PETROBRAS', 'BR ', ' BR', 'BR-', 'PETRO'] },
                      { nome: 'SHELL', patterns: ['SHELL'] },
                      { nome: 'COOP', patterns: ['COOP'] },
                      { nome: 'UNO', patterns: ['UNO'] },
                      { nome: 'ATEM', patterns: ['ATEM'] },
                      { nome: 'ALE', patterns: ['ALE'] }
                    ];
                    
                    for (const bandeiraItem of bandeiras) {
                      for (const pattern of bandeiraItem.patterns) {
                        if (nomeUpper.includes(pattern)) {
                          resultData[0].base_bandeira = bandeiraItem.nome;
                          break;
                        }
                      }
                      if (resultData[0].base_bandeira) break;
                    }
                    
                    if (!resultData[0].base_bandeira) {
                      resultData[0].base_bandeira = 'N/A';
                    }
                  }
                }
              } catch (err) {
                console.log('⚠️ Erro ao buscar bandeira:', err);
                // Tentar extrair do nome como fallback
                if (resultData[0]?.base_nome) {
                  const nomeUpper = (resultData[0].base_nome || '').toUpperCase();
                  if (nomeUpper.includes('IPIRANGA') || nomeUpper.includes('IPP')) {
                    resultData[0].base_bandeira = 'IPIRANGA';
                  } else if (nomeUpper.includes('RAIZEN') || nomeUpper.includes('RAÍZEN')) {
                    resultData[0].base_bandeira = 'RAÍZEN';
                  } else if (nomeUpper.includes('PETROBRAS') || nomeUpper.includes('BR ') || nomeUpper.includes('PETRO')) {
                    resultData[0].base_bandeira = 'PETROBRAS';
                  } else if (nomeUpper.includes('VIBRA')) {
                    resultData[0].base_bandeira = 'VIBRA';
                  } else {
                    resultData[0].base_bandeira = 'N/A';
                  }
                }
              }
            }
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

                  // 6) Info de base com bandeira
                  let baseInfo = new Map<number, { nome: string; codigo: string; uf: string; bandeira?: string }>();
                  if (baseIds.length > 0) {
                    const { data: bases } = await cot
                      .from('base_fornecedor')
                      .select('id_base_fornecedor,nome,codigo_base,uf,bandeira')
                      .in('id_base_fornecedor', baseIds);
                    
                    console.log('🏢 Bases encontradas:', bases);
                    
                    (bases as any[])?.forEach((b: any) => {
                      baseInfo.set(b.id_base_fornecedor, { 
                        nome: b.nome, 
                        codigo: b.codigo_base, 
                        uf: String(b.uf || ''),
                        bandeira: b.bandeira || null
                      });
                    });
                  }
                  
                  // Função para extrair bandeira do nome se não vier da tabela
                  const extractBandeira = (nome: string, bandeira?: string | null): string => {
                    // Se vier bandeira da tabela, usar direto (normalizar para maiúsculas)
                    if (bandeira && bandeira.trim() !== '') {
                      const bandeiraUpper = bandeira.trim().toUpperCase();
                      // Normalizar variações comuns
                      if (bandeiraUpper.includes('IPIRANGA') || bandeiraUpper.includes('IPP')) {
                        return 'IPIRANGA';
                      }
                      if (bandeiraUpper.includes('RAIZEN') || bandeiraUpper.includes('RAÍZEN')) {
                        return 'RAÍZEN';
                      }
                      if (bandeiraUpper.includes('PETROBRAS') || bandeiraUpper.includes('BR ')) {
                        return 'PETROBRAS';
                      }
                      return bandeiraUpper;
                    }
                    
                    // Tentar extrair do nome da base
                    const nomeUpper = nome.toUpperCase();
                    const bandeiras = [
                      { nome: 'VIBRA', patterns: ['VIBRA'] },
                      { nome: 'IPIRANGA', patterns: ['IPIRANGA', 'IPP', 'IPIRANGA'] },
                      { nome: 'RAÍZEN', patterns: ['RAIZEN', 'RAÍZEN'] },
                      { nome: 'PETROBRAS', patterns: ['PETROBRAS', 'BR ', ' BR', 'BR-', 'PETRO'] },
                      { nome: 'SHELL', patterns: ['SHELL'] },
                      { nome: 'COOP', patterns: ['COOP'] },
                      { nome: 'UNO', patterns: ['UNO'] },
                      { nome: 'ATEM', patterns: ['ATEM'] },
                      { nome: 'ALE', patterns: ['ALE'] }
                    ];
                    
                    for (const bandeiraItem of bandeiras) {
                      for (const pattern of bandeiraItem.patterns) {
                        if (nomeUpper.includes(pattern)) {
                          return bandeiraItem.nome;
                        }
                      }
                    }
                    
                    return 'N/A';
                  };

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
                        base_bandeira: extractBandeira(info.nome, info.bandeira),
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
              base_bandeira: 'N/A',
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
              base_bandeira: result.base_bandeira || 'N/A',
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


  const loadReferences = async (useCache = true) => {
    try {
      // Verificar cache primeiro
      if (useCache) {
        const cacheKey = 'price_request_references_cache';
        const cacheTimestampKey = 'price_request_references_cache_timestamp';
        const cachedData = localStorage.getItem(cacheKey);
        const cacheTimestamp = localStorage.getItem(cacheTimestampKey);
        const cacheExpiry = 5 * 60 * 1000; // 5 minutos
        
        if (cachedData && cacheTimestamp) {
          const now = Date.now();
          const timestamp = parseInt(cacheTimestamp, 10);
          
          if (now - timestamp < cacheExpiry) {
            console.log('📦 Usando dados do cache (referências)');
            const parsedData = JSON.parse(cachedData);
            setReferences(parsedData);
            return;
          }
        }
      }
      
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
        
        // Salvar no cache
        const cacheKey = 'price_request_references_cache';
        const cacheTimestampKey = 'price_request_references_cache_timestamp';
        try {
          localStorage.setItem(cacheKey, JSON.stringify(convertedReferences));
          localStorage.setItem(cacheTimestampKey, Date.now().toString());
        } catch (cacheError) {
          console.warn('Erro ao salvar cache:', cacheError);
        }
        return;
      }

      console.log('Referências carregadas:', data?.length || 0);
      setReferences(data as any[] || []);
      
      // Salvar no cache
      const cacheKey = 'price_request_references_cache';
      const cacheTimestampKey = 'price_request_references_cache_timestamp';
      try {
        localStorage.setItem(cacheKey, JSON.stringify(data || []));
        localStorage.setItem(cacheTimestampKey, Date.now().toString());
        console.log('💾 Dados salvos no cache (referências)');
      } catch (cacheError) {
        console.warn('Erro ao salvar cache:', cacheError);
      }
    } catch (error) {
      console.error('Erro ao carregar referências:', error);
      setReferences([]);
    }
  };

  const handleInputChange = async (field: string, value: any) => {
    // Campos de preço: aceitar apenas números inteiros e formatar com vírgula fixa
    const priceFields = ['current_price', 'suggested_price', 'arla_purchase_price'];
    
    if (priceFields.includes(field)) {
      // Remove tudo que não é número
      const numbersOnly = value.replace(/\D/g, '');
      // Formata com vírgula fixa (ex: 350 -> "3,50")
      const formatted = formatIntegerToPrice(numbersOnly);
      setFormData(prev => ({ ...prev, [field]: formatted }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }

    // Se mudou o posto, carregar métodos de pagamento dele
    if (field === 'station_id') {
      if (value && value !== 'none' && value !== '') {
        const methods = await getPaymentMethodsForStation(value);
        setStationPaymentMethods(methods);
      } else {
        setStationPaymentMethods([]);
      }
    }
  };

  const calculateMargin = useCallback(() => {
    try {
      // Converter de formato com vírgula fixa para número (reais)
      const suggestedPrice = parsePriceToInteger(formData.suggested_price) / 100;
      const currentPrice = parsePriceToInteger(formData.current_price) / 100;
      
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

      // Cálculo único para um posto
      const purchaseCost = parseFloat(formData.purchase_cost) || 0;
      const freightCost = parseFloat(formData.freight_cost) || 0;
      const baseCost = purchaseCost + freightCost;
      
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
      const volumeMade = parseFloat(formData.volume_made) || 0;
      const volumeProjected = parseFloat(formData.volume_projected) || 0;
      const suggestedPrice = (parsePriceToInteger(formData.suggested_price) / 100) || 0;
      const arlaPurchase = (parsePriceToInteger(formData.arla_purchase_price) / 100) || 0;
      const arlaSale = formData.product === 'arla32_granel' ? suggestedPrice : 0;
      
      // Converter m³ para litros (1 m³ = 1000 litros)
      const volumeProjectedLiters = volumeProjected * 1000;
      
      // Cálculo único para um posto
      const purchaseCost = parseFloat(formData.purchase_cost) || 0;
      const freightCost = parseFloat(formData.freight_cost) || 0;
      
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
        const arlaMargin = (parsePriceToInteger(formData.arla_purchase_price) / 100) - parseFloat(formData.arla_cost_price);
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
    formData.arla_cost_price,
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
    formData.station_ids,
    stationCosts,
    stationPaymentMethods,
    paymentMethods,
    calculateMargin
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
    if (!isDraft && ((!formData.station_id || formData.station_id === 'none') || !formData.client_id || !formData.product || !formData.suggested_price)) {
      toast.error("Por favor, preencha todos os campos obrigatórios");
      return;
    }

    setLoading(true);
    try {
      // Converter preços de formato com vírgula fixa para reais
      const suggestedPriceNum = parsePriceToInteger(formData.suggested_price) / 100;
      const currentPriceNum = parsePriceToInteger(formData.current_price) / 100;
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
      // Usar station_id (seleção única)
      const stationIdToSave = (!formData.station_id || formData.station_id === 'none')
        ? null
        : String(formData.station_id);
      
      // Manter station_ids como array com um elemento para compatibilidade com dados existentes
      const stationIdsToSave = stationIdToSave ? [stationIdToSave] : [];
        
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
        station_ids_form: formData.station_ids,
        station_id_form: formData.station_id,
        client_id_form: formData.client_id,
        reference_id_form: formData.reference_id,
        payment_method_id_form: formData.payment_method_id
      });
      console.log('📝 IDs VALIDADOS PARA SALVAR:', {
        station_ids: stationIdsToSave,
        station_id: stationIdToSave,
        client_id: clientIdToSave,
        reference_id: referenceIdToSave,
        payment_method_id: paymentMethodIdToSave
      });
      
      const requestData = {
        station_id: stationIdToSave,
        // station_ids removido - coluna não existe na tabela
        client_id: clientIdToSave,
        product: formData.product as any,
        current_price: currentPrice,
        suggested_price: suggestedPrice,
        final_price: finalPrice ?? 0,
        reference_id: referenceIdToSave,
        payment_method_id: paymentMethodIdToSave,
        observations: formData.observations || null,
        attachments: attachments,
        requested_by: user?.id ? String(user.id) : (user?.email || ''),
        created_by: user?.id ? String(user.id) : (user?.email || ''),
        margin_cents: margin, // Margem já está em centavos
        cost_price: costPrice,
        status: 'draft' as any, // Sempre salvar como draft ao adicionar
        // Dados de cálculo para análise
        purchase_cost: parseBrazilianDecimal(formData.purchase_cost) || null,
        freight_cost: parseBrazilianDecimal(formData.freight_cost) || null,
        volume_made: parseBrazilianDecimal(formData.volume_made) || null,
        volume_projected: parseBrazilianDecimal(formData.volume_projected) || null,
        arla_purchase_price: (parsePriceToInteger(formData.arla_purchase_price) / 100) || null,
        arla_cost_price: parseBrazilianDecimal(formData.arla_cost_price) || null,
        // Origem do preço
        price_origin_base: priceOrigin?.base_nome || null,
        price_origin_bandeira: priceOrigin?.base_bandeira || null,
        price_origin_delivery: priceOrigin?.forma_entrega || null,
        // Aprovação multinível - usar configurações dinâmicas baseadas em margem
        approval_level: 1, // Será ajustado pela regra se necessário
        total_approvers: 3, // Será ajustado pela regra se necessário
        approvals_count: 0,
        rejections_count: 0
      };

      // Buscar regra de aprovação baseada na margem
      let finalApprovalLevel = 1;
      let finalTotalApprovers = 3;
      
      try {
        const { data: approvalRule, error: ruleError } = await supabase
          .rpc('get_approval_margin_rule' as any, {
            margin_cents: margin
          });
        
        if (!ruleError && approvalRule && Array.isArray(approvalRule) && approvalRule.length > 0) {
          const rule = approvalRule[0] as any;
          if (rule.required_profiles && Array.isArray(rule.required_profiles) && rule.required_profiles.length > 0) {
            // Buscar aprovadores para determinar o nível inicial
            const { data: allApprovers } = await supabase
              .from('user_profiles')
              .select('user_id, email, perfil')
              .in('perfil', rule.required_profiles);
            
            if (allApprovers && allApprovers.length > 0) {
              // Buscar ordem hierárquica de aprovação do banco de dados
              const { data: orderData } = await supabase
                .from('approval_profile_order' as any)
                .select('perfil, order_position')
                .eq('is_active', true)
                .order('order_position', { ascending: true });

              // Se não houver ordem configurada, usar ordem padrão
              let approvalOrder: string[] = ['supervisor_comercial', 'diretor_comercial', 'diretor_pricing'];
              if (orderData && orderData.length > 0) {
                approvalOrder = orderData.map((item: any) => item.perfil);
              }

              // Encontrar o índice do primeiro perfil requerido na ordem hierárquica
              const firstRequiredProfile = rule.required_profiles
                .map((profile: string) => approvalOrder.indexOf(profile))
                .filter((idx: number) => idx >= 0)
                .sort((a: number, b: number) => a - b)[0];
              
              if (firstRequiredProfile !== undefined) {
                finalApprovalLevel = firstRequiredProfile + 1; // approval_level é 1-indexed
                finalTotalApprovers = allApprovers.length;
                console.log('📋 Regra de aprovação aplicada:', rule);
                console.log('📋 Approval level ajustado para:', finalApprovalLevel);
                console.log('📋 Total de aprovadores:', finalTotalApprovers);
              }
            }
          }
        }
      } catch (error) {
        console.error('Erro ao buscar regra de aprovação:', error);
        // Continuar com valores padrão se houver erro
      }
      
      // Atualizar requestData com os valores finais
      requestData.approval_level = finalApprovalLevel;
      requestData.total_approvers = finalTotalApprovers;

      // REGRA CLARA:
      // - Se é a primeira solicitação (addedCards.length === 0) E não há múltiplos postos → NÃO gerar batch_id (singular)
      // - Se já há cards adicionados OU há múltiplos postos selecionados → GERAR batch_id (lote)
      // - Todas as solicitações criadas na mesma operação devem ter o mesmo batch_id
      const hasMultipleStations = formData.station_ids && formData.station_ids.length > 1;
      const willHaveMultipleRequests = addedCards.length > 0 || hasMultipleStations;
      
      // Determinar batch_id antes de criar as solicitações
      let batchIdToUse: string | null = null;
      
      if (willHaveMultipleRequests) {
        // Se já há cards adicionados, usar o batch_id do primeiro card (se existir) ou gerar um novo
        try {
          // Buscar batch_id do primeiro card adicionado (se existir)
          if (addedCards[0]?.suggestionId) {
            const { data: firstCardData } = await supabase
              .from('price_suggestions')
              .select('batch_id')
              .eq('id', addedCards[0].suggestionId)
              .single() as any;
            
            if (firstCardData?.batch_id) {
              batchIdToUse = firstCardData.batch_id;
              console.log('📦 Reutilizando batch_id do primeiro card:', batchIdToUse);
            } else {
              // A primeira solicitação não tem batch_id, então gerar um novo e atualizar todas as solicitações existentes
              batchIdToUse = generateUUID();
              console.log('📦 Novo batch_id gerado para lote:', batchIdToUse);
              
              // Atualizar todas as solicitações existentes (que não têm batch_id) para terem o mesmo batch_id
              const existingSuggestionIds = addedCards
                .map(card => card.suggestionId)
                .filter(id => id);
              
              if (existingSuggestionIds.length > 0) {
                const { error: updateError } = await supabase
                  .from('price_suggestions' as any)
                  .update({ batch_id: batchIdToUse } as any)
                  .in('id', existingSuggestionIds)
                  .is('batch_id', null); // Só atualizar as que não têm batch_id
                
                if (updateError) {
                  console.error('⚠️ Erro ao atualizar batch_id das solicitações existentes:', updateError);
                } else {
                  console.log('✅ Batch_id atualizado para', existingSuggestionIds.length, 'solicitação(ões) existente(s)');
                }
              }
            }
          } else {
            // Gerar novo batch_id para o lote
            batchIdToUse = generateUUID();
            console.log('📦 Novo batch_id gerado para lote:', batchIdToUse);
          }
        } catch (error) {
          // Se falhar, gerar UUID no cliente
          batchIdToUse = generateUUID();
          console.log('📦 Batch_id gerado no cliente:', batchIdToUse);
        }
      } else {
        // Se é a primeira solicitação (não há cards adicionados) E não há múltiplos postos, não gerar batch_id (será singular)
        batchIdToUse = null;
        console.log('📦 Solicitação singular (sem batch_id)');
      }

      // Determinar quais postos processar
      const stationsToProcess = hasMultipleStations && formData.station_ids.length > 0
        ? formData.station_ids
        : (stationIdToSave ? [stationIdToSave] : []);

      console.log('🔍 Postos a processar:', stationsToProcess);
      console.log('📦 Batch ID a usar:', batchIdToUse);
      console.log('📝 isDraft:', isDraft, 'status:', isDraft ? 'draft' : 'pending');
      
      // Se houver múltiplos postos, criar uma solicitação para cada um com o mesmo batch_id
      if (stationsToProcess.length > 1) {
        const insertPromises = stationsToProcess.map(async (stationId) => {
          // Buscar custos específicos deste posto
          const stationCost = stationCosts[stationId];
          const station = stations.find(s => s.id === stationId || s.code === stationId);
          
          // Criar dados específicos para este posto
          const stationRequestData = {
            ...requestData,
            station_id: String(stationId),
            // Usar custos específicos deste posto se disponíveis
            purchase_cost: stationCost ? stationCost.purchase_cost : parseBrazilianDecimal(formData.purchase_cost) || null,
            freight_cost: stationCost ? stationCost.freight_cost : parseBrazilianDecimal(formData.freight_cost) || null,
            cost_price: stationCost ? (stationCost.purchase_cost + stationCost.freight_cost) : costPrice,
            // Recalcular margem para este posto
            margin_cents: stationCost && stationCost.margin_cents !== undefined 
              ? stationCost.margin_cents 
              : margin,
            batch_id: batchIdToUse // Todas as solicitações do mesmo lote terão o mesmo batch_id
          };
          
          console.log(`📝 Criando solicitação para posto ${station?.name || stationId}:`, stationRequestData);
          
          return supabase
            .from('price_suggestions')
            .insert([stationRequestData])
            .select()
            .single();
        });
        
        const results = await Promise.all(insertPromises);
        const errors = results.filter(r => r.error);
        
        if (errors.length > 0) {
          const firstError = errors[0].error;
          console.error('❌ Erro ao criar solicitações:', firstError);
          
          if (firstError?.code === '42501' || firstError?.message?.includes('permission') || firstError?.message?.includes('policy')) {
            toast.error("Erro de permissão. Verifique se você está autenticado corretamente.");
          } else if (firstError?.code === '23505') {
            toast.error("Erro: Já existe uma solicitação com esses dados.");
          } else if (firstError?.code === '23503') {
            toast.error("Erro: Referência inválida (posto, cliente ou método de pagamento).");
          } else {
            toast.error("Erro ao salvar solicitações: " + (firstError?.message || 'Erro desconhecido'));
          }
          setLoading(false);
          return;
        }
        
        // Processar todas as solicitações criadas
        const createdSuggestions = results.map(r => r.data).filter(Boolean);
        
        if (!isDraft && createdSuggestions.length > 0) {
          // Criar cards para cada solicitação criada
          for (const data of createdSuggestions) {
            // Buscar dados do posto
            const stationId = data.station_id;
            let stationData = null;
            
            if (stationId) {
              try {
                const station = stations.find(s => s.id === stationId || s.code === stationId);
                if (station) {
                  stationData = { name: station.name, code: station.code || station.id };
                } else {
                  // Tentar buscar do banco
                  const { data: seByCnpj } = await supabase
                    .from('sis_empresa' as any)
                    .select('nome_empresa, cnpj_cpf')
                    .eq('cnpj_cpf', stationId)
                    .maybeSingle();
                  
                  if (seByCnpj) {
                    stationData = { name: (seByCnpj as any).nome_empresa, code: (seByCnpj as any).cnpj_cpf };
                  }
                }
              } catch (err) {
                console.error('Erro ao buscar dados do posto:', err);
              }
            }
            
            const stationName = stationData?.name || stationId || 'N/A';
            const stationCode = stationData?.code || stationId || '';
            
            // Calcular resultado líquido (usar custos específicos do posto se disponíveis)
            const stationCost = stationCosts[stationId];
            const volumeProjected = parseFloat(formData.volume_projected) || 0;
            const volumeProjectedLiters = volumeProjected * 1000;
            const suggestedPrice = (parsePriceToInteger(formData.suggested_price) / 100) || 0;
            const purchaseCost = stationCost ? stationCost.purchase_cost : (parseFloat(formData.purchase_cost) || 0);
            const freightCost = stationCost ? stationCost.freight_cost : (parseFloat(formData.freight_cost) || 0);
            const baseCost = purchaseCost + freightCost;
            
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
            const totalRevenue = volumeProjectedLiters * suggestedPrice;
            const totalCost = volumeProjectedLiters * finalCost;
            const grossProfit = totalRevenue - totalCost;
            
            // ARLA compensation
            let arlaCompensation = 0;
            if (formData.product === 's10') {
              const arlaPurchase = parseFloat(formData.arla_purchase_price) || 0;
              const arlaMargin = arlaPurchase - parseFloat(formData.arla_cost_price || '0');
              const arlaVolume = volumeProjectedLiters * 0.05;
              arlaCompensation = arlaVolume * arlaMargin;
            } else if (formData.product === 'arla32_granel') {
              const arlaMargin = suggestedPrice - parseFloat(formData.arla_cost_price || '0');
              arlaCompensation = volumeProjectedLiters * arlaMargin;
            }
            
            const netResult = grossProfit + arlaCompensation;
            
            // Criar novo card
            const newCard = {
              id: data.id || `card-${Date.now()}-${Math.random()}`,
              stationName: stationName,
              stationCode: stationCode,
              location: '',
              netResult: netResult,
              suggestionId: data.id,
              expanded: false,
              attachments: attachments.length > 0 ? [...attachments] : undefined,
              costAnalysis: {
                purchase_cost: purchaseCost,
                freight_cost: freightCost,
                final_cost: finalCost,
                total_revenue: totalRevenue,
                total_cost: totalCost,
                gross_profit: grossProfit,
                profit_per_liter: volumeProjectedLiters > 0 ? grossProfit / volumeProjectedLiters : 0,
                arla_compensation: arlaCompensation,
                net_result: netResult,
                margin_cents: Math.round((suggestedPrice - finalCost) * 100),
                volume_projected: volumeProjected,
                suggested_price: suggestedPrice,
                feePercentage: feePercentage,
                base_cost: baseCost
              }
            };
            
            setAddedCards(prev => [...prev, newCard]);
          }
          
          toast.success(`${createdSuggestions.length} solicitação(ões) adicionada(s) com sucesso!`);
          
          // Resetar TODOS os campos do formulário
          setFormData(initialFormData);
          
          // Limpar anexos
          setAttachments([]);
          
          setLoading(false);
          return;
        }
        
        // Se for draft, não criar cards
        setLoading(false);
        return;
      }
      
      // Código para um único posto (comportamento original)
      (requestData as any).batch_id = batchIdToUse;
      
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
        console.error('❌ Hint:', (error as any).hint);
        console.error('❌ Dados tentados:', requestData);
        
        // Verificar se é erro de RLS
        if (error.code === '42501' || error.message?.includes('permission') || error.message?.includes('policy')) {
          toast.error("Erro de permissão. Verifique se você está autenticado corretamente.");
        } else if (error.code === '23505') {
          toast.error("Erro: Já existe uma solicitação com esses dados.");
        } else if (error.code === '23503') {
          toast.error("Erro: Referência inválida (posto, cliente ou método de pagamento).");
        } else {
          toast.error("Erro ao salvar solicitação: " + (error.message || 'Erro desconhecido'));
        }
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

      // Se for "Adicionar" (não é rascunho), criar card ao invés de mostrar tela de sucesso
      if (!isDraft) {
        // Buscar dados do posto para o card
        const stationName = stationData?.name || formData.station_id || 'N/A';
        const stationCode = stationData?.code || formData.station_id || '';
        
        // Buscar localização do posto (usar dados já disponíveis ou deixar vazio)
        let location = '';
        // Por enquanto, deixar vazio ou usar dados já disponíveis do stationData
        // A localização pode ser adicionada posteriormente se necessário
        
        // Calcular resultado líquido
        const volumeProjected = parseFloat(formData.volume_projected) || 0;
        const volumeProjectedLiters = volumeProjected * 1000;
        const suggestedPrice = (parsePriceToInteger(formData.suggested_price) / 100) || 0;
        const purchaseCost = parseFloat(formData.purchase_cost) || 0;
        const freightCost = parseFloat(formData.freight_cost) || 0;
        const baseCost = purchaseCost + freightCost;
        
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
        const totalRevenue = volumeProjectedLiters * suggestedPrice;
        const totalCost = volumeProjectedLiters * finalCost;
        const grossProfit = totalRevenue - totalCost;
        
        // ARLA compensation
        let arlaCompensation = 0;
        if (formData.product === 's10') {
          const arlaPurchase = parseFloat(formData.arla_purchase_price) || 0;
          const arlaMargin = arlaPurchase - parseFloat(formData.arla_cost_price || '0');
          const arlaVolume = volumeProjectedLiters * 0.05;
          arlaCompensation = arlaVolume * arlaMargin;
        } else if (formData.product === 'arla32_granel') {
          const arlaMargin = suggestedPrice - parseFloat(formData.arla_cost_price || '0');
          arlaCompensation = volumeProjectedLiters * arlaMargin;
        }
        
        const netResult = grossProfit + arlaCompensation;
        
        // Criar novo card
        const newCard = {
          id: data.id || `card-${Date.now()}`,
          stationName: stationName,
          stationCode: stationCode,
          location: location || 'N/A',
          netResult: netResult,
          suggestionId: data.id,
          expanded: false,
          attachments: attachments.length > 0 ? [...attachments] : undefined,
          costAnalysis: {
            purchase_cost: purchaseCost,
            freight_cost: freightCost,
            final_cost: finalCost,
            total_revenue: totalRevenue,
            total_cost: totalCost,
            gross_profit: grossProfit,
            profit_per_liter: volumeProjectedLiters > 0 ? grossProfit / volumeProjectedLiters : 0,
            arla_compensation: arlaCompensation,
            net_result: netResult,
            margin_cents: Math.round((suggestedPrice - finalCost) * 100),
            volume_projected: volumeProjected,
            suggested_price: suggestedPrice,
            feePercentage: feePercentage,
            base_cost: baseCost
          }
        };
        
        setAddedCards(prev => [...prev, newCard]);
        toast.success("Card adicionado com sucesso!");
        
        // Resetar TODOS os campos do formulário
        setFormData(initialFormData);
        
        // Limpar anexos
        setAttachments([]);
        
        // Limpar custos relacionados ao posto/cliente/produto
        setStationCosts({});
        setPriceOrigin(null);
        setFetchStatus(null);
        
        // Resetar referências de busca de custos para permitir recarregamento quando selecionar mesmo posto/produto
        setLastSearchedStation('');
        setLastSearchedProduct('');
        
        // Limpar cálculos
        setCalculatedPrice(0);
        setMargin(0);
      } else {
        // Se for rascunho, comportamento original
        toast.success("Rascunho salvo com sucesso!");
        setSaveAsDraft(isDraft);
        setSavedSuggestion(enrichedData);
        
        // Recarregar lista de solicitações após salvar
        if (activeTab === 'my-requests') {
          loadMyRequests();
        }
      }
      
    } catch (error: any) {
      console.error('❌ Erro ao salvar solicitação:', error);
      toast.error("Erro ao salvar solicitação: " + (error?.message || 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  const handleSendAllForApproval = async () => {
    if (addedCards.length === 0) {
      toast.error("Nenhuma solicitação para enviar");
      return;
    }

    setLoading(true);
    try {
      // Atualizar status de todas as solicitações de 'draft' para 'pending'
      const suggestionIds = addedCards
        .map(card => card.suggestionId)
        .filter(id => id); // Remover IDs vazios

      if (suggestionIds.length === 0) {
        toast.error("Nenhuma solicitação válida para enviar");
        return;
      }

      // Buscar todas as solicitações para verificar batch_id
      const { data: suggestions, error: fetchError } = await supabase
        .from('price_suggestions')
        .select('id, batch_id, created_at, created_by')
        .in('id', suggestionIds);

      if (fetchError) {
        throw fetchError;
      }

      // REGRA: Só criar batch_id se houver múltiplas solicitações (suggestionIds.length > 1)
      // Se for apenas 1 solicitação, não gerar batch_id (será singular)
      if (suggestionIds.length > 1) {
        // Agrupar por batch_id existente ou criar um novo para todas
        const batches = new Map<string, string[]>();
        let defaultBatchId: string | null = null;

        suggestions?.forEach((suggestion: any) => {
          if (suggestion.batch_id) {
            if (!batches.has(suggestion.batch_id)) {
              batches.set(suggestion.batch_id, []);
            }
            batches.get(suggestion.batch_id)!.push(suggestion.id);
          } else {
            // Se não tem batch_id, agrupar todas em um único batch
            if (!defaultBatchId) {
              defaultBatchId = generateUUID();
            }
            if (!batches.has(defaultBatchId)) {
              batches.set(defaultBatchId, []);
            }
            batches.get(defaultBatchId)!.push(suggestion.id);
          }
        });

        // Atualizar cada batch com o mesmo batch_id, batch_name e status pending
        for (const [batchId, ids] of batches.entries()) {
          const updateData: any = { 
            status: 'pending' as any,
            batch_id: batchId // Garantir que todas tenham o mesmo batch_id
          };
          
          // Se houver nome do lote, adicionar
          if (batchName && batchName.trim()) {
            updateData.batch_name = batchName.trim();
          }
          
          const { error: updateError } = await supabase
            .from('price_suggestions')
            .update(updateData)
            .in('id', ids);

          if (updateError) {
            console.error('❌ Erro ao atualizar batch:', updateError);
            throw updateError;
          }
        }
      } else {
        // Se for apenas 1 solicitação, apenas atualizar status para pending (sem batch_id)
        const { error: updateError } = await supabase
          .from('price_suggestions')
          .update({ 
            status: 'pending' as any
            // Não adicionar batch_id - será singular
          })
          .in('id', suggestionIds);

        if (updateError) {
          console.error('❌ Erro ao atualizar solicitação:', updateError);
          throw updateError;
        }
      }

      toast.success(`${suggestionIds.length} solicitação(ões) enviada(s) para aprovação com sucesso!`);
      
      // Limpar os cards e nome do lote após enviar
      setAddedCards([]);
      setBatchName('');
      
      // Recarregar lista de solicitações
      if (activeTab === 'my-requests') {
        loadMyRequests();
      }
    } catch (error: any) {
      console.error('❌ Erro ao enviar solicitações para aprovação:', error);
      toast.error("Erro ao enviar solicitações: " + (error?.message || 'Erro desconhecido'));
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
                  <div className="space-y-1">
                    {savedSuggestion.stations_list && savedSuggestion.stations_list.length > 0 ? (
                      savedSuggestion.stations_list.map((station: any, idx: number) => (
                        <p key={idx} className="text-lg font-bold text-blue-900 dark:text-blue-100">
                          {station.name}
                        </p>
                      ))
                    ) : (
                      <p className="text-xl font-bold text-blue-900 dark:text-blue-100">
                        {savedSuggestion.stations?.name || savedSuggestion.station_id || 'N/A'}
                      </p>
                    )}
                  </div>
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

  // Estado para controlar abertura de modais de anexos por card
  const [openAttachmentModals, setOpenAttachmentModals] = useState<Record<string, number | null>>({});
  
  // Componente auxiliar para exibir um item de anexo
  const AttachmentItem = ({ attachment, fileName, cardId, index }: { attachment: string; fileName: string; cardId: string; index: number }) => {
    const modalKey = `${cardId}-${index}`;
    const isOpen = openAttachmentModals[modalKey] === index;
    
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600">
        <Eye className="h-4 w-4 text-slate-600 dark:text-slate-400" />
        <span className="text-xs text-slate-700 dark:text-slate-300 truncate max-w-[200px]">
          {fileName}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={() => setOpenAttachmentModals(prev => ({ ...prev, [modalKey]: isOpen ? null : index }))}
        >
          <Eye className="h-3 w-3" />
        </Button>
        <ImageViewerModal
          isOpen={isOpen}
          onClose={() => setOpenAttachmentModals(prev => ({ ...prev, [modalKey]: null }))}
          imageUrl={attachment}
          imageName={fileName}
        />
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-4 space-y-4">
        {/* Header com gradiente moderno */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 p-4 text-white shadow-xl">
          <div className="absolute inset-0 bg-black/10"></div>
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
          <Button 
                variant="secondary" 
            onClick={() => navigate("/dashboard")}
                className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white border-white/30 backdrop-blur-sm h-8"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar ao Dashboard
          </Button>
              <div>
                <h1 className="text-xl font-bold mb-1">Solicitação de Preço</h1>
                <p className="text-slate-200 text-sm">Solicite novos preços para análise e aprovação</p>
              </div>
            </div>
          </div>
        </div>

        {/* Header com botão de Nova Solicitação */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">
            {activeTab === 'new' ? 'Nova Solicitação de Preço' : 'Minhas Solicitações'}
          </h2>
          <div className="flex gap-3">
            {activeTab === 'my-requests' && (
              <Button
                onClick={() => setActiveTab('new')}
                className="flex items-center gap-2"
              >
                <DollarSign className="h-4 w-4" />
                Nova Solicitação
              </Button>
            )}
            {activeTab === 'new' && (
              <Button
                onClick={() => setActiveTab('my-requests')}
                variant="outline"
                className="flex items-center gap-2"
              >
                <FileText className="h-4 w-4" />
                Minhas Solicitações
              </Button>
            )}
          </div>
        </div>

        {/* Conteúdo baseado na aba ativa */}
        {activeTab === 'new' && (
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
                  <div className="md:col-span-2">
                    <SisEmpresaCombobox
                      label="Posto"
                      value={formData.station_id}
                      onSelect={(stationId) => {
                        handleInputChange("station_id", stationId);
                        // Manter station_ids como array com um elemento para compatibilidade
                        handleInputChange("station_ids", stationId ? [stationId] : []);
                      }}
                      required={true}
                    />
                  </div>

                {/* Cliente */}
                  <div className="md:col-span-2">
                    <ClientCombobox
                      label="Cliente"
                      value={formData.client_id}
                      onSelect={(clientId, clientName) => handleInputChange("client_id", clientId)}
                      required={true}
                    />
                  </div>

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

                  {/* Preço Atual */}
                  <div className="space-y-2">
                    <Label htmlFor="current_price" className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <svg className="h-6 w-6 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                      </svg>
                      Preço Atual
                    </Label>
                    <Input
                      id="current_price"
                      type="text"
                      inputMode="numeric"
                      placeholder="0,00"
                      value={formData.current_price}
                      onChange={(e) => handleInputChange("current_price", e.target.value)}
                      onWheel={(e) => e.currentTarget.blur()}
                      className="h-11"
                      translate="no"
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
                      type="text"
                      inputMode="numeric"
                      placeholder="0,00"
                      value={formData.suggested_price}
                      onChange={(e) => handleInputChange("suggested_price", e.target.value)}
                      onWheel={(e) => e.currentTarget.blur()}
                      className="h-11"
                      translate="no"
                    />
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
                          type="text"
                          inputMode="numeric"
                          placeholder="0,00"
                          value={formData.suggested_price}
                          onChange={(e) => handleInputChange("suggested_price", e.target.value)}
                          onWheel={(e) => e.currentTarget.blur()}
                          className="h-11 bg-white dark:bg-slate-800 text-lg font-semibold"
                          translate="no"
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
                          type="text"
                          inputMode="numeric"
                          placeholder="0,00"
                          value={formData.arla_purchase_price}
                          onChange={(e) => handleInputChange("arla_purchase_price", e.target.value)}
                          onWheel={(e) => e.currentTarget.blur()}
                          className="h-11 bg-white dark:bg-slate-800"
                          translate="no"
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
                        📍 {priceOrigin.base_bandeira} - {priceOrigin.base_nome} | {priceOrigin.forma_entrega}
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
                  <Plus className="h-5 w-5" />
                  {loading ? "Adicionando..." : "Adicionar"}
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
        <div className="space-y-3">
          {/* Resultados Individuais por Posto */}
          {addedCards.length > 0 && (
            <Card className="shadow-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    {addedCards.length > 1 ? `Lote de Solicitações (${addedCards.length})` : `Solicitação Individual`}
                  </CardTitle>
                  <Button
                    onClick={handleSendAllForApproval}
                    disabled={loading || addedCards.length === 0}
                    className="flex items-center gap-2 h-9 px-4 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
                  >
                    <Send className="h-4 w-4" />
                    Enviar para Aprovação
                  </Button>
                </div>
                {/* Campo para nomear o lote (só aparece se houver múltiplas solicitações) */}
                {addedCards.length > 1 && (
                  <div className="mt-3">
                    <Label htmlFor="batch-name" className="text-xs text-slate-600 dark:text-slate-400 mb-1 block">
                      Nome do Lote (opcional)
                    </Label>
                    <Input
                      id="batch-name"
                      placeholder="Ex: Proposta Cliente X - Novembro 2025"
                      value={batchName}
                      onChange={(e) => setBatchName(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                )}
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {addedCards.map((card) => (
                    <div
                      key={card.id}
                      className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                              {card.stationName.toUpperCase()} - {card.stationCode}
                            </h3>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-400">
                            {card.location}
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-xs text-slate-500 dark:text-slate-400">Resultado</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Líquido</p>
                            <p className={`text-base font-bold ${card.netResult >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                              {formatPrice(card.netResult)}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setAddedCards(prev =>
                                prev.map(c =>
                                  c.id === card.id ? { ...c, expanded: !c.expanded } : c
                                )
                              );
                            }}
                            className="h-8 w-8 p-0"
                          >
                            <ChevronDown
                              className={`h-5 w-5 text-slate-600 dark:text-slate-400 transition-transform ${
                                card.expanded ? 'transform rotate-180' : ''
                              }`}
                            />
                          </Button>
                        </div>
                      </div>
                      
                      {/* Análise de Custos Expandida */}
                      {card.expanded && card.costAnalysis && (
                        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                          <Card className="shadow-sm border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                            <CardHeader className="pb-3 border-b border-slate-200 dark:border-slate-700">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                                  <BarChart className="h-5 w-5 text-slate-600 dark:text-slate-300" />
                                </div>
                                <div>
                                  <CardTitle className="text-base font-semibold text-slate-900 dark:text-slate-100">
                                    Análise de Custos
                                  </CardTitle>
                                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Cálculos detalhados de rentabilidade</p>
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent className="pt-3 space-y-2.5">
                              <div className="space-y-2">
                                {/* Custo Final por Litro */}
                                <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                                  <div className="flex justify-between items-center mb-1.5">
                                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Custo Final/L:</span>
                                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                      {formatPrice4Decimals(card.costAnalysis.final_cost)}
                                    </span>
                                  </div>
                                  {/* Origem do Custo - pequeno abaixo do custo */}
                                  {priceOrigin && (
                                    <div className="mt-1.5 pt-1.5 border-t border-slate-200 dark:border-slate-700">
                                      <p className="text-[10px] leading-tight text-slate-500 dark:text-slate-400">
                                        📍 {priceOrigin.base_bandeira} - {priceOrigin.base_nome} ({priceOrigin.base_codigo}) | {priceOrigin.forma_entrega}
                                        {card.costAnalysis.feePercentage > 0 && (
                                          <span className="ml-1">• Taxa: {card.costAnalysis.feePercentage.toFixed(2)}%</span>
                                        )}
                                      </p>
                                    </div>
                                  )}
                                </div>

                                {/* Receita Total */}
                                <div className="flex justify-between items-center p-2.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50">
                                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Receita Total:</span>
                                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                    {formatPrice(card.costAnalysis.total_revenue)}
                                  </span>
                                </div>

                                {/* Custo Total */}
                                <div className="flex justify-between items-center p-2.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50">
                                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Custo Total:</span>
                                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                    {formatPrice(card.costAnalysis.total_cost)}
                                  </span>
                                </div>

                                {/* Lucro Bruto */}
                                <div className="flex justify-between items-center p-2.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50">
                                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Lucro Bruto:</span>
                                  <span className={`text-sm font-semibold ${card.costAnalysis.gross_profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                    {formatPrice(card.costAnalysis.gross_profit)}
                                  </span>
                                </div>

                                {/* Lucro por Litro */}
                                <div className="flex justify-between items-center p-2.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50">
                                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Lucro/Litro:</span>
                                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                    {formatPrice4Decimals(card.costAnalysis.profit_per_liter)}
                                  </span>
                                </div>

                                {/* Compensação ARLA */}
                                {card.costAnalysis.arla_compensation !== 0 && (
                                  <div className="flex justify-between items-center p-2.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50">
                                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Compensação ARLA:</span>
                                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                      {formatPrice(card.costAnalysis.arla_compensation)}
                                    </span>
                                  </div>
                                )}

                                {/* Resultado Líquido */}
                                <div className={`flex justify-between items-center p-3 rounded border ${card.costAnalysis.net_result >= 0 ? 'border-green-500/50 dark:border-green-500/30 bg-green-50/50 dark:bg-green-950/20' : 'border-red-500/50 dark:border-red-500/30 bg-red-50/50 dark:bg-red-950/20'}`}>
                                  <div className="flex items-center gap-2">
                                    {card.costAnalysis.net_result >= 0 ? (
                                      <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                                    ) : (
                                      <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                                    )}
                                    <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                                      Resultado Líquido:
                                    </span>
                                  </div>
                                  <span className={`text-sm font-bold ${card.costAnalysis.net_result >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                    {formatPrice(card.costAnalysis.net_result)}
                                  </span>
                                </div>
                                
                                {/* Anexos */}
                                {card.attachments && card.attachments.length > 0 && (
                                  <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                                    <div className="space-y-2">
                                      <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                                        Anexos:
                                      </Label>
                                      <div className="flex flex-wrap gap-2">
                                        {card.attachments.map((attachment, idx) => {
                                          const fileName = attachment.split('/').pop() || `Anexo ${idx + 1}`;
                                          return (
                                            <AttachmentItem
                                              key={idx}
                                              attachment={attachment}
                                              fileName={fileName}
                                              cardId={card.id}
                                              index={idx}
                                            />
                                          );
                                        })}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
            <Card className="shadow-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-slate-600 dark:text-slate-300" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold text-slate-900 dark:text-slate-100">
                      Ajuste
                    </CardTitle>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Visualize os valores calculados</p>
                  </div>
                </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-2.5">
              {calculatedPrice > 0 ? (
                <>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center py-1.5">
                        <span className="text-xs text-slate-600 dark:text-slate-400">Preço Sugerido:</span>
                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{formatPrice(calculatedPrice)}</span>
                    </div>
                    
                    {formData.current_price && formData.suggested_price && (
                      <div className="flex justify-between items-center py-1.5">
                        <span className="text-xs text-slate-600 dark:text-slate-400">Preço Atual:</span>
                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{formatPrice(parsePriceToInteger(formData.current_price) / 100)}</span>
                      </div>
                    )}
                    
                    {formData.current_price && formData.suggested_price && (
                      <>
                        <div className="flex justify-between items-center py-1.5 border-t border-slate-200 dark:border-slate-700 pt-2">
                          <span className="text-xs text-slate-600 dark:text-slate-400">Margem Custo:</span>
                          <span className={`text-sm font-semibold ${margin >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {margin} centavos
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-1.5">
                          <span className="text-xs text-slate-600 dark:text-slate-400">Ajuste:</span>
                          <span className={`text-sm font-semibold ${(() => {
                            const current = (parsePriceToInteger(formData.current_price) / 100) || 0;
                            const suggested = (parsePriceToInteger(formData.suggested_price) / 100) || 0;
                            const adjustment = suggested - current;
                            return adjustment >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
                          })()}`}>
                            {(() => {
                              const current = (parsePriceToInteger(formData.current_price) / 100) || 0;
                              const suggested = (parsePriceToInteger(formData.suggested_price) / 100) || 0;
                              const adjustment = suggested - current;
                              const adjustmentCents = Math.round(adjustment * 100);
                              return `${adjustmentCents >= 0 ? '+' : ''}${adjustmentCents} centavos`;
                            })()}
                          </span>
                        </div>
                      </>
                    )}
                    </div>
                    
                    {formData.current_price && formData.suggested_price && (() => {
                      const current = (parsePriceToInteger(formData.current_price) / 100) || 0;
                      const suggested = (parsePriceToInteger(formData.suggested_price) / 100) || 0;
                      const adjustment = suggested - current;
                      return adjustment !== 0;
                    })() && (
                      <div className="pt-2 mt-2 border-t border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-2">
                          {(() => {
                            const current = (parsePriceToInteger(formData.current_price) / 100) || 0;
                            const suggested = (parsePriceToInteger(formData.suggested_price) / 100) || 0;
                            const adjustment = suggested - current;
                            return adjustment >= 0 ? (
                              <CheckCircle className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                            ) : (
                              <AlertCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                            );
                          })()}
                          <span className={`text-xs font-medium ${(() => {
                            const current = (parsePriceToInteger(formData.current_price) / 100) || 0;
                            const suggested = (parsePriceToInteger(formData.suggested_price) / 100) || 0;
                            const adjustment = suggested - current;
                            return adjustment >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
                          })()}`}>
                            {(() => {
                              const current = (parsePriceToInteger(formData.current_price) / 100) || 0;
                              const suggested = (parsePriceToInteger(formData.suggested_price) / 100) || 0;
                              const adjustment = suggested - current;
                              return adjustment >= 0 ? 'Ajuste positivo' : 'Ajuste negativo';
                            })()}
                          </span>
                        </div>
                      </div>
                    )}
                </>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-3">
                  Preencha os valores para ver o cálculo da margem
                </p>
              )}
            </CardContent>
          </Card>

          {/* Análise de Custos - para múltiplos postos */}
          {formData.station_ids && formData.station_ids.length > 1 && (
            <div className="space-y-4">
              {formData.station_ids.map((stationId) => {
                const stationCost = stationCosts[stationId];
                const station = stations.find(s => s.id === stationId);
                if (!stationCost || !station) return null;
                
                // Calcular valores para este posto
                const volumeProjected = parseFloat(formData.volume_projected) || 0;
                const volumeProjectedLiters = volumeProjected * 1000;
                const suggestedPrice = (parsePriceToInteger(formData.suggested_price) / 100) || 0;
                
                const finalCost = stationCost.final_cost || 0;
                const totalRevenue = stationCost.total_revenue || 0;
                const totalCost = stationCost.total_cost || 0;
                const grossProfit = stationCost.gross_profit || 0;
                const profitPerLiter = stationCost.profit_per_liter || 0;
                const arlaCompensation = stationCost.arla_compensation || 0;
                const netResult = stationCost.net_result || 0;
                
                // Buscar taxa para este posto
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
                
                return (
                  <Card key={`cost-analysis-${stationId}`} className="shadow-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                    <CardHeader className="pb-3 border-b border-slate-200 dark:border-slate-700">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                          <BarChart className="h-5 w-5 text-slate-600 dark:text-slate-300" />
                        </div>
                        <div>
                          <CardTitle className="text-base font-semibold text-slate-900 dark:text-slate-100">
                            Análise de Custos - {station.name}
                          </CardTitle>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Cálculos detalhados de rentabilidade</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-3 space-y-2.5">
                      <div className="space-y-2">
                        {/* Custo Final por Litro */}
                        <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                          <div className="flex justify-between items-center mb-1.5">
                            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Custo Final/L:</span>
                            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{formatPrice4Decimals(finalCost)}</span>
                          </div>
                          {feePercentage > 0 && (
                            <div className="text-xs text-slate-600 dark:text-slate-400 border-t border-slate-200 dark:border-slate-700 pt-2 mt-2 space-y-1">
                              <div className="flex justify-between">
                                <span>Base (compra + frete)/L:</span>
                                <span>{formatPrice4Decimals(stationCost.purchase_cost + stationCost.freight_cost)}</span>
                              </div>
                              <div className="flex justify-between text-slate-700 dark:text-slate-300 font-medium">
                                <span>Taxa ({feePercentage.toFixed(2)}%):</span>
                                <span>+{formatPrice4Decimals(finalCost - (stationCost.purchase_cost + stationCost.freight_cost))}</span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Receita Total */}
                        <div className="flex justify-between items-center p-2.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50">
                          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Receita Total:</span>
                          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{formatPrice(totalRevenue)}</span>
                        </div>

                        {/* Custo Total */}
                        <div className="flex justify-between items-center p-2.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50">
                          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Custo Total:</span>
                          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{formatPrice(totalCost)}</span>
                        </div>

                        {/* Lucro Bruto */}
                        <div className="flex justify-between items-center p-2.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50">
                          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Lucro Bruto:</span>
                          <span className={`text-sm font-semibold ${grossProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {formatPrice(grossProfit)}
                          </span>
                        </div>

                        {/* Lucro por Litro */}
                        <div className="flex justify-between items-center p-2.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50">
                          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Lucro/Litro:</span>
                          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{formatPrice4Decimals(profitPerLiter)}</span>
                        </div>

                        {/* Compensação ARLA */}
                        {arlaCompensation !== 0 && (
                          <div className="flex justify-between items-center p-2.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50">
                            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Compensação ARLA:</span>
                            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{formatPrice(arlaCompensation)}</span>
                          </div>
                        )}

                        {/* Resultado Líquido */}
                        <div className={`flex justify-between items-center p-3 rounded border ${netResult >= 0 ? 'border-green-500/50 dark:border-green-500/30 bg-green-50/50 dark:bg-green-950/20' : 'border-red-500/50 dark:border-red-500/30 bg-red-50/50 dark:bg-red-950/20'}`}>
                          <div className="flex items-center gap-2">
                            {netResult >= 0 ? (
                              <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                            )}
                            <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                              Resultado Líquido:
                            </span>
                          </div>
                          <span className={`text-sm font-bold ${netResult >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {formatPrice(netResult)}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Análise de Custos - solicitação atual */}
          {(costCalculations.finalCost > 0 || costCalculations.totalRevenue > 0) && (
            <Card className="shadow-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
              <CardHeader className="pb-3 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                    <BarChart className="h-5 w-5 text-slate-600 dark:text-slate-300" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold text-slate-900 dark:text-slate-100">
                      Análise de Custos
                    </CardTitle>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Cálculos detalhados de rentabilidade</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-3 space-y-2.5">
                <div className="space-y-2">
                  {/* Custo Final por Litro */}
                  <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Custo Final/L:</span>
                      <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{formatPrice4Decimals(costCalculations.finalCost)}</span>
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
                      const baseCostTotal = purchaseCost + freightCost;
                      return feePercentage > 0 ? (
                        <div className="text-xs text-slate-600 dark:text-slate-400 border-t border-slate-200 dark:border-slate-700 pt-2 mt-2 space-y-1">
                          <div className="flex justify-between">
                            <span>Base (compra + frete)/L:</span>
                            <span>{formatPrice4Decimals(baseCostTotal)}</span>
                          </div>
                          <div className="flex justify-between text-slate-700 dark:text-slate-300 font-medium">
                            <span>Taxa ({feePercentage.toFixed(2)}%):</span>
                            <span>+{formatPrice4Decimals(costCalculations.finalCost - baseCostTotal)}</span>
                          </div>
                        </div>
                      ) : null;
                    })()}
                  </div>

                  {/* Receita Total */}
                  <div className="flex justify-between items-center p-2.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Receita Total:</span>
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{formatPrice(costCalculations.totalRevenue)}</span>
                  </div>

                  {/* Custo Total */}
                  <div className="flex justify-between items-center p-2.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Custo Total:</span>
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{formatPrice(costCalculations.totalCost)}</span>
                  </div>

                  {/* Lucro Bruto */}
                  <div className="flex justify-between items-center p-2.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Lucro Bruto:</span>
                    <span className={`text-sm font-semibold ${costCalculations.grossProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {formatPrice(costCalculations.grossProfit)}
                    </span>
                  </div>

                  {/* Lucro por Litro */}
                  <div className="flex justify-between items-center p-2.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Lucro/Litro:</span>
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{formatPrice4Decimals(costCalculations.profitPerLiter)}</span>
                  </div>

                  {/* Compensação ARLA */}
                  {costCalculations.arlaCompensation !== 0 && (
                    <div className="flex justify-between items-center p-2.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50">
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Compensação ARLA:</span>
                      <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{formatPrice(costCalculations.arlaCompensation)}</span>
                    </div>
                  )}

                  {/* Resultado Líquido */}
                  <div className={`flex justify-between items-center p-3 rounded border ${costCalculations.netResult >= 0 ? 'border-green-500/50 dark:border-green-500/30 bg-green-50/50 dark:bg-green-950/20' : 'border-red-500/50 dark:border-red-500/30 bg-red-50/50 dark:bg-red-950/20'}`}>
                    <div className="flex items-center gap-2">
                      {costCalculations.netResult >= 0 ? (
                        <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                      )}
                      <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                        Resultado Líquido:
                      </span>
                    </div>
                    <span className={`text-sm font-bold ${costCalculations.netResult >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {formatPrice(costCalculations.netResult)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

        </div>
      </div>
        )}

        {activeTab === 'my-requests' && (
            <div className="space-y-6">
              {loadingRequests && (
                <div className="flex items-center justify-center py-12">
                  <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Carregando solicitações...</p>
                  </div>
                </div>
              )}
              {!loadingRequests && (
                <>
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
                        <p className="text-2xl font-bold text-yellow-600">{myRequests.filter(r => r.type !== 'batch' && r.status === 'pending').length}</p>
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
                        <p className="text-2xl font-bold text-green-600">{myRequests.filter(r => r.type !== 'batch' && r.status === 'approved').length}</p>
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
                        <p className="text-2xl font-bold text-red-600">{myRequests.filter(r => r.type !== 'batch' && r.status === 'rejected').length}</p>
                      </div>
                      <X className="h-6 w-6 text-red-500" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* My Requests List */}
              <div className="space-y-4">
                {myRequests.map((request, index) => {
                  // Se for um lote, mostrar card compacto de proposta comercial
                  if (request.type === 'batch' && request.requests) {
                    const batch = request.requests;
                    const firstRequest = batch[0];
                    const proposalDate = new Date(firstRequest.created_at).toLocaleDateString('pt-BR');
                    const proposalNumber = index + 1;
                    
                    // Verificar se todos os clientes são iguais
                    const uniqueClients = new Set(batch.map((r: any) => r.client_id || 'unknown'));
                    const allSameClient = uniqueClients.size === 1;
                    const displayClient = allSameClient ? firstRequest.clients : batch[0].clients;
                    
                    // Verificar se todos os postos são iguais
                    const uniqueStations = new Set(batch.map((r: any) => {
                      const station = r.stations || r.stations_list?.[0];
                      return station?.name || station?.code || 'unknown';
                    }));
                    const allSameStation = uniqueStations.size === 1;
                    const displayStation = allSameStation 
                      ? (firstRequest.stations || firstRequest.stations_list?.[0])
                      : (batch[0].stations || batch[0].stations_list?.[0]);
                    
                    // Determinar status geral do lote
                    const allApproved = batch.every((r: any) => r.status === 'approved');
                    const hasPending = batch.some((r: any) => r.status === 'pending');
                    const hasPriceSuggested = batch.some((r: any) => r.status === 'price_suggested');
                    const allRejected = batch.every((r: any) => r.status === 'rejected');
                    
                    let generalStatus = 'pending';
                    if (allApproved) {
                      generalStatus = 'approved';
                    } else if (hasPriceSuggested && !hasPending) {
                      generalStatus = 'price_suggested';
                    } else if (hasPending) {
                      generalStatus = 'pending';
                    } else if (allRejected) {
                      generalStatus = 'rejected';
                    } else {
                      // Se houver mix de status, priorizar: approved > price_suggested > pending > rejected
                      const hasAnyApproved = batch.some((r: any) => r.status === 'approved');
                      if (hasAnyApproved) {
                        generalStatus = 'pending'; // Ainda tem aprovações pendentes
                      } else if (hasPriceSuggested) {
                        generalStatus = 'price_suggested';
                      } else {
                        generalStatus = 'rejected';
                      }
                    }
                                      
                                      return (
                      <>
                        <Card key={request.batchKey} className="hover:shadow-lg transition-shadow">
                          <CardContent className="p-6">
                              <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                                    {request.batch_name || 'Proposta Comercial'}
                                  </span>
                                  {generalStatus === 'approved' ? (
                                    <Badge className="bg-green-100 text-green-800"><Check className="h-3 w-3 mr-1" />Aprovado</Badge>
                                  ) : generalStatus === 'pending' ? (
                                    <Badge variant="secondary" className="bg-yellow-100 text-yellow-800"><Clock className="h-3 w-3 mr-1" />Aguardando Aprovação</Badge>
                                  ) : generalStatus === 'price_suggested' ? (
                                    <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300"><DollarSign className="h-3 w-3 mr-1" />Preço Sugerido</Badge>
                                  ) : (
                                    <Badge variant="destructive"><X className="h-3 w-3 mr-1" />Rejeitado</Badge>
                                  )}
                                </div>
                                <div className="space-y-1 text-sm text-slate-600 dark:text-slate-400">
                                  {displayClient && (
                                    <p>
                                      <span className="font-medium">Cliente:</span> {displayClient.name || 'N/A'}
                                      {!allSameClient && <span className="text-xs ml-1">(+{uniqueClients.size - 1} outros)</span>}
                                    </p>
                                  )}
                                  {displayStation && (
                                    <p>
                                      <span className="font-medium">Posto:</span> {displayStation.name || 'N/A'}
                                      {!allSameStation && <span className="text-xs ml-1">(+{uniqueStations.size - 1} outros)</span>}
                                    </p>
                                  )}
                                  <p>Criado em: {proposalDate}</p>
                              </div>
                            </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setExpandedProposal(request.batchKey)}
                                className="ml-4"
                              >
                                <Maximize2 className="h-4 w-4 mr-2" />
                                Ver Completo
                              </Button>
                          </div>
                        </CardContent>
                      </Card>
                        
                        {/* Modal com visualização completa */}
                        <Dialog open={expandedProposal === request.batchKey} onOpenChange={(open) => !open && setExpandedProposal(null)}>
                          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto print:max-w-none print:max-h-none print:overflow-visible print:p-0">
                            <ProposalFullView 
                              batch={batch}
                              proposalNumber={proposalNumber}
                              proposalDate={proposalDate}
                              generalStatus={generalStatus}
                              user={user}
                            />
                          </DialogContent>
                        </Dialog>
                      </>
                    );
                  }
                  
                  // Visualização normal para solicitações individuais
                  return (
                    <Card key={request.id} className="hover:shadow-lg transition-shadow">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 gap-4">
                            <div className="flex items-center gap-3 mb-2">
                              <span className="font-semibold text-slate-800 dark:text-slate-200">
                                {request.stations_list && request.stations_list.length > 0 
                                  ? request.stations_list.map((s: any) => s.name).join(', ')
                                  : (request.stations?.name || 'Posto')
                                } - {request.clients?.name || 'Cliente'}
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
                  );
                })}
                
                {myRequests.length === 0 && (
                  <Card>
                    <CardContent className="p-12 text-center">
                      <p className="text-slate-600 dark:text-slate-400">Nenhuma solicitação encontrada</p>
                    </CardContent>
                  </Card>
                )}
              </div>
                </>
              )}
            </div>
        )}
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