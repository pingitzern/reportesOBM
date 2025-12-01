/**
 * Script de Migración: Clientes, Sistemas y Equipos a Supabase
 * 
 * Migra:
 * 1. Tabla Clientes (Post Venta - Cliente.csv)
 * 2. Tabla Sistemas (catálogo de tipos de equipos)
 * 3. Tabla BaseUnificada -> equipments (equipos asignados a clientes)
 * 
 * USO: node scripts/migrate-sistemas-equipos.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';

// Configuración Supabase - usar SERVICE_ROLE_KEY para bypass RLS
const supabaseUrl = 'https://nvoihnnwpzeofzexblyg.supabase.co';
const supabaseKey = 'sb_secret_vImzzDMFaWShp9ysWqDRGQ_zsEz0HgM'; // service_role key
const supabase = createClient(supabaseUrl, supabaseKey);

// Rutas de los archivos CSV
const CLIENTES_CSV = './docs/Post Venta - Cliente.csv';
const SISTEMAS_CSV = './docs/Post Venta - Sistemas.csv';
const BASE_UNIFICADA_CSV = './docs/Post Venta - BaseUnificada.csv';

// Cache para mapeos
let sistemasMap = new Map(); // nombre -> id
let clientesMap = new Map(); // razon_social (lowercase) -> id

/**
 * Lee un archivo CSV y lo parsea
 */
function readCSV(filePath) {
    try {
        const content = readFileSync(filePath, 'utf-8');
        return parse(content, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
            bom: true
        });
    } catch (error) {
        console.error(`Error leyendo ${filePath}:`, error.message);
        return [];
    }
}

/**
 * Cargar clientes existentes de Supabase para mapeo
 */
async function loadClientesMap() {
    console.log('📋 Cargando clientes existentes de Supabase...');
    
    const { data, error } = await supabase
        .from('clients')
        .select('id, razon_social');
    
    if (error) {
        console.error('Error cargando clientes:', error);
        return;
    }
    
    for (const cliente of data || []) {
        if (cliente.razon_social) {
            clientesMap.set(cliente.razon_social.toLowerCase().trim(), cliente.id);
        }
    }
    
    console.log(`   ✓ ${clientesMap.size} clientes cargados`);
}

/**
 * Migrar clientes desde CSV
 */
async function migrateClientes() {
    console.log('\n👥 MIGRANDO CLIENTES...');
    
    const clientes = readCSV(CLIENTES_CSV);
    
    if (clientes.length === 0) {
        console.log('   ⚠️  No se encontró el archivo de clientes o está vacío');
        return false;
    }
    
    console.log(`   📄 ${clientes.length} clientes encontrados en CSV`);
    
    // Preparar datos - Columnas: Nombre,Direccion,Telefono,Mail,CUIT,Division,Canal
    const clientesToInsert = clientes.map(row => {
        const nombre = row.Nombre || '';
        if (!nombre.trim()) return null;
        
        return {
            razon_social: nombre.trim(),
            direccion: row.Direccion?.trim() || null,
            telefono: row.Telefono?.trim() || null,
            email: row.Mail?.trim() || null,
            cuit: row.CUIT?.trim() || null,
        };
    }).filter(c => c !== null);
    
    // Eliminar duplicados por nombre
    const uniqueClientes = [...new Map(clientesToInsert.map(c => [c.razon_social.toLowerCase(), c])).values()];
    
    console.log(`   🔄 Insertando ${uniqueClientes.length} clientes únicos...`);
    
    // Insertar en lotes de 50
    const batchSize = 50;
    let inserted = 0;
    let errors = 0;
    
    for (let i = 0; i < uniqueClientes.length; i += batchSize) {
        const batch = uniqueClientes.slice(i, i + batchSize);
        
        const { data, error } = await supabase
            .from('clients')
            .upsert(batch, { onConflict: 'razon_social', ignoreDuplicates: true })
            .select('id, razon_social');
        
        if (error) {
            console.error(`   ❌ Error en lote ${i / batchSize + 1}:`, error.message);
            errors += batch.length;
        } else {
            inserted += data?.length || 0;
            // Actualizar mapa
            for (const c of data || []) {
                clientesMap.set(c.razon_social.toLowerCase().trim(), c.id);
            }
        }
    }
    
    // Recargar el mapa completo de clientes
    await loadClientesMap();
    
    console.log(`   ✅ ${inserted} clientes insertados/actualizados`);
    if (errors > 0) console.log(`   ⚠️  ${errors} errores`);
    
    return true;
}

