-- Ensure UUID helpers exist for default IDs
create extension if not exists "pgcrypto";

-- Profiles table mirrors auth.users and stores domain metadata
create table if not exists public.profiles (
	id uuid primary key references auth.users (id) on delete cascade,
	email text,
	full_name text,
	role text not null default 'tecnico'
);

-- Sync auth.users inserts into public.profiles automatically
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
	insert into public.profiles (id, email, full_name)
	values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''))
	on conflict (id) do nothing;
	return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
	after insert on auth.users
	for each row execute function public.handle_new_user();

-- Clients catalogue
create table if not exists public.clients (
	id uuid primary key default gen_random_uuid(),
	razon_social text not null,
	cuit text,
	direccion text,
	contacto_info jsonb
);

-- Equipments belonging to clients
create table if not exists public.equipments (
	id uuid primary key default gen_random_uuid(),
	client_id uuid references public.clients (id) on delete set null,
	modelo text,
	serial_number text,
	type text check (type in ('ro', 'softener'))
);

-- Maintenances central table storing full report payload
create table if not exists public.maintenances (
	id uuid primary key default gen_random_uuid(),
	client_id uuid references public.clients (id) on delete set null,
	equipment_id uuid references public.equipments (id) on delete set null,
	technician_id uuid references public.profiles (id) on delete set null,
	service_date timestamptz not null default now(),
	status text not null default 'borrador',
	report_data jsonb
);

-- Enable Row Level Security on core tables
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.equipments enable row level security;
alter table public.maintenances enable row level security;

-- Simple policy granting authenticated users full access for now
create policy "Permitir todo a usuarios autenticados" on public.profiles
	for all using (auth.role() = 'authenticated')
	with check (auth.role() = 'authenticated');

create policy "Permitir todo a usuarios autenticados" on public.clients
	for all using (auth.role() = 'authenticated')
	with check (auth.role() = 'authenticated');

create policy "Permitir todo a usuarios autenticados" on public.equipments
	for all using (auth.role() = 'authenticated')
	with check (auth.role() = 'authenticated');

create policy "Permitir todo a usuarios autenticados" on public.maintenances
	for all using (auth.role() = 'authenticated')
	with check (auth.role() = 'authenticated');
