import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, MapPin, DollarSign, CheckCircle, Building2, FileText, Upload, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FileUploader } from "@/components/FileUploader";
import { parseBrazilianDecimal, formatIntegerToPrice } from "@/lib/utils";
import { ImageViewerModal } from "@/components/ImageViewerModal";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useDatabase } from "@/hooks/useDatabase";
// Removed SisEmpresaCombobox to use unified search box (ours + competitors)

interface Station {
  id: string;
  name: string;
  address: string;
  type: 'concorrente' | 'proprio';
  network?: string;
  brand?: string;
  manager_id?: string;
  latitude?: number;
  longitude?: number;
  city?: string;
  state?: string;
  originalId?: number;
  idEmpresa?: number;
  cnpjCpf?: string;
}

interface ProductPrice {
  product: 'gasolina_comum' | 'gasolina_aditivada' | 'etanol' | 's10' | 's500';
  price: string;
}

interface CompetitorResearch {
  id: string;
  station_id: string;
  station_type: string;
  manager_id?: string;
  products: ProductPrice[];
  notes: string;
  attachments: string[];
  created_at: string;
  created_by: string;
}

export default function PublicPriceResearch() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { getPaymentMethodsForStation } = useDatabase();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string>("");
  
  // Estados do formulário
  const [stationSearch, setStationSearch] = useState("");
  const [suggestedStations, setSuggestedStations] = useState<Station[]>([]);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [productPrices, setProductPrices] = useState<{[key: string]: string}>({});
  const [notes, setNotes] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  
  // Estados para tipo de pagamento
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [stationPaymentMethods, setStationPaymentMethods] = useState<any[]>([]);

  const products = [
    { value: 'gasolina_comum', label: 'Gasolina Comum' },
    { value: 'gasolina_aditivada', label: 'Gasolina Aditivada' },
    { value: 'etanol', label: 'Etanol' },
    { value: 's10', label: 'S10' },
    { value: 's500', label: 'S500' }
  ];

  // Carregar tipos de pagamento específicos do posto quando station é selecionado
  useEffect(() => {
    const loadStationPaymentMethods = async () => {
      if (selectedStation) {
        console.log('🚨 Carregando métodos de pagamento para o posto:', {
          id: selectedStation.id,
          name: selectedStation.name,
          idEmpresa: selectedStation.idEmpresa,
          cnpjCpf: selectedStation.cnpjCpf
        });
        
        try {
          // Tentar vários IDs possíveis
          const possibleIds = [
            selectedStation.id,
            selectedStation.idEmpresa?.toString(),
            selectedStation.originalId?.toString(),
            selectedStation.cnpjCpf
          ].filter(Boolean);
          
          console.log('🔍 Tentando IDs:', possibleIds);
          
          // Tentar buscar com todos os IDs possíveis
          let methods: any[] = [];
          for (const id of possibleIds) {
            if (id) {
              const result = await getPaymentMethodsForStation(id);
              if (result && result.length > 0) {
                console.log(`✅ Encontrados métodos com ID "${id}":`, result);
                methods = result;
                break;
              }
            }
          }
          
          console.log('✅ Tipos de pagamento carregados:', methods.length, methods);
          setStationPaymentMethods(methods);
        } catch (error) {
          console.error('❌ Erro ao carregar tipos de pagamento:', error);
          setStationPaymentMethods([]);
        }
      } else {
        // Reset apenas se realmente não houver station
        setStationPaymentMethods([]);
        setPaymentMethod("");
      }
    };

    loadStationPaymentMethods();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStation]);

  // Buscar postos (concorrentes + próprios)
  const searchStations = async (query: string) => {
    if (query.length < 2) {
      setSuggestedStations([]);
      return;
    }

    try {
      setLoading(true);
      console.log('🔍 Buscando postos para query:', query);
      
      // Buscar concorrentes
      const { data: concorrentesData, error: concorrentesError } = await supabase
        .from('concorrentes')
        .select('*')
        .ilike('razao_social', `%${query}%`)
        .limit(10);

      console.log('🔍 Concorrentes encontrados:', concorrentesData?.length, concorrentesData);
      console.log('🔍 Erro concorrentes:', concorrentesError);
      if (concorrentesData && concorrentesData.length > 0) {
        console.log('🔍 Campos do primeiro concorrente:', Object.keys(concorrentesData[0]));
      }

      // Buscar postos próprios da tabela sis_empresa
      const { data: sisEmpresaData, error: sisEmpresaError } = await supabase
        .from('sis_empresa')
        .select('*')
        .ilike('nome_empresa', `%${query}%`)
        .limit(10);

      console.log('🔍 Postos próprios encontrados:', sisEmpresaData?.length, sisEmpresaData);
      console.log('🔍 Erro postos próprios:', sisEmpresaError);
      if (sisEmpresaData && sisEmpresaData.length > 0) {
        console.log('🔍 Campos do primeiro posto próprio:', Object.keys(sisEmpresaData[0]));
      }

      const concorrentes = (concorrentesData || []).map((item: any) => ({
        id: item.cnpj_cpf || item.id || Math.random().toString(),
        name: item.razao_social || item.nome_empresa || 'Concorrente',
        address: `${item.endereco || ''}`.trim() || `${item.municipio || item.cidade || ''}, ${item.uf || item.estado || ''}`.trim().replace(/^,\s*|,\s*$/g, ''),
        city: item.municipio || item.cidade || '',
        state: item.uf || item.estado || '',
        type: 'concorrente' as const,
        network: item.rede,
        brand: item.bandeira,
        latitude: item.latitude || null,
        longitude: item.longitude || null
      }));

      const proprios = (sisEmpresaData as any[] || []).map(item => {
        console.log('📋 Campos disponíveis em sis_empresa:', Object.keys(item));
        return {
          // ID_POSTO na tabela tipos_pagamento - tentar vários campos possíveis
          id: String(item.id_empresa || item.id || item.cnpj_cpf || item.codigo || ''),
          name: item.nome_empresa,
          address: `${item.municipio || item.cidade || ''}, ${item.uf || item.estado || ''}`.trim().replace(/^,\s*|,\s*$/g, ''),
          city: item.municipio || item.cidade || '',
          state: item.uf || item.estado || '',
          type: 'proprio' as const,
          network: item.rede,
          brand: item.bandeira,
          latitude: item.latitude,
          longitude: item.longitude,
          // Manter referências adicionais para facilitar o matching
          originalId: item.id,
          idEmpresa: item.id_empresa,
          cnpjCpf: item.cnpj_cpf,
          codigo: item.codigo
        };
      });

      console.log('🔍 Concorrentes mapeados:', concorrentes.length, concorrentes);
      console.log('🔍 Próprios mapeados:', proprios.length, proprios);

      const allStations = [...concorrentes, ...proprios];
      const filtered = allStations.filter(station => 
        station.name.toLowerCase().includes(query.toLowerCase()) ||
        station.address.toLowerCase().includes(query.toLowerCase())
      );

      console.log('🔍 Total de estações:', allStations.length);
      console.log('🔍 Estações filtradas:', filtered.length, filtered);

      setSuggestedStations(filtered);
    } catch (error) {
      console.error('Erro ao buscar postos:', error);
      toast.error('Erro ao buscar postos');
    } finally {
      setLoading(false);
    }
  };

  // Lidar com seleção de produtos
  const handleProductToggle = (productValue: string) => {
    setSelectedProducts(prev => {
      if (prev.includes(productValue)) {
        const newProducts = prev.filter(p => p !== productValue);
        const newPrices = { ...productPrices };
        delete newPrices[productValue];
        setProductPrices(newPrices);
        return newProducts;
      } else {
        return [...prev, productValue];
      }
    });
  };

  // Lidar com mudança de preço - aceitar apenas números inteiros
  const handlePriceChange = (product: string, price: string) => {
    // Remove tudo que não é número
    const numbersOnly = price.replace(/\D/g, '');
    // Formata com vírgula fixa (ex: 350 -> "3,50")
    const formatted = formatIntegerToPrice(numbersOnly);
    setProductPrices(prev => ({
      ...prev,
      [product]: formatted
    }));
  };

  // Lidar com upload de arquivos
  const handleFilesUploaded = (fileUrls: string[]) => {
    setAttachments(fileUrls);
  };

  // Submeter formulário
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedStation || selectedProducts.length === 0) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    try {
      setSubmitting(true);
      
      const productsData = selectedProducts.map(product => ({
        product: product as any,
        price: productPrices[product] || '0,00'
      }));

      const entriesToInsert = productsData.map(productData => ({
        station_name: selectedStation.name,
        product: productData.product,
        price: parseBrazilianDecimal(productData.price),
        payment_method: paymentMethod || null,
        notes: notes,
        attachments: attachments,
        date_observed: new Date().toISOString(),
        created_by: user?.email || 'unknown',
        station_type: selectedStation.type, // 'concorrente' ou 'proprio'
        latitude: selectedStation.latitude,
        longitude: selectedStation.longitude,
        address: `${selectedStation.city || ''}, ${selectedStation.state || ''}`.trim().replace(/^,\s*|,\s*$/g, '')
      }));

      console.log('🔍 Dados para inserção:', entriesToInsert);

      const { error } = await supabase
        .from('competitor_research')
        .insert(entriesToInsert);

      if (error) {
        console.error('🔍 Erro detalhado:', error);
        console.error('🔍 Código do erro:', error.code);
        console.error('🔍 Mensagem do erro:', error.message);
        console.error('🔍 Detalhes do erro:', error.details);
        toast.error(`Erro ao salvar pesquisa: ${error.message}`);
        return;
      }

      toast.success('Pesquisa registrada com sucesso!');
      
      // Limpar formulário
      setSelectedStation(null);
      setStationSearch("");
      setSelectedProducts([]);
      setProductPrices({});
      setPaymentMethod("");
      setNotes("");
      setAttachments([]);
      
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao processar solicitação');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="pb-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">
                Pesquisa de Preços
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Registre os preços da concorrência
              </p>
            </div>
            <Button 
              variant="outline"
              size="sm"
              onClick={() => navigate("/dashboard")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          {/* Main Form */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">
                Nova Pesquisa de Preços
              </CardTitle>
              <p className="text-sm text-muted-foreground">Preencha os dados para registrar uma nova pesquisa</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Seção: Dados Básicos */}
                  <div className="space-y-4">
                    <div className="pb-3 border-b border-border">
                      <h3 className="text-base font-semibold text-foreground">
                        Dados Básicos da Pesquisa
                      </h3>
                      <p className="text-sm text-muted-foreground">Informe o posto e produtos a serem pesquisados</p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Posto - caixa de pesquisa unificada */}
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          Posto <span className="text-red-500">*</span>
                        </Label>
                        <div className="relative">
                          <Input
                            placeholder="Buscar por nome, CNPJ ou cidade..."
                            value={stationSearch}
                            onChange={(e) => {
                              setStationSearch(e.target.value);
                              searchStations(e.target.value);
                            }}
                            className="pr-10 h-11"
                          />
                          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                          {/* Sugestões */}
                          {suggestedStations.length > 0 && (
                            <div className="absolute top-full left-0 right-0 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-md shadow-lg max-h-56 overflow-y-auto z-10 mt-1">
                              {suggestedStations.map((station, idx) => (
                                <div
                                  key={`station-${station.id}-${idx}`}
                                  className="p-3 hover:bg-gray-100 dark:hover:bg-slate-700 cursor-pointer border-b dark:border-slate-700 last:border-b-0 text-slate-900 dark:text-slate-100"
                                  onClick={() => {
                                    setSelectedStation(station);
                                    setStationSearch(station.name);
                                    setSuggestedStations([]);
                                  }}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <div className="font-medium truncate">{station.name}</div>
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {station.brand && (
                                          <Badge variant="secondary" className="text-xs">{station.brand}</Badge>
                                        )}
                                        {station.network && (
                                          <Badge variant="outline" className="text-xs">{station.network}</Badge>
                                        )}
                                        {station.address && (
                                          <Badge variant="outline" className="text-xs">
                                            <MapPin className="h-3 w-3 mr-1" />
                                            {station.address}
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                    <Badge variant={station.type === 'concorrente' ? 'destructive' : 'default'}>
                                      {station.type === 'concorrente' ? 'Concorrente' : 'Próprio'}
                                    </Badge>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Posto Selecionado */}
                        {selectedStation && (
                          <div className="mt-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                            <div className="flex items-start gap-3">
                              <CheckCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                              <div className="flex-1 space-y-2">
                                <div className="font-semibold text-blue-900 dark:text-blue-100">{selectedStation.name}</div>
                                <div className="flex flex-wrap gap-2">
                                  {selectedStation.brand && (
                                    <Badge variant="secondary" className="text-xs">{selectedStation.brand}</Badge>
                                  )}
                                  {selectedStation.network && (
                                    <Badge variant="outline" className="text-xs">{selectedStation.network}</Badge>
                                  )}
                                  {selectedStation.address && (
                                    <Badge variant="outline" className="text-xs">
                                      <MapPin className="h-3 w-3 mr-1" />
                                      {selectedStation.address}
                                    </Badge>
                                  )}
                                  <Badge variant={selectedStation.type === 'concorrente' ? 'destructive' : 'default'}>
                                    {selectedStation.type === 'concorrente' ? 'Concorrente' : 'Próprio'}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Produtos */}
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                          <svg className="h-4 w-4 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                          </svg>
                          Produtos <span className="text-red-500">*</span>
                        </Label>
                        <div className="p-3 border border-slate-200 dark:border-slate-700 rounded-lg space-y-2 bg-slate-50 dark:bg-slate-900/50">
                          {products.map((product) => (
                            <label key={product.value} className="flex items-center gap-3 p-2 hover:bg-white dark:hover:bg-slate-800 rounded-md cursor-pointer transition-colors">
                              <input
                                type="checkbox"
                                checked={selectedProducts.includes(product.value)}
                                onChange={() => handleProductToggle(product.value)}
                                className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-2 focus:ring-blue-500"
                              />
                              <span className="text-sm text-slate-700 dark:text-slate-300">{product.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    {/* Tipo de Pagamento */}
                    {selectedStation && (
                      <div className="space-y-2">
                        <Label htmlFor="payment_method" className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                          <svg className="h-4 w-4 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                          </svg>
                          Tipo de Pagamento
                        </Label>
                        <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                          <SelectTrigger className="h-11">
                            <SelectValue placeholder="Selecione o tipo de pagamento" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Nenhum</SelectItem>
                            {stationPaymentMethods.length > 0 ? (
                              stationPaymentMethods.map((method, index) => {
                                const paymentName = method.CARTAO || method.POSTO || `Método ${index + 1}`;
                                const taxa = method.TAXA ? `(${method.TAXA}%)` : '';
                                return (
                                  <SelectItem key={`method-${index}`} value={paymentName}>
                                    {paymentName} {taxa}
                                  </SelectItem>
                                );
                              })
                            ) : (
                              <SelectItem value="outro" disabled>Nenhum método cadastrado</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  {/* Seção: Preços */}
                  {selectedProducts.length > 0 && (
                    <div className="space-y-6">
                      <div className="flex items-center gap-3 pb-4 border-b border-slate-200 dark:border-slate-700">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center shadow-lg">
                          <span className="text-white font-bold text-sm">2</span>
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200">
                            Preços dos Produtos
                          </h3>
                          <p className="text-sm text-slate-600 dark:text-slate-400">Informe os preços dos produtos selecionados</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {selectedProducts.map((productValue) => {
                          const product = products.find(p => p.value === productValue);
                          return (
                            <div key={productValue} className="space-y-2">
                              <Label htmlFor={`price-${productValue}`} className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                <svg className="h-4 w-4 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                                </svg>
                                {product?.label} <span className="text-red-500">*</span>
                              </Label>
                              <Input
                                id={`price-${productValue}`}
                                type="text"
                                inputMode="numeric"
                                placeholder="0,00"
                                value={productPrices[productValue] || ''}
                                onChange={(e) => handlePriceChange(productValue, e.target.value)}
                                className="h-11"
                                translate="no"
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Seção: Informações Adicionais */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 pb-4 border-b border-slate-200 dark:border-slate-700">
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg">
                        <span className="text-white font-bold text-sm">3</span>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200">
                          Informações Adicionais
                        </h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400">Adicione observações e anexos opcionais</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Observações */}
                      <div className="space-y-2">
                        <Label htmlFor="notes" className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                          <FileText className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                          Observações
                        </Label>
                        <Textarea
                          id="notes"
                          placeholder="Observações sobre a pesquisa..."
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          rows={5}
                          className="resize-none"
                        />
                      </div>

                      {/* Anexos */}
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                          <Upload className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                          Anexos
                        </Label>
                        <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-slate-50 dark:bg-slate-900/50">
                          <FileUploader
                            onFilesUploaded={handleFilesUploaded}
                            maxFiles={5}
                            acceptedTypes="image/*,.pdf"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Botão de Submit */}
                  <div className="pt-4">
                    <Button
                      type="submit"
                      className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold disabled:opacity-50"
                      disabled={!selectedStation || selectedProducts.length === 0 || submitting}
                    >
                      {submitting ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-2 border-white mr-2"></div>
                          Salvando...
                        </>
                      ) : (
                        <>
                          <Plus className="h-5 w-5 mr-2" />
                          Registrar Pesquisa
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Sidebar de Resumo */}
            <Card className="mt-6">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <DollarSign className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold">
                      Resumo da Pesquisa
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Verifique os dados antes de salvar
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedStation && (
                  <div className="p-3 bg-muted/50 rounded-lg border border-border">
                    <div className="flex items-start gap-3 mb-2">
                      <Building2 className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                      <h4 className="font-semibold text-sm text-foreground">Posto Selecionado</h4>
                    </div>
                    <p className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">{selectedStation.name}</p>
                    <p className="text-xs text-blue-700 dark:text-blue-300 mb-3">{selectedStation.address}</p>
                    <Badge variant={selectedStation.type === 'concorrente' ? 'destructive' : 'default'} className="text-xs">
                      {selectedStation.type === 'concorrente' ? 'Concorrente' : 'Próprio'}
                    </Badge>
                  </div>
                )}

                {paymentMethod && (
                  <div className="p-4 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/20 dark:to-purple-950/20 rounded-xl border border-indigo-200 dark:border-indigo-800">
                    <div className="flex items-start gap-3 mb-3">
                      <svg className="h-5 w-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                      <h4 className="font-bold text-indigo-900 dark:text-indigo-200">Tipo de Pagamento</h4>
                    </div>
                    <Badge variant="secondary" className="text-sm">{paymentMethod}</Badge>
                  </div>
                )}

                {selectedProducts.length > 0 && (
                  <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 rounded-xl border border-green-200 dark:border-green-800">
                    <div className="flex items-start gap-3 mb-3">
                      <svg className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                      <h4 className="font-bold text-green-900 dark:text-green-200">Produtos ({selectedProducts.length})</h4>
                    </div>
                    <div className="space-y-2">
                      {selectedProducts.map((productValue) => {
                        const product = products.find(p => p.value === productValue);
                        const price = productPrices[productValue] || '0,00';
                        return (
                          <div key={productValue} className="flex justify-between items-center p-2 bg-white/60 dark:bg-slate-800/60 rounded-lg">
                            <span className="text-sm text-green-800 dark:text-green-200 font-medium">{product?.label}</span>
                            <Badge variant="secondary" className="text-xs">R$ {price}</Badge>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {attachments.length > 0 && (
                  <div className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 rounded-xl border border-purple-200 dark:border-purple-800">
                    <div className="flex items-start gap-3 mb-3">
                      <Upload className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      <h4 className="font-bold text-purple-900 dark:text-purple-200">Anexos ({attachments.length})</h4>
                    </div>
                    <div className="space-y-2">
                      {attachments.map((attachment, index) => (
                        <div key={index} className="flex items-center gap-2 p-2 bg-white/60 dark:bg-slate-800/60 rounded-lg">
                          <FileText className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                          <span className="text-sm text-purple-700 dark:text-purple-300">
                            Arquivo {index + 1}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
        </div>
      </div>

      {/* Modal de Visualização de Imagens */}
      <ImageViewerModal
        isOpen={imageViewerOpen}
        onClose={() => setImageViewerOpen(false)}
        imageUrl={selectedImage}
      />
    </div>
  );
}