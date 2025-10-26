import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Download } from "lucide-react";
import { ImageViewerModal } from "@/components/ImageViewerModal";
import { useState } from "react";

interface SuggestionDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  suggestion: {
    id: string;
    stations?: { name: string };
    clients?: { name: string };
    payment_methods?: { name: string };
    product: string;
    final_price: number;
    margin_cents: number;
    cost_price: number;
    status: string;
    created_at: string;
    observations?: string;
    attachments?: string[];
  } | null;
}

export const SuggestionDetailsModal = ({ isOpen, onClose, suggestion }: SuggestionDetailsModalProps) => {
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string>("");

  const moneyBR = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const toReais = (v: number | null | undefined) => {
    const n = Number(v ?? 0);
    return n >= 20 ? n / 100 : n;
  };

  if (!suggestion) return null;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary" className="bg-accent/10 text-accent">Em Análise</Badge>;
      case "approved":
        return <Badge variant="secondary" className="bg-success/10 text-success">Aprovado</Badge>;
      case "rejected":
        return <Badge variant="secondary" className="bg-destructive/10 text-destructive">Negado</Badge>;
      default:
        return null;
    }
  };

  const viewAttachment = (url: string) => {
    window.open(url, '_blank');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Detalhes da Sugestão</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium text-sm text-muted-foreground">Cliente</h4>
              <p className="font-medium">{suggestion.clients?.name || 'N/A'}</p>
            </div>
            <div>
              <h4 className="font-medium text-sm text-muted-foreground">Posto</h4>
              <p className="font-medium">{suggestion.stations?.name || 'N/A'}</p>
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

          {/* Price Info */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <h4 className="font-medium text-sm text-muted-foreground">Preço de Custo</h4>
              <p className="text-lg font-bold">{moneyBR(toReais(suggestion.cost_price))}</p>
            </div>
            <div>
              {(() => {
                const fp = toReais(suggestion.final_price);
                const cp = toReais(suggestion.cost_price);
                const m = fp - cp;
                return (
                  <>
                    <h4 className="font-medium text-sm text-muted-foreground">
                      {m > 0 ? 'Aumento' : m < 0 ? 'Diminuição' : 'Margem'}
                    </h4>
                    <p className={`text-lg font-bold ${m > 0 ? 'text-green-600' : m < 0 ? 'text-red-600' : 'text-slate-600'}`}>
                      {moneyBR(Math.abs(m))}
                    </p>
                  </>
                );
              })()}
            </div>
            <div>
              <h4 className="font-medium text-sm text-muted-foreground">Preço Final</h4>
              <p className="text-lg font-bold text-primary">{moneyBR(toReais(suggestion.final_price))}</p>
            </div>
          </div>

          {/* Payment Method */}
          {suggestion.payment_methods && (
            <div>
              <h4 className="font-medium text-sm text-muted-foreground">Forma de Pagamento</h4>
              <p className="font-medium">{suggestion.payment_methods.name}</p>
            </div>
          )}

          {/* Observations */}
          {suggestion.observations && (
            <div>
              <h4 className="font-medium text-sm text-muted-foreground">Observações</h4>
              <p className="text-sm">{suggestion.observations}</p>
            </div>
          )}

          {/* Date */}
          <div>
            <h4 className="font-medium text-sm text-muted-foreground">Data da Solicitação</h4>
            <p className="font-medium">{new Date(suggestion.created_at).toLocaleDateString('pt-BR')}</p>
          </div>

          {/* Attachments */}
          {suggestion.attachments && suggestion.attachments.length > 0 && (
            <div>
              <h4 className="font-medium text-sm text-muted-foreground mb-3">Anexos</h4>
              <div className="grid grid-cols-2 gap-2">
                {suggestion.attachments.map((url, index) => {
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
                              onClick={() => viewAttachment(url)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Ver
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
            </div>
          )}
        </div>
      </DialogContent>

      {/* Image Viewer Modal */}
      <ImageViewerModal
        isOpen={imageViewerOpen}
        onClose={() => setImageViewerOpen(false)}
        imageUrl={selectedImage}
        imageName="Anexo da Sugestão"
      />
    </Dialog>
  );
};