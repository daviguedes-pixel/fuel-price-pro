import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Search, MapPin, Building2, X, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface SisEmpresa {
  id_empresa?: string | number;
  nome_empresa: string;
  cnpj_cpf: string;
  bandeira?: string;
  rede?: string;
  latitude?: number;
  longitude?: number;
  registro_ativo?: string;
  municipio?: string;
  uf?: string;
  raizen_code?: string;
  vibra_code?: string;
  ipp_code?: string;
}

interface MultiStationSelectorProps {
  label?: string;
  value?: string[]; // Array de IDs de postos
  onSelect: (stationIds: string[]) => void;
  required?: boolean;
}

export const MultiStationSelector = ({ 
  label = "Postos", 
  value = [], 
  onSelect,
  required = false 
}: MultiStationSelectorProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [empresas, setEmpresas] = useState<SisEmpresa[]>([]);
  const [filteredEmpresas, setFilteredEmpresas] = useState<SisEmpresa[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedStations, setSelectedStations] = useState<SisEmpresa[]>([]);

  // Load all empresas on mount
  useEffect(() => {
    loadEmpresas();
  }, []);

  // Load selected stations if value is provided
  useEffect(() => {
    if (value && value.length > 0 && empresas.length > 0) {
      const stations = empresas.filter(e => 
        value.includes(String(e.id_empresa)) || 
        value.includes(e.nome_empresa) || 
        value.includes(e.cnpj_cpf)
      );
      setSelectedStations(stations);
    } else {
      setSelectedStations([]);
    }
  }, [value, empresas]);

  const loadEmpresas = async () => {
    setLoading(true);
    try {
      const result = await supabase.rpc('get_sis_empresa_stations');
      if (result.error) throw result.error;
      setEmpresas(result.data || []);
    } catch (error) {
      console.error('Error loading sis_empresa:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter empresas based on search term
  useEffect(() => {
    if (searchTerm.length < 2) {
      setFilteredEmpresas([]);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = empresas.filter(empresa => 
      empresa.nome_empresa?.toLowerCase().includes(term) ||
      empresa.cnpj_cpf?.toLowerCase().includes(term) ||
      empresa.municipio?.toLowerCase().includes(term) ||
      empresa.uf?.toLowerCase().includes(term)
    );
    setFilteredEmpresas(filtered);
  }, [searchTerm, empresas]);

  const handleSelectStation = (empresa: SisEmpresa) => {
    const stationId = String(empresa.id_empresa || empresa.cnpj_cpf || empresa.nome_empresa);
    
    // Verificar se já está selecionado
    if (selectedStations.some(s => 
      String(s.id_empresa || s.cnpj_cpf || s.nome_empresa) === stationId
    )) {
      return; // Já está selecionado
    }

    const newSelected = [...selectedStations, empresa];
    setSelectedStations(newSelected);
    
    const stationIds = newSelected.map(s => 
      String(s.id_empresa || s.cnpj_cpf || s.nome_empresa)
    );
    onSelect(stationIds);
    
    setSearchTerm("");
    setFilteredEmpresas([]);
  };

  const handleRemoveStation = (empresa: SisEmpresa) => {
    const stationId = String(empresa.id_empresa || empresa.cnpj_cpf || empresa.nome_empresa);
    const newSelected = selectedStations.filter(s => 
      String(s.id_empresa || s.cnpj_cpf || s.nome_empresa) !== stationId
    );
    setSelectedStations(newSelected);
    
    const stationIds = newSelected.map(s => 
      String(s.id_empresa || s.cnpj_cpf || s.nome_empresa)
    );
    onSelect(stationIds);
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
        <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        {label} {required && <span className="text-red-500">*</span>}
      </Label>
      
      {/* Postos selecionados */}
      {selectedStations.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {selectedStations.map((empresa, index) => (
            <Badge 
              key={index} 
              variant="secondary" 
              className="flex items-center gap-1 px-2 py-1"
            >
              {empresa.nome_empresa}
              <button
                onClick={() => handleRemoveStation(empresa)}
                className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Campo de busca */}
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Buscar postos..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={() => setIsOpen(true)}
          className="pl-10 h-11"
        />
        
        {/* Dropdown de resultados */}
        {isOpen && (filteredEmpresas.length > 0 || searchTerm.length >= 2) && (
          <Card className="absolute z-50 w-full mt-1 max-h-60 overflow-y-auto shadow-lg">
            <CardContent className="p-0">
              {loading ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Carregando...
                </div>
              ) : filteredEmpresas.length > 0 ? (
                <div className="py-1">
                  {filteredEmpresas.map((empresa, index) => {
                    const stationId = String(empresa.id_empresa || empresa.cnpj_cpf || empresa.nome_empresa);
                    const isSelected = selectedStations.some(s => 
                      String(s.id_empresa || s.cnpj_cpf || s.nome_empresa) === stationId
                    );
                    
                    return (
                      <button
                        key={index}
                        type="button"
                        onClick={() => handleSelectStation(empresa)}
                        disabled={isSelected}
                        className={`w-full text-left px-4 py-2 hover:bg-muted transition-colors flex items-center gap-3 ${
                          isSelected ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        {isSelected && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1">
                          <div className="font-medium">{empresa.nome_empresa}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2">
                            {empresa.cnpj_cpf && <span>{empresa.cnpj_cpf}</span>}
                            {empresa.municipio && empresa.uf && (
                              <>
                                <MapPin className="h-3 w-3" />
                                <span>{empresa.municipio}, {empresa.uf}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : searchTerm.length >= 2 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Nenhum posto encontrado
                </div>
              ) : null}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Fechar dropdown ao clicar fora */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};

