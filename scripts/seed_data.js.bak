const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

const envResult = dotenv.config();
if (envResult.error) {
  const localEnvPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(localEnvPath)) {
    const localResult = dotenv.config({ path: localEnvPath, override: false });
    if (localResult.error) {
      console.warn('Could not load .env, .env.local parse also failed.');
    }
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env/.env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const DATA_DIR = path.resolve(__dirname, '..', 'migracionSUPABASE');
const FILES = {
  clients: 'BaseDatosMantenimientosRO - clientes.csv',
  osmosis: 'BaseDatosMantenimientosRO - Hoja 1 (1).csv',
  softener: 'BaseDatosMantenimientosRO - softener_mantenimiento (5).csv',
};

function readCsvRows(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => rows.push(normalizeRow(data)))
      .on('end', () => resolve(rows))
      .on('error', reject);
  });
}

function normalizeRow(row) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key.trim(), cleanValue(value)])
  );
}

function cleanValue(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function parseDate(value) {
  if (!value) return new Date().toISOString();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
  return parsed.toISOString();
}

async function insertClient(row) {
  const payload = {
    razon_social: row.Nombre,
    direccion: row.Direccion,
    cuit: row.CUIT,
    contacto_info: {
      telefono: row.Telefono,
      mail: row.Mail,
      division: row.Division,
      canal: row.Canal,
    },
  };

  const { data, error } = await supabase
    .from('clients')
    .insert(payload)
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

async function ensureEquipment({ clientId, modelo, serial, type }, cache) {
  const cacheKey = `${clientId}|${modelo}|${serial}|${type}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const payload = {
    client_id: clientId,
    modelo: modelo || 'DESCONOCIDO',
    serial_number: serial,
    type,
  };

  const { data, error } = await supabase
    .from('equipments')
    .insert(payload)
    .select('id')
    .single();

  if (error) throw error;
  cache.set(cacheKey, data.id);
  return data.id;
}

function buildReportPayload(row, excludedKeys) {
  return Object.fromEntries(
    Object.entries(row).filter(([key, value]) => !excludedKeys.has(key) && value !== null)
  );
}

async function createMaintenance({ clientId, equipmentId, serviceDate, type, reportData }) {
  const payload = {
    client_id: clientId,
    equipment_id: equipmentId,
    service_date: serviceDate,
    status: 'borrador',
    report_data: reportData,
    type,
  };

  const { error } = await supabase.from('maintenances').insert(payload);
  if (error) throw error;
}

async function seed() {
  console.log('Starting seed process...');
  const clientsPath = path.join(DATA_DIR, FILES.clients);
  const osmosisPath = path.join(DATA_DIR, FILES.osmosis);
  const softenerPath = path.join(DATA_DIR, FILES.softener);

  const clientsRows = await readCsvRows(clientsPath);
  console.log(`[Clientes] Found ${clientsRows.length} rows.`);

  const clientMap = new Map();

  for (const row of clientsRows) {
    if (!row.Nombre) {
      console.warn('[Clientes] Skipping row without Nombre.');
      continue;
    }

    try {
      const id = await insertClient(row);
      clientMap.set(row.Nombre.toLowerCase(), id);
      console.log(`[Clientes] Inserted ${row.Nombre} -> ${id}`);
    } catch (error) {
      console.error(`[Clientes] Failed to insert ${row.Nombre}:`, error.message);
    }
  }

  const equipmentCache = new Map();

  const osmosisRows = await readCsvRows(osmosisPath);
  console.log(`[Osmosis] Found ${osmosisRows.length} rows.`);

  for (const row of osmosisRows) {
    const clientName = row.Cliente?.toLowerCase();
    if (!clientName || !clientMap.has(clientName)) {
      console.warn(`[Osmosis] Missing client match for ${row.Cliente}`);
      continue;
    }

    const clientId = clientMap.get(clientName);
    const equipmentId = await ensureEquipment(
      {
        clientId,
        modelo: row.Modelo_Equipo,
        serial: row.Numero_Serie || row.ID_Interna_Activo,
        type: 'ro',
      },
      equipmentCache
    );

    const excluded = new Set([
      'Cliente',
      'Fecha_Servicio',
      'Direccion',
      'Tecnico_Asignado',
      'Modelo_Equipo',
      'ID_Interna_Activo',
      'Numero_Serie',
      'Proximo_Mantenimiento',
    ]);

    const reportData = buildReportPayload(row, excluded);

    await createMaintenance({
      clientId,
      equipmentId,
      serviceDate: parseDate(row.Fecha_Servicio),
      type: 'ro',
      reportData,
    });

    console.log(`[Osmosis] Inserted maintenance for ${row.Cliente} (${row.Numero_Reporte || 'sin nro'})`);
  }

  const softenerRows = await readCsvRows(softenerPath);
  console.log(`[Softener] Found ${softenerRows.length} rows.`);

  for (const row of softenerRows) {
    const clientName = row.Cliente_Nombre?.toLowerCase() || row.Cliente?.toLowerCase();
    if (!clientName || !clientMap.has(clientName)) {
      console.warn(`[Softener] Missing client match for ${row.Cliente_Nombre || row.Cliente}`);
      continue;
    }

    const clientId = clientMap.get(clientName);
    const equipmentId = await ensureEquipment(
      {
        clientId,
        modelo: row.Equipo_Modelo,
        serial: row.Equipo_NumeroSerie,
        type: 'softener',
      },
      equipmentCache
    );

    const excluded = new Set([
      'Cliente_Nombre',
      'Cliente',
      'Cliente_Direccion',
      'Cliente_Localidad',
      'Cliente_Contacto',
      'Cliente_Telefono',
      'Cliente_Email',
      'Cliente_CUIT',
      'Cliente_Telefono_Remito',
      'Cliente_Email_Remito',
      'Cliente_CUIT_Remito',
      'Cliente_Direccion',
      'Cliente',
      'Servicio_Fecha',
      'Servicio_Tecnico',
      'Equipo_Tipo',
      'Equipo_Modelo',
      'Equipo_NumeroSerie',
    ]);

    const reportData = buildReportPayload(row, excluded);

    await createMaintenance({
      clientId,
      equipmentId,
      serviceDate: parseDate(row.Servicio_Fecha || row.Fecha_Registro),
      type: 'softener',
      reportData,
    });

    console.log(`[Softener] Inserted maintenance for ${row.Cliente_Nombre || row.Cliente}`);
  }

  console.log('Seed process complete.');
}

seed().catch((error) => {
  console.error('Seed process failed:', error);
  process.exit(1);
});
