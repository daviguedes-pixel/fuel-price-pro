/**
 * Tipos para price_suggestions e entidades relacionadas
 */

export interface PriceSuggestion {
  id: string;
  station_id: string | null;
  client_id: string | null;
  product: string;
  suggested_price: number | null;
  current_price: number | null;
  cost_price: number | null;
  final_price: number | null;
  margin_cents: number | null;
  payment_method_id: string | null;
  reference_id: string | null;
  observations: string | null;
  status: 'draft' | 'pending' | 'in_approval' | 'approved' | 'rejected';
  batch_id: string | null;
  batch_name: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  arla_purchase_price: number | null;
  attachments: string[] | null;
}

export interface PriceSuggestionWithRelations extends PriceSuggestion {
  clients?: {
    id: string;
    id_cliente: string;
    nome: string;
    code?: string;
  } | null;
  stations?: {
    id: string;
    name: string;
    code: string;
  } | null;
}

export interface EditRequestFormData {
  station_id: string;
  client_id: string;
  product: string;
  payment_method_id: string;
  cost_price: string;
  margin_cents: string;
  final_price: string;
  arla_purchase_price: string;
  observations: string;
  attachments: string[];
}

