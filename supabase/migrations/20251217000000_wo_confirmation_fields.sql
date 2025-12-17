-- =============================================================
-- Migration: Agregar campos de confirmación a ordenes_trabajo
-- =============================================================

-- Tipo enum para estados de confirmación
CREATE TYPE public.confirmacion_estado AS ENUM ('pendiente', 'confirmada', 'rechazada');

-- Agregar campos de confirmación a ordenes_trabajo
ALTER TABLE public.ordenes_trabajo
ADD COLUMN IF NOT EXISTS confirmacion_tecnico confirmacion_estado DEFAULT 'pendiente',
ADD COLUMN IF NOT EXISTS confirmacion_tecnico_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS confirmacion_cliente confirmacion_estado DEFAULT 'pendiente',
ADD COLUMN IF NOT EXISTS confirmacion_cliente_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS token_confirmacion UUID DEFAULT uuid_generate_v4(),
ADD COLUMN IF NOT EXISTS rechazo_motivo TEXT;

-- Índice para buscar por token de confirmación
CREATE INDEX IF NOT EXISTS idx_ordenes_trabajo_token_confirmacion
ON public.ordenes_trabajo(token_confirmacion)
WHERE token_confirmacion IS NOT NULL;

-- Comentarios descriptivos
COMMENT ON COLUMN public.ordenes_trabajo.confirmacion_tecnico IS 'Estado de confirmación del técnico: pendiente, confirmada, rechazada';
COMMENT ON COLUMN public.ordenes_trabajo.confirmacion_cliente IS 'Estado de confirmación del cliente: pendiente, confirmada, rechazada';
COMMENT ON COLUMN public.ordenes_trabajo.token_confirmacion IS 'Token único para confirmación vía email (sin login)';
COMMENT ON COLUMN public.ordenes_trabajo.rechazo_motivo IS 'Motivo del rechazo si aplica';
