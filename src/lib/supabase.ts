import { createClient } from '@supabase/supabase-js';

// Configuração do Supabase - hardcoded para garantir funcionamento
const supabaseUrl = "https://ijygsxwfmribbjymxhaf.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqeWdzeHdmbXJpYmJqeW14aGFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTczNDMzOTcsImV4cCI6MjA3MjkxOTM5N30.p_c6M_7eUJcOU2bmuOhx6Na7mQC6cRNEMsHMOlQJuMc";

// Criar cliente Supabase sempre disponível
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});

// Flag para verificar se Supabase está disponível
export const isSupabaseConfigured = Boolean(supabase);

// Types for database tables
export interface Profile {
  id: string;
  email: string;
  nome: string;
  perfil: 'diretor_comercial' | 'assessor_comercial' | 'supervisor_comercial' | 'diretor_pricing' | 'analista_pricing' | 'gerente';
  posto_id?: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Posto {
  id: string;
  nome: string;
  endereco?: string;
  cidade: string;
  estado: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Cliente {
  id: string;
  nome: string;
  cnpj?: string;
  tipo: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface TipoPagamento {
  id: string;
  descricao: string;
  taxa: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface SugestaoPreco {
  id: string;
  usuario_id: string;
  posto_id: string;
  posto_concorrente_id?: string;
  cliente_id: string;
  tipo_referencia: 'nf' | 'print_portal' | 'print_conversa' | 'sem_referencia';
  produto: 'etanol' | 'gasolina_comum' | 'gasolina_aditivada' | 's10' | 's500';
  tipo_pagamento_id: string;
  preco_custo: number;
  preco_custo_com_taxa?: number;
  margem?: number;
  observacao?: string;
  imagem_url?: string;
  status: 'em_analise' | 'aprovado' | 'negado';
  created_at: string;
  updated_at: string;
}

export interface AprovacaoPreco {
  id: string;
  sugestao_id: string;
  usuario_id: string;
  nivel_aprovacao: number;
  decisao: 'aprovado' | 'negado';
  observacao?: string;
  data_decisao: string;
  created_at: string;
}

export interface PesquisaConcorrencia {
  id: string;
  usuario_id: string;
  posto_id: string;
  posto_concorrente_id: string;
  tipo_prova: 'placa' | 'bomba' | 'nf';
  produto: 'etanol' | 'gasolina_comum' | 'gasolina_aditivada' | 's10' | 's500';
  preco: number;
  imagem_url: string;
  data_pesquisa: string;
  horario: string;
  created_at: string;
}

export interface Notificacao {
  id: string;
  usuario_id: string;
  tipo: 'nova_sugestao' | 'aprovacao' | 'negacao' | 'pesquisa_pendente';
  titulo: string;
  mensagem: string;
  lida: boolean;
  referencia_id?: string;
  created_at: string;
}