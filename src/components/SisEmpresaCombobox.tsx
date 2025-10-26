import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, MapPin, Building2, X, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface SisEmpresa {
  id_empresa?: number | string;
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

interface SisEmpresaComboboxProps {
  label?: string;
  value?: string;
  onSelect: (empresaId: string, empresaName: string) => void;
  required?: boolean;
}

export const SisEmpresaCombobox = ({ 
  label = "Posto", 
  value, 
  onSelect,
  required = false 
}: SisEmpresaComboboxProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [empresas, setEmpresas] = useState<SisEmpresa[]>([]);
  const [filteredEmpresas, setFilteredEmpresas] = useState<SisEmpresa[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedEmpresa, setSelectedEmpresa] = useState<SisEmpresa | null>(null);

  // Load all empresas on mount
  useEffect(() => {
    loadEmpresas();
  }, []);

  // Load selected empresa if value is provided
  useEffect(() => {
    if (value && empresas.length > 0 && !selectedEmpresa) {
      const empresa = empresas.find(e => e.id_empresa === value || e.nome_empresa === value || e.cnpj_cpf === value);
      if (empresa) {
        setSelectedEmpresa(empresa);
      }
    }
  }, [value, empresas, selectedEmpresa]);

  const loadEmpresas = async () => {
    setLoading(true);
    try {
      // Tentar nova função primeiro, depois fallback para a original
      let data = null;
      let error = null;
      
      const result = await supabase.rpc('get_sis_empresa_stations');
      data = result.data;
      error = result.error;

      if (error) throw error;
      
      // Log detalhado para debug
      if (data && data.length > 0) {
        console.log('📊 Empresas carregadas (primeiras 3):', data.slice(0, 3).map(e => ({
          id_empresa: e.id_empresa,
          cnpj_cpf: e.cnpj_cpf,
          nome_empresa: e.nome_empresa
        })));
      }
      
      setEmpresas(data || []);
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
      empresa.cnpj_cpf?.includes(term) ||
      empresa.municipio?.toLowerCase().includes(term) ||
      empresa.bandeira?.toLowerCase().includes(term) ||
      empresa.raizen_code?.toLowerCase().includes(term) ||
      empresa.vibra_code?.toLowerCase().includes(term) ||
      empresa.ipp_code?.toLowerCase().includes(term) ||
      empresa.rede?.toLowerCase().includes(term)
    ).slice(0, 10);

    setFilteredEmpresas(filtered);
    setIsOpen(filtered.length > 0);
  }, [searchTerm, empresas]);

  const handleSelect = (empresa: SisEmpresa) => {
    // Usar id_empresa para compatibilidade com ID_POSTO na tabela tipos_pagamento
    // Converter para string para garantir tipo correto
    const empresaId = empresa.id_empresa ? String(empresa.id_empresa) : (empresa.cnpj_cpf || empresa.nome_empresa);
    
    console.log('🔄 SisEmpresaCombobox - Selecionou empresa:', {
      nome: empresa.nome_empresa,
      id_empresa: empresa.id_empresa,
      cnpj_cpf: empresa.cnpj_cpf,
      empresaId_selecionado: empresaId
    });
    
    setSelectedEmpresa(empresa);
    setSearchTerm("");
    setIsOpen(false);
    
    onSelect(empresaId, empresa.nome_empresa);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && filteredEmpresas.length > 0) {
      e.preventDefault();
      handleSelect(filteredEmpresas[0]);
    }
  };

  const handleClear = () => {
    setSelectedEmpresa(null);
    setSearchTerm("");
    onSelect("", "");
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
        <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        {label} {required && <span className="text-red-500">*</span>}
      </Label>

      {/* Selected Empresa Display */}
      {selectedEmpresa ? (
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200 dark:border-blue-800">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1">
                <CheckCircle2 className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-1 flex-shrink-0" />
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="font-semibold text-blue-900 dark:text-blue-100">
                    {selectedEmpresa.nome_empresa}
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {selectedEmpresa.bandeira && (
                      <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200">
                        {selectedEmpresa.bandeira}
                      </Badge>
                    )}
                    {selectedEmpresa.rede && (
                      <Badge variant="outline" className="border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-300">
                        {selectedEmpresa.rede}
                      </Badge>
                    )}
                    {selectedEmpresa.municipio && selectedEmpresa.uf && (
                      <Badge variant="outline" className="border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-300">
                        <MapPin className="h-3 w-3 mr-1" />
                        {selectedEmpresa.municipio} - {selectedEmpresa.uf}
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {selectedEmpresa.raizen_code && (
                      <span className="text-blue-700 dark:text-blue-300">
                        Raizen: {selectedEmpresa.raizen_code}
                      </span>
                    )}
                    {selectedEmpresa.vibra_code && (
                      <span className="text-blue-700 dark:text-blue-300">
                        Vibra: {selectedEmpresa.vibra_code}
                      </span>
                    )}
                    {selectedEmpresa.ipp_code && (
                      <span className="text-blue-700 dark:text-blue-300">
                        IPP: {selectedEmpresa.ipp_code}
                      </span>
                    )}
                  </div>
                  {selectedEmpresa.cnpj_cpf && (
                    <p className="text-xs text-blue-600 dark:text-blue-400 font-mono">
                      CNPJ: {selectedEmpresa.cnpj_cpf}
                    </p>
                  )}
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
              placeholder="Buscar por nome, CNPJ, cidade, código..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-11 pl-10 pr-10"
              onFocus={() => setIsOpen(filteredEmpresas.length > 0)}
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
                ) : filteredEmpresas.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">
                    Nenhum posto encontrado
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filteredEmpresas.map((empresa, index) => (
                      <div
                        key={`empresa-${index}`}
                        className="flex items-start gap-3 p-3 hover:bg-secondary/80 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-primary/20"
                        onClick={() => handleSelect(empresa)}
                      >
                        <Building2 className="h-5 w-5 text-blue-600 mt-1 flex-shrink-0" />
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="font-semibold text-sm">
                            {empresa.nome_empresa}
                          </div>
                          <div className="flex flex-wrap gap-1.5 text-xs">
                            {empresa.bandeira && (
                              <Badge variant="secondary" className="text-xs">
                                {empresa.bandeira}
                              </Badge>
                            )}
                            {empresa.rede && (
                              <Badge variant="outline" className="text-xs">
                                {empresa.rede}
                              </Badge>
                            )}
                            {empresa.municipio && empresa.uf && (
                              <Badge variant="outline" className="text-xs">
                                <MapPin className="h-2.5 w-2.5 mr-1" />
                                {empresa.municipio} - {empresa.uf}
                              </Badge>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                            {empresa.raizen_code && (
                              <span>Raizen: {empresa.raizen_code}</span>
                            )}
                            {empresa.vibra_code && (
                              <span>Vibra: {empresa.vibra_code}</span>
                            )}
                            {empresa.ipp_code && (
                              <span>IPP: {empresa.ipp_code}</span>
                            )}
                          </div>
                          {empresa.cnpj_cpf && (
                            <p className="text-xs text-muted-foreground font-mono">
                              CNPJ: {empresa.cnpj_cpf}
                            </p>
                          )}
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
