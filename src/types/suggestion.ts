/**
 * Tipos para sugestões de preço
 */

export interface PriceSuggestion {
  id: string;
  station_id: string;
  client_id: string;
  product: string;
  suggested_price: number;
  current_price?: number;
  purchase_cost?: number;
  freight_cost?: number;
  payment_method_id?: string;
  status: 'pending' | 'approved' | 'rejected';
  approval_level?: number;
  requested_by: string;
  created_by?: string;
  created_at: string;
  updated_at?: string;
  margin_cents?: number;
  batch_key?: string;
  batch_name?: string;
  observation?: string;
  
  // Relacionamentos (opcionais, podem ser carregados separadamente)
  stations?: {
    id: string;
    name: string;
    [key: string]: any;
  };
  clients?: {
    id: string;
    name: string;
    [key: string]: any;
  };
  payment_methods?: {
    CARTAO: string;
    TAXA?: number;
    PRAZO?: number;
    [key: string]: any;
  };
}

