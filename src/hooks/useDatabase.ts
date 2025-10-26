import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Station {
  id: string;
  name: string;
  code: string;
  id_empresa?: string | number;
  address?: string;
  latitude?: number;
  longitude?: number;
  active: boolean;
}

interface Client {
  id: string;
  name: string;
  code: string;
  contact_email?: string;
  contact_phone?: string;
  active: boolean;
}

interface PaymentMethod {
  ID_POSTO: string;
  POSTO: string;
  TAXA: number;
  PRAZO: string;
  CARTAO: string;
}

interface PriceSuggestion {
  id: string;
  station_id: string;
  client_id: string;
  product: 'etanol' | 'gasolina_comum' | 'gasolina_aditivada' | 's10' | 's500';
  payment_method_id: string;
  cost_price: number;
  margin_cents: number;
  final_price: number;
  reference_type?: 'nf' | 'print_portal' | 'print_conversa' | 'sem_referencia';
  observations?: string;
  status: 'draft' | 'pending' | 'approved' | 'rejected';
  requested_by: string;
  approved_by?: string;
  approved_at?: string;
  attachments?: string[];
  created_at: string;
  updated_at: string;
}

interface PriceHistory {
  id: string;
  suggestion_id?: string;
  station_id?: string;
  client_id?: string;
  product: 'etanol' | 'gasolina_comum' | 'gasolina_aditivada' | 's10' | 's500';
  old_price?: number;
  new_price: number;
  margin_cents: number;
  created_at: string;
  approved_by: string;
  change_type?: string;
  stations?: { name: string };
  clients?: { name: string };
  price_suggestions?: { status: 'draft' | 'pending' | 'approved' | 'rejected' };
}

