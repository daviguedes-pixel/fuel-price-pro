import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { AuthProvider } from './hooks/useAuth.tsx'
import { PermissionsProvider } from './hooks/usePermissions.tsx'
import { SecurityProvider } from './context/SecurityContext.tsx'

// Configurações de segurança do navegador
if (import.meta.env.PROD) {
  // Desabilitar console em produção
  console.log = () => {}
  console.warn = () => {}
  console.error = () => {}
  
  // Configurar CSP (Content Security Policy)
  const meta = document.createElement('meta')
  meta.httpEquiv = 'Content-Security-Policy'
  meta.content = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://ijygsxwfmribbjymxhaf.supabase.co;"
  document.head.appendChild(meta)
  
  // Configurar outros headers de segurança
  const securityHeaders = [
    { name: 'X-Content-Type-Options', value: 'nosniff' },
    { name: 'X-Frame-Options', value: 'DENY' },
    { name: 'X-XSS-Protection', value: '1; mode=block' },
    { name: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { name: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' }
  ]
  
  securityHeaders.forEach(header => {
    const metaHeader = document.createElement('meta')
    metaHeader.httpEquiv = header.name
    metaHeader.content = header.value
    document.head.appendChild(metaHeader)
  })
}

// Configurar interceptors de segurança
const originalFetch = window.fetch
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  try {
    // Adicionar headers de segurança
    const headers = new Headers(init?.headers)
    
    // Adicionar timestamp para evitar cache
    headers.set('X-Request-Time', Date.now().toString())
    
    // Adicionar identificador único da sessão
    const sessionId = sessionStorage.getItem('session_id') || 
      (() => {
        const id = Math.random().toString(36).substring(2, 15)
        sessionStorage.setItem('session_id', id)
        return id
      })()
    headers.set('X-Session-ID', sessionId)
    
    // Adicionar fingerprint do navegador
    const fingerprint = await getBrowserFingerprint()
    headers.set('X-Browser-Fingerprint', fingerprint)
    
    const response = await originalFetch(input, {
      ...init,
      headers
    })
    
    // Verificar headers de segurança na resposta
    const securityHeaders = [
      'X-Content-Type-Options',
      'X-Frame-Options',
      'X-XSS-Protection',
      'Strict-Transport-Security'
    ]
    
    const missingHeaders = securityHeaders.filter(header => 
      !response.headers.get(header)
    )
    
    if (missingHeaders.length > 0 && import.meta.env.DEV) {
      console.warn('Headers de segurança ausentes:', missingHeaders)
    }
    
    return response
  } catch (error) {
    console.error('Erro na requisição:', error)
    throw error
  }
}

// Função para gerar fingerprint do navegador
async function getBrowserFingerprint(): Promise<string> {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.textBaseline = 'top'
    ctx.font = '14px Arial'
    ctx.fillText('Browser fingerprint', 2, 2)
  }
  
  const fingerprint = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    new Date().getTimezoneOffset(),
    canvas.toDataURL()
  ].join('|')
  
  // Hash simples do fingerprint
  let hash = 0
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  
  return Math.abs(hash).toString(36)
}

// Configurar proteção contra ataques
document.addEventListener('DOMContentLoaded', () => {
  // Proteção contra clickjacking
  if (window.top !== window.self) {
    window.top.location = window.self.location
  }
  
  // Proteção contra ataques de timing
  const startTime = performance.now()
  window.addEventListener('beforeunload', () => {
    const endTime = performance.now()
    const sessionDuration = endTime - startTime
    
    // Log sessão suspeita se muito curta ou muito longa
    if (sessionDuration < 1000 || sessionDuration > 8 * 60 * 60 * 1000) {
      console.warn('Sessão suspeita detectada:', sessionDuration)
    }
  })
  
  // Proteção contra ataques de força bruta
  let failedAttempts = 0
  const maxAttempts = 5
  
  const originalConsoleError = console.error
  console.error = (...args) => {
    if (args[0]?.includes?.('auth') || args[0]?.includes?.('login')) {
      failedAttempts++
      if (failedAttempts >= maxAttempts) {
        console.warn('Muitas tentativas de login falharam')
        // Em produção, você poderia bloquear temporariamente o usuário
      }
    }
    originalConsoleError.apply(console, args)
  }
})

// Configurar monitoramento de performance
if (import.meta.env.PROD) {
  // Monitorar Core Web Vitals
  import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
    getCLS(console.log)
    getFID(console.log)
    getFCP(console.log)
    getLCP(console.log)
    getTTFB(console.log)
  })
}

// Renderizar aplicação com providers de segurança
const container = document.getElementById('root')
if (container) {
  const root = createRoot(container)
  root.render(
    <React.StrictMode>
      <SecurityProvider>
        <AuthProvider>
          <PermissionsProvider>
            <App />
          </PermissionsProvider>
        </AuthProvider>
      </SecurityProvider>
    </React.StrictMode>
  )
}
