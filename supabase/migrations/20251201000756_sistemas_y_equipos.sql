-- ============================================================================
-- MIGRACIÓN: Sistemas y Equipos de Cliente
-- Descripción: Crea el catálogo de sistemas y mejora la tabla de equipos
-- para soportar la relación Cliente -> Equipos -> Sistema
-- ============================================================================

-- 1. TABLA SISTEMAS (Catálogo maestro de tipos de equipos)
-- ============================================================================
create table if not exists public.sistemas (
    id uuid primary key default gen_random_uuid(),
    nombre text not null unique,                    -- "Ablandador 25 CAB", "Osmosis 300 l/h"
    codigo text unique,                             -- "SOFTN25LPFC", "OHMRO300LTS"
    descripcion text,                               -- Descripción técnica del sistema
    imagen_url text,                                -- URL de la imagen del sistema
    vida_util_dias integer default 365,             -- Vida útil en días
    categoria text,                                 -- Categoría: 'ablandador', 'osmosis', 'hplc', etc.
    activo boolean default true,                    -- Para soft delete
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Índices para búsqueda rápida
create index if not exists idx_sistemas_nombre on public.sistemas (nombre);
create index if not exists idx_sistemas_codigo on public.sistemas (codigo);
create index if not exists idx_sistemas_categoria on public.sistemas (categoria);

-- 2. MODIFICAR TABLA EQUIPMENTS (Equipos asignados a clientes)
-- ============================================================================

-- Agregar columna sistema_id para relacionar con el catálogo
alter table public.equipments 
    add column if not exists sistema_id uuid references public.sistemas(id) on delete set null;

-- Agregar columna tag_id (identificador interno/TAG del cliente)
alter table public.equipments 
    add column if not exists tag_id text;

-- Agregar columna para fecha de instalación
alter table public.equipments 
    add column if not exists fecha_instalacion date;

-- Agregar columna para notas/observaciones
alter table public.equipments 
    add column if not exists notas text;

-- Agregar columna activo para soft delete
alter table public.equipments 
    add column if not exists activo boolean default true;

-- Agregar timestamps
alter table public.equipments 
    add column if not exists created_at timestamptz default now();

alter table public.equipments 
    add column if not exists updated_at timestamptz default now();

-- Índice para búsqueda por cliente
create index if not exists idx_equipments_client_id on public.equipments (client_id);
create index if not exists idx_equipments_sistema_id on public.equipments (sistema_id);
create index if not exists idx_equipments_serial_number on public.equipments (serial_number);

-- 3. RLS PARA SISTEMAS
-- ============================================================================
alter table public.sistemas enable row level security;

-- Políticas para sistemas (lectura para todos los autenticados, escritura solo admin)
create policy "Lectura sistemas para autenticados" on public.sistemas
    for select using (auth.role() = 'authenticated');

create policy "Gestión sistemas solo admin" on public.sistemas
    for all using (
        exists (
            select 1 from public.profiles 
            where id = auth.uid() and role = 'admin'
        )
    )
    with check (
        exists (
            select 1 from public.profiles 
            where id = auth.uid() and role = 'admin'
        )
    );

-- 4. FUNCIÓN PARA ACTUALIZAR updated_at
-- ============================================================================
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

-- Triggers para updated_at
drop trigger if exists update_sistemas_updated_at on public.sistemas;
create trigger update_sistemas_updated_at
    before update on public.sistemas
    for each row execute function public.update_updated_at_column();

drop trigger if exists update_equipments_updated_at on public.equipments;
create trigger update_equipments_updated_at
    before update on public.equipments
    for each row execute function public.update_updated_at_column();

-- 5. VISTA PARA CONSULTA FÁCIL DE EQUIPOS CON DATOS DEL SISTEMA
-- ============================================================================
create or replace view public.equipos_cliente_view as
select 
    e.id as equipo_id,
    e.serial_number as serie,
    e.modelo,
    e.tag_id,
    e.fecha_instalacion,
    e.notas,
    e.activo as equipo_activo,
    e.created_at as equipo_created_at,
    s.id as sistema_id,
    s.nombre as sistema_nombre,
    s.codigo as sistema_codigo,
    s.descripcion as sistema_descripcion,
    s.categoria as sistema_categoria,
    s.vida_util_dias,
    c.id as cliente_id,
    c.razon_social as cliente_nombre,
    c.direccion as cliente_direccion
from public.equipments e
left join public.sistemas s on e.sistema_id = s.id
left join public.clients c on e.client_id = c.id
where e.activo = true;

-- 6. FUNCIÓN PARA OBTENER EQUIPOS DE UN CLIENTE
-- ============================================================================
create or replace function public.get_equipos_cliente(p_client_id uuid)
returns table (
    equipo_id uuid,
    serie text,
    modelo text,
    tag_id text,
    sistema_id uuid,
    sistema_nombre text,
    sistema_codigo text,
    sistema_categoria text
) as $$
begin
    return query
    select 
        e.id,
        e.serial_number,
        e.modelo,
        e.tag_id,
        s.id,
        s.nombre,
        s.codigo,
        s.categoria
    from public.equipments e
    left join public.sistemas s on e.sistema_id = s.id
    where e.client_id = p_client_id
    and e.activo = true
    order by s.nombre, e.serial_number;
end;
$$ language plpgsql security definer;

-- 7. COMENTARIOS PARA DOCUMENTACIÓN
-- ============================================================================
comment on table public.sistemas is 'Catálogo maestro de tipos de sistemas/equipos disponibles';
comment on column public.sistemas.nombre is 'Nombre comercial del sistema (ej: Ablandador 25 CAB)';
comment on column public.sistemas.codigo is 'Código interno del producto (ej: SOFTN25LPFC)';
comment on column public.sistemas.categoria is 'Categoría del sistema: ablandador, osmosis, hplc, etc.';

comment on column public.equipments.sistema_id is 'Referencia al tipo de sistema del catálogo';
comment on column public.equipments.tag_id is 'TAG o ID interno que usa el cliente para identificar el equipo';
comment on column public.equipments.serial_number is 'Número de serie único del equipo';
