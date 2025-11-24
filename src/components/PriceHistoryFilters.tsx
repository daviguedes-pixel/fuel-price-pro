import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Filter } from "lucide-react";
import { ClientCombobox } from "@/components/ClientCombobox";
import { SisEmpresaCombobox } from "@/components/SisEmpresaCombobox";

interface PriceHistoryFiltersProps {
  onFilter: (filters: any) => void;
}

export const PriceHistoryFilters = ({ onFilter }: PriceHistoryFiltersProps) => {
  const [filters, setFilters] = useState({
    product: "all",
    sortBy: "date",
    stationId: "all",
    clientId: "all"
  });

  const handleApplyFilters = () => {
    // Mapear os filtros para o formato esperado pela função de busca
    onFilter({
      product: filters.product,
      station: filters.stationId !== 'all' ? filters.stationId : undefined,
      client: filters.clientId !== 'all' ? filters.clientId : undefined,
      sortBy: filters.sortBy
    });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 p-4 bg-secondary/20 rounded-lg">
      <div className="space-y-2">
        <Label>Produto</Label>
        <Select value={filters.product} onValueChange={(value) => setFilters({...filters, product: value})}>
          <SelectTrigger>
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os produtos</SelectItem>
            <SelectItem value="s10">Diesel S-10</SelectItem>
            <SelectItem value="s10_aditivado">Diesel S-10 Aditivado</SelectItem>
            <SelectItem value="diesel_s500">Diesel S-500</SelectItem>
            <SelectItem value="diesel_s500_aditivado">Diesel S-500 Aditivado</SelectItem>
            <SelectItem value="arla32_granel">Arla 32 Granel</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Posto</Label>
        <div className="relative">
          <SisEmpresaCombobox
            value={filters.stationId !== 'all' ? String(filters.stationId) : ''}
            onSelect={(stationId, stationName) => {
              setFilters({...filters, stationId: stationId ? String(stationId) : 'all'});
            }}
          />
          {filters.stationId !== 'all' && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1 h-7 w-7 p-0 z-10"
              onClick={(e) => {
                e.stopPropagation();
                setFilters({...filters, stationId: 'all'});
              }}
            >
              ×
            </Button>
          )}
        </div>
      </div>
      
      <div className="space-y-2">
        <Label>Cliente</Label>
        <div className="relative">
          <ClientCombobox
            value={filters.clientId !== 'all' ? String(filters.clientId) : ''}
            onSelect={(clientId, clientName) => {
              setFilters({...filters, clientId: clientId ? String(clientId) : 'all'});
            }}
          />
          {filters.clientId !== 'all' && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1 h-7 w-7 p-0 z-10"
              onClick={(e) => {
                e.stopPropagation();
                setFilters({...filters, clientId: 'all'});
              }}
            >
              ×
            </Button>
          )}
        </div>
      </div>
      
      <div className="space-y-2">
        <Label>Organizar por</Label>
        <Select value={filters.sortBy} onValueChange={(value) => setFilters({...filters, sortBy: value})}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date">Data</SelectItem>
            <SelectItem value="price">Preço</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div className="space-y-2">
        <Label>&nbsp;</Label>
        <Button onClick={handleApplyFilters} className="w-full">
          <Filter className="h-4 w-4 mr-2" />
          Filtrar
        </Button>
      </div>
    </div>
  );
};