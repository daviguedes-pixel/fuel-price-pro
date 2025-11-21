import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SisEmpresaCombobox } from "@/components/SisEmpresaCombobox";
import { ClientCombobox } from "@/components/ClientCombobox";
import { FileUploader } from "@/components/FileUploader";
import { parseBrazilianDecimal, formatBrazilianCurrency, parsePriceToInteger } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Save, X } from "lucide-react";
import { useDatabase } from "@/hooks/useDatabase";

interface EditRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: any;
  onSuccess: () => void;
}

export const EditRequestModal = ({ 
  isOpen, 
  onClose, 
  request,
  onSuccess 
}: EditRequestModalProps) => {
  const { getPaymentMethodsForStation } = useDatabase();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [stationPaymentMethods, setStationPaymentMethods] = useState<any[]>([]);
  const [hasApprovalHistory, setHasApprovalHistory] = useState(false);
  const [checkingHistory, setCheckingHistory] = useState(false);
  
  // Form data
  const [formData, setFormData] = useState({
    station_id: '',
    client_id: '',
    product: '',
    payment_method_id: '',
    cost_price: '',
    margin_cents: '',
    final_price: '',
    arla_purchase_price: '',
    observations: '',
    attachments: [] as string[]
  });

  // Verificar histórico de aprovações
  const checkApprovalHistory = async (suggestionId: string) => {
    setCheckingHistory(true);
    try {
      const { data, error } = await supabase
        .from('approval_history')
        .select('id, action')
        .eq('suggestion_id', suggestionId);

      if (error) {
        console.error('Erro ao verificar histórico de aprovações:', error);
        return false;
      }

      // Verificar se há ações que realmente impedem edição (aprovado/rejeitado final)
      // Permitir edição se status for draft ou pending, mesmo com histórico
      const hasBlockingAction = (data || []).some((item: any) => 
        item.action === 'approved' || item.action === 'rejected'
      );
      
      setHasApprovalHistory(hasBlockingAction);
      return hasBlockingAction;
    } catch (error) {
      console.error('Erro ao verificar histórico:', error);
      return false;
    } finally {
      setCheckingHistory(false);
    }
  };

  // Carregar dados do request quando o modal abrir
  useEffect(() => {
    if (request && isOpen) {
      // Verificar histórico de aprovações primeiro
      if (request.id) {
        checkApprovalHistory(request.id);
      }

      // Converter preços de centavos para reais se necessário
      const costPrice = request.cost_price || 0;
      const finalPrice = request.final_price || 0;
      const marginCents = request.margin_cents || 0;
      const arlaPurchasePrice = request.arla_purchase_price || 0;
      
      const costPriceReais = costPrice >= 100 ? costPrice / 100 : costPrice;
      const finalPriceReais = finalPrice >= 100 ? finalPrice / 100 : finalPrice;
      const marginReais = marginCents >= 100 ? marginCents / 100 : marginCents / 100;
      const arlaPurchaseReais = arlaPurchasePrice >= 100 ? arlaPurchasePrice / 100 : arlaPurchasePrice;

      // Buscar cliente - verificar tanto client_id quanto clients.id
      // IMPORTANTE: O useDatabase mapeia clients com id: client.id_cliente (string)
      let clientId = '';
      
      // Prioridade 1: client_id direto (já deve ser string ou id_cliente)
      if (request.client_id) {
        clientId = String(request.client_id);
      }
      // Prioridade 2: clients.id (já mapeado pelo useDatabase)
      else if (request.clients?.id) {
        clientId = String(request.clients.id);
      }
      // Prioridade 3: clients.id_cliente (se vier direto do banco)
      else if (request.clients?.id_cliente) {
        clientId = String(request.clients.id_cliente);
      }
      // Prioridade 4: clients.code (pode ser o id_cliente como código)
      else if (request.clients?.code) {
        clientId = String(request.clients.code);
      }
      
      // Buscar cliente diretamente do banco se necessário e garantir que está na lista
      const loadClientFromDB = async () => {
        if (clientId) {
          try {
            // Tentar buscar o cliente do banco
            const { data: clientData, error: clientError } = await supabase
              .from('clientes' as any)
              .select('id_cliente, nome')
              .eq('id_cliente', clientId)
              .maybeSingle();
            
            if (clientData && !clientError) {
              console.log('✅ Cliente encontrado no banco:', clientData);
              // O ClientCombobox vai encontrar pelo ID quando a lista de clients carregar
              // Forçar atualização do formData para garantir que o ID está correto
              setFormData(prev => ({ 
                ...prev, 
                client_id: String(clientData.id_cliente) 
              }));
            } else {
              console.warn('⚠️ Cliente não encontrado no banco com ID:', clientId, clientError);
            }
          } catch (error) {
            console.error('❌ Erro ao buscar cliente:', error);
          }
        } else {
          console.warn('⚠️ clientId está vazio, não é possível buscar cliente');
        }
      };
      
      // Log para debug
      console.log('🔍 Carregando dados do request para edição:', {
        requestId: request.id,
        client_id: request.client_id,
        clients: request.clients,
        clientIdFinal: clientId,
        requestFull: request
      });
      
      // Primeiro definir o formData com o clientId encontrado
      setFormData({
        station_id: request.station_id || '',
        client_id: clientId,
        product: request.product || '',
        payment_method_id: request.payment_method_id || '',
        cost_price: costPriceReais > 0 ? costPriceReais.toFixed(4) : '',
        margin_cents: marginReais > 0 ? marginReais.toFixed(2) : '',
        final_price: finalPriceReais > 0 ? finalPriceReais.toFixed(4) : '',
        arla_purchase_price: arlaPurchaseReais > 0 ? arlaPurchaseReais.toFixed(2) : '',
        observations: request.observations ? String(request.observations) : '',
        attachments: request.attachments || []
      });

      // Buscar cliente do banco se necessário (executar após um pequeno delay para garantir que formData foi atualizado)
      setTimeout(() => {
        loadClientFromDB();
      }, 100);

      // Carregar métodos de pagamento do posto e fazer correspondência do payment_method_id
      if (request.station_id) {
        loadPaymentMethods(request.station_id, request.payment_method_id);
      }
    }
  }, [request, isOpen]);

  const loadPaymentMethods = async (stationId: string, currentPaymentMethodId?: string) => {
    try {
      const methods = await getPaymentMethodsForStation(stationId);
      setStationPaymentMethods(methods || []);
      
      // Se temos um payment_method_id para corresponder, tentar encontrar o método correto
      const paymentMethodIdToMatch = currentPaymentMethodId || formData.payment_method_id;
      
      if (paymentMethodIdToMatch && methods && methods.length > 0) {
        // Tentar encontrar o método correspondente
        const matchedMethod = methods.find((method: any) => {
          const savedId = String(paymentMethodIdToMatch);
          const methodIdPosto = method.ID_POSTO ? String(method.ID_POSTO) : '';
          const methodCard = method.CARTAO || '';
          
          // Tentar várias formas de correspondência
          return savedId === methodIdPosto ||
                 savedId === methodCard ||
                 savedId === String(method.id) ||
                 savedId.includes('_') && savedId.startsWith(methodIdPosto + '_') && savedId.endsWith('_' + methodCard);
        });
        
        if (matchedMethod) {
          // Atualizar o payment_method_id para o formato correto (ID_POSTO_CARTAO)
          const methodIdPosto = matchedMethod.ID_POSTO ? String(matchedMethod.ID_POSTO) : '';
          const methodCard = matchedMethod.CARTAO || '';
          const correctMethodId = methodIdPosto && methodCard ? `${methodIdPosto}_${methodCard}` : methodIdPosto || methodCard;
          
          setFormData(prev => ({ ...prev, payment_method_id: String(correctMethodId) }));
        }
      }
    } catch (error) {
      console.error('Erro ao carregar métodos de pagamento:', error);
    }
  };

  const handleStationChange = async (stationId: string) => {
    setFormData(prev => ({ ...prev, station_id: stationId, payment_method_id: '' }));
    if (stationId) {
      await loadPaymentMethods(stationId);
    } else {
      setStationPaymentMethods([]);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Recalcular preço final quando custo ou margem mudarem
    if (field === 'cost_price' || field === 'margin_cents') {
      const costPrice = parseBrazilianDecimal(formData.cost_price || '0');
      const margin = parseBrazilianDecimal(value || '0');
      
      if (field === 'cost_price') {
        const newCostPrice = parseBrazilianDecimal(value || '0');
        const currentMargin = parseBrazilianDecimal(formData.margin_cents || '0');
        const newFinalPrice = newCostPrice + (newCostPrice * currentMargin / 100);
        setFormData(prev => ({ 
          ...prev, 
          cost_price: value,
          final_price: newFinalPrice > 0 ? newFinalPrice.toFixed(4) : ''
        }));
      } else if (field === 'margin_cents') {
        const currentCost = parseBrazilianDecimal(formData.cost_price || '0');
        const newMargin = parseBrazilianDecimal(value || '0');
        const newFinalPrice = currentCost + (currentCost * newMargin / 100);
        setFormData(prev => ({ 
          ...prev, 
          margin_cents: value,
          final_price: newFinalPrice > 0 ? newFinalPrice.toFixed(4) : ''
        }));
      }
    }
  };

  const handleSave = async () => {
    // Validações
    if (!formData.station_id) {
      toast.error("Selecione um posto");
      return;
    }
    
    if (!formData.client_id) {
      toast.error("Selecione um cliente");
      return;
    }
    
    if (!formData.product) {
      toast.error("Selecione um produto");
      return;
    }
    
    if (!formData.payment_method_id) {
      toast.error("Selecione um método de pagamento");
      return;
    }
    
    const costPrice = parseBrazilianDecimal(formData.cost_price || '0');
    if (costPrice <= 0) {
      toast.error("Preço de custo deve ser maior que zero");
      return;
    }

    const margin = parseBrazilianDecimal(formData.margin_cents || '0');
    const finalPrice = parseBrazilianDecimal(formData.final_price || '0');
    
    // Converter para centavos
    const costPriceCents = Math.round(costPrice * 100);
    const marginCents = Math.round(margin * 100);
    const finalPriceCents = Math.round(finalPrice * 100);
    
    // Converter ARLA purchase price para centavos (se existir)
    const arlaPurchasePriceCents = formData.arla_purchase_price 
      ? parsePriceToInteger(formData.arla_purchase_price) 
      : null;

    setSaving(true);
    try {
      // Extrair o ID correto do payment_method_id (pode ser formato composto ID_POSTO_CARTAO)
      let paymentMethodIdToSave = formData.payment_method_id;
      
      // Se for formato composto (ID_POSTO_CARTAO), tentar encontrar o método e usar ID_POSTO
      if (paymentMethodIdToSave && paymentMethodIdToSave.includes('_')) {
        const [idPosto, cardName] = paymentMethodIdToSave.split('_');
        const matchedMethod = stationPaymentMethods.find((method: any) => 
          String(method.ID_POSTO) === idPosto && method.CARTAO === cardName
        );
        
        if (matchedMethod) {
          // Usar ID_POSTO como valor principal, ou o ID original se disponível
          paymentMethodIdToSave = matchedMethod.ID_POSTO ? String(matchedMethod.ID_POSTO) : paymentMethodIdToSave;
        }
      }
      
      const updateData: any = {
        station_id: formData.station_id,
        client_id: formData.client_id,
        product: formData.product,
        payment_method_id: paymentMethodIdToSave,
        cost_price: costPriceCents,
        margin_cents: marginCents,
        final_price: finalPriceCents,
        observations: formData.observations != null && formData.observations.trim() !== '' ? formData.observations.trim() : '',
        attachments: formData.attachments.length > 0 ? formData.attachments : null,
        updated_at: new Date().toISOString()
      };
      
      // Adicionar ARLA purchase price se existir
      if (arlaPurchasePriceCents !== null) {
        updateData.arla_purchase_price = arlaPurchasePriceCents;
      }
      
      // Log para debug
      console.log('💾 Salvando observações:', {
        observations: formData.observations,
        observationsTrimmed: formData.observations ? formData.observations.trim() : null,
        updateData: updateData
      });
      
      // Log completo antes de salvar
      console.log('💾 Dados completos para salvar:', {
        requestId: request.id,
        updateData: updateData,
        observationsValue: updateData.observations,
        observationsType: typeof updateData.observations
      });
      
      const { error, data } = await supabase
        .from('price_suggestions')
        .update(updateData)
        .eq('id', request.id)
        .select('observations');

      if (error) {
        console.error('❌ Erro ao atualizar solicitação:', error);
        console.error('❌ Detalhes do erro:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        toast.error("Erro ao salvar alterações: " + (error.message || 'Erro desconhecido'));
        return;
      }
      
      // Log de sucesso com dados retornados
      console.log('✅ Observações salvas com sucesso!', {
        updateDataObservations: updateData.observations,
        returnedData: data,
        savedObservations: data?.[0]?.observations
      });

      toast.success("Solicitação atualizada com sucesso!");
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      toast.error("Erro ao salvar: " + (error?.message || 'Erro desconhecido'));
    } finally {
      setSaving(false);
    }
  };

  const getProductName = (product: string) => {
    const names: { [key: string]: string } = {
      'gasolina_comum': 'Gasolina Comum',
      'gasolina_aditivada': 'Gasolina Aditivada',
      'etanol': 'Etanol',
      's10': 'Diesel S-10',
      's500': 'Diesel S-500'
    };
    return names[product] || product;
  };

  // Verificar se pode editar (apenas draft ou pending, independentemente do histórico)
  // O histórico só bloqueia se houver aprovação/rejeição final
  const canEdit = (request?.status === 'draft' || request?.status === 'pending') && !hasApprovalHistory;

  if (checkingHistory) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verificando...</DialogTitle>
          </DialogHeader>
          <div className="py-4 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-slate-600" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!canEdit) {
    const reason = hasApprovalHistory 
      ? 'Esta solicitação não pode ser editada porque já possui aprovações ou rejeições no histórico.'
      : request?.status === 'approved' 
      ? 'Esta solicitação não pode ser editada porque já foi aprovada.'
      : request?.status === 'rejected'
      ? 'Esta solicitação não pode ser editada porque já foi rejeitada.'
      : 'Esta solicitação não pode ser editada.';

    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edição não permitida</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-slate-600 dark:text-slate-400">
              {reason}
            </p>
          </div>
          <DialogFooter>
            <Button onClick={onClose}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Solicitação</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Posto */}
          <div className="space-y-2">
            <Label>Posto *</Label>
            <SisEmpresaCombobox
              value={formData.station_id}
              onSelect={(stationId) => handleStationChange(stationId)}
            />
          </div>

          {/* Cliente */}
          <div className="space-y-2">
            <Label>Cliente *</Label>
            <ClientCombobox
              value={formData.client_id}
              onSelect={(clientId, clientName) => {
                console.log('✅ Cliente selecionado:', { clientId, clientName });
                setFormData(prev => ({ ...prev, client_id: clientId }));
              }}
            />
          </div>

          {/* Produto */}
          <div className="space-y-2">
            <Label>Produto *</Label>
            <Select
              value={formData.product}
              onValueChange={(value) => setFormData(prev => ({ ...prev, product: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o produto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gasolina_comum">Gasolina Comum</SelectItem>
                <SelectItem value="gasolina_aditivada">Gasolina Aditivada</SelectItem>
                <SelectItem value="etanol">Etanol</SelectItem>
                <SelectItem value="s10">Diesel S-10</SelectItem>
                <SelectItem value="s500">Diesel S-500</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Método de Pagamento */}
          <div className="space-y-2">
            <Label>Método de Pagamento *</Label>
            <Select
              value={formData.payment_method_id}
              onValueChange={(value) => setFormData(prev => ({ ...prev, payment_method_id: value }))}
              disabled={!formData.station_id || stationPaymentMethods.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder={
                  !formData.station_id 
                    ? "Selecione um posto primeiro" 
                    : stationPaymentMethods.length === 0 
                    ? "Nenhum método disponível"
                    : "Selecione o método de pagamento"
                } />
              </SelectTrigger>
              <SelectContent>
                {stationPaymentMethods.map((method: any, index: number) => {
                  // Criar ID único combinando ID_POSTO e CARTAO para garantir unicidade
                  // Se não tiver ID_POSTO, usar CARTAO ou criar um índice único
                  const methodId = method.ID_POSTO && method.CARTAO
                    ? `${method.ID_POSTO}_${method.CARTAO}`
                    : method.ID_POSTO
                    ? String(method.ID_POSTO)
                    : method.CARTAO
                    ? method.CARTAO
                    : `method_${index}`;
                  
                  const methodName = method.CARTAO || method.name || 'Método de Pagamento';
                  const taxa = method.TAXA ? ` (${method.TAXA}%)` : '';
                  
                  // Usar índice no key para garantir unicidade do React
                  return (
                    <SelectItem key={`payment-${index}-${methodId}`} value={String(methodId)}>
                      {methodName}{taxa}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Preço de Custo e Margem */}
          {/* Para S10 e ARLA: desabilitar edição de custo e margem, permitir apenas preço final */}
          {(() => {
            const isS10OrARLA = formData.product === 's10' || formData.product?.toLowerCase().includes('arla');
            
            return (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Preço de Custo (R$/L) *</Label>
                    <Input
                      type="text"
                      value={formData.cost_price}
                      onChange={(e) => handleInputChange('cost_price', e.target.value)}
                      placeholder="0,0000"
                      disabled={isS10OrARLA}
                      className={isS10OrARLA ? "bg-slate-100 dark:bg-slate-800 cursor-not-allowed" : ""}
                    />
                    {isS10OrARLA && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Não editável para Diesel S-10/ARLA
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Margem (%) *</Label>
                    <Input
                      type="text"
                      value={formData.margin_cents}
                      onChange={(e) => handleInputChange('margin_cents', e.target.value)}
                      placeholder="0,00"
                      disabled={isS10OrARLA}
                      className={isS10OrARLA ? "bg-slate-100 dark:bg-slate-800 cursor-not-allowed" : ""}
                    />
                    {isS10OrARLA && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Não editável para Diesel S-10/ARLA
                      </p>
                    )}
                  </div>
                </div>

                {/* Preço Final */}
                <div className="space-y-2">
                  <Label>Preço Final (R$/L) *</Label>
                  <Input
                    type="text"
                    value={formData.final_price}
                    onChange={(e) => {
                      const newFinalPrice = e.target.value;
                      setFormData(prev => ({ ...prev, final_price: newFinalPrice }));
                      
                      // Se for S10/ARLA, recalcular margem automaticamente quando preço final mudar
                      if (isS10OrARLA) {
                        const costPrice = parseBrazilianDecimal(formData.cost_price || '0');
                        const finalPrice = parseBrazilianDecimal(newFinalPrice || '0');
                        
                        if (costPrice > 0 && finalPrice > 0) {
                          const newMargin = ((finalPrice - costPrice) / costPrice) * 100;
                          setFormData(prev => ({ 
                            ...prev, 
                            final_price: newFinalPrice,
                            margin_cents: newMargin > 0 ? newMargin.toFixed(2) : '0,00'
                          }));
                        }
                      }
                    }}
                    placeholder="0,0000"
                    className="font-semibold text-green-600"
                  />
                  {isS10OrARLA && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Edite apenas o preço final. A margem será recalculada automaticamente.
                    </p>
                  )}
                </div>

                {/* Preço de Venda ARLA - apenas para S10 */}
                {formData.product === 's10' && (
                  <div className="space-y-2">
                    <div className="bg-slate-50 dark:bg-slate-900/20 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                      <Label htmlFor="arla_purchase_price" className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 block">
                        Preço de Venda ARLA (R$/L)
                      </Label>
                      <Input
                        id="arla_purchase_price"
                        type="text"
                        inputMode="numeric"
                        placeholder="0,00"
                        value={formData.arla_purchase_price}
                        onChange={(e) => setFormData(prev => ({ ...prev, arla_purchase_price: e.target.value }))}
                        onWheel={(e) => e.currentTarget.blur()}
                        className="h-9 bg-white dark:bg-slate-800"
                        translate="no"
                      />
                    </div>
                  </div>
                )}
              </>
            );
          })()}

          {/* Observações */}
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              value={formData.observations || ''}
              onChange={(e) => {
                const newValue = e.target.value;
                console.log('📝 Observações alteradas:', newValue);
                setFormData(prev => {
                  const updated = { ...prev, observations: newValue };
                  console.log('📝 FormData atualizado:', updated.observations);
                  return updated;
                });
              }}
              placeholder="Adicione observações sobre esta solicitação..."
              rows={4}
            />
          </div>

          {/* Anexos */}
          <div className="space-y-2">
            <Label>Anexos</Label>
            <FileUploader
              currentFiles={formData.attachments}
              onFilesUploaded={(attachments) => setFormData(prev => ({ ...prev, attachments }))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            <X className="h-4 w-4 mr-2" />
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Salvar Alterações
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

