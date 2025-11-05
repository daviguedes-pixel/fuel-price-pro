import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Get all users from database
    const { data: users, error } = await supabaseAdmin
      .from('user_profiles')
      .select('user_id, email')
      .order('created_at')

    if (error) {
      throw error
    }

    const defaultPassword = 'sr123'
    const results = {
      success: [] as string[],
      errors: [] as string[],
    }

    // Reset password for each user
    for (const user of users || []) {
      try {
        // Update password using Admin API
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
          user.user_id,
          { password: defaultPassword }
        )

        if (updateError) {
          results.errors.push(`${user.email}: ${updateError.message}`)
        } else {
          results.success.push(user.email)
          
          // Mark as temporary password
          await supabaseAdmin
            .from('user_profiles')
            .update({ 
              senha_temporaria: true,
              temporary_password: true,
              updated_at: new Date().toISOString()
            })
            .eq('user_id', user.user_id)
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        results.errors.push(`${user.email}: ${message}`)
      }
    }

    return new Response(
      JSON.stringify({
        message: `Reset de senhas concluído`,
        total: users?.length || 0,
        success: results.success.length,
        errors: results.errors.length,
        details: results
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})

