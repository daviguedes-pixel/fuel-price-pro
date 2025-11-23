// Edge Function para enviar notificações push via Firebase Cloud Messaging V1 API
// IMPORTANTE: Configure FIREBASE_SERVICE_ACCOUNT_JSON no Supabase Dashboard > Edge Functions > Settings
// O Service Account JSON não expira e gera tokens automaticamente!

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from '../shared/cors.ts';

const FCM_V1_ENDPOINT = 'https://fcm.googleapis.com/v1/projects/notifica-6e935/messages:send';

// Cache do Access Token (expira em 1 hora, mas será renovado automaticamente)
let cachedAccessToken: string | null = null;
let tokenExpiry: number = 0;

// Função para obter Access Token do Service Account JSON (renovação automática)
async function getAccessToken(): Promise<string> {
  // Verificar se o token em cache ainda é válido (renovar 5 minutos antes de expirar)
  const now = Date.now();
  if (cachedAccessToken && tokenExpiry > now + 5 * 60 * 1000) {
    console.log('✅ Usando Access Token do cache');
    return cachedAccessToken;
  }

  try {
    // Obter Service Account JSON (PRIORIDADE 1)
    const serviceAccountJson = Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON');
    
    console.log('🔍 Verificando configuração...');
    console.log('   FIREBASE_SERVICE_ACCOUNT_JSON:', serviceAccountJson ? `✅ Configurado (${serviceAccountJson.length} caracteres)` : '❌ Não configurado');
    
    if (!serviceAccountJson) {
      // Fallback: tentar usar Access Token direto (se configurado)
      const directToken = Deno.env.get('FIREBASE_ACCESS_TOKEN');
      console.log('   FIREBASE_ACCESS_TOKEN:', directToken ? `⚠️ Configurado (usando como fallback)` : '❌ Não configurado');
      
      if (directToken) {
        console.log('⚠️ Usando FIREBASE_ACCESS_TOKEN direto (pode expirar)');
        console.log('💡 RECOMENDAÇÃO: Configure FIREBASE_SERVICE_ACCOUNT_JSON para renovação automática');
        return directToken;
      }
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON não configurado');
    }

    // Validar se o JSON é válido
    let serviceAccount: any;
    try {
      serviceAccount = JSON.parse(serviceAccountJson);
      console.log('✅ Service Account JSON parseado com sucesso');
      console.log('   Client Email:', serviceAccount.client_email || 'não encontrado');
      console.log('   Project ID:', serviceAccount.project_id || 'não encontrado');
    } catch (parseError: any) {
      console.error('❌ Erro ao fazer parse do Service Account JSON:', parseError.message);
      throw new Error(`Service Account JSON inválido: ${parseError.message}`);
    }

    // Validar campos obrigatórios
    if (!serviceAccount.client_email || !serviceAccount.private_key) {
      console.error('❌ Service Account JSON está incompleto');
      console.error('   Campos obrigatórios: client_email, private_key');
      throw new Error('Service Account JSON está incompleto (faltam client_email ou private_key)');
    }

    console.log('🔑 Gerando novo Access Token do Service Account...');

    // Criar JWT para autenticação
    const jwt = await createJWT(serviceAccount);
    
    // Trocar JWT por Access Token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      throw new Error(`Erro ao obter Access Token: ${error}`);
    }

    const tokenData = await tokenResponse.json();
    cachedAccessToken = tokenData.access_token;
    tokenExpiry = now + (tokenData.expires_in * 1000); // expires_in está em segundos
    
    console.log('✅ Access Token obtido e cacheado (válido por 1 hora)');
    return cachedAccessToken;
  } catch (error) {
    console.error('❌ Erro ao obter Access Token:', error);
    throw error;
  }
}

// Função para criar JWT do Service Account
async function createJWT(serviceAccount: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  
  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };

  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600, // Expira em 1 hora
    iat: now,
  };

  // Codificar header e payload em base64url
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signatureInput = `${encodedHeader}.${encodedPayload}`;

  // Importar chave privada
  const privateKeyPem = serviceAccount.private_key
    .replace(/\\n/g, '\n');

  // Converter PEM para ArrayBuffer
  const pemHeader = '-----BEGIN PRIVATE KEY-----';
  const pemFooter = '-----END PRIVATE KEY-----';
  const pemContents = privateKeyPem
    .replace(pemHeader, '')
    .replace(pemFooter, '')
    .replace(/\s/g, '');
  
  const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

  // Importar chave usando Web Crypto API
  const key = await crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  );

  // Assinar
  const signature = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    key,
    new TextEncoder().encode(signatureInput)
  );

  // Codificar assinatura em base64url
  const encodedSignature = base64UrlEncode(
    String.fromCharCode(...new Uint8Array(signature))
  );

  return `${signatureInput}.${encodedSignature}`;
}

