import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Eye, X } from "lucide-react";
import { useDatabase } from "@/hooks/useDatabase";

interface SearchItem {
  id: string;
  name: string;
  type: 'station' | 'client' | 'suggestion';
  description?: string;
  image?: string;
  status?: string;
  price?: number;
}

interface SearchWithPreviewProps {
  onSelect?: (item: SearchItem) => void;
  placeholder?: string;
  showImages?: boolean;
}

export const SearchWithPreview = ({ 
  onSelect, 
  placeholder = "Buscar...", 
  showImages = true 
}: SearchWithPreviewProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<SearchItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const { stations, clients, suggestions } = useDatabase();

  useEffect(() => {
    if (searchTerm.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setLoading(true);
    
    // Search across stations, clients, and suggestions
    const searchResults: SearchItem[] = [];
    
    // Search stations
    stations.forEach(station => {
      if (station.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          station.code.toLowerCase().includes(searchTerm.toLowerCase())) {
        searchResults.push({
          id: station.id,
          name: station.name,
          type: 'station',
          description: `Código: ${station.code} | ${station.address || 'Sem endereço'}`
        });
      }
    });

    // Search clients  
    clients.forEach(client => {
      if (client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          client.code.toLowerCase().includes(searchTerm.toLowerCase())) {
        searchResults.push({
          id: client.id,
          name: client.name,
          type: 'client',
          description: `Código: ${client.code} | ${client.contact_email || 'Sem email'}`
        });
      }
    });

    // Search suggestions
    suggestions.forEach(suggestion => {
      // Cast to include the joined data
      const suggestionWithJoins = suggestion as any;
      
      if (suggestion.product.toLowerCase().includes(searchTerm.toLowerCase()) ||
          suggestion.observations?.toLowerCase().includes(searchTerm.toLowerCase())) {
        searchResults.push({
          id: suggestion.id,
          name: `${suggestion.product} - ${suggestionWithJoins.stations?.name || 'Posto'}`,
          type: 'suggestion',
          description: `Cliente: ${suggestionWithJoins.clients?.name || 'N/A'} | Preço: R$ ${suggestion.final_price?.toFixed(2).replace('.', ',')}`,
          image: suggestion.attachments?.[0],
          status: suggestion.status,
          price: suggestion.final_price
        });
      }
    });

    setResults(searchResults.slice(0, 8)); // Limit to 8 results
    setIsOpen(searchResults.length > 0);
    setLoading(false);
  }, [searchTerm, stations, clients, suggestions]);

  const handleSelect = (item: SearchItem) => {
    onSelect?.(item);
    setSearchTerm("");
    setIsOpen(false);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'station': return '🏪';
      case 'client': return '👥';
      case 'suggestion': return '💰';
      default: return '📋';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'station': return 'bg-blue-100 text-blue-800';
      case 'client': return 'bg-green-100 text-green-800';
      case 'suggestion': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusBadge = (status?: string) => {
    if (!status) return null;
    
    switch (status) {
      case "pending":
        return <Badge variant="secondary" className="bg-accent/10 text-accent text-xs">Pendente</Badge>;
      case "approved":
        return <Badge variant="secondary" className="bg-success/10 text-success text-xs">Aprovado</Badge>;
      case "rejected":
        return <Badge variant="secondary" className="bg-destructive/10 text-destructive text-xs">Negado</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          placeholder={placeholder}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 pr-10"
          onFocus={() => setIsOpen(results.length > 0)}
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
        <Card className="absolute top-full left-0 right-0 mt-1 z-50 max-h-96 overflow-y-auto shadow-lg">
          <CardContent className="p-2">
            {loading ? (
              <div className="p-4 text-center text-muted-foreground">
                Buscando...
              </div>
            ) : results.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                Nenhum resultado encontrado
              </div>
            ) : (
              <div className="space-y-1">
                {results.map((item) => (
                  <div
                    key={`${item.type}-${item.id}`}
                    className="flex items-center gap-3 p-3 hover:bg-secondary/50 rounded-lg cursor-pointer transition-colors"
                    onClick={() => handleSelect(item)}
                  >
                    {/* Image Preview */}
                    {showImages && item.image ? (
                      <div className="relative flex-shrink-0">
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-12 h-12 object-cover rounded border"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.nextElementSibling?.classList.remove('hidden');
                          }}
                        />
                        <div className="hidden w-12 h-12 bg-secondary/50 rounded border flex items-center justify-center">
                          <span className="text-xs">{getTypeIcon(item.type)}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="w-12 h-12 bg-secondary/50 rounded border flex items-center justify-center flex-shrink-0">
                        <span className="text-lg">{getTypeIcon(item.type)}</span>
                      </div>
                    )}

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{item.name}</span>
                        <Badge className={`text-xs ${getTypeColor(item.type)}`}>
                          {item.type === 'station' ? 'Posto' : 
                           item.type === 'client' ? 'Cliente' : 'Sugestão'}
                        </Badge>
                        {getStatusBadge(item.status)}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {item.description}
                      </p>
                    </div>

                    {/* Price */}
                    {item.price && (
                      <div className="text-right flex-shrink-0">
                        <p className="font-bold text-primary text-sm">
                          R$ {item.price.toFixed(2).replace('.', ',')}
                        </p>
                      </div>
                    )}

                    {/* Action Icon */}
                    <Eye className="h-4 w-4 text-muted-foreground flex-shrink-0" />
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
  );
};