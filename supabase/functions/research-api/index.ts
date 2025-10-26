import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../shared/cors.ts'
import { createAuthMiddleware, createRateLimitMiddleware } from '../auth-middleware/index.ts'

// Rate limiting: 200 requests per 15 minutes
const rateLimit = createRateLimitMiddleware(200, 15 * 60 * 1000)

// Auth middleware requiring authentication and research permission
const authMiddleware = createAuthMiddleware({ 
  requireAuth: true,
  requirePermission: ['pode_acessar_pesquisa']
})

serve(async (req) => {
  return rateLimit(req, async (req) => {
    return authMiddleware(req, async (req, user, supabase) => {
      try {
        const url = new URL(req.url)
        const path = url.pathname

        switch (path) {
          case '/api/research/competitors':
            return handleCompetitors(req, user, supabase)
          
          case '/api/research/submit':
            return handleSubmitResearch(req, user, supabase)
          
          case '/api/research/history':
            return handleResearchHistory(req, user, supabase)
          
          case '/api/research/stations':
            return handleStations(req, user, supabase)
          
          default:
            return new Response(
              JSON.stringify({ error: 'Endpoint não encontrado' }),
              { 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 404 
              }
            )
        }
      } catch (error) {
        console.error('Research API error:', error)
        return new Response(
          JSON.stringify({ error: 'Erro interno do servidor' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500 
          }
        )
      }
    })
  })
})

async function handleCompetitors(req: Request, user: any, supabase: any) {
  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Método não permitido' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 405 
      }
    )
  }

  const url = new URL(req.url)
  const query = url.searchParams.get('q')
  const limit = parseInt(url.searchParams.get('limit') || '20')

  let competitorQuery = supabase
    .from('concorrentes')
    .select('*')
    .limit(Math.min(limit, 50))

  if (query && query.length >= 2) {
    competitorQuery = competitorQuery.or(`razao_social.ilike.%${query}%,nome_empresa.ilike.%${query}%,municipio.ilike.%${query}%`)
  }

  const { data: competitors, error: competitorError } = await competitorQuery

  if (competitorError) {
    return new Response(
      JSON.stringify({ error: 'Erro ao buscar concorrentes' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }

  // Also get own stations
  const { data: ownStations, error: stationError } = await supabase
    .rpc('get_sis_empresa_stations')

  if (stationError) {
    console.warn('Erro ao buscar postos próprios:', stationError)
  }

  const formattedCompetitors = (competitors || []).map((comp: any) => ({
    id: comp.id || comp.cnpj_cpf,
    name: comp.razao_social || comp.nome_empresa,
    address: `${comp.endereco || ''} ${comp.municipio || ''}, ${comp.uf || ''}`.trim(),
    type: 'competitor',
    network: comp.rede,
    brand: comp.bandeira,
    latitude: comp.latitude,
    longitude: comp.longitude
  }))

  const formattedOwnStations = (ownStations || []).map((station: any) => ({
    id: station.id,
    name: station.nome_empresa,
    address: `${station.municipio || ''}, ${station.uf || ''}`.trim(),
    type: 'own',
    network: station.rede,
    brand: station.bandeira,
    latitude: station.latitude,
    longitude: station.longitude
  }))

  return new Response(
    JSON.stringify({ 
      success: true,
      competitors: formattedCompetitors,
      own_stations: formattedOwnStations
    }),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200 
    }
  )
}

async function handleSubmitResearch(req: Request, user: any, supabase: any) {
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Método não permitido' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 405 
      }
    )
  }

  const body = await req.json()
  
  // Validate required fields
  const requiredFields = ['station_id', 'competitor_station_id', 'product', 'price', 'proof_type']
  for (const field of requiredFields) {
    if (!body[field]) {
      return new Response(
        JSON.stringify({ error: `Campo obrigatório: ${field}` }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      )
    }
  }

  // Validate price
  if (body.price <= 0) {
    return new Response(
      JSON.stringify({ error: 'Preço deve ser maior que zero' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }

  // Validate proof type
  if (!['placa', 'bomba', 'nf'].includes(body.proof_type)) {
    return new Response(
      JSON.stringify({ error: 'Tipo de prova deve ser: placa, bomba ou nf' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }

  const { data, error } = await supabase
    .from('competitor_research')
    .insert({
      usuario_id: user.id,
      posto_id: body.station_id,
      posto_concorrente_id: body.competitor_station_id,
      tipo_prova: body.proof_type,
      produto: body.product,
      preco: body.price,
      imagem_url: body.image_url,
      data_pesquisa: body.research_date || new Date().toISOString().split('T')[0],
      horario: body.research_time || new Date().toTimeString().split(' ')[0]
    })
    .select()
    .single()

  if (error) {
    return new Response(
      JSON.stringify({ error: 'Erro ao salvar pesquisa' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }

  // Log security event
  await supabase
    .from('security_audit_log')
    .insert({
      user_id: user.id,
      action: 'submit_research',
      resource: 'competitor_research',
      details: { research_id: data.id }
    })

  return new Response(
    JSON.stringify({ 
      success: true,
      research: data
    }),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 201 
    }
  )
}

async function handleResearchHistory(req: Request, user: any, supabase: any) {
  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Método não permitido' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 405 
      }
    )
  }

  const url = new URL(req.url)
  const stationId = url.searchParams.get('station_id')
  const product = url.searchParams.get('product')
  const limit = parseInt(url.searchParams.get('limit') || '50')

  let query = supabase
    .from('competitor_research')
    .select(`
      *,
      stations(name),
      concorrentes(razao_social, nome_empresa)
    `)
    .eq('usuario_id', user.id)
    .order('created_at', { ascending: false })
    .limit(Math.min(limit, 100))

  if (stationId) {
    query = query.eq('posto_id', stationId)
  }

  if (product) {
    query = query.eq('produto', product)
  }

  const { data, error } = await query

  if (error) {
    return new Response(
      JSON.stringify({ error: 'Erro ao buscar histórico de pesquisas' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }

  return new Response(
    JSON.stringify({ 
      success: true,
      research_history: data
    }),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200 
    }
  )
}

async function handleStations(req: Request, user: any, supabase: any) {
  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Método não permitido' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 405 
      }
    )
  }

  const url = new URL(req.url)
  const query = url.searchParams.get('q')
  const limit = parseInt(url.searchParams.get('limit') || '20')

  // Get own stations
  const { data: ownStations, error: stationError } = await supabase
    .rpc('get_sis_empresa_stations')

  if (stationError) {
    return new Response(
      JSON.stringify({ error: 'Erro ao buscar postos' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }

  let filteredStations = ownStations || []

  if (query && query.length >= 2) {
    filteredStations = filteredStations.filter((station: any) =>
      station.nome_empresa?.toLowerCase().includes(query.toLowerCase()) ||
      station.municipio?.toLowerCase().includes(query.toLowerCase()) ||
      station.uf?.toLowerCase().includes(query.toLowerCase())
    )
  }

  const formattedStations = filteredStations
    .slice(0, Math.min(limit, 50))
    .map((station: any) => ({
      id: station.id,
      name: station.nome_empresa,
      address: `${station.municipio || ''}, ${station.uf || ''}`.trim(),
      network: station.rede,
      brand: station.bandeira,
      latitude: station.latitude,
      longitude: station.longitude
    }))

  return new Response(
    JSON.stringify({ 
      success: true,
      stations: formattedStations
    }),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200 
    }
  )
}