// Função auxiliar para base64url
function base64UrlEncode(str: string): string {
  return btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

interface PushRequest {
  token: string;
  notification: {
    title: string;
    body: string;
    icon?: string;
    badge?: string;
  };
  data?: Record<string, any>;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Obter dados da requisição
    const body: PushRequest = await req.json();
    const { token, notification, data } = body;

    // Validações
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Token FCM é obrigatório' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!notification || !notification.title || !notification.body) {
      return new Response(
        JSON.stringify({ error: 'Título e corpo da notificação são obrigatórios' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Obter Access Token do Firebase (renovação automática se usar Service Account)
    let accessToken: string;
    try {
      console.log('🔑 Obtendo Access Token...');
      accessToken = await getAccessToken();
      console.log('✅ Access Token obtido:', accessToken.substring(0, 20) + '...');
    } catch (error: any) {
      console.error('❌❌❌ ERRO AO OBTER ACCESS TOKEN ❌❌❌');
      console.error('📋 Erro completo:', error);
      console.error('📋 Mensagem:', error.message);
      console.error('📋 Stack:', error.stack);
      
      const errorMessage = error.message || String(error);
      const hasServiceAccount = !!Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON');
      const hasAccessToken = !!Deno.env.get('FIREBASE_ACCESS_TOKEN');
      
      console.error('📋 Configuração encontrada:');
      console.error('   FIREBASE_SERVICE_ACCOUNT_JSON:', hasServiceAccount ? '✅' : '❌');
      console.error('   FIREBASE_ACCESS_TOKEN:', hasAccessToken ? '✅' : '❌');
      
      return new Response(
        JSON.stringify({ 
          error: 'Erro ao obter Access Token do Firebase',
          hint: hasServiceAccount 
            ? 'FIREBASE_SERVICE_ACCOUNT_JSON está configurado, mas há erro ao gerar token. Verifique o JSON.'
            : 'Configure FIREBASE_SERVICE_ACCOUNT_JSON no Supabase Dashboard > Edge Functions > Settings > Secrets',
          alternative: hasAccessToken 
            ? 'FIREBASE_ACCESS_TOKEN está configurado, mas pode ter expirado. Gere um novo.'
            : 'Ou configure FIREBASE_ACCESS_TOKEN (mas expira em 1 hora)',
          details: errorMessage,
          config_status: {
            has_service_account: hasServiceAccount,
            has_access_token: hasAccessToken
          }
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('📤 Enviando push notification via FCM V1 API');
    console.log('📋 Token FCM:', token.substring(0, 30) + '...');
    console.log('📋 Título:', notification.title);
    console.log('📋 Corpo:', notification.body);

    // Enviar via FCM V1 API (recomendado)
    const fcmResponse = await fetch(FCM_V1_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          token: token,
          notification: {
            title: notification.title,
            body: notification.body,
          },
          data: {
            title: notification.title,
            body: notification.body,
            ...data,
            url: data?.url || '/dashboard',
            tag: data?.tag || 'notification',
          },
          webpush: {
            notification: {
              title: notification.title,
              body: notification.body,
              icon: notification.icon || '/favicon.ico',
              badge: notification.badge || '/favicon.ico',
            },
            fcm_options: {
              link: data?.url || '/dashboard'
            }
          }
        }
      }),
    });

    if (!fcmResponse.ok) {
      const errorText = await fcmResponse.text();
      console.error('❌ Erro ao enviar push!');
      console.error('📋 Status:', fcmResponse.status);
      console.error('📋 Resposta completa:', errorText);
      
      // Tentar parsear como JSON para ver detalhes
      try {
        const errorJson = JSON.parse(errorText);
        console.error('📋 Erro detalhado:', JSON.stringify(errorJson, null, 2));
      } catch {
        // Não é JSON, apenas texto
      }
      
      return new Response(
        JSON.stringify({ 
          error: 'Erro ao enviar notificação push',
          details: errorText,
          status: fcmResponse.status
        }),
        { 
          status: fcmResponse.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const result = await fcmResponse.json();
    console.log('✅ Push enviado com sucesso!');
    console.log('📋 Resposta completa do FCM:', JSON.stringify(result, null, 2));

    // FCM V1 API retorna 'name' como messageId
    const messageId = result.name || result.message_id || 'unknown';
    console.log('📝 Message ID:', messageId);
    console.log('💡 Se a notificação não apareceu no navegador, verifique:');
    console.log('   1. Permissões do navegador estão ativas?');
    console.log('   2. Service Worker está recebendo mensagens?');
    console.log('   3. Token FCM ainda é válido?');

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageId: messageId,
        result 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('❌ Erro ao processar requisição:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Erro desconhecido',
        details: error.stack 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

