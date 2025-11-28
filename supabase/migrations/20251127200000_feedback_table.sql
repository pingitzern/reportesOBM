-- Tabla para tickets de feedback de usuarios
create table if not exists public.feedback (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz not null default now(),
    user_email text,
    user_id uuid references public.profiles (id) on delete set null,
    categoria text not null check (categoria in ('bug', 'mejora', 'rendimiento', 'otro')),
    impacto text not null check (impacto in ('bajo', 'medio', 'alto', 'critico')),
    mensaje text not null,
    contacto_info text,
    permitir_contacto boolean default false,
    origen_url text,
    user_agent text,
    estado text not null default 'nuevo' check (estado in ('nuevo', 'en_revision', 'resuelto', 'cerrado'))
);

-- Enable RLS
alter table public.feedback enable row level security;

-- Política: usuarios autenticados pueden crear tickets
create policy "Usuarios pueden crear feedback" on public.feedback
    for insert
    with check (auth.role() = 'authenticated');

-- Política: usuarios pueden ver sus propios tickets
create policy "Usuarios ven su propio feedback" on public.feedback
    for select
    using (auth.uid() = user_id OR user_email = auth.email());

-- Política: admins pueden ver y modificar todos
create policy "Admins gestionan todo el feedback" on public.feedback
    for all
    using (
        exists (
            select 1 from public.profiles
            where id = auth.uid() and role = 'admin'
        )
    );
