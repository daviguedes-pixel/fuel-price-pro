import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Filter, Search } from "lucide-react";

interface DashboardFiltersProps {
  onFilter: (filters: { searchTerm: string; status: string; product: string }) => void;
}

export const DashboardFilters = ({ onFilter }: DashboardFiltersProps) => {
  const [filters, setFilters] = useState({
    searchTerm: "",
    status: "all",
    product: "all"
  });

  const handleFilter = (filters: { searchTerm: string; status: string; product: string }) => {
    
    const newFilters = { ...filters };
    setFilters(newFilters);
    onFilter(newFilters);
  };

  const handleSearch = (searchTerm: string) => {
    const newFilters = { ...filters, searchTerm };
    setFilters(newFilters);
    onFilter(newFilters);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-secondary/20 rounded-lg">
      <div className="space-y-2">
        <Label>Buscar</Label>
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente, posto..."
            className="pl-8"
            value={filters.searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
      </div>
      
      <div className="space-y-2">
        <Label>Status</Label>
        <Select value={filters.status} onValueChange={(value) => {
          const newFilters = { ...filters, status: value };
          setFilters(newFilters);
          onFilter(newFilters);
        }}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="approved">Aprovado</SelectItem>
            <SelectItem value="rejected">Negado</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div className="space-y-2">
        <Label>Produto</Label>
        <Select value={filters.product} onValueChange={(value) => {
          const newFilters = { ...filters, product: value };
          setFilters(newFilters);
          onFilter(newFilters);
        }}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="etanol">Etanol</SelectItem>
            <SelectItem value="gasolina_comum">Gasolina Comum</SelectItem>
            <SelectItem value="gasolina_aditivada">Gasolina Aditivada</SelectItem>
            <SelectItem value="s10">S10</SelectItem>
            <SelectItem value="s500">S500</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div className="space-y-2">
        <Label>&nbsp;</Label>
        <Button onClick={() => handleFilter(filters)} className="w-full">
          <Filter className="h-4 w-4 mr-2" />
          Filtrar
        </Button>
      </div>
    </div>
  );
};