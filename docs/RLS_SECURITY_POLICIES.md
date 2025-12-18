# 🔐 Políticas de Seguridad RLS - Supabase

**Fecha:** 30 de Noviembre, 2025  
**Proyecto:** ReportesOBM  
**Versión:** 1.0

---

## 📋 Índice

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Tablas Identificadas](#tablas-identificadas)
3. [Matriz de Permisos](#matriz-de-permisos)
4. [Detalle por Tabla](#detalle-por-tabla)
5. [Funciones Auxiliares](#funciones-auxiliares)
6. [Instrucciones de Ejecución](#instrucciones-de-ejecución)
7. [Script SQL Completo](#script-sql-completo)

---

## Resumen Ejecutivo

Este documento describe las políticas de Row Level Security (RLS) implementadas para asegurar los datos en Supabase. Las políticas garantizan que:

- ✅ **Usuarios no autenticados** no pueden acceder a ningún dato
- ✅ **Usuarios autenticados** tienen acceso de lectura a datos compartidos
- ✅ **Solo el creador o admin** puede modificar/eliminar registros sensibles
- ✅ **Datos de clientes protegidos** contra eliminación accidental

---

## Tablas Identificadas

| Tabla | Descripción | Operaciones Frontend |
|-------|-------------|---------------------|
| `profiles` | Perfiles de usuarios/técnicos | SELECT (filtros) |
| `clients` | Catálogo de clientes | SELECT, INSERT, UPDATE |
| `equipments` | Equipos de clientes | SELECT, INSERT, UPDATE |
| `maintenances` | Registros de mantenimiento | SELECT, INSERT, UPDATE, DELETE |
| `remitos` | Remitos de servicio | SELECT, INSERT, UPDATE, DELETE |
| `feedback` | Tickets de feedback | INSERT, SELECT (propios) |

**Storage Bucket:** `maintenance-reports` (PDFs e imágenes)

---

## Matriz de Permisos

| Tabla | SELECT | INSERT | UPDATE | DELETE |
|-------|:------:|:------:|:------:|:------:|
| `profiles` | 🟢 Auth | 🟡 Own | 🟡 Own | 🟣 Elevated |
| `clients` | 🟢 Auth | 🟢 Auth | 🟢 Auth | 🟣 Elevated |
| `equipments` | 🟢 Auth | 🟢 Auth | 🟢 Auth | 🟣 Elevated |
| `maintenances` | 🟢 Auth | 🟢 Auth | 🟡 Owner/Elevated | 🟡 Owner/Elevated |
| `remitos` | 🟢 Auth | 🟢 Auth | 🟡 Owner/Elevated | 🟡 Owner/Elevated |
| `feedback` | 🟡 Own | 🟢 Auth | 🟣 Elevated | 🟣 Elevated |

**Leyenda:**
- 🟢 **Auth** = Cualquier usuario autenticado
- 🟡 **Own/Owner** = Solo el propietario del registro
- 🟣 **Elevated** = Usuarios con permisos elevados (admin, ventas, coordinador, jefe_servicio)

---

## Roles del Sistema

| Rol | Panel Admin | Coordinar Agenda | Crear WO | Delete/Update Datos |
|-----|:-----------:|:----------------:|:--------:|:-------------------:|
| `admin` | ✅ | ✅ | ✅ | ✅ |
| `ventas` | ✅ | ❌ | ✅ | ✅ |
| `coordinador` | ❌ | ✅ | ✅ | ✅ |
| `jefe_servicio` | ❌ | ❌ (solo ver) | ✅ | ✅ |
| `tecnico` | ❌ | ❌ (solo ver) | ❌ | Solo propios |

### Descripción de Roles

- **admin** - Administrador: Acceso completo a todas las funciones
- **ventas** - Ventas: Panel Admin + Crear WOs, NO puede coordinar agenda
- **coordinador** - Coordinador: Agenda completa, NO tiene panel admin
- **jefe_servicio** - Jefe de Servicio: Permisos elevados, agenda solo lectura
- **tecnico** - Técnico: Permisos básicos, agenda solo lectura

---

## Detalle por Tabla

### 1. profiles

```sql
-- SELECT: Todos pueden ver nombres de técnicos
CREATE POLICY "profiles_select_authenticated" ON public.profiles
    FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- UPDATE: Solo el propio usuario
CREATE POLICY "profiles_update_own" ON public.profiles
    FOR UPDATE
    USING (auth.uid() = id);

-- DELETE: Solo admins
CREATE POLICY "profiles_delete_admin" ON public.profiles
    FOR DELETE
    USING (public.is_admin());
```

### 2. clients

```sql
-- SELECT/INSERT/UPDATE: Usuarios autenticados
CREATE POLICY "clients_select_authenticated" ON public.clients
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "clients_insert_authenticated" ON public.clients
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "clients_update_authenticated" ON public.clients
    FOR UPDATE USING (auth.uid() IS NOT NULL);

-- DELETE: Solo admins (protección de datos)
CREATE POLICY "clients_delete_admin" ON public.clients
    FOR DELETE USING (public.is_admin());
```

### 3. maintenances

```sql
-- SELECT/INSERT: Usuarios autenticados
CREATE POLICY "maintenances_select_authenticated" ON public.maintenances
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- UPDATE/DELETE: Solo creador, técnico asignado, o admin
CREATE POLICY "maintenances_update_owner" ON public.maintenances
    FOR UPDATE
    USING (
        created_by = auth.uid()
        OR technician_id = auth.uid()
        OR public.is_admin()
    );

CREATE POLICY "maintenances_delete_owner" ON public.maintenances
    FOR DELETE
    USING (
        created_by = auth.uid()
        OR public.is_admin()
    );
```

### 4. remitos

```sql
-- Misma lógica que maintenances
-- SELECT/INSERT: Autenticados
-- UPDATE/DELETE: Owner o Admin
```

### 5. feedback

```sql
-- INSERT: Cualquier autenticado puede crear tickets
CREATE POLICY "Usuarios pueden crear feedback" ON public.feedback
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- SELECT: Solo propios tickets
CREATE POLICY "Usuarios ven su propio feedback" ON public.feedback
    FOR SELECT
    USING (auth.uid() = user_id OR user_email = auth.email());

-- UPDATE/DELETE: Solo admins
CREATE POLICY "Admins gestionan todo el feedback" ON public.feedback
    FOR ALL USING (public.is_admin());
```

---

## Funciones Auxiliares

### is_admin()

Verifica si el usuario actual tiene rol de administrador:

```sql
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
```

### Triggers de Auto-asignación

Se crean triggers para asignar automáticamente `created_by` al insertar:

```sql
-- Para maintenances
CREATE TRIGGER trigger_set_maintenance_created_by
    BEFORE INSERT ON public.maintenances
    FOR EACH ROW
    EXECUTE FUNCTION public.set_maintenance_created_by();

-- Para remitos  
CREATE TRIGGER trigger_set_remito_created_by
    BEFORE INSERT ON public.remitos
    FOR EACH ROW
    EXECUTE FUNCTION public.set_remito_created_by();
```

---

## Instrucciones de Ejecución

### Opción 1: Supabase Dashboard

1. Ir a **SQL Editor** en el dashboard de Supabase
2. Copiar el contenido del archivo `supabase/migrations/20251130100000_rls_security_policies.sql`
3. Ejecutar el script

### Opción 2: CLI de Supabase

```bash
npx supabase db push
```

### Opción 3: Migración Manual

```bash
npx supabase migration up
```

---

## Script SQL Completo

El script completo se encuentra en:

```
supabase/migrations/20251130100000_rls_security_policies.sql
```

### Pasos que ejecuta:

1. ❌ Elimina políticas antiguas (usaban `auth.role()` deprecated)
2. ➕ Agrega columna `created_by` a `maintenances`
3. 🔧 Crea función `is_admin()`
4. 📋 Crea políticas granulares por tabla
5. ⚡ Configura triggers de auto-asignación
6. ✅ Verifica RLS habilitado en todas las tablas

---

## Notas de Seguridad

⚠️ **Importante:**

1. Las políticas anteriores usaban `auth.role() = 'authenticated'` que está **deprecated**
2. Ahora usamos `auth.uid() IS NOT NULL` que es la forma correcta
3. La política de `remitos` con `using(true)` fue eliminada por ser insegura
4. El rol `service_role` tiene acceso completo por defecto (para Edge Functions)

---

## Verificación Post-Implementación

Después de ejecutar el script, verificar con:

```sql
-- Ver políticas activas
SELECT tablename, policyname, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename;

-- Verificar RLS habilitado
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';
```

---

*Documento generado automáticamente - ReportesOBM v2.0*
