/**
 * Tipos para métodos de pagamento
 */

export interface PaymentMethod {
  id?: string | number;
  ID_POSTO?: string | number;
  CARTAO: string;
  TAXA?: number | null;
  PRAZO?: number | null;
  POSTO?: string;
  name?: string;
}

export interface PaymentMethodWithStation extends PaymentMethod {
  station_id?: string;
  station_name?: string;
}

