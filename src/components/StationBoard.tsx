import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { formatBrazilianCurrency } from '@/lib/utils';

interface StationBoardProps {
  prices: {
    etanol?: number;
    gasolina_comum?: number;
    gasolina_aditivada?: number;
    s10?: number;
    s500?: number;
  };
  className?: string;
}

export function StationBoard({ 
  prices, 
  className = '' 
}: StationBoardProps) {
  const formatPrice = (price: number) => {
    return formatBrazilianCurrency(price);
  };

  const products = [
    { 
      key: 'etanol', 
      label: 'ETANOL HIDRATADO',
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-50 dark:bg-green-950/30',
      borderColor: 'border-green-200 dark:border-green-800'
    },
    { 
      key: 'gasolina_comum', 
      label: 'GASOLINA COMUM',
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-50 dark:bg-red-950/30',
      borderColor: 'border-red-200 dark:border-red-800'
    },
    { 
      key: 'gasolina_aditivada', 
      label: 'GASOLINA ADITIVADA',
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-50 dark:bg-red-950/30',
      borderColor: 'border-red-200 dark:border-red-800'
    },
    { 
      key: 's10', 
      label: 'DIESEL S-10',
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-950/30',
      borderColor: 'border-blue-200 dark:border-blue-800'
    },
    { 
      key: 's500', 
      label: 'DIESEL S-500',
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-950/30',
      borderColor: 'border-blue-200 dark:border-blue-800'
    }
  ];

  return (
    <div className={`w-80 mx-auto ${className}`}>
      {/* Placa moderna do posto */}
      <div className="bg-card border-2 border-border rounded-xl overflow-hidden shadow-lg">
        {/* Produtos e preços */}
        <div className="p-6 space-y-4">
          {products.map((product) => {
            const price = prices[product.key as keyof typeof prices];
            if (!price) return null;
            
              return (
                <div key={product.key} className={`${product.bgColor} rounded-lg p-4 border-2 ${product.borderColor}`}>
                  <div className="flex justify-between items-center">
                    <div className="flex flex-col">
                      <span className={`${product.color} font-bold text-sm`}>
                        {product.label}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-foreground font-bold text-xl">
                        R$ {formatPrice(price)}
                      </span>
                    </div>
                  </div>
                </div>
              );
          })}
        </div>
      </div>
    </div>
  );
}
