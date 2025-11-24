import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Percent, AlertTriangle, Download, RefreshCw, Calendar } from 'lucide-react';
import { formatBrazilianCurrency } from '@/lib/utils';

interface DescontoIndevido {
  id_transacao: number;
  data_transacao: string;
  posto_id: number;
  nome_posto: string;
  cliente_id: number;
  nome_cliente: string;
  produto: string;
  preco_calculado: number;
  custo_dia: number;
  diferenca: number;
  percentual_desconto: number;
  negativado: boolean;
  observacoes?: string;
}

export default function DescontosIndevidos() {
  const [loading, setLoading] = useState(false);
  const [descontos, setDescontos] = useState<DescontoIndevido[]>([]);
  const [dataInicio, setDataInicio] = useState<string>('');
  const [dataFim, setDataFim] = useState<string>('');
  const [mostrarApenasNegativadas, setMostrarApenasNegativadas] = useState(false);

  // Definir datas padrão (últimos 7 dias para melhor performance)
  useEffect(() => {
    const hoje = new Date();
    const seteDiasAtras = new Date();
    seteDiasAtras.setDate(hoje.getDate() - 7);
    
    setDataFim(hoje.toISOString().split('T')[0]);
    setDataInicio(seteDiasAtras.toISOString().split('T')[0]);
  }, []);

  const loadDescontos = async () => {
    setLoading(true);
    try {
      console.log('🔍 Buscando descontos indevidos...', { dataInicio, dataFim });

      // Chamar a função RPC com os parâmetros corretos e timeout aumentado
      const params: any = {};
      if (dataInicio) params.p_data_inicio = dataInicio;
      if (dataFim) params.p_data_fim = dataFim;

      // Usar timeout maior para queries complexas
      const startTime = Date.now();
      const { data, error } = await supabase.rpc('get_descontos_indevidos', params);
      const duration = Date.now() - startTime;
      console.log(`⏱️ Query executada em ${duration}ms`);

      if (error) {
        console.error('❌ Erro ao buscar descontos indevidos:', error);
        toast.error('Erro ao buscar descontos indevidos', {
          description: error.message
        });
        return;
      }

      console.log('✅ Descontos indevidos encontrados:', data?.length || 0);
      console.log('📊 Dados retornados:', data);
      setDescontos(data || []);
      
      if (data && data.length > 0) {
        const negativadas = data.filter((d: any) => d.negativado).length;
        toast.success(`${data.length} transação(ões) encontrada(s)`, {
          description: negativadas > 0 ? `${negativadas} negativada(s)` : 'Nenhuma negativada'
        });
      } else {
        toast.warning('Nenhum desconto indevido encontrado no período', {
          description: 'Verifique: 1) Se há transações no período, 2) Se os preços calculados são válidos, 3) Se os custos do dia estão disponíveis. Execute o script de teste no SQL Editor para diagnóstico.',
          duration: 10000
        });
        console.warn('⚠️ Nenhum resultado encontrado. Possíveis causas:');
        console.warn('   1. Não há transações no período selecionado');
        console.warn('   2. Todas as transações têm preço >= custo do dia');
        console.warn('   3. A função get_lowest_cost_freight não retorna custos para essas transações');
        console.warn('   4. Erro na conversão de dados (data_cupom ou preco_calculado)');
        console.warn('💡 Execute o script TESTAR_DESCONTOS_INDEVIDOS.sql no SQL Editor para diagnóstico');
      }
    } catch (error: any) {
      console.error('❌ Erro ao buscar descontos:', error);
      toast.error('Erro ao buscar descontos indevidos', {
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (dataInicio && dataFim) {
      loadDescontos();
    }
  }, []); // Carregar apenas uma vez ao montar

  const handleExport = () => {
    if (descontos.length === 0) {
      toast.warning('Nenhum dado para exportar');
      return;
    }

    // Criar CSV
    const headers = [
      'ID Transação',
      'Data',
      'Posto',
      'Cliente',
      'Produto',
      'Preço Calculado',
      'Custo do Dia',
      'Diferença',
      '% Desconto',
      'Negativado',
      'Observações'
    ];

    const rows = descontos.map(d => [
      d.id_transacao,
      d.data_transacao,
      d.nome_posto,
      d.nome_cliente,
      d.produto,
      d.preco_calculado.toFixed(4),
      d.custo_dia.toFixed(4),
      d.diferenca.toFixed(4),
      d.percentual_desconto.toFixed(2),
      d.negativado ? 'Sim' : 'Não',
      d.observacoes || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Adicionar BOM para Excel
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `descontos_indevidos_${dataInicio}_${dataFim}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success('Arquivo CSV exportado com sucesso!');
  };

  const totalNegativado = descontos
    .filter(d => d.negativado)
    .reduce((sum, d) => sum + Math.abs(d.diferenca), 0);
  const totalTransacoes = descontos.length;
  const totalNegativadas = descontos.filter(d => d.negativado).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-background dark:to-card p-6">
      <div className="container mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden rounded-lg bg-gradient-to-r from-red-800 via-red-700 to-red-800 p-6 text-white shadow-lg">
          <div className="absolute inset-0 bg-black/10"></div>
          <div className="relative flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
                <Percent className="h-8 w-8" />
                Descontos Indevidos
              </h1>
              <p className="text-red-100">
                Identificação de transações com preço calculado menor que o custo do dia
              </p>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Filtros
            </CardTitle>
            <CardDescription>
              Selecione o período para análise (recomendado: até 7 dias para melhor performance)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dataInicio">Data Início</Label>
                <Input
                  id="dataInicio"
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dataFim">Data Fim</Label>
                <Input
                  id="dataFim"
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                />
              </div>
              <div className="flex items-end gap-2">
                <Button 
                  onClick={loadDescontos} 
                  disabled={loading || !dataInicio || !dataFim}
                  className="flex-1"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  {loading ? 'Buscando...' : 'Buscar'}
                </Button>
                {descontos.length > 0 && (
                  <Button onClick={handleExport} variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Exportar
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Estatísticas */}
        {descontos.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm font-medium text-muted-foreground">Total de Transações</div>
                <div className="text-2xl font-bold">
                  {totalTransacoes}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {totalNegativadas} negativadas
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm font-medium text-muted-foreground">Total Negativado</div>
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {formatBrazilianCurrency(totalNegativado)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm font-medium text-muted-foreground">Média por Negativada</div>
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {totalNegativadas > 0 ? formatBrazilianCurrency(totalNegativado / totalNegativadas) : 'R$ 0,00'}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabela de Descontos */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Transações do Período</CardTitle>
                <CardDescription>
                  Todas as transações com comparação de preço calculado vs custo do dia
                </CardDescription>
              </div>
              {descontos.length > 0 && (
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={mostrarApenasNegativadas}
                      onChange={(e) => setMostrarApenasNegativadas(e.target.checked)}
                      className="rounded"
                    />
                    <span>Mostrar apenas negativadas</span>
                  </label>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : descontos.length === 0 ? (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Nenhum desconto indevido encontrado no período selecionado.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Posto</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-right">Preço Calculado</TableHead>
                      <TableHead className="text-right">Custo do Dia</TableHead>
                      <TableHead className="text-right">Diferença</TableHead>
                      <TableHead className="text-right">% Desconto</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                <TableBody>
                  {descontos
                    .filter(d => !mostrarApenasNegativadas || d.negativado)
                    .map((desconto) => (
                      <TableRow key={desconto.id_transacao}>
                        <TableCell>
                          {new Date(desconto.data_transacao).toLocaleDateString('pt-BR')}
                        </TableCell>
                        <TableCell>{desconto.nome_posto}</TableCell>
                        <TableCell>{desconto.nome_cliente}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{desconto.produto}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatBrazilianCurrency(desconto.preco_calculado)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatBrazilianCurrency(desconto.custo_dia)}
                        </TableCell>
                        <TableCell className="text-right">
                          {desconto.diferenca < 0 ? (
                            <span className="font-bold text-red-600 dark:text-red-400">
                              {formatBrazilianCurrency(desconto.diferenca)}
                            </span>
                          ) : (
                            <span className="text-green-600 dark:text-green-400">
                              {formatBrazilianCurrency(desconto.diferenca)}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {desconto.negativado ? (
                            <Badge variant="destructive">
                              {desconto.percentual_desconto.toFixed(2)}%
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-green-700 dark:text-green-400">
                              {desconto.percentual_desconto > 0 ? '+' : ''}{desconto.percentual_desconto.toFixed(2)}%
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {desconto.negativado ? (
                            <Badge variant="destructive">
                              Negativado
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400">
                              OK
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

