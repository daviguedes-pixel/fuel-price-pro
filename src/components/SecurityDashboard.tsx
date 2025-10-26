import React from 'react'
import { useSecurity } from '@/context/SecurityContext'
import { AlertTriangle, Shield, ShieldCheck, ShieldX, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

export function SecurityDashboard() {
  const { 
    isSecure, 
    securityScore, 
    lastSecurityCheck, 
    securityIssues, 
    checkSecurity 
  } = useSecurity()

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getScoreIcon = (score: number) => {
    if (score >= 80) return <ShieldCheck className="h-5 w-5 text-green-600" />
    if (score >= 60) return <Shield className="h-5 w-5 text-yellow-600" />
    return <ShieldX className="h-5 w-5 text-red-600" />
  }

  const getIssueIcon = (type: string) => {
    switch (type) {
      case 'critical':
        return <ShieldX className="h-4 w-4 text-red-600" />
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-orange-600" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />
      default:
        return <Shield className="h-4 w-4 text-blue-600" />
    }
  }

  const getIssueBadgeColor = (type: string) => {
    switch (type) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'error':
        return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200'
    }
  }

  return (
    <div className="space-y-6">
      {/* Status Geral */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {getScoreIcon(securityScore)}
            Status de Segurança
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Pontuação de Segurança</span>
              <span className={`text-lg font-bold ${getScoreColor(securityScore)}`}>
                {securityScore}/100
              </span>
            </div>
            
            <Progress value={securityScore} className="h-2" />
            
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>Status: {isSecure ? 'Seguro' : 'Atenção Necessária'}</span>
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>
                  {lastSecurityCheck 
                    ? `Última verificação: ${lastSecurityCheck.toLocaleTimeString()}`
                    : 'Nunca verificado'
                  }
                </span>
              </div>
            </div>
            
            <Button 
              onClick={checkSecurity} 
              variant="outline" 
              size="sm"
              className="w-full"
            >
              Verificar Segurança Agora
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Problemas de Segurança */}
      {securityIssues.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              Problemas de Segurança
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {securityIssues.map((issue) => (
                <div 
                  key={issue.id} 
                  className="flex items-start gap-3 p-3 border rounded-lg"
                >
                  {getIssueIcon(issue.type)}
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{issue.message}</span>
                      <Badge 
                        variant="outline" 
                        className={getIssueBadgeColor(issue.type)}
                      >
                        {issue.type}
                      </Badge>
                    </div>
                    {issue.details && (
                      <p className="text-sm text-gray-600">{issue.details}</p>
                    )}
                    <p className="text-xs text-gray-500">
                      {issue.timestamp.toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recomendações */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" />
            Recomendações de Segurança
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-medium text-blue-900">Use HTTPS</h4>
              <p className="text-sm text-blue-700">
                Certifique-se de que o site está sendo executado em HTTPS em produção.
              </p>
            </div>
            
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <h4 className="font-medium text-green-900">Mantenha Tokens Atualizados</h4>
              <p className="text-sm text-green-700">
                Os tokens de autenticação são renovados automaticamente.
              </p>
            </div>
            
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h4 className="font-medium text-yellow-900">Monitore Atividade</h4>
              <p className="text-sm text-yellow-700">
                Verifique regularmente os logs de auditoria para detectar atividades suspeitas.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export function SecurityIndicator() {
  const { isSecure, securityScore } = useSecurity()

  return (
    <div className="flex items-center gap-2">
      {isSecure ? (
        <ShieldCheck className="h-4 w-4 text-green-600" />
      ) : (
        <ShieldX className="h-4 w-4 text-red-600" />
      )}
      <span className="text-sm font-medium">
        Segurança: {securityScore}/100
      </span>
    </div>
  )
}
