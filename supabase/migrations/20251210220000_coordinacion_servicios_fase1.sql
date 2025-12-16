-- ============================================================================
-- MIGRACIÓN: Coordinación de Servicios - Fase 1
-- Descripción: Crea el esquema de base de datos para el módulo de Field Service
--              Management: técnicos con habilidades, catálogo de servicios,
--              órdenes de trabajo y auditoría del comodín de prioridad.
-- Fecha: 2025-12-10
-- Rama: Agenda
-- ============================================================================

-- ============================================================================
-- 1. EXTENSIÓN DE TABLA profiles (Técnicos)
-- ============================================================================

-- Agregar campos de geo-localización
ALTER TABLE public.profiles 
    ADD COLUMN IF NOT EXISTS direccion_base TEXT;

ALTER TABLE public.profiles 
    ADD COLUMN IF NOT EXISTS lat DECIMAL(10, 8);

ALTER TABLE public.profiles 
    ADD COLUMN IF NOT EXISTS lng DECIMAL(11, 8);

-- Campo para scoring futuro
ALTER TABLE public.profiles 
    ADD COLUMN IF NOT EXISTS score_ponderado FLOAT DEFAULT 0;

-- Soft delete
ALTER TABLE public.profiles 
    ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT TRUE;

-- Índice para búsqueda de técnicos activos
CREATE INDEX IF NOT EXISTS idx_profiles_activo ON public.profiles(activo) WHERE activo = TRUE;

COMMENT ON COLUMN public.profiles.direccion_base IS 'Dirección base del técnico para cálculo de rutas';
COMMENT ON COLUMN public.profiles.lat IS 'Latitud de la ubicación base del técnico';
COMMENT ON COLUMN public.profiles.lng IS 'Longitud de la ubicación base del técnico';
COMMENT ON COLUMN public.profiles.score_ponderado IS 'Score calculado del técnico (rendimiento, puntualidad, etc.)';

-- ============================================================================
-- 2. EXTENSIÓN DE TABLA clients (Geo-localización)
-- ============================================================================

ALTER TABLE public.clients 
    ADD COLUMN IF NOT EXISTS lat DECIMAL(10, 8);

ALTER TABLE public.clients 
    ADD COLUMN IF NOT EXISTS lng DECIMAL(11, 8);

COMMENT ON COLUMN public.clients.lat IS 'Latitud del sitio de servicio del cliente';
COMMENT ON COLUMN public.clients.lng IS 'Longitud del sitio de servicio del cliente';

-- ============================================================================
-- 3. TABLA habilidades (Catálogo maestro de skills)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.habilidades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL UNIQUE,
    descripcion TEXT,
    categoria TEXT,  -- Agrupación: "equipos", "electrica", "mecanica", etc.
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_habilidades_categoria ON public.habilidades(categoria);
CREATE INDEX IF NOT EXISTS idx_habilidades_activo ON public.habilidades(activo) WHERE activo = TRUE;

-- RLS
ALTER TABLE public.habilidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lectura habilidades para autenticados" ON public.habilidades
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Gestión habilidades solo admin" ON public.habilidades
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

COMMENT ON TABLE public.habilidades IS 'Catálogo maestro de habilidades/skills disponibles para técnicos';
COMMENT ON COLUMN public.habilidades.nombre IS 'Nombre de la habilidad: Osmosis, Tableros Eléctricos, Ablandadores, etc.';
COMMENT ON COLUMN public.habilidades.categoria IS 'Categoría de agrupación: equipos, electrica, mecanica, software';

-- ============================================================================
-- 4. TABLA tecnico_habilidades (Relación M:N)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.tecnico_habilidades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tecnico_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    habilidad_id UUID NOT NULL REFERENCES public.habilidades(id) ON DELETE CASCADE,
    nivel INTEGER DEFAULT 1 CHECK (nivel BETWEEN 1 AND 5),
    certificado_url TEXT,
    fecha_certificacion DATE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tecnico_id, habilidad_id)
);

-- Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_tecnico_habilidades_tecnico ON public.tecnico_habilidades(tecnico_id);
CREATE INDEX IF NOT EXISTS idx_tecnico_habilidades_habilidad ON public.tecnico_habilidades(habilidad_id);

