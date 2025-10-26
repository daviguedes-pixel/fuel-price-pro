import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, MapPin, Building2, X, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Station {
  id_posto: number;
  cnpj: string;
  razao_social: string;
  endereco: string;
  municipio: string;
  uf: string;
  bandeira: string;
}

interface StationComboboxProps {
  label?: string;
  value?: string;
  onSelect: (stationId: string, stationName: string) => void;
  required?: boolean;
}

export const StationCombobox = ({ 
  label = "Posto", 
  value, 
  onSelect,
  required = false 
}: StationComboboxProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [stations, setStations] = useState<Station[]>([]);
  const [filteredStations, setFilteredStations] = useState<Station[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);

  // Load all stations on mount
  useEffect(() => {
    loadStations();
  }, []);

  // Load selected station if value is provided
  useEffect(() => {
    if (value && stations.length > 0) {
      const station = stations.find(s => s.cnpj === value || s.id_posto.toString() === value);
      if (station) {
        setSelectedStation(station);
      }
    }
  }, [value, stations]);

  const loadStations = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('concorrentes')
        .select('*')
        .order('razao_social')
        .limit(500); // Aumentar limite para carregar mais postos

      if (error) throw error;
      
      console.log(`✅ Postos carregados: ${data?.length || 0}`);
      console.log(`📍 Primeiros 5:`, data?.slice(0, 5));
      
      setStations(data || []);
    } catch (error) {
      console.error('Error loading stations:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter stations based on search term
  useEffect(() => {
    // Se não há termo de busca, mostrar todos os postos (limitados a 100 para performance)
    if (searchTerm.length === 0) {
      const allStations = stations.slice(0, 100);
      setFilteredStations(allStations);
      setIsOpen(allStations.length > 0);
      return;
    }

    // Se tem menos de 2 caracteres, ainda mostrar alguns resultados
    if (searchTerm.length === 1) {
      const term = searchTerm.toLowerCase();
      const filtered = stations.filter(station => 
        station.razao_social?.toLowerCase().startsWith(term) ||
        station.cnpj?.startsWith(term) ||
        station.bandeira?.toLowerCase().startsWith(term)
      ).slice(0, 100);
      setFilteredStations(filtered);
      setIsOpen(filtered.length > 0);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = stations.filter(station => 
      station.razao_social?.toLowerCase().includes(term) ||
      station.cnpj?.includes(term) ||
      station.municipio?.toLowerCase().includes(term) ||
      station.bandeira?.toLowerCase().includes(term) ||
      station.endereco?.toLowerCase().includes(term)
    ).slice(0, 100);

    setFilteredStations(filtered);
    setIsOpen(filtered.length > 0);
  }, [searchTerm, stations]);

  const handleSelect = (station: Station) => {
    setSelectedStation(station);
    // Retornar o id_posto (PK) para evitar depender de CNPJ
    onSelect(String(station.id_posto), station.razao_social);
    setSearchTerm("");
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && filteredStations.length > 0) {
      e.preventDefault();
      handleSelect(filteredStations[0]);
    }
  };

  const handleClear = () => {
    setSelectedStation(null);
    setSearchTerm("");
    onSelect("", "");
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
          <Building2 className="w-4 h-4 text-white" />
        </div>
        <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          {label} {required && <span className="text-red-500">*</span>}
        </Label>
      </div>

      {/* Selected Station Display */}
      {selectedStation ? (
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200 dark:border-blue-800">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1">
                <CheckCircle2 className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-1 flex-shrink-0" />
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
                    {selectedStation.municipio && selectedStation.uf && (
                      <Badge variant="outline" className="border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-300">
                        <MapPin className="h-3 w-3 mr-1" />
                        {selectedStation.municipio} - {selectedStation.uf}
                      </Badge>
                    )}
                  </div>
                  {selectedStation.endereco && (
                    <p className="text-xs text-blue-700 dark:text-blue-300 truncate">
                      {selectedStation.endereco}
                    </p>
                  )}
                  <p className="text-xs text-blue-600 dark:text-blue-400 font-mono">
                    CNPJ: {selectedStation.cnpj}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="text-blue-600 hover:text-blue-800 hover:bg-blue-100 dark:text-blue-400 dark:hover:text-blue-200"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Search Input */
        <div className="relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Digite para buscar ou clique para ver todos"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-10 pr-10"
              onFocus={() => {
                // Abrir dropdown mostrando os 100 primeiros postos
                const allStations = stations.slice(0, 100);
                setFilteredStations(allStations);
                setIsOpen(true);
              }}
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                onClick={() => {
                  setSearchTerm("");
                  setIsOpen(false);
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>

          {/* Results Dropdown */}
          {isOpen && (
            <Card className="absolute top-full left-0 right-0 mt-1 z-50 max-h-96 overflow-y-auto shadow-xl bg-background border-2">
              <CardContent className="p-2">
                {loading ? (
                  <div className="p-4 text-center text-muted-foreground">
                    Carregando postos...
                  </div>
                ) : filteredStations.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">
                    Nenhum posto encontrado
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filteredStations.map((station) => (
                      <div
                        key={station.id_posto}
                        className="flex items-start gap-3 p-3 hover:bg-secondary/80 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-primary/20"
                        onClick={() => handleSelect(station)}
                      >
                        <Building2 className="h-5 w-5 text-blue-600 mt-1 flex-shrink-0" />
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
                            {station.municipio && station.uf && (
                              <Badge variant="outline" className="text-xs">
                                <MapPin className="h-2.5 w-2.5 mr-1" />
                                {station.municipio} - {station.uf}
                              </Badge>
                            )}
                          </div>
                          {station.endereco && (
                            <p className="text-xs text-muted-foreground truncate">
                              {station.endereco}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground font-mono">
                            CNPJ: {station.cnpj}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Overlay to close dropdown */}
          {isOpen && (
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setIsOpen(false)}
            />
          )}
        </div>
      )}
    </div>
  );
};
