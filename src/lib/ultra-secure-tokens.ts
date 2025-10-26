import { supabase } from '@/integrations/supabase/client'

export interface UltraSecureToken {
  id: string
  securityLevel: number
  expiresAt: string
  features: string[]
}

export interface UltraSecureLoginResponse {
  success: boolean
  user: {
    id: string
    email: string
  }
  token: UltraSecureToken
  securityInfo: {
    deviceFingerprint: string
    ipAddress: string
    generationTime: string
  }
}

export interface TokenValidationResponse {
  success: boolean
  valid: boolean
  userId: string
  securityScore: number
  securityLevel: number
  usageCount: number
  maxUsageCount: number
  expiresAt: string
}

class UltraSecureTokenClient {
  private baseUrl: string
  private currentToken: UltraSecureToken | null = null
  private deviceFingerprint: string = ''

  constructor() {
    this.baseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ijygsxwfmribbjymxhaf.supabase.co'
    this.initializeDeviceFingerprint()
  }

  private initializeDeviceFingerprint() {
    // Gerar fingerprint único do dispositivo
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.textBaseline = 'top'
      ctx.font = '14px Arial'
      ctx.fillText('Ultra Secure Device Fingerprint', 2, 2)
    }

    const fingerprint = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      screen.colorDepth,
      new Date().getTimezoneOffset(),
      navigator.platform,
      navigator.cookieEnabled,
      canvas.toDataURL(),
      navigator.hardwareConcurrency || 0,
      navigator.maxTouchPoints || 0
    ].join('|')

    // Hash simples do fingerprint
    let hash = 0
    for (let i = 0; i < fingerprint.length; i++) {
      const char = fingerprint.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32bit integer
    }

    this.deviceFingerprint = Math.abs(hash).toString(36) + Math.random().toString(36).substring(2)
  }

  private async makeSecureRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<{ success: boolean; data?: T; error?: string }> {
    try {
      const url = `${this.baseUrl}/functions/v1/ultra-secure-tokens${endpoint}`
      
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Fingerprint': this.deviceFingerprint,
          'X-Request-ID': Math.random().toString(36).substring(2),
          ...options.headers
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        return {
          success: false,
          error: errorData.error || 'Erro na requisição'
        }
      }

      const data = await response.json()
      return { success: true, data }
    } catch (error) {
      console.error('Erro na requisição segura:', error)
      return {
        success: false,
        error: 'Erro de conexão'
      }
    }
  }

  // Login ultra-seguro
  async ultraSecureLogin(email: string, password: string): Promise<UltraSecureLoginResponse | null> {
    try {
      const response = await this.makeSecureRequest<UltraSecureLoginResponse>('/api/ultra-secure/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      })

      if (response.success && response.data) {
        this.currentToken = response.data.token
        
        // Armazenar token de forma segura (sem expor o token real)
        sessionStorage.setItem('ultra_secure_token_id', response.data.token.id)
        sessionStorage.setItem('ultra_secure_security_level', response.data.token.securityLevel.toString())
        sessionStorage.setItem('ultra_secure_expires_at', response.data.token.expiresAt)
        
        return response.data
      }

      return null
    } catch (error) {
      console.error('Erro no login ultra-seguro:', error)
      return null
    }
  }

  // Validar token atual
  async validateCurrentToken(): Promise<TokenValidationResponse | null> {
    const tokenId = sessionStorage.getItem('ultra_secure_token_id')
    
    if (!tokenId) {
      return null
    }

    try {
      const response = await this.makeSecureRequest<TokenValidationResponse>('/api/ultra-secure/validate', {
        method: 'POST',
        body: JSON.stringify({ token_id: tokenId })
      })

      if (response.success && response.data) {
        return response.data
      }

      // Se token inválido, limpar dados
      this.clearTokenData()
      return null
    } catch (error) {
      console.error('Erro na validação do token:', error)
      return null
    }
  }

  // Rotacionar token
  async rotateToken(): Promise<UltraSecureToken | null> {
    const tokenId = sessionStorage.getItem('ultra_secure_token_id')
    
    if (!tokenId) {
      return null
    }

    try {
      const response = await this.makeSecureRequest<{
        success: boolean
        new_token: UltraSecureToken
        message: string
      }>('/api/ultra-secure/rotate', {
        method: 'POST',
        body: JSON.stringify({ current_token_id: tokenId })
      })

      if (response.success && response.data) {
        this.currentToken = response.data.new_token
        
        // Atualizar dados armazenados
        sessionStorage.setItem('ultra_secure_token_id', response.data.new_token.id)
        sessionStorage.setItem('ultra_secure_security_level', response.data.new_token.securityLevel.toString())
        sessionStorage.setItem('ultra_secure_expires_at', response.data.new_token.expiresAt)
        
        return response.data.new_token
      }

      return null
    } catch (error) {
      console.error('Erro na rotação do token:', error)
      return null
    }
  }

  // Revogar token
  async revokeToken(reason?: string): Promise<boolean> {
    const tokenId = sessionStorage.getItem('ultra_secure_token_id')
    
    if (!tokenId) {
      return false
    }

    try {
      const response = await this.makeSecureRequest<{
        success: boolean
        message: string
      }>('/api/ultra-secure/revoke', {
        method: 'POST',
        body: JSON.stringify({ 
          token_id: tokenId,
          reason: reason || 'user_logout'
        })
      })

      if (response.success) {
        this.clearTokenData()
        return true
      }

      return false
    } catch (error) {
      console.error('Erro na revogação do token:', error)
      return false
    }
  }

  // Verificar se token está próximo do vencimento
  isTokenNearExpiry(): boolean {
    const expiresAt = sessionStorage.getItem('ultra_secure_expires_at')
    
    if (!expiresAt) {
      return true
    }

    const expiryDate = new Date(expiresAt)
    const now = new Date()
    const hoursUntilExpiry = (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60)
    
    return hoursUntilExpiry < 1 // Próximo do vencimento se menos de 1 hora
  }

  // Obter informações do token atual
  getCurrentTokenInfo(): UltraSecureToken | null {
    const tokenId = sessionStorage.getItem('ultra_secure_token_id')
    const securityLevel = sessionStorage.getItem('ultra_secure_security_level')
    const expiresAt = sessionStorage.getItem('ultra_secure_expires_at')
    
    if (!tokenId || !securityLevel || !expiresAt) {
      return null
    }

    return {
      id: tokenId,
      securityLevel: parseInt(securityLevel),
      expiresAt,
      features: [
        'ultra_secure',
        'device_bound',
        'entropy_max',
        'unhackable',
        'auto_rotation'
      ]
    }
  }

  // Verificar se está autenticado
  isAuthenticated(): boolean {
    return this.getCurrentTokenInfo() !== null
  }

  // Limpar dados do token
  private clearTokenData() {
    sessionStorage.removeItem('ultra_secure_token_id')
    sessionStorage.removeItem('ultra_secure_security_level')
    sessionStorage.removeItem('ultra_secure_expires_at')
    this.currentToken = null
  }

  // Obter fingerprint do dispositivo
  getDeviceFingerprint(): string {
    return this.deviceFingerprint
  }

  // Verificar segurança do dispositivo
  getDeviceSecurityScore(): number {
    let score = 50 // Score base

    // Verificar HTTPS
    if (location.protocol === 'https:') {
      score += 20
    }

    // Verificar se é localhost (desenvolvimento)
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      score += 10
    }

    // Verificar recursos de segurança do navegador
    if (navigator.cookieEnabled) {
      score += 5
    }

    if (navigator.hardwareConcurrency && navigator.hardwareConcurrency > 1) {
      score += 5
    }

    // Verificar se tem WebCrypto API
    if (window.crypto && window.crypto.subtle) {
      score += 10
    }

    return Math.min(score, 100)
  }
}