-- RLS
ALTER TABLE public.tecnico_habilidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lectura tecnico_habilidades para autenticados" ON public.tecnico_habilidades
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Gestión tecnico_habilidades solo admin" ON public.tecnico_habilidades
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

COMMENT ON TABLE public.tecnico_habilidades IS 'Relación M:N entre técnicos y sus habilidades certificadas';
COMMENT ON COLUMN public.tecnico_habilidades.nivel IS 'Nivel de competencia: 1=básico, 5=experto';

-- ============================================================================
-- 5. TABLA catalogo_servicios (Banco de Tiempos)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.catalogo_servicios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sistema_id UUID REFERENCES public.sistemas(id) ON DELETE SET NULL,
    tipo_tarea TEXT NOT NULL CHECK (tipo_tarea IN ('MP', 'CAL', 'VAL', 'INSTA', 'REP')),
    duracion_estimada_min INTEGER NOT NULL,
    descripcion TEXT,
    requiere_habilidades UUID[],  -- Array de IDs de habilidades requeridas
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(sistema_id, tipo_tarea)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_catalogo_servicios_sistema ON public.catalogo_servicios(sistema_id);
CREATE INDEX IF NOT EXISTS idx_catalogo_servicios_tipo ON public.catalogo_servicios(tipo_tarea);

-- Trigger para updated_at
DROP TRIGGER IF EXISTS update_catalogo_servicios_updated_at ON public.catalogo_servicios;
CREATE TRIGGER update_catalogo_servicios_updated_at
    BEFORE UPDATE ON public.catalogo_servicios
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.catalogo_servicios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lectura catalogo_servicios para autenticados" ON public.catalogo_servicios
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Gestión catalogo_servicios solo admin" ON public.catalogo_servicios
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

COMMENT ON TABLE public.catalogo_servicios IS 'Banco de tiempos: duración estimada por tipo de equipo y tarea';
COMMENT ON COLUMN public.catalogo_servicios.tipo_tarea IS 'MP=Mant.Preventivo, CAL=Calibración, VAL=Validación, INSTA=Instalación, REP=Reparación';
COMMENT ON COLUMN public.catalogo_servicios.duracion_estimada_min IS 'Duración estimada del servicio en minutos';
COMMENT ON COLUMN public.catalogo_servicios.requiere_habilidades IS 'Array de UUIDs de habilidades requeridas para este servicio';

-- ============================================================================
-- 6. TABLA ordenes_trabajo (Work Orders)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ordenes_trabajo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- ID humanamente legible (generado por trigger)
    numero_wo TEXT NOT NULL UNIQUE,
    
    -- Relaciones principales
    cliente_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
    equipo_id UUID REFERENCES public.equipments(id) ON DELETE SET NULL,
    catalogo_servicio_id UUID REFERENCES public.catalogo_servicios(id) ON DELETE SET NULL,
    tecnico_asignado_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    creador_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    
    -- Descripción del trabajo
    titulo TEXT NOT NULL,
    descripcion TEXT,
    notas_internas TEXT,
    
    -- Prioridad y Estado
    prioridad TEXT NOT NULL DEFAULT 'Media' 
        CHECK (prioridad IN ('Baja', 'Media', 'Alta', 'EMERGENCIA_COMODIN')),
    estado TEXT NOT NULL DEFAULT 'Bolsa_Trabajo' 
        CHECK (estado IN ('Bolsa_Trabajo', 'Asignada', 'Confirmada_Cliente', 
                          'En_Progreso', 'Completada', 'Cancelada')),
    
    -- Programación
    fecha_solicitud TIMESTAMPTZ DEFAULT now(),
    fecha_programada TIMESTAMPTZ,
    fecha_inicio_real TIMESTAMPTZ,
    fecha_fin_real TIMESTAMPTZ,
    
    -- Tiempos estimados (en minutos)
    tiempo_servicio_estimado INTEGER,
    tiempo_viaje_ida_estimado INTEGER,
    tiempo_viaje_vuelta_estimado INTEGER,
    
    -- Auditoría
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_wo_estado ON public.ordenes_trabajo(estado);
CREATE INDEX IF NOT EXISTS idx_wo_fecha_programada ON public.ordenes_trabajo(fecha_programada);
CREATE INDEX IF NOT EXISTS idx_wo_tecnico ON public.ordenes_trabajo(tecnico_asignado_id);
CREATE INDEX IF NOT EXISTS idx_wo_cliente ON public.ordenes_trabajo(cliente_id);
CREATE INDEX IF NOT EXISTS idx_wo_prioridad ON public.ordenes_trabajo(prioridad);
CREATE INDEX IF NOT EXISTS idx_wo_creador ON public.ordenes_trabajo(creador_id);

