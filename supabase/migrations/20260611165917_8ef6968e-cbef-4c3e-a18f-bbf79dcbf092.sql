-- Restringe lectura directa de qualified_persons (firmas, CV, licencias, historial CDV)
drop policy if exists "Anyone authenticated views qualified_persons" on public.qualified_persons;

create policy "QPs view own record or super admin"
on public.qualified_persons
for select
to authenticated
using (auth.uid() = user_id or is_super_admin(auth.uid()));

-- Directorio seguro de QPs: solo columnas no sensibles
create or replace function public.list_qualified_persons_directory()
returns table (
  id uuid,
  user_id uuid,
  full_name text,
  profession text,
  registration_body text,
  competency_areas text[],
  bio text,
  is_verified boolean,
  country text,
  accreditation_type text,
  accreditation_grade text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select id, user_id, full_name, profession, registration_body,
         competency_areas, bio, is_verified, country,
         accreditation_type, accreditation_grade, created_at, updated_at
  from public.qualified_persons
  order by full_name
$$;

revoke all on function public.list_qualified_persons_directory() from public;
grant execute on function public.list_qualified_persons_directory() to authenticated;
grant execute on function public.list_qualified_persons_directory() to service_role;