/**
 * Detectar categoría basada en el nombre del sistema
 */
function detectCategoria(nombre) {
    const nombreLower = nombre.toLowerCase();
    
    if (nombreLower.includes('ablandador') || nombreLower.includes('softener')) return 'ablandador';
    if (nombreLower.includes('osmosis') || nombreLower.includes('ósmosis')) return 'osmosis';
    if (nombreLower.includes('hplc')) return 'hplc';
    if (nombreLower.includes('destilador')) return 'laboratorio';
    if (nombreLower.includes('filtro') || nombreLower.includes('cartucho')) return 'insumo';
    if (nombreLower.includes('mantenimiento') || nombreLower.includes('servicio')) return 'servicio';
    
    return 'otro';
}

/**
 * Migrar tabla Sistemas
 */
async function migrateSistemas() {
    console.log('\n🔧 MIGRANDO SISTEMAS...');
    
    const sistemas = readCSV(SISTEMAS_CSV);
    
    if (sistemas.length === 0) {
        console.log('   ⚠️  No se encontró el archivo sistemas.csv o está vacío');
        console.log('   📁 Por favor exporta la hoja "Sistemas" a: migracionSUPABASE/sistemas.csv');
        return false;
    }
    
    console.log(`   📄 ${sistemas.length} sistemas encontrados en CSV`);
    
    // Preparar datos para inserción
    const sistemasToInsert = sistemas.map(row => {
        // Columnas del CSV: Sistema,Codigo,Descripcion,Imagen,Vida util (dias)
        const nombre = row.Sistema || '';
        const codigo = row.Codigo || null;
        const descripcion = row.Descripcion || null;
        const imagenUrl = row.Imagen || null;
        const vidaUtilDias = parseInt(row['Vida util (dias)']) || 365;
        
        return {
            nombre: nombre.trim(),
            codigo: codigo?.trim() || null,
            descripcion: descripcion?.trim() || null,
            imagen_url: imagenUrl?.trim() || null,
            vida_util_dias: vidaUtilDias,
            categoria: detectCategoria(nombre),
            activo: true
        };
    }).filter(s => s.nombre); // Filtrar registros sin nombre
    
    // Eliminar duplicados por nombre
    const uniqueSistemas = [...new Map(sistemasToInsert.map(s => [s.nombre, s])).values()];
    
    console.log(`   🔄 Insertando ${uniqueSistemas.length} sistemas únicos...`);
    
    // Insertar en lotes de 50
    const batchSize = 50;
    let inserted = 0;
    let errors = 0;
    
    for (let i = 0; i < uniqueSistemas.length; i += batchSize) {
        const batch = uniqueSistemas.slice(i, i + batchSize);
        
        const { data, error } = await supabase
            .from('sistemas')
            .upsert(batch, { onConflict: 'nombre', ignoreDuplicates: true })
            .select('id, nombre');
        
        if (error) {
            console.error(`   ❌ Error en lote ${i / batchSize + 1}:`, error.message);
            errors += batch.length;
        } else {
            inserted += data?.length || 0;
            // Actualizar mapa
            for (const s of data || []) {
                sistemasMap.set(s.nombre.toLowerCase().trim(), s.id);
            }
        }
    }
    
    // Cargar todos los sistemas para tener el mapa completo
    const { data: allSistemas } = await supabase.from('sistemas').select('id, nombre');
    for (const s of allSistemas || []) {
        sistemasMap.set(s.nombre.toLowerCase().trim(), s.id);
    }
    
    console.log(`   ✅ ${inserted} sistemas insertados/actualizados`);
    if (errors > 0) console.log(`   ⚠️  ${errors} errores`);
    
    return true;
}

/**
 * Migrar BaseUnificada -> equipments
 */
