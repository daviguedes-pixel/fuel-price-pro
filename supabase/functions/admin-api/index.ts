import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../shared/cors.ts'
import { createAuthMiddleware, createRateLimitMiddleware } from '../auth-middleware/index.ts'

// Rate limiting: 50 requests per 15 minutes (admin endpoints)
const rateLimit = createRateLimitMiddleware(50, 15 * 60 * 1000)

// Auth middleware requiring admin role
const authMiddleware = createAuthMiddleware({ 
  requireAuth: true,
  requireRole: ['admin']
})

serve(async (req) => {
  return rateLimit(req, async (req) => {
    return authMiddleware(req, async (req, user, supabase) => {
      try {
        const url = new URL(req.url)
        const path = url.pathname

        switch (path) {
          case '/api/admin/users':
            return handleUsers(req, user, supabase)
          
          case '/api/admin/audit-logs':
            return handleAuditLogs(req, user, supabase)
          
          case '/api/admin/security-events':
            return handleSecurityEvents(req, user, supabase)
          
          case '/api/admin/system-stats':
            return handleSystemStats(req, user, supabase)
          
          case '/api/admin/backup':
            return handleBackup(req, user, supabase)
          
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
        console.error('Admin API error:', error)
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

async function handleUsers(req: Request, user: any, supabase: any) {
  if (req.method === 'GET') {
    // Get all users with profiles
    const { data, error } = await supabase
      .from('user_profiles')
      .select(`
        *,
        auth_users(email, created_at, last_sign_in_at)
      `)
      .order('created_at', { ascending: false })

    if (error) {
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar usuários' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        }
      )
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        users: data
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )
  }

  if (req.method === 'PUT') {
    // Update user profile
    const body = await req.json()
    const { user_id, ...updateData } = body

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'user_id é obrigatório' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      )
    }

    const { data, error } = await supabase
      .from('user_profiles')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user_id)
      .select()
      .single()

    if (error) {
      return new Response(
        JSON.stringify({ error: 'Erro ao atualizar usuário' }),
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
        action: 'update_user_profile',
        resource: 'user_profiles',
        details: { target_user_id: user_id, changes: updateData }
      })

    return new Response(
      JSON.stringify({ 
        success: true,
        user: data
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )
  }

  return new Response(
    JSON.stringify({ error: 'Método não permitido' }),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405 
    }
  )
}

async function handleAuditLogs(req: Request, user: any, supabase: any) {
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
  const action = url.searchParams.get('action')
  const userId = url.searchParams.get('user_id')
  const limit = parseInt(url.searchParams.get('limit') || '100')
  const offset = parseInt(url.searchParams.get('offset') || '0')

  let query = supabase
    .from('security_audit_log')
    .select(`
      *,
      user_profiles(nome, email)
    `)
    .order('created_at', { ascending: false })
    .range(offset, offset + Math.min(limit, 200) - 1)

  if (action) {
    query = query.eq('action', action)
  }

  if (userId) {
    query = query.eq('user_id', userId)
  }

  const { data, error } = await query

  if (error) {
    return new Response(
      JSON.stringify({ error: 'Erro ao buscar logs de auditoria' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }

  return new Response(
    JSON.stringify({ 
      success: true,
      audit_logs: data
    }),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200 
    }
  )
}

async function handleSecurityEvents(req: Request, user: any, supabase: any) {
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
  const severity = url.searchParams.get('severity')
  const limit = parseInt(url.searchParams.get('limit') || '50')

  let query = supabase
    .from('security_events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(Math.min(limit, 100))

  if (severity) {
    query = query.eq('severity', severity)
  }

  const { data, error } = await query

  if (error) {
    return new Response(
      JSON.stringify({ error: 'Erro ao buscar eventos de segurança' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }

  return new Response(
    JSON.stringify({ 
      success: true,
      security_events: data
    }),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200 
    }
  )
}

async function handleSystemStats(req: Request, user: any, supabase: any) {
  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Método não permitido' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 405 
      }
    )
  }

  try {
    // Get various statistics
    const [
      { count: totalUsers },
      { count: activeUsers },
      { count: totalSuggestions },
      { count: pendingSuggestions },
      { count: totalResearch },
      { count: totalAuditLogs }
    ] = await Promise.all([
      supabase.from('user_profiles').select('*', { count: 'exact', head: true }),
      supabase.from('user_profiles').select('*', { count: 'exact', head: true }).eq('ativo', true),
      supabase.from('price_suggestions').select('*', { count: 'exact', head: true }),
      supabase.from('price_suggestions').select('*', { count: 'exact', head: true }).eq('status', 'em_analise'),
      supabase.from('competitor_research').select('*', { count: 'exact', head: true }),
      supabase.from('security_audit_log').select('*', { count: 'exact', head: true })
    ])

    // Get recent activity
    const { data: recentActivity } = await supabase
      .from('security_audit_log')
      .select('action, created_at')
      .order('created_at', { ascending: false })
      .limit(10)

    return new Response(
      JSON.stringify({ 
        success: true,
        stats: {
          users: {
            total: totalUsers || 0,
            active: activeUsers || 0
          },
          suggestions: {
            total: totalSuggestions || 0,
            pending: pendingSuggestions || 0
          },
          research: {
            total: totalResearch || 0
          },
          security: {
            total_audit_logs: totalAuditLogs || 0,
            recent_activity: recentActivity || []
          }
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Erro ao buscar estatísticas do sistema' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
}

async function handleBackup(req: Request, user: any, supabase: any) {
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
  const { tables } = body

  if (!tables || !Array.isArray(tables)) {
    return new Response(
      JSON.stringify({ error: 'Lista de tabelas é obrigatória' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }

  try {
    const backupData: any = {}

    for (const table of tables) {
      const { data, error } = await supabase
        .from(table)
        .select('*')

      if (error) {
        console.error(`Erro ao fazer backup da tabela ${table}:`, error)
        backupData[table] = { error: error.message }
      } else {
        backupData[table] = data
      }
    }

    // Log security event
    await supabase
      .from('security_audit_log')
      .insert({
        user_id: user.id,
        action: 'create_backup',
        resource: 'system',
        details: { tables }
      })

    return new Response(
      JSON.stringify({ 
        success: true,
        backup: backupData,
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Erro ao criar backup' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
}
