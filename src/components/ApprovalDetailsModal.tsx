import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Eye, Download, Check, X, User, Calendar, MessageSquare } from "lucide-react";
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
  loading: boolean;
  readOnly?: boolean;
}

export const ApprovalDetailsModal = ({ 
  isOpen, 
  onClose, 
  suggestion, 
  onApprove, 
  onReject,
  loading,
  readOnly = false
}: ApprovalDetailsModalProps) => {
  const [observations, setObservations] = useState("");
  const [approvalHistory, setApprovalHistory] = useState<ApprovalHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string>("");

  const [enrichedSuggestion, setEnrichedSuggestion] = useState(suggestion);

  useEffect(() => {
    if (suggestion?.id && isOpen) {
      loadApprovalHistory();
      
      // Buscar dados faltantes (stations, clients, payment_methods)
      if (!suggestion.stations || !suggestion.clients || !suggestion.payment_methods) {
        loadMissingData();
      }
    }
  }, [suggestion?.id, isOpen, suggestion]);
  
  const loadMissingData = async () => {
    if (!suggestion) return;
    
    // Se os IDs estiverem null, não podemos buscar nada
    if (!suggestion?.station_id && !suggestion?.client_id) {
      console.log('⚠️ Não há IDs para buscar - aprovacoes antigas');
      return;
    }
    
    try {
      console.log('🔍 Buscando dados faltantes para suggestion:', suggestion.id);
      
      // Buscar posto se necessário
      if (!suggestion.stations && suggestion.station_id) {
        console.log('🔍 Buscando posto:', suggestion.station_id);
        const { data: stationData } = await supabase
          .from('sis_empresa' as any)
          .select('nome_empresa, cnpj_cpf')
          .or(`cnpj_cpf.eq.${suggestion.station_id},id.eq.${suggestion.station_id}`)
          .maybeSingle();
        
        if (stationData) {
          setEnrichedSuggestion({
            ...suggestion,
            stations: { name: (stationData as any).nome_empresa, code: (stationData as any).cnpj_cpf }
          });
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

  // Formata preço dinamicamente: mostra até 4 casas, mas remove zeros à direita
  const formatLucro = (value: number): string => {
    // Formatar lucro com 3 casas decimais usando ponto
    return value.toFixed(3).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="text-2xl">Detalhes da Solicitação de Preço</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Status e Informações Básicas */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground">Posto</h4>
                  <p className="font-medium text-lg">
                    {dataToShow.stations?.name 
                      || dataToShow.station_id 
                      || (dataToShow.station_id === null ? '⚠️ Aprovação antiga (sem posto)' : 'N/A')}
                  </p>
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
                  <p className="font-medium text-lg text-orange-600">
                    {dataToShow.current_approver_name || dataToShow.current_approver_id || 'N/A'}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Informações de Preço e Margem */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold mb-4">Análise de Preço</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground">Custo de Compra</h4>
                  <p className="text-xl font-bold">{formatPriceDynamic(dataToShow.purchase_cost || 0)}</p>
                </div>
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground">Frete</h4>
                  <p className="text-xl font-bold">{formatPriceDynamic(dataToShow.freight_cost || 0)}</p>
                </div>
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground">Custo Base</h4>
                  <p className="text-xl font-bold">{formatPriceDynamic((dataToShow.purchase_cost || 0) + (dataToShow.freight_cost || 0))}</p>
                </div>
                <div>
                  {(() => {
                    // Ajuste = Preço Sugerido - Preço Atual (não custo total)
                    const currentPrice = fromMaybeCents(dataToShow.current_price) || (fromMaybeCents(dataToShow.cost_price)) || 0;
                    const finalPrice = fromMaybeCents(dataToShow.final_price);
                    const adjustment = finalPrice - currentPrice;
                    return (
                      <>
                        <h4 className="font-medium text-sm text-muted-foreground">
                          Ajuste
                        </h4>
                        <p className={`text-xl font-bold ${adjustment > 0 ? 'text-green-600' : adjustment < 0 ? 'text-red-600' : 'text-blue-600'}`}> 
                          {adjustment !== 0 ? (adjustment > 0 ? '+' : '') : ''}
                          {formatPriceDynamic(adjustment)}
                        </p>
                      </>
                    );
                  })()}
                </div>
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground">Preço Sugerido</h4>
                  <p className="text-xl font-bold text-green-600">{formatPriceDynamic(fromMaybeCents(dataToShow.final_price))}</p>
                </div>
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground">Margem</h4>
                  <p className={`text-xl font-bold ${(() => {
                    const purchaseCost = dataToShow.purchase_cost || 0;
                    const freightCost = dataToShow.freight_cost || 0;
                    const totalCost = purchaseCost + freightCost;
                    const finalPrice = fromMaybeCents(dataToShow.final_price);
                    const margin = finalPrice - totalCost;
                    return margin >= 0 ? 'text-green-600' : 'text-red-600';
                  })()}`}>
                    {(() => {
                      const purchaseCost = dataToShow.purchase_cost || 0;
                      const freightCost = dataToShow.freight_cost || 0;
                      const totalCost = purchaseCost + freightCost;
                      const finalPrice = fromMaybeCents(dataToShow.final_price);
                      const margin = finalPrice - totalCost;
                      return formatPriceDynamic(margin);
                    })()}
                  </p>
                </div>
              </div>

              {/* Volume Realizado e Projetado */}
              {(dataToShow.volume_made || dataToShow.volume_projected) && (
                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-600">
                  <div className="grid grid-cols-2 gap-4">
                    {dataToShow.volume_made && (
                      <div>
                        <h4 className="font-medium text-sm text-muted-foreground">Volume Realizado</h4>
                        <p className="text-xl font-bold">{dataToShow.volume_made.toLocaleString('pt-BR', { maximumFractionDigits: 4 })} m³</p>
                      </div>
                    )}
                    {dataToShow.volume_projected && (
                      <div>
                        <h4 className="font-medium text-sm text-muted-foreground">Volume Projetado</h4>
                        <p className="text-xl font-bold text-blue-600">{dataToShow.volume_projected.toLocaleString('pt-BR', { maximumFractionDigits: 4 })} m³</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Mostrar Taxa e Tipo de Pagamento se disponível */}
              {dataToShow.payment_methods && (
                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-600">
                  <h4 className="font-semibold mb-3 text-orange-600">Informações de Pagamento</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <h4 className="font-medium text-sm text-muted-foreground">Tipo de Pagamento</h4>
                      <p className="text-lg font-bold">{dataToShow.payment_methods.name || dataToShow.payment_methods.CARTAO || 'N/A'}</p>
                    </div>
                    {dataToShow.payment_methods.TAXA && (
                      <>
                        <div>
                          <h4 className="font-medium text-sm text-muted-foreground">Taxa</h4>
                          <p className="text-lg font-bold text-orange-600">{dataToShow.payment_methods.TAXA}%</p>
                        </div>
                        <div>
                          <h4 className="font-medium text-sm text-muted-foreground">Prazo</h4>
                          <p className="text-lg font-bold">
                            {(() => {
                              const prazo = dataToShow.payment_methods.PRAZO;
                              if (!prazo) return 'N/A';
                              // Se for um número, adicionar "dias"
                              if (!isNaN(Number(prazo))) {
                                return `${prazo} dias`;
                              }
                              return prazo;
                            })()}
                          </p>
                        </div>
                        <div>
                          {(() => {
                            const purchaseCost = dataToShow.purchase_cost || 0;
                            const freightCost = dataToShow.freight_cost || 0;
                            const baseCost = purchaseCost + freightCost;
                            const taxa = dataToShow.payment_methods.TAXA || 0;
                            const taxValue = baseCost * (taxa / 100);
                            return (
                              <>
                                <h4 className="font-medium text-sm text-muted-foreground">Taxa em R$</h4>
                                <p className="text-lg font-bold text-orange-600">{formatPriceDynamic(taxValue)}</p>
                              </>
                            );
                          })()}
                        </div>
                      </>
                    )}
                  </div>
                  
                  {/* Mostrar cálculo do custo total com taxa */}
                  {dataToShow.payment_methods.TAXA && (
                    <div className="mt-4 p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium text-sm text-slate-700 dark:text-slate-300">Custo Total (Base + Taxa)</span>
                        </div>
                        {(() => {
                          const purchaseCost = dataToShow.purchase_cost || 0;
                          const freightCost = dataToShow.freight_cost || 0;
                          const baseCost = purchaseCost + freightCost;
                          const taxa = dataToShow.payment_methods.TAXA || 0;
                          const taxValue = baseCost * (taxa / 100);
                          const totalCost = baseCost + taxValue;
                          return (
                            <span className="text-lg font-bold text-orange-600">{formatPriceDynamic(totalCost)}</span>
                          );
                        })()}
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                        {formatPriceDynamic((dataToShow.purchase_cost || 0) + (dataToShow.freight_cost || 0))} + {dataToShow.payment_methods.TAXA}% = {(() => {
                          const purchaseCost = dataToShow.purchase_cost || 0;
                          const freightCost = dataToShow.freight_cost || 0;
                          const baseCost = purchaseCost + freightCost;
                          const taxa = dataToShow.payment_methods.TAXA || 0;
                          const taxValue = baseCost * (taxa / 100);
                          const totalCost = baseCost + taxValue;
                          return formatPriceDynamic(totalCost);
                        })()}
                      </div>
                    </div>
                  )}
                  
                  {/* Análise de Lucro considerando a taxa */}
                  {dataToShow.payment_methods.TAXA && dataToShow.volume_projected && (
                    <div className="mt-4 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                      <h4 className="font-semibold mb-3 text-green-700 dark:text-green-300">Análise de Lucro</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <h4 className="font-medium text-sm text-muted-foreground">Margem (com taxa)</h4>
                          {(() => {
                            const purchaseCost = dataToShow.purchase_cost || 0;
                            const freightCost = dataToShow.freight_cost || 0;
                            const baseCost = purchaseCost + freightCost;
                            const taxa = dataToShow.payment_methods.TAXA || 0;
                            const taxValue = baseCost * (taxa / 100);
                            const totalCost = baseCost + taxValue;
                            const finalPrice = fromMaybeCents(dataToShow.final_price);
                            const marginWithTax = finalPrice - totalCost;
                            return (
                              <p className={`text-lg font-bold ${marginWithTax >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {formatPriceDynamic(marginWithTax)}
                              </p>
                            );
                          })()}
                        </div>
                        <div>
                          <h4 className="font-medium text-sm text-muted-foreground">Lucro Total Projetado</h4>
                          {(() => {
                            const purchaseCost = dataToShow.purchase_cost || 0;
                            const freightCost = dataToShow.freight_cost || 0;
                            const baseCost = purchaseCost + freightCost;
                            const taxa = dataToShow.payment_methods.TAXA || 0;
                            const taxValue = baseCost * (taxa / 100);
                            const totalCost = baseCost + taxValue;
                            const finalPrice = fromMaybeCents(dataToShow.final_price);
                            const marginWithTax = finalPrice - totalCost;
                            const lucroTotal = marginWithTax * dataToShow.volume_projected;
                            return (
                              <p className="text-lg font-bold text-green-600">
                                R$ {formatLucro(lucroTotal)}
                              </p>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Origem do Preço */}
          {dataToShow.price_origin_base && (
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold mb-4">Origem do Preço de Custo</h3>
                <div className="grid grid-cols-5 gap-4">
                  <div>
                    <h4 className="font-medium text-sm text-muted-foreground">Bandeira</h4>
                    <p className="font-medium">🚩 {dataToShow.price_origin_bandeira || 'N/A'}</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-sm text-muted-foreground">Base</h4>
                    <p className="font-medium">{dataToShow.price_origin_base}</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-sm text-muted-foreground">Código</h4>
                    <p className="font-medium">{dataToShow.price_origin_code || 'N/A'}</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-sm text-muted-foreground">UF</h4>
                    <p className="font-medium">{dataToShow.price_origin_uf || 'N/A'}</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-sm text-muted-foreground">Tipo de Entrega</h4>
                    <p className="font-medium">{dataToShow.price_origin_delivery || 'N/A'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Volume e Cálculos S10 */}
          {dataToShow.product === 's10' && (
            <>
              <Card>
                <CardContent className="pt-6">
                  <h3 className="text-lg font-semibold mb-4">Análise ARLA</h3>
                  <div className="grid grid-cols-2 gap-6">
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
                        <p className="text-lg font-bold">{formatPriceDynamic(dataToShow.arla_purchase_price || 0)}</p>
                      </div>
                      <div>
                        <h4 className="font-medium text-sm text-muted-foreground">Custo de Compra ARLA</h4>
                        <p className="text-lg font-bold">{formatPriceDynamic(dataToShow.arla_cost_price || 0)}</p>
                      </div>
                      <div>
                        {(() => {
                          const arlaSalePrice = dataToShow.arla_purchase_price || 0;
                          const arlaCostPrice = dataToShow.arla_cost_price || 0;
                          const margin = arlaSalePrice - arlaCostPrice;
                          return (
                            <>
                              <h4 className="font-medium text-sm text-muted-foreground">Margem ARLA (por litro)</h4>
                              <p className={`text-lg font-bold ${margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {formatPriceDynamic(margin)}
                              </p>
                            </>
                          );
                        })()}
                      </div>
                      {dataToShow.volume_projected && (
                        <>
                          <div>
                            {(() => {
                              const arlaSalePrice = dataToShow.arla_purchase_price || 0;
                              const arlaCostPrice = dataToShow.arla_cost_price || 0;
                              const margin = arlaSalePrice - arlaCostPrice;
                              const consumoArla = dataToShow.volume_projected * 0.05; // 5% do volume projetado
                              const lucroTotal = margin * consumoArla;
                              return (
                                <>
                                  <h4 className="font-medium text-sm text-muted-foreground">Lucro no Volume Projetado (5%)</h4>
                                  <p className="text-lg font-bold text-green-600">R$ {formatLucro(lucroTotal)}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {formatPriceDynamic(margin)} × {consumoArla.toLocaleString('pt-BR', { maximumFractionDigits: 4 })} m³
                                  </p>
                                </>
                              );
                            })()}
                          </div>
                          <div>
                            {(() => {
                              const arlaSalePrice = dataToShow.arla_purchase_price || 0;
                              const arlaCostPrice = dataToShow.arla_cost_price || 0;
                              const margin = arlaSalePrice - arlaCostPrice;
                              const consumoArla = dataToShow.volume_projected * 0.10; // 10% do volume projetado
                              const lucroTotal = margin * consumoArla;
                              return (
                                <>
                                  <h4 className="font-medium text-sm text-muted-foreground">Lucro no Volume Projetado (10%)</h4>
                                  <p className="text-lg font-bold text-green-600">R$ {formatLucro(lucroTotal)}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {formatPriceDynamic(margin)} × {consumoArla.toLocaleString('pt-BR', { maximumFractionDigits: 4 })} m³
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
              <Card className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/20 dark:to-indigo-950/20">
                <CardContent className="pt-6">
                  <h3 className="text-lg font-semibold mb-4">Análise de Lucro Líquido</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
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
                        const lucroTotalProjetado = marginWithTax * dataToShow.volume_projected;
                        
                        const arlaSalePrice = dataToShow.arla_purchase_price || 0;
                        const arlaCostPrice = dataToShow.arla_cost_price || 0;
                        const marginArla = arlaSalePrice - arlaCostPrice;
                        const consumoArla5 = dataToShow.volume_projected * 0.05;
                        const lucroArla5 = marginArla * consumoArla5;
                        
                        const lucroLiquidoTotal5 = lucroTotalProjetado + lucroArla5;
                        
                        return (
                          <>
                            <h4 className="font-medium text-sm text-muted-foreground">Lucro Total Líquido + ARLA 5%</h4>
                            <p className="text-2xl font-bold text-purple-600">
                              R$ {formatLucro(lucroLiquidoTotal5)}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Lucro S10: R$ {formatLucro(lucroTotalProjetado)} + Lucro ARLA: R$ {formatLucro(lucroArla5)}
                            </p>
                          </>
                        );
                        })()}
                    </div>
                    <div>
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
                        const lucroTotalProjetado = marginWithTax * dataToShow.volume_projected;
                        
                        const arlaSalePrice = dataToShow.arla_purchase_price || 0;
                        const arlaCostPrice = dataToShow.arla_cost_price || 0;
                        const marginArla = arlaSalePrice - arlaCostPrice;
                        const consumoArla10 = dataToShow.volume_projected * 0.10;
                        const lucroArla10 = marginArla * consumoArla10;
                        
                        const lucroLiquidoTotal10 = lucroTotalProjetado + lucroArla10;
                        
                        return (
                          <>
                            <h4 className="font-medium text-sm text-muted-foreground">Lucro Total Líquido + ARLA 10%</h4>
                            <p className="text-2xl font-bold text-purple-600">
                              R$ {formatLucro(lucroLiquidoTotal10)}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
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

          {/* Observações do Solicitante */}
          {dataToShow.observations && (
            <Card>
              <CardContent className="pt-6">
                <h4 className="font-medium text-sm text-muted-foreground mb-2">Observações do Solicitante</h4>
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 max-h-32 overflow-y-auto">
                  <p className="text-sm whitespace-pre-wrap break-words">{dataToShow.observations}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Histórico de Aprovações */}
          {approvalHistory.length > 0 && (
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Histórico de Aprovações
                </h3>
                <div className="space-y-4">
                  {approvalHistory.map((history, index) => (
                    <div key={history.id} className="border-l-4 pl-4 py-2" 
                         style={{ borderColor: history.action === 'approved' ? '#22c55e' : '#ef4444' }}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="font-semibold">{history.approver_name}</span>
                            <Badge variant={history.action === 'approved' ? 'default' : 'destructive'} className="text-xs">
                              {history.action === 'approved' ? 'Aprovado' : 'Rejeitado'}
                            </Badge>
                            <span className="text-xs text-muted-foreground">Nível {history.approval_level}</span>
                          </div>
                          {history.observations && (
                            <p className="text-sm text-muted-foreground mt-2 italic">"{history.observations}"</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {formatDate(history.created_at)}
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
            <CardContent className="pt-6">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground">Nível de Aprovação</h4>
                  <p className="text-lg font-bold">{dataToShow.approval_level || 1} de {dataToShow.total_approvers || 3}</p>
                </div>
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground">Aprovações</h4>
                  <p className="text-lg font-bold text-green-600">{dataToShow.approvals_count || 0}</p>
                </div>
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground">Rejeições</h4>
                  <p className="text-lg font-bold text-red-600">{dataToShow.rejections_count || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Anexos */}
          {dataToShow.attachments && dataToShow.attachments.length > 0 && (
            <Card>
              <CardContent className="pt-6">
                <h4 className="font-medium text-sm text-muted-foreground mb-3">Anexos</h4>
                <div className="grid grid-cols-2 gap-2">
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
            <CardContent className="pt-6">
              <h4 className="font-medium text-sm text-muted-foreground">Data da Solicitação</h4>
              <p className="font-medium">{formatDate(dataToShow.created_at)}</p>
            </CardContent>
          </Card>

          {/* Ações de Aprovação - Apenas se status for pending E não for readOnly */}
          {dataToShow.status === 'pending' && !readOnly && (
            <Card className="bg-slate-50 dark:bg-slate-900">
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="observations" className="text-base font-semibold">
                      Observações (obrigatório)
                    </Label>
                    <p className="text-sm text-muted-foreground mb-2">
                      Deixe sua observação para o próximo aprovador ou para o solicitante
                    </p>
                    <Textarea
                      id="observations"
                      placeholder="Digite suas observações sobre esta solicitação..."
                      value={observations}
                      onChange={(e) => setObservations(e.target.value)}
                      rows={4}
                      className="resize-none"
                    />
                  </div>

                  <Separator />

                  <div className="flex gap-3">
                    <Button
                      onClick={handleApprove}
                      disabled={loading || !observations.trim()}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      size="lg"
                    >
                      <Check className="h-5 w-5 mr-2" />
                      Aprovar
                    </Button>
                    <Button
                      onClick={handleReject}
                      disabled={loading || !observations.trim()}
                      variant="destructive"
                      className="flex-1"
                      size="lg"
                    >
                      <X className="h-5 w-5 mr-2" />
                      Rejeitar
                    </Button>
                  </div>
                  
                  {!observations.trim() && (
                    <p className="text-sm text-amber-600 text-center">
                      Por favor, adicione uma observação antes de aprovar ou rejeitar
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
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