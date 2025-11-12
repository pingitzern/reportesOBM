function doPost(e) {
  const ns = this.OBM = this.OBM || {};
  if (typeof ns.handlePost !== 'function') {
    throw new Error('OBM.handlePost is not defined');
  }
  return ns.handlePost(e);
}

function doGet(e) {
  const ns = this.OBM = this.OBM || {};
  if (typeof ns.handleGet !== 'function') {
    throw new Error('OBM.handleGet is not defined');
  }
  return ns.handleGet(e);
}

(function(global) {
  (function(ns) {
    'use strict';

    const SCRIPT_PROPERTIES = PropertiesService.getScriptProperties();
    ns.SCRIPT_PROPERTIES = SCRIPT_PROPERTIES;

    const DEFAULT_CONFIGURATION = Object.freeze({
      SHEET_ID: '14_6UyAhZQqHz6EGMRhr7YyqQ-KHMBsjeU4M5a_SRhis',
      SHEET_NAME: 'Hoja 1',
      CLIENTES_SHEET_NAME: 'clientes',
      SOFTENER_SHEET_NAME: 'softener_mantenimiento'
    });
    ns.DEFAULT_CONFIGURATION = DEFAULT_CONFIGURATION;

    function getPropertyOrDefault(propertyName, fallback) {
      const value = SCRIPT_PROPERTIES.getProperty(propertyName);
      return (typeof value === 'string' && value.trim()) ? value.trim() : fallback;
    }
    ns.getPropertyOrDefault = getPropertyOrDefault;

    function initProperties(overrides) {
      const defaults = {
        SHEET_ID: DEFAULT_CONFIGURATION.SHEET_ID,
        SHEET_NAME: DEFAULT_CONFIGURATION.SHEET_NAME,
        CLIENTES_SHEET_NAME: DEFAULT_CONFIGURATION.CLIENTES_SHEET_NAME,
        SOFTENER_SHEET_NAME: DEFAULT_CONFIGURATION.SOFTENER_SHEET_NAME
      };

      const properties = Object.assign({}, defaults, overrides || {});
      SCRIPT_PROPERTIES.setProperties(properties, true);
    }
    ns.initProperties = initProperties;

    const SHEET_ID = getPropertyOrDefault('SHEET_ID', DEFAULT_CONFIGURATION.SHEET_ID);
    const SHEET_NAME = getPropertyOrDefault('SHEET_NAME', DEFAULT_CONFIGURATION.SHEET_NAME);
    const CLIENTES_SHEET_NAME = getPropertyOrDefault('CLIENTES_SHEET_NAME', DEFAULT_CONFIGURATION.CLIENTES_SHEET_NAME);
    const SOFTENER_SHEET_NAME = getPropertyOrDefault('SOFTENER_SHEET_NAME', DEFAULT_CONFIGURATION.SOFTENER_SHEET_NAME);
    ns.SHEET_ID = SHEET_ID;
    ns.SHEET_NAME = SHEET_NAME;
    ns.CLIENTES_SHEET_NAME = CLIENTES_SHEET_NAME;
    ns.SOFTENER_SHEET_NAME = SOFTENER_SHEET_NAME;

    const SheetRepository = {
      getSpreadsheet() {
        if (!SHEET_ID) throw new Error('Configura la propiedad de script SHEET_ID.');
        return SpreadsheetApp.openById(SHEET_ID);
      },

      getSheetByName(sheetName) {
        if (!sheetName) throw new Error('Proporciona el nombre de la hoja.');
        const sheet = this.getSpreadsheet().getSheetByName(sheetName);
        if (!sheet) throw new Error(`No se encontró la hoja ${sheetName}.`);
        return sheet;
      },

      getSheet() {
        if (!SHEET_NAME) throw new Error('Configura la propiedad SHEET_NAME.');
        return this.getSheetByName(SHEET_NAME);
      },

      getSheetData() {
        const sheet = this.getSheet();
        return { sheet, data: sheet.getDataRange().getValues() };
      }
    };
    ns.SheetRepository = SheetRepository;

    const SoftenerSheetRepository = {
      getSheet() {
        if (!SOFTENER_SHEET_NAME) {
          throw new Error('Configura la propiedad SOFTENER_SHEET_NAME.');
        }

        const spreadsheet = SheetRepository.getSpreadsheet();
        const sheet = spreadsheet.getSheetByName(SOFTENER_SHEET_NAME);
        if (!sheet) {
          throw new Error(`No se encontró la hoja ${SOFTENER_SHEET_NAME}.`);
        }

        return sheet;
      },

      ensureHeaders_(sheet) {
        const headers = Array.isArray(ns.SOFTENER_HEADERS) ? ns.SOFTENER_HEADERS : [];
        if (!headers.length) {
          return;
        }

        const lastRow = sheet.getLastRow();
        const lastColumn = sheet.getLastColumn();
        const hasHeaderValues = lastRow >= 1 && lastColumn >= 1
          ? sheet.getRange(1, 1, 1, lastColumn).getValues()[0].some(value => String(value || '').trim())
          : false;

        if (!hasHeaderValues) {
          if (sheet.getMaxColumns() < headers.length) {
            const missing = headers.length - sheet.getMaxColumns();
            if (missing > 0) {
              const insertPosition = Math.max(1, sheet.getMaxColumns());
              sheet.insertColumnsAfter(insertPosition, missing);
            }
          }
          sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        }

        if (sheet.getFrozenRows() < 1) {
          sheet.setFrozenRows(1);
        }
      },

      getSheetForWrite() {
        const sheet = this.getSheet();
        this.ensureHeaders_(sheet);
        return sheet;
      },

      getSheetData() {
        const sheet = this.getSheet();
        return { sheet, data: sheet.getDataRange().getValues() };
      }
    };
    ns.SoftenerSheetRepository = SoftenerSheetRepository;

    const ResponseFactory = {
      success(data) {
        return ContentService
          .createTextOutput(JSON.stringify({ result: 'success', data }))
          .setMimeType(ContentService.MimeType.JSON);
      },
      error(error) {
        const msg = (error && error.message) ? error.message : String(error);
        return ContentService
          .createTextOutput(JSON.stringify({ result: 'error', error: msg }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    };
    ns.ResponseFactory = ResponseFactory;

    function extractDeploymentIdFromUrl(url) {
      if (typeof url !== 'string' || !url) return null;
      const trimmed = url.trim();
      if (!trimmed) return null;
      const match = trimmed.match(/\/s\/([a-zA-Z0-9_-]+)\/(?:exec|dev)/);
      return match && match[1] ? match[1] : null;
    }
    ns.extractDeploymentIdFromUrl = extractDeploymentIdFromUrl;

    function getScriptVersionInfo() {
      let webAppUrl = '';
      let deploymentId = null;

      try {
        const service = ScriptApp.getService();
        if (service) {
          webAppUrl = service.getUrl() || '';
          deploymentId = extractDeploymentIdFromUrl(webAppUrl);
        }
      } catch (serviceError) {
        Logger.log('No se pudo obtener la URL del web app: %s', serviceError);
      }

      let versionNumber = null;
      let description = '';

      try {
        const deploymentInfoList = ScriptApp.getDeploymentInfo();
        if (Array.isArray(deploymentInfoList) && deploymentInfoList.length) {
          let targetDeployment = null;
          if (deploymentId) {
            targetDeployment = deploymentInfoList.find((info) => {
              return typeof info.getDeploymentId === 'function'
                && info.getDeploymentId() === deploymentId;
            }) || null;
          }

          if (!targetDeployment) {
            targetDeployment = deploymentInfoList.reduce((current, info) => {
              if (!info || typeof info.getVersionNumber !== 'function') return current;
              const candidateVersion = info.getVersionNumber();
              if (typeof candidateVersion !== 'number' || isNaN(candidateVersion)) {
                return current;
              }
              if (!current || typeof current.getVersionNumber !== 'function') {
                return info;
              }
              const currentVersion = current.getVersionNumber();
              if (typeof currentVersion !== 'number' || isNaN(currentVersion)) {
                return info;
              }
              return candidateVersion > currentVersion ? info : current;
            }, null);
          }

          if (targetDeployment) {
            if (typeof targetDeployment.getVersionNumber === 'function') {
              const number = targetDeployment.getVersionNumber();
              if (typeof number === 'number' && !isNaN(number)) {
                versionNumber = number;
              }
            }
            if (typeof targetDeployment.getDescription === 'function') {
              const desc = targetDeployment.getDescription();
              if (typeof desc === 'string') {
                description = desc.trim();
              }
            }
          }
        }
      } catch (deploymentError) {
        Logger.log('No se pudo obtener la información de despliegue: %s', deploymentError);
      }

      const labelParts = [];
      if (versionNumber !== null) {
        labelParts.push(`#${versionNumber}`);
      }
      if (description) {
        labelParts.push(description);
      }

      return {
        deploymentId: deploymentId || null,
        versionNumber,
        description,
        webAppUrl: webAppUrl || '',
        label: labelParts.join(' – '),
        generatedAt: new Date().toISOString()
      };
    }
    ns.getScriptVersionInfo = getScriptVersionInfo;

    function sanitizeCellValue(value) {
      if (value === null || value === undefined) return '';
      if (typeof value === 'string') return value.trim();
      if (typeof value === 'number') return String(value);
      if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
        return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      }
      return String(value).trim();
    }
    ns.sanitizeCellValue = sanitizeCellValue;

    function normalizeDateToISO(value) {
      if (value === null || value === undefined || value === '') return '';
      let dateObject = null;

      if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
        dateObject = value;
      } else if (typeof value === 'number') {
        const candidate = new Date(value);
        if (!isNaN(candidate.getTime())) dateObject = candidate;
      } else if (typeof value === 'string') {
        const t = value.trim();
        if (!t) return '';
        let m = t.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
        if (m) {
          const d = new Date(parseInt(m[1],10), parseInt(m[2],10)-1, parseInt(m[3],10));
          if (!isNaN(d.getTime())) dateObject = d;
        }
        if (!dateObject) {
          m = t.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/) || t.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
          if (m) {
            let y, mo, da;
            if (m[1].length === 4) { y = +m[1]; mo = +m[2]; da = +m[3]; }
            else { da = +m[1]; mo = +m[2]; y = +m[3]; }
            const d = new Date(y, mo - 1, da);
            if (!isNaN(d.getTime())) dateObject = d;
          }
        }
        if (!dateObject) {
          const parsed = new Date(t);
          if (!isNaN(parsed.getTime())) dateObject = parsed;
        }
      }

      if (!dateObject) return '';
      return Utilities.formatDate(dateObject, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    }
    ns.normalizeDateToISO = normalizeDateToISO;

    const CLIENTES_HEADERS = Object.freeze(['Nombre', 'Direccion', 'Telefono', 'Mail', 'CUIT']);
    ns.CLIENTES_HEADERS = CLIENTES_HEADERS;

    const CLIENTES_FIELD_MAP = Object.freeze({
      Nombre: 'nombre',
      Direccion: 'direccion',
      Telefono: 'telefono',
      Mail: 'mail',
      CUIT: 'cuit'
    });
    ns.CLIENTES_FIELD_MAP = CLIENTES_FIELD_MAP;

    function normalizeClienteRow(row, headerIndexes) {
      const cliente = {};
      let hasData = false;

      CLIENTES_HEADERS.forEach((header) => {
        const index = headerIndexes[header];
        if (index === undefined || index === null) return;
        const fieldKey = CLIENTES_FIELD_MAP[header];
        const value = sanitizeCellValue(row[index]);
        cliente[fieldKey] = value;
        if (!hasData && value) hasData = true;
      });

      return hasData ? cliente : null;
    }
    ns.normalizeClienteRow = normalizeClienteRow;

    const ClientesService = {
      getSheet() {
        if (!CLIENTES_SHEET_NAME) throw new Error('Configura CLIENTES_SHEET_NAME.');
        return SheetRepository.getSheetByName(CLIENTES_SHEET_NAME);
      },

      getHeaderIndexes(headersRow) {
        const indexes = {};
        CLIENTES_HEADERS.forEach((header) => {
          const idx = headersRow.indexOf(header);
          if (idx === -1) throw new Error(`Falta encabezado ${header} en la hoja de clientes.`);
          indexes[header] = idx;
        });
        return indexes;
      },

      listar() {
        const sheet = this.getSheet();
        const values = sheet.getDataRange().getValues();
        if (!values.length) return [];

        const headersRow = values[0].map((v) => sanitizeCellValue(v));
        const headerIndexes = this.getHeaderIndexes(headersRow);

        const clientes = [];
        for (let i = 1; i < values.length; i++) {
          const cliente = normalizeClienteRow(values[i], headerIndexes);
          if (cliente) clientes.push(cliente);
        }

        clientes.sort((a, b) => {
          const na = (a.nombre || '').toLowerCase();
          const nb = (b.nombre || '').toLowerCase();
          if (na < nb) return -1;
          if (na > nb) return 1;
          const ca = (a.cuit || '').toLowerCase();
          const cb = (b.cuit || '').toLowerCase();
          if (ca < cb) return -1;
          if (ca > cb) return 1;
          return 0;
        });

        return clientes;
      }
    };
    ns.ClientesService = ClientesService;

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
    ns.CAMPOS_ACTUALIZABLES = CAMPOS_ACTUALIZABLES;

    const MantenimientoService = {
      guardar(data, usuarioMail) {
        const sheet = SheetRepository.getSheet();
        const timestamp = new Date();
        const idUnico = Utilities.getUuid();
        const editor = typeof usuarioMail === 'string' ? usuarioMail : '';

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

        const clienteFiltro = filtros.cliente ? String(filtros.cliente).toLowerCase() : '';
        const tecnicoFiltro = filtros.tecnico ? String(filtros.tecnico).toLowerCase() : '';
        const fechaFiltroISO = normalizeDateToISO(filtros.fecha || '');

        for (let i = 1; i < data.length; i++) {
          const row = data[i];
          const mantenimiento = {};
          let coincide = true;

          for (let j = 0; j < headers.length; j++) {
            const header = headers[j];
            mantenimiento[header] = row[j];
          }

          const fechaServicioISO = normalizeDateToISO(mantenimiento.Fecha_Servicio);
          if (fechaServicioISO) mantenimiento.Fecha_Servicio = fechaServicioISO;

          if (clienteFiltro) {
            const cliente = mantenimiento.Cliente ? String(mantenimiento.Cliente).toLowerCase() : '';
            if (!cliente.includes(clienteFiltro)) coincide = false;
          }

          if (coincide && tecnicoFiltro) {
            const tecnico = mantenimiento.Tecnico_Asignado ? String(mantenimiento.Tecnico_Asignado).toLowerCase() : '';
            if (!tecnico.includes(tecnicoFiltro)) coincide = false;
          }

          if (coincide && fechaFiltroISO) {
            if (!fechaServicioISO || fechaServicioISO !== fechaFiltroISO) coincide = false;
          }

          if (coincide) {
            const proxISO = normalizeDateToISO(mantenimiento.Proximo_Mantenimiento);
            if (proxISO) mantenimiento.Proximo_Mantenimiento = proxISO;
            resultados.push(mantenimiento);
          }
        }

        return resultados;
      },

      actualizar(data, usuarioMail) {
        const { sheet, data: allData } = SheetRepository.getSheetData();
        const headers = allData[0];

        const idIndex = headers.indexOf('ID_Unico');
        if (idIndex === -1) throw new Error('Encabezado ID_Unico no encontrado');

        let rowIndex = -1;
        for (let i = 1; i < allData.length; i++) {
          if (allData[i][idIndex] === data.id) { rowIndex = i + 1; break; }
        }
        if (rowIndex === -1) throw new Error('Mantenimiento no encontrado');

        CAMPOS_ACTUALIZABLES.forEach((campo) => {
          const colIndex = headers.indexOf(campo);
          if (colIndex === -1) return;
          const dataKey = campo.toLowerCase();
          if (Object.prototype.hasOwnProperty.call(data, dataKey) && data[dataKey] !== undefined) {
            sheet.getRange(rowIndex, colIndex + 1).setValue(data[dataKey]);
          }
        });

        const updateTimestamp = new Date();
        const timestampIndex = headers.indexOf('Timestamp');
        if (timestampIndex !== -1) sheet.getRange(rowIndex, timestampIndex + 1).setValue(updateTimestamp);

        const updatedByIndex = headers.indexOf('Actualizado_por');
        if (updatedByIndex !== -1) sheet.getRange(rowIndex, updatedByIndex + 1).setValue(typeof usuarioMail === 'string' ? usuarioMail : '');

        return {
          mensaje: 'Mantenimiento actualizado correctamente',
          actualizado_por: typeof usuarioMail === 'string' ? usuarioMail : '',
          timestamp: updateTimestamp,
        };
      },

      eliminar(data) {
        const { sheet, data: allData } = SheetRepository.getSheetData();
        const headers = allData[0];

        const idIndex = headers.indexOf('ID_Unico');
        if (idIndex === -1) throw new Error('Encabezado ID_Unico no encontrado');

        for (let i = 1; i < allData.length; i++) {
          if (allData[i][idIndex] === data.id) {
            sheet.deleteRow(i + 1);
            return { mensaje: 'Mantenimiento eliminado correctamente' };
          }
        }
        throw new Error('Mantenimiento no encontrado');
      }
    };
    ns.MantenimientoService = MantenimientoService;

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
        const mensual = {};
        const proximosMantenimientos = [];
        const tecnicosData = {};

        for (let i = 1; i < data.length; i++) {
          const row = data[i];
          const mantenimiento = {};
          headers.forEach((header, index) => {
            mantenimiento[header] = row[index];
          });

          const fechaServicioISO = normalizeDateToISO(mantenimiento.Fecha_Servicio);
          if (fechaServicioISO) mantenimiento.Fecha_Servicio = fechaServicioISO;

          if (mantenimiento.Fecha_Servicio) {
            const fecha = new Date(mantenimiento.Fecha_Servicio);
            if (fecha >= inicioMes && fecha < unMesDespues) {
              esteMes += 1;
            }

            const monthKey = Utilities.formatDate(fecha, Session.getScriptTimeZone(), 'yyyy-MM');
            mensual[monthKey] = (mensual[monthKey] || 0) + 1;
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
            if (!tecnicosData[mantenimiento.Tecnico_Asignado]) tecnicosData[mantenimiento.Tecnico_Asignado] = 0;
            tecnicosData[mantenimiento.Tecnico_Asignado]++;
          }
        }

        proximosMantenimientos.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
        const tecnicosArray = Object.keys(tecnicosData).map((t) => ({ tecnico: t, count: tecnicosData[t] }));

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
    ns.DashboardService = DashboardService;

    ns.handlePost = function(e) {
      try {
        const data = JSON.parse(e.postData.contents || '{}');
        const { action } = data;

        switch (action) {
          case 'login': {
            const usuario = ns.AuthService.authenticate(data.mail, data.password);
            const tokenInfo = ns.SessionService.createSession(usuario.mail);
            const { password, ...usuarioPublico } = usuario;
            return ResponseFactory.success({
              token: tokenInfo.token,
              expiresAt: tokenInfo.expiresAt,
              usuario: usuarioPublico
            });
          }

          case 'logout': {
            ns.SessionService.invalidateSession(data.token);
            return ResponseFactory.success({ message: 'Sesión cerrada' });
          }

          case 'renew': {
            const sess = ns.SessionService.validateSession(data.token, { renew: true });
            return ResponseFactory.success({ token: sess.token, expiresAt: sess.expiresAt, mail: sess.mail });
          }

          case 'mi-perfil': {
            const sess = ns.SessionService.validateSession(data.token);
            const usuario = ns.AuthService.getUserByMail(sess.mail);
            const { password, ...usuarioPublico } = usuario;
            return ResponseFactory.success({ usuario: usuarioPublico });
          }

          case 'listUsers': {
            const lista = ns.AuthService.listUsers();
            return ResponseFactory.success({ usuarios: lista });
          }

          case 'version_info': {
            const versionInfo = getScriptVersionInfo();
            Logger.log('[VERSION] %s', JSON.stringify(versionInfo));
            return ResponseFactory.success(versionInfo);
          }

          case 'version': {
            const versionInfo = {
              ok: true,
              version: ns.MOD_CODE_VERSION || 'desconocido'
            };
            return ResponseFactory.success(versionInfo);
          }

          case 'guardar': {
            const sess = ns.SessionService.validateSession(data.token);
            const result = MantenimientoService.guardar(data, sess.mail);
            return ResponseFactory.success(result);
          }

          case 'buscar': {
            ns.SessionService.validateSession(data.token);
            const result = MantenimientoService.buscar(data);
            return ResponseFactory.success(result);
          }

          case 'actualizar': {
            const sess = ns.SessionService.validateSession(data.token);
            const result = MantenimientoService.actualizar(data, sess.mail);
            return ResponseFactory.success(result);
          }

          case 'eliminar': {
            ns.SessionService.validateSession(data.token);
            const result = MantenimientoService.eliminar(data);
            return ResponseFactory.success(result);
          }

          case 'clientes': {
            ns.SessionService.validateSession(data.token);
            const result = ClientesService.listar();
            return ResponseFactory.success(result);
          }

          case 'dashboard': {
            ns.SessionService.validateSession(data.token);
            const result = DashboardService.obtenerDatos();
            return ResponseFactory.success(result);
          }

          case 'crear_remito': {
            const sess = ns.SessionService.validateSession(data.token);
            const result = ns.RemitoService.crearRemito(
              data.reporteData,
              data.observaciones,
              sess.mail,
              data.fotos
            );
            return ResponseFactory.success(result);
          }

          case 'obtener_remitos': {
            ns.SessionService.validateSession(data.token);
            const page = data.page || 1;
            const pageSize = data.pageSize || 20;
            const result = ns.RemitoService.obtenerRemitos(page, pageSize);
            return ResponseFactory.success(result);
          }

          case 'guardar_ablandador': {
            const sess = ns.SessionService.validateSession(data.token);
            const payload = data.payload && typeof data.payload === 'object' ? data.payload : data;
            const result = ns.SoftenerMaintenanceService.guardar(payload, sess.mail);
            return ResponseFactory.success(result);
          }

          default:
            throw new Error('Acción no soportada');
        }
      } catch (error) {
        return ResponseFactory.error(error);
      }
    };

    ns.handleGet = function(e) {
      const params = e && e.parameter ? e.parameter : {};
      const action = params.action;

      try {
        if (action === 'dashboard') {
          ns.SessionService.validateSession(params.token);
          return ResponseFactory.success(DashboardService.obtenerDatos());
        }
        if (action === 'clientes') {
          ns.SessionService.validateSession(params.token);
          return ResponseFactory.success(ClientesService.listar());
        }
        if (action === 'version_info') {
          const versionInfo = getScriptVersionInfo();
          Logger.log('[VERSION][GET] %s', JSON.stringify(versionInfo));
          return ResponseFactory.success(versionInfo);
        }
        if (action === 'version') {
          return ResponseFactory.success({
            ok: true,
            version: ns.MOD_CODE_VERSION || 'desconocido'
          });
        }
        return ResponseFactory.success({ message: 'API viva' });
      } catch (error) {
        return ResponseFactory.error(error);
      }
    };
  })(global.OBM = global.OBM || {});
})(typeof window !== 'undefined' ? window : this);
