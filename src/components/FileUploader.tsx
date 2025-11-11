import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, X, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ImageViewerModal } from "@/components/ImageViewerModal";

interface FileUploaderProps {
  onFilesUploaded: (urls: string[]) => void;
  maxFiles?: number;
  acceptedTypes?: string;
  currentFiles?: string[];
}

export const FileUploader = ({ 
  onFilesUploaded, 
  maxFiles = 5, 
  acceptedTypes = "image/*,.pdf",
  currentFiles = []
}: FileUploaderProps) => {
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>(currentFiles);
  const [viewingFile, setViewingFile] = useState<{ url: string; name: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Sincronizar uploadedFiles com currentFiles quando mudar
  useEffect(() => {
    setUploadedFiles(currentFiles);
  }, [currentFiles]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    if (uploadedFiles.length + files.length > maxFiles) {
      toast({
        title: "Limite excedido",
        description: `Máximo de ${maxFiles} arquivos permitidos.`,
        variant: "destructive"
      });
      return;
    }

    setUploading(true);
    const newFileUrls: string[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `uploads/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('attachments')
          .upload(filePath, file);

        if (uploadError) {
          throw uploadError;
        }

        const { data: publicUrl } = supabase.storage
          .from('attachments')
          .getPublicUrl(filePath);

        newFileUrls.push(publicUrl.publicUrl);
      }

      const allFiles = [...uploadedFiles, ...newFileUrls];
      setUploadedFiles(allFiles);
      onFilesUploaded(allFiles);

      toast({
        title: "Upload concluído",
        description: `${files.length} arquivo(s) enviado(s) com sucesso.`
      });
    } catch (error) {
      console.error('Error uploading files:', error);
      toast({
        title: "Erro no upload",
        description: "Erro ao enviar arquivos. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const removeFile = (index: number) => {
    const newFiles = uploadedFiles.filter((_, i) => i !== index);
    setUploadedFiles(newFiles);
    onFilesUploaded(newFiles);
  };

  const viewFile = (url: string) => {
    const fileName = url.split('/').pop() || 'Arquivo';
    setViewingFile({ url, name: fileName });
  };

  return (
    <div className="space-y-4">
      <div 
        className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:bg-secondary/20 transition-colors"
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground mb-2">
          Arraste arquivos aqui ou clique para selecionar
        </p>
        <p className="text-xs text-muted-foreground mb-2">
          Máximo {maxFiles} arquivos • Imagens e PDFs
        </p>
        <Button type="button" variant="outline" size="sm" disabled={uploading}>
          {uploading ? "Enviando..." : "Selecionar Arquivos"}
        </Button>
        <Input
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptedTypes}
          onChange={handleFileUpload}
          className="hidden"
        />
      </div>

      {uploadedFiles.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Arquivos anexados:</p>
          {uploadedFiles.map((url, index) => {
            const fileName = url.split('/').pop() || `Arquivo ${index + 1}`;
            return (
              <div key={index} className="flex items-center justify-between p-2 bg-secondary/20 rounded">
                <span className="text-sm truncate flex-1">{fileName}</span>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => viewFile(url)}
                    className="h-8 w-8 p-0"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(index)}
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Visualização */}
      {viewingFile && (
        <ImageViewerModal
          isOpen={!!viewingFile}
          onClose={() => setViewingFile(null)}
          imageUrl={viewingFile.url}
          imageName={viewingFile.name}
        />
      )}
    </div>
  );
};