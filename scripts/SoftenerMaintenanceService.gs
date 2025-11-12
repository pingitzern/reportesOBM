(function(global) {
  (function(ns) {
    'use strict';

    const resolvedSheetName = typeof ns.SOFTENER_SHEET_NAME === 'string' && ns.SOFTENER_SHEET_NAME
      ? ns.SOFTENER_SHEET_NAME
      : 'softener_mantenimiento';
    const SOFTENER_SHEET_NAME = resolvedSheetName;

    const SOFTENER_COLUMNS = Object.freeze([
      { header: 'Fecha_Registro', path: 'metadata.timestamp', formatter: 'dateTime' },
      { header: 'Registrado_Por', path: 'metadata.usuario' },
      { header: 'Cliente_Nombre', path: 'seccion_A_cliente.nombre' },
      { header: 'Cliente_Direccion', path: 'seccion_A_cliente.direccion' },
      { header: 'Cliente_Localidad', path: 'seccion_A_cliente.localidad' },
      { header: 'Cliente_Contacto', path: 'seccion_A_cliente.contacto' },
      { header: 'Cliente_Telefono', path: 'seccion_A_cliente.telefono' },
      { header: 'Cliente_Email', path: 'seccion_A_cliente.email' },
      { header: 'Cliente_CUIT', path: 'seccion_A_cliente.cuit' },
      { header: 'Servicio_Fecha', path: 'seccion_A_cliente.fecha_servicio', formatter: 'date' },
      { header: 'Servicio_Tecnico', path: 'seccion_A_cliente.tecnico' },
      { header: 'Equipo_Tipo', path: 'seccion_B_equipo.tipo' },
      { header: 'Equipo_Modelo', path: 'seccion_B_equipo.modelo' },
      { header: 'Equipo_NumeroSerie', path: 'seccion_B_equipo.numero_serie' },
      { header: 'Equipo_Ubicacion', path: 'seccion_B_equipo.ubicacion' },
      { header: 'Equipo_VolumenResina', path: 'seccion_B_equipo.volumen_resina', formatter: 'number' },
      { header: 'Equipo_Notas', path: 'seccion_B_equipo.notas_equipo' },
      { header: 'Parametros_DurezaAguaCruda', path: 'seccion_C_parametros.dureza_agua_cruda', formatter: 'number' },
      { header: 'Parametros_SeteoAutonomia', path: 'seccion_C_parametros.seteo_actual_autonomia', formatter: 'number' },
      { header: 'Parametros_AutonomiaCalculada', path: 'seccion_C_parametros.autonomia_calculada', formatter: 'number' },
      { header: 'Parametros_AplicarProteccion20', path: 'seccion_C_parametros.aplicar_proteccion_20', formatter: 'boolean' },
      { header: 'Parametros_AutonomiaRecomendada', path: 'seccion_C_parametros.autonomia_recomendada', formatter: 'number' },
      { header: 'Parametros_AjustadaValorCalculado', path: 'seccion_C_parametros.autonomia_ajustada_valor_calculado', formatter: 'boolean' },
      { header: 'Checklist_RegeneracionAutomatica', path: 'seccion_D_checklist.regeneracion_automatica', formatter: 'boolean' },
      { header: 'Checklist_LimpiezaTanqueSal', path: 'seccion_D_checklist.limpieza_tanque_sal', formatter: 'boolean' },
      { header: 'Checklist_ValvulasOperativas', path: 'seccion_D_checklist.valvulas_operativas', formatter: 'boolean' },
      { header: 'Checklist_Fugas', path: 'seccion_D_checklist.fugas', formatter: 'boolean' },
      { header: 'Checklist_CambioResina', path: 'seccion_D_checklist.cambio_resina', formatter: 'boolean' },
      { header: 'Checklist_FactorProteccionConfirmado', path: 'seccion_D_checklist.factor_proteccion_confirmado', formatter: 'boolean' },
      { header: 'Checklist_Otros', path: 'seccion_D_checklist.otros' },
      { header: 'Checklist_Observaciones', path: 'seccion_D_checklist.observaciones' },
      { header: 'Resumen_TrabajoRealizado', path: 'seccion_E_resumen.trabajo_realizado' },
      { header: 'Resumen_Recomendaciones', path: 'seccion_E_resumen.recomendaciones' },
      { header: 'Resumen_ProximoServicio', path: 'seccion_E_resumen.proximo_servicio', formatter: 'date' },
      { header: 'Datos_Adicionales', path: '__PAYLOAD__', formatter: 'json' },
      { header: 'ID_Unico', path: 'metadata.id_unico' }
    ]);

    const SOFTENER_HEADERS = Object.freeze(SOFTENER_COLUMNS.map(column => column.header));

    const SoftenerMaintenanceService = {
      guardar(payload, usuarioMail) {
        const data = this.ensurePlainObject_(payload);
        if (!Object.keys(data).length) {
          throw new Error('No se recibieron datos para guardar.');
        }

        const seccionCliente = this.ensurePlainObject_(data.seccion_A_cliente);
        const clienteNombre = this.extractField_(seccionCliente, [
          'cliente',
          'nombre',
          'cliente_nombre',
          'razon_social',
          'razonSocial'
        ]);
        if (!clienteNombre) {
          throw new Error('El nombre del cliente es obligatorio.');
        }

        const fechaServicioRaw = this.extractField_(seccionCliente, [
          'fecha_servicio',
          'fechaServicio',
          'fecha'
        ]);
        const fechaServicio = this.parseDate_(fechaServicioRaw);
        if (!fechaServicio) {
          throw new Error('La fecha del servicio es obligatoria.');
        }

        const metadata = {
          timestamp: new Date(),
          usuario: this.normalizeString_(usuarioMail),
          id_unico: Utilities.getUuid()
        };

        const enrichedPayload = this.mergeMetadata_(data, metadata);
        const rowValues = this.buildRowValues_(enrichedPayload);

        const repository = ns.SoftenerSheetRepository;
        if (!repository || (typeof repository.getSheetForWrite !== 'function' && typeof repository.getSheet !== 'function')) {
          throw new Error('Repositorio de datos de ablandadores no disponible.');
        }

        const sheet = typeof repository.getSheetForWrite === 'function'
          ? repository.getSheetForWrite()
          : repository.getSheet();

        sheet.appendRow(rowValues);

        return {
          id: metadata.id_unico,
          timestamp: metadata.timestamp,
          cliente: clienteNombre,
          fecha_servicio: this.formatDateValue_(fechaServicio, { includeTime: false }),
          mensaje: 'Registro de mantenimiento de ablandador guardado correctamente.'
        };
      },

      buildRowValues_(payload) {
        return SOFTENER_COLUMNS.map(column => this.getColumnValue_(payload, column));
      },

      getColumnValue_(payload, column) {
        if (column.path === '__PAYLOAD__') {
          return this.applyFormatter_(payload, column.formatter);
        }
        const rawValue = this.getNestedValue_(payload, column.path);
        return this.applyFormatter_(rawValue, column.formatter);
      },

      applyFormatter_(value, formatterKey) {
        switch (formatterKey) {
          case 'dateTime':
            return this.formatDateValue_(value, { includeTime: true });
          case 'date':
            return this.formatDateValue_(value, { includeTime: false });
          case 'number':
            return this.formatNumberValue_(value);
          case 'boolean':
            return this.formatBooleanValue_(value);
          case 'json':
            return this.formatJsonValue_(value);
          default:
            return this.normalizeOutputValue_(value);
        }
      },

      mergeMetadata_(payload, metadata) {
        const base = this.ensurePlainObject_(payload);
        const merged = {};
        Object.keys(base).forEach(key => {
          merged[key] = base[key];
        });
        const existingMetadata = this.ensurePlainObject_(base.metadata);
        merged.metadata = Object.assign({}, existingMetadata, metadata);
        return merged;
      },

      ensurePlainObject_(value) {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          return value;
        }
        return {};
      },

      extractField_(section, candidates) {
        if (!section || typeof section !== 'object') {
          return '';
        }
        for (let index = 0; index < candidates.length; index += 1) {
          const key = candidates[index];
          if (Object.prototype.hasOwnProperty.call(section, key)) {
            const normalized = this.normalizeString_(section[key]);
            if (normalized) {
              return normalized;
            }
          }
        }
        return '';
      },

      getNestedValue_(source, path) {
        if (!path) {
          return undefined;
        }
        const segments = String(path).split('.');
        let current = source;
        for (let index = 0; index < segments.length; index += 1) {
          if (current === null || current === undefined) {
            return undefined;
          }
          current = current[segments[index]];
        }
        return current;
      },

      normalizeString_(value) {
        if (value === null || value === undefined) {
          return '';
        }
        const stringValue = String(value);
        return stringValue.trim();
      },

      normalizeOutputValue_(value) {
        if (value === null || value === undefined) {
          return '';
        }
        if (value instanceof Date && !Number.isNaN(value.getTime())) {
          return this.formatDateValue_(value, { includeTime: true });
        }
        if (typeof value === 'number' && Number.isFinite(value)) {
          return value;
        }
        if (typeof value === 'boolean') {
          return value ? 'SI' : 'NO';
        }
        if (typeof value === 'string') {
          return value.trim();
        }
        return String(value);
      },

      parseDate_(value) {
        if (value instanceof Date && !Number.isNaN(value.getTime())) {
          return new Date(value.getTime());
        }
        if (typeof value === 'number' && Number.isFinite(value)) {
          const dateFromNumber = new Date(value);
          return Number.isNaN(dateFromNumber.getTime()) ? null : dateFromNumber;
        }
        if (typeof value !== 'string') {
          return null;
        }
        const trimmed = value.trim();
        if (!trimmed) {
          return null;
        }
        const directDate = new Date(trimmed);
        if (!Number.isNaN(directDate.getTime())) {
          return directDate;
        }
        const match = trimmed.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
        if (match) {
          const day = parseInt(match[1], 10);
          const month = parseInt(match[2], 10) - 1;
          const year = parseInt(match[3], 10);
          const candidate = new Date(year, month, day);
          if (candidate.getFullYear() === year && candidate.getMonth() === month && candidate.getDate() === day) {
            return candidate;
          }
        }
        return null;
      },

      formatDateValue_(value, { includeTime = false } = {}) {
        let date = null;
        if (value instanceof Date && !Number.isNaN(value.getTime())) {
          date = value;
        } else {
          date = this.parseDate_(value);
        }
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
          return '';
        }
        const pattern = includeTime ? 'yyyy-MM-dd HH:mm:ss' : 'yyyy-MM-dd';
        return Utilities.formatDate(date, Session.getScriptTimeZone(), pattern);
      },

      formatNumberValue_(value) {
        if (value === null || value === undefined) {
          return '';
        }
        if (typeof value === 'number' && Number.isFinite(value)) {
          return value;
        }
        if (typeof value === 'boolean') {
          return value ? 1 : 0;
        }
        if (typeof value === 'string') {
          const trimmed = value.trim();
          if (!trimmed) {
            return '';
          }
          const normalized = trimmed.replace(',', '.');
          const parsed = Number(normalized);
          return Number.isFinite(parsed) ? parsed : trimmed;
        }
        return value;
      },

      formatBooleanValue_(value) {
        if (value === null || value === undefined) {
          return '';
        }
        if (typeof value === 'boolean') {
          return value ? 'SI' : 'NO';
        }
        if (typeof value === 'number') {
          return value !== 0 ? 'SI' : 'NO';
        }
        if (typeof value === 'string') {
          const normalized = value.trim().toLowerCase();
          if (!normalized) {
            return '';
          }
          if (['si', 'sí', 'true', '1', 'ok', 'yes', 'y', 'on'].indexOf(normalized) !== -1) {
            return 'SI';
          }
          if (['no', 'false', '0', 'off', 'n'].indexOf(normalized) !== -1) {
            return 'NO';
          }
        }
        return '';
      },

      formatJsonValue_(value) {
        if (value === null || value === undefined) {
          return '';
        }
        try {
          const serialized = this.serializeForJson_(value);
          return JSON.stringify(serialized);
        } catch (error) {
          Logger.log('No se pudo serializar el payload de mantenimiento de ablandador: %s', error);
          return '';
        }
      },

      serializeForJson_(value) {
        if (value === null || value === undefined) {
          return null;
        }
        if (value instanceof Date) {
          return value.toISOString();
        }
        if (Array.isArray(value)) {
          return value.map(item => this.serializeForJson_(item));
        }
        if (typeof value === 'object') {
          const result = {};
          Object.keys(value).forEach(key => {
            result[key] = this.serializeForJson_(value[key]);
          });
          return result;
        }
        return value;
      }
    };

    if (!ns.SOFTENER_SHEET_NAME) {
      ns.SOFTENER_SHEET_NAME = SOFTENER_SHEET_NAME;
    }
    ns.SOFTENER_COLUMNS = SOFTENER_COLUMNS;
    ns.SOFTENER_HEADERS = SOFTENER_HEADERS;
    ns.SoftenerMaintenanceService = SoftenerMaintenanceService;
  })(global.OBM = global.OBM || {});
})(typeof window !== 'undefined' ? window : this);
