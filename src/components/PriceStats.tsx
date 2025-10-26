import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, DollarSign, Calendar, Users, Building2 } from 'lucide-react';
import { formatBrazilianCurrency } from '@/lib/utils';

interface PriceStats {
  totalChanges: number;
  approvedChanges: number;
  pendingChanges: number;
  rejectedChanges: number;
  averageIncrease: number;
  averageDecrease: number;
  totalClients: number;
  totalStations: number;
  recentActivity: number; // changes in last 7 days
}

interface PriceStatsProps {
  stats: PriceStats;
}

export function PriceStats({ stats }: PriceStatsProps) {
  const approvalRate = stats.totalChanges > 0 ? (stats.approvedChanges / stats.totalChanges * 100) : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Changes */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total de Alterações</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalChanges}</div>
          <p className="text-xs text-muted-foreground">
            {stats.recentActivity} nos últimos 7 dias
          </p>
        </CardContent>
      </Card>

      {/* Approval Rate */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Taxa de Aprovação</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{approvalRate.toFixed(1)}%</div>
          <div className="flex gap-2 mt-2">
            <Badge variant="secondary" className="text-xs">
              {stats.approvedChanges} aprovadas
            </Badge>
            <Badge variant="outline" className="text-xs">
              {stats.pendingChanges} pendentes
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Average Changes */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Variação Média</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-red-500" />
              <span className="text-sm font-medium text-red-600">
                +{formatBrazilianCurrency(stats.averageIncrease)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium text-green-600">
                -{formatBrazilianCurrency(stats.averageDecrease)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Coverage */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Cobertura</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium">{stats.totalClients} clientes</span>
            </div>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium">{stats.totalStations} postos</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
