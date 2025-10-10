const MOD_CODE_VERSION = 'SMRO-CODE-2025-09-21';

const _json = (payload) =>
  ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);

const SCRIPT_PROPERTIES = PropertiesService.getScriptProperties();
const AUTHORIZED_USERS_PROPERTY = 'AUTHORIZED_USERS';
const CLIENTES_SHEET_NAME_PROPERTY = 'CLIENTES_SHEET_NAME';
const REMITOS_SHEET_ID_PROPERTY = 'REMITOS_SHEET_ID';
const REMITOS_SHEET_NAME_PROPERTY = 'REMITOS_SHEET_NAME';
const REMITOS_SPREADSHEET_NAME_PROPERTY = 'REMITOS_SPREADSHEET_NAME';

const SCRIPT_TIMEZONE = Session.getScriptTimeZone ? Session.getScriptTimeZone() : 'GMT';

const DEFAULT_CONFIGURATION = Object.freeze({
  SHEET_ID: '14_6UyAhZQqHz6EGMRhr7YyqQ-KHMBsjeU4M5a_SRhis',
  SHEET_NAME: 'Hoja 1',
  CLIENTES_SHEET_NAME: 'clientes'
});

const DEFAULT_REMITOS_CONFIGURATION = Object.freeze({
  SHEET_ID: '',
  SHEET_NAME: 'remitos',
  SPREADSHEET_NAME: 'BaseDatosMantenimientosRO'
});

const DEFAULT_AUTHORIZED_USERS = Object.freeze([
  { usuario: 'pingitzernicolas@gmail.com', token: '12345ABCD' }
]);

const DEFAULT_PROPERTY_VALUES = Object.freeze({
  SHEET_ID: DEFAULT_CONFIGURATION.SHEET_ID,
  SHEET_NAME: DEFAULT_CONFIGURATION.SHEET_NAME,
  [CLIENTES_SHEET_NAME_PROPERTY]: DEFAULT_CONFIGURATION.CLIENTES_SHEET_NAME,
  [AUTHORIZED_USERS_PROPERTY]: JSON.stringify(DEFAULT_AUTHORIZED_USERS),
  [REMITOS_SHEET_ID_PROPERTY]: DEFAULT_REMITOS_CONFIGURATION.SHEET_ID,
  [REMITOS_SHEET_NAME_PROPERTY]: DEFAULT_REMITOS_CONFIGURATION.SHEET_NAME,
  [REMITOS_SPREADSHEET_NAME_PROPERTY]: DEFAULT_REMITOS_CONFIGURATION.SPREADSHEET_NAME
});

function getPropertyOrDefault(propertyName, fallback) {
  const value = SCRIPT_PROPERTIES.getProperty(propertyName);

  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  return fallback;
}

function getAuthorizedUsersProperty() {
  return getPropertyOrDefault(
    AUTHORIZED_USERS_PROPERTY,
    DEFAULT_PROPERTY_VALUES[AUTHORIZED_USERS_PROPERTY]
  );
}

function initProperties(overrides) {
  const properties = Object.assign({}, DEFAULT_PROPERTY_VALUES, overrides || {});

  SCRIPT_PROPERTIES.setProperties(properties, true);
}

const SHEET_ID = getPropertyOrDefault('SHEET_ID', DEFAULT_CONFIGURATION.SHEET_ID);
const SHEET_NAME = getPropertyOrDefault('SHEET_NAME', DEFAULT_CONFIGURATION.SHEET_NAME);
const CLIENTES_SHEET_NAME = getPropertyOrDefault(
  CLIENTES_SHEET_NAME_PROPERTY,
  DEFAULT_CONFIGURATION.CLIENTES_SHEET_NAME
);
const REMITOS_SHEET_ID = getPropertyOrDefault(REMITOS_SHEET_ID_PROPERTY, DEFAULT_REMITOS_CONFIGURATION.SHEET_ID);
const REMITOS_SHEET_NAME = getPropertyOrDefault(
  REMITOS_SHEET_NAME_PROPERTY,
  DEFAULT_REMITOS_CONFIGURATION.SHEET_NAME
);
const REMITOS_SPREADSHEET_NAME = getPropertyOrDefault(
  REMITOS_SPREADSHEET_NAME_PROPERTY,
  DEFAULT_REMITOS_CONFIGURATION.SPREADSHEET_NAME
);

const CLIENTES_HEADERS = Object.freeze(['Nombre', 'Direccion', 'Telefono', 'Mail', 'CUIT']);
const REMITOS_HEADERS = Object.freeze([
  'Timestamp',
  'NumeroRemito',
  'NumeroReporte',
  'ReporteID',
  'FechaRemito',
  'FechaRemitoISO',
  'FechaServicio',
  'FechaServicioISO',
  'Cliente',
  'Direccion',
  'Telefono',
  'Email',
  'CUIT',
  'EquipoDescripcion',
  'EquipoModelo',
  'EquipoSerie',
  'EquipoInterno',
  'EquipoUbicacion',
  'Tecnico',
  'Observaciones',
  'Repuestos',
  'RepuestosJSON',
  'ReporteJSON',
  'Foto1URL',
  'Foto2URL',
  'Foto3URL',
  'Foto4URL',
  'GeneradoPor'
]);

const REMITOS_FOTOS_FOLDER_ID = '1SH7Zz7g_2sbYsFHMfVQj3Admdy8L3FVz';
const MAX_REMITO_FOTOS = 4;

