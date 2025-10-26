import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, TrendingUp, TrendingDown, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useDatabase } from "@/hooks/useDatabase";
import { PriceHistoryFilters } from "@/components/PriceHistoryFilters";
import { SearchWithPreview } from "@/components/SearchWithPreview";
import { PriceTimeline } from "@/components/PriceTimeline";
import { PriceStats } from "@/components/PriceStats";
import { formatBrazilianCurrency } from "@/lib/utils";

export default function PriceHistory() {
  const { toast } = useToast();
  const { priceHistory, searchPriceHistory } = useDatabase();
  const [filteredHistory, setFilteredHistory] = useState<any[]>([]);

  useEffect(() => {
    setFilteredHistory(priceHistory);
  }, [priceHistory]);

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
      status: item.price_suggestions?.status || 'pending',
      approvedBy: item.approved_by,
      changeType: (item.old_price && item.new_price > item.old_price ? 'up' : 'down') as 'up' | 'down'
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