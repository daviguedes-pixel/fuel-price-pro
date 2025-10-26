export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      approval_history: {
        Row: {
          action: string
          approval_level: number
          approver_id: string | null
          approver_name: string
          created_at: string | null
          id: string
          observations: string | null
          suggestion_id: string
          updated_at: string | null
        }
        Insert: {
          action: string
          approval_level?: number
          approver_id?: string | null
          approver_name: string
          created_at?: string | null
          id?: string
          observations?: string | null
          suggestion_id: string
          updated_at?: string | null
        }
        Update: {
          action?: string
          approval_level?: number
          approver_id?: string | null
          approver_name?: string
          created_at?: string | null
          id?: string
          observations?: string | null
          suggestion_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approval_history_suggestion_id_fkey"
            columns: ["suggestion_id"]
            isOneToOne: false
            referencedRelation: "price_suggestions"
            referencedColumns: ["id"]
          },
        ]
      }
      bin_informacoes: {
        Row: {
          bandeira: string | null
          capital_pais: string | null
          codigo_alpha2: string | null
          codigo_alpha3: string | null
          codigo_idd: string | null
          codigo_idioma: string | null
          comprimento: number | null
          data_insercao: string | null
          esquema_pagamento: string | null
          id_bin: number
          idioma: string | null
          moeda: string | null
          nivel_cartao: string | null
          nome_emissor: string | null
          numero_bin: number
          pais_codigo_numerico: string | null
          pais_nome: string | null
          site_emissor: string | null
          telefone_emissor: string | null
          tipo_cartao: string | null
          valido: boolean | null
        }
        Insert: {
          bandeira?: string | null
          capital_pais?: string | null
          codigo_alpha2?: string | null
          codigo_alpha3?: string | null
          codigo_idd?: string | null
          codigo_idioma?: string | null
          comprimento?: number | null
          data_insercao?: string | null
          esquema_pagamento?: string | null
          id_bin: number
          idioma?: string | null
          moeda?: string | null
          nivel_cartao?: string | null
          nome_emissor?: string | null
          numero_bin: number
          pais_codigo_numerico?: string | null
          pais_nome?: string | null
          site_emissor?: string | null
          telefone_emissor?: string | null
          tipo_cartao?: string | null
          valido?: boolean | null
        }
        Update: {
          bandeira?: string | null
          capital_pais?: string | null
          codigo_alpha2?: string | null
          codigo_alpha3?: string | null
          codigo_idd?: string | null
          codigo_idioma?: string | null
          comprimento?: number | null
          data_insercao?: string | null
          esquema_pagamento?: string | null
          id_bin?: number
          idioma?: string | null
          moeda?: string | null
          nivel_cartao?: string | null
          nome_emissor?: string | null
          numero_bin?: number
          pais_codigo_numerico?: string | null
          pais_nome?: string | null
          site_emissor?: string | null
          telefone_emissor?: string | null
          tipo_cartao?: string | null
          valido?: boolean | null
        }
        Relationships: []
      }
      clientes: {
        Row: {
          id: number
          id_cliente: number
          nome: string
        }
        Insert: {
          id?: number
          id_cliente: number
          nome: string
        }
        Update: {
          id?: number
          id_cliente?: number
          nome?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          active: boolean | null
          code: string
          contact_email: string | null
          contact_phone: string | null
          created_at: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          code: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          code?: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      competitor_research: {
        Row: {
          address: string | null
          attachments: string[] | null
          created_at: string | null
          created_by: string | null
          date_observed: string
          id: string
          latitude: number | null
          longitude: number | null
          notes: string | null
          price: number
          product: Database["public"]["Enums"]["product_type"]
          station_name: string
          station_type: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          attachments?: string[] | null
          created_at?: string | null
          created_by?: string | null
          date_observed: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          price: number
          product: Database["public"]["Enums"]["product_type"]
          station_name: string
          station_type?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          attachments?: string[] | null
          created_at?: string | null
          created_by?: string | null
          date_observed?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          price?: number
          product?: Database["public"]["Enums"]["product_type"]
          station_name?: string
          station_type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      concorrentes: {
        Row: {
          autorizacao: string | null
          bairro: string | null
          bandeira: string | null
          cep: string | null
          classe: string | null
          cnpj: string
          codigo_simp: number | null
          complemento: string | null
          data_obtencao: string | null
          data_publicacao: string | null
          data_vinculacao: string | null
          distruibuidora: string | null
          endereco: string | null
          estimativa_acuracia: string | null
          id_posto: number
          latitude: number | null
          latitude_anpac: number | null
          longitude: number | null
          longitude_anpac: number | null
          municipio: string | null
          observacao: string | null
          origem_informacao: string | null
          razao_social: string
          situacao_constatada: string | null
          src: string | null
          srid: number | null
          status_sigaf: string | null
          uf: string | null
          validacao: string | null
        }
        Insert: {
          autorizacao?: string | null
          bairro?: string | null
          bandeira?: string | null
          cep?: string | null
          classe?: string | null
          cnpj: string
          codigo_simp?: number | null
          complemento?: string | null
          data_obtencao?: string | null
          data_publicacao?: string | null
          data_vinculacao?: string | null
          distruibuidora?: string | null
          endereco?: string | null
          estimativa_acuracia?: string | null
          id_posto?: number
          latitude?: number | null
          latitude_anpac?: number | null
          longitude?: number | null
          longitude_anpac?: number | null
          municipio?: string | null
          observacao?: string | null
          origem_informacao?: string | null
          razao_social: string
          situacao_constatada?: string | null
          src?: string | null
          srid?: number | null
          status_sigaf?: string | null
          uf?: string | null
          validacao?: string | null
        }
        Update: {
          autorizacao?: string | null
          bairro?: string | null
          bandeira?: string | null
          cep?: string | null
          classe?: string | null
          cnpj?: string
          codigo_simp?: number | null
          complemento?: string | null
          data_obtencao?: string | null
          data_publicacao?: string | null
          data_vinculacao?: string | null
          distruibuidora?: string | null
          endereco?: string | null
          estimativa_acuracia?: string | null
          id_posto?: number
          latitude?: number | null
          latitude_anpac?: number | null
          longitude?: number | null
          longitude_anpac?: number | null
          municipio?: string | null
          observacao?: string | null
          origem_informacao?: string | null
          razao_social?: string
          situacao_constatada?: string | null
          src?: string | null
          srid?: number | null
          status_sigaf?: string | null
          uf?: string | null
          validacao?: string | null
        }
        Relationships: []
      }
      concorrentes_importacao: {
        Row: {
          autorizacao: string | null
          bairro: string | null
          bandeira: string | null
          cep: string | null
          classe: string | null
          cnpj: string | null
          codigo_simp: string | null
          complemento: string | null
          data_obtencao: string | null
          data_publicacao: string | null
          data_vinculacao: string | null
          distruibuidora: string | null
          endereco: string | null
          estimativa_acuracia: string | null
          id_posto: string | null
          latitude: string | null
          latitude_anpac: string | null
          longitude: string | null
          longitude_anpac: string | null
          municipio: string | null
          observacao: string | null
          origem_informacao: string | null
          razao_social: string | null
          situacao_constatada: string | null
          src: string | null
          srid: string | null
          status_sigaf: string | null
          uf: string | null
          validacao: string | null
        }
        Insert: {
          autorizacao?: string | null
          bairro?: string | null
          bandeira?: string | null
          cep?: string | null
          classe?: string | null
          cnpj?: string | null
          codigo_simp?: string | null
          complemento?: string | null
          data_obtencao?: string | null
          data_publicacao?: string | null
          data_vinculacao?: string | null
          distruibuidora?: string | null
          endereco?: string | null
          estimativa_acuracia?: string | null
          id_posto?: string | null
          latitude?: string | null
          latitude_anpac?: string | null
          longitude?: string | null
          longitude_anpac?: string | null
          municipio?: string | null
          observacao?: string | null
          origem_informacao?: string | null
          razao_social?: string | null
          situacao_constatada?: string | null
          src?: string | null
          srid?: string | null
          status_sigaf?: string | null
          uf?: string | null
          validacao?: string | null
        }
        Update: {
          autorizacao?: string | null
          bairro?: string | null
          bandeira?: string | null
          cep?: string | null
          classe?: string | null
          cnpj?: string | null
          codigo_simp?: string | null
          complemento?: string | null
          data_obtencao?: string | null
          data_publicacao?: string | null
          data_vinculacao?: string | null
          distruibuidora?: string | null
          endereco?: string | null
          estimativa_acuracia?: string | null
          id_posto?: string | null
          latitude?: string | null
          latitude_anpac?: string | null
          longitude?: string | null
          longitude_anpac?: string | null
          municipio?: string | null
          observacao?: string | null
          origem_informacao?: string | null
          razao_social?: string | null
          situacao_constatada?: string | null
          src?: string | null
          srid?: string | null
          status_sigaf?: string | null
          uf?: string | null
          validacao?: string | null
        }
        Relationships: []
      }
      dispositivos: {
        Row: {
          data_inclusao: string | null
          id: number
          id_localizacao: number | null
          sentido: string | null
        }
        Insert: {
          data_inclusao?: string | null
          id: number
          id_localizacao?: number | null
          sentido?: string | null
        }
        Update: {
          data_inclusao?: string | null
          id?: number
          id_localizacao?: number | null
          sentido?: string | null
        }
        Relationships: []
      }
      eventos_veiculos: {
        Row: {
          brilho_placa: number | null
          comprimento_veiculo: number | null
          cor_placa: string | null
          cor_veiculo: string | null
          data_hora: string | null
          direcao_placa: string | null
          estado_evento: string | null
          id: number
          id_dispositivo: number | null
          id_localizacao: number | null
          json_completo: Json
          modelo_veiculo: string | null
          nivel_confianca: number | null
          placa_veiculo: string | null
          ponto_passagem: string | null
          tipo_evento: string | null
          tipo_placa: string | null
          tipo_veiculo: string | null
          velocidade_veiculo: number | null
        }
        Insert: {
          brilho_placa?: number | null
          comprimento_veiculo?: number | null
          cor_placa?: string | null
          cor_veiculo?: string | null
          data_hora?: string | null
          direcao_placa?: string | null
          estado_evento?: string | null
          id: number
          id_dispositivo?: number | null
          id_localizacao?: number | null
          json_completo: Json
          modelo_veiculo?: string | null
          nivel_confianca?: number | null
          placa_veiculo?: string | null
          ponto_passagem?: string | null
          tipo_evento?: string | null
          tipo_placa?: string | null
          tipo_veiculo?: string | null
          velocidade_veiculo?: number | null
        }
        Update: {
          brilho_placa?: number | null
          comprimento_veiculo?: number | null
          cor_placa?: string | null
          cor_veiculo?: string | null
          data_hora?: string | null
          direcao_placa?: string | null
          estado_evento?: string | null
          id?: number
          id_dispositivo?: number | null
          id_localizacao?: number | null
          json_completo?: Json
          modelo_veiculo?: string | null
          nivel_confianca?: number | null
          placa_veiculo?: string | null
          ponto_passagem?: string | null
          tipo_evento?: string | null
          tipo_placa?: string | null
          tipo_veiculo?: string | null
          velocidade_veiculo?: number | null
        }
        Relationships: []
      }
      localizacao: {
        Row: {
          data_inclusao: string | null
          id: number
          latitude: number | null
          longitude: number | null
          nome: string
        }
        Insert: {
          data_inclusao?: string | null
          id: number
          latitude?: number | null
          longitude?: number | null
          nome: string
        }
        Update: {
          data_inclusao?: string | null
          id?: number
          latitude?: number | null
          longitude?: number | null
          nome?: string
        }
        Relationships: []
      }
      payment_methods: {
        Row: {
          active: boolean | null
          created_at: string | null
          days: number | null
          fee_percentage: number | null
          id: string
          name: string
          type: Database["public"]["Enums"]["payment_type"]
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          days?: number | null
          fee_percentage?: number | null
          id?: string
          name: string
          type: Database["public"]["Enums"]["payment_type"]
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          days?: number | null
          fee_percentage?: number | null
          id?: string
          name?: string
          type?: Database["public"]["Enums"]["payment_type"]
          updated_at?: string | null
        }
        Relationships: []
      }
      postos: {
        Row: {
          autorizacao: string | null
          bairro: string | null
          bandeira: string | null
          cep: string | null
          classe: string | null
          cnpj: string
          codigo_simp: number | null
          complemento: string | null
          data_obtencao: string | null
          data_publicacao: string | null
          data_vinculacao: string | null
          distruibuidora: string | null
          endereco: string | null
          estimativa_acuracia: string | null
          id_posto: number
          latitude: number | null
          latitude_anpac: number | null
          longitude: number | null
          longitude_anpac: number | null
          municipio: string | null
          observacao: string | null
          origem_informacao: string | null
          razao_social: string
          situacao_constatada: string | null
          src: string | null
          srid: number | null
          status_sigaf: string | null
          uf: string | null
          validacao: string | null
        }
        Insert: {
          autorizacao?: string | null
          bairro?: string | null
          bandeira?: string | null
          cep?: string | null
          classe?: string | null
          cnpj: string
          codigo_simp?: number | null
          complemento?: string | null
          data_obtencao?: string | null
          data_publicacao?: string | null
          data_vinculacao?: string | null
          distruibuidora?: string | null
          endereco?: string | null
          estimativa_acuracia?: string | null
          id_posto?: number
          latitude?: number | null
          latitude_anpac?: number | null
          longitude?: number | null
          longitude_anpac?: number | null
          municipio?: string | null
          observacao?: string | null
          origem_informacao?: string | null
          razao_social: string
          situacao_constatada?: string | null
          src?: string | null
          srid?: number | null
          status_sigaf?: string | null
          uf?: string | null
          validacao?: string | null
        }
        Update: {
          autorizacao?: string | null
          bairro?: string | null
          bandeira?: string | null
          cep?: string | null
          classe?: string | null
          cnpj?: string
          codigo_simp?: number | null
          complemento?: string | null
          data_obtencao?: string | null
          data_publicacao?: string | null
          data_vinculacao?: string | null
          distruibuidora?: string | null
          endereco?: string | null
          estimativa_acuracia?: string | null
          id_posto?: number
          latitude?: number | null
          latitude_anpac?: number | null
          longitude?: number | null
          longitude_anpac?: number | null
          municipio?: string | null
          observacao?: string | null
          origem_informacao?: string | null
          razao_social?: string
          situacao_constatada?: string | null
          src?: string | null
          srid?: number | null
          status_sigaf?: string | null
          uf?: string | null
          validacao?: string | null
        }
        Relationships: []
      }
      price_history: {
        Row: {
          approved_by: string
          change_type: string | null
          client_id: string | null
          created_at: string | null
          id: string
          margin_cents: number
          new_price: number
          old_price: number | null
          product: Database["public"]["Enums"]["product_type"]
          station_id: string | null
          suggestion_id: string | null
        }
        Insert: {
          approved_by: string
          change_type?: string | null
          client_id?: string | null
          created_at?: string | null
          id?: string
          margin_cents: number
          new_price: number
          old_price?: number | null
          product: Database["public"]["Enums"]["product_type"]
          station_id?: string | null
          suggestion_id?: string | null
        }
        Update: {
          approved_by?: string
          change_type?: string | null
          client_id?: string | null
          created_at?: string | null
          id?: string
          margin_cents?: number
          new_price?: number
          old_price?: number | null
          product?: Database["public"]["Enums"]["product_type"]
          station_id?: string | null
          suggestion_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "price_history_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_history_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_history_suggestion_id_fkey"
            columns: ["suggestion_id"]
            isOneToOne: false
            referencedRelation: "price_suggestions"
            referencedColumns: ["id"]
          },
        ]
      }
      price_suggestions: {
        Row: {
          approval_level: number | null
          approvals_count: number | null
          approved_at: string | null
          approved_by: string | null
          arla_cost_price: number | null
          arla_purchase_price: number | null
          attachments: string[] | null
          client_id: string | null
          cost_price: number
          created_at: string | null
          created_by: string | null
          current_approver_id: string | null
          current_approver_name: string | null
          current_price: number | null
          final_price: number
          freight_cost: number | null
          id: string
          margin_cents: number
          observations: string | null
          payment_method_id: string | null
          price_origin_base: string | null
          price_origin_code: string | null
          price_origin_delivery: string | null
          price_origin_uf: string | null
          product: Database["public"]["Enums"]["product_type"]
          purchase_cost: number | null
          reference_id: string | null
          reference_type: Database["public"]["Enums"]["reference_type"] | null
          rejections_count: number | null
          requested_by: string | null
          station_id: string | null
          status: Database["public"]["Enums"]["approval_status"] | null
          suggested_price: number | null
          total_approvers: number | null
          updated_at: string | null
          volume_made: number | null
          volume_projected: number | null
        }
        Insert: {
          approval_level?: number | null
          approvals_count?: number | null
          approved_at?: string | null
          approved_by?: string | null
          arla_cost_price?: number | null
          arla_purchase_price?: number | null
          attachments?: string[] | null
          client_id?: string | null
          cost_price: number
          created_at?: string | null
          created_by?: string | null
          current_approver_id?: string | null
          current_approver_name?: string | null
          current_price?: number | null
          final_price: number
          freight_cost?: number | null
          id?: string
          margin_cents: number
          observations?: string | null
          payment_method_id?: string | null
          price_origin_base?: string | null
          price_origin_code?: string | null
          price_origin_delivery?: string | null
          price_origin_uf?: string | null
          product: Database["public"]["Enums"]["product_type"]
          purchase_cost?: number | null
          reference_id?: string | null
          reference_type?: Database["public"]["Enums"]["reference_type"] | null
          rejections_count?: number | null
          requested_by?: string | null
          station_id?: string | null
          status?: Database["public"]["Enums"]["approval_status"] | null
          suggested_price?: number | null
          total_approvers?: number | null
          updated_at?: string | null
          volume_made?: number | null
          volume_projected?: number | null
        }
        Update: {
          approval_level?: number | null
          approvals_count?: number | null
          approved_at?: string | null
          approved_by?: string | null
          arla_cost_price?: number | null
          arla_purchase_price?: number | null
          attachments?: string[] | null
          client_id?: string | null
          cost_price?: number
          created_at?: string | null
          created_by?: string | null
          current_approver_id?: string | null
          current_approver_name?: string | null
          current_price?: number | null
          final_price?: number
          freight_cost?: number | null
          id?: string
          margin_cents?: number
          observations?: string | null
          payment_method_id?: string | null
          price_origin_base?: string | null
          price_origin_code?: string | null
          price_origin_delivery?: string | null
          price_origin_uf?: string | null
          product?: Database["public"]["Enums"]["product_type"]
          purchase_cost?: number | null
          reference_id?: string | null
          reference_type?: Database["public"]["Enums"]["reference_type"] | null
          rejections_count?: number | null
          requested_by?: string | null
          station_id?: string | null
          status?: Database["public"]["Enums"]["approval_status"] | null
          suggested_price?: number | null
          total_approvers?: number | null
          updated_at?: string | null
          volume_made?: number | null
          volume_projected?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "price_suggestions_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_permissions: {
        Row: {
          admin: boolean
          approvals: boolean
          can_approve: boolean
          can_delete: boolean
          can_edit: boolean
          can_manage_notifications: boolean
          can_register: boolean
          can_view_history: boolean
          created_at: string | null
          dashboard: boolean
          id: string
          map: boolean
          perfil: string
          price_history: boolean
          price_request: boolean
          reference_registration: boolean
          research: boolean
          updated_at: string | null
        }
        Insert: {
          admin?: boolean
          approvals?: boolean
          can_approve?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_manage_notifications?: boolean
          can_register?: boolean
          can_view_history?: boolean
          created_at?: string | null
          dashboard?: boolean
          id?: string
          map?: boolean
          perfil: string
          price_history?: boolean
          price_request?: boolean
          reference_registration?: boolean
          research?: boolean
          updated_at?: string | null
        }
        Update: {
          admin?: boolean
          approvals?: boolean
          can_approve?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_manage_notifications?: boolean
          can_register?: boolean
          can_view_history?: boolean
          created_at?: string | null
          dashboard?: boolean
          id?: string
          map?: boolean
          perfil?: string
          price_history?: boolean
          price_request?: boolean
          reference_registration?: boolean
          research?: boolean
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          id: string
          must_change_password: boolean | null
          nome: string | null
        }
        Insert: {
          created_at?: string | null
          id: string
          must_change_password?: boolean | null
          nome?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          must_change_password?: boolean | null
          nome?: string | null
        }
        Relationships: []
      }
      referencias: {
        Row: {
          anexo: string | null
          cliente_id: string
          codigo_referencia: string
          created_at: string | null
          criado_por: string | null
          id: string
          latitude: number | null
          longitude: number | null
          observacoes: string | null
          posto_id: string
          preco_referencia: number
          produto: string
          tipo_pagamento_id: string | null
          updated_at: string | null
        }
        Insert: {
          anexo?: string | null
          cliente_id: string
          codigo_referencia?: string
          created_at?: string | null
          criado_por?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          observacoes?: string | null
          posto_id: string
          preco_referencia: number
          produto: string
          tipo_pagamento_id?: string | null
          updated_at?: string | null
        }
        Update: {
          anexo?: string | null
          cliente_id?: string
          codigo_referencia?: string
          created_at?: string | null
          criado_por?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          observacoes?: string | null
          posto_id?: string
          preco_referencia?: number
          produto?: string
          tipo_pagamento_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referencias_tipo_pagamento_id_fkey"
            columns: ["tipo_pagamento_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      sis_empresa: {
        Row: {
          bandeira: string | null
          cluster: string | null
          cnpj_cpf: string | null
          ipp_code: string | null
          latitude: number | null
          longitude: number | null
          municipio: string | null
          nome: string | null
          nome_empresa: string | null
          raizen_code: string | null
          rede: string | null
          regiao: string | null
          registro_ativo: string | null
          squad: string | null
          supervisor: string | null
          tipo: string | null
          uf: string | null
          vibra_code: string | null
        }
        Insert: {
          bandeira?: string | null
          cluster?: string | null
          cnpj_cpf?: string | null
          ipp_code?: string | null
          latitude?: number | null
          longitude?: number | null
          municipio?: string | null
          nome?: string | null
          nome_empresa?: string | null
          raizen_code?: string | null
          rede?: string | null
          regiao?: string | null
          registro_ativo?: string | null
          squad?: string | null
          supervisor?: string | null
          tipo?: string | null
          uf?: string | null
          vibra_code?: string | null
        }
        Update: {
          bandeira?: string | null
          cluster?: string | null
          cnpj_cpf?: string | null
          ipp_code?: string | null
          latitude?: number | null
          longitude?: number | null
          municipio?: string | null
          nome?: string | null
          nome_empresa?: string | null
          raizen_code?: string | null
          rede?: string | null
          regiao?: string | null
          registro_ativo?: string | null
          squad?: string | null
          supervisor?: string | null
          tipo?: string | null
          uf?: string | null
          vibra_code?: string | null
        }
        Relationships: []
      }
      stations: {
        Row: {
          active: boolean | null
          address: string | null
          code: string
          created_at: string | null
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          address?: string | null
          code: string
          created_at?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          address?: string | null
          code?: string
          created_at?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      tipos_pagamento: {
        Row: {
          CARTAO: string | null
          ID_POSTO: string | null
          POSTO: string | null
          PRAZO: string | null
          TAXA: number | null
        }
        Insert: {
          CARTAO?: string | null
          ID_POSTO?: string | null
          POSTO?: string | null
          PRAZO?: string | null
          TAXA?: number | null
        }
        Update: {
          CARTAO?: string | null
          ID_POSTO?: string | null
          POSTO?: string | null
          PRAZO?: string | null
          TAXA?: number | null
        }
        Relationships: []
      }
      traducoes: {
        Row: {
          categoria: string
          codigo: string
          descricao: string
          id: number
        }
        Insert: {
          categoria: string
          codigo: string
          descricao: string
          id: number
        }
        Update: {
          categoria?: string
          codigo?: string
          descricao?: string
          id?: number
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          ativo: boolean
          cargo: string | null
          created_at: string | null
          email: string
          id: string
          max_approval_margin: number | null
          nome: string
          perfil: string | null
          role: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          ativo?: boolean
          cargo?: string | null
          created_at?: string | null
          email: string
          id?: string
          max_approval_margin?: number | null
          nome: string
          perfil?: string | null
          role?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          ativo?: boolean
          cargo?: string | null
          created_at?: string | null
          email?: string
          id?: string
          max_approval_margin?: number | null
          nome?: string
          perfil?: string | null
          role?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      vw_eventos_veiculos: {
        Row: {
          brilho_placa: number | null
          cor_veiculo: string | null
          data_hora: string | null
          direcao_placa: string | null
          id: number | null
          id_dispositivo: number | null
          id_localizacao: number | null
          latitude: number | null
          localizacao: string | null
          longitude: number | null
          nivel_confianca: number | null
          placa_veiculo: string | null
          ponto_passagem: string | null
          sentido: string | null
          tipo_veiculo: string | null
          velocidade_veiculo: number | null
        }
        Insert: {
          brilho_placa?: number | null
          cor_veiculo?: string | null
          data_hora?: string | null
          direcao_placa?: string | null
          id?: number | null
          id_dispositivo?: number | null
          id_localizacao?: number | null
          latitude?: number | null
          localizacao?: string | null
          longitude?: number | null
          nivel_confianca?: number | null
          placa_veiculo?: string | null
          ponto_passagem?: string | null
          sentido?: string | null
          tipo_veiculo?: string | null
          velocidade_veiculo?: number | null
        }
        Update: {
          brilho_placa?: number | null
          cor_veiculo?: string | null
          data_hora?: string | null
          direcao_placa?: string | null
          id?: number | null
          id_dispositivo?: number | null
          id_localizacao?: number | null
          latitude?: number | null
          localizacao?: string | null
          longitude?: number | null
          nivel_confianca?: number | null
          placa_veiculo?: string | null
          ponto_passagem?: string | null
          sentido?: string | null
          tipo_veiculo?: string | null
          velocidade_veiculo?: number | null
        }
        Relationships: []
      }
      vw_eventos_veiculos_consolidados: {
        Row: {
          classe_veiculo: string | null
          data_hora: string | null
          id_localizacao: number | null
          latitude: number | null
          longitude: number | null
          nome: string | null
          quantidade: number | null
          tipo_veiculo: string | null
        }
        Insert: {
          classe_veiculo?: string | null
          data_hora?: string | null
          id_localizacao?: number | null
          latitude?: number | null
          longitude?: number | null
          nome?: string | null
          quantidade?: number | null
          tipo_veiculo?: string | null
        }
        Update: {
          classe_veiculo?: string | null
          data_hora?: string | null
          id_localizacao?: number | null
          latitude?: number | null
          longitude?: number | null
          nome?: string | null
          quantidade?: number | null
          tipo_veiculo?: string | null
        }
        Relationships: []
      }
      vwbi_empresa: {
        Row: {
          id_empresa: number | null
          latitude: number | null
          longitude: number | null
          nome_empresa: string | null
        }
        Insert: {
          id_empresa?: number | null
          latitude?: number | null
          longitude?: number | null
          nome_empresa?: string | null
        }
        Update: {
          id_empresa?: number | null
          latitude?: number | null
          longitude?: number | null
          nome_empresa?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_lowest_cost_freight: {
        Args: { p_date?: string; p_posto_id: string; p_produto: string }
        Returns: {
          base_codigo: string
          base_id: string
          base_nome: string
          base_uf: string
          custo: number
          custo_total: number
          data_referencia: string
          forma_entrega: string
          frete: number
        }[]
      }
      get_sis_empresa_stations: {
        Args: never
        Returns: {
          bandeira: string
          cnpj_cpf: string
          latitude: number
          longitude: number
          nome_empresa: string
          rede: string
          registro_ativo: string
        }[]
      }
      postgres_fdw_disconnect: { Args: { "": string }; Returns: boolean }
      postgres_fdw_disconnect_all: { Args: never; Returns: boolean }
      postgres_fdw_get_connections: {
        Args: never
        Returns: Record<string, unknown>[]
      }
      postgres_fdw_handler: { Args: never; Returns: unknown }
      unaccent: { Args: { "": string }; Returns: string }
    }
    Enums: {
      approval_status: "pending" | "approved" | "rejected" | "draft"
      payment_type: "vista" | "cartao_28" | "cartao_35"
      product_type:
        | "etanol"
        | "gasolina_comum"
        | "gasolina_aditivada"
        | "s10"
        | "s500"
      reference_type:
        | "nf"
        | "print_portal"
        | "print_conversa"
        | "sem_referencia"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      approval_status: ["pending", "approved", "rejected", "draft"],
      payment_type: ["vista", "cartao_28", "cartao_35"],
      product_type: [
        "etanol",
        "gasolina_comum",
        "gasolina_aditivada",
        "s10",
        "s500",
      ],
      reference_type: [
        "nf",
        "print_portal",
        "print_conversa",
        "sem_referencia",
      ],
    },
  },
} as const
