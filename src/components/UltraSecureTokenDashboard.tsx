import React, { useState, useEffect } from 'react'
import { useUltraSecureTokens, useTokenSecurity } from '@/lib/ultra-secure-tokens'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Shield, 
  ShieldCheck, 
  ShieldX, 
  Lock, 
  RefreshCw, 
  AlertTriangle, 
  Clock,
  Eye,
  EyeOff,
  Trash2,
  Key
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export function UltraSecureTokenDashboard() {
  const ultraSecureClient = useUltraSecureTokens()
  const { tokenInfo, isSecure, securityScore, isNearExpiry, deviceFingerprint } = useTokenSecurity()
  const { toast } = useToast()
  
  const [isRotating, setIsRotating] = useState(false)
  const [isRevoking, setIsRevoking] = useState(false)
  const [showFingerprint, setShowFingerprint] = useState(false)

  const handleRotateToken = async () => {
    setIsRotating(true)
    try {
      const newToken = await ultraSecureClient.rotateToken()
      if (newToken) {
        toast({
          title: "Token Rotacionado",
          description: `Novo token com nível de segurança ${newToken.securityLevel}/10`,
          variant: "default"
        })
      } else {
        toast({
          title: "Erro na Rotação",
          description: "Não foi possível rotacionar o token",
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro interno na rotação do token",
        variant: "destructive"
      })
    } finally {
      setIsRotating(false)
    }
  }

  const handleRevokeToken = async () => {
    setIsRevoking(true)
    try {
      const success = await ultraSecureClient.revokeToken('user_requested')
      if (success) {
        toast({
          title: "Token Revogado",
          description: "Token revogado com sucesso. Faça login novamente.",
          variant: "default"
        })
        // Redirecionar para login
        window.location.href = '/ultra-secure-login'
      } else {
        toast({
          title: "Erro na Revogação",
          description: "Não foi possível revogar o token",
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro interno na revogação do token",
        variant: "destructive"
      })
    } finally {
      setIsRevoking(false)
    }
  }

  const getSecurityIcon = (level: number) => {
    if (level >= 9) return <ShieldCheck className="h-4 w-4 text-green-600" />
    if (level >= 7) return <Shield className="h-4 w-4 text-yellow-600" />
    return <ShieldX className="h-4 w-4 text-red-600" />
  }

  const getSecurityColor = (level: number) => {
    if (level >= 9) return 'text-green-600'
    if (level >= 7) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getExpiryStatus = () => {
    if (!tokenInfo) return { status: 'unknown', color: 'gray', message: 'Token não encontrado' }
    
    const expiryDate = new Date(tokenInfo.expiresAt)
    const now = new Date()
    const hoursUntilExpiry = (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60)
    
    if (hoursUntilExpiry < 0) {
      return { status: 'expired', color: 'red', message: 'Token expirado' }
    } else if (hoursUntilExpiry < 1) {
      return { status: 'critical', color: 'red', message: `Expira em ${Math.round(hoursUntilExpiry * 60)} minutos` }
    } else if (hoursUntilExpiry < 2) {
      return { status: 'warning', color: 'yellow', message: `Expira em ${Math.round(hoursUntilExpiry)} horas` }
    } else {
      return { status: 'ok', color: 'green', message: `Expira em ${Math.round(hoursUntilExpiry)} horas` }
    }
  }

  const expiryStatus = getExpiryStatus()

  if (!tokenInfo) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <ShieldX className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Token Não Encontrado</h3>
            <p className="text-gray-600 mb-4">Nenhum token ultra-seguro ativo encontrado.</p>
            <Button onClick={() => window.location.href = '/ultra-secure-login'}>
              Fazer Login Ultra-Seguro
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Status Geral */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-blue-600" />
            Status do Token Ultra-Seguro
          </CardTitle>
          <CardDescription>
            Sistema de autenticação impossível de hackear com detecção de ataques
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Nível de Segurança */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {getSecurityIcon(tokenInfo.securityLevel)}
                <span className="text-sm font-medium">Nível de Segurança</span>
              </div>
              <div className={`text-2xl font-bold ${getSecurityColor(tokenInfo.securityLevel)}`}>
                {tokenInfo.securityLevel}/10
              </div>
              <Progress value={tokenInfo.securityLevel * 10} className="h-2" />
            </div>

            {/* Status de Expiração */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">Expiração</span>
              </div>
              <div className={`text-lg font-semibold text-${expiryStatus.color}-600`}>
                {expiryStatus.message}
              </div>
              <Badge variant={expiryStatus.status === 'ok' ? 'default' : 'destructive'}>
                {expiryStatus.status === 'ok' ? 'Válido' : 'Atenção'}
              </Badge>
            </div>

            {/* Score do Dispositivo */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">Dispositivo</span>
              </div>
              <div className={`text-lg font-semibold ${getSecurityColor(securityScore)}`}>
                {securityScore}/100
              </div>
              <Progress value={securityScore} className="h-2" />
            </div>
          </div>

          {/* Alertas */}
          {!isSecure && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Seu dispositivo não atende aos requisitos mínimos de segurança.
              </AlertDescription>
            </Alert>
          )}

          {isNearExpiry && (
            <Alert variant="destructive">
              <Clock className="h-4 w-4" />
              <AlertDescription>
                Token próximo do vencimento. Recomendamos rotacionar para manter a segurança.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Recursos de Segurança */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-green-600" />
            Recursos de Segurança Ativos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {tokenInfo.features.map((feature, index) => (
              <div key={index} className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                <ShieldCheck className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-800">
                  {feature.replace('_', ' ').toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Informações Técnicas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-blue-600" />
            Informações Técnicas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium text-gray-700">Token ID</Label>
              <div className="mt-1 p-2 bg-gray-50 rounded text-sm font-mono">
                {tokenInfo.id.substring(0, 16)}...
              </div>
            </div>
            
            <div>
              <Label className="text-sm font-medium text-gray-700">Fingerprint do Dispositivo</Label>
              <div className="mt-1 flex items-center gap-2">
                <div className="flex-1 p-2 bg-gray-50 rounded text-sm font-mono">
                  {showFingerprint ? deviceFingerprint : `${deviceFingerprint.substring(0, 16)}...`}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFingerprint(!showFingerprint)}
                >
                  {showFingerprint ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium text-gray-700">Criado em</Label>
              <div className="mt-1 p-2 bg-gray-50 rounded text-sm">
                {new Date(tokenInfo.expiresAt).toLocaleString()}
              </div>
            </div>
            
            <div>
              <Label className="text-sm font-medium text-gray-700">Expira em</Label>
              <div className="mt-1 p-2 bg-gray-50 rounded text-sm">
                {new Date(tokenInfo.expiresAt).toLocaleString()}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ações de Segurança */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-blue-600" />
            Ações de Segurança
          </CardTitle>
          <CardDescription>
            Gerencie seu token ultra-seguro
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <Button
              onClick={handleRotateToken}
              disabled={isRotating}
              variant="outline"
              className="flex-1"
            >
              {isRotating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2" />
                  Rotacionando...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Rotacionar Token
                </>
              )}
            </Button>
            
            <Button
              onClick={handleRevokeToken}
              disabled={isRevoking}
              variant="destructive"
              className="flex-1"
            >
              {isRevoking ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Revogando...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Revogar Token
                </>
              )}
            </Button>
          </div>
          
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <strong>Atenção:</strong> Revogar o token irá desconectar você imediatamente. 
                Certifique-se de salvar seu trabalho antes de continuar.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