const CAMPOS_ACTUALIZABLES = [
  'Cliente', 'Fecha_Servicio', 'Direccion', 'Tecnico_Asignado', 'Modelo_Equipo',
  'ID_Interna_Activo', 'Numero_Serie', 'Proximo_Mantenimiento', 'Fugas_Visibles_Found',
  'Fugas_Visibles_Left', 'Conductividad_Red_Found', 'Conductividad_Red_Left',
  'Conductividad_Permeado_Found', 'Conductividad_Permeado_Left', 'Rechazo_Ionico_Found',
  'Rechazo_Ionico_Left', 'Presion_Entrada_Found', 'Presion_Entrada_Left',
  'Caudal_Permeado_Found', 'Caudal_Permeado_Left', 'Caudal_Rechazo_Found',
  'Caudal_Rechazo_Left', 'Relacion_Rechazo_Permeado_Found', 'Relacion_Rechazo_Permeado_Left',
  'Precarga_Tanque_Found', 'Precarga_Tanque_Left', 'Test_Presostato_Alta_Found',
  'Test_Presostato_Alta_Left', 'Test_Presostato_Baja_Found', 'Test_Presostato_Baja_Left',
  'Etapa1_Detalles', 'Etapa1_Accion', 'Etapa2_Detalles', 'Etapa2_Accion',
  'Etapa3_Detalles', 'Etapa3_Accion', 'Etapa4_Detalles', 'Etapa4_Accion',
  'Etapa5_Detalles', 'Etapa5_Accion', 'Etapa6_Detalles', 'Etapa6_Accion',
  'Sanitizacion_Sistema', 'Resumen_Recomendaciones'
];

const AuthService = {
  getAuthorizedUsers() {
    const raw = getAuthorizedUsersProperty();
    if (!raw) {
      throw new Error('Configura la propiedad AUTHORIZED_USERS con los tokens permitidos.');
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw new Error('La propiedad AUTHORIZED_USERS debe contener un JSON válido.');
    }

    let entries = [];

    if (Array.isArray(parsed)) {
      entries = parsed.map((item) => ({
        token: item && typeof item.token === 'string' ? item.token.trim() : '',
        usuario: item && typeof item.usuario === 'string' ? item.usuario.trim() : '',
      }));
    } else if (parsed && typeof parsed === 'object') {
      entries = Object.keys(parsed).map((tokenKey) => ({
        token: tokenKey.trim(),
        usuario: typeof parsed[tokenKey] === 'string'
          ? String(parsed[tokenKey]).trim()
          : '',
      }));
    } else {
      throw new Error('El formato de AUTHORIZED_USERS debe ser un arreglo o un objeto JSON.');
    }

    const sanitized = entries.filter((entry) => entry.token);
    if (!sanitized.length) {
      throw new Error('No hay usuarios autorizados configurados en AUTHORIZED_USERS.');
    }

    return sanitized;
  },

  authenticate(data) {
    const token = data && typeof data.token === 'string' ? data.token.trim() : '';
    if (!token) {
      throw new Error('Token de autenticación requerido.');
    }

    const usuarioEntrada = data && typeof data.usuario === 'string' ? data.usuario.trim() : '';
    const usuarios = this.getAuthorizedUsers();
    const match = usuarios.find((entry) => entry.token === token);

    if (!match) {
      throw new Error('Token no autorizado.');
    }

    const usuarioConfigurado = match.usuario;
    if (usuarioConfigurado && usuarioEntrada && usuarioConfigurado !== usuarioEntrada) {
      throw new Error('El usuario no coincide con el token proporcionado.');
    }

    const resolvedUsuario = usuarioConfigurado || usuarioEntrada;

    if (!resolvedUsuario) {
      throw new Error('Debe indicar el nombre de usuario asociado al token.');
    }

    return resolvedUsuario;
  }
};

const SheetRepository = {
  getSpreadsheet() {
    if (!SHEET_ID) {
      throw new Error('Configura la propiedad de script SHEET_ID antes de ejecutar la API.');
    }

    return SpreadsheetApp.openById(SHEET_ID);
  },

  getSheetByName(sheetName) {
    if (!sheetName) {
      throw new Error('Proporciona el nombre de la hoja que deseas utilizar.');
    }

    const sheet = this.getSpreadsheet().getSheetByName(sheetName);

    if (!sheet) {
      throw new Error(`No se encontró la hoja ${sheetName} en el documento configurado.`);
    }

    return sheet;
  },

  getSheet() {
    if (!SHEET_NAME) {
      throw new Error(
        'Configura la propiedad de script SHEET_NAME con la pestaña que almacena los mantenimientos.'
      );
    }

    return this.getSheetByName(SHEET_NAME);
  },

  getSheetData() {
    const sheet = this.getSheet();
    return {
      sheet,
      data: sheet.getDataRange().getValues()
    };
  }
};

