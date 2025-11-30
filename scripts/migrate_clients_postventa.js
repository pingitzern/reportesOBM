/**
 * Script de migración de clientes desde Post Venta - Cliente.csv
 * 
 * Este script:
 * 1. Lee el CSV de Post Venta
 * 2. Normaliza los datos (limpieza de teléfonos, emails, etc.)
 * 3. Hace UPSERT en la tabla clients de Supabase
 *    - Si existe un cliente con el mismo nombre, actualiza los datos
 *    - Si no existe, lo inserta
 * 
 * Uso: node scripts/migrate_clients_postventa.js
 */

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

// Cargar variables de entorno (primero .env.local, luego .env)
const localEnvPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(localEnvPath)) {
  dotenv.config({ path: localEnvPath });
}
dotenv.config(); // Carga .env sin sobreescribir las de .env.local

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  console.error('   Asegurate de tener un archivo .env o .env.local con estas variables.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Ruta al archivo CSV
const CSV_PATH = path.resolve(__dirname, '..', 'docs', 'Post Venta - Cliente.csv');

// Estadísticas de la migración
const stats = {
  total: 0,
  inserted: 0,
  updated: 0,
  skipped: 0,
  errors: 0,
};

/**
 * Lee el archivo CSV y retorna un array de objetos
 */
function readCsv(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    fs.createReadStream(filePath, { encoding: 'utf-8' })
      .pipe(csv())
      .on('data', (data) => rows.push(data))
      .on('end', () => resolve(rows))
      .on('error', reject);
  });
}

/**
 * Limpia y normaliza un valor string
 */
