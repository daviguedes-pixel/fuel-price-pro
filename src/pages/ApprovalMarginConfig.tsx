import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

export default function ApprovalMarginConfig() {
  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Configurações de Aprovação por Margem</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure quais perfis devem aprovar baseado na margem de lucro
          </p>
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Funcionalidade Desabilitada</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <CardDescription>
            A tabela <code className="bg-muted px-2 py-1 rounded text-sm">approval_margin_rules</code> não foi criada no banco de dados.
            Esta funcionalidade está temporariamente desabilitada.
          </CardDescription>
        </CardContent>
      </Card>
    </div>
  );
}
