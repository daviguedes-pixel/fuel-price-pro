import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Check, 
  X, 
  Clock, 
  Filter, 
  Search, 
  Eye,
  MessageSquare,
  Edit,
  Trash2
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ApprovalDetailsModal } from "@/components/ApprovalDetailsModal";
import { EditRequestModal } from "@/components/EditRequestModal";
import { formatBrazilianCurrency } from "@/lib/utils";

export default function MyRequests() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<any[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState<any>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [editingRequest, setEditingRequest] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [requestsWithHistory, setRequestsWithHistory] = useState<Set<string>>(new Set());
  
  const [filters, setFilters] = useState({
    status: "all",
    search: ""
  });

  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0
  });

  // Load my requests when component mounts
  useEffect(() => {
    loadMyRequests();
    
    // Listener de tempo real para atualizar quando houver mudanças
    if (user) {
      const channel = supabase
        .channel('my_requests_realtime')
        .on(
          'postgres_changes',
          {
            event: '*', // INSERT, UPDATE, DELETE
            schema: 'public',
            table: 'price_suggestions'
          },
          (payload) => {
            console.log('🔄 Mudança detectada em price_suggestions:', payload.eventType);
            // Recarregar após um pequeno delay para garantir que a transação completou
            setTimeout(() => {
              loadMyRequests();
            }, 500);
          }
        )
        .on(
          'broadcast',
          { event: 'request_deleted' },
          (payload) => {
            console.log('🔄 Evento de exclusão recebido:', payload);
            setTimeout(() => {
              loadMyRequests();
            }, 500);
          }
        )
        .subscribe((status) => {
          console.log('📡 MyRequests realtime status:', status);
        });
      
      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  // Verificar histórico de aprovações para múltiplas solicitações
  const checkApprovalHistoryForRequests = async (requests: any[]) => {
    const pendingOrDraft = requests.filter(r => r.status === 'pending' || r.status === 'draft');
    if (pendingOrDraft.length === 0) {
      setRequestsWithHistory(new Set());
      return;
    }

    try {
      const requestIds = pendingOrDraft.map(r => r.id).filter(Boolean);
      if (requestIds.length === 0) return;

      const { data, error } = await supabase
        .from('approval_history')
        .select('suggestion_id')
        .in('suggestion_id', requestIds);

      if (error) {
        console.error('Erro ao verificar histórico de aprovações:', error);
        return;
      }

      // Criar Set com IDs que têm histórico
      const idsWithHistory = new Set((data || []).map((item: any) => item.suggestion_id));
      setRequestsWithHistory(idsWithHistory);
    } catch (error) {
      console.error('Erro ao verificar histórico:', error);
    }
  };

  const loadMyRequests = async () => {
    if (!user) {
      console.log('⚠️ Usuário não encontrado');
      return;
    }

    setLoading(true);
    try {
      console.log('=== CARREGANDO MINHAS SOLICITAÇÕES ===');
      console.log('👤 User ID:', user.id);
      console.log('👤 User Email:', user.email);
      
      // Tentar buscar por ID primeiro
      const userId = String(user.id);
      const userEmail = user.email ? String(user.email) : null;
      
      // Buscar todas as solicitações e filtrar no cliente (mais confiável)
      const { data: allData, error: allError } = await supabase
        .from('price_suggestions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000); // Limite alto para garantir que pegamos todas
      
      if (allError) {
        console.error('❌ Erro ao buscar solicitações:', allError);
        throw allError;
      }
      
      console.log('🔍 Total de solicitações no banco:', allData?.length || 0);
      
      // Filtrar no cliente por ID ou email
      const data = (allData || []).filter((suggestion: any) => {
        const reqBy = String(suggestion.requested_by || '');
        const creBy = String(suggestion.created_by || '');
        return reqBy === userId || creBy === userId || 
               (userEmail && (reqBy === userEmail || creBy === userEmail));
      });

      console.log('🔍 Total de solicitações do usuário:', data?.length);
      console.log('🔍 Primeira solicitação:', data?.[0]);

      // Carregar postos e clientes
      const [stationsRes, clientsRes] = await Promise.all([
        supabase.rpc('get_sis_empresa_stations').then(res => {
          if (res.error) {
            console.error('❌ Erro ao buscar postos:', res.error);
            return { data: [], error: res.error };
          }
          return { data: res.data, error: null };
        }).catch(err => {
          console.error('❌ Erro ao chamar get_sis_empresa_stations:', err);
          return { data: [], error: err };
        }),
        supabase.from('clientes' as any).select('id_cliente, nome').catch(err => {
          console.error('❌ Erro ao buscar clientes:', err);
          return { data: [], error: err };
        })
      ]);

      // Enriquecer dados
      const enrichedData = (data || []).map((suggestion: any) => {
        let station = null;
        if (suggestion.station_id) {
          const suggStationId = String(suggestion.station_id);
          station = (stationsRes.data as any)?.find((s: any) => {
            const stationId = String(s.id || s.id_empresa || s.cnpj_cpf || '');
            return stationId === suggStationId || 
                   String(s.cnpj_cpf || '') === suggStationId || 
                   String(s.id_empresa || '') === suggStationId;
          });
          
          if (!station) {
            console.log('⚠️ Posto não encontrado:', { 
              suggestion_id: suggStationId, 
              available_stations: (stationsRes.data as any)?.slice(0, 3).map((s: any) => ({
                id: s.id,
                id_empresa: s.id_empresa,
                cnpj_cpf: s.cnpj_cpf,
                nome: s.nome_empresa || s.name
              }))
            });
          }
        }
        
        let client = null;
        if (suggestion.client_id) {
          const suggClientId = String(suggestion.client_id);
          client = (clientsRes.data as any)?.find((c: any) => {
            const clientId = String(c.id_cliente || c.id || '');
            return clientId === suggClientId;
          });
          
          if (!client) {
            console.log('⚠️ Cliente não encontrado:', { 
              suggestion_id: suggClientId,
              available_clients: (clientsRes.data as any)?.slice(0, 3).map((c: any) => ({
                id_cliente: c.id_cliente,
                id: c.id,
                nome: c.nome || c.name
              }))
            });
          }
        }

        // Garantir que status sempre existe com fallback
        const finalStatus = suggestion.status || 'pending';
        
        // Log para debug - verificar status sendo atribuído
        if (!suggestion.status) {
          console.log('⚠️ Status ausente, usando fallback "pending":', {
            id: suggestion.id,
            originalStatus: suggestion.status,
            finalStatus: finalStatus
          });
        }
        
        return {
          ...suggestion,
          status: finalStatus, // Garantir que sempre tenha status
          stations: station ? { name: station.nome_empresa || station.name || 'Posto sem nome', code: station.cnpj_cpf || station.id || station.id_empresa } : null,
          clients: client ? { name: client.nome || client.name || 'Cliente sem nome', code: String(client.id_cliente || client.id) } : null
        };
      });
      
      setMyRequests(enrichedData);
      setFilteredRequests(enrichedData);

      // Verificar histórico de aprovações para solicitações pendentes/draft
      checkApprovalHistoryForRequests(enrichedData);
      
      // Calcular stats
      const total = enrichedData.length;
      const pending = enrichedData.filter(s => s.status === 'pending').length;
      const approved = enrichedData.filter(s => s.status === 'approved').length;
      const rejected = enrichedData.filter(s => s.status === 'rejected').length;
      
      setStats({ total, pending, approved, rejected });
    } catch (error: any) {
      console.error('❌ Erro ao carregar minhas solicitações:', error);
      toast.error("Erro ao carregar solicitações: " + (error?.message || 'Erro desconhecido'));
      setMyRequests([]);
      setFilteredRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field: string, value: string) => {
    const newFilters = { ...filters, [field]: value };
    setFilters(newFilters);
    applyFilters(newFilters);
  };

  const applyFilters = (filterValues: typeof filters) => {
    let filtered = [...myRequests];

    if (filterValues.status !== "all") {
      filtered = filtered.filter(s => s.status === filterValues.status);
    }

    if (filterValues.search) {
      const searchLower = filterValues.search.toLowerCase();
      filtered = filtered.filter(s => 
        s.stations?.name?.toLowerCase().includes(searchLower) ||
        s.clients?.name?.toLowerCase().includes(searchLower) ||
        s.product?.toLowerCase().includes(searchLower)
      );
    }

    setFilteredRequests(filtered);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800"><Clock className="h-3 w-3 mr-1 text-yellow-600" />Pendente</Badge>;
      case 'approved':
        return <Badge variant="default" className="bg-green-100 text-green-800"><Check className="h-3 w-3 mr-1 text-green-600" />Aprovado</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><X className="h-3 w-3 mr-1 text-red-600" />Rejeitado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getProductName = (product: string) => {
    const names: { [key: string]: string } = {
      'gasolina_comum': 'Gasolina Comum',
      'gasolina_aditivada': 'Gasolina Aditivada',
      'etanol': 'Etanol',
      'diesel_comum': 'Diesel Comum',
      's10': 'Diesel S-10',
      'diesel_s500': 'Diesel S-500',
      'arla32_granel': 'ARLA 32 Granel'
    };
    return names[product] || product;
  };

  // Função helper para verificar se botões Editar/Excluir devem aparecer
  const shouldShowEditDeleteButtons = (request: any): boolean => {
    // Log inicial para garantir que função está sendo chamada
    console.log('🚀 shouldShowEditDeleteButtons CHAMADA:', {
      hasRequest: !!request,
      requestId: request?.id,
      requestStatus: request?.status
    });
    
    if (!request) {
      console.log('❌ shouldShowEditDeleteButtons: request é null/undefined');
      return false;
    }
    
    // Garantir que status existe - fallback para 'pending' se não houver
    const rawStatus = request.status || 'pending';
    const status = String(rawStatus).toLowerCase().trim();
    
    // Verificar se deve mostrar botões - incluir variações de 'in approval'
    // Normalizar removendo espaços e underscores para comparação
    const normalizedStatus = status.replace(/\s+/g, '_').replace(/_+/g, '_');
    
    const editableStatuses = [
      'draft', 
      'pending', 
      'in_approval', 
      'inapproval',
      'awaiting_approval',
      'awaitingapproval'
    ];
    
    // Verificar se status normalizado está na lista OU se contém "approval" e não é "approved"
    // IMPORTANTE: Qualquer status que contenha "approval" (exceto "approved") deve mostrar botões
    const containsApproval = normalizedStatus.includes('approval');
    const isApproved = normalizedStatus === 'approved';
    const isEditableStatus = editableStatuses.includes(normalizedStatus) || 
                            (containsApproval && !isApproved);
    
    const shouldShow = isEditableStatus || !rawStatus;
    
    // Log CRÍTICO - sempre executar
    if (shouldShow) {
      console.warn('✅ BOTÕES DEVEM APARECER!', {
        id: request.id,
        rawStatus,
        normalizedStatus,
        shouldShow,
        containsApproval,
        isApproved
      });
    }
    
    // Log detalhado para debug - sempre logar para ver o que está acontecendo
    console.log('🔍 shouldShowEditDeleteButtons DETALHADO:', {
      id: request.id,
      rawStatus: rawStatus,
      normalized: status,
      normalizedStatus: normalizedStatus,
      isPending: status === 'pending',
      isDraft: status === 'draft',
      isInApproval: normalizedStatus.includes('approval'),
      isEmpty: !rawStatus,
      shouldShow: shouldShow,
      requestStatus: request.status,
      editableStatuses: editableStatuses,
      matchesEditable: isEditableStatus,
      containsApproval: normalizedStatus.includes('approval'),
      isNotApproved: normalizedStatus !== 'approved'
    });
    
    // Mostrar botões se for status editável ou se status não existir
    return shouldShow;
  };

  const handleDelete = async (requestId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta solicitação? Esta ação não pode ser desfeita.')) {
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('price_suggestions')
        .delete()
        .eq('id', requestId);

      if (error) throw error;

      // Invalidar cache de outras páginas também
      localStorage.removeItem('approvals_suggestions_cache');
      localStorage.removeItem('approvals_suggestions_cache_timestamp');

      toast.success("Solicitação excluída com sucesso!");
      loadMyRequests(); // Recarregar lista
      
      // O listener de tempo real já vai atualizar automaticamente
      // Mas forçar uma atualização imediata também
      setTimeout(() => {
        loadMyRequests();
      }, 500);
    } catch (error: any) {
      console.error('Erro ao excluir solicitação:', error);
      toast.error("Erro ao excluir solicitação: " + (error?.message || 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  if (loading && myRequests.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-slate-300 border-t-slate-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Carregando suas solicitações...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 p-8 text-white shadow-2xl">
          <div className="absolute inset-0 bg-black/10"></div>
          <div className="relative flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div>
              <h1 className="text-4xl font-bold mb-3">Minhas Solicitações</h1>
              <p className="text-blue-100 text-lg">Acompanhe suas solicitações de preço</p>
            </div>
          </div>
        </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center">
                <MessageSquare className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Pendentes</p>
                <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.pending}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-blue-900 to-blue-900 flex items-center justify-center">
                <Clock className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Aprovadas</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.approved}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-blue-900 to-blue-900 flex items-center justify-center">
                <Check className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Rejeitadas</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.rejected}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-blue-900 to-blue-900 flex items-center justify-center">
                <X className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="shadow-xl border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                Status
              </label>
              <select 
                className="w-full px-3 py-2 border rounded-lg bg-background"
                value={filters.status} 
                onChange={(e) => handleFilterChange("status", e.target.value)}
              >
                <option value="all">Todos</option>
                <option value="pending">Pendente</option>
                <option value="approved">Aprovado</option>
                <option value="rejected">Rejeitado</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                Buscar
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por posto, cliente..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange("search", e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* My Requests List */}
      <Card className="shadow-xl border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>Minhas Solicitações ({filteredRequests.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {(() => {
              console.log('📋 RENDERIZANDO LISTA DE REQUESTS:', {
                totalRequests: filteredRequests.length,
                requests: filteredRequests.map(r => ({
                  id: r.id,
                  status: r.status,
                  station: r.stations?.name,
                  client: r.clients?.name
                }))
              });
              return null;
            })()}
            {filteredRequests.map((request) => {
              // Log para cada request sendo renderizado
              console.log('🔄 Renderizando request:', {
                id: request.id,
                status: request.status,
                hasStatus: !!request.status,
                statusType: typeof request.status,
                statusValue: request.status
              });
              
              return (
              <div key={request.id} className="p-4 bg-gradient-to-r from-white to-slate-50 dark:from-card dark:to-secondary rounded-xl border border-slate-200 dark:border-border hover:shadow-lg transition-all duration-300">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {request.stations?.name || (request.station_id ? `Posto (${String(request.station_id).substring(0, 8)}...)` : 'Posto não informado')} - {request.clients?.name || (request.client_id ? `Cliente (${String(request.client_id).substring(0, 8)}...)` : 'Cliente não informado')}
                      </span>
                      {getStatusBadge(request.status)}
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-700 dark:text-slate-300">Produto:</span> 
                        <span className="text-slate-600 dark:text-slate-400">{getProductName(request.product)}</span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-600 dark:text-slate-400">
                        <div>
                          <span className="font-medium">Preço Atual:</span> {request.current_price ? formatBrazilianCurrency(request.current_price) : 'N/A'}
                        </div>
                        <div>
                          <span className="font-medium">Preço Sugerido:</span> <span className="text-green-600 font-bold">{request.final_price ? formatBrazilianCurrency(request.final_price) : 'N/A'}</span>
                        </div>
                        <div>
                          <span className="font-medium">Criado:</span> {formatDate(request.created_at)}
                        </div>
                        <div>
                          <span className="font-medium">Código:</span> {request.stations?.code || '-'}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {/* FORÇAR BOTÕES A APARECEREM - REMOVER CONDIÇÕES TEMPORARIAMENTE */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        console.log('✏️ Clicou em Editar:', request.id);
                        setEditingRequest(request);
                        setShowEditModal(true);
                      }}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        console.log('🗑️ Clicou em Excluir:', request.id);
                        handleDelete(request.id);
                      }}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedSuggestion(request);
                        setShowDetails(true);
                      }}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Ver Detalhes
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            
            {filteredRequests.length === 0 && myRequests.length === 0 && (
              <div className="text-center py-8">
                <p className="text-slate-600 dark:text-slate-400">Nenhuma solicitação encontrada</p>
              </div>
            )}
            
            {filteredRequests.length === 0 && myRequests.length > 0 && (
              <div className="text-center py-8">
                <p className="text-slate-600 dark:text-slate-400">Nenhuma solicitação encontrada com os filtros aplicados</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Modal de Detalhes */}
      <ApprovalDetailsModal
        isOpen={showDetails}
        onClose={() => {
          setShowDetails(false);
          setSelectedSuggestion(null);
        }}
        suggestion={selectedSuggestion}
        onApprove={() => {}}
        onReject={() => {}}
        loading={false}
        readOnly={true}
      />

      {/* Modal de Edição */}
      <EditRequestModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingRequest(null);
        }}
        request={editingRequest}
        onSuccess={() => {
          loadMyRequests(); // Recarregar lista após edição
        }}
      />
      </div>
    </div>
  );
}

