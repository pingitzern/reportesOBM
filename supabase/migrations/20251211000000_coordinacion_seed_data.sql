-- =====================================================
-- Seed Data para Coordinación de Servicios (Corregido v2)
-- =====================================================

-- =====================================================
-- 1. HABILIDADES
-- =====================================================
INSERT INTO public.habilidades (id, nombre, descripcion, categoria, activo) VALUES
    ('11111111-1111-1111-1111-111111111111', 'Osmosis Inversa', 'Mantenimiento de equipos de ósmosis', 'Tratamiento de Agua', true),
    ('22222222-2222-2222-2222-222222222222', 'Ablandadores', 'Instalación y servicio de ablandadores', 'Tratamiento de Agua', true),
    ('33333333-3333-3333-3333-333333333333', 'HPLC', 'Sistemas de agua para cromatografía', 'Laboratorio', true),
    ('44444444-4444-4444-4444-444444444444', 'Calderas', 'Tratamiento de agua para calderas', 'Industrial', true),
    ('55555555-5555-5555-5555-555555555555', 'Electronica', 'Reparación de tableros electrónicos', 'Electrica', true)
ON CONFLICT (nombre) DO NOTHING;

-- =====================================================
-- 2. CATÁLOGO DE SERVICIOS
-- =====================================================
INSERT INTO public.catalogo_servicios (id, sistema_id, tipo_tarea, duracion_estimada_min, descripcion, requiere_habilidades, activo) VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', NULL, 'MP', 90, 'MP Osmosis Pequeña', 
     ARRAY['11111111-1111-1111-1111-111111111111']::uuid[], true),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', NULL, 'MP', 120, 'MP Osmosis Mediana', 
     ARRAY['11111111-1111-1111-1111-111111111111']::uuid[], true),
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', NULL, 'MP', 60, 'MP Ablandador', 
     ARRAY['22222222-2222-2222-2222-222222222222']::uuid[], true),
    ('ffffffff-ffff-ffff-ffff-ffffffffffff', NULL, 'CAL', 120, 'Calibración Anual', 
     ARRAY['11111111-1111-1111-1111-111111111111']::uuid[], true),
    ('33333333-aaaa-aaaa-aaaa-333333333333', NULL, 'REP', 120, 'Reparación General', 
     ARRAY['11111111-1111-1111-1111-111111111111']::uuid[], true)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 3. ACTUALIZAR COORDENADAS DE TÉCNICOS EXISTENTES
-- =====================================================
UPDATE public.profiles 
SET 
    direccion_base = COALESCE(direccion_base, 'Buenos Aires, Argentina'),
    lat = CASE 
        WHEN lat IS NULL THEN -34.6037 + (random() * 0.1 - 0.05)
        ELSE lat 
    END,
    lng = CASE 
        WHEN lng IS NULL THEN -58.3816 + (random() * 0.1 - 0.05)
        ELSE lng 
    END,
    activo = COALESCE(activo, true),
    score_ponderado = COALESCE(score_ponderado, 3.5 + random() * 1.5)
WHERE lat IS NULL OR lng IS NULL;

-- =====================================================
-- 4. ASIGNAR HABILIDADES A TÉCNICOS (usando id, no created_at)
-- =====================================================
-- Técnico 1: Osmosis + Ablandadores
INSERT INTO public.tecnico_habilidades (tecnico_id, habilidad_id, nivel)
SELECT p.id, '11111111-1111-1111-1111-111111111111'::uuid, 4
FROM public.profiles p
WHERE NOT EXISTS (SELECT 1 FROM public.tecnico_habilidades th WHERE th.tecnico_id = p.id AND th.habilidad_id = '11111111-1111-1111-1111-111111111111'::uuid)
ORDER BY p.id
LIMIT 1
ON CONFLICT (tecnico_id, habilidad_id) DO NOTHING;

INSERT INTO public.tecnico_habilidades (tecnico_id, habilidad_id, nivel)
SELECT p.id, '22222222-2222-2222-2222-222222222222'::uuid, 3
FROM public.profiles p
ORDER BY p.id
LIMIT 1
ON CONFLICT (tecnico_id, habilidad_id) DO NOTHING;

-- Técnico 2: Osmosis + HPLC
INSERT INTO public.tecnico_habilidades (tecnico_id, habilidad_id, nivel)
SELECT p.id, '11111111-1111-1111-1111-111111111111'::uuid, 5
FROM public.profiles p
ORDER BY p.id
LIMIT 1 OFFSET 1
ON CONFLICT (tecnico_id, habilidad_id) DO NOTHING;