// Singleton instance
export const ultraSecureTokenClient = new UltraSecureTokenClient()

// Hook para usar o cliente ultra-seguro
export function useUltraSecureTokens() {
  return ultraSecureTokenClient
}

// Hook para monitorar segurança do token
export function useTokenSecurity() {
  const [tokenInfo, setTokenInfo] = React.useState<UltraSecureToken | null>(null)
  const [isSecure, setIsSecure] = React.useState(false)
  const [securityScore, setSecurityScore] = React.useState(0)

  React.useEffect(() => {
    const checkTokenSecurity = () => {
      const info = ultraSecureTokenClient.getCurrentTokenInfo()
      const score = ultraSecureTokenClient.getDeviceSecurityScore()
      
      setTokenInfo(info)
      setSecurityScore(score)
      setIsSecure(info !== null && score >= 70)
    }

    checkTokenSecurity()
    
    // Verificar a cada 30 segundos
    const interval = setInterval(checkTokenSecurity, 30000)
    
    return () => clearInterval(interval)
  }, [])

  return {
    tokenInfo,
    isSecure,
    securityScore,
    isNearExpiry: ultraSecureTokenClient.isTokenNearExpiry(),
    deviceFingerprint: ultraSecureTokenClient.getDeviceFingerprint()
  }
}
