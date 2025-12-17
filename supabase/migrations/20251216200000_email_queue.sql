-- =====================================================
-- Migration: Email Queue System
-- Tabla para encolar emails con delay y cancelación
-- =====================================================

-- Tabla principal de cola de emails
CREATE TABLE IF NOT EXISTS public.email_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wo_id UUID REFERENCES public.ordenes_trabajo(id) ON DELETE CASCADE,
    tipo VARCHAR(50) NOT NULL, -- 'wo-tecnico', 'wo-cliente', 'wo-cancelacion'
    destinatario VARCHAR(255) NOT NULL,
    destinatario_nombre VARCHAR(255),
    data JSONB NOT NULL, -- datos para el template del email
    estado VARCHAR(20) DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'enviado', 'cancelado', 'error')),
    programado_para TIMESTAMPTZ NOT NULL, -- cuándo debe enviarse
    created_at TIMESTAMPTZ DEFAULT NOW(),
    enviado_at TIMESTAMPTZ, -- cuándo se envió realmente
    error_mensaje TEXT -- mensaje de error si falló
);

-- Índice para buscar emails pendientes eficientemente
CREATE INDEX IF NOT EXISTS idx_email_queue_pendiente 
ON public.email_queue(programado_para) 
WHERE estado = 'pendiente';

-- Índice para buscar por wo_id (para cancelar emails al desasignar)
CREATE INDEX IF NOT EXISTS idx_email_queue_wo_id 
ON public.email_queue(wo_id);

-- Comentarios
COMMENT ON TABLE public.email_queue IS 'Cola de emails con delay para evitar envíos prematuros';
COMMENT ON COLUMN public.email_queue.programado_para IS 'Hora en que debe enviarse (normalmente NOW() + 2 minutos)';
COMMENT ON COLUMN public.email_queue.estado IS 'pendiente=por enviar, enviado=ok, cancelado=se desasignó antes, error=falló el envío';

-- RLS: Solo el service role puede manipular esta tabla
ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;

-- Política: Sin acceso público, solo service role
-- (No creamos políticas restrictivas porque las edge functions usan service role)

-- =====================================================
-- pg_cron job para procesar la cola cada minuto
-- NOTA: Requiere que pg_cron esté habilitado en el proyecto
-- Si no está habilitado, usar cron externo
-- =====================================================

-- Verificar si pg_cron está disponible antes de crear el job
DO $$
BEGIN
    -- Intentar crear el job solo si la extensión pg_cron existe
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        -- Eliminar job existente si lo hay
        PERFORM cron.unschedule('process-email-queue');
        
        -- Crear job que ejecuta cada minuto
        -- Esto llamará a una función PL/pgSQL que a su vez llama a la edge function
        PERFORM cron.schedule(
            'process-email-queue',
            '* * * * *', -- cada minuto
            $$SELECT net.http_post(
                url := current_setting('app.settings.supabase_url') || '/functions/v1/process-email-queue',
                headers := jsonb_build_object(
                    'Content-Type', 'application/json',
                    'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
                ),
                body := '{}'::jsonb
            )$$
        );
        
        RAISE NOTICE 'pg_cron job "process-email-queue" creado correctamente';
    ELSE
        RAISE NOTICE 'pg_cron no está disponible - usar cron externo para procesar la cola';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error creando pg_cron job: %. Usar cron externo.', SQLERRM;
END $$;

-- =====================================================
-- Función helper para cancelar emails pendientes de una WO
-- =====================================================
CREATE OR REPLACE FUNCTION cancel_pending_emails(p_wo_id UUID)
RETURNS TABLE(emails_cancelled INT, emails_already_sent INT) AS $$
DECLARE
    v_cancelled INT;
    v_sent INT;
BEGIN
    -- Contar emails ya enviados
    SELECT COUNT(*) INTO v_sent
    FROM public.email_queue
    WHERE wo_id = p_wo_id AND estado = 'enviado';
    
    -- Cancelar emails pendientes
    UPDATE public.email_queue
    SET estado = 'cancelado'
    WHERE wo_id = p_wo_id AND estado = 'pendiente';
    
    GET DIAGNOSTICS v_cancelled = ROW_COUNT;
    
    RETURN QUERY SELECT v_cancelled, v_sent;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
