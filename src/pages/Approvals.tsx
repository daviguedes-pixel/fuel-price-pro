import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { supabase } from "@/integrations/supabase/client";
import { 
  Check, 
  X, 
  Clock, 
  Filter, 
  Search, 
  Eye, 
  ChevronDown,
  MessageSquare,
  Download,
  Trash2
} from "lucide-react";
import { ApprovalDetailsModal } from "@/components/ApprovalDetailsModal";
import { formatBrazilianCurrency } from "@/lib/utils";

export default function Approvals() {
  const { user } = useAuth();
  const { permissions } = usePermissions();
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [filteredSuggestions, setFilteredSuggestions] = useState<any[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState<any>(null);
  const [showDetails, setShowDetails] = useState(false);
  
  const [filters, setFilters] = useState({
    status: "all",
    station: "all",
    client: "all",
    search: ""
  });

  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0
  });

  // Load suggestions when component mounts
  useEffect(() => {
    loadSuggestions();
  }, []);

  const loadSuggestions = async () => {
    try {
      console.log('=== CARREGANDO SUGESTÕES ===');
      
      // Carregar sugestões sem JOINs (os IDs agora são TEXT)
      const { data, error } = await supabase
        .from('price_suggestions')
        .select('*')
        .order('created_at', { ascending: false });

      console.log('Dados carregados:', data);
      console.log('Erro:', error);

      if (error) {
        console.error('Erro na consulta:', error);
        throw error;
      }

      // Carregar postos, clientes e métodos de pagamento separadamente
      const [stationsRes, clientsRes, paymentMethodsRes] = await Promise.all([
        supabase.rpc('get_sis_empresa_stations').then(res => ({ data: res.data, error: res.error })),
        supabase.from('clients').select('id, name'),
        supabase.from('payment_methods').select('*')
      ]);

      // Enriquecer dados localmente
      const enrichedData = (data || []).map((suggestion: any) => {
        const station = (stationsRes.data as any)?.find((s: any) => 
          s.id === suggestion.station_id || String(s.id) === String(suggestion.station_id)
        );
        const client = (clientsRes.data as any)?.find((c: any) => 
          String(c.id) === String(suggestion.client_id)
        );
        const paymentMethod = paymentMethodsRes.data?.find((pm: any) => 
          pm.id === suggestion.payment_method_id
        );

        return {
          ...suggestion,
          stations: station ? { name: station.name, code: station.id } : null,
          clients: client ? { name: client.name, code: String(client.id) } : null,
          payment_methods: paymentMethod ? { name: paymentMethod.name } : null
        };
      });
      
      setSuggestions(enrichedData);
      setFilteredSuggestions(enrichedData);
      
      // Calculate stats
      const total = enrichedData.length;
      const pending = enrichedData.filter(s => s.status === 'pending').length;
      const approved = enrichedData.filter(s => s.status === 'approved').length;
      const rejected = enrichedData.filter(s => s.status === 'rejected').length;
      
      console.log('Stats calculadas:', { total, pending, approved, rejected });
      setStats({ total, pending, approved, rejected });
    } catch (error) {
      console.error('Erro ao carregar sugestões:', error);
      toast.error("Erro ao carregar sugestões: " + (error as Error).message);
    }
  };

  const handleFilterChange = (field: string, value: string) => {
    const newFilters = { ...filters, [field]: value };
    setFilters(newFilters);
    applyFilters(newFilters);
  };

  const applyFilters = (filterValues: typeof filters) => {
    let filtered = suggestions;

    if (filterValues.status !== "all") {
      filtered = filtered.filter(s => s.status === filterValues.status);
    }

    if (filterValues.station !== "all") {
      filtered = filtered.filter(s => s.station_id === filterValues.station);
    }

    if (filterValues.client !== "all") {
      filtered = filtered.filter(s => s.client_id === filterValues.client);
    }

    if (filterValues.search) {
      const searchLower = filterValues.search.toLowerCase();
      filtered = filtered.filter(s => 
        s.stations?.name?.toLowerCase().includes(searchLower) ||
        s.clients?.name?.toLowerCase().includes(searchLower) ||
        s.product?.toLowerCase().includes(searchLower)
      );
    }

    setFilteredSuggestions(filtered);
  };

  const handleApprove = async (suggestionId: string, observations: string) => {
    if (!observations.trim()) {
      toast.error("Por favor, adicione uma observação");
      return;
    }

    setLoading(true);
    try {
      // Buscar a sugestão atual
      const { data: currentSuggestion, error: fetchError } = await supabase
        .from('price_suggestions')
        .select('*')
        .eq('id', suggestionId)
        .single();

      if (fetchError) throw fetchError;

      const currentLevel = currentSuggestion.approval_level || 1;
      const totalApprovers = currentSuggestion.total_approvers || 3;
      const approvalsCount = (currentSuggestion.approvals_count || 0) + 1;
      
      // Registrar no histórico
      const { error: historyError } = await supabase
        .from('approval_history')
        .insert({
          suggestion_id: suggestionId,
          approver_id: user?.id,
          approver_name: user?.email || 'Aprovador',
          action: 'approved',
          observations: observations,
          approval_level: currentLevel
        });

      if (historyError) throw historyError;

      // Se pelo menos um aprovador aprovar, a solicitação é aprovada
      const newStatus = approvalsCount >= 1 ? 'approved' : 'pending';
      const nextLevel = currentLevel < totalApprovers ? currentLevel + 1 : totalApprovers;

      // Atualizar a sugestão
      const { error: updateError } = await supabase
        .from('price_suggestions')
        .update({
          status: newStatus,
          approval_level: newStatus === 'approved' ? totalApprovers : nextLevel,
          approvals_count: approvalsCount,
          approved_at: newStatus === 'approved' ? new Date().toISOString() : null,
          approved_by: newStatus === 'approved' ? user?.id : null
        })
        .eq('id', suggestionId);

      if (updateError) throw updateError;

      toast.success(newStatus === 'approved' ? "Sugestão aprovada com sucesso!" : "Aprovação registrada, aguardando outros aprovadores");
      setShowDetails(false);
      setSelectedSuggestion(null);
      loadSuggestions();
    } catch (error) {
      console.error('Erro ao aprovar sugestão:', error);
      toast.error("Erro ao aprovar sugestão");
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (suggestionId: string, observations: string) => {
    if (!observations.trim()) {
      toast.error("Por favor, adicione uma observação");
      return;
    }

    setLoading(true);
    try {
      // Buscar a sugestão atual
      const { data: currentSuggestion, error: fetchError } = await supabase
        .from('price_suggestions')
        .select('*')
        .eq('id', suggestionId)
        .single();

      if (fetchError) throw fetchError;

      const currentLevel = currentSuggestion.approval_level || 1;
      const totalApprovers = currentSuggestion.total_approvers || 3;
      const rejectionsCount = (currentSuggestion.rejections_count || 0) + 1;
      
      // Registrar no histórico
      const { error: historyError } = await supabase
        .from('approval_history')
        .insert({
          suggestion_id: suggestionId,
          approver_id: user?.id,
          approver_name: user?.email || 'Aprovador',
          action: 'rejected',
          observations: observations,
          approval_level: currentLevel
        });

      if (historyError) throw historyError;

      // Mesmo que um rejeite, continua para o próximo aprovador
      const nextLevel = currentLevel < totalApprovers ? currentLevel + 1 : totalApprovers;
      
      // Apenas rejeita definitivamente se todos rejeitarem
      const newStatus = rejectionsCount >= totalApprovers ? 'rejected' : 'pending';

      // Atualizar a sugestão
      const { error: updateError } = await supabase
        .from('price_suggestions')
        .update({
          status: newStatus,
          approval_level: newStatus === 'rejected' ? totalApprovers : nextLevel,
          rejections_count: rejectionsCount,
          approved_at: newStatus === 'rejected' ? new Date().toISOString() : null,
          approved_by: newStatus === 'rejected' ? user?.id : null
        })
        .eq('id', suggestionId);

      if (updateError) throw updateError;

      toast.success(newStatus === 'rejected' ? "Sugestão rejeitada" : "Rejeição registrada, passando para próximo aprovador");
      setShowDetails(false);
      setSelectedSuggestion(null);
      loadSuggestions();
    } catch (error) {
      console.error('Erro ao rejeitar sugestão:', error);
      toast.error("Erro ao rejeitar sugestão");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (suggestionId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta aprovação? Esta ação não pode ser desfeita e será registrada no log de auditoria.')) {
      return;
    }

    setLoading(true);
    try {
      // Deletar diretamente (função RPC não existe)
      const { error } = await supabase
        .from('price_suggestions')
        .delete()
        .eq('id', suggestionId);

      if (error) throw error;

      if (error) throw error;

      toast.success("Aprovação excluída com sucesso!");
      loadSuggestions();
    } catch (error) {
      console.error('Erro ao excluir aprovação:', error);
      toast.error("Erro ao excluir aprovação: " + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    return formatBrazilianCurrency(price);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
      case 'approved':
        return <Badge variant="default" className="bg-green-100 text-green-800"><Check className="h-3 w-3 mr-1" />Aprovado</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><X className="h-3 w-3 mr-1" />Rejeitado</Badge>;
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Header moderno */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 p-8 text-white shadow-2xl">
          <div className="absolute inset-0 bg-black/10"></div>
          <div className="relative flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div>
              <h1 className="text-4xl font-bold mb-3">Aprovações de Preço</h1>
              <p className="text-blue-100 text-lg">Gerencie as solicitações de aprovação de preços</p>
            </div>
            <div className="flex gap-3">
              <Button 
                className="bg-white/20 hover:bg-white/30 text-slate-300 border-white/30 backdrop-blur-sm h-12 px-6 rounded-xl font-semibold"
                onClick={() => window.location.reload()}
              >
                <Filter className="h-5 w-5 mr-2 text-slate-300" />
                Atualizar
              </Button>
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
                <p className="text-2xl font-bold text-slate-800 dark:text-slate-200">{stats.total}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-slate-600 to-slate-700 flex items-center justify-center">
                <MessageSquare className="h-6 w-6" style={{ color: '#94a3b8' }} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Pendentes</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-yellow-500 to-yellow-600 flex items-center justify-center">
                <Clock className="h-6 w-6" style={{ color: '#94a3b8' }} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Aprovadas</p>
                <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-green-500 to-green-600 flex items-center justify-center">
                <Check className="h-6 w-6" style={{ color: '#94a3b8' }} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Rejeitadas</p>
                <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-red-500 to-red-600 flex items-center justify-center">
                <X className="h-6 w-6" style={{ color: '#94a3b8' }} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="shadow-xl border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-slate-600 dark:text-slate-400" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                Status
              </label>
              <Select value={filters.status} onValueChange={(value) => handleFilterChange("status", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="approved">Aprovado</SelectItem>
                  <SelectItem value="rejected">Rejeitado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                Buscar
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
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

      {/* Suggestions List */}
      <Card className="shadow-xl border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>Sugestões de Preço ({filteredSuggestions.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredSuggestions.map((suggestion) => (
              <div key={suggestion.id} className="p-4 bg-gradient-to-r from-white to-slate-50 dark:from-slate-800 dark:to-slate-700 rounded-xl border border-slate-200 dark:border-slate-600 hover:shadow-lg transition-all duration-300">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {suggestion.stations?.name || 'Posto não encontrado'} - {suggestion.clients?.name || 'Cliente não encontrado'}
                      </span>
                      {getStatusBadge(suggestion.status)}
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-700 dark:text-slate-300">Produto:</span> 
                        <span className="text-slate-600 dark:text-slate-400">{getProductName(suggestion.product)}</span>
                      </div>
                      
                      {/* Análise de Preço */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600">
                        <div>
                          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Preço Atual</p>
                          <p className="text-lg font-bold text-slate-800 dark:text-slate-200">
                            {suggestion.cost_price ? formatPrice(suggestion.cost_price) : 'N/A'}
                          </p>
                        </div>
                        
                        <div>
                          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Preço Sugerido</p>
                          <p className="text-lg font-bold text-green-600 dark:text-green-400">
                            {formatPrice(suggestion.final_price)}
                          </p>
                        </div>
                        
                        <div>
                          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Margem</p>
                          <p className={`text-lg font-bold ${
                            suggestion.margin_cents > 0 
                              ? 'text-green-600 dark:text-green-400' 
                              : 'text-red-600 dark:text-red-400'
                          }`}>
                            {suggestion.margin_cents ? (
                              <>
                                {suggestion.margin_cents > 0 ? '+' : ''}
                                {formatPrice(suggestion.margin_cents / 100)}
                                {' '}
                                ({suggestion.cost_price ? ((suggestion.margin_cents / 100) / suggestion.cost_price * 100).toFixed(2) : '0'}%)
                              </>
                            ) : 'N/A'}
                          </p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm text-slate-600 dark:text-slate-400">
                        <div>
                          <span className="font-medium">Criado:</span> {formatDate(suggestion.created_at)}
                        </div>
                        <div>
                          <span className="font-medium">Código:</span> {suggestion.stations?.code}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedSuggestion(suggestion);
                        setShowDetails(true);
                      }}
                    >
                      <Eye className="h-4 w-4 mr-2 text-slate-600 dark:text-slate-400" />
                      Ver Detalhes
                    </Button>
                    
                    {permissions?.permissions?.can_approve && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(suggestion.id)}
                        disabled={loading}
                        className="text-red-600 border-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4 mr-2 text-red-600" />
                        Excluir
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            
            {filteredSuggestions.length === 0 && (
              <div className="text-center py-8">
                <p className="text-slate-600 dark:text-slate-400">Nenhuma sugestão encontrada</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      </div>

    {/* Modal de Detalhes da Aprovação */}
    <ApprovalDetailsModal
      isOpen={showDetails}
      onClose={() => {
        setShowDetails(false);
        setSelectedSuggestion(null);
      }}
      suggestion={selectedSuggestion}
      onApprove={(observations) => handleApprove(selectedSuggestion?.id, observations)}
      onReject={(observations) => handleReject(selectedSuggestion?.id, observations)}
      loading={loading}
    />
    </div>
  );
}