-- Migración: Tabla de Remitos para gestión completa
-- Fecha: 2025-11-27

-- Función para generar número de remito secuencial
create or replace function public.generate_remito_number()
returns text
language plpgsql
as $$
declare
    current_year text;
    next_seq int;
    remito_number text;
begin
    current_year := to_char(now(), 'YYYY');
    
    -- Obtener el siguiente número secuencial del año actual
    select coalesce(max(
        case 
            when numero_remito ~ ('^R' || current_year || '-[0-9]+$')
            then substring(numero_remito from 'R' || current_year || '-([0-9]+)$')::int
            else 0
        end
    ), 0) + 1
    into next_seq
    from public.remitos
    where numero_remito like 'R' || current_year || '-%';
    
    remito_number := 'R' || current_year || '-' || lpad(next_seq::text, 5, '0');
    
    return remito_number;
end;
$$;

-- Tabla principal de remitos
create table if not exists public.remitos (
    id uuid primary key default gen_random_uuid(),
    
    -- Número único de remito (formato: R2025-00001)
    numero_remito text unique not null default public.generate_remito_number(),
    
    -- Referencias opcionales
    numero_reporte text,                                          -- Número del reporte de mantenimiento origen
    maintenance_id uuid references public.maintenances(id) on delete set null,  -- Relación con mantenimiento
    client_id uuid references public.clients(id) on delete set null,            -- Relación con cliente
    technician_id uuid references public.profiles(id) on delete set null,       -- Técnico responsable
    
    -- Datos del remito
    fecha_remito timestamptz not null default now(),              -- Fecha de emisión del remito
    fecha_servicio timestamptz,                                    -- Fecha del servicio realizado
    
    -- Datos del cliente (snapshot al momento del remito)
    cliente_nombre text,                                           -- Razón social / nombre
    direccion text,
    telefono text,
    email text,
    cuit text,
    
    -- Datos del equipo (snapshot)
    equipo_descripcion text,
    equipo_modelo text,
    equipo_serie text,
    equipo_interno text,
    equipo_ubicacion text,
    
    -- Contenido del remito
    observaciones text,
    repuestos jsonb default '[]'::jsonb,                          -- Array de {codigo, descripcion, cantidad}
    
    -- Fotos (referencias a Storage)
    foto_1_path text,                                              -- Path en Storage: remitos/{id}/foto_1.jpg
    foto_2_path text,
    foto_3_path text,
    foto_4_path text,
    
    -- Metadatos
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    created_by uuid references public.profiles(id) on delete set null
);

-- Índices para búsquedas frecuentes
create index if not exists idx_remitos_numero on public.remitos(numero_remito);
create index if not exists idx_remitos_cliente on public.remitos(client_id);
create index if not exists idx_remitos_fecha on public.remitos(fecha_remito desc);
create index if not exists idx_remitos_maintenance on public.remitos(maintenance_id);

-- Trigger para actualizar updated_at automáticamente
create or replace function public.update_remitos_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists trigger_remitos_updated_at on public.remitos;
create trigger trigger_remitos_updated_at
    before update on public.remitos
    for each row
    execute function public.update_remitos_updated_at();

-- Habilitar RLS
alter table public.remitos enable row level security;

-- Política: usuarios autenticados pueden hacer todo
create policy "Permitir todo a usuarios autenticados" on public.remitos
    for all 
    using (auth.role() = 'authenticated')
    with check (auth.role() = 'authenticated');

-- Política adicional: permitir acceso con service_role (para Edge Functions)
create policy "Permitir acceso service role" on public.remitos
    for all
    using (true)
    with check (true);

-- Comentarios de documentación
comment on table public.remitos is 'Tabla de remitos de servicio generados desde mantenimientos o manualmente';
comment on column public.remitos.numero_remito is 'Número único de remito con formato R{AÑO}-{SECUENCIA}';
comment on column public.remitos.repuestos is 'Array JSON de repuestos: [{codigo, descripcion, cantidad}]';
comment on column public.remitos.foto_1_path is 'Path relativo en Storage bucket remito-photos';
