import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../shared/cors.ts'
import { createAuthMiddleware, createRateLimitMiddleware } from '../auth-middleware/index.ts'

// Rate limiting: 50 requests per 15 minutes
const rateLimit = createRateLimitMiddleware(50, 15 * 60 * 1000)

// Auth middleware requiring authentication
const authMiddleware = createAuthMiddleware({ 
  requireAuth: true 
})

serve(async (req) => {
  return rateLimit(req, async (req) => {
    return authMiddleware(req, async (req, user, supabase) => {
      try {
        const url = new URL(req.url)
        const path = url.pathname

        switch (path) {
          case '/api/auth/profile':
            return handleGetProfile(req, user, supabase)
          
          case '/api/auth/refresh':
            return handleRefreshToken(req, user, supabase)
          
          case '/api/auth/logout':
            return handleLogout(req, user, supabase)
          
          case '/api/auth/permissions':
            return handleGetPermissions(req, user, supabase)
          
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
        console.error('Auth API error:', error)
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

async function handleGetProfile(req: Request, user: any, supabase: any) {
  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Método não permitido' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 405 
      }
    )
  }

  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (error) {
    return new Response(
      JSON.stringify({ error: 'Erro ao buscar perfil' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }

  return new Response(
    JSON.stringify({ 
      success: true,
      user: {
        id: user.id,
        email: user.email,
        profile: profile
      }
    }),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200 
    }
  )
}

async function handleRefreshToken(req: Request, user: any, supabase: any) {
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Método não permitido' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 405 
      }
    )
  }

  try {
    const { data, error } = await supabase.auth.refreshSession()
    
    if (error) {
      return new Response(
        JSON.stringify({ error: 'Erro ao renovar token' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401 
        }
      )
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        session: data.session
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Erro interno ao renovar token' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
}

async function handleLogout(req: Request, user: any, supabase: any) {
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Método não permitido' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 405 
      }
    )
  }

  try {
    await supabase.auth.signOut()
    
    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Logout realizado com sucesso'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Erro interno ao fazer logout' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
}

async function handleGetPermissions(req: Request, user: any, supabase: any) {
  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Método não permitido' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 405 
      }
    )
  }

  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('role, pode_acessar_solicitacao, pode_acessar_aprovacao, pode_acessar_pesquisa, pode_acessar_mapa, pode_acessar_historico, pode_acessar_admin, pode_acessar_cadastro_referencia, pode_acessar_cadastro_taxas, pode_acessar_cadastro_clientes, pode_acessar_cadastro_postos, pode_aprovar_direto')
    .eq('user_id', user.id)
    .single()

  if (error) {
    return new Response(
      JSON.stringify({ error: 'Erro ao buscar permissões' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }

  return new Response(
    JSON.stringify({ 
      success: true,
      permissions: profile
    }),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200 
    }
  )
}