export const useDatabase = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [stations, setStations] = useState<Station[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([]);
  const [suggestions, setSuggestions] = useState<PriceSuggestion[]>([]);

  // Load initial data
  useEffect(() => {
    const loadAllData = async () => {
      await Promise.all([
        loadStations(),
        loadClients(),  
        loadPaymentMethods(),
        loadPriceHistoryFunc(),
        loadSuggestions()
      ]);
    };
    
    loadAllData();
  }, []);

  const loadStations = async () => {
    try {
      console.log('🏪 Carregando postos via RPC get_sis_empresa_stations...');
      
      // Tentar RPC primeiro
      let data: any[] = [];
      let error: any = null;
      
      try {
        const result = await supabase.rpc('get_sis_empresa_stations');
        data = result.data || [];
        error = result.error;
      } catch (rpcError) {
        console.warn('⚠️ RPC falhou, usando consulta direta:', rpcError);
        error = rpcError;
      }

      // Fallback: consulta direta se RPC falhar
      if (error || !data || data.length === 0) {
        console.log('🔄 Fallback: consultando sis_empresa diretamente...');
        const { data: directData, error: directError } = await supabase
          .from('sis_empresa')
          .select('nome_empresa, cnpj_cpf, latitude, longitude, bandeira, rede, registro_ativo')
          .order('nome_empresa');
        
        if (!directError && directData) {
          data = directData.map((station: any) => ({
            nome_empresa: station.nome_empresa,
            cnpj_cpf: station.cnpj_cpf,
            id_empresa: null, // Não disponível na consulta direta
            latitude: station.latitude,
            longitude: station.longitude,
            bandeira: station.bandeira,
            rede: station.rede,
            registro_ativo: station.registro_ativo
          }));
        }
      }

      console.log('✅ Postos brutos carregados:', data?.length || 0);

      const stationsWithActive = (data as any)
        ?.map((station: any) => ({ 
          id: String(station.id_empresa || station.cnpj_cpf || '') || `${station.nome_empresa}-${Math.random()}`,
          name: station.nome_empresa || '',
          code: station.cnpj_cpf || '',
          id_empresa: station.id_empresa,
          latitude: station.latitude,
          longitude: station.longitude,
          bandeira: station.bandeira || '',
          rede: station.rede || '',
          active: true 
        })) || [];

      setStations(stationsWithActive);
      console.log('📊 Total de postos:', stationsWithActive.length);
      console.log('📊 Postos por bandeira:', stationsWithActive.reduce((acc: any, s: any) => {
        acc[s.bandeira || 'Sem bandeira'] = (acc[s.bandeira || 'Sem bandeira'] || 0) + 1;
        return acc;
      }, {}));
    } catch (error) {
      console.error('Error loading stations:', error);
      setStations([]);
    }
  };

  const loadClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clientes' as any)
        .select('id_cliente, nome')
        .order('nome');
      
      if (error) throw error;
      // Mapear campos e adicionar active: true
      const clientsWithActive = (data as any)?.map((client: any) => ({ 
        id: client.id_cliente,
        name: client.nome,
        code: client.id_cliente,
        active: true 
      })) || [];
      setClients(clientsWithActive);
    } catch (error) {
      console.error('Error loading clients:', error);
    }
  };

  const loadPaymentMethods = async () => {
    try {
      console.log('🔄 ===== CARREGANDO TIPOS DE PAGAMENTO =====');
      
      const { data, error } = await supabase
        .from('tipos_pagamento' as any)
        .select('*')
        .order('"CARTAO"');
      
      console.log('📊 Resultado da consulta:', { data, error });
      console.log('📊 Quantidade de registros:', data?.length || 0);
      
      if (error) {
        console.error('❌ Erro ao carregar tipos de pagamento:', error);
        setPaymentMethods([]);
        return;
      }
      
      console.log('✅ Tipos de pagamento carregados:', data);
      setPaymentMethods((data as any) || []);
      
    } catch (err) {
      console.error('❌ Error loading payment methods:', err);
      setPaymentMethods([]);
    }
  };

  const getPaymentMethodsForStation = async (stationId: string) => {
    try {
      console.log('========================================');
      console.log('🔍 getPaymentMethodsForStation chamado');
      console.log('stationId recebido:', stationId);
      console.log('tipo stationId:', typeof stationId);
      console.log('========================================');
      
      // Buscar TODOS os tipos de pagamento primeiro
      const allPaymentMethods = await supabase
        .from('tipos_pagamento' as any)
        .select('*');
      
      if (allPaymentMethods.error) {
        console.error('❌ Erro ao buscar tipos de pagamento:', allPaymentMethods.error);
        return [];
      }
      
      const allMethods = allPaymentMethods.data || [];
      
      // Validar stationId
      if (!stationId || stationId === '' || stationId === 'none') {
        return [];
      }
      
      // Filtrar métodos que correspondem ao stationId
      const filteredMethods = allMethods.filter((method: any) => {
        const idPostoStr = String(method.ID_POSTO || '').trim();
        const idPostoNum = isNaN(Number(method.ID_POSTO)) ? null : Number(method.ID_POSTO);
        const stationIdStr = String(stationId || '').trim();
        const stationIdNum = isNaN(Number(stationId)) ? null : Number(stationId);
        
        // Comparar como string ou número
        return idPostoStr === stationIdStr || 
               (idPostoNum !== null && stationIdNum !== null && idPostoNum === stationIdNum);
      });
      
      return filteredMethods as any[];
      
    } catch (error) {
      console.error('❌ Erro em getPaymentMethodsForStation:', error);
      return [];
    }
  };

  const loadPriceHistoryFunc = async () => {
    try {
      const { data, error } = await supabase
        .from('price_history')
        .select(`
          *,
          stations(name),
          clients(name),
          price_suggestions(status)
        `)
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      setPriceHistory(data || []);
    } catch (error) {
      console.error('Error loading price history:', error);
    }
  };

  const loadSuggestions = async () => {
    try {
      const { data, error } = await supabase
        .from('price_suggestions')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setSuggestions(data || []);
    } catch (error) {
      console.error('Error loading suggestions:', error);
    }
  };

  // CRUD helpers
  const addStation = async (station: Partial<Station>) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('postos' as any)
        .insert([
          {
            razao_social: station.name!,
            cnpj: station.code!,
            endereco: station.address ?? null,
            latitude: station.latitude ?? null,
            longitude: station.longitude ?? null,
          } as any,
        ])
        .select('id_posto as id, razao_social as name, cnpj as code, endereco as address, latitude, longitude')
        .single();
      if (error) throw error;
      await loadStations();
      return data;
    } finally {
      setLoading(false);
    }
  };

  const addClient = async (client: Partial<Client>) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('clientes' as any)
        .insert([
          {
            nome: client.name!,
          } as any,
        ])
        .select('id_cliente as id, nome as name, id_cliente as code')
        .single();
      if (error) throw error;
      await loadClients();
      return data;
    } finally {
      setLoading(false);
    }
  };

  const addPaymentMethod = async (pm: Partial<PaymentMethod>) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tipos_pagamento' as any)
        .insert([
          {
            CARTAO: (pm as any).CARTAO || 'Novo Cartão',
            POSTO: (pm as any).POSTO || 'GENERICO',
            TAXA: (pm as any).TAXA ?? 0,
            PRAZO: (pm as any).PRAZO ?? 0,
            ID_POSTO: (pm as any).ID_POSTO || 'GENERICO',
          },
        ])
        .select('*')
        .single();
      if (error) throw error;
      await loadPaymentMethods();
      return data;
    } finally {
      setLoading(false);
    }
  };

  // Search helpers
  const searchPriceHistory = async (filters: any) => {
    let query = supabase
      .from('price_history')
      .select(`
        *,
        stations(name),
        clients(name),
        price_suggestions(status)
      `)
      .order('created_at', { ascending: false });

    if (filters?.product && filters.product !== 'all') {
      query = query.eq('product', filters.product);
    }
    if (filters?.station && filters.station !== 'all') {
      query = query.eq('station_id', filters.station);
    }
    if (filters?.client && filters.client !== 'all') {
      query = query.eq('client_id', filters.client);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  };

  // Refresh functions
  const refreshStations = () => loadStations();
  const refreshClients = () => loadClients();
  const refreshPaymentMethods = () => loadPaymentMethods();
  const refreshPriceHistory = () => loadPriceHistoryFunc();
  const refreshSuggestions = () => loadSuggestions();

  return {
    loading,
    stations,
    clients,
    paymentMethods,
    priceHistory,
    suggestions,
    // CRUD
    addStation,
    addClient,
    addPaymentMethod,
    // Search
    searchPriceHistory,
    // Station-specific
    getPaymentMethodsForStation,
    // Refresh
    refreshStations,
    refreshClients,
    refreshPaymentMethods,
    refreshPriceHistory,
    refreshSuggestions,
  };
};
