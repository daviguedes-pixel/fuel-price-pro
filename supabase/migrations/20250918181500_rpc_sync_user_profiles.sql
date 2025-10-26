-- Creates a SECURITY DEFINER function to sync user_profiles from auth.users
create or replace function public.sync_user_profiles()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer := 0;
begin
  with to_insert as (
    select
      u.id as user_id,
      coalesce(u.email, '') as email,
      coalesce(split_part(u.email, '@', 1), 'Usuário') as nome
    from auth.users u
    left join public.user_profiles up on up.user_id = u.id
    where up.user_id is null
  ), ins as (
    insert into public.user_profiles (user_id, email, nome, role, ativo)
    select user_id, email, nome, 'analista'::public.user_role, true
    from to_insert
    returning 1
  )
  select count(*) into inserted_count from ins;

  return inserted_count;
end;
$$;

revoke all on function public.sync_user_profiles() from public;
grant execute on function public.sync_user_profiles() to authenticated;



