import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Filter, Search } from "lucide-react";
import { useDatabase } from "@/hooks/useDatabase";

interface PriceHistoryFiltersProps {
  onFilter: (filters: any) => void;
}

export const PriceHistoryFilters = ({ onFilter }: PriceHistoryFiltersProps) => {
  const [filters, setFilters] = useState({
    searchTerm: "",
    product: "all",
    sortBy: "date",
    stationId: "all",
    clientId: "all"
  });
  
  const { stations, clients } = useDatabase();

  const handleApplyFilters = () => {
    onFilter(filters);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 p-4 bg-secondary/20 rounded-lg">
      <div className="space-y-2">
        <Label>Buscar</Label>
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            className="pl-8"
            value={filters.searchTerm}
            onChange={(e) => setFilters({...filters, searchTerm: e.target.value})}
          />
        </div>
      </div>
      
      <div className="space-y-2">
        <Label>Produto</Label>
        <Select value={filters.product} onValueChange={(value) => setFilters({...filters, product: value})}>
          <SelectTrigger>
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os produtos</SelectItem>
            <SelectItem value="gasolina_comum">Gasolina Comum</SelectItem>
            <SelectItem value="gasolina_aditivada">Gasolina Aditivada</SelectItem>
            <SelectItem value="etanol">Etanol</SelectItem>
            <SelectItem value="s10">S10</SelectItem>
            <SelectItem value="s500">S500</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Posto</Label>
        <Select value={filters.stationId} onValueChange={(value) => setFilters({...filters, stationId: value})}>
          <SelectTrigger>
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os postos</SelectItem>
            {stations.map((station) => (
              <SelectItem key={station.id} value={station.id}>
                {station.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <div className="space-y-2">
        <Label>Cliente</Label>
        <Select value={filters.clientId} onValueChange={(value) => setFilters({...filters, clientId: value})}>
          <SelectTrigger>
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os clientes</SelectItem>
            {clients.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {client.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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