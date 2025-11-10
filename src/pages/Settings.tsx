import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Users, UsersRound, Database, TrendingUp, ArrowUpDown } from 'lucide-react';

export default function Settings() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-3 space-y-3">
        {/* Header */}
        <div className="relative overflow-hidden rounded-lg bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 p-3 text-white shadow-lg">
          <div className="absolute inset-0 bg-black/10"></div>
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div>
                <h1 className="text-lg font-bold mb-0.5">Configurações</h1>
                <p className="text-slate-200 text-xs">Configurações gerais do sistema</p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/gestao')}>
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <UsersRound className="h-6 w-6 text-blue-600" />
                <CardTitle>Gestão</CardTitle>
              </div>
              <CardDescription>Gerencie postos, clientes e tipos de pagamento</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Administre postos, clientes e configurações de tipos de pagamento.
              </p>
              <Button variant="outline" className="w-full">
                Abrir Gestão
              </Button>
            </CardContent>
          </Card>
          
          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/admin')}>
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <Users className="h-6 w-6 text-blue-600" />
                <CardTitle>Usuários e Permissões</CardTitle>
              </div>
              <CardDescription>Gerencie usuários e suas permissões</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Gerencie usuários, papéis e permissões do sistema.
              </p>
              <Button variant="outline" className="w-full">
                Abrir Usuários
              </Button>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/tax-management')}>
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <Database className="h-6 w-6 text-blue-600" />
                <CardTitle>Gestão de Taxas</CardTitle>
              </div>
              <CardDescription>Configure tipos de pagamento e taxas</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Gerencie tipos de pagamento e taxas aplicadas.
              </p>
              <Button variant="outline" className="w-full">
                Abrir Taxas
              </Button>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/approval-margin-config')}>
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp className="h-6 w-6 text-blue-600" />
                <CardTitle>Configurações de Aprovação por Margem</CardTitle>
              </div>
              <CardDescription>Configure regras de aprovação baseadas em margem</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Defina quais perfis devem aprovar baseado na margem de lucro.
              </p>
              <Button variant="outline" className="w-full">
                Abrir Configurações
              </Button>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/approval-order-config')}>
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <ArrowUpDown className="h-6 w-6 text-blue-600" />
                <CardTitle>Ordem de Aprovação por Perfil</CardTitle>
              </div>
              <CardDescription>Configure a ordem hierárquica de aprovação</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Defina qual perfil aprova primeiro na hierarquia de aprovação.
              </p>
              <Button variant="outline" className="w-full">
                Abrir Configurações
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

