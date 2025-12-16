-- ============================================================================
-- Migración: Campos de configuración de técnicos
-- Agrega campos para gestionar horarios, días laborables y límites de trabajo
-- ============================================================================

-- Hora de entrada del técnico (por defecto 8:00 AM)
ALTER TABLE public.profiles 
    ADD COLUMN IF NOT EXISTS hora_entrada TIME DEFAULT '08:00';

-- Hora de salida del técnico (por defecto 6:00 PM)
ALTER TABLE public.profiles 
    ADD COLUMN IF NOT EXISTS hora_salida TIME DEFAULT '18:00';

-- Máximo de horas asignables por día
ALTER TABLE public.profiles 
    ADD COLUMN IF NOT EXISTS max_horas_dia INT DEFAULT 10;

-- Días laborables (array JSON con nombres de días)
ALTER TABLE public.profiles 
    ADD COLUMN IF NOT EXISTS dias_laborables JSONB DEFAULT '["lunes","martes","miercoles","jueves","viernes"]';

-- Comentarios
COMMENT ON COLUMN public.profiles.hora_entrada IS 'Hora de inicio de jornada del técnico';
COMMENT ON COLUMN public.profiles.hora_salida IS 'Hora de fin de jornada del técnico';
COMMENT ON COLUMN public.profiles.max_horas_dia IS 'Máximo de horas asignables por día al técnico';
COMMENT ON COLUMN public.profiles.dias_laborables IS 'Días de la semana que trabaja el técnico (JSON array)';

-- ============================================================================
-- Actualizar vista tecnicos_con_habilidades para incluir nuevos campos
-- ============================================================================

CREATE OR REPLACE VIEW public.tecnicos_con_habilidades AS
SELECT 
    p.id AS tecnico_id,
    p.full_name AS nombre,
    p.email,
    p.direccion_base,
    p.lat,
    p.lng,
    p.score_ponderado,
    p.activo,
    p.role,
    p.hora_entrada,
    p.hora_salida,
    p.max_horas_dia,
    p.dias_laborables,
    COALESCE(
        json_agg(
            json_build_object(
                'habilidad_id', h.id,
                'nombre', h.nombre,
                'categoria', h.categoria,
                'nivel', th.nivel
            )
        ) FILTER (WHERE h.id IS NOT NULL),
        '[]'::json
    ) AS habilidades
FROM public.profiles p
LEFT JOIN public.tecnico_habilidades th ON p.id = th.tecnico_id
LEFT JOIN public.habilidades h ON th.habilidad_id = h.id AND h.activo = TRUE
-- Filtro flexible: tecnico, admin, o sin role definido (legacy)
WHERE (p.role IN ('tecnico', 'admin') OR p.role IS NULL)
  AND (p.activo IS NULL OR p.activo = TRUE)
GROUP BY p.id, p.full_name, p.email, p.direccion_base, p.lat, p.lng, 
         p.score_ponderado, p.activo, p.role, p.hora_entrada, p.hora_salida, 
         p.max_horas_dia, p.dias_laborables;

COMMENT ON VIEW public.tecnicos_con_habilidades IS 'Vista de técnicos activos con sus habilidades y configuración de horarios';
