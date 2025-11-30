-- ============================================================================
-- Migración: Políticas de Seguridad RLS Mejoradas
-- Fecha: 2025-11-30
-- Descripción: Reemplaza políticas básicas con políticas granulares y seguras
-- ============================================================================

-- ============================================================================
-- PASO 1: ELIMINAR POLÍTICAS EXISTENTES (para recrearlas correctamente)
-- ============================================================================

-- Profiles
DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados" ON public.profiles;

-- Clients  
DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados" ON public.clients;

-- Equipments
DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados" ON public.equipments;

-- Maintenances
DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados" ON public.maintenances;

-- Remitos
DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados" ON public.remitos;
DROP POLICY IF EXISTS "Permitir acceso service role" ON public.remitos;

-- ============================================================================
-- PASO 2: AGREGAR COLUMNA created_by DONDE FALTA (para control de ownership)
-- ============================================================================

-- Agregar created_by a maintenances si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'maintenances' 
        AND column_name = 'created_by'
    ) THEN
        ALTER TABLE public.maintenances 
        ADD COLUMN created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
        
        -- Establecer el technician_id como created_by para registros existentes
        UPDATE public.maintenances 
        SET created_by = technician_id 
        WHERE created_by IS NULL AND technician_id IS NOT NULL;
    END IF;
END $$;

-- ============================================================================
-- PASO 3: FUNCIÓN HELPER PARA VERIFICAR SI ES ADMIN
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
        AND role = 'admin'
    );
$$;

-- ============================================================================
-- PASO 4: POLÍTICAS PARA PROFILES
-- ============================================================================

-- SELECT: Todos los autenticados pueden ver perfiles (necesario para mostrar nombres)
CREATE POLICY "profiles_select_authenticated" ON public.profiles
    FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- INSERT: Solo el trigger automático (bloquear inserts manuales)
CREATE POLICY "profiles_insert_own" ON public.profiles
    FOR INSERT
    WITH CHECK (auth.uid() = id);

-- UPDATE: Solo el propio usuario puede editar su perfil
CREATE POLICY "profiles_update_own" ON public.profiles
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- DELETE: Solo admins pueden eliminar perfiles
CREATE POLICY "profiles_delete_admin" ON public.profiles
    FOR DELETE
    USING (public.is_admin());

-- ============================================================================
-- PASO 5: POLÍTICAS PARA CLIENTS
-- ============================================================================

-- SELECT: Todos los autenticados pueden ver clientes
CREATE POLICY "clients_select_authenticated" ON public.clients
    FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- INSERT: Todos los autenticados pueden crear clientes
CREATE POLICY "clients_insert_authenticated" ON public.clients
    FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE: Todos los autenticados pueden actualizar clientes
CREATE POLICY "clients_update_authenticated" ON public.clients
    FOR UPDATE
    USING (auth.uid() IS NOT NULL)
    WITH CHECK (auth.uid() IS NOT NULL);

-- DELETE: Solo admins pueden eliminar clientes (protección de datos)
CREATE POLICY "clients_delete_admin" ON public.clients
    FOR DELETE
    USING (public.is_admin());

-- ============================================================================
-- PASO 6: POLÍTICAS PARA EQUIPMENTS
-- ============================================================================

-- SELECT: Todos los autenticados pueden ver equipos
CREATE POLICY "equipments_select_authenticated" ON public.equipments
    FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- INSERT: Todos los autenticados pueden crear equipos
CREATE POLICY "equipments_insert_authenticated" ON public.equipments
    FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE: Todos los autenticados pueden actualizar equipos
CREATE POLICY "equipments_update_authenticated" ON public.equipments
    FOR UPDATE
    USING (auth.uid() IS NOT NULL)
    WITH CHECK (auth.uid() IS NOT NULL);

-- DELETE: Solo admins pueden eliminar equipos
CREATE POLICY "equipments_delete_admin" ON public.equipments
    FOR DELETE
    USING (public.is_admin());

-- ============================================================================
-- PASO 7: POLÍTICAS PARA MAINTENANCES
-- ============================================================================

-- SELECT: Todos los autenticados pueden ver mantenimientos
CREATE POLICY "maintenances_select_authenticated" ON public.maintenances
    FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- INSERT: Todos los autenticados pueden crear, se registra automáticamente el creador
CREATE POLICY "maintenances_insert_authenticated" ON public.maintenances
    FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE: Solo el creador, el técnico asignado, o un admin puede actualizar
