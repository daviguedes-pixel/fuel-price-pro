// @ts-nocheck
import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
  Eye, 
  ChevronDown,
  ChevronRight,
  Loader2,
  RefreshCw,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight
} from "lucide-react";
import { ApprovalDetailsModal } from "@/components/ApprovalDetailsModal";
import { formatBrazilianCurrency } from "@/lib/utils";

export default function ApprovalsOptimized() {
  const { user } = useAuth();
  const { permissions } = usePermissions();
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState<any>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchApprovals, setBatchApprovals] = useState<any[]>([]);
  const [individualApprovals, setIndividualApprovals] = useState<any[]>([]);
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());
  
  // Paginação otimizada
  const [batchPage, setBatchPage] = useState(0);
  const [individualPage, setIndividualPage] = useState(0);
  const ITEMS_PER_PAGE = 5;
  
  // Memoizar cálculos pesados
  const paginatedBatches = useMemo(() => {
    const start = batchPage * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    return batchApprovals.slice(start, end);
  }, [batchApprovals, batchPage]);
  
  const paginatedIndividuals = useMemo(() => {
    const start = individualPage * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    return individualApprovals.slice(start, end);
  }, [individualApprovals, individualPage]);
  
  const totalBatchPages = Math.ceil(batchApprovals.length / ITEMS_PER_PAGE);
  const totalIndividualPages = Math.ceil(individualApprovals.length / ITEMS_PER_PAGE);

  // Carregar dados com cache
  const loadSuggestions = useCallback(async (useCache = true) => {
    try {
      setLoadingData(true);
      
      // Implementar cache simples
      const cacheKey = 'approvals_cache';
      const cacheTimestampKey = 'approvals_cache_timestamp';
      const CACHE_DURATION = 30000; // 30 segundos
      
      if (useCache) {
        const cachedData = localStorage.getItem(cacheKey);
        const cachedTimestamp = localStorage.getItem(cacheTimestampKey);
        
        if (cachedData && cachedTimestamp) {
          const age = Date.now() - parseInt(cachedTimestamp);
          if (age < CACHE_DURATION) {
            const parsed = JSON.parse(cachedData);
            setSuggestions(parsed);
            processSuggestions(parsed);
            setLoadingData(false);
            return;
          }
        }
      }
      
      // Buscar do banco
      const { data, error } = await supabase
        .from('price_suggestions')
        .select(`
          *,
          stations:station_id ( id, name, code ),
          clients:client_id ( id, name )
        `)
        .in('status', ['pending', 'approved', 'rejected', 'price_suggested'])
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Salvar no cache
      localStorage.setItem(cacheKey, JSON.stringify(data || []));
      localStorage.setItem(cacheTimestampKey, Date.now().toString());
      
      setSuggestions(data || []);
      processSuggestions(data || []);
    } catch (error: any) {
      console.error('Erro ao carregar aprovações:', error);
      toast.error('Erro ao carregar aprovações');
    } finally {
      setLoadingData(false);
    }
  }, []);

  // Processar sugestões de forma otimizada
  const processSuggestions = useCallback((data: any[]) => {
    const batches = new Map<string, any[]>();
    const individuals: any[] = [];
    
    data.forEach(s => {
      if (s.batch_id) {
        if (!batches.has(s.batch_id)) {
          batches.set(s.batch_id, []);
        }
        batches.get(s.batch_id)!.push(s);
      } else {
        individuals.push(s);
      }
    });
    
    // Converter batches em array
    const batchArray = Array.from(batches.entries()).map(([batchId, requests]) => ({
      batchId,
      batchName: requests[0]?.batch_name || `Lote ${batchId.slice(0, 8)}`,
      requests,
      totalRequests: requests.length,
      pendingCount: requests.filter(r => r.status === 'pending').length,
      status: requests.some(r => r.status === 'pending') ? 'pending' : 'completed'
    }));
    
    setBatchApprovals(batchArray);
    setIndividualApprovals(individuals);
  }, []);

  // Real-time com debounce
  useEffect(() => {
    loadSuggestions(true);
    
    let timeoutId: NodeJS.Timeout;
    const channel = supabase
      .channel('approvals_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'price_suggestions' }, () => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          localStorage.removeItem('approvals_cache');
          localStorage.removeItem('approvals_cache_timestamp');
          loadSuggestions(false);
        }, 1500);
      })
      .subscribe();
    
    return () => {
      clearTimeout(timeoutId);
      supabase.removeChannel(channel);
    };
  }, [loadSuggestions]);

  const formatPrice = (value: number) => {
    return formatBrazilianCurrency(value);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { label: 'Pendente', variant: 'secondary' as const },
      approved: { label: 'Aprovado', variant: 'default' as const },
      rejected: { label: 'Rejeitado', variant: 'destructive' as const },
      price_suggested: { label: 'Sugerido', variant: 'outline' as const }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (loadingData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Aprovações</h1>
          <p className="text-muted-foreground">Gerencie solicitações pendentes</p>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => {
            localStorage.removeItem('approvals_cache');
            localStorage.removeItem('approvals_cache_timestamp');
            loadSuggestions(false);
          }}
          disabled={isRefreshing}
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Aprovações em Lote */}
      {batchApprovals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Aprovações em Lote ({batchApprovals.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {paginatedBatches.map(batch => (
              <Card key={batch.batchId} className="border-l-4 border-l-primary">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const newExpanded = new Set(expandedBatches);
                          if (newExpanded.has(batch.batchId)) {
                            newExpanded.delete(batch.batchId);
                          } else {
                            newExpanded.add(batch.batchId);
                          }
                          setExpandedBatches(newExpanded);
                        }}
                      >
                        {expandedBatches.has(batch.batchId) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </Button>
                      <div>
                        <h3 className="font-semibold">{batch.batchName}</h3>
                        <p className="text-sm text-muted-foreground">
                          {batch.totalRequests} solicitações • {batch.pendingCount} pendentes
                        </p>
                      </div>
                    </div>
                    {getStatusBadge(batch.status)}
                  </div>
                </CardHeader>
                {expandedBatches.has(batch.batchId) && (
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      {batch.requests.map((req: any) => (
                        <div key={req.id} className="p-3 bg-muted rounded-lg flex items-center justify-between">
                          <div className="flex-1">
                            <p className="font-medium">{req.stations?.name || req.station_id}</p>
                            <p className="text-sm text-muted-foreground">
                              {formatPrice(req.final_price / 100)}
                            </p>
                          </div>
                          {getStatusBadge(req.status)}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
            
            {/* Paginação de Lotes */}
            {totalBatchPages > 1 && (
              <div className="flex items-center justify-between pt-4">
                <p className="text-sm text-muted-foreground">
                  Página {batchPage + 1} de {totalBatchPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setBatchPage(0)}
                    disabled={batchPage === 0}
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setBatchPage(p => p - 1)}
                    disabled={batchPage === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setBatchPage(p => p + 1)}
                    disabled={batchPage >= totalBatchPages - 1}
                  >
                    Próximo
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setBatchPage(totalBatchPages - 1)}
                    disabled={batchPage >= totalBatchPages - 1}
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Aprovações Individuais - SEM TABELA */}
      {individualApprovals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Aprovações Individuais ({individualApprovals.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {paginatedIndividuals.map((suggestion) => (
              <Card key={suggestion.id} className="border-l-4 border-l-blue-500">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-semibold">{suggestion.stations?.name || suggestion.station_id}</h3>
                      <p className="text-sm text-muted-foreground">{suggestion.clients?.name || suggestion.client_id}</p>
                    </div>
                    {getStatusBadge(suggestion.status)}
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 mb-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Preço Atual</p>
                      <p className="font-semibold">{formatPrice((suggestion.current_price || 0) / 100)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Preço Sugerido</p>
                      <p className="font-semibold text-green-600">{formatPrice((suggestion.final_price || 0) / 100)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Margem</p>
                      <p className="font-semibold">{formatPrice((suggestion.margin_cents || 0) / 100)}</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedSuggestion(suggestion);
                        setShowDetails(true);
                      }}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Detalhes
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {/* Paginação Individual */}
            {totalIndividualPages > 1 && (
              <div className="flex items-center justify-between pt-4">
                <p className="text-sm text-muted-foreground">
                  Página {individualPage + 1} de {totalIndividualPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIndividualPage(0)}
                    disabled={individualPage === 0}
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIndividualPage(p => p - 1)}
                    disabled={individualPage === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIndividualPage(p => p + 1)}
                    disabled={individualPage >= totalIndividualPages - 1}
                  >
                    Próximo
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIndividualPage(totalIndividualPages - 1)}
                    disabled={individualPage >= totalIndividualPages - 1}
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Modal de Detalhes */}
      {selectedSuggestion && (
        <ApprovalDetailsModal
          open={showDetails}
          onClose={() => {
            setShowDetails(false);
            setSelectedSuggestion(null);
          }}
          suggestion={selectedSuggestion}
          onAction={() => {
            localStorage.removeItem('approvals_cache');
            localStorage.removeItem('approvals_cache_timestamp');
            loadSuggestions(false);
          }}
        />
      )}
    </div>
  );
}
