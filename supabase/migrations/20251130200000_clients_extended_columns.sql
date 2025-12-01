
-- Migration: Agregar columnas extendidas a la tabla clients
-- Fecha: 2025-11-30
-- Descripción: Agrega campos telefono, email, division y canal para soportar
--              la estructura completa de datos de Post Venta

-- Agregar columna telefono
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS telefono text;

-- Agregar columna email
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS email text;

-- Agregar columna division (ej: Aguas, Core, i+d)
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS division text;

-- Agregar columna canal (ej: Referido, Instagram, Landing Page, Whatsapp)
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS canal text;

-- Agregar columnas de auditoría
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Crear índices para búsquedas frecuentes
CREATE INDEX IF NOT EXISTS idx_clients_razon_social ON public.clients (razon_social);
CREATE INDEX IF NOT EXISTS idx_clients_cuit ON public.clients (cuit) WHERE cuit IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clients_division ON public.clients (division) WHERE division IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clients_canal ON public.clients (canal) WHERE canal IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clients_email ON public.clients (email) WHERE email IS NOT NULL;

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_clients_updated_at ON public.clients;
CREATE TRIGGER update_clients_updated_at
    BEFORE UPDATE ON public.clients
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Comentarios para documentación
COMMENT ON COLUMN public.clients.telefono IS 'Número de teléfono del cliente';
COMMENT ON COLUMN public.clients.email IS 'Correo electrónico del cliente';
COMMENT ON COLUMN public.clients.division IS 'División del negocio: Aguas, Core, i+d';
COMMENT ON COLUMN public.clients.canal IS 'Canal de adquisición: Referido, Instagram, Landing Page, Whatsapp, etc.';
COMMENT ON COLUMN public.clients.created_at IS 'Fecha de creación del registro';
COMMENT ON COLUMN public.clients.updated_at IS 'Fecha de última actualización';
