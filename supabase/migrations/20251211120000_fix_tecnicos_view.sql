-- ============================================================================
-- FIX: Vista tecnicos_con_habilidades ampliada
-- La vista original filtraba por role='tecnico' pero los perfiles existentes
-- pueden no tener ese valor. Modificamos para incluir más casos.
-- ============================================================================

-- Recrear la vista con filtro más flexible
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
-- Filtro más flexible: tecnico, admin, o sin role definido (legacy)
WHERE (p.role IN ('tecnico', 'admin') OR p.role IS NULL)
  AND (p.activo IS NULL OR p.activo = TRUE)
GROUP BY p.id, p.full_name, p.email, p.direccion_base, p.lat, p.lng, p.score_ponderado, p.activo, p.role;

COMMENT ON VIEW public.tecnicos_con_habilidades IS 'Vista de técnicos activos con sus habilidades agregadas en JSON (incluye admin y roles legacy)';
