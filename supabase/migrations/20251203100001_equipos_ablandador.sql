-- ============================================================================
-- TABLA: equipos_ablandador
-- Almacena la configuración "fija" de los equipos ablandadores por cliente
-- ============================================================================

CREATE TABLE IF NOT EXISTS equipos_ablandador (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    numero_serie TEXT NOT NULL,
    
    -- Datos del equipo (Sección B del formulario)
    tipo_ablandador TEXT NOT NULL DEFAULT 'Custom',
    modelo TEXT,
    volumen_resina NUMERIC DEFAULT 25,
    ubicacion TEXT,
    tipo_regeneracion TEXT DEFAULT 'Por Volumen',
    prefiltro TEXT DEFAULT 'No Aplica',
    proteccion_entrada TEXT DEFAULT 'No Aplica',
    manometros TEXT DEFAULT 'No cuenta con manómetros',
    notas_equipo TEXT,
    
    -- Auditoría
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT,
    updated_by TEXT,
    
    -- Constraint: número de serie único por cliente
    CONSTRAINT equipos_ablandador_cliente_serie_unique UNIQUE (cliente_id, numero_serie)
);

-- Índices para búsquedas frecuentes
CREATE INDEX IF NOT EXISTS idx_equipos_ablandador_cliente ON equipos_ablandador(cliente_id);
CREATE INDEX IF NOT EXISTS idx_equipos_ablandador_serie ON equipos_ablandador(numero_serie);

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_equipos_ablandador_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_equipos_ablandador_updated_at ON equipos_ablandador;
CREATE TRIGGER trigger_equipos_ablandador_updated_at
    BEFORE UPDATE ON equipos_ablandador
    FOR EACH ROW
    EXECUTE FUNCTION update_equipos_ablandador_updated_at();

-- RLS Policies
ALTER TABLE equipos_ablandador ENABLE ROW LEVEL SECURITY;

-- Política de lectura: todos los usuarios autenticados pueden leer
CREATE POLICY "equipos_ablandador_select_policy" ON equipos_ablandador
    FOR SELECT USING (true);

-- Política de inserción: usuarios autenticados pueden insertar
CREATE POLICY "equipos_ablandador_insert_policy" ON equipos_ablandador
    FOR INSERT WITH CHECK (true);

-- Política de actualización: usuarios autenticados pueden actualizar
CREATE POLICY "equipos_ablandador_update_policy" ON equipos_ablandador
    FOR UPDATE USING (true);

-- Comentarios para documentación
COMMENT ON TABLE equipos_ablandador IS 'Configuración fija de equipos ablandadores asociados a clientes';
COMMENT ON COLUMN equipos_ablandador.numero_serie IS 'Identificador único del equipo, irrepetible por cliente';
COMMENT ON COLUMN equipos_ablandador.created_by IS 'Técnico que registró el equipo por primera vez';
COMMENT ON COLUMN equipos_ablandador.updated_by IS 'Último técnico que modificó la configuración';
