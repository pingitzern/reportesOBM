(function(global) {
  (function(ns) {
    'use strict';

    // ID de la carpeta de Drive donde se guardarán los PDFs de ablandadores
    const SOFTENER_PDF_FOLDER_ID = '1RPo4A5amzcRozq-tt35Z6Dwet70abSQJ';
    
    // URL del logo (desde el repositorio público o Drive)
    const SOFTENER_PDF_LOGO_URL = 'https://raw.githubusercontent.com/pingitzer/reportesOBM/main/frontend/public/OHM-agua.png';

    const SoftenerPdfService = {
      pdfFolderCache: null,
      logoDataCache: null,

      /**
       * Obtiene la carpeta de Drive para guardar PDFs de ablandadores
       */
      getPdfFolder_() {
        if (!SOFTENER_PDF_FOLDER_ID) {
          return null;
        }

        if (this.pdfFolderCache) {
          return this.pdfFolderCache;
        }

        try {
          this.pdfFolderCache = DriveApp.getFolderById(SOFTENER_PDF_FOLDER_ID);
        } catch (error) {
          Logger.log('No se pudo acceder a la carpeta de PDFs de ablandadores: %s', error);
          this.pdfFolderCache = null;
        }

        return this.pdfFolderCache;
      },

      /**
       * Resuelve el logo para incluir en el PDF
       */
      resolveLogoForPdf_() {
        if (this.logoDataCache) {
          return this.logoDataCache;
        }

        if (!SOFTENER_PDF_LOGO_URL) {
          return '';
        }

        try {
          const response = UrlFetchApp.fetch(SOFTENER_PDF_LOGO_URL, { muteHttpExceptions: true });
          if (response.getResponseCode() === 200) {
            const blob = response.getBlob();
            const base64 = Utilities.base64Encode(blob.getBytes());
            const mimeType = blob.getContentType() || 'image/png';
            this.logoDataCache = `data:${mimeType};base64,${base64}`;
            return this.logoDataCache;
          }
        } catch (error) {
          Logger.log('Error al obtener el logo desde %s: %s', SOFTENER_PDF_LOGO_URL, error);
        }

        return SOFTENER_PDF_LOGO_URL;
      },

      /**
       * Escapa caracteres HTML
       */
      escapeHtml_(value) {
        if (value == null) {
          return '';
        }
        return String(value)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');
      },

      /**
       * Formatea una fecha para mostrar
       */
      formatDate_(value) {
        if (!value) return '—';
        
        try {
          let date;
          if (value instanceof Date) {
            date = value;
          } else if (typeof value === 'string') {
            date = new Date(value);
          } else {
            return this.escapeHtml_(value);
          }
          
          if (isNaN(date.getTime())) {
            return this.escapeHtml_(value);
          }
          
          return Utilities.formatDate(date, Session.getScriptTimeZone(), 'dd/MM/yyyy');
        } catch (error) {
          return this.escapeHtml_(value);
        }
      },

      /**
       * Obtiene un valor anidado del objeto de datos
       */
      getValue_(obj, path, defaultValue = '—') {
        if (!obj || !path) return defaultValue;
        
        const keys = path.split('.');
        let value = obj;
        
        for (const key of keys) {
          if (value == null) return defaultValue;
          value = value[key];
        }
        
        return value != null && value !== '' ? value : defaultValue;
      },

      /**
       * Formatea un valor booleano
       */
      formatBoolean_(value) {
        if (value === true || value === 'true') return 'SÍ';
        if (value === false || value === 'false') return 'NO';
        return '—';
      },

      /**
       * Construye filas de información para una tabla
       */
      buildInfoRows_(entries = []) {
        return entries
          .map(entry => {
            const label = this.escapeHtml_(entry?.label || '');
            const value = entry?.value != null ? this.escapeHtml_(entry.value) : '<span class="placeholder">—</span>';
            return `<tr><th scope="row">${label}</th><td>${value}</td></tr>`;
          })
          .join('');
      },

      /**
       * Construye filas de checklist
       */
      buildChecklistRows_(items = []) {
        return items
          .map(item => {
            const label = this.escapeHtml_(item?.label || '');
            const checked = item?.checked ? '☑' : '☐';
            return `<tr><td>${checked} ${label}</td></tr>`;
          })
          .join('');
      },

      /**
       * Prepara los datos para el PDF
       */
      buildPrintableData_(payload) {
        if (!payload) return null;

        const metadata = payload.metadata || {};
        const clienteData = payload.seccion_A_cliente || {};
        const equipoData = payload.seccion_B_equipo || {};
        const parametrosData = payload.seccion_C_parametros || {};
        const cabezalData = payload.seccion_C_cabezal || {};
        const checklistData = payload.seccion_D_checklist || {};
        const resumenData = payload.seccion_E_resumen || {};
        const condicionesData = payload.seccion_F_condiciones || {};
        const parametrosOpData = payload.seccion_B_parametros_operacion || {};
        const cierreData = payload.seccion_G_cierre || {};

        return {
          // Metadata
          numeroReporte: metadata.numero_reporte 
            || (metadata.id_unico ? metadata.id_unico.substring(0, 8).toUpperCase() : 'SIN-ID'),
          fechaRegistro: this.formatDate_(metadata.timestamp),
          tecnico: this.getValue_(clienteData, 'tecnico'),
          logo: this.resolveLogoForPdf_(),

          // Sección A - Cliente
          cliente: {
            nombre: this.getValue_(clienteData, 'nombre'),
            direccion: this.getValue_(clienteData, 'direccion'),
            localidad: this.getValue_(clienteData, 'localidad'),
            contacto: this.getValue_(clienteData, 'contacto'),
            telefono: this.getValue_(clienteData, 'telefono'),
            email: this.getValue_(clienteData, 'email'),
            cuit: this.getValue_(clienteData, 'cuit'),
            fechaServicio: this.formatDate_(clienteData.fecha_servicio)
          },

          // Sección B - Equipo
          equipo: {
            tipo: this.getValue_(equipoData, 'tipo'),
            modelo: this.getValue_(equipoData, 'modelo'),
            numeroSerie: this.getValue_(equipoData, 'numero_serie'),
            ubicacion: this.getValue_(equipoData, 'ubicacion'),
            volumenResina: this.getValue_(equipoData, 'volumen_resina'),
            tipoRegeneracion: this.getValue_(equipoData, 'tipo_regeneracion'),
            prefiltro: this.getValue_(equipoData, 'prefiltro'),
            proteccionEntrada: this.getValue_(equipoData, 'proteccion_entrada'),
            manometros: this.getValue_(equipoData, 'manometros'),
            notas: this.getValue_(equipoData, 'notas_equipo')
          },

          // Sección C - Parámetros
          parametros: {
            durezaAguaCruda: this.getValue_(parametrosData, 'dureza_agua_cruda'),
            autonomiaRestante: this.getValue_(parametrosData, 'autonomia_restante'),
            seteoAutonomia: this.getValue_(parametrosData, 'seteo_actual_autonomia'),
            aplicarProteccion: this.formatBoolean_(parametrosData.aplicar_proteccion_20),
            autonomiaRecomendada: this.getValue_(parametrosData, 'autonomia_recomendada')
          },

          // Cabezal
          cabezal: {
            horaCabezalFound: this.getValue_(cabezalData, 'hora_cabezal_as_found'),
            horaCabezalLeft: this.getValue_(cabezalData, 'hora_cabezal_as_left'),
            horaRegeneracionFound: this.getValue_(cabezalData, 'hora_regeneracion_as_found'),
            horaRegeneracionLeft: this.getValue_(cabezalData, 'hora_regeneracion_as_left'),
            p1Found: this.getValue_(cabezalData, 'p1_retrolavado_min_found'),
            p1Left: this.getValue_(cabezalData, 'p1_retrolavado_min_left'),
            p2Found: this.getValue_(cabezalData, 'p2_salmuera_min_found'),
            p2Left: this.getValue_(cabezalData, 'p2_salmuera_min_left'),
            p3Found: this.getValue_(cabezalData, 'p3_enjuague_min_found'),
            p3Left: this.getValue_(cabezalData, 'p3_enjuague_min_left'),
            p4Found: this.getValue_(cabezalData, 'p4_llenado_salero_min_found'),
            p4Left: this.getValue_(cabezalData, 'p4_llenado_salero_min_left'),
            frecuenciaFound: this.getValue_(cabezalData, 'frecuencia_dias_found'),
            frecuenciaLeft: this.getValue_(cabezalData, 'frecuencia_dias_left')
          },

          // Checklist
          checklist: {
            inspeccionFugas: this.formatBoolean_(checklistData.inspeccion_fugas),
            cambioFiltro: this.formatBoolean_(checklistData.cambio_filtro_realizado),
            filtroTipo: this.getValue_(checklistData, 'filtro_tipo_instalado'),
            filtroLote: this.getValue_(checklistData, 'filtro_lote_serie'),
            limpiezaTanque: this.formatBoolean_(checklistData.limpieza_tanque_sal),
            nivelAgua: this.formatBoolean_(checklistData.verificacion_nivel_agua),
            cargaSal: this.formatBoolean_(checklistData.carga_sal),
            verificacionHora: this.formatBoolean_(checklistData.verificacion_hora),
            parametrosCiclo: this.formatBoolean_(checklistData.verificacion_parametros_ciclo),
            ajusteAutonomia: this.formatBoolean_(checklistData.ajuste_autonomia),
            regeneracionManual: this.formatBoolean_(checklistData.regeneracion_manual),
            otros: this.getValue_(checklistData, 'otros'),
            observaciones: this.getValue_(checklistData, 'observaciones')
          },

          // Resumen
          resumen: {
            trabajoRealizado: this.getValue_(resumenData, 'trabajo_realizado'),
            recomendaciones: this.getValue_(resumenData, 'recomendaciones'),
            proximoServicio: this.formatDate_(resumenData.proximo_servicio),
            materiales: this.getValue_(resumenData, 'materiales'),
            comentariosCliente: this.getValue_(resumenData, 'comentarios_cliente')
          },

          // Condiciones
          condiciones: {
            presionEntradaFound: this.getValue_(condicionesData, 'presion_entrada_as_found'),
            presionEntradaLeft: this.getValue_(condicionesData, 'presion_entrada_as_left'),
            presionSalidaFound: this.getValue_(condicionesData, 'presion_salida_as_found'),
            presionSalidaLeft: this.getValue_(condicionesData, 'presion_salida_as_left'),
            nivelSalFound: this.getValue_(condicionesData, 'nivel_sal_as_found'),
            nivelSalLeft: this.getValue_(condicionesData, 'nivel_sal_as_left'),
            temperatura: this.getValue_(condicionesData, 'temperatura_ambiente'),
            estadoGabinete: this.getValue_(condicionesData, 'estado_gabinete'),
            observaciones: this.getValue_(condicionesData, 'observaciones')
          },

          // Parámetros Operación
          parametrosOp: {
            testCloroFound: this.getValue_(parametrosOpData, 'test_cloro_entrada_as_found'),
            testCloroLeft: this.getValue_(parametrosOpData, 'test_cloro_entrada_as_left'),
            durezaSalidaFound: this.getValue_(parametrosOpData, 'dureza_salida_as_found'),
            durezaSalidaLeft: this.getValue_(parametrosOpData, 'dureza_salida_as_left')
          },

          // Cierre
          cierre: {
            conformidad: this.getValue_(cierreData, 'conformidad_cliente'),
            representante: this.getValue_(cierreData, 'representante_cliente'),
            medioConfirmacion: this.getValue_(cierreData, 'medio_confirmacion'),
            requiereSeguimiento: this.formatBoolean_(cierreData.requiere_seguimiento),
            observaciones: this.getValue_(cierreData, 'observaciones_finales')
          }
        };
      },

      /**
       * Construye el HTML del PDF
       */
      buildPdfHtml_(data) {
        if (!data) return '';

        const logo = data.logo ? `<img src="${this.escapeHtml_(data.logo)}" alt="OBM División Aguas">` : '';

        return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reporte Mantenimiento Ablandador - ${this.escapeHtml_(data.numeroReporte)}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 11px;
      line-height: 1.4;
      color: #1f2937;
      background: #f3f4f6;
      padding: 20px;
    }

    .document {
      max-width: 750px;
      margin: 0 auto;
      background: #ffffff;
      padding: 32px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .document__header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 2px solid #3b82f6;
    }

    .document__identity h1 {
      font-size: 18px;
      font-weight: 700;
      color: #1f2937;
      margin-bottom: 4px;
    }

    .document__meta {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      color: #6b7280;
      font-size: 10px;
      font-weight: 600;
    }

    .document__logo {
      flex: none;
      max-width: 120px;
    }

    .document__logo img {
      width: 100%;
      height: auto;
      display: block;
    }

    .section {
      margin-bottom: 20px;
      page-break-inside: avoid;
    }

    .section__title {
      font-size: 13px;
      font-weight: 700;
      margin-bottom: 10px;
      color: #1f2937;
      background: #f3f4f6;
      padding: 6px 10px;
      border-left: 3px solid #3b82f6;
    }

    .info-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
    }

    .info-table th {
      text-align: left;
      font-weight: 600;
      color: #4b5563;
      padding: 6px 8px;
      width: 35%;
      background: #f9fafb;
      border: 1px solid #e5e7eb;
    }

    .info-table td {
      padding: 6px 8px;
      color: #1f2937;
      border: 1px solid #e5e7eb;
    }

    .comparison-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
    }

    .comparison-table th {
      text-align: center;
      font-weight: 600;
      color: #4b5563;
      padding: 6px 8px;
      background: #f3f4f6;
      border: 1px solid #e5e7eb;
    }

    .comparison-table td {
      padding: 6px 8px;
      text-align: center;
      border: 1px solid #e5e7eb;
    }

    .comparison-table td:first-child {
      text-align: left;
      font-weight: 600;
      background: #f9fafb;
    }

    .checklist-table {
      width: 100%;
      border-collapse: collapse;
    }

    .checklist-table td {
      padding: 5px 8px;
      border: 1px solid #e5e7eb;
    }

    .text-block {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      padding: 10px;
      border-radius: 4px;
      white-space: pre-wrap;
      word-wrap: break-word;
    }

    .placeholder {
      color: #9ca3af;
      font-style: italic;
    }

    .document__footer {
      margin-top: 32px;
      padding-top: 16px;
      border-top: 1px solid #e5e7eb;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
    }

    .firma {
      text-align: center;
      padding-top: 40px;
      border-top: 1px solid #9ca3af;
    }

    .firma__label {
      color: #6b7280;
      font-size: 10px;
      font-weight: 600;
    }

    @media print {
      body {
        background: #ffffff;
        padding: 0;
      }

      .document {
        box-shadow: none;
        padding: 20px;
      }

      .section {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="document">
    <!-- Header -->
    <header class="document__header">
      <div class="document__identity">
        <h1>Reporte de Mantenimiento Preventivo - Ablandador</h1>
        <div class="document__meta">
          <span>Reporte N° ${this.escapeHtml_(data.numeroReporte)}</span>
          <span>Fecha: ${this.escapeHtml_(data.fechaRegistro)}</span>
          <span>Técnico: ${this.escapeHtml_(data.tecnico)}</span>
        </div>
      </div>
      <div class="document__logo">
        ${logo}
      </div>
    </header>

    <!-- Sección A: Cliente -->
    <section class="section">
      <h2 class="section__title">A. Información del Cliente</h2>
      <table class="info-table">
        <tbody>
          ${this.buildInfoRows_([
            { label: 'Cliente', value: data.cliente.nombre },
            { label: 'Dirección', value: data.cliente.direccion },
            { label: 'Localidad', value: data.cliente.localidad },
            { label: 'Contacto', value: data.cliente.contacto },
            { label: 'Teléfono', value: data.cliente.telefono },
            { label: 'Email', value: data.cliente.email },
            { label: 'CUIT', value: data.cliente.cuit },
            { label: 'Fecha de Servicio', value: data.cliente.fechaServicio }
          ])}
        </tbody>
      </table>
    </section>

    <!-- Sección B: Equipo -->
    <section class="section">
      <h2 class="section__title">B. Información del Equipo</h2>
      <table class="info-table">
        <tbody>
          ${this.buildInfoRows_([
            { label: 'Tipo', value: data.equipo.tipo },
            { label: 'Modelo', value: data.equipo.modelo },
            { label: 'N° Serie', value: data.equipo.numeroSerie },
            { label: 'Ubicación', value: data.equipo.ubicacion },
            { label: 'Volumen Resina (L)', value: data.equipo.volumenResina },
            { label: 'Tipo Regeneración', value: data.equipo.tipoRegeneracion },
            { label: 'Prefiltro', value: data.equipo.prefiltro },
            { label: 'Protección Entrada', value: data.equipo.proteccionEntrada },
            { label: 'Manómetros', value: data.equipo.manometros }
          ])}
        </tbody>
      </table>
      ${data.equipo.notas !== '—' ? `<div class="text-block">${this.escapeHtml_(data.equipo.notas)}</div>` : ''}
    </section>

    <!-- Sección C: Parámetros -->
    <section class="section">
      <h2 class="section__title">C. Parámetros del Agua</h2>
      <table class="info-table">
        <tbody>
          ${this.buildInfoRows_([
            { label: 'Dureza Agua Cruda (ppm)', value: data.parametros.durezaAguaCruda },
            { label: 'Autonomía Restante (m³)', value: data.parametros.autonomiaRestante },
            { label: 'Seteo Autonomía (m³)', value: data.parametros.seteoAutonomia },
            { label: 'Aplicar Protección 20%', value: data.parametros.aplicarProteccion },
            { label: 'Autonomía Recomendada (m³)', value: data.parametros.autonomiaRecomendada }
          ])}
        </tbody>
      </table>
    </section>

    <!-- Cabezal -->
    <section class="section">
      <h2 class="section__title">C. Configuración del Cabezal</h2>
      <table class="comparison-table">
        <thead>
          <tr>
            <th>Parámetro</th>
            <th>Como se Encontró</th>
            <th>Como se Dejó</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Hora Cabezal</td>
            <td>${this.escapeHtml_(data.cabezal.horaCabezalFound)}</td>
            <td>${this.escapeHtml_(data.cabezal.horaCabezalLeft)}</td>
          </tr>
          <tr>
            <td>Hora Regeneración</td>
            <td>${this.escapeHtml_(data.cabezal.horaRegeneracionFound)}</td>
            <td>${this.escapeHtml_(data.cabezal.horaRegeneracionLeft)}</td>
          </tr>
          <tr>
            <td>P1 - Retrolavado (min)</td>
            <td>${this.escapeHtml_(data.cabezal.p1Found)}</td>
            <td>${this.escapeHtml_(data.cabezal.p1Left)}</td>
          </tr>
          <tr>
            <td>P2 - Salmuera (min)</td>
            <td>${this.escapeHtml_(data.cabezal.p2Found)}</td>
            <td>${this.escapeHtml_(data.cabezal.p2Left)}</td>
          </tr>
          <tr>
            <td>P3 - Enjuague (min)</td>
            <td>${this.escapeHtml_(data.cabezal.p3Found)}</td>
            <td>${this.escapeHtml_(data.cabezal.p3Left)}</td>
          </tr>
          <tr>
            <td>P4 - Llenado Salero (min)</td>
            <td>${this.escapeHtml_(data.cabezal.p4Found)}</td>
            <td>${this.escapeHtml_(data.cabezal.p4Left)}</td>
          </tr>
          <tr>
            <td>Frecuencia (días)</td>
            <td>${this.escapeHtml_(data.cabezal.frecuenciaFound)}</td>
            <td>${this.escapeHtml_(data.cabezal.frecuenciaLeft)}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- Sección D: Checklist -->
    <section class="section">
      <h2 class="section__title">D. Checklist de Mantenimiento</h2>
      <table class="checklist-table">
        <tbody>
          <tr><td>${data.checklist.inspeccionFugas === 'SÍ' ? '☑' : '☐'} Inspección de fugas</td></tr>
          <tr><td>${data.checklist.cambioFiltro === 'SÍ' ? '☑' : '☐'} Cambio de prefiltro</td></tr>
          ${data.checklist.filtroTipo !== '—' ? `<tr><td style="padding-left: 24px;">Tipo: ${this.escapeHtml_(data.checklist.filtroTipo)}</td></tr>` : ''}
          ${data.checklist.filtroLote !== '—' ? `<tr><td style="padding-left: 24px;">Lote/Serie: ${this.escapeHtml_(data.checklist.filtroLote)}</td></tr>` : ''}
          <tr><td>${data.checklist.limpiezaTanque === 'SÍ' ? '☑' : '☐'} Limpieza tanque de sal</td></tr>
          <tr><td>${data.checklist.nivelAgua === 'SÍ' ? '☑' : '☐'} Verificación nivel de agua</td></tr>
          <tr><td>${data.checklist.cargaSal === 'SÍ' ? '☑' : '☐'} Carga de sal</td></tr>
          <tr><td>${data.checklist.verificacionHora === 'SÍ' ? '☑' : '☐'} Verificación de hora</td></tr>
          <tr><td>${data.checklist.parametrosCiclo === 'SÍ' ? '☑' : '☐'} Verificación parámetros de ciclo</td></tr>
          <tr><td>${data.checklist.ajusteAutonomia === 'SÍ' ? '☑' : '☐'} Ajuste de autonomía</td></tr>
          <tr><td>${data.checklist.regeneracionManual === 'SÍ' ? '☑' : '☐'} Regeneración manual</td></tr>
        </tbody>
      </table>
      ${data.checklist.otros !== '—' ? `<p style="margin-top: 8px;"><strong>Otros:</strong> ${this.escapeHtml_(data.checklist.otros)}</p>` : ''}
      ${data.checklist.observaciones !== '—' ? `<div class="text-block" style="margin-top: 8px;">${this.escapeHtml_(data.checklist.observaciones)}</div>` : ''}
    </section>

    <!-- Sección E: Resumen -->
    <section class="section">
      <h2 class="section__title">E. Resumen del Servicio</h2>
      ${data.resumen.trabajoRealizado !== '—' ? `
      <p style="margin-bottom: 8px;"><strong>Trabajo Realizado:</strong></p>
      <div class="text-block">${this.escapeHtml_(data.resumen.trabajoRealizado)}</div>
      ` : ''}
      ${data.resumen.recomendaciones !== '—' ? `
      <p style="margin: 12px 0 8px;"><strong>Recomendaciones:</strong></p>
      <div class="text-block">${this.escapeHtml_(data.resumen.recomendaciones)}</div>
      ` : ''}
      <table class="info-table" style="margin-top: 12px;">
        <tbody>
          ${this.buildInfoRows_([
            { label: 'Próximo Servicio', value: data.resumen.proximoServicio },
            { label: 'Materiales Utilizados', value: data.resumen.materiales },
            { label: 'Comentarios Cliente', value: data.resumen.comentariosCliente }
          ])}
        </tbody>
      </table>
    </section>

    <!-- Sección F: Condiciones -->
    <section class="section">
      <h2 class="section__title">F. Condiciones Operativas</h2>
      <table class="comparison-table">
        <thead>
          <tr>
            <th>Parámetro</th>
            <th>Como se Encontró</th>
            <th>Como se Dejó</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Presión Entrada (bar)</td>
            <td>${this.escapeHtml_(data.condiciones.presionEntradaFound)}</td>
            <td>${this.escapeHtml_(data.condiciones.presionEntradaLeft)}</td>
          </tr>
          <tr>
            <td>Presión Salida (bar)</td>
            <td>${this.escapeHtml_(data.condiciones.presionSalidaFound)}</td>
            <td>${this.escapeHtml_(data.condiciones.presionSalidaLeft)}</td>
          </tr>
          <tr>
            <td>Nivel de Sal</td>
            <td>${this.escapeHtml_(data.condiciones.nivelSalFound)}</td>
            <td>${this.escapeHtml_(data.condiciones.nivelSalLeft)}</td>
          </tr>
          <tr>
            <td>Test Cloro (ppm)</td>
            <td>${this.escapeHtml_(data.parametrosOp.testCloroFound)}</td>
            <td>${this.escapeHtml_(data.parametrosOp.testCloroLeft)}</td>
          </tr>
          <tr>
            <td>Dureza Salida (ppm)</td>
            <td>${this.escapeHtml_(data.parametrosOp.durezaSalidaFound)}</td>
            <td>${this.escapeHtml_(data.parametrosOp.durezaSalidaLeft)}</td>
          </tr>
        </tbody>
      </table>
      <table class="info-table" style="margin-top: 12px;">
        <tbody>
          ${this.buildInfoRows_([
            { label: 'Temperatura Ambiente', value: data.condiciones.temperatura },
            { label: 'Estado Gabinete', value: data.condiciones.estadoGabinete }
          ])}
        </tbody>
      </table>
      ${data.condiciones.observaciones !== '—' ? `<div class="text-block" style="margin-top: 8px;">${this.escapeHtml_(data.condiciones.observaciones)}</div>` : ''}
    </section>

    <!-- Sección G: Cierre -->
    <section class="section">
      <h2 class="section__title">G. Cierre y Conformidad</h2>
      <table class="info-table">
        <tbody>
          ${this.buildInfoRows_([
            { label: 'Conformidad Cliente', value: data.cierre.conformidad },
            { label: 'Representante Cliente', value: data.cierre.representante },
            { label: 'Medio de Confirmación', value: data.cierre.medioConfirmacion },
            { label: 'Requiere Seguimiento', value: data.cierre.requiereSeguimiento }
          ])}
        </tbody>
      </table>
      ${data.cierre.observaciones !== '—' ? `<div class="text-block" style="margin-top: 8px;">${this.escapeHtml_(data.cierre.observaciones)}</div>` : ''}
    </section>

    <!-- Footer con firmas -->
    <footer class="document__footer">
      <div class="firma">
        <div class="firma__label">Firma del Técnico</div>
      </div>
      <div class="firma">
        <div class="firma__label">Firma y Aclaración del Cliente</div>
      </div>
    </footer>
  </div>
</body>
</html>`;
      },

      /**
       * Genera el PDF como Blob
       */
      buildPdfBlob_(payload) {
        try {
          const printableData = this.buildPrintableData_(payload);
          if (!printableData) {
            return null;
          }

          const html = this.buildPdfHtml_(printableData);
          if (!html) {
            return null;
          }

          const htmlOutput = HtmlService.createHtmlOutput(html).setWidth(794).setHeight(1123);
          const pdfBlob = htmlOutput.getAs('application/pdf');
          const numeroReporte = printableData.numeroReporte || 'SIN-ID';
          pdfBlob.setName(`Ablandador-${numeroReporte}.pdf`);
          return pdfBlob;
        } catch (error) {
          Logger.log('Error generando PDF de ablandador: %s', error);
          return null;
        }
      },

      /**
       * Guarda el PDF en Drive
       */
      savePdfToDrive_(pdfBlob, numeroReporte) {
        if (!pdfBlob) {
          return null;
        }

        const folder = this.getPdfFolder_();
        if (!folder) {
          Logger.log('No hay carpeta configurada para guardar PDFs de ablandadores');
          return null;
        }

        try {
          const blob = pdfBlob.copyBlob();
          const filename = blob.getName() || `Ablandador-${numeroReporte || 'sin-id'}.pdf`;
          blob.setName(filename);
          const file = folder.createFile(blob);
          
          try {
            file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
          } catch (shareErr) {
            Logger.log('No se pudo cambiar el sharing del PDF %s: %s', file.getId(), shareErr);
          }
          
          Logger.log('PDF de ablandador guardado en Drive con ID %s', file.getId());
          return {
            fileId: file.getId(),
            fileName: filename,
            url: file.getUrl()
          };
        } catch (error) {
          Logger.log('Error guardando PDF en Drive: %s', error);
          return null;
        }
      },

      /**
       * Genera y guarda el PDF completo
       */
      generarPdf(payload) {
        if (!payload || !payload.metadata) {
          throw new Error('Datos del reporte inválidos');
        }

        const pdfBlob = this.buildPdfBlob_(payload);
        if (!pdfBlob) {
          throw new Error('No se pudo generar el PDF');
        }

        // Usar numero_reporte si está disponible, sino usar los primeros 8 del UUID
        const numeroReporte = payload.metadata.numero_reporte 
          || (payload.metadata.id_unico ? payload.metadata.id_unico.substring(0, 8).toUpperCase() : 'SIN-ID');

        const driveInfo = this.savePdfToDrive_(pdfBlob, numeroReporte);

        return {
          success: true,
          numeroReporte: numeroReporte,
          pdfGenerated: true,
          drive: driveInfo || { saved: false, message: 'No se configuró carpeta de Drive' }
        };
      }
    };

    ns.SoftenerPdfService = SoftenerPdfService;
  })(global.OBM = global.OBM || {});
})(typeof window !== 'undefined' ? window : this);
