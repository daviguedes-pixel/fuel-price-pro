import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Users, X, CheckCircle2, Mail, Phone } from "lucide-react";
import { useDatabase } from "@/hooks/useDatabase";

interface Client {
  id: string;
  code: string;
  name: string;
  contact_email?: string;
  contact_phone?: string;
  active: boolean;
}

interface ClientComboboxProps {
  label?: string;
  value?: string;
  onSelect: (clientId: string, clientName: string) => void;
  required?: boolean;
}

export const ClientCombobox = ({ 
  label = "Cliente", 
  value, 
  onSelect,
  required = false 
}: ClientComboboxProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  
  const { clients } = useDatabase();

  // Load selected client if value is provided, or clear if value is empty
  useEffect(() => {
    if (!value || value === "") {
      // Se value for vazio, limpar seleção
      setSelectedClient(null);
    } else if (value && clients.length > 0) {
      const client = clients.find(c => c.id === value);
      if (client) {
        // Atualizar o nome exibido para qualquer cliente com o mesmo nome
        const clientsWithSameName = clients.filter(c => 
          c.name.toLowerCase() === client.name.toLowerCase()
        );
        if (clientsWithSameName.length > 0) {
          // Manter o primeiro selecionado mas mostrar que pode haver múltiplos
          const clientToSet = clientsWithSameName.find(c => c.active) || clientsWithSameName[0] || client;
          setSelectedClient(clientToSet as Client);
        } else {
          setSelectedClient(client as Client);
        }
      } else {
        // Se não encontrou o cliente, limpar seleção
        setSelectedClient(null);
      }
    }
  }, [value, clients]);

  // Filter clients based on search term and group by name
  useEffect(() => {
    if (searchTerm.length < 2) {
      setFilteredClients([]);
      return;
    }

    const term = searchTerm.toLowerCase();
    const norm = (v: any) => (v ?? "").toString().toLowerCase();
    
    // Filtrar clientes
    const filtered = (clients || []).filter((client: any) => 
      norm(client.name).includes(term) ||
      norm(client.code).includes(term) ||
      norm(client.contact_email).includes(term)
    );

    // Agrupar por nome e pegar apenas o primeiro de cada grupo
    const groupedMap = new Map<string, Client>();
    filtered.forEach((client: any) => {
      const normalizedName = norm(client.name);
      if (!groupedMap.has(normalizedName)) {
        // Priorizar cliente ativo, senão pegar o primeiro
        groupedMap.set(normalizedName, client as Client);
      } else {
        const existing = groupedMap.get(normalizedName)!;
        // Se o cliente atual está ativo e o existente não, substituir
        if (client.active && !existing.active) {
          groupedMap.set(normalizedName, client as Client);
        }
      }
    });

    // Converter map para array e limitar a 10 resultados
    const uniqueClients = Array.from(groupedMap.values()).slice(0, 10);

    setFilteredClients(uniqueClients);
    setIsOpen(uniqueClients.length > 0);
  }, [searchTerm, clients]);

  const handleSelect = (client: Client) => {
    // Agrupar: encontrar todos os clientes com o mesmo nome
    const clientsWithSameName = (clients || []).filter(c => 
      c.name.toLowerCase() === client.name.toLowerCase()
    );
    
    // Selecionar o primeiro cliente ativo, senão o primeiro disponível
    const clientToSelect = clientsWithSameName.find(c => c.active) || clientsWithSameName[0] || client;
    
    setSelectedClient(clientToSelect);
    
    // Retornar o ID do cliente selecionado (primeiro do grupo)
    onSelect(clientToSelect.id, clientToSelect.name);
    setSearchTerm("");
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && filteredClients.length > 0) {
      e.preventDefault();
      handleSelect(filteredClients[0]);
    }
  };

  const handleClear = () => {
    setSelectedClient(null);
    setSearchTerm("");
    onSelect("", "");
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
        <Users className="w-4 h-4 text-green-600 dark:text-green-400" />
        {label} {required && <span className="text-red-500">*</span>}
      </Label>

      {/* Selected Client Display */}
      {selectedClient ? (
        <Card className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200 dark:border-green-800">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mt-1 flex-shrink-0" />
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="font-semibold text-green-900 dark:text-green-100">
                    {selectedClient.name}
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200">
                      {selectedClient.code}
                    </Badge>
                    {!selectedClient.active && (
                      <Badge variant="destructive" className="text-xs">
                        Inativo
                      </Badge>
                    )}
                  </div>
                  {selectedClient.contact_email && (
                    <p className="text-xs text-green-700 dark:text-green-300 flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {selectedClient.contact_email}
                    </p>
                  )}
                  {selectedClient.contact_phone && (
                    <p className="text-xs text-green-700 dark:text-green-300 flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {selectedClient.contact_phone}
                    </p>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="text-green-600 hover:text-green-800 hover:bg-green-100 dark:text-green-400 dark:hover:text-green-200"
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
              placeholder="Buscar por nome, código ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-11 pl-10 pr-10"
              onFocus={() => setIsOpen(filteredClients.length > 0)}
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
                {filteredClients.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">
                    Nenhum cliente encontrado
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filteredClients.map((client) => (
                      <div
                        key={client.id}
                        className="flex items-start gap-3 p-3 hover:bg-secondary/80 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-primary/20"
                        onClick={() => handleSelect(client)}
                      >
                        <Users className="h-5 w-5 text-green-600 mt-1 flex-shrink-0" />
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="font-semibold text-sm flex items-center gap-2">
                            {client.name}
                            {!client.active && (
                              <Badge variant="destructive" className="text-xs">
                                Inativo
                              </Badge>
                            )}
                          </div>
                          {client.code && (
                            <Badge variant="secondary" className="text-xs">
                              {client.code}
                            </Badge>
                          )}
                          {client.contact_email && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {client.contact_email}
                            </p>
                          )}
                          {client.contact_phone && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {client.contact_phone}
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