-- Trigger para updated_at
DROP TRIGGER IF EXISTS update_ordenes_trabajo_updated_at ON public.ordenes_trabajo;
CREATE TRIGGER update_ordenes_trabajo_updated_at
    BEFORE UPDATE ON public.ordenes_trabajo
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.ordenes_trabajo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lectura ordenes_trabajo para autenticados" ON public.ordenes_trabajo
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Crear ordenes_trabajo para autenticados" ON public.ordenes_trabajo
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Actualizar ordenes_trabajo para autenticados" ON public.ordenes_trabajo
    FOR UPDATE USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- Solo admin puede eliminar
CREATE POLICY "Eliminar ordenes_trabajo solo admin" ON public.ordenes_trabajo
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

COMMENT ON TABLE public.ordenes_trabajo IS 'Órdenes de trabajo para coordinación de servicios';
COMMENT ON COLUMN public.ordenes_trabajo.numero_wo IS 'ID humanamente legible: WO-YYYY-NNNN';
COMMENT ON COLUMN public.ordenes_trabajo.prioridad IS 'Baja, Media, Alta, EMERGENCIA_COMODIN (max 3/mes)';
COMMENT ON COLUMN public.ordenes_trabajo.estado IS 'Flujo: Bolsa_Trabajo -> Asignada -> Confirmada_Cliente -> En_Progreso -> Completada';

-- ============================================================================
-- 7. TABLA log_prioridad_comodin (Auditoría del comodín)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.log_prioridad_comodin (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    wo_id UUID NOT NULL REFERENCES public.ordenes_trabajo(id) ON DELETE CASCADE,
    motivo TEXT,
    fecha_uso TIMESTAMPTZ DEFAULT now()
);

-- Índice para validar límite mensual
CREATE INDEX IF NOT EXISTS idx_comodin_usuario_fecha ON public.log_prioridad_comodin(usuario_id, fecha_uso);

-- RLS
ALTER TABLE public.log_prioridad_comodin ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lectura log_comodin para autenticados" ON public.log_prioridad_comodin
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Insertar log_comodin para autenticados" ON public.log_prioridad_comodin
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

COMMENT ON TABLE public.log_prioridad_comodin IS 'Registro de uso del comodín EMERGENCIA (máx 3 por mes por usuario)';

-- ============================================================================
-- 8. FUNCIÓN: Generador de número de WO
-- ============================================================================

CREATE OR REPLACE FUNCTION public.generar_numero_wo()
RETURNS TEXT AS $$
DECLARE
    año_actual TEXT;
    secuencia INTEGER;
    nuevo_numero TEXT;
BEGIN
    año_actual := EXTRACT(YEAR FROM now())::TEXT;
    
    -- Obtener el último número de WO del año actual
    SELECT COALESCE(
        MAX(
            CAST(SPLIT_PART(numero_wo, '-', 3) AS INTEGER)
        ), 0
    ) + 1
    INTO secuencia
    FROM public.ordenes_trabajo
    WHERE numero_wo LIKE 'WO-' || año_actual || '-%';
    
    -- Formatear: WO-2025-0001
    nuevo_numero := 'WO-' || año_actual || '-' || LPAD(secuencia::TEXT, 4, '0');
    
    RETURN nuevo_numero;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.generar_numero_wo IS 'Genera el próximo número de WO en formato WO-YYYY-NNNN';

-- Trigger para asignar automáticamente el número de WO
CREATE OR REPLACE FUNCTION public.trigger_asignar_numero_wo()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.numero_wo IS NULL OR NEW.numero_wo = '' THEN
        NEW.numero_wo := public.generar_numero_wo();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_ordenes_trabajo_numero ON public.ordenes_trabajo;
