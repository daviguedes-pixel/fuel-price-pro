import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Função para converter formato brasileiro (vírgula) para internacional (ponto)
export function parseBrazilianDecimal(value: string | number): number {
  if (typeof value === 'number') return value;
  
  // Remove espaços e converte vírgula para ponto
  const cleanValue = value.toString().trim().replace(',', '.');
  
  // Converte para número
  const parsed = parseFloat(cleanValue);
  
  // Retorna NaN se não conseguir converter
  return isNaN(parsed) ? 0 : parsed;
}

// Função para formatar número para exibição brasileira
export function formatBrazilianCurrency(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

// Função para converter número inteiro (centavos) para formato de exibição com vírgula fixa
// Ex: 350 -> "3,50", 100 -> "1,00"
export function formatIntegerToPrice(integerValue: string | number): string {
  if (!integerValue && integerValue !== 0) return '';
  const num = typeof integerValue === 'string' ? parseInt(integerValue.replace(/\D/g, ''), 10) : integerValue;
  if (isNaN(num)) return '';
  const reais = Math.floor(num / 100);
  const centavos = num % 100;
  return `${reais},${centavos.toString().padStart(2, '0')}`;
}

// Função para converter formato de exibição (com vírgula) para número inteiro (centavos)
// Ex: "3,50" -> 350, "1,00" -> 100
export function parsePriceToInteger(priceString: string): number {
  if (!priceString) return 0;
  // Remove tudo exceto números
  const cleanValue = priceString.replace(/\D/g, '');
  return parseInt(cleanValue, 10) || 0;
}

// Função para gerar UUID v4 compatível (funciona em todos os ambientes)
export function generateUUID(): string {
  // Verificar se crypto.randomUUID está disponível (navegadores modernos)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback: gerar UUID v4 manualmente
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Função helper para criar notificações
export async function createNotification(
  userId: string,
  type: 'rate_expiry' | 'approval_pending' | 'price_approved' | 'price_rejected' | 'system' | 'competitor_update' | 'client_update',
  title: string,
  message: string,
  data?: Record<string, any>,
  expiresAt?: Date
) {
  const { supabase } = await import('@/integrations/supabase/client');
  
  const notificationData: any = {
    user_id: userId,
    type,
    title,
    message,
    read: false
  };

  // Adicionar suggestion_id se estiver nos dados (pode ser obrigatório na tabela)
  if (data?.suggestion_id) {
    notificationData.suggestion_id = data.suggestion_id;
  } else {
    // Se suggestion_id não foi fornecido mas pode ser obrigatório, usar um UUID vazio ou null
    // Mas primeiro vamos tentar sem ele e ver se dá erro
    console.warn('⚠️ suggestion_id não fornecido nos dados da notificação');
  }

  if (data) {
    notificationData.data = data;
  }

  if (expiresAt) {
    notificationData.expires_at = expiresAt.toISOString();
  }

  console.log('📝 Inserindo notificação no banco:', {
    user_id: userId,
    type,
    title,
    message,
    data,
    notificationData
  });

  // Verificar se suggestion_id é obrigatório tentando inserir primeiro
  let insertedData: any = null;
  let error: any = null;
  
  try {
    const result = await supabase
      .from('notifications')
      .insert([notificationData])
      .select();
    
    insertedData = result.data;
    error = result.error;
  } catch (err: any) {
    error = err;
  }

  if (error) {
    console.error('❌ Erro ao criar notificação:', {
      error,
      errorCode: error.code,
      errorMessage: error.message,
      errorDetails: error.details,
      errorHint: error.hint,
      notificationData
    });
    
    // Se o erro for sobre suggestion_id obrigatório (23502 = not null violation)
    if ((error.message?.includes('suggestion_id') || error.code === '23502') && !notificationData.suggestion_id) {
      console.log('⚠️ suggestion_id é obrigatório mas não foi fornecido. Gerando UUID temporário...');
      
      // Gerar UUID temporário para suggestion_id (não ideal, mas necessário se a tabela exige)
      notificationData.suggestion_id = generateUUID();
      
      const retryResult = await supabase
        .from('notifications')
        .insert([notificationData])
        .select();
      
      if (retryResult.error) {
        console.error('❌ Erro ao criar notificação (retry com suggestion_id):', retryResult.error);
        throw retryResult.error;
      }
      
      insertedData = retryResult.data;
      console.log('✅ Notificação inserida no banco (com suggestion_id gerado):', insertedData);
    } else {
      throw error;
    }
  } else {
    console.log('✅ Notificação inserida no banco:', {
      insertedData,
      userId,
      title,
      notificationId: insertedData?.[0]?.id,
      user_id: insertedData?.[0]?.user_id
    });
  }
  
  // Verificar se a notificação foi realmente criada e é visível para o usuário
  if (insertedData?.[0]?.id) {
    // Aguardar um pouco para garantir que a transação foi commitada
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const { data: verifyData, error: verifyError } = await supabase
      .from('notifications')
      .select('*')
      .eq('id', insertedData[0].id)
      .single();
    
    if (verifyError) {
      console.error('⚠️ Notificação criada mas não encontrada na verificação:', {
        error: verifyError,
        notificationId: insertedData[0].id,
        userId,
        possibleRLSIssue: verifyError.code === 'PGRST301' || verifyError.message?.includes('RLS')
      });
    } else {
      console.log('✅ Notificação verificada no banco:', {
        id: verifyData?.id,
        user_id: verifyData?.user_id,
        userId,
        match: verifyData?.user_id === userId,
        read: verifyData?.read,
        title: verifyData?.title
      });
      
      // Se o user_id não corresponde, há um problema
      if (verifyData?.user_id !== userId) {
        console.error('❌ PROBLEMA CRÍTICO: user_id da notificação não corresponde!', {
          expectedUserId: userId,
          actualUserId: verifyData?.user_id,
          notificationId: verifyData?.id
        });
      }
    }
  }

  // Enviar notificação push também
  try {
    const { sendPushNotification } = await import('@/lib/pushNotification');
    await sendPushNotification(userId, {
      title,
      body: message,
      data: data || {},
      url: data?.url || '/dashboard',
      tag: type
    });
  } catch (pushError) {
    // Não falhar se push não funcionar
    console.warn('Aviso: Não foi possível enviar push notification:', pushError);
  }

  return true;
}

// Função helper para criar notificações para múltiplos usuários
export async function createNotificationForUsers(
  userIds: string[],
  type: 'rate_expiry' | 'approval_pending' | 'price_approved' | 'price_rejected' | 'system' | 'competitor_update' | 'client_update',
  title: string,
  message: string,
  data?: Record<string, any>
) {
  const { supabase } = await import('@/integrations/supabase/client');
  
  const notifications = userIds.map(userId => ({
    user_id: userId,
    type,
    title,
    message,
    read: false,
    ...(data && { data })
  }));

  const { error } = await supabase
    .from('notifications')
    .insert(notifications);

  if (error) {
    console.error('Erro ao criar notificações:', error);
    throw error;
  }

  // Enviar notificações push também
  try {
    const { sendPushNotificationToUsers } = await import('@/lib/pushNotification');
    await sendPushNotificationToUsers(userIds, {
      title,
      body: message,
      data: data || {},
      url: data?.url || '/dashboard',
      tag: type
    });
  } catch (pushError) {
    // Não falhar se push não funcionar
    console.warn('Aviso: Não foi possível enviar push notifications:', pushError);
  }

  return true;
}