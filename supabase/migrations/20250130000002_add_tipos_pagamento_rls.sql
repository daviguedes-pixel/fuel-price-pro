-- Habilitar RLS na tabela tipos_pagamento se ainda não estiver habilitado
ALTER TABLE IF EXISTS public.tipos_pagamento ENABLE ROW LEVEL SECURITY;

-- Política para permitir que todos os usuários autenticados vejam os tipos de pagamento
DROP POLICY IF EXISTS "All authenticated users can view payment types" ON public.tipos_pagamento;
CREATE POLICY "All authenticated users can view payment types" 
ON public.tipos_pagamento 
FOR SELECT 
USING (auth.role() = 'authenticated');

-- Política para permitir que usuários autenticados insiram tipos de pagamento
DROP POLICY IF EXISTS "All authenticated users can insert payment types" ON public.tipos_pagamento;
CREATE POLICY "All authenticated users can insert payment types" 
ON public.tipos_pagamento 
FOR INSERT 
TO authenticated
WITH CHECK (auth.role() = 'authenticated');

-- Política para permitir que usuários autenticados atualizem tipos de pagamento
DROP POLICY IF EXISTS "All authenticated users can update payment types" ON public.tipos_pagamento;
CREATE POLICY "All authenticated users can update payment types" 
ON public.tipos_pagamento 
FOR UPDATE 
TO authenticated
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Política para permitir que usuários autenticados deletem tipos de pagamento
DROP POLICY IF EXISTS "All authenticated users can delete payment types" ON public.tipos_pagamento;
CREATE POLICY "All authenticated users can delete payment types" 
ON public.tipos_pagamento 
FOR DELETE 
TO authenticated
USING (auth.role() = 'authenticated');