INSERT INTO public.tecnico_habilidades (tecnico_id, habilidad_id, nivel)
SELECT p.id, '33333333-3333-3333-3333-333333333333'::uuid, 4
FROM public.profiles p
ORDER BY p.id
LIMIT 1 OFFSET 1
ON CONFLICT (tecnico_id, habilidad_id) DO NOTHING;

-- Técnico 3: Ablandadores + Electrónica
INSERT INTO public.tecnico_habilidades (tecnico_id, habilidad_id, nivel)
SELECT p.id, '22222222-2222-2222-2222-222222222222'::uuid, 5
FROM public.profiles p
ORDER BY p.id
LIMIT 1 OFFSET 2
ON CONFLICT (tecnico_id, habilidad_id) DO NOTHING;

INSERT INTO public.tecnico_habilidades (tecnico_id, habilidad_id, nivel)
SELECT p.id, '55555555-5555-5555-5555-555555555555'::uuid, 3
FROM public.profiles p
ORDER BY p.id
LIMIT 1 OFFSET 2
ON CONFLICT (tecnico_id, habilidad_id) DO NOTHING;

-- =====================================================
-- 5. ACTUALIZAR COORDENADAS DE CLIENTES
-- =====================================================
UPDATE public.clients 
SET 
    lat = CASE WHEN lat IS NULL THEN -34.6037 + (random() * 0.15 - 0.075) ELSE lat END,
    lng = CASE WHEN lng IS NULL THEN -58.3816 + (random() * 0.15 - 0.075) ELSE lng END
WHERE lat IS NULL OR lng IS NULL;

-- =====================================================
-- 6. CREAR ÓRDENES DE TRABAJO DE PRUEBA
-- =====================================================
INSERT INTO public.ordenes_trabajo (
    cliente_id, catalogo_servicio_id, creador_id, titulo, descripcion, prioridad, estado, tiempo_servicio_estimado
)
SELECT 
    c.id as cliente_id,
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid as catalogo_servicio_id,
    (SELECT id FROM public.profiles LIMIT 1) as creador_id,
    'MP Osmosis para ' || c.razon_social as titulo,
    'Mantenimiento preventivo programado' as descripcion,
    'Media' as prioridad,
    'Bolsa_Trabajo' as estado,
    90 as tiempo_servicio_estimado
FROM public.clients c
ORDER BY c.id
LIMIT 1;

INSERT INTO public.ordenes_trabajo (
    cliente_id, catalogo_servicio_id, creador_id, titulo, descripcion, prioridad, estado, tiempo_servicio_estimado
)
SELECT 
    c.id as cliente_id,
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid as catalogo_servicio_id,
    (SELECT id FROM public.profiles LIMIT 1) as creador_id,
    'MP Osmosis Mediana para ' || c.razon_social as titulo,
    'Mantenimiento programado' as descripcion,
    'Alta' as prioridad,
    'Bolsa_Trabajo' as estado,
    120 as tiempo_servicio_estimado
FROM public.clients c
ORDER BY c.id
LIMIT 1 OFFSET 1;

INSERT INTO public.ordenes_trabajo (
    cliente_id, catalogo_servicio_id, creador_id, titulo, descripcion, prioridad, estado, tiempo_servicio_estimado
)
SELECT 
    c.id as cliente_id,
    'dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid as catalogo_servicio_id,
    (SELECT id FROM public.profiles LIMIT 1) as creador_id,
    'MP Ablandador para ' || c.razon_social as titulo,
    'Servicio mensual' as descripcion,
    'Baja' as prioridad,
    'Bolsa_Trabajo' as estado,
    60 as tiempo_servicio_estimado
FROM public.clients c
ORDER BY c.id
LIMIT 1 OFFSET 2;

INSERT INTO public.ordenes_trabajo (
    cliente_id, catalogo_servicio_id, creador_id, titulo, descripcion, prioridad, estado, tiempo_servicio_estimado
)
SELECT 
    c.id as cliente_id,
    '33333333-aaaa-aaaa-aaaa-333333333333'::uuid as catalogo_servicio_id,
    (SELECT id FROM public.profiles LIMIT 1) as creador_id,
    'Reparación URGENTE para ' || c.razon_social as titulo,
    'Equipo con falla crítica' as descripcion,
    'EMERGENCIA_COMODIN' as prioridad,
    'Bolsa_Trabajo' as estado,
    120 as tiempo_servicio_estimado
FROM public.clients c
ORDER BY c.id
LIMIT 1 OFFSET 3;
