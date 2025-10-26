import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Buscar todos os usuários do auth
    const { data: { users }, error: authError } = await supabaseClient.auth.admin.listUsers()
    
    if (authError) {
      throw authError
    }

    console.log(`Found ${users.length} users in auth`)

    // Para cada usuário, verificar se já existe em user_profiles
    const syncResults = []
    
    for (const user of users) {
      // Verificar se já existe
      const { data: existingProfile } = await supabaseClient
        .from('user_profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!existingProfile) {
        // Criar novo perfil
        const { error: insertError } = await supabaseClient
          .from('user_profiles')
          .insert({
            user_id: user.id,
            email: user.email,
            nome: user.email?.split('@')[0] || 'Usuário',
            role: 'analista',
            perfil: 'analista_pricing',
            ativo: true
          })

        if (insertError) {
          console.error(`Error creating profile for ${user.email}:`, insertError)
          syncResults.push({ email: user.email, status: 'error', error: insertError.message })
        } else {
          console.log(`Created profile for ${user.email}`)
          syncResults.push({ email: user.email, status: 'created' })
        }
      } else {
        syncResults.push({ email: user.email, status: 'exists' })
      }
    }

    const created = syncResults.filter(r => r.status === 'created').length
    const existing = syncResults.filter(r => r.status === 'exists').length
    const errors = syncResults.filter(r => r.status === 'error').length

    return new Response(
      JSON.stringify({ 
        success: true,
        summary: {
          total: users.length,
          created,
          existing,
          errors
        },
        details: syncResults
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      },
    )
  } catch (error) {
    console.error('Error in sync-auth-users:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      },
    )
  }
})
