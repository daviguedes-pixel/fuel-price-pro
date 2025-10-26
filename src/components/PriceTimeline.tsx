import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, CheckCircle, Clock, XCircle } from 'lucide-react';
import { formatBrazilianCurrency } from '@/lib/utils';

interface TimelineItem {
  id: string;
  date: string;
  client: string;
  station: string;
  product: string;
  oldPrice?: number;
  newPrice: number;
  status: 'approved' | 'pending' | 'rejected';
  approvedBy?: string;
  changeType: 'up' | 'down';
}

interface PriceTimelineProps {
  items: TimelineItem[];
}

export function PriceTimeline({ items }: PriceTimelineProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Aprovado</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejeitado</Badge>;
      default:
        return <Badge variant="secondary">Pendente</Badge>;
    }
  };

  const getChangeIcon = (changeType: string) => {
    return changeType === 'up' ? (
      <TrendingUp className="h-4 w-4 text-red-500" />
    ) : (
      <TrendingDown className="h-4 w-4 text-green-500" />
    );
  };

  return (
    <div className="space-y-6">
      {items.map((item, index) => (
        <div key={item.id} className="relative">
          {/* Timeline line */}
          {index < items.length - 1 && (
            <div className="absolute left-6 top-12 w-0.5 h-16 bg-border" />
          )}
          
          <div className="flex items-start gap-4">
            {/* Status icon */}
            <div className="flex-shrink-0 w-12 h-12 bg-card border-2 border-border rounded-full flex items-center justify-center">
              {getStatusIcon(item.status)}
            </div>
            
            {/* Content */}
            <Card className="flex-1">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">{item.client}</h4>
                      {getStatusBadge(item.status)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {item.station} • {item.product}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(item.date).toLocaleDateString('pt-BR')} às {new Date(item.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      {item.approvedBy && ` • Aprovado por ${item.approvedBy}`}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="flex items-center gap-2">
                        {getChangeIcon(item.changeType)}
                        <div>
                          {item.oldPrice && (
                            <p className="text-sm text-muted-foreground line-through">
                              {formatBrazilianCurrency(item.oldPrice)}
                            </p>
                          )}
                          <p className="text-lg font-bold text-primary">
                            {formatBrazilianCurrency(item.newPrice)}
                          </p>
                        </div>
                      </div>
                      {item.oldPrice && (
                        <p className="text-xs text-muted-foreground">
                          {item.changeType === 'up' ? '+' : '-'}
                          {formatBrazilianCurrency(Math.abs(item.newPrice - item.oldPrice))}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      ))}
    </div>
  );
}
