import { useState, useEffect } from "react";
import { Check, ChevronsUpDown, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";

interface CompetitorStation {
  id: string;
  nome: string;
  endereco: string;
  cidade: string;
  estado: string;
}

interface CompetitorComboboxProps {
  value?: string;
  onValueChange: (value: CompetitorStation | null) => void;
  placeholder?: string;
}

export function CompetitorCombobox({ 
  value, 
  onValueChange, 
  placeholder = "Selecione um posto concorrente..." 
}: CompetitorComboboxProps) {
  const [open, setOpen] = useState(false);
  const [competitors, setCompetitors] = useState<CompetitorStation[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const selectedCompetitor = competitors.find(competitor => competitor.id === value);

  const searchCompetitors = async (query: string) => {
    if (query.length < 2) {
      setCompetitors([]);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('concorrentes')
        .select('id_posto, razao_social, endereco, municipio, uf')
        .or(`razao_social.ilike.%${query}%,cnpj.ilike.%${query}%`)
        .limit(20);

      if (error) throw error;
      const mapped = (data || []).map((c: any) => ({
        id: c.id_posto?.toString() || '',
        nome: c.razao_social || '',
        endereco: c.endereco || '',
        cidade: c.municipio || '',
        estado: c.uf || ''
      }));
      setCompetitors(mapped);
    } catch (error) {
      console.error('Erro ao buscar concorrentes:', error);
      setCompetitors([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (searchQuery) {
      const timeoutId = setTimeout(() => {
        searchCompetitors(searchQuery);
      }, 300);
      return () => clearTimeout(timeoutId);
    } else {
      setCompetitors([]);
    }
  }, [searchQuery]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {selectedCompetitor ? (
            <div className="flex items-center gap-2">
              <span className="truncate">{selectedCompetitor.nome}</span>
              <span className="text-xs text-muted-foreground">
                {selectedCompetitor.cidade} - {selectedCompetitor.estado}
              </span>
            </div>
          ) : (
            placeholder
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput 
            placeholder="Buscar posto concorrente..." 
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            <CommandEmpty>
              {loading ? (
                <div className="py-6 text-center text-sm">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mx-auto mb-2"></div>
                  Buscando...
                </div>
              ) : searchQuery.length < 2 ? (
                "Digite pelo menos 2 caracteres para buscar"
              ) : (
                "Nenhum posto encontrado"
              )}
            </CommandEmpty>
            <CommandGroup>
              {competitors.map((competitor) => (
                <CommandItem
                  key={competitor.id}
                  value={competitor.id}
                  onSelect={() => {
                    onValueChange(competitor);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedCompetitor?.id === competitor.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex-1">
                    <div className="font-medium">{competitor.nome}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {competitor.endereco}, {competitor.cidade} - {competitor.estado}
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
