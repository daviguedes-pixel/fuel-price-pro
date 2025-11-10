// @ts-nocheck
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

  // Buscar regra de aprovação baseada na margem
  const getApprovalRuleForMargin = async (marginCents: number) => {
    try {
      const { data, error } = await supabase.rpc('get_approval_margin_rule', {
        margin_cents: marginCents
      });

      if (error) {
        // Se a função não existir, pode ser que a tabela não tenha sido criada
        if (error.code === '42883' || error.message?.includes('function') || error.message?.includes('does not exist')) {
          console.warn('Função get_approval_margin_rule não encontrada. Execute a migração 20250131000005_ensure_approval_margin_rules.sql no Supabase.');
          return null;
        }
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
  const loadApprovers = async (requiredProfiles?: string[]) => {
    try {
      // Buscar ordem hierárquica do banco de dados
      let approvalOrder: string[] = [];
      try {
        const { data: orderData, error: orderError } = await supabase
          .rpc('get_approval_profile_order');
        
        if (!orderError && orderData && Array.isArray(orderData)) {
          approvalOrder = orderData.map((item: any) => item.perfil).filter(Boolean);
        }
      } catch (error) {
        console.warn('Erro ao buscar ordem de aprovação do banco, usando ordem padrão:', error);
      }
      
      // Se não encontrou ordem no banco, usar ordem padrão
      if (approvalOrder.length === 0) {
        approvalOrder = [
          'supervisor_comercial',
          'diretor_comercial', 
          'diretor_pricing'
        ];
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
      
      console.log('🔍 Perfis ordenados para buscar:', orderedProfiles);
      
      for (const perfil of orderedProfiles) {
        console.log(`🔍 Buscando usuários com perfil: ${perfil}`);
        
        const { data: users, error: usersError } = await supabase
          .from('user_profiles')
          .select('user_id, email, perfil, nome')
          .eq('perfil', perfil)
          .order('email');
        
        if (usersError) {
          console.error(`❌ Erro ao buscar usuários do perfil ${perfil}:`, usersError);
          console.error(`❌ Código do erro:`, usersError.code);
          console.error(`❌ Mensagem:`, usersError.message);
          continue;
        }
        
        console.log(`✅ Usuários encontrados para perfil ${perfil}:`, users?.length || 0);
        if (users && users.length > 0) {
          console.log(`   👤 Usuários:`, users.map(u => ({ email: u.email, perfil: u.perfil })));
          approvers.push(...users);
        } else {
          console.log(`   ⚠️ Nenhum usuário encontrado com perfil ${perfil}`);
        }
      }
      
      console.log('👥 Usuários que podem aprovar (em ordem):', approvers);
      console.log('👥 Total de aprovadores encontrados:', approvers.length);
      
      return approvers;
    } catch (error) {
      console.error('Erro ao carregar aprovadores:', error);
      return [];
    }
  };

  const loadSuggestions = async () => {
    try {
      console.log('=== CARREGANDO SUGESTÕES ===');
      
      // Carregar sugestões sem JOINs (os IDs agora são TEXT)
      const { data, error } = await supabase
        .from('price_suggestions')
        .select('*')
        .order('created_at', { ascending: false });

      console.log('🔍 Total de sugestões carregadas:', data?.length);
      console.log('📊 Dados carregados (primeiras 3):', data?.slice(0, 3));
      console.log('Erro:', error);
      
      // Log detalhado de IDs salvos
      data?.forEach((s, i) => {
        console.log(`\n📝 Sugestão ${i + 1}:`, {
          id: s.id,
          station_id: s.station_id,
          client_id: s.client_id,
          created_at: s.created_at
        });
      });

      if (error) {
        console.error('Erro na consulta:', error);
        throw error;
      }

      // Carregar postos, clientes (filtrados por assessor) e métodos de pagamento separadamente
      const [stationsRes, clientsFiltered, paymentMethodsRes] = await Promise.all([
        supabase.rpc('get_sis_empresa_stations').then(res => ({ data: res.data, error: res.error })),
        // Tentar usar RPC que filtra por assessor; se falhar, faz fallback para a tabela inteira
        supabase.rpc('get_clientes_por_assessor')
          .then(res => ({
            data: res.data,
            error: res.error,
            source: 'rpc'
          }))
          .catch(err => ({
            data: null,
            error: err,
            source: 'rpc-error'
          })),
        supabase.from('tipos_pagamento' as any).select('CARTAO, TAXA, PRAZO, ID_POSTO')
      ]);

      // Fallback: se o RPC não existir, buscar diretamente
      let clientsRes: any = clientsFiltered;
      if (!clientsFiltered?.data || (clientsFiltered as any)?.error) {
        console.warn('⚠️ RPC get_clientes_por_assessor indisponível. Fazendo fallback para public.clientes');
        const { data: clientsAll, error: clientsErr } = await supabase
          .from('clientes' as any)
          .select('id_cliente, nome');
        clientsRes = { data: clientsAll, error: clientsErr, source: 'table' };
      }

      console.log('✅ stationsRes (completo):', JSON.stringify(stationsRes, null, 2));
      console.log('✅ clientsRes (completo):', JSON.stringify(clientsRes, null, 2));
      console.log('📊 Total de stations:', (stationsRes.data as any)?.length);
      console.log('📊 Total de clients:', (clientsRes.data as any)?.length);
      
      // Mostrar estrutura do primeiro station
      if (stationsRes.data && (stationsRes.data as any).length > 0) {
        console.log('📋 Estrutura do primeiro station:', (stationsRes.data as any)[0]);
      }
      
      // Mostrar estrutura do primeiro client
      if (clientsRes.data && (clientsRes.data as any).length > 0) {
        console.log('📋 Estrutura do primeiro client:', (clientsRes.data as any)[0]);
      }

      // Enriquecer dados localmente
      const enrichedData = (data || []).map((suggestion: any) => {
        console.log('\n🔍 Processando sugestão:', suggestion.id);
        console.log('   station_id:', suggestion.station_id);
        console.log('   client_id:', suggestion.client_id);
        
        // Buscar posto - tentar várias formas
        let station = null;
        if (suggestion.station_id) {
          console.log('   🔎 Buscando posto para:', suggestion.station_id);
          
          station = (stationsRes.data as any)?.find((s: any) => {
            const stationId = String(s.id || s.id_empresa || s.cnpj_cpf || '');
            const suggId = String(suggestion.station_id);
            
            const match1 = stationId === suggId;
            const match2 = s.cnpj_cpf === suggId;
            const match3 = s.id_empresa === suggId;
            const match4 = s.id === suggId;
            
            if (match1 || match2 || match3 || match4) {
              console.log('   ✅ MATCH encontrado:', s);
            }
            
            return match1 || match2 || match3 || match4;
          });
          
          if (station) {
            console.log('   ✅ Posto encontrado:', station);
          } else {
            console.log('   ❌ Posto NÃO encontrado');
            console.log('   🗂️ Primeiros IDs disponíveis:', (stationsRes.data as any)?.slice(0, 3).map((s: any) => ({ 
              id: s.id, 
              id_empresa: s.id_empresa, 
              cnpj_cpf: s.cnpj_cpf,
              nome: s.nome_empresa 
            })));
          }
        }
        
        // Buscar cliente
        let client = null;
        if (suggestion.client_id) {
          console.log('   🔎 Buscando cliente para:', suggestion.client_id);
          
          client = (clientsRes.data as any)?.find((c: any) => {
            const clientId = String(c.id_cliente || c.id || '');
            const suggId = String(suggestion.client_id);
            
            if (clientId === suggId) {
              console.log('   ✅ MATCH cliente encontrado:', c);
            }
            
            return clientId === suggId;
          });
          
          if (client) {
            console.log('   ✅ Cliente encontrado:', client);
          } else {
            console.log('   ❌ Cliente NÃO encontrado');
            console.log('   🗂️ Primeiros IDs disponíveis:', (clientsRes.data as any)?.slice(0, 3).map((c: any) => ({ 
              id: c.id, 
              id_cliente: c.id_cliente, 
              nome: c.nome 
            })));
          }
        }
        
        // Buscar tipo de pagamento
        const paymentMethod = paymentMethodsRes.data?.find((pm: any) => 
          pm.CARTAO === suggestion.payment_method_id ||
          String(pm.ID_POSTO) === String(suggestion.payment_method_id)
        );

        console.log('   resultado - station:', station?.nome_empresa || station?.name || 'não encontrado');
        console.log('   resultado - client:', client?.nome || client?.name || 'não encontrado');
        
        return {
          ...suggestion,
          stations: station ? { name: station.nome_empresa || station.name, code: station.cnpj_cpf || station.id || station.id_empresa } : null,
          clients: client ? { name: client.nome || client.name, code: String(client.id_cliente || client.id) } : null,
          payment_methods: paymentMethod ? { 
            name: paymentMethod.CARTAO,
            TAXA: paymentMethod.TAXA,
            PRAZO: paymentMethod.PRAZO
          } : null
        };
      });
      
      // Filtrar aprovações para mostrar apenas as que estão no nível do usuário atual
      // Usar configurações dinâmicas de margem
      const allApprovers = await loadApprovers();
      
      // Enriquecer com informação de qual usuário está com a aprovação
      // Usando regras de aprovação dinâmicas baseadas em margem
      const enrichedWithCurrentApprover = await Promise.all(enrichedData.map(async (suggestion) => {
        if (suggestion.status !== 'pending') {
          return suggestion;
        }
        
        // Buscar regra de aprovação baseada na margem
        const marginCents = suggestion.margin_cents || 0;
        const approvalRule = await getApprovalRuleForMargin(marginCents);
        
        // Se houver regra configurada, usar os perfis da regra
        // Caso contrário, usar todos os aprovadores (comportamento padrão)
        let approversForThisSuggestion = allApprovers;
        let requiredProfiles: string[] | undefined = undefined;
        
        if (approvalRule && approvalRule.required_profiles) {
          requiredProfiles = approvalRule.required_profiles;
          approversForThisSuggestion = await loadApprovers(requiredProfiles);
        }
        
        const currentLevel = suggestion.approval_level || 1;
        
        // Mapear approval_level para índice do array de aprovadores
        // Se há regra específica, precisamos calcular o índice baseado nos perfis requeridos
        let approverIndex: number;
        let currentApprover: any = null;
        
        if (approvalRule && requiredProfiles && requiredProfiles.length > 0) {
          // Se há regra específica (margem baixa), calcular qual aprovador está com a aprovação
          // baseado no approval_level atual e na lista de perfis requeridos
          
          // Buscar a lista completa de aprovadores para mapear o approval_level
          const allApproversOrdered = await loadApprovers();
          
          // Se não encontrou aprovadores nos perfis requeridos, buscar usuários diretamente
          if (approversForThisSuggestion.length === 0) {
            console.warn('⚠️ Nenhum aprovador encontrado nos perfis requeridos, buscando diretamente...');
            
            // Buscar usuários diretamente pelos perfis requeridos
            const { data: directUsers, error: directError } = await supabase
              .from('user_profiles')
              .select('user_id, email, perfil, nome')
              .in('perfil', requiredProfiles)
              .order('email');
            
            if (!directError && directUsers && directUsers.length > 0) {
              console.log('✅ Usuários encontrados diretamente:', directUsers.length);
              approversForThisSuggestion = directUsers;
            }
          }
          
          if (approversForThisSuggestion.length > 0) {
            // Encontrar qual aprovador corresponde ao approval_level atual na lista completa
            const approverAtCurrentLevel = allApproversOrdered[currentLevel - 1];
            
            if (approverAtCurrentLevel && requiredProfiles.includes(approverAtCurrentLevel.perfil)) {
              // O aprovador no nível atual está na lista de perfis requeridos
              // Encontrar seu índice na lista filtrada
              approverIndex = approversForThisSuggestion.findIndex(a => a.user_id === approverAtCurrentLevel.user_id);
              if (approverIndex >= 0) {
                currentApprover = approversForThisSuggestion[approverIndex];
              } else {
                // Se não encontrou, usar o primeiro da lista filtrada
                currentApprover = approversForThisSuggestion[0];
                approverIndex = 0;
              }
            } else {
              // O aprovador no nível atual não está na lista de perfis requeridos
              // Usar o primeiro da lista de perfis requeridos
              currentApprover = approversForThisSuggestion[0];
              approverIndex = 0;
            }
          } else {
            // Se ainda não encontrou, buscar todos e filtrar
            console.warn('⚠️ Ainda sem aprovadores, buscando todos e filtrando...');
            const allApproversFallback = await loadApprovers();
            const filtered = allApproversFallback.filter(a => requiredProfiles.includes(a.perfil));
            if (filtered.length > 0) {
              currentApprover = filtered[0];
              approverIndex = 0;
            } else if (allApproversFallback.length > 0) {
              // Fallback: usar o primeiro de todos se não encontrou nos perfis requeridos
              currentApprover = allApproversFallback[0];
              approverIndex = 0;
            }
          }
        } else {
          // Comportamento padrão: índice direto baseado no approval_level
          approverIndex = currentLevel - 1;
          currentApprover = approversForThisSuggestion[approverIndex];
          
          // Se não encontrou no índice calculado, usar o primeiro disponível
          if (!currentApprover && approversForThisSuggestion.length > 0) {
            currentApprover = approversForThisSuggestion[0];
          }
        }
        
        // Garantir que sempre mostre um aprovador se houver aprovadores disponíveis
        // Mesmo com margem baixa, deve mostrar quem está com a aprovação
        if (!currentApprover && approversForThisSuggestion.length > 0) {
          currentApprover = approversForThisSuggestion[0];
        }
        
        return {
          ...suggestion,
          current_approver_name: currentApprover?.email || null,
          current_approver_id: currentApprover?.user_id || null,
          is_current_user_turn: currentApprover?.user_id === user?.id || false,
          requires_directors_only: approvalRule ? true : false,
          approval_rule: approvalRule, // Guardar a regra para uso posterior
        };
      }));
      
      // Filtrar para mostrar apenas aprovações pendentes que estão no turno do usuário atual
      // OU se o usuário tem permissão de admin, mostrar todas
      const canViewAll = permissions?.permissions?.admin || false;
      const filteredForUser = canViewAll 
        ? enrichedWithCurrentApprover 
        : enrichedWithCurrentApprover.filter(s => 
            s.status !== 'pending' || s.is_current_user_turn
          );
      
      console.log(`📊 Total de aprovações: ${enrichedData.length}`);
      console.log(`👁️ Aprovações visíveis para o usuário: ${filteredForUser.length}`);
      
      setSuggestions(enrichedWithCurrentApprover);
      setFilteredSuggestions(filteredForUser);
      
      // Calculate stats
      const total = enrichedData.length;
      const pending = enrichedWithCurrentApprover.filter(s => s.status === 'pending').length;
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
    console.log('🔵 handleApprove chamado para:', suggestionId);
    
    if (!observations.trim()) {
      toast.error("Por favor, adicione uma observação");
      return;
    }

    setLoading(true);
    try {
      // Buscar a sugestão atual
      console.log('🔍 Buscando sugestão:', suggestionId);
      const { data: currentSuggestion, error: fetchError } = await supabase
        .from('price_suggestions')
        .select('*')
        .eq('id', suggestionId)
        .single();

      if (fetchError) throw fetchError;
      
      console.log('✅ Sugestão encontrada:', currentSuggestion);
      console.log('👤 requested_by:', currentSuggestion.requested_by);

      // Buscar regra de aprovação baseada na margem
      const marginCents = currentSuggestion.margin_cents || 0;
      const approvalRule = await getApprovalRuleForMargin(marginCents);
      
      console.log('💰 Margem em centavos:', marginCents);
      console.log('📋 Regra de aprovação encontrada:', approvalRule);
      
      // Determinar perfis requeridos baseado na regra
      const requiredProfiles = approvalRule?.required_profiles || undefined;
      
      // Buscar aprovadores apropriados baseado na regra
      const allApprovers = await loadApprovers();
      let approvers: any[] = [];
      let totalApprovers = 1;
      
      if (requiredProfiles && requiredProfiles.length > 0) {
        // Filtrar apenas os perfis requeridos pela regra
        approvers = await loadApprovers(requiredProfiles);
        
        console.log('📋 Aprovadores encontrados para perfis requeridos:', approvers.length);
        console.log('📋 Aprovadores:', approvers.map(a => ({ email: a.email, perfil: a.perfil })));
        
        // Se não encontrou aprovadores, buscar diretamente do banco
        if (approvers.length === 0) {
          console.warn('⚠️ Nenhum aprovador encontrado via loadApprovers, buscando diretamente...');
          const { data: directUsers, error: directError } = await supabase
            .from('user_profiles')
            .select('user_id, email, perfil, nome')
            .in('perfil', requiredProfiles)
            .order('email');
          
          if (!directError && directUsers && directUsers.length > 0) {
            console.log('✅ Usuários encontrados diretamente:', directUsers.length);
            approvers = directUsers;
          }
        }
        
        // Buscar o perfil do usuário atual
        const { data: currentUserProfileData, error: profileError } = await supabase
          .from('user_profiles')
          .select('user_id, email, perfil')
          .eq('user_id', user?.id)
          .single();
        
        if (profileError) {
          console.error('❌ Erro ao buscar perfil do usuário atual:', profileError);
        }
        
        console.log('👤 Perfil do usuário atual:', currentUserProfileData?.perfil);
        console.log('📋 Perfis requeridos:', requiredProfiles);
        
        // IMPORTANTE: Com margem baixa, qualquer um pode adicionar observações
        // mas só os diretores podem aprovar. Não bloquear aqui, apenas verificar se pode aprovar
        const canApprove = currentUserProfileData && requiredProfiles.includes(currentUserProfileData.perfil);
        
        if (!canApprove) {
          // Usuário não tem perfil para aprovar, mas pode adicionar observações
          // Não bloquear, apenas avisar que a aprovação requer diretores
          console.log('ℹ️ Usuário não tem perfil para aprovar, mas pode adicionar observações');
        }
        
        // Se não encontrou aprovadores, mas há perfis requeridos, criar lista vazia
        // A aprovação só acontece quando diretores aprovarem
        totalApprovers = approvers.length > 0 ? approvers.length : requiredProfiles.length;
      } else {
        // Usar todos os aprovadores normalmente (sem regra específica)
        approvers = allApprovers;
        totalApprovers = approvers.length > 0 ? approvers.length : 1;
      }
      
      console.log('📋 Aprovadores encontrados:', approvers.length);
      console.log('📝 IDs dos aprovadores:', approvers.map(a => ({ id: a.user_id, email: a.email, perfil: a.perfil })));
      
      // Ajustar approval_level inicial se necessário
      let currentLevel = currentSuggestion.approval_level || 1;
      
      // Se há regra específica (margem baixa), ajustar approval_level para o primeiro perfil requerido
      if (approvalRule && requiredProfiles && requiredProfiles.length > 0) {
        // Encontrar o índice do primeiro perfil requerido na lista completa
        const firstRequiredProfileIndex = allApprovers.findIndex(a => requiredProfiles.includes(a.perfil));
        if (firstRequiredProfileIndex >= 0) {
          const firstRequiredLevel = firstRequiredProfileIndex + 1; // approval_level é 1-indexed
          
          // Se o approval_level atual é menor que o primeiro nível requerido, ajustar
          if (currentLevel < firstRequiredLevel) {
            currentLevel = firstRequiredLevel;
            console.log('⚠️ Ajustando approval_level para', currentLevel, 'baseado na regra de margem baixa');
            
            // Atualizar o approval_level no banco
            await supabase
              .from('price_suggestions')
              .update({ approval_level: currentLevel })
              .eq('id', suggestionId);
          }
        }
      }
      
      console.log('🔍 Approval level atual:', currentLevel);
      console.log('👤 Usuário atual:', user?.email);
      
      const approvalsCount = (currentSuggestion.approvals_count || 0) + 1;
      
      // Ajustar índice do aprovador baseado na regra
      // IMPORTANTE: Com margem baixa, verificar se o usuário atual tem o perfil correto para o nível atual
      let approverIndex: number;
      if (approvalRule && requiredProfiles && requiredProfiles.length > 0) {
        // Buscar ordem dos perfis
        const approvalOrderForCheck = await (async () => {
          try {
            const { data: orderData } = await supabase.rpc('get_approval_profile_order');
            if (orderData && Array.isArray(orderData)) {
              return orderData.map((item: any) => item.perfil).filter(Boolean);
            }
          } catch (error) {
            console.warn('Erro ao buscar ordem de aprovação:', error);
          }
          return ['supervisor_comercial', 'diretor_comercial', 'diretor_pricing'];
        })();
        
        // Verificar qual perfil corresponde ao approval_level atual
        const profileAtCurrentLevel = approvalOrderForCheck[currentLevel - 1];
        console.log('🔍 Perfil no nível atual (', currentLevel, '):', profileAtCurrentLevel);
        console.log('🔍 Perfil do usuário atual:', currentUserProfileData?.perfil);
        
        // Verificar se o usuário atual tem o perfil correto para o nível atual
        if (profileAtCurrentLevel && currentUserProfileData?.perfil === profileAtCurrentLevel) {
          // Usuário tem o perfil correto - encontrar no array de aprovadores
          approverIndex = approvers.findIndex(a => a.user_id === user?.id);
          
          if (approverIndex < 0) {
            // Se não encontrou, buscar no array completo
            const indexInFullList = allApprovers.findIndex(a => a.user_id === user?.id);
            if (indexInFullList >= 0) {
              // Encontrar no array filtrado baseado no perfil
              approverIndex = approvers.findIndex(a => a.perfil === currentUserProfileData.perfil);
            }
            
            if (approverIndex < 0) {
              approverIndex = 0;
            }
          }
        } else {
          // Usuário não tem o perfil correto para o nível atual
          // Verificar se tem algum perfil requerido
          if (currentUserProfileData && requiredProfiles.includes(currentUserProfileData.perfil)) {
            // Tem perfil requerido, mas não é o do nível atual
            // Encontrar índice baseado no perfil do usuário
            approverIndex = approvers.findIndex(a => a.perfil === currentUserProfileData.perfil);
            if (approverIndex < 0) {
              approverIndex = 0;
            }
          } else {
            // Não tem perfil requerido - usar primeiro da lista
            approverIndex = 0;
          }
        }
        
        console.log('🔍 Índice do aprovador calculado:', approverIndex);
      } else {
        approverIndex = currentLevel - 1;
      }
      
      // PRIMEIRO: Verificar se o usuário tem perfil para aprovar (independente do array estar vazio)
      const { data: currentUserProfileData } = await supabase
        .from('user_profiles')
        .select('user_id, email, perfil')
        .eq('user_id', user?.id)
        .single();
      
      const hasRequiredProfile = currentUserProfileData && requiredProfiles && requiredProfiles.length > 0 
        ? requiredProfiles.includes(currentUserProfileData.perfil)
        : false;
      
      console.log('👤 Perfil do usuário:', currentUserProfileData?.perfil);
      console.log('📋 Perfis requeridos:', requiredProfiles);
      console.log('✅ Usuário tem perfil requerido?', hasRequiredProfile);
      
      // IMPORTANTE: Verificar se o usuário tem o perfil CORRETO para o nível atual
      // Com margem baixa, o usuário só pode aprovar se tiver o perfil que corresponde ao approval_level atual
      let canUserApproveAtCurrentLevel = false;
      
      if (approvalRule && requiredProfiles && requiredProfiles.length > 0) {
        // Buscar ordem dos perfis novamente (já foi buscada acima, mas vamos garantir)
        const approvalOrderForValidation = await (async () => {
          try {
            const { data: orderData } = await supabase.rpc('get_approval_profile_order');
            if (orderData && Array.isArray(orderData)) {
              return orderData.map((item: any) => item.perfil).filter(Boolean);
            }
          } catch (error) {
            console.warn('Erro ao buscar ordem de aprovação:', error);
          }
          return ['supervisor_comercial', 'diretor_comercial', 'diretor_pricing'];
        })();
        
        // Verificar qual perfil corresponde ao approval_level atual
        const profileAtCurrentLevel = approvalOrderForValidation[currentLevel - 1];
        console.log('🔍 Validação: Perfil no nível', currentLevel, ':', profileAtCurrentLevel);
        console.log('🔍 Validação: Perfil do usuário:', currentUserProfileData?.perfil);
        
        // Usuário só pode aprovar se tiver o perfil que corresponde ao nível atual
        canUserApproveAtCurrentLevel = currentUserProfileData?.perfil === profileAtCurrentLevel;
        console.log('✅ Usuário tem o perfil correto para o nível atual?', canUserApproveAtCurrentLevel);
      }
      
      // Verificar se o usuário atual pode aprovar (baseado no array OU no perfil correto)
      const currentApprover = approvers[approverIndex];
      const canUserApproveFromArray = currentApprover && currentApprover.user_id === user?.id;
      
      // Com margem baixa, só pode aprovar se tiver o perfil correto para o nível atual
      const canUserApprove = canUserApproveFromArray || (canUserApproveAtCurrentLevel && approvalRule);
      
      console.log('✅ Pode aprovar (do array)?', canUserApproveFromArray);
      console.log('✅ Pode aprovar (perfil correto para o nível)?', canUserApproveAtCurrentLevel);
      console.log('✅ Pode aprovar (final)?', canUserApprove);
      
      // Se há regra de margem baixa e usuário NÃO tem perfil para aprovar OU não tem o perfil correto para o nível atual
      // Permitir adicionar observações, mas também passar para o próximo perfil
      const canAddObservationOnly = approvalRule && requiredProfiles && requiredProfiles.length > 0 
        && (!hasRequiredProfile || !canUserApproveAtCurrentLevel);
      
      if (canAddObservationOnly) {
        // Usuário não tem perfil para aprovar, mas pode adicionar observações
        // Adicionar observação no histórico
        const { error: historyError } = await supabase
          .from('approval_history')
          .insert({
            suggestion_id: suggestionId,
            approver_id: user?.id,
            approver_name: user?.email || 'Usuário',
            action: 'approved', // Usar 'approved' para histórico
            observations: observations,
            approval_level: currentLevel
          });
        
        if (historyError) throw historyError;
        
        console.log('ℹ️ Usuário adicionou observação, mas também vai passar para o próximo perfil');
        
        // IMPORTANTE: Mesmo adicionando apenas observação, deve avançar o approval_level
        // Continuar o fluxo para calcular o próximo nível e atualizar
        // Não retornar aqui, deixar o código continuar para atualizar o approval_level
      }
      
      // Verificar se o usuário atual é o próximo aprovador na sequência
      // IMPORTANTE: Com margem baixa, só pode aprovar se tiver o perfil correto para o nível atual
      if (!canUserApprove && !canAddObservationOnly) {
        // Buscar ordem novamente para mostrar mensagem de erro
        let profileAtCurrentLevel = 'desconhecido';
        try {
          const { data: orderData } = await supabase.rpc('get_approval_profile_order');
          if (orderData && Array.isArray(orderData)) {
            const approvalOrder = orderData.map((item: any) => item.perfil).filter(Boolean);
            profileAtCurrentLevel = approvalOrder[currentLevel - 1] || 'desconhecido';
          }
        } catch (error) {
          console.warn('Erro ao buscar ordem:', error);
        }
        
        toast.error(
          `Você não pode aprovar neste nível. Este nível requer perfil: ${profileAtCurrentLevel}. Seu perfil: ${currentUserProfileData?.perfil || 'desconhecido'}`
        );
        setLoading(false);
        return;
      }
      
      // Registrar no histórico (se ainda não foi registrado)
      if (!(approvalRule && requiredProfiles && requiredProfiles.length > 0 && !hasRequiredProfile)) {
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
      }

      // Verificar se é o último aprovador
      let nextLevel: number;
      let newStatus: string;
      let finalLevel: number;
      
      if (approvalRule && requiredProfiles && requiredProfiles.length > 0) {
        // REGRA ESPECIAL: Margem baixa - sempre passa para o próximo, mesmo quando aprova
        // A aprovação passa pela equipe para juntar observações, mas não aprova direto
        
        console.log('📊 Margem baixa detectada - regra especial aplicada');
        console.log('📊 Perfis requeridos:', requiredProfiles);
        console.log('📊 Aprovadores encontrados:', approvers.length);
        console.log('📊 Approval level atual:', currentLevel);
        console.log('👤 Perfil do usuário que está aprovando:', currentUserProfileData?.perfil);
        
        // Buscar ordem dos perfis na lista completa
        const approvalOrder = await (async () => {
          try {
            const { data: orderData } = await supabase.rpc('get_approval_profile_order');
            if (orderData && Array.isArray(orderData)) {
              return orderData.map((item: any) => item.perfil).filter(Boolean);
            }
          } catch (error) {
            console.warn('Erro ao buscar ordem de aprovação:', error);
          }
          return ['supervisor_comercial', 'diretor_comercial', 'diretor_pricing'];
        })();
        
        // Determinar qual perfil requerido está no approval_level atual
        // Se o usuário tem perfil requerido, usar o perfil dele para determinar a posição
        let effectiveProfileIndex = -1;
        let currentRequiredProfile = null;
        
        // Primeiro, tentar encontrar qual perfil requerido corresponde ao approval_level atual
        const currentProfileInOrder = approvalOrder[currentLevel - 1];
        effectiveProfileIndex = requiredProfiles.findIndex(p => p === currentProfileInOrder);
        currentRequiredProfile = currentProfileInOrder;
        
        // Se não encontrou no nível atual, buscar o primeiro perfil requerido que vem depois
        if (effectiveProfileIndex < 0) {
          for (let i = currentLevel - 1; i < approvalOrder.length; i++) {
            const profileAtLevel = approvalOrder[i];
            const indexInRequired = requiredProfiles.findIndex(p => p === profileAtLevel);
            if (indexInRequired >= 0) {
              effectiveProfileIndex = indexInRequired;
              currentRequiredProfile = profileAtLevel;
              console.log('📊 Perfil requerido encontrado no nível', i + 1, ':', profileAtLevel);
              break;
            }
          }
        }
        
        // Se ainda não encontrou, usar o primeiro perfil requerido
        if (effectiveProfileIndex < 0 && requiredProfiles.length > 0) {
          effectiveProfileIndex = 0;
          currentRequiredProfile = requiredProfiles[0];
          console.log('📊 Usando primeiro perfil requerido:', currentRequiredProfile);
        }
        
        console.log('📊 Perfil requerido atual determinado:', currentRequiredProfile);
        console.log('📊 Índice efetivo nos requeridos:', effectiveProfileIndex);
        
        console.log('📊 Perfil requerido atual:', currentRequiredProfile);
        console.log('📊 Índice efetivo nos requeridos:', effectiveProfileIndex);
        
        // Verificar se é o último perfil requerido
        const isLastRequiredProfile = (effectiveProfileIndex + 1) >= requiredProfiles.length;
        
        // IMPORTANTE: Com margem baixa, NUNCA aprovar automaticamente
        // Sempre passar para o próximo perfil requerido até TODOS os diretores aprovarem
        // Verificar histórico para garantir que todos aprovaram antes de aprovar completamente
        if (isLastRequiredProfile && effectiveProfileIndex >= 0) {
          // Verificar se todos os diretores já aprovaram checando o histórico
          const { data: approvalHistory } = await supabase
            .from('approval_history')
            .select('approver_id, action')
            .eq('suggestion_id', suggestionId)
            .eq('action', 'approved');
          
          // Buscar todos os usuários com os perfis requeridos
          const { data: requiredUsers } = await supabase
            .from('user_profiles')
            .select('user_id, perfil')
            .in('perfil', requiredProfiles);
          
          const approverIds = approvalHistory?.map(h => h.approver_id).filter(Boolean) || [];
          const requiredUserIds = requiredUsers?.map(u => u.user_id) || [];
          
          // Verificar se pelo menos um usuário de cada perfil requerido já aprovou
          const allProfilesApproved = requiredProfiles.every(profile => {
            const usersWithProfile = requiredUsers?.filter(u => u.perfil === profile) || [];
            if (usersWithProfile.length === 0) return false; // Se não há usuários com esse perfil, não pode aprovar
            return usersWithProfile.some(u => approverIds.includes(u.user_id));
          });
          
          console.log('📊 Verificando aprovações dos diretores...');
          console.log('📊 Perfis requeridos:', requiredProfiles);
          console.log('📊 Usuários com perfis requeridos:', requiredUsers?.length || 0);
          console.log('📊 Aprovadores no histórico:', approverIds.length);
          console.log('📊 Todos os perfis têm pelo menos um aprovador?', allProfilesApproved);
          
          if (allProfilesApproved && requiredProfiles.length > 0) {
            // Todos os perfis requeridos têm pelo menos um aprovador - aprovar completamente
            newStatus = 'approved';
            finalLevel = currentLevel;
            console.log('✅ Todos os diretores aprovaram - aprovando completamente');
          } else {
            // Ainda há perfis que não foram aprovados - continuar fluxo
            console.log('⚠️ Ainda há perfis sem aprovação - continuando para próximo perfil');
            
            // Buscar o próximo perfil requerido na ordem
            const nextRequiredProfileIndex = (effectiveProfileIndex + 1) % requiredProfiles.length;
            const nextRequiredProfile = requiredProfiles[nextRequiredProfileIndex];
            const nextProfileIndexInOrder = approvalOrder.findIndex(p => p === nextRequiredProfile);
            
            nextLevel = nextProfileIndexInOrder >= 0 ? nextProfileIndexInOrder + 1 : currentLevel + 1;
            newStatus = 'pending';
            finalLevel = nextLevel;
            console.log('➡️ Passando para próximo perfil requerido:', nextRequiredProfile, '(nível', finalLevel, ')');
          }
        } else {
          // Ainda há mais perfis requeridos - passar para o próximo
          const nextRequiredProfileIndex = effectiveProfileIndex >= 0 ? effectiveProfileIndex + 1 : 0;
          const nextRequiredProfile = requiredProfiles[nextRequiredProfileIndex];
          console.log('➡️ Próximo perfil requerido (índice', nextRequiredProfileIndex, '):', nextRequiredProfile);
          
          // Encontrar o índice do próximo perfil na ordem completa
          const nextProfileIndexInOrder = approvalOrder.findIndex(p => p === nextRequiredProfile);
          
          if (nextProfileIndexInOrder >= 0) {
            nextLevel = nextProfileIndexInOrder + 1; // approval_level é 1-indexed
            console.log('➡️ Próximo approval_level encontrado na ordem:', nextLevel);
          } else {
            // Se não encontrou na ordem, buscar o próximo perfil requerido que vem depois do atual
            console.warn('⚠️ Próximo perfil não encontrado na ordem, buscando próximo requerido...');
            const nextProfileInFullOrder = approvalOrder.findIndex((p, idx) => {
              // Buscar o próximo perfil requerido que vem depois do nível atual
              return idx >= currentLevel && requiredProfiles.includes(p) && p !== currentRequiredProfile;
            });
            
            if (nextProfileInFullOrder >= 0) {
              nextLevel = nextProfileInFullOrder + 1;
              console.log('➡️ Próximo approval_level (fallback):', nextLevel);
            } else {
              // Último recurso: incrementar o nível atual
              nextLevel = currentLevel + 1;
              console.warn('⚠️ Não encontrou próximo perfil, incrementando nível:', nextLevel);
            }
          }
          
          newStatus = 'pending'; // Sempre manter como pending até o último perfil
          finalLevel = nextLevel;
          
          console.log('➡️ Passando para approval_level:', finalLevel);
          console.log('➡️ Status:', newStatus);
          console.log('➡️ Comparação: currentLevel =', currentLevel, ', finalLevel =', finalLevel);
          
          // GARANTIR que sempre avança pelo menos 1 nível
          if (finalLevel <= currentLevel) {
            console.warn('⚠️ finalLevel não é maior que currentLevel, forçando incremento');
            finalLevel = currentLevel + 1;
            console.log('➡️ finalLevel ajustado para:', finalLevel);
          }
        }
      } else {
        // Comportamento padrão: aprovação normal
        nextLevel = currentLevel + 1;
        const currentApproverIndex = approverIndex;
        const isLastApprover = (currentApproverIndex + 1) >= approvers.length;
        newStatus = isLastApprover ? 'approved' : 'pending';
        finalLevel = isLastApprover ? totalApprovers : nextLevel;
      }

      // Atualizar a sugestão
      const updateData: any = {
        status: newStatus,
        approval_level: finalLevel,
        approvals_count: approvalsCount,
      };
      
      console.log('📝 Dados para atualização:', {
        status: newStatus,
        approval_level: finalLevel,
        approvals_count: approvalsCount,
        currentLevel: currentLevel,
        finalLevel: finalLevel
      });
      
      // Atualizar total_approvers com o número dinâmico
      updateData.total_approvers = totalApprovers;
      
      if (newStatus === 'approved') {
        updateData.approved_at = new Date().toISOString();
        updateData.approved_by = user?.id;
        console.log('✅ Aprovando completamente');
      } else {
        // Se não for o último, marcar quem está com a aprovação agora
        let nextApprover: any = null;
        
        if (approvalRule && requiredProfiles && requiredProfiles.length > 0) {
          // Com margem baixa, buscar o próximo aprovador baseado no finalLevel calculado
          // Usar a mesma lógica que foi usada para calcular o finalLevel
          console.log('🔍 Buscando próximo aprovador para approval_level:', finalLevel);
          
          // Buscar ordem dos perfis (usar a mesma ordem que foi usada para calcular finalLevel)
          const approvalOrderForNext = await (async () => {
            try {
              const { data: orderData } = await supabase.rpc('get_approval_profile_order');
              if (orderData && Array.isArray(orderData)) {
                return orderData.map((item: any) => item.perfil).filter(Boolean);
              }
            } catch (error) {
              console.warn('Erro ao buscar ordem de aprovação:', error);
            }
            return ['supervisor_comercial', 'diretor_comercial', 'diretor_pricing'];
          })();
          
          // Encontrar qual perfil corresponde ao finalLevel
          const profileAtFinalLevel = approvalOrderForNext[finalLevel - 1];
          
          console.log('🔍 Perfil no nível finalLevel:', profileAtFinalLevel);
          console.log('🔍 Perfis requeridos:', requiredProfiles);
          
          // Se o perfil no finalLevel está nos requeridos, buscar usuários com esse perfil
          // IMPORTANTE: Excluir o usuário atual da busca
          if (profileAtFinalLevel && requiredProfiles.includes(profileAtFinalLevel)) {
            console.log('🔍 Buscando usuários com perfil:', profileAtFinalLevel, '(excluindo usuário atual)');
            const { data: nextProfileUsers } = await supabase
              .from('user_profiles')
              .select('user_id, email, perfil, nome')
              .eq('perfil', profileAtFinalLevel)
              .neq('user_id', user?.id) // Excluir o usuário atual
              .order('email')
              .limit(1);
            
            if (nextProfileUsers && nextProfileUsers.length > 0) {
              nextApprover = nextProfileUsers[0];
              console.log('✅ Próximo aprovador encontrado:', nextApprover.email, 'com perfil', nextApprover.perfil);
            } else {
              console.warn('⚠️ Nenhum usuário encontrado com perfil:', profileAtFinalLevel, '(excluindo o atual)');
              // Se não encontrou excluindo o atual, buscar qualquer um (pode ser o mesmo)
              const { data: anyUserWithProfile } = await supabase
                .from('user_profiles')
                .select('user_id, email, perfil, nome')
                .eq('perfil', profileAtFinalLevel)
                .order('email')
                .limit(1);
              
              if (anyUserWithProfile && anyUserWithProfile.length > 0) {
                nextApprover = anyUserWithProfile[0];
                console.log('⚠️ Encontrado usuário (pode ser o mesmo):', nextApprover.email);
              }
            }
          }
          
          // Se não encontrou, buscar o próximo perfil requerido baseado no cálculo que foi feito
          if (!nextApprover) {
            console.log('🔍 Tentando buscar próximo perfil requerido...');
            
            // Usar a mesma lógica que foi usada para calcular finalLevel
            // Encontrar qual perfil requerido corresponde ao finalLevel
            for (const profile of approvalOrderForNext) {
              if (requiredProfiles.includes(profile)) {
                const profileIndexInOrder = approvalOrderForNext.findIndex(p => p === profile);
                if (profileIndexInOrder + 1 === finalLevel) {
                  // Este é o perfil que corresponde ao finalLevel
                  console.log('🔍 Perfil requerido encontrado para finalLevel:', profile);
                  
                  const { data: nextProfileUsers } = await supabase
                    .from('user_profiles')
                    .select('user_id, email, perfil, nome')
                    .eq('perfil', profile)
                    .neq('user_id', user?.id) // Excluir o usuário atual
                    .order('email')
                    .limit(1);
                  
                  if (nextProfileUsers && nextProfileUsers.length > 0) {
                    nextApprover = nextProfileUsers[0];
                    console.log('✅ Próximo aprovador encontrado:', nextApprover.email);
                    break;
                  }
                }
              }
            }
          }
          
          // Se ainda não encontrou, buscar qualquer usuário com qualquer perfil requerido (excluindo o atual)
          if (!nextApprover) {
            console.log('🔍 Buscando qualquer usuário com perfil requerido (excluindo o atual)...');
            for (const profile of requiredProfiles) {
              const { data: nextProfileUsers } = await supabase
                .from('user_profiles')
                .select('user_id, email, perfil, nome')
                .eq('perfil', profile)
                .neq('user_id', user?.id) // Excluir o usuário atual
                .order('email')
                .limit(1);
              
              if (nextProfileUsers && nextProfileUsers.length > 0) {
                nextApprover = nextProfileUsers[0];
                console.log('✅ Próximo aprovador encontrado (fallback):', nextApprover.email);
                break;
              }
            }
          }
        } else {
          // Comportamento padrão
          let nextApproverIndex: number;
          nextApproverIndex = approvers.findIndex(a => {
            const allApproversIndex = allApprovers.findIndex(aa => aa.user_id === a.user_id);
            return allApproversIndex === (finalLevel - 1);
          });
          if (nextApproverIndex < 0 && approvers.length > 0) {
            nextApproverIndex = Math.min(finalLevel - 1, approvers.length - 1);
          }
          
          if (nextApproverIndex >= 0 && nextApproverIndex < approvers.length) {
            nextApprover = approvers[nextApproverIndex];
          }
        }
        
        // IMPORTANTE: Garantir que o próximo aprovador seja diferente do atual
        if (nextApprover && nextApprover.user_id === user?.id) {
          console.warn('⚠️ Próximo aprovador é o mesmo que o atual, buscando outro...');
          nextApprover = null;
          
          // Buscar outro usuário com o mesmo perfil ou próximo perfil
          if (approvalRule && requiredProfiles && requiredProfiles.length > 0) {
            const approvalOrderForNext = await (async () => {
              try {
                const { data: orderData } = await supabase.rpc('get_approval_profile_order');
                if (orderData && Array.isArray(orderData)) {
                  return orderData.map((item: any) => item.perfil).filter(Boolean);
                }
              } catch (error) {
                console.warn('Erro ao buscar ordem de aprovação:', error);
              }
              return ['supervisor_comercial', 'diretor_comercial', 'diretor_pricing'];
            })();
            
            const profileAtFinalLevel = approvalOrderForNext[finalLevel - 1];
            
            if (profileAtFinalLevel && requiredProfiles.includes(profileAtFinalLevel)) {
              // Buscar TODOS os usuários com esse perfil, excluindo o atual
              const { data: allUsersWithProfile } = await supabase
                .from('user_profiles')
                .select('user_id, email, perfil, nome')
                .eq('perfil', profileAtFinalLevel)
                .neq('user_id', user?.id)
                .order('email')
                .limit(1);
              
              if (allUsersWithProfile && allUsersWithProfile.length > 0) {
                nextApprover = allUsersWithProfile[0];
                console.log('✅ Próximo aprovador diferente encontrado:', nextApprover.email);
              }
            }
          }
        }
        
        if (nextApprover) {
          console.log('✅ Definindo próximo aprovador:', nextApprover.email);
          console.log('✅ ID do próximo aprovador:', nextApprover.user_id);
          
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
          
          updateData.current_approver_id = nextApprover.user_id;
          updateData.current_approver_name = nextApprover.email || nextApprover.nome || 'Aprovador';
          console.log('✅ current_approver_name definido como:', updateData.current_approver_name);
        } else {
          // Se não encontrou aprovador específico, marcar como aguardando aprovação
          // Mas ainda assim, atualizar o approval_level para avançar
          updateData.current_approver_name = 'Aguardando aprovação';
          updateData.current_approver_id = null;
          console.warn('⚠️ Não encontrou próximo aprovador, mas approval_level será atualizado para', finalLevel);
          console.warn('⚠️ current_approver_name será definido como "Aguardando aprovação"');
        }
      }
      
      console.log('📤 Atualizando sugestão com:', JSON.stringify(updateData, null, 2));
      console.log('📤 ID da sugestão:', suggestionId);
      console.log('📤 approval_level atual no banco:', currentLevel);
      console.log('📤 approval_level que será definido:', finalLevel);
      console.log('📤 Mudança de nível:', currentLevel, '→', finalLevel);
      
      // Atualizar com retry
      let updateError: any = null;
      let retries = 3;
      let updatedData: any = null;
      
      while (retries > 0) {
        try {
          console.log(`🔄 Tentativa ${4 - retries} de atualizar sugestão...`);
          const { data, error } = await supabase
            .from('price_suggestions')
            .update(updateData)
            .eq('id', suggestionId)
            .select('id, approval_level, current_approver_name, status, margin_cents');
          
          if (!error && data && data.length > 0) {
            updatedData = data[0];
            console.log('✅ Sugestão atualizada com sucesso!');
            console.log('✅ Dados retornados:', JSON.stringify(updatedData, null, 2));
            console.log('✅ approval_level após update:', updatedData.approval_level);
            console.log('✅ current_approver_name após update:', updatedData.current_approver_name);
            console.log('✅ status após update:', updatedData.status);
            break;
          }
          updateError = error;
          console.error('❌ Erro ao atualizar:', error);
          retries--;
          if (retries > 0) {
            console.log('⏳ Aguardando 1 segundo antes de tentar novamente...');
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

      if (updateError) {
        console.error('❌ Erro final ao atualizar:', updateError);
        throw updateError;
      }
      
      // Verificar se realmente foi atualizado
      if (updatedData) {
        if (updatedData.approval_level !== finalLevel) {
          console.error('❌ ERRO: approval_level não foi atualizado corretamente!');
          console.error('❌ Esperado:', finalLevel, 'Mas recebeu:', updatedData.approval_level);
        } else {
          console.log('✅ Confirmação: approval_level foi atualizado corretamente para', finalLevel);
        }
        
        // Verificar se current_approver_name foi atualizado
        if (updateData.current_approver_name) {
          if (updatedData.current_approver_name !== updateData.current_approver_name) {
            console.error('❌ ERRO: current_approver_name não foi atualizado corretamente!');
            console.error('❌ Esperado:', updateData.current_approver_name);
            console.error('❌ Mas recebeu:', updatedData.current_approver_name);
          } else {
            console.log('✅ Confirmação: current_approver_name foi atualizado corretamente para', updatedData.current_approver_name);
          }
        } else {
          console.warn('⚠️ current_approver_name não foi definido no updateData');
        }
      }

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

      // Mensagem de sucesso baseada no tipo de ação
      if (approvalRule && requiredProfiles && requiredProfiles.length > 0 && !hasRequiredProfile) {
        toast.success(`Observação adicionada! Passando para o próximo perfil (nível ${finalLevel})`);
      } else {
        toast.success(
          newStatus === 'approved'
            ? "Sugestão aprovada com sucesso por todos os aprovadores!" 
            : `Aprovação registrada! Aguardando próximo aprovador (nível ${finalLevel})`
        );
      }
      setShowDetails(false);
      setSelectedSuggestion(null);
      loadSuggestions();
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
      setShowDetails(false);
      setSelectedSuggestion(null);
      loadSuggestions();
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
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="pb-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">
                Aprovações de Preços
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Gerencie e aprove as solicitações de alteração de preços
              </p>
            </div>
            <Button 
              variant="outline"
              size="sm"
              onClick={() => window.location.reload()}
            >
              <Filter className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
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
        <CardHeader className="p-3">
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-slate-600 dark:text-slate-400" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
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
                        {suggestion.stations?.name 
                          || suggestion.station_id 
                          || '⚠️ Sem posto'
                        } - {suggestion.clients?.name 
                          || suggestion.client_id 
                          || '⚠️ Sem cliente'
                        }
                      </span>
                      {getStatusBadge(suggestion.status)}
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
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600">
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
                      
                      <div className="grid grid-cols-2 gap-4 text-sm text-slate-600 dark:text-slate-400">
                        <div>
                          <span className="font-medium">Criado:</span> {formatDate(suggestion.created_at)}
                        </div>
                        <div>
                          <span className="font-medium">Código:</span> {suggestion.stations?.code || suggestion.station_id || '-'}
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