(function(global) {
  (function(ns) {
    'use strict';

    const resolvedSheetName = typeof ns.SOFTENER_SHEET_NAME === 'string' && ns.SOFTENER_SHEET_NAME
      ? ns.SOFTENER_SHEET_NAME
      : 'softener_mantenimiento';
    const SOFTENER_SHEET_NAME = resolvedSheetName;

    const SOFTENER_COLUMNS = Object.freeze([
      // Metadata básica (primero)
      { header: 'Fecha_Registro', path: 'metadata.timestamp', formatter: 'dateTime' },
      { header: 'Registrado_Por', path: 'metadata.usuario' },
      { header: 'Numero_Reporte', path: 'metadata.numero_reporte' },
      { header: 'ID_Unico', path: 'metadata.id_unico' },
      
      // Sección A - Cliente y Servicio (datos principales primero)
      { header: 'Cliente_Nombre', path: 'seccion_A_cliente.nombre' },
      { header: 'Cliente_Direccion', path: 'seccion_A_cliente.direccion' },
      { header: 'Cliente_Localidad', path: 'seccion_A_cliente.localidad' },
      { header: 'Cliente_Contacto', path: 'seccion_A_cliente.contacto' },
      { header: 'Cliente_Telefono', path: 'seccion_A_cliente.telefono' },
      { header: 'Cliente_Email', path: 'seccion_A_cliente.email' },
      { header: 'Cliente_CUIT', path: 'seccion_A_cliente.cuit' },
      { header: 'Servicio_Fecha', path: 'seccion_A_cliente.fecha_servicio', formatter: 'date' },
      { header: 'Servicio_Tecnico', path: 'seccion_A_cliente.tecnico' },
      
      // Sección B - Equipo
      { header: 'Equipo_Tipo', path: 'seccion_B_equipo.tipo' },
      { header: 'Equipo_Modelo', path: 'seccion_B_equipo.modelo' },
      { header: 'Equipo_NumeroSerie', path: 'seccion_B_equipo.numero_serie' },
      { header: 'Equipo_Ubicacion', path: 'seccion_B_equipo.ubicacion' },
      { header: 'Equipo_VolumenResina', path: 'seccion_B_equipo.volumen_resina', formatter: 'number' },
      { header: 'Equipo_TipoRegeneracion', path: 'seccion_B_equipo.tipo_regeneracion' },
      { header: 'Equipo_Prefiltro', path: 'seccion_B_equipo.prefiltro' },
      { header: 'Equipo_ProteccionEntrada', path: 'seccion_B_equipo.proteccion_entrada' },
      { header: 'Equipo_Manometros', path: 'seccion_B_equipo.manometros' },
      { header: 'Equipo_Notas', path: 'seccion_B_equipo.notas_equipo' },
      
      // Sección C - Parámetros de Autonomía
      { header: 'Parametros_DurezaAguaCruda', path: 'seccion_C_parametros.dureza_agua_cruda', formatter: 'number' },
      { header: 'Parametros_AutonomiaRestante', path: 'seccion_C_parametros.autonomia_restante', formatter: 'number' },
      { header: 'Parametros_SeteoAutonomia', path: 'seccion_C_parametros.seteo_actual_autonomia', formatter: 'number' },
      { header: 'Parametros_AplicarProteccion20', path: 'seccion_C_parametros.aplicar_proteccion_20', formatter: 'boolean' },
      { header: 'Parametros_AutonomiaRecomendada', path: 'seccion_C_parametros.autonomia_recomendada', formatter: 'number' },
      { header: 'Parametros_AjustadaValorCalculado', path: 'seccion_C_parametros.autonomia_ajustada_valor_calculado', formatter: 'boolean' },
      
      // Sección C - Cabezal (Configuración)
      { header: 'Cabezal_HoraCabezal_AsFound', path: 'seccion_C_cabezal.hora_cabezal_as_found' },
      { header: 'Cabezal_HoraCabezal_AsLeft', path: 'seccion_C_cabezal.hora_cabezal_as_left' },
      { header: 'Cabezal_HoraRegeneracion_AsFound', path: 'seccion_C_cabezal.hora_regeneracion_as_found' },
      { header: 'Cabezal_HoraRegeneracion_AsLeft', path: 'seccion_C_cabezal.hora_regeneracion_as_left' },
      { header: 'Cabezal_P1_Retrolavado_Found', path: 'seccion_C_cabezal.p1_retrolavado_min_found', formatter: 'number' },
      { header: 'Cabezal_P1_Retrolavado_Left', path: 'seccion_C_cabezal.p1_retrolavado_min_left', formatter: 'number' },
      { header: 'Cabezal_P2_Salmuera_Found', path: 'seccion_C_cabezal.p2_salmuera_min_found', formatter: 'number' },
      { header: 'Cabezal_P2_Salmuera_Left', path: 'seccion_C_cabezal.p2_salmuera_min_left', formatter: 'number' },
      { header: 'Cabezal_P3_Enjuague_Found', path: 'seccion_C_cabezal.p3_enjuague_min_found', formatter: 'number' },
      { header: 'Cabezal_P3_Enjuague_Left', path: 'seccion_C_cabezal.p3_enjuague_min_left', formatter: 'number' },
      { header: 'Cabezal_P4_LlenadoSalero_Found', path: 'seccion_C_cabezal.p4_llenado_salero_min_found', formatter: 'number' },
      { header: 'Cabezal_P4_LlenadoSalero_Left', path: 'seccion_C_cabezal.p4_llenado_salero_min_left', formatter: 'number' },
      { header: 'Cabezal_FrecuenciaDias_Found', path: 'seccion_C_cabezal.frecuencia_dias_found', formatter: 'number' },
      { header: 'Cabezal_FrecuenciaDias_Left', path: 'seccion_C_cabezal.frecuencia_dias_left', formatter: 'number' },
      
      // Sección D - Checklist
      { header: 'Checklist_InspeccionFugas', path: 'seccion_D_checklist.inspeccion_fugas', formatter: 'boolean' },
      { header: 'Checklist_CambioFiltroRealizado', path: 'seccion_D_checklist.cambio_filtro_realizado', formatter: 'boolean' },
      { header: 'Checklist_FiltroTipoInstalado', path: 'seccion_D_checklist.filtro_tipo_instalado' },
      { header: 'Checklist_FiltroLoteSerie', path: 'seccion_D_checklist.filtro_lote_serie' },
      { header: 'Checklist_LimpiezaTanqueSal', path: 'seccion_D_checklist.limpieza_tanque_sal', formatter: 'boolean' },
      { header: 'Checklist_VerificacionNivelAgua', path: 'seccion_D_checklist.verificacion_nivel_agua', formatter: 'boolean' },
      { header: 'Checklist_CargaSal', path: 'seccion_D_checklist.carga_sal', formatter: 'boolean' },
      { header: 'Checklist_VerificacionHora', path: 'seccion_D_checklist.verificacion_hora', formatter: 'boolean' },
      { header: 'Checklist_VerificacionParametrosCiclo', path: 'seccion_D_checklist.verificacion_parametros_ciclo', formatter: 'boolean' },
      { header: 'Checklist_AjusteAutonomia', path: 'seccion_D_checklist.ajuste_autonomia', formatter: 'boolean' },
      { header: 'Checklist_RegeneracionManual', path: 'seccion_D_checklist.regeneracion_manual', formatter: 'boolean' },
      { header: 'Checklist_Otros', path: 'seccion_D_checklist.otros' },
      { header: 'Checklist_Observaciones', path: 'seccion_D_checklist.observaciones' },
      
      // Sección E - Resumen
      { header: 'Resumen_TrabajoRealizado', path: 'seccion_E_resumen.trabajo_realizado' },
      { header: 'Resumen_Recomendaciones', path: 'seccion_E_resumen.recomendaciones' },
      { header: 'Resumen_ProximoServicio', path: 'seccion_E_resumen.proximo_servicio', formatter: 'date' },
      { header: 'Resumen_Materiales', path: 'seccion_E_resumen.materiales' },
      { header: 'Resumen_ComentariosCliente', path: 'seccion_E_resumen.comentarios_cliente' },
      
      // Sección F - Condiciones de Operación
      { header: 'Condiciones_PresionEntrada_Found', path: 'seccion_F_condiciones.presion_entrada_as_found', formatter: 'number' },
      { header: 'Condiciones_PresionEntrada_Left', path: 'seccion_F_condiciones.presion_entrada_as_left', formatter: 'number' },
      { header: 'Condiciones_PresionSalida_Found', path: 'seccion_F_condiciones.presion_salida_as_found', formatter: 'number' },
      { header: 'Condiciones_PresionSalida_Left', path: 'seccion_F_condiciones.presion_salida_as_left', formatter: 'number' },
      { header: 'Condiciones_NivelSal_Found', path: 'seccion_F_condiciones.nivel_sal_as_found' },
      { header: 'Condiciones_NivelSal_Left', path: 'seccion_F_condiciones.nivel_sal_as_left' },
      { header: 'Condiciones_TemperaturaAmbiente', path: 'seccion_F_condiciones.temperatura_ambiente' },
      { header: 'Condiciones_EstadoGabinete', path: 'seccion_F_condiciones.estado_gabinete' },
      { header: 'Condiciones_Observaciones', path: 'seccion_F_condiciones.observaciones' },
      
      // Parámetros de Operación (desde Sección B)
      { header: 'Parametros_PresionEntrada_Found', path: 'seccion_B_parametros_operacion.presion_entrada_as_found', formatter: 'number' },
      { header: 'Parametros_PresionEntrada_Left', path: 'seccion_B_parametros_operacion.presion_entrada_as_left', formatter: 'number' },
      { header: 'Parametros_TestCloro_Found', path: 'seccion_B_parametros_operacion.test_cloro_entrada_as_found', formatter: 'number' },
      { header: 'Parametros_TestCloro_Left', path: 'seccion_B_parametros_operacion.test_cloro_entrada_as_left', formatter: 'number' },
      { header: 'Parametros_DurezaSalida_Found', path: 'seccion_B_parametros_operacion.dureza_salida_as_found', formatter: 'number' },
      { header: 'Parametros_DurezaSalida_Left', path: 'seccion_B_parametros_operacion.dureza_salida_as_left', formatter: 'number' },
      
      // Sección G - Cierre y Confirmación
      { header: 'Cierre_ConformidadCliente', path: 'seccion_G_cierre.conformidad_cliente' },
      { header: 'Cierre_RepresentanteCliente', path: 'seccion_G_cierre.representante_cliente' },
      { header: 'Cierre_MedioConfirmacion', path: 'seccion_G_cierre.medio_confirmacion' },
      { header: 'Cierre_RequiereSeguimiento', path: 'seccion_G_cierre.requiere_seguimiento', formatter: 'boolean' },
      { header: 'Cierre_ObservacionesFinales', path: 'seccion_G_cierre.observaciones_finales' },
      
      // Campos de nivel superior para compatibilidad con remitos (al final)
      { header: 'Cliente', path: 'cliente' },
      { header: 'Direccion', path: 'direccion' },
      { header: 'Cliente_Telefono_Remito', path: 'cliente_telefono' },
      { header: 'Cliente_Email_Remito', path: 'cliente_email' },
      { header: 'Cliente_CUIT_Remito', path: 'cliente_cuit' },
      { header: 'Numero_Reporte_Remito', path: 'numero_reporte' },
      
      // Payload completo como JSON (para consultas futuras)
      { header: 'Datos_Adicionales', path: '__PAYLOAD__', formatter: 'json' }
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
    
    // Función de diagnóstico - ver qué versión está corriendo
    ns.getSoftenerConfigInfo = function() {
      return {
        version: 'v2.0-81columns',
        timestamp: new Date().toISOString(),
        totalColumns: SOFTENER_COLUMNS.length,
        totalHeaders: SOFTENER_HEADERS.length,
        sheetName: SOFTENER_SHEET_NAME,
        firstHeaders: SOFTENER_HEADERS.slice(0, 10),
        lastHeaders: SOFTENER_HEADERS.slice(-10)
      };
    };
  })(global.OBM = global.OBM || {});
})(typeof window !== 'undefined' ? window : this);