function cleanString(value) {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Normaliza un número de teléfono argentino
 * Elimina espacios, guiones, y caracteres no numéricos excepto el +
 */
function normalizePhone(phone) {
  if (!phone || typeof phone !== 'string') return null;
  
  // Limpiar caracteres especiales excepto números y +
  let cleaned = phone.replace(/[^\d+]/g, '');
  
  // Si está vacío después de limpiar, retornar null
  if (!cleaned || cleaned.length < 6) return null;
  
  return cleaned;
}

/**
 * Normaliza un email
 */
function normalizeEmail(email) {
  if (!email || typeof email !== 'string') return null;
  
  // Limpiar espacios y convertir a minúsculas
  let cleaned = email.trim().toLowerCase();
  
  // Remover prefijo "mailto:" si existe
  cleaned = cleaned.replace(/^mailto:/i, '');
  
  // Validación básica de formato
  if (!cleaned.includes('@') || !cleaned.includes('.')) return null;
  
  return cleaned;
}

/**
 * Normaliza el CUIT (formato XX-XXXXXXXX-X)
 */
function normalizeCuit(cuit) {
  if (!cuit || typeof cuit !== 'string') return null;
  
  // Limpiar todo excepto números
  const cleaned = cuit.replace(/\D/g, '');
  
  // CUIT válido tiene 11 dígitos
  if (cleaned.length !== 11) return null;
  
  // Formatear como XX-XXXXXXXX-X
  return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 10)}-${cleaned.slice(10)}`;
}

/**
 * Normaliza la división
 */
function normalizeDivision(division) {
  if (!division || typeof division !== 'string') return null;
  
  const cleaned = division.trim().toLowerCase();
  
  // Mapear variantes a valores estandarizados
  const divisionMap = {
    'aguas': 'Aguas',
    'core': 'Core',
    'i+d': 'I+D',
  };
  
  return divisionMap[cleaned] || (cleaned.length > 0 ? division.trim() : null);
}

/**
 * Normaliza el canal de adquisición
 */
function normalizeCanal(canal) {
  if (!canal || typeof canal !== 'string') return null;
  
  const cleaned = canal.trim().toLowerCase();
  
  // Mapear variantes a valores estandarizados
  const canalMap = {
    'referido': 'Referido',
    'instagram': 'Instagram',
    'landing page': 'Landing Page',
    'whatsapp': 'Whatsapp',
  };
  
  return canalMap[cleaned] || (cleaned.length > 0 ? canal.trim() : null);
}

/**
 * Transforma una fila del CSV al formato de Supabase
 */
function transformRow(row) {
  const nombre = cleanString(row.Nombre);
  
  // Si no tiene nombre, no es válido
  if (!nombre) return null;
  
  return {
    razon_social: nombre,
    direccion: cleanString(row.Direccion),
    telefono: normalizePhone(row.Telefono),
    email: normalizeEmail(row.Mail),
    cuit: normalizeCuit(row.CUIT),
    division: normalizeDivision(row.Division),
    canal: normalizeCanal(row.Canal),
    // Mantener contacto_info para compatibilidad con datos existentes
    contacto_info: {
      telefono_original: cleanString(row.Telefono),
      mail_original: cleanString(row.Mail),
    },
  };
}

/**
 * Busca un cliente existente por nombre (case-insensitive)
 */
async function findExistingClient(razonSocial) {
  const { data, error } = await supabase
    .from('clients')
    .select('id, razon_social')
    .ilike('razon_social', razonSocial)
    .limit(1);
  
  if (error) throw error;
  return data && data.length > 0 ? data[0] : null;
}

/**
 * Inserta un nuevo cliente
 */
async function insertClient(clientData) {
  const { data, error } = await supabase
    .from('clients')
    .insert(clientData)
    .select('id')
    .single();
  
  if (error) throw error;
  return data.id;
}

/**
 * Actualiza un cliente existente
 */
async function updateClient(id, clientData) {
  // Remover razon_social del update para no sobreescribir
  const { razon_social, ...updateData } = clientData;
  
  const { error } = await supabase
    .from('clients')
    .update(updateData)
    .eq('id', id);
  
  if (error) throw error;
}

/**
 * Procesa un cliente (upsert)
 */
async function processClient(row, index) {
  const clientData = transformRow(row);
  
  if (!clientData) {
    console.log(`  [${index}] ⏭️  Saltando fila vacía o sin nombre`);
    stats.skipped++;
    return;
  }
  
  try {
    const existing = await findExistingClient(clientData.razon_social);
    
    if (existing) {
      // Actualizar cliente existente
      await updateClient(existing.id, clientData);
      console.log(`  [${index}] 🔄 Actualizado: ${clientData.razon_social}`);
      stats.updated++;
    } else {
      // Insertar nuevo cliente
      const id = await insertClient(clientData);
      console.log(`  [${index}] ✅ Insertado: ${clientData.razon_social} -> ${id}`);
      stats.inserted++;
    }
  } catch (error) {
    console.error(`  [${index}] ❌ Error con ${clientData.razon_social}: ${error.message}`);
    stats.errors++;
  }
}

/**
 * Función principal de migración
 */
async function migrate() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  MIGRACIÓN DE CLIENTES - Post Venta CSV → Supabase');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`📁 Archivo: ${CSV_PATH}`);
  console.log('');
  
  // Verificar que el archivo existe
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`❌ Error: No se encontró el archivo ${CSV_PATH}`);
    process.exit(1);
  }
  
  // Leer el CSV
  console.log('📖 Leyendo archivo CSV...');
  const rows = await readCsv(CSV_PATH);
  stats.total = rows.length;
  console.log(`   Encontradas ${rows.length} filas\n`);
  
  // Procesar cada fila
  console.log('🔄 Procesando clientes...\n');
  
  for (let i = 0; i < rows.length; i++) {
    await processClient(rows[i], i + 1);
  }
  
  // Mostrar resumen
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  RESUMEN DE MIGRACIÓN');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  📊 Total procesados:  ${stats.total}`);
  console.log(`  ✅ Insertados:        ${stats.inserted}`);
  console.log(`  🔄 Actualizados:      ${stats.updated}`);
  console.log(`  ⏭️  Saltados:          ${stats.skipped}`);
  console.log(`  ❌ Errores:           ${stats.errors}`);
  console.log('═══════════════════════════════════════════════════════════');
  
  if (stats.errors > 0) {
    console.log('\n⚠️  La migración terminó con algunos errores.');
    process.exit(1);
  } else {
    console.log('\n✅ Migración completada exitosamente!');
  }
}

// Ejecutar
migrate().catch((error) => {
  console.error('\n❌ Error fatal durante la migración:', error);
  process.exit(1);
});