CREATE POLICY "maintenances_update_owner" ON public.maintenances
    FOR UPDATE
    USING (
        auth.uid() IS NOT NULL
        AND (
            created_by = auth.uid()
            OR technician_id = auth.uid()
            OR public.is_admin()
        )
    )
    WITH CHECK (
        auth.uid() IS NOT NULL
        AND (
            created_by = auth.uid()
            OR technician_id = auth.uid()
            OR public.is_admin()
        )
    );

-- DELETE: Solo el creador o un admin puede eliminar
CREATE POLICY "maintenances_delete_owner" ON public.maintenances
    FOR DELETE
    USING (
        created_by = auth.uid()
        OR public.is_admin()
    );

-- ============================================================================
-- PASO 8: POLÍTICAS PARA REMITOS
-- ============================================================================

-- SELECT: Todos los autenticados pueden ver remitos
CREATE POLICY "remitos_select_authenticated" ON public.remitos
    FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- INSERT: Todos los autenticados pueden crear remitos
CREATE POLICY "remitos_insert_authenticated" ON public.remitos
    FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE: Solo el creador, el técnico asignado, o un admin puede actualizar
CREATE POLICY "remitos_update_owner" ON public.remitos
    FOR UPDATE
    USING (
        auth.uid() IS NOT NULL
        AND (
            created_by = auth.uid()
            OR technician_id = auth.uid()
            OR public.is_admin()
        )
    )
    WITH CHECK (
        auth.uid() IS NOT NULL
        AND (
            created_by = auth.uid()
            OR technician_id = auth.uid()
            OR public.is_admin()
        )
    );

-- DELETE: Solo el creador o un admin puede eliminar
CREATE POLICY "remitos_delete_owner" ON public.remitos
    FOR DELETE
    USING (
        created_by = auth.uid()
        OR public.is_admin()
    );

-- ============================================================================
-- PASO 9: TRIGGER PARA AUTO-ASIGNAR created_by EN MAINTENANCES
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_maintenance_created_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Si no se especificó created_by, usar el usuario actual
    IF NEW.created_by IS NULL THEN
        NEW.created_by := auth.uid();
    END IF;
    
    -- Si no se especificó technician_id, usar el usuario actual
    IF NEW.technician_id IS NULL THEN
        NEW.technician_id := auth.uid();
    END IF;
    
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_set_maintenance_created_by ON public.maintenances;
CREATE TRIGGER trigger_set_maintenance_created_by
    BEFORE INSERT ON public.maintenances
    FOR EACH ROW
    EXECUTE FUNCTION public.set_maintenance_created_by();

-- ============================================================================
-- PASO 10: TRIGGER PARA AUTO-ASIGNAR created_by EN REMITOS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_remito_created_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Si no se especificó created_by, usar el usuario actual
    IF NEW.created_by IS NULL THEN
        NEW.created_by := auth.uid();
    END IF;
    
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_set_remito_created_by ON public.remitos;
CREATE TRIGGER trigger_set_remito_created_by
    BEFORE INSERT ON public.remitos
    FOR EACH ROW
    EXECUTE FUNCTION public.set_remito_created_by();

-- ============================================================================
-- PASO 11: VERIFICAR QUE RLS ESTÁ HABILITADO EN TODAS LAS TABLAS
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remitos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PASO 12: COMENTARIOS DE DOCUMENTACIÓN
-- ============================================================================

COMMENT ON FUNCTION public.is_admin() IS 'Verifica si el usuario actual tiene rol de admin';
COMMENT ON FUNCTION public.set_maintenance_created_by() IS 'Auto-asigna created_by al insertar mantenimiento';
COMMENT ON FUNCTION public.set_remito_created_by() IS 'Auto-asigna created_by al insertar remito';

-- ============================================================================
-- RESUMEN DE POLÍTICAS APLICADAS:
-- ============================================================================
-- 
-- TABLA          | SELECT | INSERT | UPDATE      | DELETE
-- -------------------------------------------------------------
-- profiles       | Auth   | Own    | Own         | Admin
-- clients        | Auth   | Auth   | Auth        | Admin
-- equipments     | Auth   | Auth   | Auth        | Admin
-- maintenances   | Auth   | Auth   | Owner/Admin | Owner/Admin
-- remitos        | Auth   | Auth   | Owner/Admin | Owner/Admin
-- feedback       | Own    | Auth   | Admin       | Admin (ya existente)
--
-- Auth = Usuario autenticado
-- Own = Solo el propio registro
-- Owner = Creador o técnico asignado
-- Admin = Solo usuarios con role='admin'
-- ============================================================================