const RemitosRepository = {
  getSpreadsheet() {
    if (REMITOS_SHEET_ID) {
      return SpreadsheetApp.openById(REMITOS_SHEET_ID);
    }

    if (!REMITOS_SPREADSHEET_NAME) {
      throw new Error('Configura la propiedad REMITOS_SPREADSHEET_NAME con la planilla que almacena los remitos.');
    }

    const files = DriveApp.getFilesByName(REMITOS_SPREADSHEET_NAME);
    if (!files.hasNext()) {
      throw new Error(`No se encontró la hoja de cálculo ${REMITOS_SPREADSHEET_NAME} para registrar los remitos.`);
    }

    const file = files.next();
    return SpreadsheetApp.openById(file.getId());
  },

  getSheet() {
    const spreadsheet = this.getSpreadsheet();
    const sheetName = REMITOS_SHEET_NAME || DEFAULT_REMITOS_CONFIGURATION.SHEET_NAME;
    let sheet = spreadsheet.getSheetByName(sheetName);

    if (!sheet) {
      sheet = spreadsheet.insertSheet(sheetName);
    }

    this.ensureHeaders(sheet);
    return sheet;
  },

  ensureHeaders(sheet) {
    const headerLength = REMITOS_HEADERS.length;
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, headerLength).setValues([REMITOS_HEADERS]);
      return;
    }

    const headerRange = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), headerLength));
    const headerValues = headerRange.getValues()[0].map((value) => normalizeTextValue(value));

    for (let i = 0; i < headerLength; i += 1) {
      if (headerValues[i] !== REMITOS_HEADERS[i]) {
        sheet.getRange(1, 1, 1, headerLength).setValues([REMITOS_HEADERS]);
        break;
      }
    }
  }
};

const ResponseFactory = {
  success(data) {
    return ContentService
      .createTextOutput(JSON.stringify({ result: 'success', data }))
      .setMimeType(ContentService.MimeType.JSON);
  },
  error(error) {
    return ContentService
      .createTextOutput(JSON.stringify({ result: 'error', error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
};

const CLIENTES_FIELD_MAP = Object.freeze({
  Nombre: 'nombre',
  Direccion: 'direccion',
  Telefono: 'telefono',
  Mail: 'mail',
  CUIT: 'cuit'
});

function sanitizeCellValue(value) {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'number') {
    return String(value);
  }

  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }

  return String(value).trim();
}

function normalizeClienteRow(row, headerIndexes) {
  const cliente = {};
  let hasData = false;

  CLIENTES_HEADERS.forEach((header) => {
    const index = headerIndexes[header];
    if (index === undefined || index === null) {
      return;
    }

    const fieldKey = CLIENTES_FIELD_MAP[header];
    const value = sanitizeCellValue(row[index]);

    cliente[fieldKey] = value;

    if (!hasData && value) {
      hasData = true;
    }
  });

  if (!hasData) {
    return null;
  }

  return cliente;
}

const ClientesService = {
  getSheet() {
    if (!CLIENTES_SHEET_NAME) {
      throw new Error(
        'Configura la propiedad de script CLIENTES_SHEET_NAME con la pestaña que almacena los clientes.'
      );
    }

    return SheetRepository.getSheetByName(CLIENTES_SHEET_NAME);
  },

  getHeaderIndexes(headersRow) {
    const indexes = {};

    CLIENTES_HEADERS.forEach((header) => {
      const index = headersRow.indexOf(header);
      if (index === -1) {
        throw new Error(
          `No se encontró el encabezado ${header} en la hoja configurada para clientes.`
        );
      }

      indexes[header] = index;
    });

    return indexes;
  },

  listar() {
    const sheet = this.getSheet();
    const values = sheet.getDataRange().getValues();

    if (!values.length) {
      return [];
    }

    const headersRow = values[0].map((value) => sanitizeCellValue(value));
    const headerIndexes = this.getHeaderIndexes(headersRow);

    const clientes = [];

    for (let i = 1; i < values.length; i += 1) {
      const row = values[i];
      const cliente = normalizeClienteRow(row, headerIndexes);

      if (cliente) {
        clientes.push(cliente);
      }
    }

    clientes.sort((a, b) => {
      const nombreA = (a.nombre || '').toLowerCase();
      const nombreB = (b.nombre || '').toLowerCase();

      if (nombreA < nombreB) {
        return -1;
      }
      if (nombreA > nombreB) {
        return 1;
      }

      const cuitA = (a.cuit || '').toLowerCase();
      const cuitB = (b.cuit || '').toLowerCase();

      if (cuitA < cuitB) {
        return -1;
      }
      if (cuitA > cuitB) {
        return 1;
      }

      return 0;
    });

    return clientes;
  }
};

function normalizeDateToISO(value) {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  let dateObject = null;

  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    dateObject = value;
  } else if (typeof value === 'number') {
    const candidate = new Date(value);
    if (!isNaN(candidate.getTime())) {
      dateObject = candidate;
    }
  } else if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return '';
    }

    let match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
    if (match) {
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10);
      const day = parseInt(match[3], 10);
      const candidate = new Date(year, month - 1, day);
      if (!isNaN(candidate.getTime())) {
        dateObject = candidate;
      }
    }

    if (!dateObject) {
      match = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
      if (match) {
        const year = parseInt(match[1], 10);
        const month = parseInt(match[2], 10);
        const day = parseInt(match[3], 10);
        const candidate = new Date(year, month - 1, day);
        if (!isNaN(candidate.getTime())) {
          dateObject = candidate;
        }
      }
    }

    if (!dateObject) {
      match = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
      if (match) {
        const day = parseInt(match[1], 10);
        const month = parseInt(match[2], 10);
        const year = parseInt(match[3], 10);
        const candidate = new Date(year, month - 1, day);
        if (!isNaN(candidate.getTime())) {
          dateObject = candidate;
        }
      }
    }

    if (!dateObject) {
      const parsed = new Date(trimmed);
      if (!isNaN(parsed.getTime())) {
        dateObject = parsed;
      }
    }
  }

  if (!dateObject) {
    return '';
  }

  return Utilities.formatDate(dateObject, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function normalizeTextValue(value) {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '';
  }

  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, SCRIPT_TIMEZONE, 'yyyy-MM-dd');
  }

  return String(value).trim();
}

