-- Script para limpar todos os dados de aprovações, referências e histórico
-- Execute este script para resetar o sistema para uso inicial
-- ATENÇÃO: Este script deleta TODOS os dados das tabelas relacionadas!

-- Ordem de deleção respeitando as foreign keys:

-- 1. Deletar histórico de aprovações primeiro (tem FK para price_suggestions)
DELETE FROM public.approval_history;

-- 2. Deletar histórico de preços (tem FK para price_suggestions)
DELETE FROM public.price_history;

-- 3. Deletar referências (pode ter relação com price_suggestions)
DELETE FROM public.referencias;

-- 4. Deletar todas as sugestões de preço (tabela principal)
DELETE FROM public.price_suggestions;

-- 5. Deletar pesquisa de concorrentes (independente, mas relacionada ao contexto)
DELETE FROM public.competitor_research;

-- Verificar se há outras tabelas relacionadas que precisam ser limpas
-- Notificações (se existir)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications') THEN
    DELETE FROM public.notifications;
  END IF;
END $$;

-- Resetar contadores de sequência (se houver)
-- Isso garante que os IDs começem do zero novamente
DO $$ 
BEGIN
  -- Resetar sequências relacionadas (se existirem)
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'price_suggestions_id_seq') THEN
    ALTER SEQUENCE public.price_suggestions_id_seq RESTART WITH 1;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'approval_history_id_seq') THEN
    ALTER SEQUENCE public.approval_history_id_seq RESTART WITH 1;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'price_history_id_seq') THEN
    ALTER SEQUENCE public.price_history_id_seq RESTART WITH 1;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'referencias_id_seq') THEN
    ALTER SEQUENCE public.referencias_id_seq RESTART WITH 1;
  END IF;
END $$;

-- Mensagem de confirmação
DO $$ 
BEGIN
  RAISE NOTICE '✅ Limpeza concluída! Todas as tabelas de aprovações, referências e histórico foram limpas.';
  RAISE NOTICE '📋 Tabelas limpas:';
  RAISE NOTICE '   - approval_history';
  RAISE NOTICE '   - price_history';
  RAISE NOTICE '   - referencias';
  RAISE NOTICE '   - price_suggestions';
  RAISE NOTICE '   - competitor_research';
  RAISE NOTICE '   - notifications (se existir)';
END $$;







