import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, TrendingUp, TrendingDown, Eye, Trophy, Users, UserPlus, CheckCircle2, ShoppingCart, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useDatabase } from "@/hooks/useDatabase";
import { PriceHistoryFilters } from "@/components/PriceHistoryFilters";
import { SearchWithPreview } from "@/components/SearchWithPreview";
import { PriceTimeline } from "@/components/PriceTimeline";
import { PriceStats } from "@/components/PriceStats";
import { formatBrazilianCurrency } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

export default function PriceHistory() {
  const { toast } = useToast();
  const { priceHistory, searchPriceHistory } = useDatabase();
  const [filteredHistory, setFilteredHistory] = useState<any[]>([]);
  const [topStats, setTopStats] = useState({
    topApprover: { name: '-', count: 0 },
    topClient: { name: '-', count: 0 },
    topRequester: { name: '-', count: 0 }
  });

  useEffect(() => {
    setFilteredHistory(priceHistory);
    loadTopStats();
  }, [priceHistory]);
  
  const loadTopStats = async () => {
    try {
      // Carregar aprovações para calcular top stats
      const { data: suggestions } = await supabase
        .from('price_suggestions')
        .select('*')
        .in('status', ['approved', 'rejected']);
      
      if (!suggestions) return;
      
      // Buscar histórico de aprovações
      const { data: approvalHistory } = await supabase
        .from('approval_history')
        .select('*');
      
      // Contar aprovações por usuário
      const approvalCounts: { [key: string]: number } = {};
      if (approvalHistory) {
        approvalHistory.forEach(item => {
          const key = item.approver_name || 'Desconhecido';
          approvalCounts[key] = (approvalCounts[key] || 0) + 1;
        });
      }
      
      // Buscar clientes para mapear IDs para nomes
      const { data: clients } = await supabase
        .from('clientes')
        .select('id_cliente, nome');
      
      // Contar por cliente usando nome
      const clientCounts: { [key: string]: number } = {};
      suggestions.forEach(suggestion => {
        const client = clients?.find(c => String(c.id_cliente) === String(suggestion.client_id));
        const clientName = client?.nome || suggestion.client_id || 'Sem cliente';
        clientCounts[clientName] = (clientCounts[clientName] || 0) + 1;
      });
      
      // Buscar usuários do perfil para mapear IDs para emails
      const { data: userProfiles } = await supabase
        .from('user_profiles')
        .select('user_id, email');
      
      // Contar por solicitante usando email
      const requesterCounts: { [key: string]: number } = {};
      suggestions.forEach(suggestion => {
        const user = userProfiles?.find(u => String(u.user_id) === String(suggestion.requested_by));
        const requesterName = user?.email || suggestion.requested_by || 'Desconhecido';
        requesterCounts[requesterName] = (requesterCounts[requesterName] || 0) + 1;
      });
      
      // Encontrar tops
      const topApprover = Object.entries(approvalCounts)
        .sort(([,a], [,b]) => b - a)[0] || ['-', 0];
      
      const topClient = Object.entries(clientCounts)
        .sort(([,a], [,b]) => b - a)[0] || ['-', 0];
      
      const topRequester = Object.entries(requesterCounts)
        .sort(([,a], [,b]) => b - a)[0] || ['-', 0];
      
      setTopStats({
        topApprover: { name: topApprover[0], count: topApprover[1] },
        topClient: { name: topClient[0], count: topClient[1] },
        topRequester: { name: topRequester[0], count: topRequester[1] }
      });
    } catch (error) {
      console.error('Erro ao carregar top stats:', error);
    }
  };

  // Calculate statistics
  const calculateStats = () => {
    const data = filteredHistory.length > 0 ? filteredHistory : priceHistory;
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const stats = {
      totalChanges: data.length,
      approvedChanges: data.filter((item: any) => item.price_suggestions?.status === 'approved').length,
      pendingChanges: data.filter((item: any) => item.price_suggestions?.status === 'pending').length,
      rejectedChanges: data.filter((item: any) => item.price_suggestions?.status === 'rejected').length,
      averageIncrease: 0,
      averageDecrease: 0,
      totalClients: new Set(data.map((item: any) => item.clients?.name).filter(Boolean)).size,
      totalStations: new Set(data.map((item: any) => item.stations?.name).filter(Boolean)).size,
      recentActivity: data.filter((item: any) => new Date(item.created_at) > sevenDaysAgo).length
    };

    // Calculate average changes
    const increases = data.filter((item: any) => item.old_price && item.new_price > item.old_price);
    const decreases = data.filter((item: any) => item.old_price && item.new_price < item.old_price);

    if (increases.length > 0) {
      stats.averageIncrease = increases.reduce((sum: number, item: any) => 
        sum + (item.new_price - item.old_price), 0) / increases.length;
    }

    if (decreases.length > 0) {
      stats.averageDecrease = decreases.reduce((sum: number, item: any) => 
        sum + (item.old_price - item.new_price), 0) / decreases.length;
    }

    return stats;
  };

  // Convert data to timeline format
  const convertToTimelineData = () => {
    const data = filteredHistory.length > 0 ? filteredHistory : priceHistory;
    
    return data.map((item: any) => ({
      id: item.id,
      date: item.created_at,
      client: item.clients?.name || 'Cliente',
      station: item.stations?.name || 'Posto',
      product: getProductName(item.product),
      oldPrice: item.old_price,
      newPrice: item.new_price,
      status: 'approved' as 'approved', // price_history só contém aprovações
      approvedBy: item.approved_by,
      changeType: (item.old_price && item.new_price && item.old_price > 0 
        ? (item.new_price > item.old_price ? 'up' : 'down') 
        : item.change_type || 'up') as 'up' | 'down'
    }));
  };

  const handleFilter = async (filters: any) => {
    console.log('Applying price history filters:', filters);
    
    try {
      const filtered = await searchPriceHistory(filters);
      setFilteredHistory(filtered);
      
      toast({
        title: "Filtros aplicados",
        description: `${filtered.length} registro(s) encontrado(s)`
      });
    } catch (error) {
      console.error('Error filtering price history:', error);
      toast({
        title: "Erro",
        description: "Erro ao aplicar filtros",
        variant: "destructive"
      });
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

  // Removed mock history: data comes from useDatabase().priceHistory

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-success/10 text-success">Aprovado</Badge>;
      case "rejected":
        return <Badge variant="destructive">Negado</Badge>;
      default:
        return <Badge variant="secondary">Pendente</Badge>;
    }
  };

  const getChangeIcon = (change: string) => {
    return change === "up" ? (
      <TrendingUp className="h-4 w-4 text-destructive" />
    ) : (
      <TrendingDown className="h-4 w-4 text-success" />
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-8 space-y-6">
      <div className="bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 rounded-xl p-6 text-white shadow-lg">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold">Histórico de Preços</h1>
            <p className="text-blue-100">Acompanhe todas as alterações de preços aprovadas</p>
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
          <SearchWithPreview 
            placeholder="Buscar no histórico..."
            onSelect={(item) => {
              toast({
                title: "Item encontrado",
                description: item.name
              });
            }}
          />
          <Button variant="outline" onClick={() => toast({ title: "Exportar", description: "Funcionalidade em desenvolvimento" })}>
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
          </div>
        </div>
      </div>

      <PriceHistoryFilters onFilter={handleFilter} />

      {/* Statistics */}
      <PriceStats stats={calculateStats()} />

      {/* Top Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-950/20 dark:to-yellow-900/20 border-yellow-200 dark:border-yellow-800">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-yellow-500/10 dark:bg-yellow-500/20 rounded-full">
                <CheckCircle2 className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Top Aprovador</p>
                <p className="text-xl font-bold text-slate-900 dark:text-slate-100 truncate">
                  {topStats.topApprover.name}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-500">
                  {topStats.topApprover.count} aprovações
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/20 dark:to-green-900/20 border-green-200 dark:border-green-800">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-500/10 dark:bg-green-500/20 rounded-full">
                <ShoppingCart className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Top Cliente</p>
                <p className="text-xl font-bold text-slate-900 dark:text-slate-100 truncate">
                  {topStats.topClient.name}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-500">
                  {topStats.topClient.count} solicitações
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/20 dark:to-blue-900/20 border-blue-200 dark:border-blue-800">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/10 dark:bg-blue-500/20 rounded-full">
                <User className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Top Solicitante</p>
                <p className="text-xl font-bold text-slate-900 dark:text-slate-100 truncate">
                  {topStats.topRequester.name}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-500">
                  {topStats.topRequester.count} solicitações
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Linha do Tempo de Alterações</CardTitle>
        </CardHeader>
        <CardContent>
          <PriceTimeline items={convertToTimelineData()} />
        </CardContent>
      </Card>
      </div>
    </div>
  );
}