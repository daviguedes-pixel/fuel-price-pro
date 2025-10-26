import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useAuditLogs, AuditLog } from "@/hooks/useAuditLogs";
import { ArrowLeft, Search, Filter, FileText, Calendar } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function AuditLogs() {
  const navigate = useNavigate();
  const { getAuditLogs } = useAuditLogs();
  
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    tableName: "all",
    recordId: "",
    startDate: "",
    endDate: "",
  });

  useEffect(() => {
    loadLogs();
  }, []); // Array vazio para executar apenas uma vez

  const loadLogs = async () => {
    setLoading(true);
    try {
    const data = await getAuditLogs({
      ...filters,
      tableName: filters.tableName === 'all' ? '' : filters.tableName
    });
      setLogs(data);
    } catch (error) {
      console.error('Error loading logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field: string, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const applyFilters = () => {
    loadLogs();
  };

  const clearFilters = () => {
    setFilters({
      tableName: "all",
      recordId: "",
      startDate: "",
      endDate: "",
    });
    setTimeout(loadLogs, 100);
  };

  const getActionBadge = (action: string) => {
    const variants = {
      INSERT: 'default',
      UPDATE: 'secondary',
      DELETE: 'destructive',
      APPROVE: 'default',
      REJECT: 'destructive',
    };
    return (
      <Badge variant={variants[action as keyof typeof variants] as any}>
        {action}
      </Badge>
    );
  };

  const getTableDisplayName = (tableName: string) => {
    const names = {
      'price_suggestions': 'Solicitações de Preço',
      'referencias': 'Referências',
      'taxas_negociadas': 'Taxas Negociadas',
      'clients': 'Clientes',
      'stations': 'Postos',
      'payment_methods': 'Métodos de Pagamento',
      'user_profiles': 'Perfis de Usuário',
    };
    return names[tableName as keyof typeof names] || tableName;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            onClick={() => navigate("/admin")}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar à Administração
          </Button>
          <h2 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Logs de Auditoria
          </h2>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="table">Tabela</Label>
              <Select value={filters.tableName} onValueChange={(value) => handleFilterChange("tableName", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas as tabelas" />
                </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as tabelas</SelectItem>
                    <SelectItem value="price_suggestions">Solicitações de Preço</SelectItem>
                    <SelectItem value="referencias">Referências</SelectItem>
                    <SelectItem value="taxas_negociadas">Taxas Negociadas</SelectItem>
                    <SelectItem value="clients">Clientes</SelectItem>
                    <SelectItem value="stations">Postos</SelectItem>
                    <SelectItem value="payment_methods">Métodos de Pagamento</SelectItem>
                  </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="recordId">ID do Registro</Label>
              <Input
                id="recordId"
                placeholder="ID específico"
                value={filters.recordId}
                onChange={(e) => handleFilterChange("recordId", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="startDate">Data Início</Label>
              <Input
                id="startDate"
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange("startDate", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">Data Fim</Label>
              <Input
                id="endDate"
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange("endDate", e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <Button onClick={applyFilters} className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              Filtrar
            </Button>
            <Button variant="outline" onClick={clearFilters}>
              Limpar Filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Logs List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Histórico de Ações ({logs.length} registros)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-muted-foreground mt-2">Carregando logs...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Nenhum log encontrado</p>
            </div>
          ) : (
            <div className="space-y-4">
              {logs.map((log) => (
                <div key={log.id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getActionBadge(log.action)}
                      <span className="font-medium">{getTableDisplayName(log.table_name)}</span>
                      <span className="text-sm text-muted-foreground">ID: {log.record_id}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(log.created_at), {
                        addSuffix: true,
                        locale: ptBR
                      })}
                    </span>
                  </div>
                  
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium">Usuário:</span> {log.user_email || 'Sistema'}
                  </div>
                  
                  {log.old_data && (
                    <div className="text-xs">
                      <span className="font-medium text-red-600">Dados Anteriores:</span>
                      <pre className="bg-red-50 p-2 rounded mt-1 overflow-x-auto">
                        {JSON.stringify(log.old_data, null, 2)}
                      </pre>
                    </div>
                  )}
                  
                  {log.new_data && (
                    <div className="text-xs">
                      <span className="font-medium text-green-600">Novos Dados:</span>
                      <pre className="bg-green-50 p-2 rounded mt-1 overflow-x-auto">
                        {JSON.stringify(log.new_data, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}