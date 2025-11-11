// @ts-nocheck
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  ChevronRight,
  MessageSquare,
  Download,
  Trash2,
  DollarSign,
  Loader2,
  RefreshCw
} from "lucide-react";
import { ApprovalDetailsModal } from "@/components/ApprovalDetailsModal";
import { formatBrazilianCurrency, parseBrazilianDecimal } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function Approvals() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { permissions } = usePermissions();
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connecting');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [filteredSuggestions, setFilteredSuggestions] = useState<any[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState<any>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchApprovals, setBatchApprovals] = useState<any[]>([]);
  const [individualApprovals, setIndividualApprovals] = useState<any[]>([]);
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());
  const [batchObservations, setBatchObservations] = useState<Record<string, string>>({});
  const [batchSuggestedPrices, setBatchSuggestedPrices] = useState<Record<string, string>>({});
  const [showPriceModal, setShowPriceModal] = useState<Record<string, boolean>>({});
  const [showObservationModal, setShowObservationModal] = useState<Record<string, { open: boolean; action: 'approve' | 'reject' | 'suggest' }>>({});
  const [showBatchApproveModal, setShowBatchApproveModal] = useState<Record<string, boolean>>({});
  const [batchApproveObservation, setBatchApproveObservation] = useState<Record<string, string>>({});
  
  // Paginação para melhorar performance
  const [batchPage, setBatchPage] = useState(0);
  const [individualPage, setIndividualPage] = useState(0);
  const ITEMS_PER_PAGE = 5; // Limitar a 5 itens por página para máxima performance
  
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

  // Load suggestions when component mounts (com cache)
  useEffect(() => {
    loadSuggestions(true); // Usar cache por padrão
  }, []);
  
  // Tempo real para atualizar quando houver mudanças
  useEffect(() => {
    if (!user) return;
    
    // Debounce para evitar múltiplas chamadas simultâneas
    let reloadTimeout: NodeJS.Timeout | null = null;
    const debouncedReload = (delay = 1000) => {
      if (reloadTimeout) {
        clearTimeout(reloadTimeout);
      }
      reloadTimeout = setTimeout(() => {
        console.log('🔄 Recarregando aprovações após mudança detectada...');
        localStorage.removeItem('approvals_suggestions_cache');
        localStorage.removeItem('approvals_suggestions_cache_timestamp');
        loadSuggestions(false).then(() => {
          setIsRefreshing(false);
        }).catch(err => {
          console.error('Erro ao recarregar após mudança:', err);
          setIsRefreshing(false);
        });
      }, delay);
    };
    
    const channel = supabase
      .channel('approvals_realtime', {
        config: {
          broadcast: { self: true }
        }
      })
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'price_suggestions'
        },
        (payload) => {
          console.log('🔄 Mudança detectada em price_suggestions:', payload.eventType, {
            id: payload.new?.id || payload.old?.id,
            status: payload.new?.status || payload.old?.status,
            batch_id: payload.new?.batch_id || payload.old?.batch_id
          });
          setIsRefreshing(true);
          // Invalidar cache imediatamente e recarregar após delay maior para garantir que a transação completou
          debouncedReload(1500); // Aumentado para 1.5s para garantir que a transação completou
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'approval_profile_order'
        },
        (payload) => {
          console.log('🔄 Mudança detectada em approval_profile_order:', payload.eventType);
          // Invalidar cache de aprovadores quando ordem mudar
          localStorage.removeItem('approvals_approvers_cache');
          localStorage.removeItem('approvals_approvers_cache_timestamp');
          debouncedReload(1000);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('🔔 Nova notificação recebida:', payload.new);
          debouncedReload(1000);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('🔔 Notificação atualizada:', payload.new);
          debouncedReload(1000);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'approval_history'
        },
        (payload) => {
          console.log('🔄 Mudança detectada em approval_history:', payload.eventType, {
            suggestion_id: payload.new?.suggestion_id || payload.old?.suggestion_id,
            approval_level: payload.new?.approval_level || payload.old?.approval_level
          });
          // Invalidar cache quando houver mudança no histórico
          debouncedReload(1500); // Delay maior para approval_history pois pode ter múltiplas atualizações
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Canal de real-time subscrito com sucesso');
          setRealtimeStatus('connected');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Erro ao subscrever canal de real-time');
          setRealtimeStatus('disconnected');
        } else if (status === 'TIMED_OUT' || status === 'CLOSED') {
          console.warn('⚠️ Canal de real-time desconectado:', status);
          setRealtimeStatus('disconnected');
        } else {
          console.log('⏳ Status do canal:', status);
          if (status === 'JOINING' || status === 'JOINED') {
            setRealtimeStatus('connecting');
          }
        }
      });
    
    return () => {
      if (reloadTimeout) {
        clearTimeout(reloadTimeout);
      }
      supabase.removeChannel(channel);
      console.log('🔌 Canal de real-time desconectado');
    };
  }, [user]);

  // Verificar se o usuário pode aprovar uma solicitação baseado na margem
  const canUserApproveSuggestion = async (suggestion: any): Promise<{ canApprove: boolean; reason?: string }> => {
    try {
      // Buscar regra de aprovação baseada na margem
      const marginCents = suggestion.margin_cents || 0;
      const approvalRule = await getApprovalRuleForMargin(marginCents);
      
      // Determinar perfis requeridos baseado na regra
      const requiredProfiles = approvalRule?.required_profiles || undefined;
      
      // Buscar todos os aprovadores
      const allApprovers = await loadApprovers();
      
      // Verificar se o usuário atual é um aprovador válido
      const currentUserProfile = allApprovers.find(a => a.user_id === user?.id);
      if (!currentUserProfile) {
        return { canApprove: false, reason: "Você não possui permissão para aprovar solicitações." };
      }
      
      // Não bloquear usuários sem perfil requerido - eles podem adicionar observação e avançar
      // A aprovação de fato só acontecerá quando alguém com perfil requerido aprovar
      // Esta verificação foi removida para permitir que usuários sem permissão possam adicionar observação
      
      // Verificar se o usuário é o próximo aprovador na sequência
      const currentLevel = suggestion.approval_level || 1;
      const approverIndex = currentLevel - 1;
      const currentApprover = allApprovers[approverIndex];
      
      if (!currentApprover || currentApprover.user_id !== user?.id) {
        return { 
          canApprove: false, 
          reason: "Você não é o próximo aprovador nesta sequência." 
        };
      }
      
      return { canApprove: true };
    } catch (error: any) {
      console.error('Erro ao verificar permissão de aprovação:', error);
      return { canApprove: false, reason: `Erro ao verificar permissão: ${error?.message || 'Erro desconhecido'}` };
    }
  };

  // Buscar regra de aprovação baseada na margem
  const getApprovalRuleForMargin = async (marginCents: number) => {
    try {
      const { data, error } = await supabase.rpc('get_approval_margin_rule', {
        margin_cents: marginCents
      });

      if (error) {
        console.error('Erro ao buscar regra de aprovação:', error);
        return null;
      }

      return data && data.length > 0 ? data[0] : null;
    } catch (error) {
      console.error('Erro ao buscar regra de aprovação:', error);
      return null;
    }
  };

  // Buscar todos os usuários que podem aprovar em ordem hierárquica
  const loadApprovers = async (requiredProfiles?: string[], retryCount = 0) => {
    const MAX_RETRIES = 2;
    const RETRY_DELAY = 1000; // 1 segundo

    try {
      // Buscar ordem hierárquica de aprovação do banco de dados
      const { data: orderData, error: orderError } = await supabase
        .from('approval_profile_order')
        .select('perfil, order_position')
        .eq('is_active', true)
        .order('order_position', { ascending: true });

      // Se houver erro de rede, tentar novamente
      if (orderError) {
        if ((orderError.message?.includes('Failed to fetch') || orderError.message?.includes('NetworkError')) && retryCount < MAX_RETRIES) {
          console.log(`Tentativa ${retryCount + 1} de ${MAX_RETRIES} ao carregar ordem de aprovação...`);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (retryCount + 1)));
          return loadApprovers(requiredProfiles, retryCount + 1);
        }
        // Se não for erro de rede ou já tentou todas as vezes, usar ordem padrão
        console.warn('Erro ao carregar ordem de aprovação, usando ordem padrão:', orderError);
      }

      // Se não houver ordem configurada, usar ordem padrão
      let approvalOrder: string[] = [
        'supervisor_comercial',
        'diretor_comercial', 
        'diretor_pricing'
      ];

      if (!orderError && orderData && orderData.length > 0) {
        approvalOrder = orderData.map((item: any) => item.perfil);
      }
      
      // Se requiredProfiles foi especificado, usar apenas esses perfis
      const profilesToLoad = requiredProfiles && requiredProfiles.length > 0
        ? requiredProfiles.filter(p => approvalOrder.includes(p))
        : approvalOrder;
      
      // Buscar perfis que podem aprovar
      const { data: profilesWithPermission, error: profilesError } = await supabase
        .from('profile_permissions')
        .select('perfil')
        .eq('can_approve', true);
      
      if (profilesError) {
        console.error('Erro ao buscar perfis com permissão:', profilesError);
        return [];
      }
      
      const perfisComPermissao = profilesWithPermission?.map(p => p.perfil) || [];
      
      if (perfisComPermissao.length === 0) {
        console.log('⚠️ Nenhum perfil tem permissão de aprovar');
        return [];
      }
      
      console.log('📋 Perfis que podem aprovar:', perfisComPermissao);
      console.log('🔍 Perfis requeridos:', requiredProfiles || 'todos');
      
      // Ordenar perfis pela ordem hierárquica (filtrando apenas os que estão em profilesToLoad)
      const orderedProfiles = profilesToLoad.filter(p => perfisComPermissao.includes(p));
      
      // Buscar usuários com esses perfis, mantendo a ordem
      const approvers: any[] = [];
      
      for (const perfil of orderedProfiles) {
      const { data: users, error: usersError } = await supabase
        .from('user_profiles')
        .select('user_id, email, perfil')
          .eq('perfil', perfil)
        .order('email');
      
      if (usersError) {
          console.error(`Erro ao buscar usuários do perfil ${perfil}:`, usersError);
          continue;
      }
      
        if (users && users.length > 0) {
          approvers.push(...users);
        }
      }
      
      console.log('👥 Usuários que podem aprovar (em ordem):', approvers);
      
      return approvers;
    } catch (error) {
      console.error('Erro ao carregar aprovadores:', error);
      return [];
    }
  };

  const processSuggestionsData = async (enrichedWithCurrentApprover: any[]) => {
    // Otimização: Processar em chunks para não bloquear a UI
    // Usar requestIdleCallback ou setTimeout para processar em background
    const processInChunks = () => {
      return new Promise<void>((resolve) => {
        setTimeout(() => {
    const canViewAll = permissions?.permissions?.admin || false;
          
          // Processar tudo em um único loop otimizado
          const filteredForUser: any[] = [];
          const groupedBatches = new Map<string, any[]>();
          const filteredIdsSet = new Set<string>();
          let pending = 0;
          let approved = 0;
          let rejected = 0;
          
          // Loop único para filtrar, agrupar e contar stats
          for (const s of enrichedWithCurrentApprover) {
            // Contar stats
            if (s.status === 'pending') pending++;
            else if (s.status === 'approved') approved++;
            else if (s.status === 'rejected') rejected++;
            
            // Filtrar para usuário
            let shouldShow = false;
            if (canViewAll) {
              shouldShow = true;
            } else {
          if (s.status === 'price_suggested' || s.status === 'approved' || s.status === 'rejected') {
                shouldShow = true;
              } else if (s.status === 'pending') {
                // Mostrar se for o turno do usuário OU se o usuário já aprovou (para acompanhar)
                shouldShow = s.is_current_user_turn || s.user_already_approved;
              }
            }
            
            if (shouldShow) {
              filteredForUser.push(s);
              filteredIdsSet.add(s.id);
            }
            
            // Agrupar por batch_id
            const batchKey = s.batch_id || `individual_${s.id}`;
        if (!groupedBatches.has(batchKey)) {
          groupedBatches.set(batchKey, []);
        }
            groupedBatches.get(batchKey)!.push(s);
          }
          
          // Processar batches em um único loop
    const batches: any[] = [];
    const individuals: any[] = [];
    
          for (const [batchKey, batch] of groupedBatches) {
      if (batchKey.startsWith('individual_')) {
              // Individual - adicionar se estiver filtrado
              for (const req of batch) {
                if (filteredIdsSet.has(req.id)) {
            individuals.push(req);
          }
              }
      } else {
              // Batch - verificar se tem solicitações visíveis ou pendentes
              let visibleCount = 0;
              let pendingCount = 0;
              const visibleRequests: any[] = [];
              const pendingRequests: any[] = [];
              
              // Calcular clientes únicos de forma otimizada (em um único loop)
              const clientIds = new Set<string>();
              let firstClient: any = null;
              
              for (const req of batch) {
                // Coletar clientes únicos
                const cid = req.client_id || req.clients?.id || 'unknown';
                if (!clientIds.has(cid)) {
                  clientIds.add(cid);
                  if (!firstClient) firstClient = req.clients || { name: 'N/A' };
                }
                
                // Verificar status e visibilidade
          if (req.status === 'pending') {
                  pendingCount++;
                  pendingRequests.push(req);
                  // Mostrar se for o turno do usuário OU se o usuário já aprovou (para acompanhar)
                  if (req.is_current_user_turn || req.user_already_approved) {
                    visibleCount++;
                    visibleRequests.push(req);
                  }
                } else if (req.status === 'price_suggested' || req.status === 'approved' || req.status === 'rejected') {
                  visibleCount++;
                  visibleRequests.push(req);
                }
              }
              
              if (visibleCount > 0 || pendingCount > 0) {
                // Usar visíveis ou pendentes (já coletados)
                const requestsToShow = visibleRequests.length > 0 ? visibleRequests : pendingRequests;
          
          batches.push({
            batchKey,
                  requests: requestsToShow,
                  allRequests: batch,
                  client: firstClient,
                  clients: clientIds.size > 1 
                    ? (() => {
                        const clientsList: any[] = [];
                        const added = new Set<string>();
                        for (const req of batch) {
                          const cid = req.client_id || req.clients?.id || 'unknown';
                          if (!added.has(cid) && clientsList.length < 3) {
                            clientsList.push(req.clients || { name: 'N/A' });
                            added.add(cid);
                          }
                        }
                        return clientsList;
                      })()
                    : [firstClient],
                  hasMultipleClients: clientIds.size > 1,
            created_at: batch[0].created_at,
            created_by: batch[0].created_by || batch[0].requested_by
          });
        } else {
                // Adicionar às individuais se filtrado
                for (const req of batch) {
                  if (filteredIdsSet.has(req.id)) {
              individuals.push(req);
            }
                }
              }
            }
          }
          
          // Adicionar não-pendentes às individuais
          for (const s of filteredForUser) {
            if (s.status !== 'pending') {
              individuals.push(s);
            }
          }
          
          // Atualizar estados de uma vez
          setSuggestions(enrichedWithCurrentApprover);
          setFilteredSuggestions(filteredForUser);
    setBatchApprovals(batches);
    setIndividualApprovals(individuals);
          setStats({ 
            total: enrichedWithCurrentApprover.length, 
            pending, 
            approved, 
            rejected 
          });
          
          // Resetar páginas quando dados mudarem
          setBatchPage(0);
          setIndividualPage(0);
          
          resolve();
        }, 0);
      });
    };
    
    await processInChunks();
  };

  const loadSuggestions = async (useCache = true) => {
    try {
      // Verificar cache primeiro
      if (useCache) {
        const cacheKey = 'approvals_suggestions_cache';
        const cacheTimestampKey = 'approvals_suggestions_cache_timestamp';
        const cachedData = localStorage.getItem(cacheKey);
        const cacheTimestamp = localStorage.getItem(cacheTimestampKey);
        const cacheExpiry = 5 * 60 * 1000; // 5 minutos
        
        if (cachedData && cacheTimestamp) {
          const now = Date.now();
          const timestamp = parseInt(cacheTimestamp, 10);
          
          if (now - timestamp < cacheExpiry) {
            console.log('📦 Usando dados do cache');
            const parsedData = JSON.parse(cachedData);
            // Processar dados do cache (já estão enriquecidos)
            if (Array.isArray(parsedData) && parsedData.length > 0) {
              await processSuggestionsData(parsedData);
              setLoadingData(false);
              return;
            }
          }
        }
      }
      
      setLoadingData(true);
      
      // Carregar sugestões sem JOINs (os IDs agora são TEXT)
      // Limitar a 200 registros para performance máxima
      const { data, error } = await supabase
        .from('price_suggestions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      // Log mínimo para performance
      
      // Verificar quantas têm batch_id (sem log detalhado para performance)
      const withBatchId = data?.filter((s: any) => s.batch_id) || [];

      if (error) {
        console.error('Erro na consulta:', error);
        throw error;
      }

      // Cachear postos e clientes (mudam raramente)
      const stationsCacheKey = 'approvals_stations_cache';
      const clientsCacheKey = 'approvals_clients_cache';
      const cacheExpiry = 30 * 60 * 1000; // 30 minutos
      
      let stationsRes: any = { data: null };
      let clientsRes: any = { data: null };
      
      // Tentar carregar do cache
      try {
        const cachedStations = localStorage.getItem(stationsCacheKey);
        const cachedClients = localStorage.getItem(clientsCacheKey);
        const stationsTimestamp = localStorage.getItem(stationsCacheKey + '_ts');
        const clientsTimestamp = localStorage.getItem(clientsCacheKey + '_ts');
        
        if (cachedStations && stationsTimestamp) {
          const now = Date.now();
          const timestamp = parseInt(stationsTimestamp, 10);
          if (now - timestamp < cacheExpiry) {
            stationsRes = { data: JSON.parse(cachedStations) };
          }
        }
        
        if (cachedClients && clientsTimestamp) {
          const now = Date.now();
          const timestamp = parseInt(clientsTimestamp, 10);
          if (now - timestamp < cacheExpiry) {
            clientsRes = { data: JSON.parse(cachedClients) };
          }
        }
      } catch {}
      
      // Carregar apenas se não estiver em cache
      const loadPromises: Promise<any>[] = [];
      
      if (!stationsRes.data) {
        loadPromises.push(
          supabase.rpc('get_sis_empresa_stations').then(res => {
            stationsRes = { data: res.data, error: res.error };
            try {
              localStorage.setItem(stationsCacheKey, JSON.stringify(res.data));
              localStorage.setItem(stationsCacheKey + '_ts', Date.now().toString());
            } catch {}
            return stationsRes;
          })
        );
      }
      
      if (!clientsRes.data) {
        loadPromises.push(
          supabase.from('clientes' as any).select('id_cliente, nome').then(res => {
            clientsRes = res;
            try {
              localStorage.setItem(clientsCacheKey, JSON.stringify(res.data));
              localStorage.setItem(clientsCacheKey + '_ts', Date.now().toString());
            } catch {}
            return clientsRes;
          })
        );
      }
      
      // Carregar métodos de pagamento (são poucos, não precisa cache)
      loadPromises.push(
        supabase.from('tipos_pagamento' as any).select('CARTAO, TAXA, PRAZO, ID_POSTO').then(res => ({ data: res.data, error: res.error }))
      );
      
      const results = await Promise.all(loadPromises);
      const paymentMethodsRes = results[results.length - 1];

      // Buscar informações dos usuários que enviaram as solicitações
      const uniqueRequestedBy = [...new Set((data || []).map((s: any) => s.requested_by).filter(Boolean))];
      let requestersData: any[] = [];
      if (uniqueRequestedBy.length > 0) {
        // Tentar buscar por user_id primeiro
        const { data: byUserId } = await supabase
          .from('user_profiles' as any)
          .select('user_id, email, nome')
          .in('user_id', uniqueRequestedBy);
        
        if (byUserId) {
          requestersData = byUserId;
        }
        
        // Se não encontrou todos, tentar buscar por email (caso requested_by seja email)
        const foundIds = new Set(requestersData.map((u: any) => u.user_id || u.email));
        const missingIds = uniqueRequestedBy.filter(id => !foundIds.has(id));
        
        if (missingIds.length > 0) {
          const { data: byEmail } = await supabase
            .from('user_profiles' as any)
            .select('user_id, email, nome')
            .in('email', missingIds);
          
          if (byEmail) {
            requestersData = [...requestersData, ...byEmail];
          }
        }
      }

      // Criar mapas para lookup rápido (O(1) ao invés de O(n))
      const stationsMap = new Map();
      (stationsRes.data as any)?.forEach((s: any) => {
        const id = String(s.id || s.id_empresa || s.cnpj_cpf || '');
        stationsMap.set(id, s);
        if (s.cnpj_cpf) stationsMap.set(s.cnpj_cpf, s);
        if (s.id_empresa) stationsMap.set(String(s.id_empresa), s);
      });
      
      const clientsMap = new Map();
      (clientsRes.data as any)?.forEach((c: any) => {
        const id = String(c.id_cliente || c.id || '');
        clientsMap.set(id, c);
      });
      
      const requestersMap = new Map();
      (requestersData || [])?.forEach((u: any) => {
        requestersMap.set(u.user_id, u);
        if (u.email) requestersMap.set(u.email, u);
      });
      
      // Enriquecer dados localmente (sem logs excessivos)
      const enrichedData = (data || []).map((suggestion: any) => {
        // Buscar posto usando mapa (O(1))
        const station = suggestion.station_id ? stationsMap.get(String(suggestion.station_id)) : null;
        
        // Buscar cliente usando mapa (O(1))
        const client = suggestion.client_id ? clientsMap.get(String(suggestion.client_id)) : null;
        
        // Buscar quem enviou a solicitação
        const requester = suggestion.requested_by 
          ? (requestersMap.get(suggestion.requested_by))
          : null;
        
        // Buscar tipo de pagamento
        const paymentMethod = paymentMethodsRes.data?.find((pm: any) => 
          pm.CARTAO === suggestion.payment_method_id ||
          String(pm.ID_POSTO) === String(suggestion.payment_method_id)
        );
        
        return {
          ...suggestion,
          stations: station ? { name: station.nome_empresa || station.name, code: station.cnpj_cpf || station.id || station.id_empresa } : null,
          clients: client ? { name: client.nome || client.name, code: String(client.id_cliente || client.id) } : null,
          requester: requester ? { 
            id: requester.user_id, 
            email: requester.email, 
            name: requester.nome || requester.email 
          } : { 
            id: suggestion.requested_by, 
            email: suggestion.requested_by, 
            name: suggestion.requested_by || 'N/A' 
          },
          payment_methods: paymentMethod ? { 
            name: paymentMethod.CARTAO,
            TAXA: paymentMethod.TAXA,
            PRAZO: paymentMethod.PRAZO
          } : null
        };
      });
      
      // SEMPRE buscar aprovadores do banco para garantir ordem atualizada
      // Não usar cache para evitar problemas quando ordem de aprovação mudar
      const allApprovers = await loadApprovers();
      
      // Buscar histórico de aprovações apenas para solicitações pendentes (otimização)
      // Coletar IDs pendentes durante o enriquecimento para evitar loop extra
      const pendingIds: string[] = [];
      for (const s of enrichedData) {
        if (s.status === 'pending') pendingIds.push(s.id);
      }
      
      let userApprovedIds = new Set<string>();
      
      if (pendingIds.length > 0 && user?.id) {
        // Limitar a 200 para performance máxima
        const { data: approvalHistory } = await supabase
        .from('approval_history')
          .select('suggestion_id')
          .eq('approver_id', user.id)
          .eq('action', 'approved')
          .in('suggestion_id', pendingIds.slice(0, 200));
        
        if (approvalHistory) {
          for (const h of approvalHistory) {
            userApprovedIds.add(h.suggestion_id);
          }
        }
      }
      
      // Não buscar regras de aprovação - não são necessárias para exibição inicial
      // Serão buscadas apenas quando necessário (ao aprovar)
      const approvalRulesMap = new Map();
      
      // Enriquecer com informação de qual usuário está com a aprovação (sem queries adicionais)
      const enrichedWithCurrentApprover = enrichedData.map((suggestion) => {
        // Verificar se o usuário já aprovou esta solicitação
        const userAlreadyApproved = userApprovedIds.has(suggestion.id);
        
        if (suggestion.status !== 'pending') {
          return {
            ...suggestion,
            user_already_approved: userAlreadyApproved,
          };
        }
        
        // Se o usuário já aprovou e o status ainda é pending, manter informações do aprovador atual
        // para que o usuário possa acompanhar o processo
        const currentLevel = suggestion.approval_level || 1;
        
        if (userAlreadyApproved) {
          const approverIndex = currentLevel - 1;
          const currentApprover = allApprovers[approverIndex];
          
          return {
            ...suggestion,
            current_approver_name: currentApprover?.email || null,
            current_approver_id: currentApprover?.user_id || null,
            is_current_user_turn: currentApprover?.user_id === user?.id || false,
            user_already_approved: true,
          };
        }
        
        // SEMPRE usar allApprovers para determinar o aprovador atual baseado no approval_level
        const approverIndex = currentLevel - 1;
        const currentApprover = allApprovers[approverIndex];
        
        return {
          ...suggestion,
          current_approver_name: currentApprover?.email || null,
          current_approver_id: currentApprover?.user_id || null,
          is_current_user_turn: currentApprover?.user_id === user?.id || false,
          user_already_approved: false,
        };
      });
      
      // Filtrar para mostrar aprovações pendentes que estão no turno do usuário atual
      // OU aprovações que o usuário já aprovou (para acompanhar o processo)
      // OU se o usuário tem permissão de admin, mostrar todas
      const canViewAll = permissions?.permissions?.admin || false;
      const filteredForUser = canViewAll 
        ? enrichedWithCurrentApprover 
        : enrichedWithCurrentApprover.filter(s => {
            // Mostrar sempre: preço sugerido, aprovado, rejeitado
            if (s.status === 'price_suggested' || s.status === 'approved' || s.status === 'rejected') {
              return true;
            }
            // Para pending: mostrar se for o turno do usuário OU se o usuário já aprovou (para acompanhar)
            if (s.status === 'pending') {
              return s.is_current_user_turn || s.user_already_approved;
            }
            return false;
          });
      
      // Processar dados finais (isso atualiza todos os estados: suggestions, filteredSuggestions, batches, individuals, stats)
      await processSuggestionsData(enrichedWithCurrentApprover);
      
      // Salvar no cache
      const cacheKey = 'approvals_suggestions_cache';
      const cacheTimestampKey = 'approvals_suggestions_cache_timestamp';
      try {
        localStorage.setItem(cacheKey, JSON.stringify(enrichedWithCurrentApprover));
        localStorage.setItem(cacheTimestampKey, Date.now().toString());
      } catch (cacheError) {
        console.warn('Erro ao salvar cache:', cacheError);
      }
    } catch (error) {
      console.error('Erro ao carregar sugestões:', error);
      toast.error("Erro ao carregar sugestões: " + (error as Error).message);
    } finally {
      setLoadingData(false);
    }
  };

  const handleFilterChange = (field: string, value: string) => {
    const newFilters = { ...filters, [field]: value };
    setFilters(newFilters);
    // Resetar páginas quando filtros mudarem
    setBatchPage(0);
    setIndividualPage(0);
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
    console.log('🔵 handleApprove chamado para:', suggestionId);
    
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


      // Buscar regra de aprovação baseada na margem
      const marginCents = currentSuggestion.margin_cents || 0;
      const approvalRule = await getApprovalRuleForMargin(marginCents);
      
      console.log('💰 Margem em centavos:', marginCents);
      console.log('📋 Regra de aprovação encontrada:', approvalRule);
      
      // Determinar perfis requeridos baseado na regra
      const requiredProfiles = approvalRule?.required_profiles || undefined;
      
      // Buscar todos os aprovadores
      const allApprovers = await loadApprovers();
      
      // Verificar se o usuário atual é um aprovador válido
      const currentUserProfile = allApprovers.find(a => a.user_id === user?.id);
      if (!currentUserProfile) {
        toast.error("Você não possui permissão para aprovar solicitações.");
        setLoading(false);
        return;
      }
      
      // Verificar se o usuário atual tem um dos perfis requeridos (para aprovação final)
      const userHasRequiredProfile = requiredProfiles && requiredProfiles.length > 0
        ? requiredProfiles.includes(currentUserProfile.perfil)
        : true; // Se não há regra específica, qualquer aprovador pode finalizar
      
      // Filtrar aprovadores com perfis requeridos (para verificar quando finalizar)
      const requiredApprovers = requiredProfiles && requiredProfiles.length > 0
        ? await loadApprovers(requiredProfiles)
        : allApprovers;
      
      // Usar todos os aprovadores para a sequência de aprovação
      const approvers = allApprovers;
      const totalApprovers = approvers.length > 0 ? approvers.length : 1;
      
      console.log('📝 IDs dos aprovadores:', approvers.map(a => ({ id: a.user_id, email: a.email, perfil: a.perfil })));
      
      // Obter o nível atual de aprovação
      let currentLevel = currentSuggestion.approval_level || 1;
      
      console.log('🔍 Approval level atual:', currentLevel);
      console.log('👤 Usuário atual:', user?.email);
      console.log('👤 Perfil do usuário:', currentUserProfile.perfil);
      console.log('📋 Perfis requeridos:', requiredProfiles);
      console.log('✅ Usuário tem perfil requerido:', userHasRequiredProfile);
      
      const approvalsCount = (currentSuggestion.approvals_count || 0) + 1;
      
      // Verificar se o usuário atual é o próximo aprovador na sequência
      const approverIndex = currentLevel - 1;
      const currentApprover = approvers[approverIndex];
      
      if (!currentApprover || currentApprover.user_id !== user?.id) {
        toast.error("Você não é o próximo aprovador nesta sequência");
        setLoading(false);
        return;
      }
      
      // Buscar nome do usuário do perfil
      let approverName = user?.email || 'Aprovador';
      try {
        const { data: userProfile } = await supabase
          .from('user_profiles')
          .select('nome, email')
          .eq('user_id', user?.id)
          .single();
        if (userProfile?.nome) {
          approverName = userProfile.nome;
        } else if (userProfile?.email) {
          approverName = userProfile.email;
        }
      } catch (err) {
        console.warn('Erro ao buscar nome do usuário:', err);
      }
      
      // Registrar no histórico
      const { error: historyError } = await supabase
        .from('approval_history')
        .insert({
          suggestion_id: suggestionId,
          approver_id: user?.id,
          approver_name: approverName,
          action: 'approved',
          observations: observations,
          approval_level: currentLevel
        });

      if (historyError) throw historyError;

      // Determinar próximo nível e status final
      // Lógica modificada: se usuário não tem perfil requerido, apenas avança para o próximo com permissão
      // Apenas aprova de fato quando alguém com perfil requerido aprovar
      let newStatus: string;
      let finalLevel: number;
      
      // Se há regra de margem com perfis requeridos, verificar se o usuário tem permissão para aprovar
      if (requiredProfiles && requiredProfiles.length > 0 && !userHasRequiredProfile) {
        // Usuário NÃO tem perfil requerido - apenas avançar para o próximo com perfil requerido
        // Encontrar próximo aprovador com perfil requerido
        const nextRequiredApproverIndex = approvers.findIndex((a, idx) => 
          idx > approverIndex && requiredProfiles.includes(a.perfil)
        );
        
        if (nextRequiredApproverIndex >= 0) {
          // Há próximo aprovador com perfil requerido - passar para ele
          newStatus = 'pending';
          finalLevel = nextRequiredApproverIndex + 1;
        } else {
          // Não há mais aprovadores com perfil requerido - procurar próximo aprovador qualquer
          const nextApproverIndex = approvers.findIndex((a, idx) => idx > approverIndex);
      if (nextApproverIndex >= 0) {
            // Há próximo aprovador - passar para ele (mesmo sem perfil requerido)
        newStatus = 'pending';
        finalLevel = nextApproverIndex + 1;
          } else {
            // Não há mais aprovadores - manter como pending (não aprovar sem permissão)
            newStatus = 'pending';
            finalLevel = currentLevel;
          }
        }
      } else {
        // Usuário TEM perfil requerido OU não há regra específica - pode aprovar normalmente
        // Encontrar próximo aprovador na sequência
        const nextApproverIndex = approvers.findIndex((a, idx) => idx > approverIndex);
        
        if (nextApproverIndex >= 0) {
          // Há próximo aprovador - verificar se precisa passar para ele ou aprovar
        if (requiredProfiles && requiredProfiles.length > 0) {
            // Há regra de margem - verificar se o próximo tem perfil requerido
          const nextApprover = approvers[nextApproverIndex];
          const nextHasRequiredProfile = requiredProfiles.includes(nextApprover.perfil);
          
            if (nextHasRequiredProfile) {
              // Próximo tem perfil requerido - passar para ele
              newStatus = 'pending';
              finalLevel = nextApproverIndex + 1;
            } else {
            // Próximo não tem perfil requerido - procurar próximo com perfil requerido
            const nextRequiredApproverIndex = approvers.findIndex((a, idx) => 
              idx > approverIndex && requiredProfiles.includes(a.perfil)
            );
            
            if (nextRequiredApproverIndex >= 0) {
                // Há próximo com perfil requerido - passar para ele
                newStatus = 'pending';
              finalLevel = nextRequiredApproverIndex + 1;
            } else {
                // Não há mais aprovadores com perfil requerido - aprovar (usuário tem perfil requerido)
                newStatus = 'approved';
                finalLevel = currentLevel;
              }
            }
              } else {
            // Não há regra específica - passar para o próximo
            newStatus = 'pending';
                finalLevel = nextApproverIndex + 1;
        }
      } else {
        // Não há mais aprovadores na sequência
        // Se usuário tem perfil requerido ou não há regra específica, aprovar completamente
        if (userHasRequiredProfile || !requiredProfiles || requiredProfiles.length === 0) {
          newStatus = 'approved';
          finalLevel = currentLevel;
        } else {
            // Não deveria chegar aqui, mas por segurança manter como pending
            newStatus = 'pending';
          finalLevel = currentLevel;
          }
        }
      }

      // Atualizar a sugestão
      const updateData: any = {
        status: newStatus,
        approval_level: finalLevel,
        approvals_count: approvalsCount,
      };
      
      // Atualizar total_approvers com o número dinâmico
      updateData.total_approvers = totalApprovers;
      
      if (newStatus === 'approved') {
        updateData.approved_at = new Date().toISOString();
        updateData.approved_by = user?.id;
      } else {
        // Se não for aprovado completamente, criar notificação para o próximo aprovador
        const nextApprover = approvers[finalLevel - 1];
        if (nextApprover) {
          // Criar notificação para o próximo aprovador
          try {
            await supabase.from('notifications').insert({
              user_id: nextApprover.user_id,
              suggestion_id: suggestionId,
              type: 'pending',
              title: 'Nova Aprovação Pendente',
              message: `Uma solicitação de preço aguarda sua aprovação (nível ${finalLevel})`
            });
          } catch (notifErr) {
            console.error('Erro ao criar notificação:', notifErr);
          }
        }
      }
      
      // Atualizar com retry
      let updateError: any = null;
      let retries = 3;
      
      while (retries > 0) {
        try {
        const { error } = await supabase
          .from('price_suggestions')
          .update(updateData)
          .eq('id', suggestionId);
        
        if (!error) {
          break;
        }
        updateError = error;
        retries--;
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (err: any) {
          console.warn('Erro ao atualizar, tentando novamente...', err.message);
          updateError = err;
          retries--;
          if (retries > 0) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }

      if (updateError) throw updateError;

      console.log('✅ Aprovação concluída, criando notificação...');

      // Criar notificação manualmente
      try {
        console.log('📧 Criando notificação para:', currentSuggestion.requested_by);
        console.log('📧 Sugestão status:', currentSuggestion.status);
        
        const notificationData = {
          user_id: currentSuggestion.requested_by,
          suggestion_id: suggestionId,
          type: newStatus,
          title: newStatus === 'approved' ? 'Preço Aprovado' : 'Preço Rejeitado',
          message: newStatus === 'approved' ? 'Sua solicitação de preço foi aprovada!' : 'Sua solicitação de preço foi rejeitada.'
        };
        
        console.log('📧 Dados da notificação:', notificationData);
        
        const { data: notifData, error: notifError } = await supabase
          .from('notifications')
          .insert([notificationData])
          .select();
        
        if (notifError) {
          console.error('❌ Erro ao criar notificação:', notifError);
        } else {
          console.log('✅ Notificação criada com sucesso:', notifData);
        }
      } catch (notifError) {
        console.error('❌ Erro ao criar notificação:', notifError);
        // Não bloquear a aprovação se a notificação falhar
      }

      if (newStatus === 'approved') {
        toast.success("Sugestão aprovada com sucesso!");
      } else {
        if (userHasRequiredProfile) {
          toast.success("Aprovação registrada! Aguardando próximo aprovador.");
        } else {
          toast.success(`Aprovação registrada! Aguardando aprovação de perfil requerido (nível ${finalLevel})`);
        }
      }
      
      // Fechar modal e limpar seleção
      setShowDetails(false);
      setSelectedSuggestion(null);
      
      // Invalidar cache imediatamente
      localStorage.removeItem('approvals_suggestions_cache');
      localStorage.removeItem('approvals_suggestions_cache_timestamp');
      
      // Recarregar imediatamente sem cache
      await loadSuggestions(false);
      
      // Recarregar novamente após um delay para garantir que todas as mudanças foram aplicadas
      setTimeout(() => {
        loadSuggestions(false);
      }, 1000);
    } catch (error: any) {
      console.error('Erro ao aprovar sugestão:', error);
      
      // Tratar erro de conexão
      if (error?.message?.includes('Failed to fetch') || error?.message?.includes('ERR_CONNECTION')) {
        toast.error("Erro de conexão. Tente novamente em alguns instantes.");
      } else if (error?.code === 'PGRST301' || error?.message?.includes('Time out')) {
        toast.error("O servidor demorou para responder. Tente novamente.");
      } else {
        toast.error(`Erro ao aprovar sugestão: ${error?.message || 'Erro desconhecido'}`);
      }
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

      // Buscar regra de aprovação baseada na margem
      const marginCents = currentSuggestion.margin_cents || 0;
      const approvalRule = await getApprovalRuleForMargin(marginCents);
      
      // Determinar perfis requeridos baseado na regra
      const requiredProfiles = approvalRule?.required_profiles || undefined;
      
      // Buscar aprovadores apropriados baseado na regra
      const allApprovers = await loadApprovers();
      let approvers: any[] = [];
      let totalApprovers = 1;
      
      if (requiredProfiles && requiredProfiles.length > 0) {
        approvers = await loadApprovers(requiredProfiles);
        
        // Verificar se o usuário atual tem um dos perfis requeridos
        const currentUserProfile = allApprovers.find(a => a.user_id === user?.id);
        if (!currentUserProfile || !requiredProfiles.includes(currentUserProfile.perfil)) {
          const profilesList = requiredProfiles.map(p => p.replace('_', ' ')).join(', ');
          toast.error(`Esta solicitação requer aprovação de perfis específicos: ${profilesList}. Você não possui permissão para rejeitar.`);
          setLoading(false);
          return;
        }
        
        totalApprovers = approvers.length > 0 ? approvers.length : 1;
      } else {
        approvers = allApprovers;
        totalApprovers = approvers.length > 0 ? approvers.length : 1;
      }
      
      // Ajustar approval_level inicial se necessário
      let currentLevel = currentSuggestion.approval_level || 1;
      
      if (approvalRule && requiredProfiles && currentLevel === 1) {
        const firstRequiredProfileIndex = allApprovers.findIndex(a => requiredProfiles.includes(a.perfil));
        if (firstRequiredProfileIndex >= 0) {
          currentLevel = firstRequiredProfileIndex + 1;
          await supabase
            .from('price_suggestions')
            .update({ approval_level: currentLevel })
            .eq('id', suggestionId);
        }
      }
      
      // Ajustar índice do aprovador baseado na regra
      let approverIndex: number;
      if (approvalRule && requiredProfiles) {
        const currentApproverInFullList = allApprovers[currentLevel - 1];
        if (currentApproverInFullList && requiredProfiles.includes(currentApproverInFullList.perfil)) {
          approverIndex = approvers.findIndex(a => a.user_id === currentApproverInFullList.user_id);
        } else {
          approverIndex = 0;
        }
      } else {
        approverIndex = currentLevel - 1;
      }
      
      // Verificar se o usuário atual é o próximo aprovador na sequência
      const currentApprover = approvers[approverIndex];
      if (!currentApprover || currentApprover.user_id !== user?.id) {
        toast.error("Você não é o próximo aprovador nesta sequência");
        setLoading(false);
        return;
      }
      
      const rejectionsCount = (currentSuggestion.rejections_count || 0) + 1;
      
      // Buscar nome do usuário do perfil
      let approverName = user?.email || 'Aprovador';
      try {
        const { data: userProfile } = await supabase
          .from('user_profiles')
          .select('nome, email')
          .eq('user_id', user?.id)
          .single();
        if (userProfile?.nome) {
          approverName = userProfile.nome;
        } else if (userProfile?.email) {
          approverName = userProfile.email;
        }
      } catch (err) {
        console.warn('Erro ao buscar nome do usuário:', err);
      }
      
      // Registrar no histórico
      const { error: historyError } = await supabase
        .from('approval_history')
        .insert({
          suggestion_id: suggestionId,
          approver_id: user?.id,
          approver_name: approverName,
          action: 'rejected',
          observations: observations,
          approval_level: currentLevel
        });

      if (historyError) throw historyError;

      // Se rejeitar, continua para o próximo aprovador (se houver)
      let nextLevel: number;
      if (approvalRule && requiredProfiles) {
        const currentApproverIndex = approverIndex;
        const nextApproverInFiltered = approvers[currentApproverIndex + 1];
        if (nextApproverInFiltered) {
          const nextApproverInFullList = allApprovers.findIndex(a => a.user_id === nextApproverInFiltered.user_id);
          nextLevel = nextApproverInFullList >= 0 ? nextApproverInFullList + 1 : currentLevel + 1;
        } else {
          nextLevel = currentLevel;
        }
      } else {
        nextLevel = currentLevel < totalApprovers ? currentLevel + 1 : totalApprovers;
      }
      
      // Permanece pendente quando rejeitar (não rejeita definitivamente)
      const newStatus = 'pending';

      // Atualizar a sugestão com nextLevel para passar para o próximo aprovador
      // Com retry
      let updateError: any = null;
      let retries = 3;
      
      while (retries > 0) {
        try {
          const { error } = await supabase
        .from('price_suggestions')
        .update({
          status: newStatus,
          approval_level: nextLevel,
          rejections_count: rejectionsCount,
        })
        .eq('id', suggestionId);

          if (!error) {
            break;
          }
          updateError = error;
          retries--;
          if (retries > 0) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (err: any) {
          console.warn('Erro ao atualizar, tentando novamente...', err.message);
          updateError = err;
          retries--;
          if (retries > 0) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }

      if (updateError) throw updateError;

      // Criar notificação manualmente
      try {
        console.log('📧 Criando notificação de rejeição para:', currentSuggestion.requested_by);
        
        const notificationData = {
          user_id: currentSuggestion.requested_by,
          suggestion_id: suggestionId,
          type: newStatus === 'pending' ? 'rejected' : newStatus,
          title: 'Preço Rejeitado',
          message: 'Sua solicitação de preço foi rejeitada.'
        };
        
        console.log('📧 Dados da notificação:', notificationData);
        
        const { data: notifData, error: notifError } = await supabase
          .from('notifications')
          .insert([notificationData])
          .select();
        
        if (notifError) {
          console.error('❌ Erro ao criar notificação:', notifError);
        } else {
          console.log('✅ Notificação criada com sucesso:', notifData);
        }
      } catch (notifError) {
        console.error('❌ Erro ao criar notificação:', notifError);
        // Não bloquear a rejeição se a notificação falhar
      }

      toast.success("Rejeição registrada, passando para próximo aprovador");
      
      // Fechar modal e limpar seleção
      setShowDetails(false);
      setSelectedSuggestion(null);
      
      // Invalidar cache imediatamente
      localStorage.removeItem('approvals_suggestions_cache');
      localStorage.removeItem('approvals_suggestions_cache_timestamp');
      
      // Recarregar imediatamente sem cache
      await loadSuggestions(false);
      
      // Recarregar novamente após um delay para garantir que todas as mudanças foram aplicadas
      setTimeout(() => {
        loadSuggestions(false);
      }, 1000);
    } catch (error: any) {
      console.error('Erro ao rejeitar sugestão:', error);
      
      // Tratar erro de conexão
      if (error?.message?.includes('Failed to fetch') || error?.message?.includes('ERR_CONNECTION')) {
        toast.error("Erro de conexão. Tente novamente em alguns instantes.");
      } else if (error?.code === 'PGRST301' || error?.message?.includes('Time out')) {
        toast.error("O servidor demorou para responder. Tente novamente.");
      } else {
        toast.error(`Erro ao rejeitar sugestão: ${error?.message || 'Erro desconhecido'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestPrice = async (suggestionId: string, observations: string, suggestedPrice: number) => {
    console.log('🔵 handleSuggestPrice chamado para:', suggestionId);
    
    // Observação é opcional ao sugerir preço
    // if (!observations.trim()) {
    //   toast.error("Por favor, adicione uma observação");
    //   return;
    // }
    
    if (!suggestedPrice || suggestedPrice <= 0) {
      toast.error("Por favor, informe um preço válido");
      return;
    }
    
    setLoading(true);
    try {
      const priceInCents = Math.round(suggestedPrice * 100);
      
      // Atualizar preço e status
      const { error: updateError } = await supabase
        .from('price_suggestions')
        .update({ 
          final_price: priceInCents,
          suggested_price: priceInCents,
          status: 'price_suggested'
        })
        .eq('id', suggestionId);
      
      if (updateError) throw updateError;
      
      // Buscar a sugestão para obter o approval_level
      const { data: currentSuggestion } = await supabase
        .from('price_suggestions')
        .select('approval_level, requested_by, product')
        .eq('id', suggestionId)
        .single();
      
      // Buscar nome do usuário do perfil
      let approverName = user?.email || 'Aprovador';
      try {
        const { data: userProfile } = await supabase
          .from('user_profiles')
          .select('nome, email')
          .eq('user_id', user?.id)
          .single();
        if (userProfile?.nome) {
          approverName = userProfile.nome;
        } else if (userProfile?.email) {
          approverName = userProfile.email;
        }
      } catch (err) {
        console.warn('Erro ao buscar nome do usuário:', err);
      }
      
      // Registrar no histórico
      await supabase
        .from('approval_history')
        .insert({
          suggestion_id: suggestionId,
          approver_id: user?.id,
          approver_name: approverName,
          action: 'price_suggested',
          observations: observations,
          approval_level: currentSuggestion?.approval_level || 1
        });
      
      // Criar notificação para o solicitante
      try {
        const productName = currentSuggestion?.product || 'produto';
        await supabase.from('notifications').insert({
          user_id: currentSuggestion?.requested_by,
          suggestion_id: suggestionId,
          type: 'pending',
          title: 'Preço Sugerido',
          message: `Um preço foi sugerido para sua solicitação de ${productName}`
        });
      } catch (notifError) {
        console.error('Erro ao criar notificação:', notifError);
      }
      
      toast.success("Preço sugerido com sucesso!");
      
      // Fechar modal e limpar seleção
      setShowDetails(false);
      setSelectedSuggestion(null);
      
      // Invalidar cache imediatamente
      localStorage.removeItem('approvals_suggestions_cache');
      localStorage.removeItem('approvals_suggestions_cache_timestamp');
      
      // Recarregar imediatamente sem cache
      await loadSuggestions(false);
      
      // Recarregar novamente após um delay para garantir que todas as mudanças foram aplicadas
      setTimeout(() => {
        loadSuggestions(false);
      }, 1000);
    } catch (error: any) {
      console.error('Erro ao sugerir preço:', error);
      toast.error(`Erro ao sugerir preço: ${error?.message || 'Erro desconhecido'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleBatchApprove = async () => {
    const pendingIds = selectedIds.size > 0 
      ? Array.from(selectedIds)
      : filteredSuggestions.filter(s => s.status === 'pending').map(s => s.id);
    
    if (pendingIds.length === 0) {
      toast.error("Nenhuma solicitação pendente para aprovar");
      return;
    }

    const observations = prompt("Digite uma observação para todas as aprovações:");
    if (!observations || !observations.trim()) {
      toast.error("Observação é obrigatória");
      return;
    }

    setLoading(true);
    try {
      // Buscar todas as solicitações primeiro para validar
      const { data: suggestions, error: fetchError } = await supabase
        .from('price_suggestions')
        .select('*')
        .in('id', pendingIds);
      
      if (fetchError) throw fetchError;
      
      // Validar cada solicitação antes de aprovar
      const validSuggestions: any[] = [];
      const invalidSuggestions: Array<{ id: string; reason: string }> = [];
      
      for (const suggestion of suggestions || []) {
        const validation = await canUserApproveSuggestion(suggestion);
        if (validation.canApprove) {
          validSuggestions.push(suggestion);
        } else {
          invalidSuggestions.push({ id: suggestion.id, reason: validation.reason || 'Não autorizado' });
        }
      }
      
      // Mostrar aviso se houver solicitações que não podem ser aprovadas
      if (invalidSuggestions.length > 0) {
        const invalidIds = invalidSuggestions.map(s => s.id).join(', ');
        const reasons = invalidSuggestions.map(s => s.reason).join('; ');
        toast.warning(`${invalidSuggestions.length} solicitação(ões) não podem ser aprovadas: ${reasons}. Aprovando apenas as válidas...`);
      }
      
      // Aprovar apenas as válidas
      let successCount = 0;
      let errorCount = 0;

      for (const suggestion of validSuggestions) {
        try {
          await handleApprove(suggestion.id, observations);
          successCount++;
        } catch (error) {
          console.error(`Erro ao aprovar ${suggestion.id}:`, error);
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount} solicitação(ões) aprovada(s) com sucesso!`);
      }
      if (errorCount > 0) {
        toast.error(`${errorCount} solicitação(ões) falharam ao aprovar`);
      }
      
      if (validSuggestions.length === 0) {
        toast.error("Nenhuma solicitação pode ser aprovada com base nas regras de margem.");
      }

      setSelectedIds(new Set());
      loadSuggestions();
    } catch (error: any) {
      toast.error("Erro ao aprovar em lote: " + (error?.message || 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  const handleBatchReject = async () => {
    const pendingIds = selectedIds.size > 0 
      ? Array.from(selectedIds)
      : filteredSuggestions.filter(s => s.status === 'pending').map(s => s.id);
    
    if (pendingIds.length === 0) {
      toast.error("Nenhuma solicitação pendente para negar");
      return;
    }

    const observations = prompt("Digite uma observação para todas as negações:");
    if (!observations || !observations.trim()) {
      toast.error("Observação é obrigatória");
      return;
    }

    setLoading(true);
    try {
      const idsArray = pendingIds;
      let successCount = 0;
      let errorCount = 0;

      for (const id of idsArray) {
        try {
          await handleReject(id, observations);
          successCount++;
        } catch (error) {
          console.error(`Erro ao negar ${id}:`, error);
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount} solicitação(ões) negada(s) com sucesso!`);
      }
      if (errorCount > 0) {
        toast.error(`${errorCount} solicitação(ões) falharam ao negar`);
      }

      setSelectedIds(new Set());
      loadSuggestions();
    } catch (error: any) {
      toast.error("Erro ao negar em lote: " + (error?.message || 'Erro desconhecido'));
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
      case 'price_suggested':
        return <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300"><DollarSign className="h-3 w-3 mr-1" />Preço Sugerido</Badge>;
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

  if (loadingData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Carregando dados...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-4 space-y-4">
        {/* Header com gradiente moderno */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 p-3 sm:p-4 text-white shadow-xl">
          <div className="absolute inset-0 bg-black/10"></div>
          <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
              <Button 
                variant="secondary" 
                onClick={() => navigate("/dashboard")}
                className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white border-white/30 backdrop-blur-sm h-8 text-xs sm:text-sm"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Voltar ao Dashboard</span>
                <span className="sm:hidden">Voltar</span>
              </Button>
              <div className="flex-1 sm:flex-none">
                <h1 className="text-lg sm:text-xl font-bold mb-0.5 sm:mb-1">Aprovações de Preços</h1>
                <p className="text-slate-200 text-xs sm:text-sm hidden sm:block">Gerencie e aprove as solicitações de alteração de preços</p>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
              {realtimeStatus === 'connected' && (
                <div className="flex items-center gap-1 text-xs text-green-200">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="hidden sm:inline">Atualização automática ativa</span>
                  <span className="sm:hidden">Ativo</span>
                </div>
              )}
            <Button 
              variant="secondary"
              size="sm"
                onClick={() => {
                  setIsRefreshing(true);
                  loadSuggestions(false).then(() => setIsRefreshing(false)).catch(() => setIsRefreshing(false));
                }}
                disabled={isRefreshing}
                className="flex items-center gap-1 sm:gap-2 bg-white/20 hover:bg-white/30 text-white border-white/30 backdrop-blur-sm h-8 text-xs sm:text-sm px-2 sm:px-3"
              >
                <RefreshCw className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{isRefreshing ? 'Atualizando...' : 'Atualizar'}</span>
            </Button>
            </div>
          </div>
        </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Total</p>
                <p className="text-lg font-bold text-slate-800 dark:text-slate-200">{stats.total}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-slate-600 to-slate-700 flex items-center justify-center">
                <MessageSquare className="h-5 w-5" style={{ color: '#94a3b8' }} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Pendentes</p>
                <p className="text-lg font-bold text-yellow-600">{stats.pending}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-yellow-500 to-yellow-600 flex items-center justify-center">
                <Clock className="h-5 w-5" style={{ color: '#94a3b8' }} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Aprovadas</p>
                <p className="text-lg font-bold text-green-600">{stats.approved}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-green-500 to-green-600 flex items-center justify-center">
                <Check className="h-5 w-5" style={{ color: '#94a3b8' }} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Rejeitadas</p>
                <p className="text-lg font-bold text-red-600">{stats.rejected}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-red-500 to-red-600 flex items-center justify-center">
                <X className="h-5 w-5" style={{ color: '#94a3b8' }} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="shadow-lg border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
        <CardHeader className="p-3 sm:p-6">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Filter className="h-4 w-4 sm:h-5 sm:w-5 text-slate-600 dark:text-slate-400" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
                  <SelectItem value="price_suggested">Preço Sugerido</SelectItem>
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

      {/* Batch Approvals Section - Only for batch requests */}
      {batchApprovals.length > 0 && (
        <Card className="shadow-lg border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
          <CardHeader className="p-3 sm:p-6">
            <CardTitle className="text-base sm:text-lg">Aprovações em Lote ({batchApprovals.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-6">
            {/* Paginação de lotes */}
            {batchApprovals.length > ITEMS_PER_PAGE && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4">
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                  Mostrando {batchPage * ITEMS_PER_PAGE + 1} - {Math.min((batchPage + 1) * ITEMS_PER_PAGE, batchApprovals.length)} de {batchApprovals.length} lotes
                </p>
                <div className="flex gap-2 w-full sm:w-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setBatchPage(p => Math.max(0, p - 1))}
                    disabled={batchPage === 0}
                    className="flex-1 sm:flex-none text-xs sm:text-sm"
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setBatchPage(p => Math.min(Math.ceil(batchApprovals.length / ITEMS_PER_PAGE) - 1, p + 1))}
                    disabled={batchPage >= Math.ceil(batchApprovals.length / ITEMS_PER_PAGE) - 1}
                    className="flex-1 sm:flex-none text-xs sm:text-sm"
                  >
                    Próximo
                  </Button>
                </div>
              </div>
            )}
            <div className="space-y-4">
              {batchApprovals.slice(batchPage * ITEMS_PER_PAGE, (batchPage + 1) * ITEMS_PER_PAGE).map((batch) => {
                const isExpanded = expandedBatches.has(batch.batchKey);
                
                return (
                  <div key={batch.batchKey} className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                    {/* Header do Lote - Colapsável */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 sm:p-4 bg-slate-50 dark:bg-slate-800/50">
                      <div 
                        className="flex items-center gap-2 sm:gap-3 flex-1 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors rounded-lg p-2 -m-2 w-full sm:w-auto"
                        onClick={() => {
                          const newExpanded = new Set(expandedBatches);
                          if (isExpanded) {
                            newExpanded.delete(batch.batchKey);
                          } else {
                            newExpanded.add(batch.batchKey);
                            // Inicializar observações e preços quando expandir (apenas para os primeiros 20 para performance)
                            const obs: Record<string, string> = { ...batchObservations };
                            const prices: Record<string, number> = { ...batchSuggestedPrices };
                            batch.requests.slice(0, 20).forEach((req: any) => {
                              if (!obs[req.id]) obs[req.id] = '';
                              if (!prices[req.id]) {
                                const price = req.final_price || req.suggested_price || 0;
                                prices[req.id] = price >= 100 ? price / 100 : price;
                              }
                            });
                            setBatchObservations(obs);
                            setBatchSuggestedPrices(prices);
                          }
                          setExpandedBatches(newExpanded);
                        }}
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                        )}
                        <div className="min-w-0 flex-1">
                          <h3 className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 truncate">
                            {batch.hasMultipleClients ? (
                              <>Clientes: {batch.clients?.map((c: any) => c?.name || 'N/A').join(', ') || 'Múltiplos'}</>
                            ) : (
                              <>Cliente: {batch.client?.name || 'N/A'}</>
                            )}
                          </h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 break-words">
                            <span className="block sm:inline">Data: {new Date(batch.created_at).toLocaleDateString('pt-BR')}</span>
                            <span className="hidden sm:inline"> | </span>
                            <span className="block sm:inline">{batch.requests.length} solicitação(ões)</span>
                            {batch.requests[0]?.requester && (
                              <>
                                <span className="hidden sm:inline"> | </span>
                                <span className="block sm:inline text-xs text-slate-500 dark:text-slate-400">
                                  Enviado por: {batch.requests[0].requester.name || batch.requests[0].requester.email || 'N/A'}
                                </span>
                              </>
                            )}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setShowBatchApproveModal(prev => ({
                            ...prev,
                            [batch.batchKey]: true
                          }));
                          if (!batchApproveObservation[batch.batchKey]) {
                            setBatchApproveObservation(prev => ({
                              ...prev,
                              [batch.batchKey]: ''
                            }));
                          }
                        }}
                        disabled={loading}
                        className="text-green-600 hover:text-green-700 hover:bg-green-50 border-green-300 w-full sm:w-auto text-xs sm:text-sm"
                      >
                        <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2" />
                        <span className="hidden sm:inline">Aprovar Lote</span>
                        <span className="sm:hidden">Aprovar</span>
                      </Button>
                    </div>
                    
                    {/* Tabela de Solicitações do Lote - Expandível */}
                    {isExpanded && (
                      <div className="overflow-x-auto -mx-4 sm:mx-0">
                        {/* Limitar exibição a 20 itens por lote para performance */}
                        {batch.requests.length > 20 && (
                          <div className="p-2 sm:p-3 bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800">
                            <p className="text-xs text-yellow-800 dark:text-yellow-200">
                              Mostrando 20 de {batch.requests.length} solicitações deste lote. Use "Aprovar Lote" para aprovar todas de uma vez.
                            </p>
                          </div>
                        )}
                        {/* Versão Mobile: Cards */}
                        <div className="block sm:hidden space-y-3 p-3">
                          {batch.requests.slice(0, 20).map((req: any) => {
                            const currentPrice = req.current_price || req.cost_price || 0;
                            const currentPriceReais = currentPrice >= 100 ? currentPrice / 100 : currentPrice;
                            const finalPrice = req.final_price || req.suggested_price || 0;
                            const finalPriceReais = finalPrice >= 100 ? finalPrice / 100 : finalPrice;
                            const costPrice = req.cost_price || req.cost || 0;
                            const costPriceReais = costPrice >= 100 ? costPrice / 100 : costPrice;
                            const margin = finalPriceReais - costPriceReais;
                            const volumeProjected = req.volume_projected || 0;
                            const station = req.stations || { name: req.station_id || 'N/A', code: '' };
                            
                            return (
                              <div key={req.id} className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-3 space-y-2">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-sm text-slate-800 dark:text-slate-200 truncate">{station.name}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">{req.clients?.name || batch.client?.name || 'N/A'}</p>
                                  </div>
                                  {getStatusBadge(req.status)}
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  <div>
                                    <span className="text-slate-500 dark:text-slate-400">Produto:</span>
                                    <p className="font-medium text-slate-700 dark:text-slate-300">{getProductName(req.product)}</p>
                                  </div>
                                  <div>
                                    <span className="text-slate-500 dark:text-slate-400">Preço Atual:</span>
                                    <p className="font-medium text-slate-700 dark:text-slate-300">{currentPriceReais > 0 ? formatPrice(currentPriceReais) : '-'}</p>
                                  </div>
                                  <div>
                                    <span className="text-slate-500 dark:text-slate-400">Preço Sugerido:</span>
                                    <p className="font-medium text-green-600 dark:text-green-400">{finalPriceReais > 0 ? formatPrice(finalPriceReais) : '-'}</p>
                                  </div>
                                  <div>
                                    <span className="text-slate-500 dark:text-slate-400">Margem:</span>
                                    <p className="font-medium text-slate-700 dark:text-slate-300">{costPriceReais > 0 ? formatPrice(margin) : '-'}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedSuggestion(req);
                                      setShowDetails(true);
                                    }}
                                    className="h-7 w-7 p-0 flex-shrink-0"
                                    title="Ver detalhes"
                                  >
                                    <Eye className="h-3.5 w-3.5 text-slate-600 dark:text-slate-400" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setShowObservationModal(prev => ({
                                        ...prev,
                                        [req.id]: { open: true, action: 'approve' }
                                      }));
                                    }}
                                    className="h-7 px-2 text-green-600 hover:text-green-700 hover:bg-green-50 text-xs flex-1"
                                    disabled={loading}
                                  >
                                    <Check className="h-3.5 w-3.5 mr-1" />
                                    Aprovar
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setShowObservationModal(prev => ({
                                        ...prev,
                                        [req.id]: { open: true, action: 'reject' }
                                      }));
                                    }}
                                    className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50 text-xs flex-1"
                                    disabled={loading}
                                  >
                                    <X className="h-3.5 w-3.5 mr-1" />
                                    Rejeitar
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {/* Versão Desktop: Tabela */}
                        <table className="w-full hidden sm:table">
                          <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                              <th className="text-left p-2 sm:p-3 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">POSTO</th>
                              <th className="text-left p-2 sm:p-3 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 hidden lg:table-cell">CLIENTE</th>
                              <th className="text-left p-2 sm:p-3 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 hidden xl:table-cell">ENVIADO POR</th>
                              <th className="text-left p-2 sm:p-3 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">PRODUTO</th>
                              <th className="text-left p-2 sm:p-3 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">PREÇO ATUAL</th>
                              <th className="text-left p-2 sm:p-3 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 hidden lg:table-cell">PREÇO SUG.</th>
                              <th className="text-left p-2 sm:p-3 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 hidden xl:table-cell">VOLUME</th>
                              <th className="text-left p-2 sm:p-3 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 hidden xl:table-cell">MARGEM</th>
                              <th className="text-left p-2 sm:p-3 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">STATUS</th>
                              <th className="text-left p-2 sm:p-3 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">AÇÕES</th>
                            </tr>
                          </thead>
                          <tbody>
                            {batch.requests.slice(0, 20).map((req: any) => {
                              const currentPrice = req.current_price || req.cost_price || 0;
                              const currentPriceReais = currentPrice >= 100 ? currentPrice / 100 : currentPrice;
                              const finalPrice = req.final_price || req.suggested_price || 0;
                              const finalPriceReais = finalPrice >= 100 ? finalPrice / 100 : finalPrice;
                              const costPrice = req.cost_price || req.cost || 0;
                              const costPriceReais = costPrice >= 100 ? costPrice / 100 : costPrice;
                              const margin = finalPriceReais - costPriceReais;
                              const volumeProjected = req.volume_projected || 0;
                              const station = req.stations || { name: req.station_id || 'N/A', code: '' };
                              const suggestedPrice = batchSuggestedPrices[req.id] || finalPriceReais;
                              
                              return (
                                <tr key={req.id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                  <td className="p-2 sm:p-3 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                                    <div className="font-medium">{station.name}</div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400 lg:hidden">{req.clients?.name || batch.client?.name || 'N/A'}</div>
                                  </td>
                                  <td className="p-2 sm:p-3 text-xs sm:text-sm text-slate-700 dark:text-slate-300 hidden lg:table-cell">
                                    {req.clients?.name || batch.client?.name || 'N/A'}
                                  </td>
                                  <td className="p-2 sm:p-3 text-xs sm:text-sm text-slate-600 dark:text-slate-400 hidden xl:table-cell">
                                    {req.requester?.name || req.requester?.email || req.requested_by || 'N/A'}
                                  </td>
                                  <td className="p-2 sm:p-3 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                                    {getProductName(req.product)}
                                  </td>
                                  <td className="p-2 sm:p-3 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                                    {currentPriceReais > 0 ? formatPrice(currentPriceReais) : '-'}
                                  </td>
                                  <td className="p-2 sm:p-3 text-xs sm:text-sm text-slate-700 dark:text-slate-300 hidden lg:table-cell">
                                    {finalPriceReais > 0 ? formatPrice(finalPriceReais) : '-'}
                                  </td>
                                  <td className="p-2 sm:p-3 text-xs sm:text-sm text-slate-700 dark:text-slate-300 hidden xl:table-cell">
                                    {volumeProjected ? `${volumeProjected} m³` : '-'}
                                  </td>
                                  <td className="p-2 sm:p-3 text-xs sm:text-sm text-slate-700 dark:text-slate-300 hidden xl:table-cell">
                                    {costPriceReais > 0 ? formatPrice(margin) : '-'}
                                  </td>
                                  <td className="p-2 sm:p-3">
                                    {getStatusBadge(req.status)}
                                  </td>
                                  <td className="p-2 sm:p-3">
                                    <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                          setSelectedSuggestion(req);
                                          setShowDetails(true);
                                        }}
                                        className="h-7 w-7 p-0"
                                        title="Ver detalhes"
                                      >
                                        <Eye className="h-3 w-3 text-slate-600 dark:text-slate-400" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                          setShowObservationModal(prev => ({
                                            ...prev,
                                            [req.id]: { open: true, action: 'approve' }
                                          }));
                                        }}
                                        className="h-7 w-7 sm:px-2 text-green-600 hover:text-green-700 hover:bg-green-50"
                                        title="Aprovar"
                                        disabled={loading}
                                      >
                                        <Check className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                          setShowObservationModal(prev => ({
                                            ...prev,
                                            [req.id]: { open: true, action: 'reject' }
                                          }));
                                        }}
                                        className="h-7 w-7 sm:px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                                        title="Rejeitar"
                                        disabled={loading}
                                      >
                                        <X className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                          setShowObservationModal(prev => ({
                                            ...prev,
                                            [req.id]: { open: true, action: 'suggest' }
                                          }));
                                        }}
                                        className="h-7 px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                        title="Sugerir preço"
                                        disabled={loading}
                                      >
                                        <DollarSign className="h-3 w-3" />
                                      </Button>
                                    </div>
                                    {/* Modal para Observação e Ação - Só renderizar se estiver aberto */}
                                    {showObservationModal[req.id]?.open && (
                                      <Dialog 
                                        key={`modal-${req.id}`}
                                        open={showObservationModal[req.id].open} 
                                        onOpenChange={(open) => {
                                        if (!open) {
                                          setShowObservationModal(prev => ({
                                            ...prev,
                                            [req.id]: { open: false, action: 'approve' }
                                          }));
                                        }
                                      }}>
                                        <DialogContent className="max-w-md w-[95vw] sm:w-full mx-4 sm:mx-auto">
                                          <DialogHeader>
                                            <DialogTitle className="text-base sm:text-lg">
                                              {showObservationModal[req.id].action === 'approve' && 'Aprovar Solicitação'}
                                              {showObservationModal[req.id].action === 'reject' && 'Rejeitar Solicitação'}
                                              {showObservationModal[req.id].action === 'suggest' && 'Sugerir Preço'}
                                            </DialogTitle>
                                          </DialogHeader>
                                          <div className="space-y-4">
                                            <div>
                                              <Label className="text-sm font-semibold mb-2 block">
                                                {station.name} - {getProductName(req.product)}
                                              </Label>
                                              {showObservationModal[req.id].action === 'suggest' && (
                                                <>
                                                  <div className="mb-3">
                                                    <Label className="text-xs text-slate-500">Preço Atual:</Label>
                                                    <p className="text-sm font-semibold">{formatPrice(currentPriceReais)}</p>
                                                  </div>
                                                  <div className="mb-3">
                                                    <Label htmlFor={`suggest-price-modal-${req.id}`} className="text-xs">Preço Sugerido (R$/L):</Label>
                                                    <Input
                                                      id={`suggest-price-modal-${req.id}`}
                                                      type="text"
                                                      value={batchSuggestedPrices[req.id] || ''}
                                                      onChange={(e) => {
                                                        let value = e.target.value.replace(/[^\d,]/g, '');
                                                        
                                                        // Se não tem vírgula e tem mais de 2 dígitos, adicionar vírgula antes dos últimos 2
                                                        if (!value.includes(',') && value.length > 2) {
                                                          value = value.slice(0, -2) + ',' + value.slice(-2);
                                                        }
                                                        
                                                        // Garantir apenas uma vírgula
                                                        const parts = value.split(',');
                                                        if (parts.length > 2) {
                                                          value = parts[0] + ',' + parts.slice(1).join('');
                                                        }
                                                        
                                                        // Limitar a 2 casas decimais após a vírgula
                                                        if (parts.length === 2 && parts[1].length > 2) {
                                                          value = parts[0] + ',' + parts[1].slice(0, 2);
                                                        }
                                                        
                                                        setBatchSuggestedPrices(prev => ({
                                                          ...prev,
                                                          [req.id]: value
                                                        }));
                                                      }}
                                                      onBlur={(e) => {
                                                        const value = e.target.value.trim();
                                                        if (value) {
                                                          // Se não tem vírgula, adicionar ,00
                                                          if (!value.includes(',')) {
                                                            const numValue = parseFloat(value.replace(/[^\d]/g, ''));
                                                            if (!isNaN(numValue) && numValue > 0) {
                                                              setBatchSuggestedPrices(prev => ({
                                                                ...prev,
                                                                [req.id]: numValue.toFixed(2).replace('.', ',')
                                                              }));
                                                              return;
                                                            }
                                                          }
                                                          
                                                          const numValue = parseBrazilianDecimal(value);
                                                          if (!isNaN(numValue) && numValue > 0) {
                                                            // Formatar com vírgula e 2 casas decimais
                                                            const formatted = numValue.toFixed(2).replace('.', ',');
                                                            setBatchSuggestedPrices(prev => ({
                                                              ...prev,
                                                              [req.id]: formatted
                                                            }));
                                                          }
                                                        }
                                                      }}
                                                      placeholder={formatPrice(finalPriceReais)}
                                                      className="mt-1"
                                                    />
                                                  </div>
                                                </>
                                              )}
                                              <Label className="text-xs mb-1 block">
                                                Observação {showObservationModal[req.id].action === 'suggest' ? '(opcional)' : '(obrigatório)'}:
                                              </Label>
                                              <Textarea
                                                placeholder="Adicione uma observação para esta solicitação..."
                                                value={batchObservations[req.id] || ''}
                                                onChange={(e) => {
                                                  setBatchObservations(prev => ({
                                                    ...prev,
                                                    [req.id]: e.target.value
                                                  }));
                                                }}
                                                className="min-h-[120px]"
                                                rows={5}
                                              />
                                            </div>
                                            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                                              <Button
                                                onClick={async () => {
                                                  const obs = batchObservations[req.id] || '';
                                                  const action = showObservationModal[req.id].action;
                                                  
                                                  // Observação obrigatória apenas para aprovar/rejeitar
                                                  if ((action === 'approve' || action === 'reject') && !obs.trim()) {
                                                    toast.error("Por favor, adicione uma observação");
                                                    return;
                                                  }
                                                  
                                                  // Buscar nome do usuário do perfil
                                                  let approverName = user?.email || 'Aprovador';
                                                  try {
                                                    const { data: userProfile } = await supabase
                                                      .from('user_profiles')
                                                      .select('nome, email')
                                                      .eq('user_id', user?.id)
                                                      .single();
                                                    if (userProfile?.nome) {
                                                      approverName = userProfile.nome;
                                                    } else if (userProfile?.email) {
                                                      approverName = userProfile.email;
                                                    }
                                                  } catch (err) {
                                                    console.warn('Erro ao buscar nome do usuário:', err);
                                                  }
                                                  
                                                  if (action === 'approve') {
                                                    const suggestedPriceStr = batchSuggestedPrices[req.id];
                                                    if (suggestedPriceStr && suggestedPriceStr.trim()) {
                                                      const suggestedPrice = parseBrazilianDecimal(suggestedPriceStr);
                                                      if (suggestedPrice && suggestedPrice !== finalPriceReais) {
                                                        const priceInCents = Math.round(suggestedPrice * 100);
                                                        await supabase
                                                          .from('price_suggestions')
                                                          .update({ 
                                                            final_price: priceInCents,
                                                            suggested_price: priceInCents
                                                          })
                                                          .eq('id', req.id);
                                                      }
                                                    }
                                                    await handleApprove(req.id, obs);
                                                    // Fechar modal após aprovação
                                                    setShowObservationModal(prev => ({
                                                      ...prev,
                                                      [req.id]: { open: false, action: 'approve' }
                                                    }));
                                                    // Limpar observações e preços sugeridos
                                                    setBatchObservations(prev => {
                                                      const newObs = { ...prev };
                                                      delete newObs[req.id];
                                                      return newObs;
                                                    });
                                                    setBatchSuggestedPrices(prev => {
                                                      const newPrices = { ...prev };
                                                      delete newPrices[req.id];
                                                      return newPrices;
                                                    });
                                                  } else if (action === 'reject') {
                                                    await handleReject(req.id, obs);
                                                    // Fechar modal após rejeição
                                                    setShowObservationModal(prev => ({
                                                      ...prev,
                                                      [req.id]: { open: false, action: 'reject' }
                                                    }));
                                                    // Limpar observações
                                                    setBatchObservations(prev => {
                                                      const newObs = { ...prev };
                                                      delete newObs[req.id];
                                                      return newObs;
                                                    });
                                                  } else if (action === 'suggest') {
                                                    const suggestedPriceStr = batchSuggestedPrices[req.id];
                                                    if (!suggestedPriceStr || !suggestedPriceStr.trim()) {
                                                      toast.error("Por favor, informe um preço válido");
                                                      return;
                                                    }
                                                    const suggestedPrice = parseBrazilianDecimal(suggestedPriceStr);
                                                    if (!suggestedPrice || suggestedPrice <= 0) {
                                                      toast.error("Por favor, informe um preço válido");
                                                      return;
                                                    }
                                                    const priceInCents = Math.round(suggestedPrice * 100);
                                                    const { error } = await supabase
                                                      .from('price_suggestions')
                                                      .update({ 
                                                        final_price: priceInCents,
                                                        suggested_price: priceInCents,
                                                        status: 'price_suggested'
                                                      })
                                                      .eq('id', req.id);
                                                    
                                                    if (error) {
                                                      toast.error("Erro ao sugerir preço: " + error.message);
                                                    } else {
                                                      await supabase
                                                        .from('approval_history')
                                                        .insert({
                                                          suggestion_id: req.id,
                                                          approver_id: user?.id,
                                                          approver_name: approverName,
                                                          action: 'price_suggested',
                                                          observations: obs,
                                                          approval_level: req.approval_level || 1
                                                        });
                                                      
                                                      try {
                                                        await supabase.from('notifications').insert({
                                                          user_id: req.requested_by,
                                                          suggestion_id: req.id,
                                                          type: 'pending',
                                                          title: 'Preço Sugerido',
                                                          message: `Um preço foi sugerido para sua solicitação de ${getProductName(req.product)}`
                                                        });
                                                      } catch (notifError) {
                                                        console.error('Erro ao criar notificação:', notifError);
                                                      }
                                                      
                                                      toast.success("Preço sugerido com sucesso!");
                                                      setShowObservationModal(prev => ({
                                                        ...prev,
                                                        [req.id]: { open: false, action: 'approve' }
                                                      }));
                                                      setBatchObservations(prev => {
                                                        const newObs = { ...prev };
                                                        delete newObs[req.id];
                                                        return newObs;
                                                      });
                                                      setBatchSuggestedPrices(prev => {
                                                        const newPrices = { ...prev };
                                                        delete newPrices[req.id];
                                                        return newPrices;
                                                      });
                                                      
                                                      // Invalidar cache e recarregar
                                                      localStorage.removeItem('approvals_suggestions_cache');
                                                      localStorage.removeItem('approvals_suggestions_cache_timestamp');
                                                      setTimeout(() => {
                                                        loadSuggestions(false);
                                                      }, 500);
                                                      return;
                                                    }
                                                  }
                                                }}
                                                className="flex-1 w-full sm:w-auto text-xs sm:text-sm"
                                                disabled={loading}
                                              >
                                                {showObservationModal[req.id].action === 'approve' && 'Aprovar'}
                                                {showObservationModal[req.id].action === 'reject' && 'Rejeitar'}
                                                {showObservationModal[req.id].action === 'suggest' && 'Sugerir Preço'}
                                              </Button>
                                              <Button
                                                variant="outline"
                                                onClick={() => {
                                                  setShowObservationModal(prev => ({
                                                    ...prev,
                                                    [req.id]: { open: false, action: 'approve' }
                                                  }));
                                                }}
                                                className="flex-1 sm:flex-none w-full sm:w-auto text-xs sm:text-sm"
                                              >
                                                Cancelar
                                              </Button>
                                            </div>
                                          </div>
                                        </DialogContent>
                                      </Dialog>
                                    )}
                                    {/* Modal para Sugerir Preço (mantido para compatibilidade, mas não será usado) */}
                                    {false && showPriceModal[req.id] && (
                                      <Dialog open={showPriceModal[req.id]} onOpenChange={(open) => {
                                        setShowPriceModal(prev => ({
                                          ...prev,
                                          [req.id]: open
                                        }));
                                      }}>
                                        <DialogContent className="max-w-md w-[95vw] sm:w-full mx-4 sm:mx-auto">
                                          <DialogHeader>
                                            <DialogTitle className="text-base sm:text-lg">Sugerir Preço</DialogTitle>
                                          </DialogHeader>
                                          <div className="space-y-4">
                                            <div>
                                              <Label>Posto: {station.name}</Label>
                                              <p className="text-sm text-slate-500">{getProductName(req.product)}</p>
                                            </div>
                                            <div>
                                              <Label className="text-xs text-slate-500">Preço Atual:</Label>
                                              <p className="text-sm font-semibold">{formatPrice(currentPriceReais)}</p>
                                            </div>
                                            <div>
                                              <Label htmlFor={`suggest-price-${req.id}`} className="text-xs">Preço Sugerido (R$/L):</Label>
                                              <Input
                                                id={`suggest-price-${req.id}`}
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={suggestedPrice}
                                                onChange={(e) => {
                                                  setBatchSuggestedPrices(prev => ({
                                                    ...prev,
                                                    [req.id]: parseFloat(e.target.value) || 0
                                                  }));
                                                }}
                                                placeholder="0.00"
                                              />
                                            </div>
                                            <div className="flex flex-col sm:flex-row gap-2 pt-2">
                                              <Button
                                                onClick={async () => {
                                                  const priceInCents = Math.round(suggestedPrice * 100);
                                                  const { error } = await supabase
                                                    .from('price_suggestions')
                                                    .update({ 
                                                      final_price: priceInCents,
                                                      suggested_price: priceInCents
                                                    })
                                                    .eq('id', req.id);
                                                  
                                                  if (error) {
                                                    toast.error("Erro ao atualizar preço: " + error.message);
                                                  } else {
                                                    toast.success("Preço sugerido atualizado com sucesso!");
                                                    setShowPriceModal(prev => ({
                                                      ...prev,
                                                      [req.id]: false
                                                    }));
                                                    
                                                    // Invalidar cache e recarregar
                                                    localStorage.removeItem('approvals_suggestions_cache');
                                                    localStorage.removeItem('approvals_suggestions_cache_timestamp');
                                                    setTimeout(() => {
                                                      loadSuggestions(false);
                                                    }, 500);
                                                  }
                                                }}
                                                className="flex-1 w-full sm:w-auto text-xs sm:text-sm"
                                                disabled={loading}
                                              >
                                                <span className="hidden sm:inline">Salvar Preço</span>
                                                <span className="sm:hidden">Salvar</span>
                                              </Button>
                                              <Button
                                                variant="outline"
                                                onClick={() => {
                                                  setShowPriceModal(prev => ({
                                                    ...prev,
                                                    [req.id]: false
                                                  }));
                                                }}
                                                className="flex-1 sm:flex-none w-full sm:w-auto text-xs sm:text-sm"
                                              >
                                                Cancelar
                                              </Button>
                                            </div>
                                          </div>
                                        </DialogContent>
                                      </Dialog>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Suggestions List */}
      <Card className="shadow-xl border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Sugestões de Preço ({individualApprovals.length})</CardTitle>
            <div className="flex gap-2">
              <Button
                variant={viewMode === 'cards' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('cards')}
              >
                Cards
              </Button>
              <Button
                variant={viewMode === 'table' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('table')}
              >
                Tabela
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {viewMode === 'table' ? (
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              {/* Versão Mobile: Cards para tabela */}
              <div className="block sm:hidden space-y-3 p-3">
                {individualApprovals.slice(individualPage * ITEMS_PER_PAGE, (individualPage + 1) * ITEMS_PER_PAGE).map((suggestion) => {
                  const currentPrice = suggestion.current_price || suggestion.cost_price || 0;
                  const currentPriceReais = currentPrice >= 100 ? currentPrice / 100 : currentPrice;
                  const finalPrice = suggestion.final_price || suggestion.suggested_price || 0;
                  const finalPriceReais = finalPrice >= 100 ? finalPrice / 100 : finalPrice;
                  const margin = finalPriceReais - currentPriceReais;
                  const volumeProjected = suggestion.volume_projected || 0;
                  
                  return (
                    <div key={suggestion.id} className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-3 space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-slate-800 dark:text-slate-200 truncate">
                            {suggestion.stations?.name || suggestion.station_id || 'N/A'}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {suggestion.stations?.code ? suggestion.stations.code.split('/')[0] : '-'} / {suggestion.stations?.code ? suggestion.stations.code.split('/')[1] : '-'}
                          </p>
                        </div>
                        {getStatusBadge(suggestion.status)}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-slate-500 dark:text-slate-400">Preço Atual:</span>
                          <p className="font-medium text-slate-700 dark:text-slate-300">{currentPriceReais > 0 ? formatPrice(currentPriceReais) : '-'}</p>
                        </div>
                        <div>
                          <span className="text-slate-500 dark:text-slate-400">Preço Sugerido:</span>
                          <p className="font-medium text-green-600 dark:text-green-400">{finalPriceReais > 0 ? formatPrice(finalPriceReais) : '-'}</p>
                        </div>
                        <div>
                          <span className="text-slate-500 dark:text-slate-400">Volume:</span>
                          <p className="font-medium text-slate-700 dark:text-slate-300">{volumeProjected || '-'}</p>
                        </div>
                        <div>
                          <span className="text-slate-500 dark:text-slate-400">Margem:</span>
                          <p className="font-medium text-slate-700 dark:text-slate-300">{margin !== 0 ? formatPrice(margin) : '-'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedSuggestion(suggestion);
                            setShowDetails(true);
                          }}
                          className="h-7 w-7 p-0 flex-shrink-0"
                          title="Ver detalhes"
                        >
                          <Eye className="h-3.5 w-3.5 text-slate-600 dark:text-slate-400" />
                        </Button>
                        {suggestion.status === 'pending' && permissions?.permissions?.can_approve && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedSuggestion(suggestion);
                                setShowDetails(true);
                              }}
                              className="text-green-600 hover:text-green-700 hover:bg-green-50 h-7 px-2 text-xs flex-1"
                            >
                              Aprovar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedSuggestion(suggestion);
                                setShowDetails(true);
                              }}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 h-7 px-2 text-xs flex-1"
                            >
                              Negar
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Versão Desktop: Tabela */}
              <table className="w-full hidden sm:table">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left p-2 sm:p-3 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">POSTO</th>
                    <th className="text-left p-2 sm:p-3 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 hidden lg:table-cell">CIDADE/UF</th>
                    <th className="text-left p-2 sm:p-3 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">PREÇO VEND.</th>
                    <th className="text-left p-2 sm:p-3 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 hidden lg:table-cell">VOLUME</th>
                    <th className="text-left p-2 sm:p-3 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 hidden xl:table-cell">MARGEM</th>
                    <th className="text-left p-2 sm:p-3 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">PREÇO SUG.</th>
                    <th className="text-left p-2 sm:p-3 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">STATUS</th>
                    <th className="text-left p-2 sm:p-3 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">AÇÕES</th>
                  </tr>
                </thead>
                <tbody>
                  {individualApprovals.slice(individualPage * ITEMS_PER_PAGE, (individualPage + 1) * ITEMS_PER_PAGE).map((suggestion) => {
                    const currentPrice = suggestion.current_price || suggestion.cost_price || 0;
                    const currentPriceReais = currentPrice >= 100 ? currentPrice / 100 : currentPrice;
                    const finalPrice = suggestion.final_price || suggestion.suggested_price || 0;
                    const finalPriceReais = finalPrice >= 100 ? finalPrice / 100 : finalPrice;
                    const margin = finalPriceReais - currentPriceReais;
                    const volumeProjected = suggestion.volume_projected || 0;
                    
                    return (
                      <tr key={suggestion.id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="p-2 sm:p-3 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                          <div className="font-medium">{suggestion.stations?.name || suggestion.station_id || 'N/A'}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 lg:hidden">
                            {suggestion.stations?.code ? suggestion.stations.code.split('/')[0] : '-'} / {suggestion.stations?.code ? suggestion.stations.code.split('/')[1] : '-'}
                          </div>
                        </td>
                        <td className="p-2 sm:p-3 text-xs sm:text-sm text-slate-600 dark:text-slate-400 hidden lg:table-cell">
                          {suggestion.stations?.code ? suggestion.stations.code.split('/')[0] : '-'} / {suggestion.stations?.code ? suggestion.stations.code.split('/')[1] : '-'}
                        </td>
                        <td className="p-2 sm:p-3 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                          {currentPriceReais > 0 ? formatPrice(currentPriceReais) : '-'}
                        </td>
                        <td className="p-2 sm:p-3 text-xs sm:text-sm text-slate-700 dark:text-slate-300 hidden lg:table-cell">
                          {volumeProjected || '-'}
                        </td>
                        <td className="p-2 sm:p-3 text-xs sm:text-sm text-slate-700 dark:text-slate-300 hidden xl:table-cell">
                          {margin !== 0 ? formatPrice(margin) : '-'}
                        </td>
                        <td className="p-2 sm:p-3 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                          {finalPriceReais > 0 ? formatPrice(finalPriceReais) : '-'}
                        </td>
                        <td className="p-2 sm:p-3">
                          {getStatusBadge(suggestion.status)}
                        </td>
                        <td className="p-2 sm:p-3">
                          <div className="flex items-center gap-1 sm:gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedSuggestion(suggestion);
                                setShowDetails(true);
                              }}
                              className="h-8 w-8 p-0"
                              title="Ver detalhes"
                            >
                              <Eye className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                            </Button>
                            {suggestion.status === 'pending' && permissions?.permissions?.can_approve && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedSuggestion(suggestion);
                                    setShowDetails(true);
                                  }}
                                  className="text-green-600 hover:text-green-700 hover:bg-green-50 h-8 px-3"
                                >
                                  Aprovar
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedSuggestion(suggestion);
                                    setShowDetails(true);
                                  }}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 px-3"
                                >
                                  Negar
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
          <>
            {/* Paginação de aprovações individuais */}
            {individualApprovals.length > ITEMS_PER_PAGE && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4">
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                  Mostrando {individualPage * ITEMS_PER_PAGE + 1} - {Math.min((individualPage + 1) * ITEMS_PER_PAGE, individualApprovals.length)} de {individualApprovals.length} aprovações
                </p>
                <div className="flex gap-2 w-full sm:w-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIndividualPage(p => Math.max(0, p - 1))}
                    disabled={individualPage === 0}
                    className="flex-1 sm:flex-none text-xs sm:text-sm"
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIndividualPage(p => Math.min(Math.ceil(individualApprovals.length / ITEMS_PER_PAGE) - 1, p + 1))}
                    disabled={individualPage >= Math.ceil(individualApprovals.length / ITEMS_PER_PAGE) - 1}
                    className="flex-1 sm:flex-none text-xs sm:text-sm"
                  >
                    Próximo
                  </Button>
                </div>
              </div>
            )}
          <div className="space-y-4">
            {individualApprovals.slice(individualPage * ITEMS_PER_PAGE, (individualPage + 1) * ITEMS_PER_PAGE).map((suggestion) => (
              <div key={suggestion.id} className="p-3 sm:p-4 bg-gradient-to-r from-white to-slate-50 dark:from-slate-800 dark:to-slate-700 rounded-xl border border-slate-200 dark:border-slate-600 hover:shadow-lg transition-all duration-300">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 sm:gap-4">
                  <div className="flex-1 min-w-0 w-full">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
                      <span className="font-semibold text-sm sm:text-base text-slate-800 dark:text-slate-200 break-words">
                        {suggestion.stations?.name 
                          || suggestion.station_id 
                          || '⚠️ Sem posto'
                        } - {suggestion.clients?.name 
                          || suggestion.client_id 
                          || '⚠️ Sem cliente'
                        }
                      </span>
                      <div className="flex-shrink-0">{getStatusBadge(suggestion.status)}</div>
                    </div>
                    {suggestion.status === 'pending' && suggestion.current_approver_name && (
                      <div className="mb-2">
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Em aprovação com: </span>
                        <span className="text-xs font-bold text-orange-600">{suggestion.current_approver_name}</span>
                      </div>
                    )}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-700 dark:text-slate-300">Produto:</span> 
                        <span className="text-slate-600 dark:text-slate-400">{getProductName(suggestion.product)}</span>
                      </div>
                      
                      {/* Análise de Preço */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 p-3 sm:p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600">
                        <div>
                          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Preço Atual</p>
                          <p className="text-lg font-bold text-slate-800 dark:text-slate-200">
                            {(() => {
                              // Converter de centavos para reais se necessário
                              const price = suggestion.current_price || suggestion.cost_price || 0;
                              const priceInReais = price >= 100 ? price / 100 : price;
                              return priceInReais > 0 ? formatPrice(priceInReais) : 'N/A';
                            })()}
                          </p>
                        </div>
                        
                        <div>
                          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Preço Sugerido</p>
                          <p className="text-lg font-bold text-green-600 dark:text-green-400">
                            {(() => {
                              // Converter de centavos para reais se necessário
                              const price = suggestion.final_price || suggestion.suggested_price || 0;
                              const priceInReais = price >= 100 ? price / 100 : price;
                              return priceInReais > 0 ? formatPrice(priceInReais) : 'N/A';
                            })()}
                          </p>
                        </div>
                        
                        <div>
                          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Ajuste</p>
                          <p className={`text-lg font-bold ${
                            suggestion.margin_cents > 0 
                              ? 'text-green-600 dark:text-green-400' 
                              : 'text-red-600 dark:text-red-400'
                          }`}>
                            {(() => {
                              // Converter valores de centavos para reais
                              const currentPrice = (suggestion.current_price || suggestion.cost_price || 0);
                              const currentPriceReais = currentPrice >= 100 ? currentPrice / 100 : currentPrice;
                              
                              const finalPrice = (suggestion.final_price || suggestion.suggested_price || 0);
                              const finalPriceReais = finalPrice >= 100 ? finalPrice / 100 : finalPrice;
                              
                              const margin = finalPriceReais - currentPriceReais;
                              const marginPercent = currentPriceReais > 0 ? ((margin / currentPriceReais) * 100).toFixed(2) : '0';
                              
                              return (
                                <>
                                  {margin > 0 ? '+' : ''}
                                  {formatPrice(Math.abs(margin))}
                                  {' '}
                                  ({marginPercent}%)
                                </>
                              );
                            })()}
                          </p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                        <div>
                          <span className="font-medium">Criado:</span> {formatDate(suggestion.created_at)}
                        </div>
                        <div>
                          <span className="font-medium">Código:</span> {suggestion.stations?.code || suggestion.station_id || '-'}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedSuggestion(suggestion);
                        setShowDetails(true);
                      }}
                      className="w-full sm:w-auto text-xs sm:text-sm"
                    >
                      <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2 text-slate-600 dark:text-slate-400" />
                      <span className="hidden sm:inline">Ver Detalhes</span>
                      <span className="sm:hidden">Detalhes</span>
                    </Button>
                    
                    {permissions?.permissions?.can_approve && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(suggestion.id)}
                        disabled={loading}
                        className="w-full sm:w-auto text-xs sm:text-sm text-red-600 border-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2 text-red-600" />
                        <span className="hidden sm:inline">Excluir</span>
                        <span className="sm:hidden">Excluir</span>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            
            {individualApprovals.length === 0 && (
              <div className="text-center py-8">
                <p className="text-slate-600 dark:text-slate-400">Nenhuma sugestão encontrada</p>
              </div>
            )}
          </div>
          </>
          )}
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
      onSuggestPrice={(observations, suggestedPrice) => handleSuggestPrice(selectedSuggestion?.id, observations, suggestedPrice)}
      loading={loading}
    />

    {/* Modal para Aprovação em Lote - REMOVIDO - Agora é inline */}
    {/* 
    <Dialog open={showBatchModal} onOpenChange={setShowBatchModal}>
      <DialogContent className="max-w-4xl w-[95vw] sm:w-full mx-4 sm:mx-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg">Aprovar Solicitações em Lote</DialogTitle>
        </DialogHeader>
        {selectedBatch && (
          <div className="space-y-6">
            <div>
              <Label className="text-sm font-semibold">Cliente:</Label>
              <p className="text-sm">{selectedBatch.client?.name || 'N/A'}</p>
            </div>
            
            <Tabs defaultValue="observations" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="observations">Observações</TabsTrigger>
                <TabsTrigger value="prices">Sugerir Preços</TabsTrigger>
              </TabsList>
              
              <TabsContent value="observations" className="space-y-4">
                {selectedBatch.requests.map((req: any) => {
                  const station = req.stations || { name: req.station_id || 'N/A' };
                  return (
                    <div key={req.id} className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg">
                      <Label className="text-sm font-semibold mb-2 block">
                        {station.name} - {getProductName(req.product)}
                      </Label>
                      <Textarea
                        placeholder="Adicione uma observação para esta solicitação..."
                        value={batchObservations[req.id] || ''}
                        onChange={(e) => {
                          setBatchObservations(prev => ({
                            ...prev,
                            [req.id]: e.target.value
                          }));
                        }}
                        className="min-h-[100px]"
                      />
                    </div>
                  );
                })}
              </TabsContent>
              
              <TabsContent value="prices" className="space-y-4">
                {selectedBatch.requests.map((req: any) => {
                  const station = req.stations || { name: req.station_id || 'N/A' };
                  const currentPrice = req.current_price || req.cost_price || 0;
                  const currentPriceReais = currentPrice >= 100 ? currentPrice / 100 : currentPrice;
                  const suggestedPrice = batchSuggestedPrices[req.id] || 0;
                  
                  return (
                    <div key={req.id} className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg">
                      <Label className="text-sm font-semibold mb-2 block">
                        {station.name} - {getProductName(req.product)}
                      </Label>
                      <div className="space-y-2">
                        <div>
                          <Label className="text-xs text-slate-500">Preço Atual:</Label>
                          <p className="text-sm font-semibold">{formatPrice(currentPriceReais)}</p>
                        </div>
                        <div>
                          <Label htmlFor={`price-${req.id}`} className="text-xs">Preço Sugerido (R$/L):</Label>
                          <Input
                            id={`price-${req.id}`}
                            type="number"
                            step="0.01"
                            min="0"
                            value={suggestedPrice}
                            onChange={(e) => {
                              setBatchSuggestedPrices(prev => ({
                                ...prev,
                                [req.id]: parseFloat(e.target.value) || 0
                              }));
                            }}
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </TabsContent>
            </Tabs>
            
            <div className="flex gap-3 pt-4">
              <Button
                onClick={async () => {
                  if (!selectedBatch) return;
                  
                  setLoading(true);
                  try {
                    // Validar que todas as observações foram preenchidas
                    const allHaveObservations = selectedBatch.requests.every((req: any) => {
                      const obs = batchObservations[req.id] || '';
                      return obs.trim().length > 0;
                    });
                    
                    if (!allHaveObservations) {
                      toast.error("Por favor, adicione observações para todas as solicitações");
                      setLoading(false);
                      return;
                    }
                    
                    // Aprovar cada solicitação do lote
                    let successCount = 0;
                    let errorCount = 0;
                    
                    for (const req of selectedBatch.requests) {
                      try {
                        const obs = batchObservations[req.id] || '';
                        const suggestedPrice = batchSuggestedPrices[req.id];
                        
                        // Se houver preço sugerido diferente, atualizar antes de aprovar
                        if (suggestedPrice && suggestedPrice > 0) {
                          const priceInCents = Math.round(suggestedPrice * 100);
                          await supabase
                            .from('price_suggestions')
                            .update({ 
                              final_price: priceInCents,
                              suggested_price: priceInCents
                            })
                            .eq('id', req.id);
                        }
                        
                        await handleApprove(req.id, obs);
                        successCount++;
                      } catch (error) {
                        console.error(`Erro ao aprovar ${req.id}:`, error);
                        errorCount++;
                      }
                    }
                    
                    if (successCount > 0) {
                      toast.success(`${successCount} solicitação(ões) aprovada(s) com sucesso!`);
                    }
                    if (errorCount > 0) {
                      toast.error(`${errorCount} solicitação(ões) falharam ao aprovar`);
                    }
                    
                    setShowBatchModal(false);
                    setSelectedBatch(null);
                    setBatchObservations({});
                    setBatchSuggestedPrices({});
                    loadSuggestions();
                  } catch (error: any) {
                    toast.error("Erro ao aprovar em lote: " + (error?.message || 'Erro desconhecido'));
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              >
                <Check className="h-4 w-4 mr-2" />
                Aprovar Lote
              </Button>
              <Button
                onClick={() => {
                  setShowBatchModal(false);
                  setSelectedBatch(null);
                  setBatchObservations({});
                  setBatchSuggestedPrices({});
                }}
                variant="outline"
                disabled={loading}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
    */}
    
    {/* Modal para Aprovar Lote - Só renderizar lotes da página atual e que estão abertos */}
    {batchApprovals.slice(batchPage * ITEMS_PER_PAGE, (batchPage + 1) * ITEMS_PER_PAGE)
      .filter(batch => showBatchApproveModal[batch.batchKey])
      .map((batch) => (
      <Dialog 
        key={`batch-approve-${batch.batchKey}`}
        open={showBatchApproveModal[batch.batchKey] || false} 
        onOpenChange={(open) => {
          setShowBatchApproveModal(prev => ({
            ...prev,
            [batch.batchKey]: open
          }));
        }}
      >
        <DialogContent className="max-w-md w-[95vw] sm:w-full mx-4 sm:mx-auto">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">Aprovar Lote Completo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-semibold mb-2 block">
                {batch.hasMultipleClients ? (
                  <>Clientes: {batch.clients?.map((c: any) => c?.name || 'N/A').join(', ') || 'Múltiplos'}</>
                ) : (
                  <>Cliente: {batch.client?.name || 'N/A'}</>
                )}
              </Label>
              <p className="text-xs text-slate-500 mb-4">
                {(batch.allRequests || batch.requests).filter((r: any) => r.status === 'pending').length} solicitação(ões) pendente(s) serão aprovadas com a mesma observação
              </p>
            </div>
            <div>
              <Label htmlFor={`batch-obs-${batch.batchKey}`} className="text-xs">Observação para todo o lote:</Label>
              <Textarea
                id={`batch-obs-${batch.batchKey}`}
                placeholder="Digite uma observação que será aplicada a todas as solicitações do lote..."
                value={batchApproveObservation[batch.batchKey] || ''}
                onChange={(e) => {
                  setBatchApproveObservation(prev => ({
                    ...prev,
                    [batch.batchKey]: e.target.value
                  }));
                }}
                className="min-h-[120px] mt-2"
                rows={5}
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-2">
              <Button
                onClick={async () => {
                  const observation = batchApproveObservation[batch.batchKey] || '';
                  if (!observation.trim()) {
                    toast.error("Observação é obrigatória para aprovar o lote");
                    return;
                  }
                  
                  setLoading(true);
                  try {
                    // Usar allRequests se disponível, senão usar requests
                    const requestsToApprove = batch.allRequests || batch.requests;
                    
                    // Filtrar apenas solicitações pendentes
                    const pendingRequests = requestsToApprove.filter((req: any) => req.status === 'pending');
                    
                    if (pendingRequests.length === 0) {
                      toast.error("Nenhuma solicitação pendente para aprovar neste lote.");
                      setLoading(false);
                      return;
                    }
                    
                    // Validar todas as solicitações em PARALELO (muito mais rápido)
                    console.log(`🔍 Validando ${pendingRequests.length} solicitação(ões) em paralelo...`);
                    const validationPromises = pendingRequests.map(req => 
                      canUserApproveSuggestion(req).then(validation => ({ req, validation }))
                    );
                    const validationResults = await Promise.all(validationPromises);
                    
                    // Separar válidas e inválidas
                    const validRequests: any[] = [];
                    const invalidRequests: Array<{ id: string; reason: string }> = [];
                    
                    validationResults.forEach(({ req, validation }) => {
                      if (validation.canApprove) {
                        validRequests.push(req);
                      } else {
                        invalidRequests.push({ id: req.id, reason: validation.reason || 'Não autorizado' });
                      }
                    });
                    
                    // Se houver solicitações inválidas, bloquear TODA a aprovação do lote
                    if (invalidRequests.length > 0) {
                      const reasons = invalidRequests.map(r => r.reason).join('; ');
                      toast.error(`${invalidRequests.length} solicitação(ões) do lote não podem ser aprovadas: ${reasons}. Aprovação do lote cancelada.`);
                      setLoading(false);
                      return;
                    }
                    
                    // Se não há solicitações válidas pendentes, avisar
                    if (validRequests.length === 0) {
                      toast.error("Nenhuma solicitação pendente válida para aprovar neste lote.");
                      setLoading(false);
                      return;
                    }
                    
                    // Aprovar todas as solicitações em PARALELO (muito mais rápido)
                    console.log(`✅ Aprovando ${validRequests.length} solicitação(ões) em paralelo...`);
                    const approvePromises = validRequests.map(req => 
                      handleApprove(req.id, observation).then(() => ({ success: true, id: req.id }))
                        .catch((error) => {
                          console.error(`Erro ao aprovar ${req.id}:`, error);
                          return { success: false, id: req.id, error };
                        })
                    );
                    const approveResults = await Promise.all(approvePromises);
                    
                    const successCount = approveResults.filter(r => r.success).length;
                    const errorCount = approveResults.filter(r => !r.success).length;
                    
                    if (successCount > 0) {
                      toast.success(`${successCount} solicitação(ões) do lote aprovada(s) com sucesso!`);
                    }
                    if (errorCount > 0) {
                      toast.error(`${errorCount} solicitação(ões) falharam ao aprovar`);
                    }
                    
                    setShowBatchApproveModal(prev => ({
                      ...prev,
                      [batch.batchKey]: false
                    }));
                    setBatchApproveObservation(prev => ({
                      ...prev,
                      [batch.batchKey]: ''
                    }));
                    
                    // Recarregar sem cache para ver atualizações imediatas
                    loadSuggestions(false);
                  } catch (error: any) {
                    console.error('Erro ao aprovar lote:', error);
                    toast.error("Erro ao aprovar lote: " + (error?.message || 'Erro desconhecido'));
                  } finally {
                    setLoading(false);
                  }
                }}
                className="flex-1 w-full sm:w-auto text-xs sm:text-sm"
                disabled={loading || !batchApproveObservation[batch.batchKey]?.trim()}
              >
                Aprovar Lote
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowBatchApproveModal(prev => ({
                    ...prev,
                    [batch.batchKey]: false
                  }));
                }}
                className="flex-1 sm:flex-none w-full sm:w-auto text-xs sm:text-sm"
              >
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    ))}
    </div>
  );
}