import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Download, ZoomIn, ZoomOut } from "lucide-react";
import { useState } from "react";

interface ImageViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  imageName?: string;
}

export const ImageViewerModal = ({ 
  isOpen, 
  onClose, 
  imageUrl,
  imageName = "Imagem" 
}: ImageViewerModalProps) => {
  const [zoom, setZoom] = useState(100);

  // Detectar se é PDF
  const isPdf = imageUrl.toLowerCase().endsWith('.pdf') || imageUrl.toLowerCase().includes('.pdf') || imageName.toLowerCase().endsWith('.pdf');

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = imageName;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 25, 200));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 25, 50));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full p-0 bg-black/95">
        {/* Header Controls */}
        <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent">
          <div className="text-white font-medium truncate max-w-md">
            {imageName}
          </div>
          <div className="flex items-center gap-2">
            {!isPdf && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleZoomOut}
                  className="text-white hover:bg-white/20"
                  disabled={zoom <= 50}
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-white text-sm min-w-[4rem] text-center">
                  {zoom}%
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleZoomIn}
                  className="text-white hover:bg-white/20"
                  disabled={zoom >= 200}
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownload}
              className="text-white hover:bg-white/20"
            >
              <Download className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-white hover:bg-white/20"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content Container */}
        <div className="w-full h-full flex items-center justify-center p-4 overflow-auto bg-white">
          {isPdf ? (
            <iframe
              src={imageUrl}
              className="w-full h-full border-0"
              title={imageName}
              style={{ minHeight: '100%' }}
            />
          ) : (
            <img
              src={imageUrl}
              alt={imageName}
              className="max-w-full max-h-full object-contain transition-all duration-200"
              style={{ transform: `scale(${zoom / 100})` }}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
