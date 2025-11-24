import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, Download, Check, X, User, Calendar, MessageSquare, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { parseBrazilianDecimal } from "@/lib/utils";
import { ImageViewerModal } from "@/components/ImageViewerModal";

interface ApprovalHistory {
  id: string;
  approver_name: string;
  action: string;
  observations: string | null;
  approval_level: number;
  created_at: string;
}

interface ApprovalDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  suggestion: any;
  onApprove: (observations: string) => void;
  onReject: (observations: string) => void;
  onSuggestPrice?: (observations: string, suggestedPrice: number) => void;
  loading: boolean;
  readOnly?: boolean;
}

export const ApprovalDetailsModal = ({ 
  isOpen, 
  onClose, 
  suggestion, 
  onApprove, 
  onReject,
  onSuggestPrice,
  loading,
  readOnly = false
}: ApprovalDetailsModalProps) => {
  const [observations, setObservations] = useState("");
  const [suggestedPrice, setSuggestedPrice] = useState<string>("");
  const [approvalHistory, setApprovalHistory] = useState<ApprovalHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string>("");

  const [enrichedSuggestion, setEnrichedSuggestion] = useState(suggestion);

  useEffect(() => {
    if (suggestion?.id && isOpen) {
      loadApprovalHistory();
      
      // Buscar dados faltantes (stations, clients, payment_methods, observations)
      if (!suggestion.stations || !suggestion.clients || !suggestion.payment_methods || !suggestion.observations) {
        loadMissingData();
      }
    }
  }, [suggestion?.id, isOpen, suggestion]);
  
  // Listener de real-time para atualizar histórico quando houver mudanças
  useEffect(() => {
    if (!suggestion?.id || !isOpen) return;
    
    const channel = supabase
      .channel(`approval_history_${suggestion.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'approval_history',
          filter: `suggestion_id=eq.${suggestion.id}`
        },
        (payload) => {
          console.log('🔄 Mudança detectada no histórico de aprovação:', payload.eventType);
          // Recarregar histórico após um pequeno delay
          setTimeout(() => {
            loadApprovalHistory();
          }, 500);
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [suggestion?.id, isOpen]); // eslint-disable-line react-hooks/exhaustive-deps
  
  const loadMissingData = async () => {
    if (!suggestion) return;
    
    // Se os IDs estiverem null, não podemos buscar nada
    if (!suggestion?.station_id && !suggestion?.client_id) {
      console.log('⚠️ Não há IDs para buscar - aprovacoes antigas');
      return;
    }
    
    try {
      console.log('🔍 Buscando dados faltantes para suggestion:', suggestion.id);
      
      // Buscar postos se necessário (múltiplos ou único)
      const stationIds = suggestion.station_ids && Array.isArray(suggestion.station_ids) 
        ? suggestion.station_ids 
        : (suggestion.station_id ? [suggestion.station_id] : []);
      
      if (stationIds.length > 0 && (!suggestion.stations_list || suggestion.stations_list.length === 0)) {
        console.log('🔍 Buscando postos:', stationIds);
        const stationsList = [];
        
        for (const stationId of stationIds) {
          if (!stationId) continue;
          
          const { data: stationData } = await supabase
            .from('sis_empresa' as any)
            .select('nome_empresa, cnpj_cpf, id_empresa')
            .or(`cnpj_cpf.eq.${stationId},id.eq.${stationId},id_empresa.eq.${stationId}`)
            .maybeSingle();
          
          if (stationData) {
            stationsList.push({ 
              name: (stationData as any).nome_empresa, 
              code: (stationData as any).cnpj_cpf || (stationData as any).id_empresa 
            });
          }
        }
        
        if (stationsList.length > 0) {
          setEnrichedSuggestion(prev => ({
            ...prev!,
            stations: stationsList[0], // Primeiro para compatibilidade
            stations_list: stationsList // Lista completa
          }));
        }
      }
      
      // Buscar cliente se necessário  
      if (!suggestion.clients && suggestion.client_id) {
        console.log('🔍 Buscando cliente:', suggestion.client_id);
        const { data: clientData } = await supabase
          .from('clientes' as any)
          .select('nome, id_cliente')
          .eq('id_cliente', suggestion.client_id)
          .maybeSingle();
        
        if (clientData) {
          setEnrichedSuggestion(prev => ({
            ...prev!,
            clients: { name: (clientData as any).nome, code: String((clientData as any).id_cliente) }
          }));
        }
      }
      
      // Buscar método de pagamento se necessário
      if (!suggestion.payment_methods && suggestion.payment_method_id) {
        console.log('🔍 Buscando método de pagamento:', suggestion.payment_method_id);
        
        // Tentar buscar por ID, ID_POSTO ou CARTAO
        let paymentData = null;
        const { data: paymentById } = await supabase
          .from('tipos_pagamento' as any)
          .select('CARTAO, TAXA, PRAZO, ID_POSTO')
          .eq('id', suggestion.payment_method_id)
          .maybeSingle();
        
        if (paymentById) {
          paymentData = paymentById;
        } else {
          const { data: paymentByCard } = await supabase
            .from('tipos_pagamento' as any)
            .select('CARTAO, TAXA, PRAZO, ID_POSTO')
            .or(`CARTAO.eq.${suggestion.payment_method_id},ID_POSTO.eq.${suggestion.payment_method_id}`)
            .maybeSingle();
          paymentData = paymentByCard;
        }
        
        if (paymentData) {
          console.log('✅ Método de pagamento encontrado:', paymentData);
          setEnrichedSuggestion(prev => ({
            ...prev!,
            payment_methods: { 
              name: (paymentData as any).CARTAO,
              CARTAO: (paymentData as any).CARTAO,
              TAXA: (paymentData as any).TAXA,
              PRAZO: (paymentData as any).PRAZO
            }
          }));
        } else {
          console.log('❌ Método de pagamento NÃO encontrado para:', suggestion.payment_method_id);
        }
      }
      
      // Buscar observações se não estiverem presentes
      if (!suggestion.observations && suggestion.id) {
        console.log('🔍 Buscando observações para suggestion:', suggestion.id);
        const { data: suggestionData } = await supabase
          .from('price_suggestions')
          .select('observations')
          .eq('id', suggestion.id)
          .maybeSingle();
        
        if (suggestionData && suggestionData.observations) {
          console.log('✅ Observações encontradas:', suggestionData.observations);
          setEnrichedSuggestion(prev => ({
            ...prev!,
            observations: suggestionData.observations
          }));
        } else {
          console.log('⚠️ Nenhuma observação encontrada para suggestion:', suggestion.id);
        }
      }
    } catch (err) {
      console.error('Erro ao buscar dados faltantes:', err);
    }
  };

  const loadApprovalHistory = async () => {
    if (!suggestion?.id) return;
    
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('approval_history')
        .select('*')
        .eq('suggestion_id', suggestion.id)
        .order('approval_level', { ascending: true });

      if (error) throw error;
      setApprovalHistory(data || []);
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    setEnrichedSuggestion(suggestion);
  }, [suggestion]);

  if (!suggestion) return null;
  
  const dataToShow = enrichedSuggestion || suggestion;
  
  console.log('🎯 ApprovalDetailsModal - dataToShow:', dataToShow);
  console.log('🎯 station_id:', dataToShow.station_id);
  console.log('🎯 client_id:', dataToShow.client_id);
  console.log('🎯 stations:', dataToShow.stations);
  console.log('🎯 clients:', dataToShow.clients);
  console.log('🎯 payment_method_id:', dataToShow.payment_method_id);
  console.log('🎯 payment_methods:', dataToShow.payment_methods);
  console.log('🎯 observations:', dataToShow.observations);
  console.log('🎯 observations type:', typeof dataToShow.observations);
  console.log('🎯 observations length:', dataToShow.observations?.length);
  console.log('🎯 price_origin_base:', dataToShow.price_origin_base);
  console.log('🎯 price_origin_bandeira:', dataToShow.price_origin_bandeira);
  console.log('🎯 price_origin_delivery:', dataToShow.price_origin_delivery);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Em Aprovação</Badge>;
      case "approved":
        return <Badge variant="secondary" className="bg-green-100 text-green-800">Aprovado</Badge>;
      case "rejected":
        return <Badge variant="secondary" className="bg-red-100 text-red-800">Rejeitado</Badge>;
      case "draft":
        return <Badge variant="secondary" className="bg-gray-100 text-gray-800">Rascunho</Badge>;
      default:
        return null;
    }
  };

  const viewAttachment = (url: string) => {
    window.open(url, '_blank');
  };

  const formatPrice = (price: number | null, decimals: number = 2) => {
    if (!price) return 'R$ 0,00';
    return price.toLocaleString('pt-BR', { 
      style: 'currency', 
      currency: 'BRL',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  };

  // Formata lucro: formata como número brasileiro sem casas decimais desnecessárias
  const formatLucro = (value: number): string => {
    if (!value && value !== 0) return '0';
    // Formatar como número inteiro se não tiver decimais significativos, senão com 2 casas
    const rounded = Math.round(value * 100) / 100; // Arredondar para 2 casas
    if (rounded % 1 === 0) {
      // Se for inteiro, mostrar sem decimais
      return rounded.toLocaleString('pt-BR');
    } else {
      // Se tiver decimais, mostrar com 2 casas
      return rounded.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
  };

  const formatPriceDynamic = (price: number | null) => {
    if (!price) return 'R$ 0,00';
    
    // Formatar com 4 casas decimais
    const formatted = price.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 4,
      maximumFractionDigits: 4
    });
    
    // Remover zeros à direita, mas manter pelo menos 2 casas se houver parte decimal
    const parts = formatted.split(',');
    if (parts.length === 2) {
      let decimal = parts[1];
      // Remove zeros à direita
      decimal = decimal.replace(/0+$/, '');
      // Garantir que há pelo menos 2 casas decimais se o valor tiver parte decimal
      if (decimal.length === 0) {
        decimal = '00';
      } else if (decimal.length === 1) {
        decimal = decimal + '0';
      }
      return parts[0] + ',' + decimal;
    }
    
    return formatted;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Converte valores possivelmente em centavos para reais, tratando vírgulas corretamente
  const fromMaybeCents = (v: number | string | null | undefined) => {
    if (!v) return 0;
    
    // Se for string, usar parseBrazilianDecimal para tratar vírgulas
    if (typeof v === 'string') {
      return parseBrazilianDecimal(v);
    }
    
    // Se for número, verificar se está em centavos (>= 20)
    const n = Number(v);
    return n >= 20 ? n / 100 : n;
  };

  const handleApprove = () => {
    onApprove(observations);
    setObservations("");
  };

  const handleReject = () => {
    onReject(observations);
    setObservations("");
  };

  const handleSuggestPrice = () => {
    if (onSuggestPrice) {
      const priceValue = suggestedPrice.trim() ? parseBrazilianDecimal(suggestedPrice) : (dataToShow.final_price || dataToShow.suggested_price || 0) / 100;
      if (!priceValue || priceValue <= 0) {
        return; // Preço inválido
      }
      onSuggestPrice(observations, priceValue);
      setObservations("");
      setSuggestedPrice("");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl w-[95vw] sm:w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto p-4 sm:p-6" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-2xl">Detalhes da Solicitação de Preço</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Status e Informações Básicas */}
          <Card>
            <CardContent className="pt-4 sm:pt-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground">Posto{dataToShow.stations_list && dataToShow.stations_list.length > 1 ? 's' : ''}</h4>
                  {dataToShow.stations_list && dataToShow.stations_list.length > 0 ? (
                    <div className="space-y-1">
                      {dataToShow.stations_list.map((station: any, idx: number) => (
                        <p key={idx} className="font-medium text-lg">
                          {station.name}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="font-medium text-lg">
                      {dataToShow.stations?.name 
                        || dataToShow.station_id 
                        || (dataToShow.station_id === null ? '⚠️ Aprovação antiga (sem posto)' : 'N/A')}
                    </p>
                  )}
                </div>
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground">Cliente</h4>
                  <p className="font-medium text-lg">
                    {dataToShow.clients?.name 
                      || dataToShow.client_id 
                      || (dataToShow.client_id === null ? '⚠️ Aprovação antiga (sem cliente)' : 'N/A')}
                  </p>
                </div>
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground">Produto</h4>
                  <p className="font-medium text-lg">
                    {(() => {
                      const productNames: { [key: string]: string } = {
                        'gasolina_comum': 'Gasolina Comum',
                        'gasolina_aditivada': 'Gasolina Aditivada',
                        'etanol': 'Etanol',
                        'diesel_comum': 'Diesel Comum',
                        's10': 'Diesel S-10',
                        'diesel_s500': 'Diesel S-500',
                        'arla32_granel': 'ARLA 32 Granel'
                      };
                      return productNames[dataToShow.product] || dataToShow.product;
                    })()}
                  </p>
                </div>
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground">Status</h4>
                  {getStatusBadge(dataToShow.status)}
                </div>
              </div>
              
              {/* Informações de Aprovação */}
              {(dataToShow.current_approver_name || dataToShow.current_approver_id) && (
                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-600">
                  <h4 className="font-medium text-sm text-muted-foreground">Em aprovação com</h4>
                  <p className="font-medium text-lg">
                    {dataToShow.current_approver_name || dataToShow.current_approver_id || 'N/A'}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Informações de Preço e Margem */}
          <Card>
            <CardContent className="pt-4 sm:pt-6">
              <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Análise de Preço</h3>
              {(() => {
                const taxa = dataToShow.payment_methods?.TAXA || 0;
                const purchaseCost = dataToShow.purchase_cost || 0;
                const freightCost = dataToShow.freight_cost || 0;
                const baseCost = purchaseCost + freightCost;
                const finalCost = taxa > 0 ? baseCost * (1 + taxa / 100) : baseCost;
                const hasOrigin = dataToShow.price_origin_base || dataToShow.price_origin_bandeira || dataToShow.price_origin_delivery;
                const taxValue = taxa > 0 ? baseCost * (taxa / 100) : 0;
                const currentPrice = fromMaybeCents(dataToShow.current_price) || (fromMaybeCents(dataToShow.cost_price)) || 0;
                const finalPrice = fromMaybeCents(dataToShow.final_price);
                const adjustment = finalPrice - currentPrice;
                const margin = finalPrice - finalCost;
                
                return (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
                      {/* Coluna Esquerda - Custos */}
                      <div className="space-y-3">
                        <div className="flex justify-between items-center py-2 border-b border-slate-200 dark:border-slate-700">
                          <h4 className="font-medium text-sm text-muted-foreground">Custo de Compra</h4>
                          <p className="text-lg font-bold">{formatPriceDynamic(purchaseCost)}</p>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-slate-200 dark:border-slate-700">
                          <h4 className="font-medium text-sm text-muted-foreground">Frete</h4>
                          <p className="text-lg font-bold">{formatPriceDynamic(freightCost)}</p>
                        </div>
                        {taxa > 0 && (
                          <>
                            <div className="flex justify-between items-center py-2 border-b border-slate-200 dark:border-slate-700">
                              <h4 className="font-medium text-sm text-muted-foreground">Taxa (%)</h4>
                              <p className="text-lg font-bold">{taxa.toFixed(2)}%</p>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-slate-200 dark:border-slate-700">
                              <h4 className="font-medium text-sm text-muted-foreground">Taxa (R$)</h4>
                              <p className="text-lg font-bold">{formatPriceDynamic(taxValue)}</p>
                            </div>
                          </>
                        )}
                      </div>
                      
                      {/* Coluna Direita - Preços e Pagamento */}
                      <div className="space-y-3">
                        <div className="flex justify-between items-center py-2 border-b border-slate-200 dark:border-slate-700">
                          <h4 className="font-medium text-sm text-muted-foreground">Preço Atual</h4>
                          <p className="text-lg font-bold">{formatPriceDynamic(currentPrice)}</p>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-slate-200 dark:border-slate-700">
                          <h4 className="font-medium text-sm text-muted-foreground">Preço Sugerido</h4>
                          <p className="text-lg font-bold">{formatPriceDynamic(finalPrice)}</p>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-slate-200 dark:border-slate-700">
                          <h4 className="font-medium text-sm text-muted-foreground">Ajuste</h4>
                          <p className={`text-lg font-bold ${adjustment > 0 ? 'text-emerald-600' : adjustment < 0 ? 'text-red-600' : ''}`}>
                            {adjustment !== 0 ? (adjustment > 0 ? '+' : '') : ''}
                            {formatPriceDynamic(adjustment)}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Informações de Pagamento Destacadas */}
                    {dataToShow.payment_methods && (
                      <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border-2 border-slate-300 dark:border-slate-600 mb-6">
                        <h4 className="font-semibold text-sm text-slate-700 dark:text-slate-300 mb-3">Informações de Pagamento</h4>
                        <div className="flex flex-wrap gap-6">
                          <div>
                            <h5 className="font-medium text-xs text-muted-foreground mb-1">Tipo de Pagamento</h5>
                            <p className="text-base font-bold">{dataToShow.payment_methods.name || dataToShow.payment_methods.CARTAO || 'N/A'}</p>
                          </div>
                          {dataToShow.payment_methods.PRAZO && (
                            <div>
                              <h5 className="font-medium text-xs text-muted-foreground mb-1">Prazo</h5>
                              <p className="text-base font-bold">
                                {(() => {
                                  const prazo = dataToShow.payment_methods.PRAZO;
                                  if (!prazo) return 'N/A';
                                  if (!isNaN(Number(prazo))) {
                                    return `${prazo} dias`;
                                  }
                                  return prazo;
                                })()}
                              </p>
                            </div>
                          )}
                          {taxa > 0 && (
                            <div>
                              <h5 className="font-medium text-xs text-muted-foreground mb-1">Taxa</h5>
                              <p className="text-base font-bold">{taxa.toFixed(2)}%</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Cards Destacados - Custo Final e Margem */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border-2 border-slate-300 dark:border-slate-600">
                        <h4 className="font-semibold text-sm text-slate-700 dark:text-slate-300 mb-2">
                          Custo Final/L {taxa > 0 ? '(com taxa)' : ''}
                        </h4>
                        <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">{formatPriceDynamic(finalCost)}</p>
                        {/* Origem do Custo - pequeno abaixo do custo */}
                        {(hasOrigin || taxa > 0) && (
                          <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                            <p className="text-[10px] leading-tight text-slate-500 dark:text-slate-400">
                              {hasOrigin && (
                                <>
                                  📍 {dataToShow.price_origin_bandeira && `🚩 ${dataToShow.price_origin_bandeira} `}
                                  {dataToShow.price_origin_base && `${dataToShow.price_origin_base} `}
                                  {dataToShow.price_origin_code && `(${dataToShow.price_origin_code}) `}
                                  {dataToShow.price_origin_delivery && `| ${dataToShow.price_origin_delivery}`}
                                </>
                              )}
                              {taxa > 0 && (
                                <span className={hasOrigin ? 'ml-1' : ''}>• Taxa: {taxa.toFixed(2)}% já incluída</span>
                              )}
                            </p>
                          </div>
                        )}
                      </div>
                      
                      <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border-2 border-slate-300 dark:border-slate-600">
                        <h4 className="font-semibold text-sm text-slate-700 dark:text-slate-300 mb-2">Margem</h4>
                        <p className={`text-2xl font-bold ${margin >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                          {formatPriceDynamic(margin)}
                        </p>
                      </div>
                    </div>
                  </>
                );
              })()}

              {/* Volume Realizado e Projetado */}
              {(dataToShow.volume_made || dataToShow.volume_projected) && (
                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-600">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    {dataToShow.volume_made && (
                      <div>
                        <h4 className="font-medium text-sm text-muted-foreground">Volume Realizado</h4>
                        <p className="text-xl font-bold">{dataToShow.volume_made.toLocaleString('pt-BR', { maximumFractionDigits: 4 })} m³</p>
                      </div>
                    )}
                    {dataToShow.volume_projected && (
                      <div>
                        <h4 className="font-medium text-sm text-muted-foreground">Volume Projetado</h4>
                        <p className="text-xl font-bold">{dataToShow.volume_projected.toLocaleString('pt-BR', { maximumFractionDigits: 4 })} m³</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>


          {/* Volume e Cálculos S10 */}
          {dataToShow.product === 's10' && (
            <>
              <Card>
                <CardContent className="pt-4 sm:pt-6">
                  <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Análise ARLA</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium text-sm text-muted-foreground">Volume Realizado (m³)</h4>
                        <p className="text-lg font-bold">{dataToShow.volume_made ? dataToShow.volume_made.toLocaleString('pt-BR') : '0'} m³</p>
                      </div>
                      <div>
                        <h4 className="font-medium text-sm text-muted-foreground">Volume Projetado (m³)</h4>
                        <p className="text-lg font-bold">{dataToShow.volume_projected ? dataToShow.volume_projected.toLocaleString('pt-BR') : '0'} m³</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium text-sm text-muted-foreground">Preço de Venda ARLA</h4>
                        <p className="text-lg font-bold">{formatPriceDynamic(fromMaybeCents(dataToShow.arla_purchase_price) || 0)}</p>
                      </div>
                      <div>
                        <h4 className="font-medium text-sm text-muted-foreground">Custo de Compra ARLA</h4>
                        <p className="text-lg font-bold">{formatPriceDynamic(fromMaybeCents(dataToShow.arla_cost_price) || 0)}</p>
                      </div>
                      <div>
                        {(() => {
                          // Converter preços de centavos para reais se necessário
                          const arlaSalePrice = fromMaybeCents(dataToShow.arla_purchase_price) || 0;
                          const arlaCostPrice = fromMaybeCents(dataToShow.arla_cost_price) || 0;
                          const margin = arlaSalePrice - arlaCostPrice;
                          return (
                            <>
                              <h4 className="font-medium text-sm text-muted-foreground">Margem ARLA (por litro)</h4>
                              <p className="text-lg font-bold">
                                {formatPriceDynamic(margin)}
                              </p>
                            </>
                          );
                        })()}
                      </div>
                      {dataToShow.volume_projected && (
                        <>
                          <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border-2 border-slate-300 dark:border-slate-600">
                            {(() => {
                              // Converter preços de centavos para reais se necessário
                              const arlaSalePrice = fromMaybeCents(dataToShow.arla_purchase_price) || 0;
                              const arlaCostPrice = fromMaybeCents(dataToShow.arla_cost_price) || 0;
                              const margin = arlaSalePrice - arlaCostPrice;
                              // volume_projected está em m³, converter para litros e calcular 5% do volume
                              const volumeProjetadoLitros = (dataToShow.volume_projected || 0) * 1000;
                              const consumoArlaLitros = volumeProjetadoLitros * 0.05;
                              const lucroTotal = margin * consumoArlaLitros;
                              return (
                                <>
                                  <h4 className="font-semibold text-sm text-slate-700 dark:text-slate-300 mb-2">Lucro no Volume Projetado (5%)</h4>
                                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">R$ {formatLucro(lucroTotal)}</p>
                                  <p className="text-xs text-muted-foreground mt-2">
                                    {formatPriceDynamic(margin)} × {consumoArlaLitros.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} L
                                  </p>
                                </>
                              );
                            })()}
                          </div>
                          <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border-2 border-slate-300 dark:border-slate-600">
                            {(() => {
                              // Converter preços de centavos para reais se necessário
                              const arlaSalePrice = fromMaybeCents(dataToShow.arla_purchase_price) || 0;
                              const arlaCostPrice = fromMaybeCents(dataToShow.arla_cost_price) || 0;
                              const margin = arlaSalePrice - arlaCostPrice;
                              // volume_projected está em m³, converter para litros e calcular 10% do volume
                              const volumeProjetadoLitros = (dataToShow.volume_projected || 0) * 1000;
                              const consumoArlaLitros = volumeProjetadoLitros * 0.10;
                              const lucroTotal = margin * consumoArlaLitros;
                              return (
                                <>
                                  <h4 className="font-semibold text-sm text-slate-700 dark:text-slate-300 mb-2">Lucro no Volume Projetado (10%)</h4>
                                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">R$ {formatLucro(lucroTotal)}</p>
                                  <p className="text-xs text-muted-foreground mt-2">
                                    {formatPriceDynamic(margin)} × {consumoArlaLitros.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} L
                                  </p>
                                </>
                              );
                            })()}
                      </div>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Análise de Lucro Líquido com ARLA */}
              <Card>
                <CardContent className="pt-4 sm:pt-6">
                  <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Análise de Lucro Líquido</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border-2 border-slate-300 dark:border-slate-600">
                      {(() => {
                        // Lucro líquido = Lucro Total Projetado (com taxa) + Lucro ARLA 5%
                        const purchaseCost = dataToShow.purchase_cost || 0;
                        const freightCost = dataToShow.freight_cost || 0;
                        const baseCost = purchaseCost + freightCost;
                        const taxa = dataToShow.payment_methods?.TAXA || 0;
                        const taxValue = baseCost * (taxa / 100);
                        const totalCost = baseCost + taxValue;
                        const finalPrice = fromMaybeCents(dataToShow.final_price);
                        const marginWithTax = finalPrice - totalCost;
                        // Converter volume de m³ para litros (1 m³ = 1000 litros)
                        const volumeProjetadoLitros = (dataToShow.volume_projected || 0) * 1000;
                        const lucroTotalProjetado = marginWithTax * volumeProjetadoLitros;
                        
                        // Converter preços de centavos para reais se necessário
                        const arlaSalePrice = fromMaybeCents(dataToShow.arla_purchase_price) || 0;
                        const arlaCostPrice = fromMaybeCents(dataToShow.arla_cost_price) || 0;
                        const marginArla = arlaSalePrice - arlaCostPrice;
                        // Converter volume de m³ para litros e calcular 5% do volume
                        const consumoArla5Litros = (dataToShow.volume_projected || 0) * 1000 * 0.05;
                        const lucroArla5 = marginArla * consumoArla5Litros;
                        
                        const lucroLiquidoTotal5 = lucroTotalProjetado + lucroArla5;
                        
                        return (
                          <>
                            <h4 className="font-semibold text-sm text-slate-700 dark:text-slate-300 mb-2">Lucro Total Líquido + ARLA 5%</h4>
                            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                              R$ {formatLucro(lucroLiquidoTotal5)}
                            </p>
                            <p className="text-xs text-muted-foreground mt-2">
                              Lucro S10: R$ {formatLucro(lucroTotalProjetado)} + Lucro ARLA: R$ {formatLucro(lucroArla5)}
                            </p>
                          </>
                        );
                        })()}
                    </div>
                    <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border-2 border-slate-300 dark:border-slate-600">
                        {(() => {
                        // Lucro líquido = Lucro Total Projetado (com taxa) + Lucro ARLA 10%
                        const purchaseCost = dataToShow.purchase_cost || 0;
                        const freightCost = dataToShow.freight_cost || 0;
                        const baseCost = purchaseCost + freightCost;
                        const taxa = dataToShow.payment_methods?.TAXA || 0;
                        const taxValue = baseCost * (taxa / 100);
                        const totalCost = baseCost + taxValue;
                        const finalPrice = fromMaybeCents(dataToShow.final_price);
                        const marginWithTax = finalPrice - totalCost;
                        // Converter volume de m³ para litros (1 m³ = 1000 litros)
                        const volumeProjetadoLitros = (dataToShow.volume_projected || 0) * 1000;
                        const lucroTotalProjetado = marginWithTax * volumeProjetadoLitros;
                        
                        // Converter preços de centavos para reais se necessário
                        const arlaSalePrice = fromMaybeCents(dataToShow.arla_purchase_price) || 0;
                        const arlaCostPrice = fromMaybeCents(dataToShow.arla_cost_price) || 0;
                        const marginArla = arlaSalePrice - arlaCostPrice;
                        // Converter volume de m³ para litros e calcular 10% do volume
                        const consumoArla10Litros = (dataToShow.volume_projected || 0) * 1000 * 0.10;
                        const lucroArla10 = marginArla * consumoArla10Litros;
                        
                        const lucroLiquidoTotal10 = lucroTotalProjetado + lucroArla10;
                        
                        return (
                          <>
                            <h4 className="font-semibold text-sm text-slate-700 dark:text-slate-300 mb-2">Lucro Total Líquido + ARLA 10%</h4>
                            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                              R$ {formatLucro(lucroLiquidoTotal10)}
                            </p>
                            <p className="text-xs text-muted-foreground mt-2">
                              Lucro S10: R$ {formatLucro(lucroTotalProjetado)} + Lucro ARLA: R$ {formatLucro(lucroArla10)}
                            </p>
                          </>
                        );
                        })()}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* Análise de Lucro para outros tipos de Diesel */}
          {(dataToShow.product === 'diesel_comum' || dataToShow.product === 'diesel_s500') && dataToShow.volume_projected && (
            <Card>
              <CardContent className="pt-4 sm:pt-6">
                <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Análise de Lucro</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border-2 border-slate-300 dark:border-slate-600">
                    {(() => {
                      const purchaseCost = dataToShow.purchase_cost || 0;
                      const freightCost = dataToShow.freight_cost || 0;
                      const baseCost = purchaseCost + freightCost;
                      const taxa = dataToShow.payment_methods?.TAXA || 0;
                      const taxValue = baseCost * (taxa / 100);
                      const totalCost = baseCost + taxValue;
                      const finalPrice = fromMaybeCents(dataToShow.final_price);
                      const marginWithTax = finalPrice - totalCost;
                      // Converter volume de m³ para litros (1 m³ = 1000 litros)
                      const volumeProjetadoLitros = (dataToShow.volume_projected || 0) * 1000;
                      const lucroTotalProjetado = marginWithTax * volumeProjetadoLitros;
                      
                      return (
                        <>
                          <h4 className="font-semibold text-sm text-slate-700 dark:text-slate-300 mb-2">Lucro Total Projetado</h4>
                          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                            R$ {formatLucro(lucroTotalProjetado)}
                          </p>
                          <p className="text-xs text-muted-foreground mt-2">
                            Margem/L: {formatPriceDynamic(marginWithTax)} × Volume: {dataToShow.volume_projected.toLocaleString('pt-BR', { maximumFractionDigits: 4 })} m³ ({volumeProjetadoLitros.toLocaleString('pt-BR')} L)
                          </p>
                        </>
                      );
                    })()}
                  </div>
                  <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border-2 border-slate-300 dark:border-slate-600">
                    {(() => {
                      const purchaseCost = dataToShow.purchase_cost || 0;
                      const freightCost = dataToShow.freight_cost || 0;
                      const baseCost = purchaseCost + freightCost;
                      const taxa = dataToShow.payment_methods?.TAXA || 0;
                      const taxValue = baseCost * (taxa / 100);
                      const totalCost = baseCost + taxValue;
                      const finalPrice = fromMaybeCents(dataToShow.final_price);
                      const marginWithTax = finalPrice - totalCost;
                      // Converter volume de m³ para litros (1 m³ = 1000 litros)
                      const volumeProjetadoLitros = (dataToShow.volume_projected || 0) * 1000;
                      const lucroPorLitro = marginWithTax;
                      
                      return (
                        <>
                          <h4 className="font-semibold text-sm text-slate-700 dark:text-slate-300 mb-2">Margem por Litro</h4>
                          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                            {formatPriceDynamic(lucroPorLitro)}
                          </p>
                          <p className="text-xs text-muted-foreground mt-2">
                            Preço: {formatPriceDynamic(finalPrice)} - Custo: {formatPriceDynamic(totalCost)}
                          </p>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Observações do Solicitante */}
          <Card>
            <CardContent className="pt-4 sm:pt-6">
              <h4 className="font-medium text-sm text-muted-foreground mb-2">Observações do Solicitante</h4>
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 max-h-32 overflow-y-auto">
                {dataToShow.observations ? (
                  <p className="text-sm whitespace-pre-wrap break-words">{dataToShow.observations}</p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Nenhuma observação registrada</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Histórico de Aprovações */}
          {approvalHistory.length > 0 && (
            <Card>
              <CardContent className="pt-4 sm:pt-6">
                <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Histórico de Aprovações
                </h3>
                <div className="space-y-4">
                  {approvalHistory.map((history, index) => (
                    <div key={history.id} className={`border-l-4 pl-3 sm:pl-4 py-2 ${history.action === 'approved' ? 'border-green-500' : 'border-red-500'}`}>
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <User className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
                            <span className="font-semibold text-sm sm:text-base">{history.approver_name}</span>
                            <Badge variant={history.action === 'approved' ? 'default' : 'destructive'} className="text-xs">
                              {history.action === 'approved' ? 'Aprovado' : 'Rejeitado'}
                            </Badge>
                            <span className="text-xs text-muted-foreground">Nível {history.approval_level}</span>
                          </div>
                          {history.observations && (
                            <p className="text-xs sm:text-sm text-muted-foreground mt-2 italic break-words">"{history.observations}"</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span className="text-[10px] sm:text-xs">{formatDate(history.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Status de Aprovação Atual */}
          <Card>
            <CardContent className="pt-4 sm:pt-6">
              <div className="grid grid-cols-3 gap-2 sm:gap-4">
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground">Nível de Aprovação</h4>
                  <p className="text-lg font-bold">{dataToShow.approval_level || 1} de {dataToShow.total_approvers || 3}</p>
                </div>
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground">Aprovações</h4>
                  <p className="text-lg font-bold">{dataToShow.approvals_count || 0}</p>
                </div>
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground">Rejeições</h4>
                  <p className="text-lg font-bold">{dataToShow.rejections_count || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Anexos */}
          {dataToShow.attachments && dataToShow.attachments.length > 0 && (
            <Card>
              <CardContent className="pt-4 sm:pt-6">
                <h4 className="font-medium text-sm text-muted-foreground mb-3">Anexos</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2">
                  {dataToShow.attachments.map((url: string, index: number) => {
                    const fileName = url.split('/').pop() || `Anexo ${index + 1}`;
                    const isImage = url.match(/\.(jpg|jpeg|png|gif|webp)$/i);
                    
                    return (
                      <div key={index} className="border rounded-lg p-3">
                        {isImage ? (
                          <div className="space-y-2">
                            <img 
                              src={url} 
                              alt={fileName}
                              className="w-full h-32 object-cover rounded cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={() => {
                                setSelectedImage(url);
                                setImageViewerOpen(true);
                              }}
                            />
                            <div className="flex gap-2">
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="flex-1"
                                onClick={() => {
                                  setSelectedImage(url);
                                  setImageViewerOpen(true);
                                }}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                Ver Tela Cheia
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="h-32 bg-secondary/20 rounded flex items-center justify-center">
                              <Download className="h-8 w-8 text-muted-foreground" />
                            </div>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="w-full"
                              onClick={() => viewAttachment(url)}
                            >
                              <Download className="h-4 w-4 mr-1" />
                              Download
                            </Button>
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground mt-1 truncate">{fileName}</p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Data da Solicitação */}
          <Card>
            <CardContent className="pt-4 sm:pt-6">
              <h4 className="font-medium text-sm text-muted-foreground">Data da Solicitação</h4>
              <p className="font-medium">{formatDate(dataToShow.created_at)}</p>
            </CardContent>
          </Card>

          {/* Ações de Aprovação - Apenas se status for pending E não for readOnly */}
          {dataToShow.status === 'pending' && !readOnly && (
            <Card className="bg-slate-50 dark:bg-slate-900">
              <CardContent className="pt-4 sm:pt-6">
                <div className="space-y-3 sm:space-y-4">
                  <div>
                    <Label htmlFor="observations" className="text-sm sm:text-base font-semibold">
                      Observações (obrigatório)
                    </Label>
                    <p className="text-xs sm:text-sm text-muted-foreground mb-2">
                      Deixe sua observação para o próximo aprovador ou para o solicitante
                    </p>
                    <Textarea
                      id="observations"
                      placeholder="Digite suas observações sobre esta solicitação..."
                      value={observations}
                      onChange={(e) => setObservations(e.target.value)}
                      rows={4}
                      className="resize-none text-sm sm:text-base"
                    />
                  </div>

                  {onSuggestPrice && (
                    <div>
                      <Label htmlFor="suggested-price" className="text-sm sm:text-base font-semibold">
                        Preço Sugerido (R$/L) - Opcional
                      </Label>
                      <p className="text-xs sm:text-sm text-muted-foreground mb-2">
                        Se desejar sugerir um preço diferente, informe abaixo
                      </p>
                      <Input
                        id="suggested-price"
                        type="text"
                        placeholder={formatPriceDynamic((dataToShow.final_price || dataToShow.suggested_price || 0) / 100)}
                        value={suggestedPrice}
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
                          
                          setSuggestedPrice(value);
                        }}
                        onBlur={(e) => {
                          const value = e.target.value.trim();
                          if (value) {
                            // Se não tem vírgula, adicionar ,00
                            if (!value.includes(',')) {
                              const numValue = parseFloat(value.replace(/[^\d]/g, ''));
                              if (!isNaN(numValue) && numValue > 0) {
                                setSuggestedPrice(numValue.toFixed(2).replace('.', ','));
                                return;
                              }
                            }
                            
                            const numValue = parseBrazilianDecimal(value);
                            if (!isNaN(numValue) && numValue > 0) {
                              // Formatar com vírgula e 2 casas decimais
                              const formatted = numValue.toFixed(2).replace('.', ',');
                              setSuggestedPrice(formatted);
                            }
                          }
                        }}
                      />
                    </div>
                  )}

                  <Separator />

                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                    <Button
                      onClick={handleApprove}
                      disabled={loading || !observations.trim()}
                      className="w-full sm:flex-1 bg-green-600 hover:bg-green-700"
                      size="lg"
                    >
                      <Check className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                      Aprovar
                    </Button>
                    <Button
                      onClick={handleReject}
                      disabled={loading || !observations.trim()}
                      variant="destructive"
                      className="w-full sm:flex-1"
                      size="lg"
                    >
                      <X className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                      Rejeitar
                    </Button>
                    {onSuggestPrice && (
                      <Button
                        onClick={handleSuggestPrice}
                        disabled={loading || !suggestedPrice.trim()}
                        variant="outline"
                        className="w-full sm:flex-1 border-blue-600 text-blue-600 hover:bg-blue-50"
                        size="lg"
                      >
                        <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                        Sugerir Preço
                      </Button>
                    )}
                  </div>
                  
                  {!observations.trim() && (
                    <p className="text-xs sm:text-sm text-amber-600 text-center">
                      Por favor, adicione uma observação antes de aprovar ou rejeitar
                    </p>
                  )}
                  {onSuggestPrice && !suggestedPrice.trim() && (
                    <p className="text-xs sm:text-sm text-amber-600 text-center">
                      Por favor, informe um preço sugerido
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Image Viewer Modal */}
      <ImageViewerModal
        isOpen={imageViewerOpen}
        onClose={() => setImageViewerOpen(false)}
        imageUrl={selectedImage}
        imageName="Anexo da Solicitação"
      />
    </Dialog>
  );
};