async function migrateEquipos() {
    console.log('\n📦 MIGRANDO EQUIPOS (BaseUnificada)...');
    
    const equipos = readCSV(BASE_UNIFICADA_CSV);
    
    if (equipos.length === 0) {
        console.log('   ⚠️  No se encontró el archivo base-unificada.csv o está vacío');
        console.log('   📁 Por favor exporta la hoja "BaseUnificada" a: migracionSUPABASE/base-unificada.csv');
        return false;
    }
    
    console.log(`   📄 ${equipos.length} equipos encontrados en CSV`);
    
    // Debug: mostrar columnas
    if (equipos.length > 0) {
        console.log('   📋 Columnas detectadas:', Object.keys(equipos[0]).join(', '));
    }
    
    let processed = 0;
    let inserted = 0;
    let skipped = 0;
    let clienteNotFound = 0;
    
    const equiposToInsert = [];
    
    for (const row of equipos) {
        processed++;
        
        // Columnas del CSV: Cliente,Equipo,Serie,Modelo,TAG/ID
        const clienteNombre = row.Cliente || '';
        const equipoNombre = row.Equipo || '';
        const serie = row.Serie || '';
        const modelo = row.Modelo || '';
        const tagId = row['TAG/ID'] || '';
        
        if (!clienteNombre) {
            skipped++;
            continue;
        }
        
        // Buscar cliente
        const clientId = clientesMap.get(clienteNombre.toLowerCase().trim());
        
        if (!clientId) {
            if (clienteNotFound < 10) { // Solo mostrar primeros 10
                console.log(`   ⚠️  Cliente no encontrado: "${clienteNombre}"`);
            }
            clienteNotFound++;
            continue;
        }
        
        // Buscar sistema
        const sistemaId = sistemasMap.get(equipoNombre.toLowerCase().trim());
        
        equiposToInsert.push({
            client_id: clientId,
            sistema_id: sistemaId || null,
            serial_number: serie?.trim() || null,
            modelo: modelo?.trim() || null,
            tag_id: tagId?.trim() || null,
            activo: true
        });
    }
    
    console.log(`   📊 ${equiposToInsert.length} equipos válidos para insertar`);
    console.log(`   ⏭️  ${skipped} registros sin cliente`);
    if (clienteNotFound > 0) {
        console.log(`   ⚠️  ${clienteNotFound} clientes no encontrados en Supabase`);
    }
    
    // Insertar en lotes
    const batchSize = 50;
    
    for (let i = 0; i < equiposToInsert.length; i += batchSize) {
        const batch = equiposToInsert.slice(i, i + batchSize);
        
        const { data, error } = await supabase
            .from('equipments')
            .insert(batch)
            .select('id');
        
        if (error) {
            console.error(`   ❌ Error en lote ${i / batchSize + 1}:`, error.message);
        } else {
            inserted += data?.length || 0;
        }
        
        // Progreso
        if ((i + batchSize) % 200 === 0) {
            console.log(`   ... ${Math.min(i + batchSize, equiposToInsert.length)}/${equiposToInsert.length} procesados`);
        }
    }
    
    console.log(`   ✅ ${inserted} equipos insertados`);
    
    return true;
}

/**
 * Verificar resultados
 */
async function verifyMigration() {
    console.log('\n✔️  VERIFICANDO MIGRACIÓN...');
    
    const { count: sistemasCount } = await supabase
        .from('sistemas')
        .select('*', { count: 'exact', head: true });
    
    const { count: equiposCount } = await supabase
        .from('equipments')
        .select('*', { count: 'exact', head: true });
    
    console.log(`   📊 Sistemas en Supabase: ${sistemasCount}`);
    console.log(`   📊 Equipos en Supabase: ${equiposCount}`);
    
    // Verificar Shell (loma verde)
    const { data: shellClient } = await supabase
        .from('clients')
        .select('id, razon_social')
        .ilike('razon_social', '%shell%loma%')
        .single();
    
    if (shellClient) {
        const { data: shellEquipos } = await supabase
            .from('equipments')
            .select('serial_number, modelo, tag_id')
            .eq('client_id', shellClient.id);
        
        console.log(`\n   🔍 Equipos de "${shellClient.razon_social}":`);
        for (const e of shellEquipos || []) {
            console.log(`      - Serie: ${e.serial_number || 'N/A'}, Modelo: ${e.modelo || 'N/A'}, TAG: ${e.tag_id || 'N/A'}`);
        }
    }
}

/**
 * Main
 */
async function main() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  MIGRACIÓN: Clientes, Sistemas y Equipos a Supabase');
    console.log('═══════════════════════════════════════════════════════════');
    
    // Cargar clientes existentes
    await loadClientesMap();
    
    // Migrar clientes primero
    await migrateClientes();
    
    // Migrar sistemas
    await migrateSistemas();
    
    // Migrar equipos
    await migrateEquipos();
    
    // Verificar
    await verifyMigration();
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  MIGRACIÓN COMPLETADA');
    console.log('═══════════════════════════════════════════════════════════\n');
}

main().catch(console.error);
