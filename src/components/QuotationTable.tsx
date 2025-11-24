import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ChevronDown, ChevronUp, Search, Filter, RefreshCw, MapPin, Clock, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { formatBrazilianCurrency } from '@/lib/utils'

interface CotacaoItem {
  id: string
  posto_nome: string
  posto_tipo: 'proprio' | 'concorrente'
  produto: string
  preco_referencia: number
  preco_pesquisa: number
  cidade: string
  estado: string
  latitude: number
  longitude: number
  data_atualizacao: string
  fonte: 'referencia' | 'pesquisa'
  expirado: boolean
}

interface QuotationTableProps {
  className?: string
  mode?: 'pesquisas' | 'referencias'
  sortByPrice?: 'asc' | 'desc' | null
  sortByUF?: 'asc' | 'desc' | null
  onSortPrice?: (order: 'asc' | 'desc' | null) => void
  onSortUF?: (order: 'asc' | 'desc' | null) => void
}

type SortField = 'posto_nome' | 'preco_pesquisa' | 'data_atualizacao'
type SortOrder = 'asc' | 'desc'

export default function QuotationTable({ 
  className, 
  mode = 'pesquisas', 
  sortByPrice, 
  sortByUF, 
  onSortPrice, 
  onSortUF 
}: QuotationTableProps) {
  const [loading, setLoading] = useState(false)
  const [cotacoes, setCotacoes] = useState<CotacaoItem[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterRegion, setFilterRegion] = useState<string>('all')
  const [filterProduct, setFilterProduct] = useState<string>('all')
  const [showExpired, setShowExpired] = useState(false)
  const [sortField, setSortField] = useState<SortField>('data_atualizacao')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  // Carregar cotações
  const loadCotacoes = async () => {
    try {
      setLoading(true)
      
      console.log('🔍 Iniciando carregamento...', { mode })
      
      let cotacoesArray: any[] = []

      if (mode === 'referencias') {
        // Modo referências: buscar da tabela referencias (mesmo padrão do mapa)
        console.log('🔍 Modo referências - buscando da tabela referencias')
        
        const { data: referencias, error: refError } = await supabase
          .from('referencias')
          .select('*')
          .order('created_at', { ascending: false })

        console.log('🔍 Referências encontradas:', referencias?.length || 0, 'erro:', refError)
        console.log('🔍 Primeira referência (amostra):', referencias?.[0])

        if (refError) {
          console.error('Erro ao carregar referências:', refError)
          toast.error('Erro ao carregar referências')
        }
        
        // Processar mesmo se houver erro (pode ter dados parciais)
        if (referencias && referencias.length > 0) {
          // Buscar nomes dos postos dos concorrentes (mesmo padrão do mapa)
          const uniqueIds = Array.from(new Set(referencias.map((r: any) => r.posto_id))).filter(Boolean)
          
          let postoMap = new Map<string, string>()
          let ufMap = new Map<string, string>()
          let cidadeMap = new Map<string, string>()
          
          if (uniqueIds.length > 0) {
            // Tentar converter para números (id_posto é numérico)
            const numericIds = uniqueIds.map((id: any) => Number(id)).filter((n: any) => !isNaN(n))
            
            // Buscar em concorrentes (mesmo padrão do mapa)
            const { data: concorrentes, error: concErr } = await supabase
              .from('concorrentes')
              .select('id_posto, razao_social, municipio, uf')
              .in('id_posto', (numericIds.length > 0 ? numericIds : uniqueIds) as any[])

            if (!concErr && concorrentes) {
              console.log('🔍 Concorrentes encontrados:', concorrentes.length)
              concorrentes.forEach(conc => {
                const idKey = String(conc.id_posto)
                postoMap.set(idKey, conc.razao_social || 'Posto Desconhecido')
                if (conc.uf) ufMap.set(idKey, conc.uf)
                if (conc.municipio) cidadeMap.set(idKey, conc.municipio)
              })
            } else if (concErr) {
              console.warn('⚠️ Erro ao buscar concorrentes:', concErr)
            }
          }
          
          console.log('🔍 PostoMap criado com', postoMap.size, 'entradas')

          // Processar referências - manter apenas a mais recente por posto+produto
          const cotacoesRef = referencias
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .reduce((acc, ref: any) => {
              const idKey = String(ref.posto_id)
              const postoNome = postoMap.get(idKey) || ref.posto_id || 'Posto Desconhecido'
              const estado = ref.uf || ufMap.get(idKey) || ''
              const cidade = ref.cidade || cidadeMap.get(idKey) || ''
              
              const key = `${postoNome}-${ref.produto}`
              
              // Se já não existe uma cotação para este posto+produto, adiciona
              if (!acc[key]) {
                // Normalizar nome do produto
                const produtoNormalizado = normalizeProduct(ref.produto)
              
                acc[key] = {
                  id: ref.id,
                  posto_nome: postoNome,
                  posto_tipo: 'concorrente' as const,
                  produto: ref.produto, // Manter original
                  produto_normalizado: produtoNormalizado, // Versão normalizada
                  preco_referencia: Number(ref.preco_referencia) || 0,
                  preco_pesquisa: Number(ref.preco_referencia) || 0,
                  cidade: cidade,
                  estado: estado,
                  latitude: ref.latitude || 0,
                  longitude: ref.longitude || 0,
                  data_atualizacao: ref.created_at,
                  fonte: 'referencia' as const,
                  expirado: false
                }
              }
              
              return acc
            }, {} as Record<string, any>)
          
          cotacoesArray = Object.values(cotacoesRef)
          console.log('🔍 Cotações de referências processadas:', cotacoesArray.length)
          console.log('🔍 Amostra de cotações:', cotacoesArray.slice(0, 3))
        } else {
          console.warn('⚠️ Nenhuma referência encontrada na tabela referencias')
        }
      } else {
        // Modo pesquisas: buscar de competitor_research
        console.log('🔍 Modo pesquisas - buscando de competitor_research')
        
        const { data: pesquisas, error: pesqError } = await supabase
          .from('competitor_research')
          .select(`
            id,
            product,
            price,
            created_at,
            station_name,
            address,
            station_type,
            notes,
            attachments,
            created_by
          `)
          .order('created_at', { ascending: false })

        console.log('🔍 Pesquisas:', pesquisas?.length || 0, 'erro:', pesqError)

        if (pesqError) {
          console.error('Erro ao carregar pesquisas:', pesqError)
          toast.error('Erro ao carregar pesquisas')
          return
        }

        // Processar pesquisas - manter apenas a mais recente por posto+produto
        const cotacoesPesq = (pesquisas || [])
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .reduce((acc, pesq) => {
            const cidade = pesq.address ? pesq.address.split(',')[0]?.trim() : ''
            const estado = pesq.address ? pesq.address.split(',')[1]?.trim() : ''
            
            const key = `${pesq.station_name}-${pesq.product}`
            
            if (!acc[key]) {
              // Normalizar nome do produto usando a função normalizeProduct
              const produtoNormalizado = normalizeProduct(pesq.product)
              
              acc[key] = {
                id: pesq.id,
                posto_nome: pesq.station_name || 'Posto Desconhecido',
                posto_tipo: (pesq.station_type === 'concorrente' ? 'concorrente' : 'proprio') as 'proprio' | 'concorrente',
                produto: pesq.product, // Manter original
                produto_normalizado: produtoNormalizado, // Versão normalizada
                preco_referencia: 0,
                preco_pesquisa: pesq.price,
                cidade,
                estado,
                latitude: 0,
                longitude: 0,
                data_atualizacao: pesq.created_at,
                fonte: 'pesquisa' as const,
                expirado: false
              }
            }
            
            return acc
          }, {} as Record<string, any>)
        
        cotacoesArray = Object.values(cotacoesPesq)
        console.log('🔍 Cotações de pesquisa processadas:', cotacoesArray.length)
      }

      console.log('🔍 Total de cotações:', cotacoesArray.length)

      setCotacoes(cotacoesArray)
    } catch (error) {
      console.error('Erro ao carregar cotações:', error)
      toast.error('Erro ao carregar cotações')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCotacoes()
  }, [mode])

  // Normalizar produtos nas cotações antes de filtrar
  const cotacoesComNormalizacao = cotacoes.map(c => ({
    ...c,
    produto_normalizado: c.produto_normalizado || normalizeProduct(c.produto)
  }))

  // Filtrar cotações com busca dinâmica (palavras parciais em qualquer ordem)
  const filteredCotacoes = cotacoesComNormalizacao.filter(cotacao => {
    // Busca flexível: aceita palavras parciais em qualquer ordem
    if (searchTerm) {
      const searchWords = searchTerm.toLowerCase().split(/\s+/).filter(w => w.length > 0);
      const searchText = `${cotacao.posto_nome} ${cotacao.cidade} ${cotacao.produto}`.toLowerCase();
      
      // Todas as palavras devem estar presentes (em qualquer ordem)
      const matchesSearch = searchWords.every(word => searchText.includes(word));
      if (!matchesSearch) return false;
    }
    
    const matchesRegion = filterRegion === 'all' || 
                         (cotacao.estado || 'Sem UF').toLowerCase().includes(filterRegion.toLowerCase())
    
    // Usar produto_normalizado para filtro
    const matchesProduct = filterProduct === 'all' || 
                          cotacao.produto_normalizado === filterProduct ||
                          cotacao.produto === filterProduct
    
    const matchesExpired = showExpired || !cotacao.expirado
    
    return matchesRegion && matchesProduct && matchesExpired
  })

  // Ordenar cotações
  const sortedCotacoes = [...filteredCotacoes].sort((a, b) => {
    // Primeiro ordenar por preço se especificado
    if (sortByPrice) {
      const aValue = a.preco_pesquisa || a.preco_referencia || 0
      const bValue = b.preco_pesquisa || b.preco_referencia || 0
      if (sortByPrice === 'asc') {
        if (aValue !== bValue) return aValue - bValue
      } else {
        if (aValue !== bValue) return bValue - aValue
      }
    }
    
    // Depois ordenar por UF se especificado
    if (sortByUF) {
      const aValue = a.estado || 'Sem UF'
      const bValue = b.estado || 'Sem UF'
      if (sortByUF === 'asc') {
        if (aValue !== bValue) return aValue.localeCompare(bValue)
      } else {
        if (aValue !== bValue) return bValue.localeCompare(aValue)
      }
    }
    
    // Ordenação padrão por data
    return new Date(b.data_atualizacao).getTime() - new Date(a.data_atualizacao).getTime()
  })

  // Mapear produtos para nomes normalizados (baseado nos produtos da aba referências)
  const normalizeProduct = (product: string): string => {
    if (!product) return product
    const productLower = product.toLowerCase().trim()
    // Mapear variações para nomes padronizados da aba referências (valores exatos salvos)
    if (productLower === 's10' || productLower === 'diesel_s10' || productLower === 's-10') return 's10'
    if (productLower === 's10_aditivado' || productLower === 's10 aditivado' || productLower === 'diesel_s10_aditivado' || productLower === 's10-aditivado') return 's10_aditivado'
    if (productLower === 'diesel_s500' || productLower === 's500' || productLower === 's-500') return 'diesel_s500'
    if (productLower === 'diesel_s500_aditivado' || productLower === 's500_aditivado' || productLower === 's500 aditivado' || productLower === 's500-aditivado') return 'diesel_s500_aditivado'
    if (productLower === 'arla32_granel' || productLower === 'arla' || productLower === 'arla 32' || productLower === 'arla32' || productLower === 'arla_32') return 'arla32_granel'
    // Manter compatibilidade com produtos antigos (para modo pesquisas)
    if (productLower === 'gasolina_comum' || productLower === 'gc') return 'gasolina_comum'
    if (productLower === 'gasolina_aditivada' || productLower === 'ga') return 'gasolina_aditivada'
    if (productLower === 'etanol' || productLower === 'et') return 'etanol'
    return productLower
  }

  // Obter produtos únicos para colunas - ordem específica baseada na aba referências
  // S10, S10 Aditivado, S500, S500 Aditivado, ARLA
  // IMPORTANTE: Usar os valores exatos que são salvos na tabela referencias
  const productOrder = ['s10', 's10_aditivado', 'diesel_s500', 'diesel_s500_aditivado', 'arla32_granel']
  
  // Normalizar produtos nas cotações antes de filtrar
  // Se já tiver produto_normalizado, usar ele; senão, normalizar
  const normalizedCotacoes = sortedCotacoes.map(c => ({
    ...c,
    produto_normalizado: c.produto_normalizado || normalizeProduct(c.produto)
  }))
  
  // Produtos únicos encontrados (para filtro)
  const uniqueProducts = productOrder.filter(product => 
    normalizedCotacoes.some(c => c.produto_normalizado === product)
  )
  
  // Obter postos únicos para linhas
  const uniquePostos = Array.from(new Set(sortedCotacoes.map(c => c.posto_nome))).sort()

  // Agrupar por posto para as linhas (usando produtos normalizados)
  const groupedByPosto = normalizedCotacoes.reduce((acc, cotacao) => {
    if (!acc[cotacao.posto_nome]) {
      acc[cotacao.posto_nome] = []
    }
    acc[cotacao.posto_nome].push(cotacao)
    return acc
  }, {} as Record<string, any[]>)

  // Função para ordenar
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  // Obter data e hora atual
  const getCurrentDateTime = () => {
    const now = new Date()
    return now.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Obter UFs únicas para filtro
  const uniqueUFs = Array.from(new Set(cotacoes.map(c => c.estado || 'Sem UF'))).sort()
  
  // Agrupar por UF (estado) usando produtos normalizados
  const groupedByUF = normalizedCotacoes.reduce((acc, cotacao) => {
    const uf = cotacao.estado || 'Sem UF'
    if (!acc[uf]) {
      acc[uf] = []
    }
    acc[uf].push(cotacao)
    return acc
  }, {} as Record<string, any[]>)

  console.log('🔍 Renderizando QuotationTable:', {
    loading,
    cotacoes: cotacoes.length,
    filteredCotacoes: filteredCotacoes.length,
    uniqueProducts: uniqueProducts.length,
    uniquePostos: uniquePostos.length
  })

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header com data e hora */}
      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
            <Label htmlFor="search">Buscar</Label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="search"
                  placeholder="Posto, cidade ou produto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          
            <div className="space-y-2">
              <Label htmlFor="region">UF</Label>
            <Select value={filterRegion} onValueChange={setFilterRegion}>
              <SelectTrigger>
                  <SelectValue placeholder="Selecione a UF" />
              </SelectTrigger>
              <SelectContent>
                  <SelectItem value="all">Todas as UFs</SelectItem>
                  {uniqueUFs.map(uf => (
                    <SelectItem key={uf} value={uf}>
                      {uf}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
            <div className="space-y-2">
            <Label htmlFor="product">Produto</Label>
            <Select value={filterProduct} onValueChange={setFilterProduct}>
              <SelectTrigger>
                  <SelectValue placeholder="Selecione o produto" />
              </SelectTrigger>
              <SelectContent>
                  <SelectItem value="all">Todos os produtos</SelectItem>
                  {uniqueProducts.map(product => (
                    <SelectItem key={product} value={product}>
                      {product}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
            <div className="space-y-2">
              <Label htmlFor="expired">Status</Label>
              <Select value={showExpired ? 'expired' : 'active'} onValueChange={(value) => setShowExpired(value === 'expired')}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativos</SelectItem>
                  <SelectItem value="expired">Expirados</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Cotações */}
      <Card>
        <CardContent className="p-0">
        {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
              <span className="ml-2 text-gray-600">Carregando cotações...</span>
            </div>
          ) : Object.keys(groupedByPosto).length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <AlertCircle className="h-8 w-8 text-gray-400" />
              <span className="ml-2 text-gray-600">Nenhuma cotação encontrada</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 dark:bg-gray-800">
                    {productOrder.map(product => (
                      <TableHead key={product} className="text-center font-semibold min-w-[200px] p-3">
                        <div className="space-y-2">
                          <div className="text-lg font-bold" style={{ textDecoration: 'none' }}>
                            {product === 's10' ? 'S10' : 
                             product === 's10_aditivado' ? 'S10 Aditivado' :
                             product === 'diesel_s500' ? 'S500' :
                             product === 'diesel_s500_aditivado' ? 'S500 Aditivado' :
                             product === 'arla32_granel' ? 'ARLA 32' :
                             product.toUpperCase()}
                          </div>
                          <div className="text-sm text-gray-600" style={{ textDecoration: 'none' }}>
                            {product === 's10' ? 'S10' : 
                             product === 's10_aditivado' ? 'S10 Aditivado' :
                             product === 'diesel_s500' ? 'S500' :
                             product === 'diesel_s500_aditivado' ? 'S500 Aditivado' :
                             product === 'arla32_granel' ? 'ARLA' :
                             product === 'gasolina_comum' ? 'GC' : 
                             product === 'gasolina_aditivada' ? 'GA' :
                             product === 'etanol' ? 'ET' : product}
                          </div>
                          <div className="flex justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => {
                                if (onSortPrice) {
                                  const newOrder = sortByPrice === 'asc' ? 'desc' : sortByPrice === 'desc' ? null : 'asc'
                                  onSortPrice(newOrder)
                                }
                              }}
                            >
                              {sortByPrice === 'asc' ? <ChevronUp className="h-3 w-3" /> : 
                               sortByPrice === 'desc' ? <ChevronDown className="h-3 w-3" /> : 
                               <div className="h-3 w-3" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => {
                                if (onSortUF) {
                                  const newOrder = sortByUF === 'asc' ? 'desc' : sortByUF === 'desc' ? null : 'asc'
                                  onSortUF(newOrder)
                                }
                              }}
                            >
                              {sortByUF === 'asc' ? <ChevronUp className="h-3 w-3" /> : 
                               sortByUF === 'desc' ? <ChevronDown className="h-3 w-3" /> : 
                               <div className="h-3 w-3" />}
                            </Button>
                          </div>
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
              <TableBody>
                  <TableRow className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    {productOrder.map(product => {
                      return (
                        <TableCell key={product} className="text-left p-3 align-top">
                          <div className="space-y-3">
                            {Object.entries(groupedByUF).map(([uf, ufCotacoes]) => {
                              const productCotacoes = ufCotacoes
                                .filter(c => c.produto_normalizado === product)
                                .sort((a, b) => (a.preco_pesquisa || a.preco_referencia || 0) - (b.preco_pesquisa || b.preco_referencia || 0))
                              
                              if (productCotacoes.length === 0) return null
                              
                              return (
                                <div key={uf} className="space-y-2">
                                  <div className="text-xs font-semibold text-gray-600 uppercase mb-2">
                                    {uf}
                      </div>
                                  {productCotacoes.map(cotacao => (
                                    <div key={cotacao.id} className="flex items-center justify-between py-2 px-1">
                                      <div className="flex items-center gap-3">
                                        <div 
                                          className={`w-4 h-4 rounded-sm flex-shrink-0 ${
                                            cotacao.posto_tipo === 'proprio' 
                                              ? 'bg-blue-500' 
                                              : 'bg-red-500'
                                          }`}
                                          style={{ minWidth: '16px', minHeight: '16px' }}
                                        />
                                        <span className="text-sm font-medium">
                                          {cotacao.posto_nome.toUpperCase()}
                        </span>
                      </div>
                                      <span className="text-sm font-semibold">
                                        R$ {(cotacao.preco_pesquisa || cotacao.preco_referencia || 0).toFixed(4)}
                        </span>
                                    </div>
                                  ))}
                                </div>
                              )
                            })}
                      </div>
                    </TableCell>
                      )
                    })}
                  </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
        </CardContent>
      </Card>
    </div>
  )
}