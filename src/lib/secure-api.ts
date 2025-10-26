import { supabase } from '@/integrations/supabase/client'

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface ApiError {
  error: string
  details?: string
}

class SecureApiClient {
  private baseUrl: string
  private token: string | null = null

  constructor() {
    this.baseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ijygsxwfmribbjymxhaf.supabase.co'
    this.initializeToken()
  }

  private async initializeToken() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      this.token = session?.access_token || null
    } catch (error) {
      console.error('Erro ao inicializar token:', error)
    }
  }

  private async getToken(): Promise<string | null> {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        this.token = session.access_token
        return session.access_token
      }
      return null
    } catch (error) {
      console.error('Erro ao obter token:', error)
      return null
    }
  }

  private async refreshTokenIfNeeded(): Promise<string | null> {
    try {
      const { data, error } = await supabase.auth.refreshSession()
      if (error) {
        console.error('Erro ao renovar token:', error)
        return null
      }
      this.token = data.session?.access_token || null
      return this.token
    } catch (error) {
      console.error('Erro ao renovar token:', error)
      return null
    }
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      let token = await this.getToken()
      
      if (!token) {
        return {
          success: false,
          error: 'Token de autenticação não encontrado'
        }
      }

      const url = `${this.baseUrl}/functions/v1${endpoint}`
      
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          ...options.headers
        }
      })

      // Se token expirou, tentar renovar
      if (response.status === 401) {
        const newToken = await this.refreshTokenIfNeeded()
        if (newToken) {
          const retryResponse = await fetch(url, {
            ...options,
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${newToken}`,
              ...options.headers
            }
          })
          
          if (retryResponse.ok) {
            const data = await retryResponse.json()
            return { success: true, data }
          }
        }
        
        return {
          success: false,
          error: 'Sessão expirada. Faça login novamente.'
        }
      }

      if (!response.ok) {
        const errorData: ApiError = await response.json()
        return {
          success: false,
          error: errorData.error || 'Erro na requisição'
        }
      }

      const data = await response.json()
      return { success: true, data }
    } catch (error) {
      console.error('Erro na requisição:', error)
      return {
        success: false,
        error: 'Erro de conexão'
      }
    }
  }

  // Auth API methods
  async getProfile() {
    return this.makeRequest('/auth-api/api/auth/profile')
  }

  async refreshToken() {
    return this.makeRequest('/auth-api/api/auth/refresh', { method: 'POST' })
  }

  async logout() {
    return this.makeRequest('/auth-api/api/auth/logout', { method: 'POST' })
  }

  async getPermissions() {
    return this.makeRequest('/auth-api/api/auth/permissions')
  }

  // Pricing API methods
  async getSuggestions(params?: { station_id?: string; product?: string; limit?: number }) {
    const queryParams = new URLSearchParams()
    if (params?.station_id) queryParams.append('station_id', params.station_id)
    if (params?.product) queryParams.append('product', params.product)
    if (params?.limit) queryParams.append('limit', params.limit.toString())
    
    const query = queryParams.toString()
    return this.makeRequest(`/pricing-api/api/pricing/suggestions${query ? `?${query}` : ''}`)
  }

  async createSuggestion(data: {
    station_id: string
    client_id: string
    product: string
    payment_method_id: string
    cost_price: number
    cost_price_with_tax?: number
    margin?: number
    observation?: string
    image_url?: string
    reference_type?: string
  }) {
    return this.makeRequest('/pricing-api/api/pricing/suggestions', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  async approveSuggestion(suggestionId: string, decision: 'aprovado' | 'negado', observation?: string) {
    return this.makeRequest('/pricing-api/api/pricing/approve', {
      method: 'POST',
      body: JSON.stringify({
        suggestion_id: suggestionId,
        decision,
        observation
      })
    })
  }

  async getPriceHistory(params?: { station_id?: string; product?: string; limit?: number }) {
    const queryParams = new URLSearchParams()
    if (params?.station_id) queryParams.append('station_id', params.station_id)
    if (params?.product) queryParams.append('product', params.product)
    if (params?.limit) queryParams.append('limit', params.limit.toString())
    
    const query = queryParams.toString()
    return this.makeRequest(`/pricing-api/api/pricing/history${query ? `?${query}` : ''}`)
  }

  async getCostData(stationId: string, product: string, date?: string) {
    const queryParams = new URLSearchParams()
    queryParams.append('station_id', stationId)
    queryParams.append('product', product)
    if (date) queryParams.append('date', date)
    
    return this.makeRequest(`/pricing-api/api/pricing/cost?${queryParams.toString()}`)
  }

  // Research API methods
  async getCompetitors(query?: string, limit?: number) {
    const queryParams = new URLSearchParams()
    if (query) queryParams.append('q', query)
    if (limit) queryParams.append('limit', limit.toString())
    
    const queryString = queryParams.toString()
    return this.makeRequest(`/research-api/api/research/competitors${queryString ? `?${queryString}` : ''}`)
  }

  async submitResearch(data: {
    station_id: string
    competitor_station_id: string
    product: string
    price: number
    proof_type: 'placa' | 'bomba' | 'nf'
    image_url?: string
    research_date?: string
    research_time?: string
  }) {
    return this.makeRequest('/research-api/api/research/submit', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  async getResearchHistory(params?: { station_id?: string; product?: string; limit?: number }) {
    const queryParams = new URLSearchParams()
    if (params?.station_id) queryParams.append('station_id', params.station_id)
    if (params?.product) queryParams.append('product', params.product)
    if (params?.limit) queryParams.append('limit', params.limit.toString())
    
    const query = queryParams.toString()
    return this.makeRequest(`/research-api/api/research/history${query ? `?${query}` : ''}`)
  }

  async getStations(query?: string, limit?: number) {
    const queryParams = new URLSearchParams()
    if (query) queryParams.append('q', query)
    if (limit) queryParams.append('limit', limit.toString())
    
    const queryString = queryParams.toString()
    return this.makeRequest(`/research-api/api/research/stations${queryString ? `?${queryString}` : ''}`)
  }

  // Admin API methods
  async getUsers() {
    return this.makeRequest('/admin-api/api/admin/users')
  }

  async updateUser(userId: string, data: any) {
    return this.makeRequest('/admin-api/api/admin/users', {
      method: 'PUT',
      body: JSON.stringify({
        user_id: userId,
        ...data
      })
    })
  }

  async getAuditLogs(params?: { action?: string; user_id?: string; limit?: number; offset?: number }) {
    const queryParams = new URLSearchParams()
    if (params?.action) queryParams.append('action', params.action)
    if (params?.user_id) queryParams.append('user_id', params.user_id)
    if (params?.limit) queryParams.append('limit', params.limit.toString())
    if (params?.offset) queryParams.append('offset', params.offset.toString())
    
    const query = queryParams.toString()
    return this.makeRequest(`/admin-api/api/admin/audit-logs${query ? `?${query}` : ''}`)
  }

  async getSecurityEvents(params?: { severity?: string; limit?: number }) {
    const queryParams = new URLSearchParams()
    if (params?.severity) queryParams.append('severity', params.severity)
    if (params?.limit) queryParams.append('limit', params.limit.toString())
    
    const query = queryParams.toString()
    return this.makeRequest(`/admin-api/api/admin/security-events${query ? `?${query}` : ''}`)
  }

  async getSystemStats() {
    return this.makeRequest('/admin-api/api/admin/system-stats')
  }

  async createBackup(tables: string[]) {
    return this.makeRequest('/admin-api/api/admin/backup', {
      method: 'POST',
      body: JSON.stringify({ tables })
    })
  }
}

// Singleton instance
export const secureApiClient = new SecureApiClient()

// Hook para usar o cliente seguro
export function useSecureApi() {
  return secureApiClient
}
