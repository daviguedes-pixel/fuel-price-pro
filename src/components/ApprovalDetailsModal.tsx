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
}

export const ApprovalDetailsModal = ({ 
  isOpen, 
  onClose, 
  suggestion, 
  onApprove, 
  onReject,
  loading 
}: ApprovalDetailsModalProps) => {
  const [observations, setObservations] = useState("");
  const [approvalHistory, setApprovalHistory] = useState<ApprovalHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string>("");

  useEffect(() => {
    if (suggestion?.id && isOpen) {
      loadApprovalHistory();
    }
  }, [suggestion?.id, isOpen]);

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

  if (!suggestion) return null;

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

  const formatPrice = (price: number | null) => {
    if (!price) return 'R$ 0,00';
    return price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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
                  <h4 className="font-medium text-sm text-muted-foreground">Cliente</h4>
                  <p className="font-medium text-lg">{suggestion.clients?.name || 'N/A'}</p>
                </div>
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground">Posto</h4>
                  <p className="font-medium text-lg">{suggestion.stations?.name || 'N/A'}</p>
                </div>
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground">Produto</h4>
                  <p className="font-medium">{suggestion.product}</p>
                </div>
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground">Status</h4>
                  {getStatusBadge(suggestion.status)}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Informações de Preço e Margem */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold mb-4">Análise de Preço</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground">Custo de Compra</h4>
                  <p className="text-xl font-bold">{formatPrice(suggestion.purchase_cost)}</p>
                </div>
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground">Frete</h4>
                  <p className="text-xl font-bold">{formatPrice(suggestion.freight_cost)}</p>
                </div>
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground">Custo Total</h4>
                  <p className="text-xl font-bold">{formatPrice(fromMaybeCents(suggestion.cost_price))}</p>
                </div>
                <div>
                  {(() => {
                    const fp = fromMaybeCents(suggestion.final_price);
                    const cp = fromMaybeCents(suggestion.cost_price);
                    const m = fp - cp;
                    return (
                      <>
                        <h4 className="font-medium text-sm text-muted-foreground">
                          {m > 0 ? 'Aumento' : m < 0 ? 'Diminuição' : 'Margem'}
                        </h4>
                        <p className={`text-xl font-bold ${m > 0 ? 'text-green-600' : m < 0 ? 'text-red-600' : 'text-blue-600'}`}> 
                          {formatPrice(Math.abs(m))}
                        </p>
                      </>
                    );
                  })()}
                </div>
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground">Preço Sugerido</h4>
                  <p className="text-xl font-bold text-green-600">{formatPrice(fromMaybeCents(suggestion.final_price))}</p>
                </div>
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground">Margem %</h4>
                  <p className="text-xl font-bold">
                    {(() => {
                      const fp = fromMaybeCents(suggestion.final_price);
                      const cp = fromMaybeCents(suggestion.cost_price);
                      return cp > 0 ? (((fp - cp) / cp) * 100).toFixed(2) + '%' : '0%';
                    })()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Volume e Cálculos S10 */}
          {suggestion.product === 's10' && (
            <>
              <Card>
                <CardContent className="pt-6">
                  <h3 className="text-lg font-semibold mb-4">Análise S10 + ARLA</h3>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium text-sm text-muted-foreground">Volume Realizado (L)</h4>
                        <p className="text-lg font-bold">{suggestion.volume_made ? suggestion.volume_made.toLocaleString('pt-BR') : '0'}</p>
                      </div>
                      <div>
                        <h4 className="font-medium text-sm text-muted-foreground">Volume Projetado (L)</h4>
                        <p className="text-lg font-bold">{suggestion.volume_projected ? suggestion.volume_projected.toLocaleString('pt-BR') : '0'}</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium text-sm text-muted-foreground">Preço de Venda ARLA</h4>
                        <p className="text-lg font-bold">{formatPrice(suggestion.arla_purchase_price || 0)}</p>
                      </div>
                      <div>
                        <h4 className="font-medium text-sm text-muted-foreground">Custo de Compra ARLA</h4>
                        <p className="text-lg font-bold">{formatPrice(suggestion.arla_cost_price || 0)}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Cálculos Derivados de ARLA */}
              <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
                <CardContent className="pt-6">
                  <h3 className="text-lg font-semibold mb-4">Cálculos de Compensação ARLA</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <h4 className="font-medium text-sm text-muted-foreground">Margem ARLA (por litro)</h4>
                      <p className="text-xl font-bold text-green-600">
                        {formatPrice((suggestion.arla_purchase_price || 0) - (suggestion.arla_cost_price || 0))}
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium text-sm text-muted-foreground">Consumo ARLA Estimado (5%)</h4>
                      <p className="text-xl font-bold">
                        {suggestion.volume_projected 
                          ? (suggestion.volume_projected * 0.05).toLocaleString('pt-BR', { maximumFractionDigits: 0 }) + ' L'
                          : '0 L'}
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium text-sm text-muted-foreground">Compensação Total ARLA</h4>
                      <p className="text-xl font-bold text-blue-600">
                        {(() => {
                          const margemArla = (suggestion.arla_purchase_price || 0) - (suggestion.arla_cost_price || 0);
                          const consumoArla = suggestion.volume_projected ? suggestion.volume_projected * 0.05 : 0;
                          return formatPrice(margemArla * consumoArla);
                        })()}
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium text-sm text-muted-foreground">Compensação por Litro S10</h4>
                      <p className="text-xl font-bold text-indigo-600">
                        {(() => {
                          const margemArla = (suggestion.arla_purchase_price || 0) - (suggestion.arla_cost_price || 0);
                          const consumoArla = suggestion.volume_projected ? suggestion.volume_projected * 0.05 : 0;
                          const compensacaoTotal = margemArla * consumoArla;
                          return suggestion.volume_projected > 0 
                            ? formatPrice(compensacaoTotal / suggestion.volume_projected)
                            : formatPrice(0);
                        })()}
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium text-sm text-muted-foreground">Margem Efetiva S10</h4>
                      <p className="text-xl font-bold text-purple-600">
                        {(() => {
                          const fp = fromMaybeCents(suggestion.final_price);
                          const cp = fromMaybeCents(suggestion.cost_price);
                          const margemS10 = fp - cp;
                          const margemArla = (suggestion.arla_purchase_price || 0) - (suggestion.arla_cost_price || 0);
                          const consumoArla = suggestion.volume_projected ? suggestion.volume_projected * 0.05 : 0;
                          const compensacaoTotal = margemArla * consumoArla;
                          const compensacaoPorLitro = suggestion.volume_projected > 0 ? compensacaoTotal / suggestion.volume_projected : 0;
                          return formatPrice(margemS10 + compensacaoPorLitro);
                        })()}
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium text-sm text-muted-foreground">Margem Efetiva %</h4>
                      <p className="text-xl font-bold text-purple-600">
                        {(() => {
                          const fp = fromMaybeCents(suggestion.final_price);
                          const cp = fromMaybeCents(suggestion.cost_price);
                          const custoTotal = cp;
                          const margemS10 = fp - cp;
                          const margemArla = (suggestion.arla_purchase_price || 0) - (suggestion.arla_cost_price || 0);
                          const consumoArla = suggestion.volume_projected ? suggestion.volume_projected * 0.05 : 0;
                          const compensacaoTotal = margemArla * consumoArla;
                          const compensacaoPorLitro = suggestion.volume_projected > 0 ? compensacaoTotal / suggestion.volume_projected : 0;
                          const margemEfetiva = margemS10 + compensacaoPorLitro;
                          return custoTotal > 0 ? ((margemEfetiva / custoTotal) * 100).toFixed(2) + '%' : '0%';
                        })()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* Origem do Preço */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold mb-4">Origem do Preço de Custo</h3>
              {suggestion.price_origin_base ? (
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <h4 className="font-medium text-sm text-muted-foreground">Base</h4>
                    <p className="font-medium">{suggestion.price_origin_base}</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-sm text-muted-foreground">Código</h4>
                    <p className="font-medium">{suggestion.price_origin_code || 'N/A'}</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-sm text-muted-foreground">UF</h4>
                    <p className="font-medium">{suggestion.price_origin_uf || 'N/A'}</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-sm text-muted-foreground">Tipo de Entrega</h4>
                    <p className="font-medium">{suggestion.price_origin_delivery || 'N/A'}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Informação não disponível</p>
              )}
            </CardContent>
          </Card>

          {/* Forma de Pagamento */}
          {suggestion.payment_methods && (
            <Card>
              <CardContent className="pt-6">
                <h4 className="font-medium text-sm text-muted-foreground">Forma de Pagamento</h4>
                <p className="font-medium text-lg">{suggestion.payment_methods.name}</p>
              </CardContent>
            </Card>
          )}

          {/* Observações do Solicitante */}
          {suggestion.observations && (
            <Card>
              <CardContent className="pt-6">
                <h4 className="font-medium text-sm text-muted-foreground mb-2">Observações do Solicitante</h4>
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 max-h-32 overflow-y-auto">
                  <p className="text-sm whitespace-pre-wrap break-words">{suggestion.observations}</p>
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
                  <p className="text-lg font-bold">{suggestion.approval_level || 1} de {suggestion.total_approvers || 3}</p>
                </div>
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground">Aprovações</h4>
                  <p className="text-lg font-bold text-green-600">{suggestion.approvals_count || 0}</p>
                </div>
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground">Rejeições</h4>
                  <p className="text-lg font-bold text-red-600">{suggestion.rejections_count || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Anexos */}
          {suggestion.attachments && suggestion.attachments.length > 0 && (
            <Card>
              <CardContent className="pt-6">
                <h4 className="font-medium text-sm text-muted-foreground mb-3">Anexos</h4>
                <div className="grid grid-cols-2 gap-2">
                  {suggestion.attachments.map((url: string, index: number) => {
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
              <p className="font-medium">{formatDate(suggestion.created_at)}</p>
            </CardContent>
          </Card>

          {/* Ações de Aprovação - Apenas se status for pending */}
          {suggestion.status === 'pending' && (
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