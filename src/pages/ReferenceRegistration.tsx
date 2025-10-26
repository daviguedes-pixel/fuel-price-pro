import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FileUploader } from "@/components/FileUploader";
import { ClientCombobox } from "@/components/ClientCombobox";
import { useDatabase } from "@/hooks/useDatabase";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Save, CheckCircle, Building2, MapPin, X, Search, Upload, Users, DollarSign } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";

export default function ReferenceRegistration() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { clients, paymentMethods, stations } = useDatabase();
  
  const [loading, setLoading] = useState(false);
  const [savedReference, setSavedReference] = useState<any>(null);
  const [allStations, setAllStations] = useState<any[]>([]);
  
  // Estados para busca dinâmica de concorrentes
  const [stationSearch, setStationSearch] = useState("");
  const [suggestedStations, setSuggestedStations] = useState<any[]>([]);
  const [selectedStation, setSelectedStation] = useState<any>(null);
  const [searchingStations, setSearchingStations] = useState(false);
  
  const [formData, setFormData] = useState({
    station_id: "",
    client_id: "",
    product: "",
    reference_type: "",
    reference_price: "",
    payment_method_id: "",
    observations: "",
  });
  const [attachments, setAttachments] = useState<string[]>([]);

// Carregar postos da base quando o estado mudar
useEffect(() => {
  if (stations && Array.isArray(stations)) {
    setAllStations(stations as any);
  }
}, [stations]);

  // Buscar concorrentes dinamicamente
  const searchCompetitors = async (query: string) => {
    if (query.length < 2) {
      setSuggestedStations([]);
      return;
    }

    try {
      setSearchingStations(true);
      const { data, error } = await supabase
        .from('concorrentes')
        .select('id_posto, razao_social, endereco, municipio, uf, bandeira, cnpj')
        .or(`razao_social.ilike.%${query}%,cnpj.ilike.%${query}%,municipio.ilike.%${query}%`)
        .limit(20);

      if (error) throw error;
      
      setSuggestedStations(data || []);
    } catch (error) {
      console.error('Erro ao buscar concorrentes:', error);
      setSuggestedStations([]);
    } finally {
      setSearchingStations(false);
    }
  };

  useEffect(() => {
    if (stationSearch) {
      const timeoutId = setTimeout(() => {
        searchCompetitors(stationSearch);
      }, 300);
      return () => clearTimeout(timeoutId);
    } else {
      setSuggestedStations([]);
    }
  }, [stationSearch]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSelectStation = (station: any) => {
    setSelectedStation(station);
    setFormData(prev => ({ ...prev, station_id: String(station.id_posto) }));
    setStationSearch("");
    setSuggestedStations([]);
  };

  const handleClearStation = () => {
    setSelectedStation(null);
    setStationSearch("");
    setFormData(prev => ({ ...prev, station_id: "" }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.station_id || !formData.client_id || !formData.product || !formData.reference_price) {
      toast.error("Por favor, preencha todos os campos obrigatórios");
      return;
    }

    setLoading(true);
    try {
      // Buscar latitude/longitude do posto selecionado (concorrentes.id_posto) antes de salvar
      let latitude: number | null = null;
      let longitude: number | null = null;
      let uf: string | null = null;
      let cidade: string | null = null;

      try {
        const stationIdNum = Number(formData.station_id);
        if (!isNaN(stationIdNum)) {
          // Buscar dados completos do posto (coordenadas + UF + cidade)
          const { data: concMatch, error: concError } = await supabase
            .from('concorrentes')
            .select('latitude, longitude, uf, municipio')
            .eq('id_posto', stationIdNum)
            .maybeSingle() as any;
          
          if (!concError && concMatch) {
            latitude = typeof concMatch?.latitude === 'string' ? parseFloat(concMatch.latitude) : concMatch?.latitude ?? null;
            longitude = typeof concMatch?.longitude === 'string' ? parseFloat(concMatch.longitude) : concMatch?.longitude ?? null;
            uf = concMatch?.uf || null;
            cidade = concMatch?.municipio || null;
          }
        }
      } catch (geoErr) {
        console.warn('⚠️ Não foi possível obter coordenadas do posto:', geoErr);
      }

      const referenceData = {
        posto_id: formData.station_id || null,
        cliente_id: formData.client_id || null,
        produto: formData.product as any,
        preco_referencia: parseFloat(formData.reference_price), // Keep as decimal, not cents
        tipo_pagamento_id: (formData.payment_method_id === "none" || formData.payment_method_id === "" || !formData.payment_method_id) ? null : formData.payment_method_id,
        observacoes: formData.observations || null,
        anexo: attachments.length > 0 ? attachments.join(',') : null,
        criado_por: (user?.id && user.id !== "") ? user.id : null,
        // Tentar salvar coordenadas e localização diretamente na referência
        latitude: latitude,
        longitude: longitude,
        uf: uf,
        cidade: cidade,
      };

      console.log('🔍 Dados da referência a serem salvos:', referenceData);

      // Tentar inserir com latitude/longitude; se a coluna não existir, tentar sem elas
      let insertResult: any = null;
      let insertError: any = null;
      {
        const { data, error } = await supabase
          .from('referencias' as any)
          .insert([referenceData])
          .select('*')
          .single();
        insertResult = data; insertError = error;
      }
      let data: any = insertResult; let error: any = insertError;
      if (error && (String(error.message || '').toLowerCase().includes('latitude') || String(error.message || '').toLowerCase().includes('longitude') || String(error.message || '').toLowerCase().includes('uf') || String(error.message || '').toLowerCase().includes('cidade'))) {
        const { latitude: _lat, longitude: _lng, uf: _uf, cidade: _cidade, ...referenceDataNoGeo } = referenceData as any;
        const retry = await supabase
          .from('referencias' as any)
          .insert([referenceDataNoGeo])
          .select('*')
          .single();
        data = retry.data; error = retry.error;
      }

      if (error) {
        // Se a tabela referencias não existir, tentar salvar como price_suggestion
        if (error.message.includes('referencias')) {
          console.log('Tabela referencias não encontrada, salvando como price_suggestion...');
          const suggestionData = {
            station_id: formData.station_id,
            client_id: formData.client_id,
            product: formData.product as any,
            cost_price: parseFloat(formData.reference_price) * 100, // Convert to cents
            final_price: parseFloat(formData.reference_price) * 100, // Convert to cents
            margin_cents: 0, // No margin for references
            payment_method_id: formData.payment_method_id === "none" ? null : formData.payment_method_id,
            observations: formData.observations || null,
            attachments: attachments.length > 0 ? attachments : [],
            status: 'approved' as any, // Auto-approve references
          };

          const { data: suggestionData_result, error: suggestionError } = await supabase
            .from('price_suggestions')
            .insert([suggestionData])
            .select(`
              *,
              stations!station_id(name, code),
              clients!client_id(name, code),
              payment_methods!payment_method_id(name)
            `)
            .single();

          if (suggestionError) {
            toast.error("Erro ao salvar referência: " + suggestionError.message);
            return;
          }

          // Simular estrutura de referência para exibição
          const mockReference = {
            ...suggestionData_result,
            codigo_referencia: 'REF-' + Date.now(),
            posto_id: suggestionData_result.station_id,
            cliente_id: suggestionData_result.client_id,
            produto: suggestionData_result.product,
            preco_referencia: suggestionData_result.final_price / 100,
            tipo_pagamento_id: suggestionData_result.payment_method_id,
            observacoes: suggestionData_result.observations,
            anexo: suggestionData_result.attachments?.join(',') || null,
            criado_por: suggestionData_result.created_at,
            stations: suggestionData_result.stations,
            clients: suggestionData_result.clients,
            payment_methods: suggestionData_result.payment_methods,
          };

          setSavedReference(mockReference);
          toast.success("Referência salva com sucesso!");
          return;
        }
        
        toast.error("Erro ao salvar referência: " + error.message);
        return;
      }

      // Enriquecer dados localmente (sem joins) para exibição
      const stationRecord = allStations.find((s: any) => s.id === (data as any).posto_id || s.code === (data as any).posto_id || s.cnpj_cpf === (data as any).posto_id);
      const clientRecord = clients.find((c: any) => String(c.id) === String((data as any).cliente_id) || String(c.code) === String((data as any).cliente_id));
      const pmRecord = paymentMethods.find((pm: any) => pm.id === (data as any).tipo_pagamento_id);

      const enriched: any = {
        ...((data as any) || {}),
        stations: stationRecord ? { name: stationRecord.name, code: stationRecord.code ?? stationRecord.id } : undefined,
        clients: clientRecord ? { name: clientRecord.name, code: clientRecord.code ?? clientRecord.id } : undefined,
        payment_methods: pmRecord ? { name: pmRecord.CARTAO } : undefined,
      };

      setSavedReference(enriched);
      toast.success("Referência cadastrada com sucesso!");
      
      // Reset form
      setFormData({
        station_id: "",
        client_id: "",
        product: "",
        reference_type: "",
        reference_price: "",
        payment_method_id: "",
        observations: "",
      });
      setAttachments([]);
    } catch (error) {
      toast.error("Erro inesperado ao salvar referência");
      console.error("Reference registration error:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    return price.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  if (savedReference) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="container mx-auto px-4 py-8 space-y-8">
          {/* Header com gradiente moderno */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 p-8 text-white shadow-2xl">
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
                  <h1 className="text-3xl font-bold mb-2">Referência Cadastrada!</h1>
                  <p className="text-green-100">Sua referência foi registrada com sucesso</p>
                </div>
              </div>
            </div>
          </div>

          {/* Card de sucesso */}
          <Card className="shadow-xl border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
            <CardHeader className="text-center pb-6">
              <div className="flex justify-center mb-6">
                <div className="w-20 h-20 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center shadow-lg">
                  <CheckCircle className="h-12 w-12 text-white" />
                </div>
              </div>
              <CardTitle className="text-2xl font-bold text-green-600 dark:text-green-400 mb-2">
                Referência Cadastrada com Sucesso!
              </CardTitle>
              <p className="text-slate-600 dark:text-slate-400">Os dados foram salvos e estão disponíveis para análise</p>
            </CardHeader>
            <CardContent className="space-y-6">
            {/* Grid de informações */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* ID da Referência */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                    </svg>
                  </div>
                  <Label className="text-sm font-semibold text-blue-700 dark:text-blue-300">ID da Referência</Label>
                </div>
                <p className="text-xl font-bold text-blue-900 dark:text-blue-100">{savedReference.codigo_referencia}</p>
              </div>

              {/* Data/Hora */}
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl p-6 border border-purple-200 dark:border-purple-800">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-500 flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <Label className="text-sm font-semibold text-purple-700 dark:text-purple-300">Data/Hora do Cadastro</Label>
                </div>
                <p className="text-lg font-semibold text-purple-900 dark:text-purple-100">{formatDateTime(savedReference.created_at)}</p>
              </div>

              {/* Posto */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl p-6 border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-green-500 flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <Label className="text-sm font-semibold text-green-700 dark:text-green-300">Posto</Label>
                </div>
                <p className="text-lg font-semibold text-green-900 dark:text-green-100">{savedReference.stations?.name || 'Posto'}</p>
                <p className="text-sm text-green-600 dark:text-green-400">({savedReference.stations?.code || '-'})</p>
              </div>

              {/* Cliente */}
              <div className="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 rounded-xl p-6 border border-orange-200 dark:border-orange-800">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <Label className="text-sm font-semibold text-orange-700 dark:text-orange-300">Cliente</Label>
                </div>
                <p className="text-lg font-semibold text-orange-900 dark:text-orange-100">{savedReference.clients?.name || 'Cliente'}</p>
                <p className="text-sm text-orange-600 dark:text-orange-400">({savedReference.clients?.code || '-'})</p>
              </div>

              {/* Produto */}
              <div className="bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-teal-900/20 dark:to-cyan-900/20 rounded-xl p-6 border border-teal-200 dark:border-teal-800">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-teal-500 flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                  <Label className="text-sm font-semibold text-teal-700 dark:text-teal-300">Produto</Label>
                </div>
                <p className="text-lg font-semibold text-teal-900 dark:text-teal-100 capitalize">{savedReference.produto.replace('_', ' ')}</p>
              </div>

              {/* Preço */}
              <div className="bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 rounded-xl p-6 border border-yellow-200 dark:border-yellow-800">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-yellow-500 flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                    </svg>
                  </div>
                  <Label className="text-sm font-semibold text-yellow-700 dark:text-yellow-300">Preço de Referência</Label>
                </div>
                <p className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">{formatPrice(savedReference.preco_referencia)}</p>
              </div>

              {/* Tipo de Pagamento */}
              {savedReference.payment_methods && (
                <div className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 rounded-xl p-6 border border-indigo-200 dark:border-indigo-800">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                    </div>
                    <Label className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">Tipo de Pagamento</Label>
                  </div>
                  <p className="text-lg font-semibold text-indigo-900 dark:text-indigo-100">{savedReference.payment_methods.name}</p>
                </div>
              )}

              {/* Observações */}
              {savedReference.observacoes && (
                <div className="lg:col-span-2 bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-900/20 dark:to-gray-900/20 rounded-xl p-6 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-500 flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </div>
                    <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Observações</Label>
                  </div>
                  <p className="text-slate-900 dark:text-slate-100">{savedReference.observacoes}</p>
                </div>
              )}
            </div>

            {/* Botões de ação */}
            <div className="flex gap-4 pt-8 border-t border-slate-200 dark:border-slate-700">
              <Button 
                onClick={() => setSavedReference(null)}
                className="flex items-center gap-3 h-12 px-8 bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-800 hover:to-slate-900 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
              >
                Cadastrar Nova Referência
              </Button>
              <Button 
                variant="outline"
                onClick={() => navigate("/dashboard")}
                className="flex items-center gap-3 h-12 px-8 border-2 border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold rounded-xl transition-all duration-200"
              >
                Voltar ao Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Header com gradiente moderno */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 p-8 text-white shadow-2xl">
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
                <h1 className="text-3xl font-bold mb-2">Cadastro de Referência</h1>
                <p className="text-blue-100">Registre uma nova referência de preço para análise</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form Principal */}
          <div className="lg:col-span-2">
        <Card className="shadow-xl border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
              <CardHeader className="text-center pb-6">
                <CardTitle className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-2">
                  Nova Referência de Preço
                </CardTitle>
                <p className="text-slate-600 dark:text-slate-400">Preencha os dados para cadastrar uma nova referência</p>
          </CardHeader>
          <CardContent className="space-y-8">
          <form onSubmit={handleSubmit} className="space-y-8">
              {/* Seção: Dados da Referência */}
              <div className="space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b border-slate-200 dark:border-slate-700">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg">
                    <span className="text-white font-bold text-sm">1</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200">
                      Dados da Referência
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Informe o posto e os dados da referência</p>
                  </div>
                </div>
                
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Posto - Busca Dinâmica de Concorrentes */}
                <div className="space-y-2">
                  <Label htmlFor="station_search" className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    Posto Concorrente <span className="text-red-500">*</span>
                  </Label>
                
                  {/* Posto Selecionado */}
                  {selectedStation ? (
                    <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200 dark:border-blue-800">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 flex-1">
                            <CheckCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-1 flex-shrink-0" />
                            <div className="space-y-2 flex-1 min-w-0">
                              <div className="font-semibold text-blue-900 dark:text-blue-100">
                                {selectedStation.razao_social}
                              </div>
                              <div className="flex flex-wrap gap-2 text-xs">
                                {selectedStation.bandeira && (
                                  <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200">
                                    {selectedStation.bandeira}
                                  </Badge>
                                )}
                                <Badge variant="outline" className="border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-300">
                                  <MapPin className="h-3 w-3 mr-1" />
                                  {selectedStation.municipio} - {selectedStation.uf}
                                </Badge>
                              </div>
                              {selectedStation.endereco && (
                                <p className="text-xs text-blue-700 dark:text-blue-300 truncate">
                                  {selectedStation.endereco}
                                </p>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleClearStation}
                            className="text-blue-600 hover:text-blue-800 hover:bg-blue-100 dark:text-blue-400 dark:hover:text-blue-200"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    /* Campo de Busca */
                    <div className="relative">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                        <Input
                          id="station_search"
                          placeholder="Busque por nome, CNPJ ou cidade..."
                          value={stationSearch}
                          onChange={(e) => setStationSearch(e.target.value)}
                          className="pl-10 pr-10 h-11"
                        />
                        {stationSearch && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                            onClick={() => setStationSearch("")}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>

                      {/* Results Dropdown */}
                      {suggestedStations.length > 0 && (
                        <Card className="absolute top-full left-0 right-0 mt-1 z-50 max-h-96 overflow-y-auto shadow-xl bg-background border border-border dark:border-slate-700">
                          <CardContent className="p-2">
                            {searchingStations ? (
                              <div className="p-4 text-center text-muted-foreground">
                                Buscando...
                              </div>
                            ) : suggestedStations.length === 0 ? (
                              <div className="p-4 text-center text-muted-foreground">
                                Nenhum posto encontrado
                              </div>
                            ) : (
                              <div className="space-y-1">
                                {suggestedStations.map((station) => (
                                  <div
                                    key={`station-${station.id_posto}`}
                                    className="flex items-start gap-3 p-3 hover:bg-secondary/80 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-primary/20 text-foreground"
                                    onClick={() => handleSelectStation(station)}
                                  >
                                    <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-1 flex-shrink-0" />
                                    <div className="flex-1 min-w-0 space-y-1">
                                      <div className="font-semibold text-sm">
                                        {station.razao_social}
                                      </div>
                                      <div className="flex flex-wrap gap-1.5 text-xs">
                                        {station.bandeira && (
                                          <Badge variant="secondary" className="text-xs">
                                            {station.bandeira}
                                          </Badge>
                                        )}
                                        <Badge variant="outline" className="text-xs">
                                          <MapPin className="h-2.5 w-2.5 mr-1" />
                                          {station.municipio} - {station.uf}
                                        </Badge>
                                      </div>
                                      {station.endereco && (
                                        <p className="text-xs text-muted-foreground truncate">
                                          {station.endereco}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      )}

                      {/* Overlay to close dropdown */}
                      {suggestedStations.length > 0 && (
                        <div 
                          className="fixed inset-0 z-40" 
                          onClick={() => setSuggestedStations([])}
                        />
                      )}
                    </div>
                  )}
                </div>

              {/* Cliente - Obrigatório */}
              <ClientCombobox
                label="Cliente"
                value={formData.client_id}
                onSelect={(clientId, clientName) => handleInputChange("client_id", clientId)}
                required={true}
              />

              {/* Produto - Obrigatório */}
                <div className="space-y-2">
                <Label htmlFor="product" className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <svg className="h-4 w-4 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  Produto da Referência <span className="text-red-500">*</span>
                </Label>
                <Select value={formData.product} onValueChange={(value) => handleInputChange("product", value)}>
                    <SelectTrigger className="h-11">
                    <SelectValue placeholder="Selecione o produto" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gasolina_comum">Gasolina Comum</SelectItem>
                    <SelectItem value="gasolina_aditivada">Gasolina Aditivada</SelectItem>
                    <SelectItem value="etanol">Etanol</SelectItem>
                    <SelectItem value="s10">Diesel S-10</SelectItem>
                    <SelectItem value="diesel_s500">Diesel S-500</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Tipo de Referência */}
                <div className="space-y-2">
                <Label htmlFor="reference_type" className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <svg className="h-4 w-4 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                  Tipo de Referência <span className="text-red-500">*</span>
                </Label>
                <Select value={formData.reference_type} onValueChange={(value) => handleInputChange("reference_type", value)}>
                    <SelectTrigger className="h-11">
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="competitor">Preço Concorrente</SelectItem>
                    <SelectItem value="market">Preço de Mercado</SelectItem>
                    <SelectItem value="historical">Preço Histórico</SelectItem>
                    <SelectItem value="negotiated">Preço Negociado</SelectItem>
                    <SelectItem value="promotional">Preço Promocional</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Preço - Obrigatório */}
                <div className="space-y-2">
                <Label htmlFor="price" className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <svg className="h-4 w-4 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                    </svg>
                  Preço da Referência (R$) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="price"
                  type="number"
                  step="0.001"
                  min="0"
                  placeholder="0.000"
                  value={formData.reference_price}
                  onChange={(e) => handleInputChange("reference_price", e.target.value)}
                    className="h-11 text-lg"
                  required
                />
              </div>

              {/* Tipo de Pagamento - Opcional */}
                <div className="space-y-2">
                <Label htmlFor="payment" className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
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
                    {paymentMethods.map((method, index) => (
                        <SelectItem key={`payment-method-${index}`} value={method.ID_POSTO ? `${method.ID_POSTO}-${index}` : `method-${index}`}>
                        {method.CARTAO}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                </div>
              </div>
            </div>

            {/* Seção: Informações Adicionais */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b border-slate-200 dark:border-slate-700">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
                  <span className="text-white font-bold text-sm">2</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200">
                    Informações Adicionais
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Adicione observações e anexos opcionais</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                placeholder="Descreva detalhes importantes sobre esta referência de preço..."
                value={formData.observations}
                onChange={(e) => handleInputChange("observations", e.target.value)}
                    rows={5}
                    className="resize-none"
                  />
                </div>

                {/* Anexos */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <Upload className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                    Anexos (Fotos)
                  </Label>
                  <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-slate-50 dark:bg-slate-900/50">
                <FileUploader
                  onFilesUploaded={setAttachments}
                  maxFiles={3}
                  acceptedTypes="image/*"
                />
                  </div>
                </div>
              </div>
            </div>

            {/* Botões de ação */}
                  <div className="flex gap-4 pt-6">
              <Button 
                type="submit"
                disabled={loading}
                      className="flex-1 h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50"
              >
                      <Save className="h-5 w-5 mr-2" />
                {loading ? "Salvando..." : "Salvar Referência"}
              </Button>
              <Button 
                type="button"
                variant="outline"
                onClick={() => navigate("/dashboard")}
                      className="h-12 px-8 rounded-xl border-2"
              >
                Cancelar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
          </div>

          {/* Sidebar de Resumo */}
          <div className="lg:col-span-1">
            <Card className="shadow-xl border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-lg">
                    <Save className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-bold text-slate-800 dark:text-slate-200">
                      Resumo da Referência
                    </CardTitle>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                      Verifique os dados antes de salvar
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedStation && (
                  <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-xl border border-blue-200 dark:border-blue-800">
                    <div className="flex items-start gap-3 mb-3">
                      <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                      <h4 className="font-bold text-blue-900 dark:text-blue-200">Posto Concorrente</h4>
                    </div>
                    <p className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">{selectedStation.razao_social}</p>
                    {selectedStation.municipio && (
                      <p className="text-xs text-blue-700 dark:text-blue-300">
                        {selectedStation.municipio} - {selectedStation.uf}
                      </p>
                    )}
                  </div>
                )}

                {formData.client_id && clients.find(c => String(c.id) === formData.client_id) && (
                  <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 rounded-xl border border-green-200 dark:border-green-800">
                    <div className="flex items-start gap-3 mb-3">
                      <Users className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                      <h4 className="font-bold text-green-900 dark:text-green-200">Cliente</h4>
                    </div>
                    <p className="text-sm font-semibold text-green-900 dark:text-green-100">
                      {clients.find(c => String(c.id) === formData.client_id)?.name}
                    </p>
                  </div>
                )}

                {formData.product && (
                  <div className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 rounded-xl border border-purple-200 dark:border-purple-800">
                    <div className="flex items-start gap-3 mb-3">
                      <svg className="h-5 w-5 text-purple-600 dark:text-purple-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                      <h4 className="font-bold text-purple-900 dark:text-purple-200">Produto</h4>
                    </div>
                    <p className="text-sm font-semibold text-purple-900 dark:text-purple-100">
                      {formData.product.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </p>
                  </div>
                )}

                {formData.reference_price && (
                  <div className="p-4 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 rounded-xl border border-orange-200 dark:border-orange-800">
                    <div className="flex items-start gap-3 mb-3">
                      <DollarSign className="h-5 w-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
                      <h4 className="font-bold text-orange-900 dark:text-orange-200">Preço</h4>
                    </div>
                    <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                      R$ {parseFloat(formData.reference_price).toFixed(3)}
                    </p>
                  </div>
                )}

                {attachments.length > 0 && (
                  <div className="p-4 bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-950/20 dark:to-cyan-950/20 rounded-xl border border-teal-200 dark:border-teal-800">
                    <div className="flex items-start gap-3 mb-3">
                      <Upload className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                      <h4 className="font-bold text-teal-900 dark:text-teal-200">Anexos ({attachments.length})</h4>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
    </div>
    </div>
  );
}