-- ============================================================================
-- FIX: Corregir políticas RLS para sistemas
-- El rol en la base de datos es 'Administrador', no 'admin'
-- ============================================================================

-- Eliminar políticas existentes
drop policy if exists "Lectura sistemas para autenticados" on public.sistemas;
drop policy if exists "Gestión sistemas solo admin" on public.sistemas;

-- Crear política de lectura para todos los autenticados
create policy "sistemas_select_policy" on public.sistemas
    for select 
    to authenticated
    using (true);

-- Crear política de inserción para admins
create policy "sistemas_insert_policy" on public.sistemas
    for insert 
    to authenticated
    with check (
        exists (
            select 1 from public.profiles 
            where id = auth.uid() 
            and (role = 'Administrador' or role = 'admin')
        )
    );

-- Crear política de actualización para admins
create policy "sistemas_update_policy" on public.sistemas
    for update 
    to authenticated
    using (
        exists (
            select 1 from public.profiles 
            where id = auth.uid() 
            and (role = 'Administrador' or role = 'admin')
        )
    )
    with check (
        exists (
            select 1 from public.profiles 
            where id = auth.uid() 
            and (role = 'Administrador' or role = 'admin')
        )
    );

-- Crear política de eliminación para admins
create policy "sistemas_delete_policy" on public.sistemas
    for delete 
    to authenticated
    using (
        exists (
            select 1 from public.profiles 
            where id = auth.uid() 
            and (role = 'Administrador' or role = 'admin')
        )
    );

-- Grant permisos básicos
grant select on public.sistemas to authenticated;
grant insert, update, delete on public.sistemas to authenticated;
