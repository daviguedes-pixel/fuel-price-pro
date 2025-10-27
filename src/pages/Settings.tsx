import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Settings as SettingsIcon, Users, Database, UsersRound } from 'lucide-react';

export default function Settings() {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Configurações</h1>
        <p className="text-muted-foreground mt-2">Configurações gerais do sistema</p>
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
        
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/station-management')}>
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <SettingsIcon className="h-6 w-6 text-blue-600" />
              <CardTitle>Configurações do Sistema</CardTitle>
            </div>
            <CardDescription>Configure preferências do sistema</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Configurações gerais e preferências do sistema.
            </p>
            <Button variant="outline" className="w-full">
              Abrir Configurações
            </Button>
          </CardContent>
        </Card>
        
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/tax-management')}>
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <Database className="h-6 w-6 text-blue-600" />
              <CardTitle>Gestão de Taxas</CardTitle>
            </div>
            <CardDescription>Configure tipos de pagamento</CardDescription>
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
      </div>
    </div>
  );
}

