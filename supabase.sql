create type public.user_role as enum ('admin','dj','venue');
create table public.profiles(id uuid primary key references auth.users(id) on delete cascade,name text default '',role public.user_role default 'dj',function_or_venue text default '',phone text default '',email text default '',address text default '',favorite_styles text default '',created_at timestamptz default now(),updated_at timestamptz default now());
create table public.bookings(id uuid primary key default gen_random_uuid(),booking_date date not null,venue_id uuid references public.profiles(id) on delete set null,dj_id uuid references public.profiles(id) on delete set null,time_text text default '',booking_type text default 'Soirée DJ',status text default 'Confirmé',notes text default '',created_by uuid references public.profiles(id) on delete cascade,created_at timestamptz default now());
create table public.date_requests(id uuid primary key default gen_random_uuid(),requested_date date not null,venue_id uuid references public.profiles(id) on delete cascade,time_text text default '',notes text default '',status text default 'En attente',created_at timestamptz default now());
create table public.applications(id uuid primary key default gen_random_uuid(),booking_id uuid references public.bookings(id) on delete cascade,dj_id uuid references public.profiles(id) on delete cascade,message text default '',status text default 'En attente',created_at timestamptz default now(),unique(booking_id,dj_id));
create table public.conversations(id uuid primary key default gen_random_uuid(),created_at timestamptz default now());
create table public.conversation_members(conversation_id uuid references public.conversations(id) on delete cascade,user_id uuid references public.profiles(id) on delete cascade,primary key(conversation_id,user_id));
create table public.messages(id uuid primary key default gen_random_uuid(),conversation_id uuid references public.conversations(id) on delete cascade,sender_id uuid references public.profiles(id) on delete cascade,body text not null,created_at timestamptz default now(),read_at timestamptz);
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  insert into public.profiles(
    id,
    email,
    name,
    role,
    phone,
    address,
    approval_status
  )
  values(
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name',''),
    case
      when new.raw_user_meta_data->>'requested_role' = 'venue'
        then 'venue'::public.user_role
      else
        'dj'::public.user_role
    end,
    coalesce(new.raw_user_meta_data->>'phone',''),
    coalesce(new.raw_user_meta_data->>'address',''),
    'pending'
  );

  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();
alter table public.profiles enable row level security; alter table public.bookings enable row level security; alter table public.date_requests enable row level security; alter table public.applications enable row level security; alter table public.conversations enable row level security; alter table public.conversation_members enable row level security; alter table public.messages enable row level security;
create or replace function public.my_role() returns public.user_role language sql stable security definer set search_path=public as $$select role from public.profiles where id=auth.uid()$$;
create policy profiles_read on public.profiles for select to authenticated using(true); create policy profiles_update on public.profiles for update to authenticated using(id=auth.uid() or public.my_role()='admin') with check(id=auth.uid() or public.my_role()='admin');
create policy bookings_read on public.bookings for select to authenticated using(public.my_role()='admin' or created_by=auth.uid() or dj_id=auth.uid() or venue_id=auth.uid()); create policy bookings_insert on public.bookings for insert to authenticated with check(public.my_role()='admin'); create policy bookings_update on public.bookings for update to authenticated using(public.my_role()='admin') with check(public.my_role()='admin'); create policy bookings_delete on public.bookings for delete to authenticated using(public.my_role()='admin');
create policy requests_read on public.date_requests for select to authenticated using(public.my_role()='admin' or venue_id=auth.uid()); create policy requests_insert on public.date_requests for insert to authenticated with check(public.my_role()='venue' and venue_id=auth.uid());
create policy applications_read on public.applications for select to authenticated using(public.my_role()='admin' or dj_id=auth.uid()); create policy applications_insert on public.applications for insert to authenticated with check(public.my_role()='dj' and dj_id=auth.uid());
create policy conv_read on public.conversations for select to authenticated using(exists(select 1 from public.conversation_members m where m.conversation_id=id and m.user_id=auth.uid())); create policy conv_insert on public.conversations for insert to authenticated with check(true);
create policy members_read on public.conversation_members for select to authenticated using(user_id=auth.uid() or public.my_role()='admin'); create policy members_insert on public.conversation_members for insert to authenticated with check(user_id=auth.uid() or public.my_role()='admin');
create policy messages_read on public.messages for select to authenticated using(exists(select 1 from public.conversation_members m where m.conversation_id=messages.conversation_id and m.user_id=auth.uid())); create policy messages_insert on public.messages for insert to authenticated with check(sender_id=auth.uid() and exists(select 1 from public.conversation_members m where m.conversation_id=messages.conversation_id and m.user_id=auth.uid())); create policy messages_update on public.messages for update to authenticated using(exists(select 1 from public.conversation_members m where m.conversation_id=messages.conversation_id and m.user_id=auth.uid()));
-- Après création du premier compte :
-- update public.profiles set role='admin' where email='TON_EMAIL';
-- ==========================================
-- VALIDATION DES COMPTES À L'INSCRIPTION
-- ==========================================

alter table public.profiles
add column if not exists approval_status text
not null
default 'approved'
check (approval_status in ('pending', 'approved', 'rejected'));

-- Tous les comptes déjà existants restent validés
update public.profiles
set approval_status = 'approved'
where approval_status is null;