function pickFirstValue(source, keys, fallback = '') {
  if (!source || typeof source !== 'object') {
    return fallback;
  }

  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    if (!Object.prototype.hasOwnProperty.call(source, key)) {
      continue;
    }

    const value = normalizeTextValue(source[key]);
    if (value) {
      return value;
    }
  }

  return fallback;
}

function formatIsoDateForDisplay(isoString) {
  const iso = normalizeDateToISO(isoString);
  if (!iso) {
    return '';
  }

  const date = new Date(`${iso}T00:00:00`);
  if (isNaN(date.getTime())) {
    return iso;
  }

  return Utilities.formatDate(date, SCRIPT_TIMEZONE, 'dd/MM/yyyy');
}

function parseRemitoNumericSuffix(value) {
  const text = normalizeTextValue(value);
  if (!text) {
    return NaN;
  }

  const match = text.match(/(\d+)\s*$/);
  if (!match) {
    return NaN;
  }

  const parsed = parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : NaN;
}

const MantenimientoService = {
  guardar(data, usuario) {
    const sheet = SheetRepository.getSheet();
    const timestamp = new Date();
    const idUnico = Utilities.getUuid();
    const editor = typeof usuario === 'string' ? usuario : '';

    const rowData = [
      data.cliente,
      data.fecha,
      data.direccion,
      data.tecnico,
      data.modelo,
      data.id_interna,
      data.n_serie,
      data.proximo_mant,
      data.fugas_found,
      data.fugas_left,
      data.cond_red_found || 0,
      data.cond_red_left || 0,
      data.cond_perm_found || 0,
      data.cond_perm_left || 0,
      data.rechazo_found || '',
      data.rechazo_left || '',
      data.presion_found || 0,
      data.presion_left || 0,
      data.caudal_perm_found || 0,
      data.caudal_perm_left || 0,
      data.caudal_rech_found || 0,
      data.caudal_rech_left || 0,
      data.relacion_found || '',
      data.relacion_left || '',
      data.precarga_found || 0,
      data.precarga_left || 0,
      data.presostato_alta_found,
      data.presostato_alta_left,
      data.presostato_baja_found,
      data.presostato_baja_left,
      data.etapa1_detalles,
      data.etapa1_accion,
      data.etapa2_detalles,
      data.etapa2_accion,
      data.etapa3_detalles,
      data.etapa3_accion,
      data.etapa4_detalles,
      data.etapa4_accion,
      data.etapa5_detalles,
      data.etapa5_accion,
      data.etapa6_detalles,
      data.etapa6_accion,
      data.sanitizacion,
      data.resumen,
      data.numero_reporte,
      editor,
      timestamp,
      idUnico
    ];

    sheet.appendRow(rowData);
    return {
      id: idUnico,
      mensaje: 'Mantenimiento guardado correctamente',
      actualizado_por: editor,
      timestamp,
    };
  },

  buscar(filtros) {
    const { data } = SheetRepository.getSheetData();
    const headers = data[0];
    const resultados = [];

    const clienteFiltro = filtros.cliente ? filtros.cliente.toLowerCase() : '';
    const tecnicoFiltro = filtros.tecnico ? filtros.tecnico.toLowerCase() : '';
    const fechaFiltro = filtros.fecha || '';
    const fechaFiltroISO = normalizeDateToISO(fechaFiltro);

    for (let i = 1; i < data.length; i += 1) {
      const row = data[i];
      const mantenimiento = {};
      let coincide = true;

      for (let j = 0; j < headers.length; j += 1) {
        const header = headers[j];
        mantenimiento[header] = row[j];
      }

      const fechaServicioISO = normalizeDateToISO(mantenimiento.Fecha_Servicio);
      if (fechaServicioISO) {
        mantenimiento.Fecha_Servicio = fechaServicioISO;
      }

      if (clienteFiltro) {
        const cliente = mantenimiento.Cliente ? mantenimiento.Cliente.toLowerCase() : '';
        if (!cliente.includes(clienteFiltro)) {
          coincide = false;
        }
      }

      if (coincide && tecnicoFiltro) {
        const tecnico = mantenimiento.Tecnico_Asignado
          ? mantenimiento.Tecnico_Asignado.toLowerCase()
          : '';
        if (!tecnico.includes(tecnicoFiltro)) {
          coincide = false;
        }
      }

      if (coincide && fechaFiltroISO) {
        if (!fechaServicioISO || fechaServicioISO !== fechaFiltroISO) {
          coincide = false;
        }
      }

      if (coincide) {
        const proximoMantenimientoISO = normalizeDateToISO(mantenimiento.Proximo_Mantenimiento);
        if (proximoMantenimientoISO) {
          mantenimiento.Proximo_Mantenimiento = proximoMantenimientoISO;
        }
        resultados.push(mantenimiento);
      }
    }

    return resultados;
  },

  actualizar(data, usuario) {
    const { sheet, data: allData } = SheetRepository.getSheetData();
    const headers = allData[0];

    const idIndex = headers.indexOf('ID_Unico');
    if (idIndex === -1) {
      throw new Error('Encabezado ID_Unico no encontrado');
    }

    let rowIndex = -1;
    for (let i = 1; i < allData.length; i += 1) {
      if (allData[i][idIndex] === data.id) {
        rowIndex = i + 1;
        break;
      }
    }

    if (rowIndex === -1) {
      throw new Error('Mantenimiento no encontrado');
    }

    CAMPOS_ACTUALIZABLES.forEach((campo) => {
      const colIndex = headers.indexOf(campo);
      if (colIndex === -1) {
        return;
      }

      const dataKey = campo.toLowerCase();
      if (Object.prototype.hasOwnProperty.call(data, dataKey) && data[dataKey] !== undefined) {
        sheet.getRange(rowIndex, colIndex + 1).setValue(data[dataKey]);
      }
    });

    const updateTimestamp = new Date();
    const timestampIndex = headers.indexOf('Timestamp');
    if (timestampIndex !== -1) {
      sheet.getRange(rowIndex, timestampIndex + 1).setValue(updateTimestamp);
    }

    const updatedByIndex = headers.indexOf('Actualizado_por');
    if (updatedByIndex !== -1) {
      sheet.getRange(rowIndex, updatedByIndex + 1).setValue(typeof usuario === 'string' ? usuario : '');
    }

    return {
      mensaje: 'Mantenimiento actualizado correctamente',
      actualizado_por: typeof usuario === 'string' ? usuario : '',
      timestamp: updateTimestamp,
    };
  },

  eliminar(data) {
    const { sheet, data: allData } = SheetRepository.getSheetData();
    const headers = allData[0];

    const idIndex = headers.indexOf('ID_Unico');
    if (idIndex === -1) {
      throw new Error('Encabezado ID_Unico no encontrado');
    }

    for (let i = 1; i < allData.length; i += 1) {
      if (allData[i][idIndex] === data.id) {
        sheet.deleteRow(i + 1);
        return { mensaje: 'Mantenimiento eliminado correctamente' };
      }
    }

    throw new Error('Mantenimiento no encontrado');
  }
};

