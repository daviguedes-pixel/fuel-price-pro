import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUltraSecureTokens, useTokenSecurity } from '@/lib/ultra-secure-tokens'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Shield, ShieldCheck, ShieldX, Lock, Eye, EyeOff, AlertTriangle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export default function UltraSecureLogin() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const ultraSecureClient = useUltraSecureTokens()
  const { isSecure, securityScore, deviceFingerprint } = useTokenSecurity()
  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loginAttempts, setLoginAttempts] = useState(0)
  const [isBlocked, setIsBlocked] = useState(false)
  const [blockTimeRemaining, setBlockTimeRemaining] = useState(0)

  // Verificar se já está autenticado
  useEffect(() => {
    if (ultraSecureClient.isAuthenticated()) {
      navigate('/dashboard')
    }
  }, [navigate])

  // Controle de tentativas de login
  useEffect(() => {
    const attempts = parseInt(localStorage.getItem('login_attempts') || '0')
    const lastAttempt = localStorage.getItem('last_login_attempt')
    
    setLoginAttempts(attempts)
    
    if (lastAttempt) {
      const timeSinceLastAttempt = Date.now() - parseInt(lastAttempt)
      const blockDuration = Math.min(attempts * 60000, 15 * 60 * 1000) // Max 15 min
      
      if (timeSinceLastAttempt < blockDuration) {
        setIsBlocked(true)
        setBlockTimeRemaining(Math.ceil((blockDuration - timeSinceLastAttempt) / 1000))
        
        const interval = setInterval(() => {
          setBlockTimeRemaining(prev => {
            if (prev <= 1) {
              setIsBlocked(false)
              clearInterval(interval)
              return 0
            }
            return prev - 1
          })
        }, 1000)
        
        return () => clearInterval(interval)
      } else {
        // Reset tentativas após período de bloqueio
        localStorage.removeItem('login_attempts')
        localStorage.removeItem('last_login_attempt')
        setLoginAttempts(0)
      }
    }
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (isBlocked) {
      toast({
        title: "Acesso Bloqueado",
        description: `Tente novamente em ${Math.ceil(blockTimeRemaining / 60)} minutos`,
        variant: "destructive"
      })
      return
    }

    if (!email || !password) {
      toast({
        title: "Campos Obrigatórios",
        description: "Preencha email e senha",
        variant: "destructive"
      })
      return
    }

    setLoading(true)

    try {
      const result = await ultraSecureClient.ultraSecureLogin(email, password)
      
      if (result) {
        // Reset tentativas em caso de sucesso
        localStorage.removeItem('login_attempts')
        localStorage.removeItem('last_login_attempt')
        
        toast({
          title: "Login Ultra-Seguro Realizado",
          description: `Nível de segurança: ${result.token.securityLevel}/10`,
          variant: "default"
        })
        
        navigate('/dashboard')
      } else {
        // Incrementar tentativas falhadas
        const newAttempts = loginAttempts + 1
        setLoginAttempts(newAttempts)
        localStorage.setItem('login_attempts', newAttempts.toString())
        localStorage.setItem('last_login_attempt', Date.now().toString())
        
        toast({
          title: "Login Falhou",
          description: "Credenciais inválidas ou sistema bloqueado",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error('Erro no login:', error)
      toast({
        title: "Erro de Conexão",
        description: "Não foi possível conectar ao servidor",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const getSecurityIcon = () => {
    if (securityScore >= 80) return <ShieldCheck className="h-5 w-5 text-green-600" />
    if (securityScore >= 60) return <Shield className="h-5 w-5 text-yellow-600" />
    return <ShieldX className="h-5 w-5 text-red-600" />
  }

  const getSecurityColor = () => {
    if (securityScore >= 80) return 'text-green-600'
    if (securityScore >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header de Segurança */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Lock className="h-8 w-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">Fuel Price Pro</h1>
          </div>
          <p className="text-sm text-gray-600">Sistema Ultra-Seguro de Autenticação</p>
        </div>

        {/* Status de Segurança */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              {getSecurityIcon()}
              Status de Segurança do Dispositivo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Pontuação de Segurança</span>
              <span className={`text-sm font-bold ${getSecurityColor()}`}>
                {securityScore}/100
              </span>
            </div>
            <Progress value={securityScore} className="h-2" />
            <div className="flex items-center justify-between text-xs text-gray-600">
              <span>Status: {isSecure ? 'Seguro' : 'Atenção Necessária'}</span>
              <Badge variant={isSecure ? "default" : "destructive"}>
                {isSecure ? 'Aprovado' : 'Verificar'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Alertas de Segurança */}
        {!isSecure && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Seu dispositivo não atende aos requisitos mínimos de segurança. 
              Recomendamos usar HTTPS e um navegador atualizado.
            </AlertDescription>
          </Alert>
        )}

        {/* Bloqueio por Tentativas */}
        {isBlocked && (
          <Alert variant="destructive">
            <ShieldX className="h-4 w-4" />
            <AlertDescription>
              <strong>Acesso Temporariamente Bloqueado</strong><br />
              Muitas tentativas de login falharam. Tente novamente em {formatTime(blockTimeRemaining)}.
            </AlertDescription>
          </Alert>
        )}

        {/* Formulário de Login */}
        <Card>
          <CardHeader>
            <CardTitle>Login Ultra-Seguro</CardTitle>
            <CardDescription>
              Sistema com tokens impossíveis de hackear e detecção de ataques
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  disabled={loading || isBlocked}
                  className="w-full"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Sua senha"
                    disabled={loading || isBlocked}
                    className="w-full pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={loading || isBlocked}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                disabled={loading || isBlocked || !isSecure}
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Verificando Segurança...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4 mr-2" />
                    Login Ultra-Seguro
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Informações de Segurança */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Recursos de Segurança Ativos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1">
                <Shield className="h-3 w-3 text-green-600" />
                <span>Tokens Impossíveis de Hackear</span>
              </div>
              <div className="flex items-center gap-1">
                <Lock className="h-3 w-3 text-green-600" />
                <span>Detecção de Ataques</span>
              </div>
              <div className="flex items-center gap-1">
                <ShieldCheck className="h-3 w-3 text-green-600" />
                <span>Rotacionação Automática</span>
              </div>
              <div className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-green-600" />
                <span>Blacklist de Tokens</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Informações Técnicas (apenas em desenvolvimento) */}
        {import.meta.env.DEV && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Informações Técnicas</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-gray-600 space-y-1">
              <div>Fingerprint: {deviceFingerprint.substring(0, 16)}...</div>
              <div>Tentativas: {loginAttempts}/5</div>
              <div>Protocolo: {location.protocol}</div>
              <div>Host: {location.hostname}</div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