CREATE TRIGGER tr_ordenes_trabajo_numero
    BEFORE INSERT ON public.ordenes_trabajo
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_asignar_numero_wo();

-- ============================================================================
-- 9. FUNCIÓN: Validar uso del comodín (máx 3/mes)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.validar_uso_comodin(p_usuario_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    usos_mes INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO usos_mes
    FROM public.log_prioridad_comodin
    WHERE usuario_id = p_usuario_id
      AND fecha_uso >= date_trunc('month', now())
      AND fecha_uso < date_trunc('month', now()) + INTERVAL '1 month';
    
    RETURN usos_mes < 3;  -- TRUE si puede usar, FALSE si ya usó 3
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.validar_uso_comodin IS 'Valida si el usuario puede usar el comodín de emergencia (máx 3/mes). Retorna TRUE si puede, FALSE si no.';

-- ============================================================================
-- 10. FUNCIÓN: Obtener usos restantes del comodín
-- ============================================================================

CREATE OR REPLACE FUNCTION public.obtener_usos_comodin_restantes(p_usuario_id UUID)
RETURNS INTEGER AS $$
DECLARE
    usos_mes INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO usos_mes
    FROM public.log_prioridad_comodin
    WHERE usuario_id = p_usuario_id
      AND fecha_uso >= date_trunc('month', now())
      AND fecha_uso < date_trunc('month', now()) + INTERVAL '1 month';
    
    RETURN 3 - usos_mes;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.obtener_usos_comodin_restantes IS 'Retorna cuántos usos del comodín le quedan al usuario este mes';

-- ============================================================================
-- 11. VISTA: Técnicos con sus habilidades
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
WHERE p.role = 'tecnico' AND p.activo = TRUE
GROUP BY p.id, p.full_name, p.email, p.direccion_base, p.lat, p.lng, p.score_ponderado, p.activo;

COMMENT ON VIEW public.tecnicos_con_habilidades IS 'Vista de técnicos activos con sus habilidades agregadas en JSON';

-- ============================================================================
-- 12. VISTA: Órdenes de trabajo con datos expandidos
-- ============================================================================

CREATE OR REPLACE VIEW public.ordenes_trabajo_detalle AS
SELECT 
    wo.id,
    wo.numero_wo,
    wo.titulo,
    wo.descripcion,
    wo.prioridad,
    wo.estado,
    wo.fecha_solicitud,
    wo.fecha_programada,
    wo.tiempo_servicio_estimado,
    wo.tiempo_viaje_ida_estimado,
    wo.tiempo_viaje_vuelta_estimado,
    -- Cliente
    c.id AS cliente_id,
    c.razon_social AS cliente_nombre,
    c.direccion AS cliente_direccion,
    c.lat AS cliente_lat,
    c.lng AS cliente_lng,
    c.telefono AS cliente_telefono,
    -- Equipo
    e.id AS equipo_id,
    e.serial_number AS equipo_serie,
    e.modelo AS equipo_modelo,
    s.nombre AS sistema_nombre,
    -- Técnico asignado
    t.id AS tecnico_id,
    t.full_name AS tecnico_nombre,
    t.email AS tecnico_email,
    -- Creador
    cr.full_name AS creador_nombre,
    -- Catálogo de servicio
    cs.tipo_tarea,
    cs.duracion_estimada_min AS duracion_catalogo,
    -- Timestamps
    wo.created_at,
    wo.updated_at
FROM public.ordenes_trabajo wo
LEFT JOIN public.clients c ON wo.cliente_id = c.id
LEFT JOIN public.equipments e ON wo.equipo_id = e.id
LEFT JOIN public.sistemas s ON e.sistema_id = s.id
LEFT JOIN public.profiles t ON wo.tecnico_asignado_id = t.id
LEFT JOIN public.profiles cr ON wo.creador_id = cr.id
LEFT JOIN public.catalogo_servicios cs ON wo.catalogo_servicio_id = cs.id;

COMMENT ON VIEW public.ordenes_trabajo_detalle IS 'Vista expandida de órdenes de trabajo con todos los datos relacionados';

-- ============================================================================
-- FIN DE LA MIGRACIÓN
-- ============================================================================