const RemitosService = {
  fotosFolderCache: null,

  getFotosFolder() {
    if (!REMITOS_FOTOS_FOLDER_ID) {
      throw new Error('Configura la propiedad REMITOS_FOTOS_FOLDER_ID con el ID de la carpeta de Drive para las fotos.');
    }

    if (this.fotosFolderCache) {
      return this.fotosFolderCache;
    }

    try {
      this.fotosFolderCache = DriveApp.getFolderById(REMITOS_FOTOS_FOLDER_ID);
    } catch (error) {
      throw new Error('No se pudo acceder a la carpeta configurada para almacenar las fotos de los remitos.');
    }

    return this.fotosFolderCache;
  },

  guessExtension(mimeType) {
    const normalized = normalizeTextValue(mimeType).toLowerCase();
    if (normalized === 'image/jpeg' || normalized === 'image/jpg') {
      return 'jpg';
    }
    if (normalized === 'image/png') {
      return 'png';
    }
    if (normalized === 'image/webp') {
      return 'webp';
    }
    if (normalized === 'image/heic') {
      return 'heic';
    }
    if (normalized === 'image/heif') {
      return 'heif';
    }

    return 'jpg';
  },

  sanitizeFileName(fileName, numeroRemito, index, mimeType) {
    const baseNumero = normalizeTextValue(numeroRemito) || 'remito';
    const fallbackBase = baseNumero.replace(/[^A-Za-z0-9_-]+/g, '-');
    const rawName = normalizeTextValue(fileName);
    const baseName = (rawName || `${fallbackBase}-foto-${index + 1}`)
      .replace(/[/\\]/g, '-');

    const extension = this.guessExtension(mimeType);
    const normalized = baseName.replace(/[^A-Za-z0-9._-]+/g, '_');
    if (normalized.toLowerCase().endsWith(`.${extension}`)) {
      return normalized;
    }

    const withoutExistingExtension = normalized.replace(/\.[^.]+$/, '');
    return `${withoutExistingExtension}.${extension}`;
  },

  extractBase64Data(value) {
    const text = normalizeTextValue(value);
    if (!text) {
      return '';
    }

    const commaIndex = text.indexOf(',');
    if (commaIndex !== -1) {
      return text.slice(commaIndex + 1);
    }

    return text;
  },

  procesarFotos(fotos, numeroRemito) {
    const resultados = new Array(MAX_REMITO_FOTOS).fill('');

    if (!Array.isArray(fotos) || fotos.length === 0) {
      return resultados;
    }

    let folder = null;

    for (let i = 0; i < Math.min(fotos.length, MAX_REMITO_FOTOS); i += 1) {
      const foto = fotos[i];
      if (!foto || typeof foto !== 'object') {
        continue;
      }

      if (foto.shouldRemove) {
        resultados[i] = '';
        continue;
      }

      const base64Data = this.extractBase64Data(foto.base64Data || foto.data || foto.contenido);
      const existingUrl = normalizeTextValue(foto.url);

      if (!base64Data) {
        resultados[i] = existingUrl;
        continue;
      }

      if (!folder) {
        folder = this.getFotosFolder();
      }

      const mimeType = normalizeTextValue(foto.mimeType) || 'image/jpeg';
      const fileName = this.sanitizeFileName(foto.fileName, numeroRemito, i, mimeType);

      let blob;
      try {
        blob = Utilities.newBlob(Utilities.base64Decode(base64Data), mimeType, fileName);
      } catch (error) {
        throw new Error(`No se pudo procesar la foto ${i + 1}: ${error.message}`);
      }

      try {
        const file = folder.createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        resultados[i] = file.getUrl();
      } catch (error) {
        throw new Error(`No se pudo guardar la foto ${i + 1} en Drive: ${error.message}`);
      }
    }

    return resultados;
  },

  extractRepuestos(report) {
    if (!report || typeof report !== 'object') {
      return [];
    }

    if (Array.isArray(report.repuestos)) {
      return report.repuestos;
    }

    if (!Array.isArray(report.componentes)) {
      return [];
    }

    return report.componentes.filter((item) => {
      if (!item || typeof item !== 'object') {
        return false;
      }

      const accion = normalizeTextValue(item.accion || item.estado || item.action).toLowerCase();
      if (accion.includes('cambi') || accion.includes('instal')) {
        return true;
      }

      const cantidadNumero = Number(item.cantidad);
      if (Number.isFinite(cantidadNumero) && cantidadNumero > 0) {
        return true;
      }

      const cantidadTexto = normalizeTextValue(item.cantidad);
      return Boolean(cantidadTexto);
    });
  },

  formatRepuestoItem(item) {
    if (!item || typeof item !== 'object') {
      return '';
    }

    const codigo = pickFirstValue(item, ['codigo', 'Codigo', 'id', 'ID', 'codigo_interno', 'codigoRepuesto']);
    const descripcion = pickFirstValue(item, ['descripcion', 'Descripcion', 'detalle', 'detalles', 'title', 'nombre', 'descripcion_repuesto']);
    const cantidadBruta = pickFirstValue(item, ['cantidad', 'Cantidad', 'qty', 'CantidadUtilizada']);

    let cantidad = '';
    if (cantidadBruta) {
      let fuenteCantidad = cantidadBruta;
      if (typeof fuenteCantidad === 'string') {
        fuenteCantidad = fuenteCantidad.replace(',', '.');
      }

      const numero = Number(fuenteCantidad);
      if (Number.isFinite(numero) && numero > 0) {
        cantidad = String(numero);
      } else {
        cantidad = cantidadBruta;
      }
    }

    const partes = [];
    if (codigo) {
      partes.push(codigo);
    }
    if (descripcion) {
      partes.push(descripcion);
    }

    let texto = partes.join(' - ');
    if (cantidad) {
      texto = texto ? `${texto} x${cantidad}` : `x${cantidad}`;
    }

    return texto.trim();
  },

  resolveNumeroRemito(sheet, report) {
    const existente = pickFirstValue(report, ['NumeroRemito', 'numero_remito', 'remitoNumero']);
    if (existente) {
      return existente;
    }

    const totalColumnas = Math.max(sheet.getLastColumn(), REMITOS_HEADERS.length, 1);
    const headers = sheet.getRange(1, 1, 1, totalColumnas).getValues()[0];
    const indice = headers.indexOf('NumeroRemito');

    let siguiente = 1;
    if (indice !== -1) {
      const totalFilas = sheet.getLastRow();
      if (totalFilas > 1) {
        const valores = sheet.getRange(2, indice + 1, totalFilas - 1, 1).getValues();
        for (let i = 0; i < valores.length; i += 1) {
          const numero = parseRemitoNumericSuffix(valores[i][0]);
          if (Number.isFinite(numero) && numero >= siguiente) {
            siguiente = numero + 1;
          }
        }
      }
    }

    return `REM-${String(siguiente).padStart(4, '0')}`;
  },

  buildRemitoRecord(report, observaciones, numeroRemito, usuario) {
    const ahora = new Date();
    let fechaRemitoCruda = ahora;
    if (report && typeof report === 'object') {
      const candidata = report.fecha_display || report.fecha || report.Fecha_Servicio;
      if (candidata) {
        fechaRemitoCruda = candidata;
      }
    }

    const fechaRemitoISO = normalizeDateToISO(fechaRemitoCruda) || normalizeDateToISO(ahora);

    let fechaRemitoDisplay = '';
    if (typeof fechaRemitoCruda === 'string' && fechaRemitoCruda.trim()) {
      fechaRemitoDisplay = fechaRemitoCruda.trim();
    } else {
      fechaRemitoDisplay = formatIsoDateForDisplay(fechaRemitoISO) || Utilities.formatDate(ahora, SCRIPT_TIMEZONE, 'dd/MM/yyyy');
    }

    let fechaServicioCruda = undefined;
    if (report && typeof report === 'object') {
      fechaServicioCruda = report.Fecha_Servicio || report.fecha_servicio || report.fecha;
    }
    const fechaServicioISO = normalizeDateToISO(fechaServicioCruda);
    const fechaServicioDisplay =
      typeof fechaServicioCruda === 'string' && fechaServicioCruda.trim()
        ? fechaServicioCruda.trim()
        : formatIsoDateForDisplay(fechaServicioISO);

    const repuestos = this.extractRepuestos(report);
    const repuestosTexto = repuestos
      .map((item) => this.formatRepuestoItem(item))
      .filter(Boolean)
      .join('\n');

    let repuestosJSON = '';
    if (repuestos.length) {
      try {
        repuestosJSON = JSON.stringify(repuestos);
      } catch (error) {
        repuestosJSON = '';
      }
    }

    let reporteJSON = '';
    try {
      reporteJSON = JSON.stringify(report);
    } catch (error) {
      reporteJSON = '';
    }

    const observacionesLimpias = normalizeTextValue(observaciones) || pickFirstValue(report, ['observaciones', 'Resumen_Recomendaciones', 'resumen']);

    return {
      Timestamp: ahora,
      NumeroRemito: numeroRemito,
      NumeroReporte: pickFirstValue(report, ['NumeroReporte', 'numero_reporte', 'numeroReporte']),
      ReporteID: pickFirstValue(report, ['ID_Unico', 'id_unico', 'id', 'Id', 'ID', 'reporteId']),
      FechaRemito: fechaRemitoDisplay || formatIsoDateForDisplay(fechaRemitoISO),
      FechaRemitoISO: fechaRemitoISO,
      FechaServicio: fechaServicioDisplay,
      FechaServicioISO: fechaServicioISO,
      Cliente: pickFirstValue(report, ['clienteNombre', 'Cliente', 'cliente', 'cliente_nombre']),
      Direccion: pickFirstValue(report, ['direccion', 'Direccion', 'cliente_direccion', 'ubicacion']),
      Telefono: pickFirstValue(report, ['cliente_telefono', 'telefono_cliente', 'telefono']),
      Email: pickFirstValue(report, ['cliente_email', 'email']),
      CUIT: pickFirstValue(report, ['cliente_cuit', 'cuit']),
      EquipoDescripcion: pickFirstValue(report, ['equipo', 'equipo_descripcion', 'descripcion_equipo']),
      EquipoModelo: pickFirstValue(report, ['modelo', 'modelo_equipo', 'Modelo_Equipo']),
      EquipoSerie: pickFirstValue(report, ['n_serie', 'numero_serie', 'Numero_Serie']),
      EquipoInterno: pickFirstValue(report, ['id_interna', 'codigo_interno', 'ID_Interna_Activo']),
      EquipoUbicacion: pickFirstValue(report, ['ubicacion', 'direccion', 'cliente_direccion']),
      Tecnico: pickFirstValue(report, ['tecnico', 'tecnico_asignado', 'Tecnico_Asignado']),
      Observaciones: observacionesLimpias,
      Repuestos: repuestosTexto,
      RepuestosJSON: repuestosJSON,
      ReporteJSON: reporteJSON,
      Foto1URL: '',
      Foto2URL: '',
      Foto3URL: '',
      Foto4URL: '',
      GeneradoPor: normalizeTextValue(usuario)
    };
  },

  obtenerRemitos(page = 1, pageSize = 20) {
    let normalizedPageSize = Number(pageSize);
    if (!Number.isFinite(normalizedPageSize) || normalizedPageSize <= 0) {
      normalizedPageSize = 20;
    }
    normalizedPageSize = Math.min(Math.max(Math.floor(normalizedPageSize), 1), 200);

    const sheet = RemitosRepository.getSheet();
    const lastRow = sheet.getLastRow();

    if (lastRow <= 1) {
      return {
        remitos: [],
        totalPages: 0,
        currentPage: 0,
        totalItems: 0,
        pageSize: normalizedPageSize,
      };
    }

    const lastColumn = Math.max(sheet.getLastColumn(), REMITOS_HEADERS.length, 1);
    const values = sheet.getRange(1, 1, lastRow, lastColumn).getValues();
    const totalItems = Math.max(values.length - 1, 0);
    const totalPages = Math.max(1, Math.ceil(totalItems / normalizedPageSize));

    let normalizedPage = Number(page);
    if (!Number.isFinite(normalizedPage) || normalizedPage <= 0) {
      normalizedPage = 1;
    } else {
      normalizedPage = Math.floor(normalizedPage);
    }

    if (normalizedPage > totalPages) {
      normalizedPage = totalPages;
    }

    const startRowIndex = (normalizedPage - 1) * normalizedPageSize + 1;
    const endRowIndex = Math.min(startRowIndex + normalizedPageSize, values.length);

    const remitos = [];

    for (let rowIndex = startRowIndex; rowIndex < endRowIndex; rowIndex += 1) {
      const row = values[rowIndex];
      const registro = {};

      for (let columnIndex = 0; columnIndex < REMITOS_HEADERS.length; columnIndex += 1) {
        const header = REMITOS_HEADERS[columnIndex];
        registro[header] = row[columnIndex];
      }

      const fechaRemitoISO = normalizeDateToISO(registro.FechaRemitoISO) || normalizeDateToISO(registro.FechaRemito);
      const fechaServicioISO = normalizeDateToISO(registro.FechaServicioISO) || normalizeDateToISO(registro.FechaServicio);

      const fotoUrls = [];
      for (let fotoIndex = 1; fotoIndex <= MAX_REMITO_FOTOS; fotoIndex += 1) {
        const key = `Foto${fotoIndex}URL`;
        fotoUrls.push(sanitizeCellValue(registro[key]));
      }

      remitos.push({
        numeroRemito: sanitizeCellValue(registro.NumeroRemito),
        numeroReporte: sanitizeCellValue(registro.NumeroReporte),
        reporteId: sanitizeCellValue(registro.ReporteID),
        cliente: sanitizeCellValue(registro.Cliente),
        fechaRemito: sanitizeCellValue(registro.FechaRemito) || formatIsoDateForDisplay(fechaRemitoISO),
        fechaRemitoISO,
        fechaServicio: sanitizeCellValue(registro.FechaServicio) || formatIsoDateForDisplay(fechaServicioISO),
        fechaServicioISO,
        tecnico: sanitizeCellValue(registro.Tecnico),
        observaciones: sanitizeCellValue(registro.Observaciones),
        direccion: sanitizeCellValue(registro.Direccion),
        telefono: sanitizeCellValue(registro.Telefono),
        email: sanitizeCellValue(registro.Email),
        Foto1URL: fotoUrls[0] || '',
        Foto2URL: fotoUrls[1] || '',
        Foto3URL: fotoUrls[2] || '',
        Foto4URL: fotoUrls[3] || '',
        fotos: fotoUrls,
      });
    }

    return {
      remitos,
      totalPages,
      currentPage: normalizedPage,
      totalItems,
      pageSize: normalizedPageSize,
    };
  },

  guardar(data, usuario) {
    if (!data || typeof data !== 'object') {
      throw new Error('Datos inválidos para generar el remito.');
    }

    const reporteData = data.reporteData;
    if (!reporteData || typeof reporteData !== 'object') {
      throw new Error('No se recibió la información del mantenimiento para generar el remito.');
    }

    const sheet = RemitosRepository.getSheet();
    const numeroRemito = this.resolveNumeroRemito(sheet, reporteData);
    const registro = this.buildRemitoRecord(reporteData, data.observaciones, numeroRemito, usuario);

    const fotoUrls = this.procesarFotos(data.fotos, numeroRemito);
    for (let i = 0; i < MAX_REMITO_FOTOS; i += 1) {
      registro[`Foto${i + 1}URL`] = fotoUrls[i] || '';
    }

    const fila = REMITOS_HEADERS.map((header) => (Object.prototype.hasOwnProperty.call(registro, header) ? registro[header] : ''));

    sheet.appendRow(fila);

    return {
      NumeroRemito: numeroRemito,
      Foto1URL: registro.Foto1URL,
      Foto2URL: registro.Foto2URL,
      Foto3URL: registro.Foto3URL,
      Foto4URL: registro.Foto4URL
    };
  }
};

