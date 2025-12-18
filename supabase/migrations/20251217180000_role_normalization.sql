-- ============================================================================
-- Migración: Normalización de Roles y Permisos Elevados
-- Fecha: 2025-12-17
-- Descripción: 
--   1. Normaliza roles a: admin, jefe_servicio, tecnico
--   2. Crea función has_elevated_permissions() para jefe_servicio
--   3. Actualiza políticas RLS para usar permisos elevados
--   4. Migra usuarios existentes
-- ============================================================================

-- ============================================================================
-- PASO 1: ACTUALIZAR FUNCIÓN is_admin() PARA MANEJAR VARIANTES
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND lower(trim(role)) IN ('admin', 'administrador')
    );
$$;

COMMENT ON FUNCTION public.is_admin() IS 'Verifica si el usuario actual tiene rol de admin (acepta variantes)';

-- ============================================================================
-- PASO 2: CREAR FUNCIÓN has_elevated_permissions()
-- ============================================================================

CREATE OR REPLACE FUNCTION public.has_elevated_permissions()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND lower(trim(role)) IN ('admin', 'administrador', 'jefe_servicio')
    );
$$;

COMMENT ON FUNCTION public.has_elevated_permissions() IS 'Verifica si el usuario tiene permisos elevados (admin o jefe_servicio)';

-- ============================================================================
-- PASO 3: ACTUALIZAR POLÍTICAS RLS PARA USAR has_elevated_permissions()
-- ============================================================================

-- Actualizar política de DELETE en clients para incluir jefe_servicio
DROP POLICY IF EXISTS "clients_delete_admin" ON public.clients;
CREATE POLICY "clients_delete_elevated" ON public.clients
    FOR DELETE
    USING (public.has_elevated_permissions());

-- Actualizar política de DELETE en equipments para incluir jefe_servicio
DROP POLICY IF EXISTS "equipments_delete_admin" ON public.equipments;
CREATE POLICY "equipments_delete_elevated" ON public.equipments
    FOR DELETE
    USING (public.has_elevated_permissions());

-- Actualizar política de DELETE en profiles para incluir jefe_servicio
DROP POLICY IF EXISTS "profiles_delete_admin" ON public.profiles;
CREATE POLICY "profiles_delete_elevated" ON public.profiles
    FOR DELETE
    USING (public.has_elevated_permissions());

-- Actualizar política de UPDATE en maintenances para incluir jefe_servicio
DROP POLICY IF EXISTS "maintenances_update_owner" ON public.maintenances;
CREATE POLICY "maintenances_update_owner" ON public.maintenances
    FOR UPDATE
    USING (
        auth.uid() IS NOT NULL
        AND (
            created_by = auth.uid()
            OR technician_id = auth.uid()
            OR public.has_elevated_permissions()
        )
    )
    WITH CHECK (
        auth.uid() IS NOT NULL
        AND (
            created_by = auth.uid()
            OR technician_id = auth.uid()
            OR public.has_elevated_permissions()
        )
    );

-- Actualizar política de DELETE en maintenances para incluir jefe_servicio
DROP POLICY IF EXISTS "maintenances_delete_owner" ON public.maintenances;
CREATE POLICY "maintenances_delete_owner" ON public.maintenances
    FOR DELETE
    USING (
        created_by = auth.uid()
        OR public.has_elevated_permissions()
    );

-- Actualizar política de UPDATE en remitos para incluir jefe_servicio
DROP POLICY IF EXISTS "remitos_update_owner" ON public.remitos;
CREATE POLICY "remitos_update_owner" ON public.remitos
    FOR UPDATE
    USING (
        auth.uid() IS NOT NULL
        AND (
            created_by = auth.uid()
            OR technician_id = auth.uid()
            OR public.has_elevated_permissions()
        )
    )
    WITH CHECK (
        auth.uid() IS NOT NULL
        AND (
            created_by = auth.uid()
            OR technician_id = auth.uid()
            OR public.has_elevated_permissions()
        )
    );

-- Actualizar política de DELETE en remitos para incluir jefe_servicio
DROP POLICY IF EXISTS "remitos_delete_owner" ON public.remitos;
CREATE POLICY "remitos_delete_owner" ON public.remitos
    FOR DELETE
    USING (
        created_by = auth.uid()
        OR public.has_elevated_permissions()
    );

-- ============================================================================
-- PASO 4: ACTUALIZAR POLÍTICA DE FEEDBACK
-- ============================================================================

DROP POLICY IF EXISTS "Admins gestionan todo el feedback" ON public.feedback;
CREATE POLICY "Elevated users gestionan todo el feedback" ON public.feedback
    FOR ALL 
    USING (public.has_elevated_permissions());

-- ============================================================================
-- PASO 5: MIGRAR USUARIOS EXISTENTES (normalizar roles en profiles)
-- ============================================================================

-- Normalizar 'Administrador' → 'admin'
UPDATE public.profiles 
SET role = 'admin' 
WHERE lower(trim(role)) = 'administrador';

-- Normalizar 'supervisor' → 'jefe_servicio'
UPDATE public.profiles 
SET role = 'jefe_servicio' 
WHERE lower(trim(role)) = 'supervisor';

-- ============================================================================
-- PASO 6: DOCUMENTACIÓN
-- ============================================================================

COMMENT ON POLICY "clients_delete_elevated" ON public.clients IS 'Solo admin o jefe_servicio pueden eliminar clientes';
COMMENT ON POLICY "equipments_delete_elevated" ON public.equipments IS 'Solo admin o jefe_servicio pueden eliminar equipos';
COMMENT ON POLICY "profiles_delete_elevated" ON public.profiles IS 'Solo admin o jefe_servicio pueden eliminar perfiles';
COMMENT ON POLICY "maintenances_update_owner" ON public.maintenances IS 'Creador, técnico asignado, o usuario con permisos elevados pueden actualizar';
COMMENT ON POLICY "maintenances_delete_owner" ON public.maintenances IS 'Creador o usuario con permisos elevados pueden eliminar';
COMMENT ON POLICY "remitos_update_owner" ON public.remitos IS 'Creador, técnico asignado, o usuario con permisos elevados pueden actualizar';
COMMENT ON POLICY "remitos_delete_owner" ON public.remitos IS 'Creador o usuario con permisos elevados pueden eliminar';

-- ============================================================================
-- RESUMEN DE ROLES:
-- ============================================================================
-- 
-- ROL              | PANEL ADMIN | DELETE CLIENTES | DELETE OWN RECORDS
-- -----------------------------------------------------------------
-- admin            | ✅ SÍ       | ✅ SÍ           | ✅ SÍ
-- jefe_servicio    | ❌ NO       | ✅ SÍ           | ✅ SÍ
-- tecnico          | ❌ NO       | ❌ NO           | ✅ Solo propios
-- ============================================================================
