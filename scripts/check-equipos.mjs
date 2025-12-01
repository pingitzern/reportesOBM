/**
 * Script para verificar equipos en Supabase
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nvoihnnwpzeofzexblyg.supabase.co';
const supabaseKey = 'sb_publishable_dvW0-3ZbPagf8gGgCct2cg_gut8ETt1';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkEquipos() {
    console.log('=== Verificando equipos en Supabase ===\n');

    // 1. Buscar el cliente Shell (loma verde)
    const { data: clientes, error: clienteError } = await supabase
        .from('clients')
        .select('id, razon_social')
        .ilike('razon_social', '%shell%loma%');

    if (clienteError) {
        console.error('Error buscando cliente:', clienteError);
        return;
    }

    console.log('Clientes encontrados:', clientes);

    if (clientes && clientes.length > 0) {
        const clientId = clientes[0].id;
        console.log(`\nBuscando equipos para cliente ID: ${clientId}\n`);

        // 2. Buscar equipos de ese cliente
        const { data: equipos, error: equiposError } = await supabase
            .from('equipments')
            .select('*')
            .eq('client_id', clientId);

        if (equiposError) {
            console.error('Error buscando equipos:', equiposError);
            return;
        }

        console.log(`Equipos encontrados: ${equipos?.length || 0}`);
        console.log(JSON.stringify(equipos, null, 2));
    }

    // 3. Contar total de equipos
    const { data: totalEquipos, error: countError } = await supabase
        .from('equipments')
        .select('id', { count: 'exact', head: true });

    const { count } = await supabase
        .from('equipments')
        .select('*', { count: 'exact', head: true });

    console.log(`\nTotal de equipos en la tabla: ${count}`);
}

checkEquipos().catch(console.error);