const DashboardService = {
  obtenerDatos() {
    const { data } = SheetRepository.getSheetData();
    const headers = data[0];

    const ahora = new Date();
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    const unMesDespues = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 1);

    const total = data.length - 1;
    let esteMes = 0;
    let proximos = 0;
    const tecnicos = new Set();
    const mensual = new Array(12).fill(0);
    const tecnicosData = {};
    const proximosMantenimientos = [];

    for (let i = 1; i < data.length; i += 1) {
      const row = data[i];
      const mantenimiento = {};

      for (let j = 0; j < headers.length; j += 1) {
        const header = headers[j];
        mantenimiento[header] = row[j];
      }

      if (mantenimiento.Fecha_Servicio) {
        const fechaServicio = new Date(mantenimiento.Fecha_Servicio);
        if (fechaServicio >= inicioMes && fechaServicio < unMesDespues) {
          esteMes += 1;
        }

        if (fechaServicio.getFullYear() === ahora.getFullYear()) {
          mensual[fechaServicio.getMonth()] += 1;
        }
      }

      if (mantenimiento.Proximo_Mantenimiento) {
        const proximoMant = new Date(mantenimiento.Proximo_Mantenimiento);
        const diffTime = proximoMant.getTime() - ahora.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays > 0 && diffDays <= 30) {
          proximos += 1;
          proximosMantenimientos.push({
            cliente: mantenimiento.Cliente,
            fecha: mantenimiento.Proximo_Mantenimiento,
            tecnico: mantenimiento.Tecnico_Asignado,
            dias_restantes: diffDays
          });
        }
      }

      if (mantenimiento.Tecnico_Asignado) {
        tecnicos.add(mantenimiento.Tecnico_Asignado);
        if (!tecnicosData[mantenimiento.Tecnico_Asignado]) {
          tecnicosData[mantenimiento.Tecnico_Asignado] = 0;
        }
        tecnicosData[mantenimiento.Tecnico_Asignado] += 1;
      }
    }

    proximosMantenimientos.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

    const tecnicosArray = Object.keys(tecnicosData).map((tecnico) => ({
      tecnico,
      count: tecnicosData[tecnico]
    }));

    return {
      total,
      esteMes,
      proximos,
      tecnicos: tecnicos.size,
      mensual,
      tecnicosData: tecnicosArray,
      proximosMantenimientos: proximosMantenimientos.slice(0, 10)
    };
  }
};

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const { action } = data;

    if (action === 'login') {
      const usuarioLogin = AuthService.authenticate(data);
      return ResponseFactory.success({ usuario: usuarioLogin });
    }

    const usuario = AuthService.authenticate(data);

    let result;
    switch (action) {
      case 'guardar':
        result = MantenimientoService.guardar(data, usuario);
        break;
      case 'buscar':
        result = MantenimientoService.buscar(data);
        break;
      case 'actualizar':
        result = MantenimientoService.actualizar(data, usuario);
        break;
      case 'eliminar':
        result = MantenimientoService.eliminar(data);
        break;
      case 'crear_remito':
        result = RemitosService.guardar(data, usuario);
        break;
      case 'dashboard':
        result = DashboardService.obtenerDatos();
        break;
      case 'clientes':
        result = ClientesService.listar();
        break;
      case 'obtener_remitos':
        result = RemitosService.obtenerRemitos(data.page, data.pageSize);
        break;
      case 'version': {
        return _json({
          ok: true,
          version: MOD_CODE_VERSION
        });
      }
      default:
        throw new Error('Acción no válida');
    }

    return ResponseFactory.success(result);
  } catch (error) {
    return ResponseFactory.error(error);
  }
}

function doGet(e) {
  const params = e && e.parameter ? e.parameter : {};
  const action = params.action;

  try {
    if (action === 'dashboard') {
      AuthService.authenticate({
        token: params.token,
        usuario: params.usuario,
      });
      const dashboard = DashboardService.obtenerDatos();
      return ResponseFactory.success(dashboard);
    }

    if (action === 'clientes') {
      AuthService.authenticate({
        token: params.token,
        usuario: params.usuario,
      });
      const clientes = ClientesService.listar();
      return ResponseFactory.success(clientes);
    }

    return ResponseFactory.success({ message: 'API funcionando' });
  } catch (error) {
    return ResponseFactory.error(error);
  }
}
