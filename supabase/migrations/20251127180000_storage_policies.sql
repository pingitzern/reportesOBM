-- Migración: Políticas de Storage para el bucket maintenance-reports
-- Fecha: 2025-11-27

-- Crear el bucket si no existe (con configuración privada)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'maintenance-reports',
    'maintenance-reports',
    false, -- Privado (requiere signed URLs)
    52428800, -- 50MB límite
    ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE SET
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Eliminar políticas existentes para evitar conflictos
DROP POLICY IF EXISTS "Permitir subida a usuarios autenticados" ON storage.objects;
DROP POLICY IF EXISTS "Permitir lectura a usuarios autenticados" ON storage.objects;
DROP POLICY IF EXISTS "Permitir actualización a usuarios autenticados" ON storage.objects;
DROP POLICY IF EXISTS "Permitir eliminación a usuarios autenticados" ON storage.objects;
DROP POLICY IF EXISTS "maintenance-reports INSERT" ON storage.objects;
DROP POLICY IF EXISTS "maintenance-reports SELECT" ON storage.objects;
DROP POLICY IF EXISTS "maintenance-reports UPDATE" ON storage.objects;
DROP POLICY IF EXISTS "maintenance-reports DELETE" ON storage.objects;

-- Política: Permitir INSERT (subida) a usuarios autenticados en el bucket maintenance-reports
CREATE POLICY "maintenance-reports INSERT"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'maintenance-reports');

-- Política: Permitir SELECT (lectura/descarga) a usuarios autenticados
CREATE POLICY "maintenance-reports SELECT"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'maintenance-reports');

-- Política: Permitir UPDATE a usuarios autenticados (para upsert)
CREATE POLICY "maintenance-reports UPDATE"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'maintenance-reports')
WITH CHECK (bucket_id = 'maintenance-reports');

-- Política: Permitir DELETE a usuarios autenticados
CREATE POLICY "maintenance-reports DELETE"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'maintenance-reports');

-- También permitir acceso con service_role (para operaciones del backend)
-- Nota: service_role ya tiene acceso completo por defecto, pero lo agregamos explícitamente

-- Política adicional: Permitir todo con service_role key
CREATE POLICY "maintenance-reports service_role ALL"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'maintenance-reports')
WITH CHECK (bucket_id = 'maintenance-reports');

