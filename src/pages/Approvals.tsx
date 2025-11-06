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
  // Ordem: supervisor_comercial -> diretor_comercial -> diretor_pricing
  const loadApprovers = async (requiredProfiles?: string[]) => {
    try {
      // Ordem hierárquica de aprovação padrão
      const approvalOrder = [
        'supervisor_comercial',
        'diretor_comercial', 
        'diretor_pricing'
      ];
      
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

      // Carregar postos, clientes e métodos de pagamento separadamente
      const [stationsRes, clientsRes, paymentMethodsRes] = await Promise.all([
        supabase.rpc('get_sis_empresa_stations').then(res => ({ data: res.data, error: res.error })),
        supabase.from('clientes' as any).select('id_cliente, nome'),
        supabase.from('tipos_pagamento' as any).select('CARTAO, TAXA, PRAZO, ID_POSTO')
      ]);

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
        
        if (approvalRule && requiredProfiles) {
          // Se há regra específica, encontrar qual aprovador corresponde ao nível atual
          const allApproversOrdered = await loadApprovers(); // Array completo ordenado
          const currentApproverInFullList = allApproversOrdered[currentLevel - 1];
          
          if (currentApproverInFullList && requiredProfiles.includes(currentApproverInFullList.perfil)) {
            // Encontrar o índice no array filtrado
            approverIndex = approversForThisSuggestion.findIndex(a => a.user_id === currentApproverInFullList.user_id);
          } else {
            // Se não encontrou, usar o primeiro aprovador da lista filtrada
            approverIndex = 0;
          }
        } else {
          // Comportamento padrão: índice direto
          approverIndex = currentLevel - 1;
        }
        
        const currentApprover = approversForThisSuggestion[approverIndex];
        
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
        
        // Verificar se o usuário atual tem um dos perfis requeridos
        const currentUserProfile = allApprovers.find(a => a.user_id === user?.id);
        if (!currentUserProfile || !requiredProfiles.includes(currentUserProfile.perfil)) {
          const profilesList = requiredProfiles.map(p => p.replace('_', ' ')).join(', ');
          toast.error(`Esta solicitação requer aprovação de perfis específicos: ${profilesList}. Você não possui permissão para aprovar.`);
          setLoading(false);
          return;
        }
        
        totalApprovers = approvers.length > 0 ? approvers.length : 1;
      } else {
        // Usar todos os aprovadores normalmente (sem regra específica)
        approvers = allApprovers;
        totalApprovers = approvers.length > 0 ? approvers.length : 1;
      }
      
      console.log('📋 Aprovadores encontrados:', approvers.length);
      console.log('📝 IDs dos aprovadores:', approvers.map(a => ({ id: a.user_id, email: a.email, perfil: a.perfil })));
      
      // Ajustar approval_level inicial se necessário
      let currentLevel = currentSuggestion.approval_level || 1;
      
      // Se há regra específica e approval_level está em 1, ajustar para o primeiro nível dos perfis requeridos
      if (approvalRule && requiredProfiles && currentLevel === 1) {
        // Encontrar o índice do primeiro perfil requerido na lista completa
        const firstRequiredProfileIndex = allApprovers.findIndex(a => requiredProfiles.includes(a.perfil));
        if (firstRequiredProfileIndex >= 0) {
          currentLevel = firstRequiredProfileIndex + 1; // approval_level é 1-indexed
          console.log('⚠️ Ajustando approval_level para', currentLevel, 'baseado na regra');
          
          // Atualizar o approval_level no banco
          await supabase
            .from('price_suggestions')
            .update({ approval_level: currentLevel })
            .eq('id', suggestionId);
        }
      }
      
      console.log('🔍 Approval level atual:', currentLevel);
      console.log('👤 Usuário atual:', user?.email);
      
      const approvalsCount = (currentSuggestion.approvals_count || 0) + 1;
      
      // Ajustar índice do aprovador baseado na regra
      let approverIndex: number;
      if (approvalRule && requiredProfiles) {
        // Encontrar qual aprovador corresponde ao nível atual no array completo
        const currentApproverInFullList = allApprovers[currentLevel - 1];
        
        if (currentApproverInFullList && requiredProfiles.includes(currentApproverInFullList.perfil)) {
          // Encontrar o índice no array filtrado
          approverIndex = approvers.findIndex(a => a.user_id === currentApproverInFullList.user_id);
        } else {
          // Se não encontrou, usar o primeiro aprovador da lista filtrada
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

      // Verificar se é o último aprovador
      let nextLevel: number;
      if (approvalRule && requiredProfiles) {
        // Se há regra específica, incrementar dentro do array filtrado
        const currentApproverIndex = approverIndex;
        const isLastApprover = (currentApproverIndex + 1) >= approvers.length;
        
        if (isLastApprover) {
          // Último aprovador - aprovar completamente
          nextLevel = currentLevel; // Manter no nível atual
        } else {
          // Encontrar o próximo aprovador no array completo
          const nextApproverInFiltered = approvers[currentApproverIndex + 1];
          const nextApproverInFullList = allApprovers.findIndex(a => a.user_id === nextApproverInFiltered?.user_id);
          nextLevel = nextApproverInFullList >= 0 ? nextApproverInFullList + 1 : currentLevel + 1;
        }
      } else {
        nextLevel = currentLevel + 1;
      }
      
      // Verificar se é o último aprovador baseado no array filtrado
      const currentApproverIndex = approverIndex;
      const isLastApprover = (currentApproverIndex + 1) >= approvers.length;
      
      // Se for o último aprovador, aprovar completamente
      // Caso contrário, passar para o próximo nível
      const newStatus = isLastApprover ? 'approved' : 'pending';
      const finalLevel = isLastApprover 
        ? (approvalRule && requiredProfiles ? currentLevel : totalApprovers)
        : nextLevel;

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
        // Se não for o último, marcar quem está com a aprovação agora
        let nextApproverIndex: number;
        if (approvalRule && requiredProfiles) {
          // No array filtrado, próximo aprovador está no próximo índice
          nextApproverIndex = approverIndex + 1;
        } else {
          nextApproverIndex = approvers.findIndex(a => {
            const allApproversIndex = allApprovers.findIndex(aa => aa.user_id === a.user_id);
            return allApproversIndex === (nextLevel - 1);
          });
          if (nextApproverIndex < 0) nextApproverIndex = nextLevel - 1;
        }
        
        const nextApprover = approvers[nextApproverIndex];
        if (nextApprover) {
          // Criar notificação para o próximo aprovador
          try {
            await supabase.from('notifications').insert({
              user_id: nextApprover.user_id,
              suggestion_id: suggestionId,
              type: 'pending',
              title: 'Nova Aprovação Pendente',
              message: `Uma solicitação de preço aguarda sua aprovação (nível ${nextLevel})`
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

      toast.success(
        isLastApprover 
          ? "Sugestão aprovada com sucesso por todos os aprovadores!" 
          : `Aprovação registrada! Aguardando próximo aprovador (nível ${finalLevel})`
      );
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