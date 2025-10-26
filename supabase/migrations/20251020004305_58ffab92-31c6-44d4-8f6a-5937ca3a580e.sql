-- Ensure RLS is enabled (already enabled in schema, but safe to include)
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Allow users to update their own profile
DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles;
CREATE POLICY "Users can update their own profile"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Allow fixed admin (by email) to update any profile
DROP POLICY IF EXISTS "Fixed admin can update any profile" ON public.user_profiles;
CREATE POLICY "Fixed admin can update any profile"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.user_profiles up
  WHERE up.user_id = auth.uid()
    AND up.email = 'davi.guedes@redesaoroque.com.br'
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.user_profiles up
  WHERE up.user_id = auth.uid()
    AND up.email = 'davi.guedes@redesaoroque.com.br'
));