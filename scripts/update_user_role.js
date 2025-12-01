/**
 * Script para actualizar el rol de un usuario en Supabase
 * Uso: node scripts/update_user_role.js <email> <rol>
 * Ejemplo: node scripts/update_user_role.js admin@example.com Administrador
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar variables de entorno
const localEnvPath = path.resolve(__dirname, '..', '.env.local');
dotenv.config({ path: localEnvPath });
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Error: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son requeridos');
    console.error('Asegúrate de tener estas variables en .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function updateUserRole(email, newRole) {
    console.log(`\nBuscando usuario con email: ${email}`);
    
    // Listar usuarios para encontrar el ID
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
        console.error('Error listando usuarios:', listError);
        return;
    }
    
    const user = users.find(u => u.email === email);
    
    if (!user) {
        console.error(`Usuario con email ${email} no encontrado`);
        console.log('\nUsuarios disponibles:');
        users.forEach(u => console.log(`  - ${u.email} (rol actual: ${u.user_metadata?.rol || 'sin rol'})`));
        return;
    }
    
    console.log(`Usuario encontrado: ${user.id}`);
    console.log(`Rol actual: ${user.user_metadata?.rol || 'sin rol'}`);
    console.log(`Actualizando rol a: ${newRole}`);
    
    // Actualizar el user_metadata con el nuevo rol
    const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
        user_metadata: {
            ...user.user_metadata,
            rol: newRole
        }
    });
    
    if (error) {
        console.error('Error actualizando usuario:', error);
        return;
    }
    
    console.log('\n✅ Rol actualizado correctamente!');
    console.log('Nuevo user_metadata:', data.user.user_metadata);
    console.log('\n⚠️  El usuario debe cerrar sesión y volver a iniciar para ver los cambios.');
}

async function listUsers() {
    console.log('\nListando todos los usuarios y sus roles:\n');
    
    const { data: { users }, error } = await supabase.auth.admin.listUsers();
    
    if (error) {
        console.error('Error:', error);
        return;
    }
    
    users.forEach(user => {
        console.log(`Email: ${user.email}`);
        console.log(`  ID: ${user.id}`);
        console.log(`  Rol: ${user.user_metadata?.rol || '(sin rol)'}`);
        console.log(`  Nombre: ${user.user_metadata?.nombre || '(sin nombre)'}`);
        console.log('');
    });
}

// Main
const args = process.argv.slice(2);

if (args.length === 0) {
    // Sin argumentos, listar usuarios
    listUsers();
} else if (args.length === 2) {
    // Con email y rol, actualizar
    const [email, role] = args;
    updateUserRole(email, role);
} else {
    console.log('Uso:');
    console.log('  Listar usuarios: node scripts/update_user_role.js');
    console.log('  Actualizar rol:  node scripts/update_user_role.js <email> <rol>');
    console.log('');
    console.log('Ejemplos de roles: Administrador, tecnico, supervisor');
}
