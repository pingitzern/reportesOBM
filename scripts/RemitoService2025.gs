(function(global) {
  (function(ns) {
    'use strict';

// Contenido para RemitoService.gs
const REMITO_FOTOS_FOLDER_ID = '1SH7Zz7g_2sbYsFHMfVQj3Admdy8L3FVz';
const MAX_REMITO_FOTOS = 4;
const COMPONENT_STAGE_TITLES = {
  etapa1: '1ª Sedimentos (PP)',
  etapa2: '2ª Carbón Bloque (CTO)',
  etapa3: '3ª Carbón GAC / PP',
  etapa4: '4ª Membrana RO',
  etapa5: '5ª Post-Filtro',
  etapa6: '6ª Adicional'
};

const REPLACEMENT_KEYWORDS = ['cambi', 'reempl', 'instal', 'nuevo'];

const REMITO_NOTIFICATIONS_EMAIL = 'pingitzernicolas@gmail.com';

// Carpeta de Drive donde se guardarán automáticamente los PDF de remitos.
// Configurar con el ID correspondiente o dejar vacío para deshabilitar el guardado automático.
// Actualizado para apuntar a la carpeta proporcionada por el usuario.
const REMITO_PDF_FOLDER_ID = '1BKBPmndOGet7yVZ4UtFCkhrt402eXH4X';

const REMITO_PDF_LOGO_URL = 'https://raw.githubusercontent.com/pingitzer/reportesOBM/main/frontend/public/OHM-agua.png';

const RemitoService = {
  fotosFolderCache: null,
  pdfFolderCache: null,
  photoDataCache: Object.create(null),
  logoDataCache: Object.create(null),

  getFotosFolder_() {
    if (!REMITO_FOTOS_FOLDER_ID) {
      throw new Error('Configura el ID de la carpeta de fotos de remitos antes de subir imágenes.');
    }

    if (this.fotosFolderCache) {
      return this.fotosFolderCache;
    }

    try {
      this.fotosFolderCache = DriveApp.getFolderById(REMITO_FOTOS_FOLDER_ID);
    } catch (error) {
      throw new Error('No se pudo acceder a la carpeta configurada para las fotos de los remitos.');
    }

    return this.fotosFolderCache;
  },

  normalizeOutputValue_(value) {
    if (value === null || value === undefined) {
      return '';
    }
    if (value instanceof Date) {
      return this.formatDateForOutput_(value);
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
    if (typeof value === 'string') {
      return value.trim();
    }
    return String(value);
  },

  formatDateForOutput_(value) {
    if (value instanceof Date) {
      return Utilities.formatDate(value, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return this.formatDateForOutput_(new Date(value));
    }
    if (typeof value === 'string') {
      return value.trim();
    }
    return '';
  },

  getDirectDriveImageUrl_(fileId) {
    if (!fileId) {
      return '';
    }

    const trimmedId = String(fileId).trim();
    if (!trimmedId) {
      return '';
    }

    return `https://drive.google.com/uc?export=view&id=${encodeURIComponent(trimmedId)}`;
  },

  getPhotoDataUrlFromFileId_(fileId) {
    const trimmedId = this.normalizeString_(fileId);
    if (!trimmedId) {
      return '';
    }

    const cached = this.photoDataCache[trimmedId];
    if (cached !== undefined) {
      return cached;
    }

    try {
      const file = DriveApp.getFileById(trimmedId);
      const blob = file.getBlob();
      const contentType = blob.getContentType() || 'image/jpeg';
      const base64 = Utilities.base64Encode(blob.getBytes());
      const dataUrl = `data:${contentType};base64,${base64}`;
      this.photoDataCache[trimmedId] = dataUrl;
      return dataUrl;
    } catch (error) {
      Logger.log('No se pudo obtener la foto %s para el PDF del remito: %s', trimmedId, error);
      this.photoDataCache[trimmedId] = '';
      return '';
    }
  },

  resolveLogoForPdf_(source) {
    const candidates = [];
    const pushCandidate = (value) => {
      const normalized = this.normalizeString_(value);
      if (normalized && !candidates.includes(normalized)) {
        candidates.push(normalized);
      }
    };

    pushCandidate(source);
    pushCandidate(REMITO_PDF_LOGO_URL);

    for (let index = 0; index < candidates.length; index += 1) {
      const candidate = candidates[index];
      if (!candidate) {
        continue;
      }

      if (candidate.startsWith('data:')) {
        this.logoDataCache[candidate] = candidate;
        return candidate;
      }

      if (this.logoDataCache[candidate] !== undefined) {
        if (this.logoDataCache[candidate]) {
          return this.logoDataCache[candidate];
        }
        continue;
      }

      try {
        const response = UrlFetchApp.fetch(candidate, {
          muteHttpExceptions: true,
          followRedirects: true,
        });
        const status = response.getResponseCode();
        if (status >= 200 && status < 300) {
          const blob = response.getBlob();
          const contentType = blob.getContentType() || 'image/png';
          const base64 = Utilities.base64Encode(blob.getBytes());
          const dataUrl = `data:${contentType};base64,${base64}`;
          this.logoDataCache[candidate] = dataUrl;
          return dataUrl;
        }
      } catch (error) {
        Logger.log('No se pudo obtener el logo del remito desde %s: %s', candidate, error);
      }

      this.logoDataCache[candidate] = '';
    }

    return '';
  },

  extractDriveFileIdFromValue_(value) {
    if (value === null || value === undefined) {
      return '';
    }

    const text = String(value).trim();
    if (!text || text.startsWith('data:')) {
      return '';
    }

    const directMatch = text.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (directMatch && directMatch[1]) {
      return directMatch[1];
    }

    const pathMatch = text.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (pathMatch && pathMatch[1]) {
      return pathMatch[1];
    }

    if (/^[a-zA-Z0-9_-]{10,}$/.test(text)) {
      return text;
    }

    return '';
  },

  normalizeDriveUrl_(value) {
    if (value === null || value === undefined) {
      return '';
    }

    const text = String(value).trim();
    if (!text) {
      return '';
    }

    if (text.startsWith('data:')) {
      return text;
    }

    const fileId = this.extractDriveFileIdFromValue_(text);
    if (fileId) {
      return this.getDirectDriveImageUrl_(fileId);
    }

    return text;
  },

  normalizeString_(value) {
    const normalized = this.normalizeOutputValue_(value);
    return typeof normalized === 'string' ? normalized : '';
  },

  escapeHtml_(value) {
    const text = this.normalizeString_(value);
    if (!text) {
      return '';
    }

    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };

    return text.replace(/[&<>"']/g, char => map[char] || char);
  },

  formatDateForDisplay_(value, { includeTime = false } = {}) {
    if (!value) {
      return '';
    }

    const date = value instanceof Date ? value : new Date(value);
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
      return '';
    }

    const pattern = includeTime ? 'dd/MM/yyyy HH:mm' : 'dd/MM/yyyy';
    return Utilities.formatDate(date, Session.getScriptTimeZone(), pattern);
  },

  hasContent_(value) {
    return Boolean(this.normalizeString_(value));
  },

  getNestedValue_(data, path) {
    if (!path) {
      return undefined;
    }

    const segments = String(path).split('.');
    let current = data;

    for (let index = 0; index < segments.length; index += 1) {
      if (current === null || typeof current !== 'object') {
        return undefined;
      }

      const segment = segments[index];
      current = current[segment];
    }

    return current;
  },

  resolveRemitoValue_(remito, keys) {
    if (!remito || typeof remito !== 'object') {
      return '';
    }

    const list = Array.isArray(keys) ? keys : [keys];
    for (let index = 0; index < list.length; index += 1) {
      const value = this.getNestedValue_(remito, list[index]);
      const normalized = this.normalizeString_(value);
      if (normalized) {
        return normalized;
      }
    }

    return '';
  },

  buildRepuestosFromReporteData_(reporteData) {
    const repuestos = [];

    if (Array.isArray(reporteData?.repuestos)) {
      repuestos.push(...reporteData.repuestos);
    }

    if (Array.isArray(reporteData?.componentes)) {
      repuestos.push(...reporteData.componentes);
    }

    if (Array.isArray(reporteData?.RepuestosDetalle)) {
      repuestos.push(...reporteData.RepuestosDetalle);
    }

    if (repuestos.length === 0) {
      repuestos.push(...this.buildComponentesFromRemitoData_(reporteData));
    }

    return repuestos
      .map(item => this.normalizeRepuestoItem_(item))
      .filter(item => item && (this.hasContent_(item.codigo) || this.hasContent_(item.descripcion) || this.hasContent_(item.cantidad)));
  },

  buildRepuestosSummary_(items) {
    if (!Array.isArray(items) || items.length === 0) {
      return 'No se reemplazaron componentes.';
    }

    const resumen = items
      .map(item => {
        if (!item || typeof item !== 'object') {
          return '';
        }

        const parts = [];
        if (this.hasContent_(item.codigo)) {
          parts.push(`Código: ${this.normalizeString_(item.codigo)}`);
        }
        if (this.hasContent_(item.descripcion)) {
          parts.push(this.normalizeString_(item.descripcion));
        }
        if (this.hasContent_(item.cantidad)) {
          parts.push(`Cantidad: ${this.normalizeString_(item.cantidad)}`);
        }

        return parts.join(' - ');
      })
      .filter(Boolean)
      .join('\n');

    return resumen || 'No se reemplazaron componentes.';
  },

  buildComponentesFromRemitoData_(remitoData) {
    if (!remitoData || typeof remitoData !== 'object') {
      return [];
    }

    return Object.keys(COMPONENT_STAGE_TITLES).reduce((acc, etapaId) => {
      const accionKey = `${etapaId}_accion`;
      const detallesKey = `${etapaId}_detalles`;
      const accion = this.normalizeString_(remitoData[accionKey]);
      const detalles = this.normalizeString_(remitoData[detallesKey]);

      if (!this.isReplacementAction_(accion)) {
        return acc;
      }

      acc.push({
        accion,
        detalles,
        title: COMPONENT_STAGE_TITLES[etapaId] || etapaId
      });
      return acc;
    }, []);
  },

  normalizeRepuestoItem_(item) {
    if (!item || typeof item !== 'object') {
      return null;
    }

    const codigo = this.normalizeString_(item.codigo || item.id || item.codigo_repuesto || item.cod || item.codigoArticulo);
    const descripcion = this.buildRepuestoDescripcion_(item);
    const cantidadRaw = item.cantidad !== undefined ? item.cantidad : (item.cant !== undefined ? item.cant : item.unidades);
    let cantidad = this.normalizeString_(cantidadRaw);

    if (cantidad) {
      const parsed = Number(String(cantidad).replace(',', '.'));
      if (Number.isFinite(parsed) && !Number.isNaN(parsed)) {
        cantidad = String(parsed);
      }
    }

    if (!this.hasContent_(codigo) && !this.hasContent_(descripcion) && !this.hasContent_(cantidad)) {
      return null;
    }

    return { codigo: codigo || '', descripcion: descripcion || '', cantidad: cantidad || '' };
  },

  buildRepuestoDescripcion_(item) {
    return [item.descripcion, item.detalle, item.detalles, item.title, item.nombre]
      .map(value => this.normalizeString_(value))
      .filter(Boolean)
      .join(' - ');
  },

  isReplacementAction_(value) {
    const text = this.normalizeString_(value).toLowerCase();
    if (!text) {
      return false;
    }

    return REPLACEMENT_KEYWORDS.some(keyword => text.includes(keyword));
  },


  buildRepuestosFromReporteData_(reporteData) {
    const repuestos = [];

    if (Array.isArray(reporteData?.repuestos)) {
      repuestos.push(...reporteData.repuestos);
    }

    if (Array.isArray(reporteData?.componentes)) {
      repuestos.push(...reporteData.componentes);
    }

    if (Array.isArray(reporteData?.RepuestosDetalle)) {
      repuestos.push(...reporteData.RepuestosDetalle);
    }

    if (repuestos.length === 0) {
      repuestos.push(...this.buildComponentesFromRemitoData_(reporteData));
    }

    return repuestos
      .map(item => this.normalizeRepuestoItem_(item))
      .filter(item => item && (this.hasContent_(item.codigo) || this.hasContent_(item.descripcion) || this.hasContent_(item.cantidad)));
  },

  buildRepuestosSummary_(items) {
    if (!Array.isArray(items) || items.length === 0) {
      return 'No se reemplazaron componentes.';
    }

    const resumen = items
      .map(item => {
        if (!item || typeof item !== 'object') {
          return '';
        }

        const parts = [];
        if (this.hasContent_(item.codigo)) {
          parts.push(`Código: ${this.normalizeString_(item.codigo)}`);
        }
        if (this.hasContent_(item.descripcion)) {
          parts.push(this.normalizeString_(item.descripcion));
        }
        if (this.hasContent_(item.cantidad)) {
          parts.push(`Cantidad: ${this.normalizeString_(item.cantidad)}`);
        }

        return parts.join(' - ');
      })
      .filter(Boolean)
      .join('\n');

    return resumen || 'No se reemplazaron componentes.';
  },

  buildComponentesFromRemitoData_(remitoData) {
    if (!remitoData || typeof remitoData !== 'object') {
      return [];
    }

    return Object.keys(COMPONENT_STAGE_TITLES).reduce((acc, etapaId) => {
      const accionKey = `${etapaId}_accion`;
      const detallesKey = `${etapaId}_detalles`;
      const accion = this.normalizeString_(remitoData[accionKey]);
      const detalles = this.normalizeString_(remitoData[detallesKey]);

      if (!this.isReplacementAction_(accion)) {
        return acc;
      }

      acc.push({
        accion,
        detalles,
        title: COMPONENT_STAGE_TITLES[etapaId] || etapaId
      });
      return acc;
    }, []);
  },

  normalizeRepuestoItem_(item) {
    if (!item || typeof item !== 'object') {
      return null;
    }

    const codigo = this.normalizeString_(item.codigo || item.id || item.codigo_repuesto || item.cod || item.codigoArticulo);
    const descripcion = this.buildRepuestoDescripcion_(item);
    const cantidadRaw = item.cantidad !== undefined ? item.cantidad : (item.cant !== undefined ? item.cant : item.unidades);
    let cantidad = this.normalizeString_(cantidadRaw);

    if (cantidad) {
      const parsed = Number(String(cantidad).replace(',', '.'));
      if (Number.isFinite(parsed) && !Number.isNaN(parsed)) {
        cantidad = String(parsed);
      }
    }

    if (!this.hasContent_(codigo) && !this.hasContent_(descripcion) && !this.hasContent_(cantidad)) {
      return null;
    }

    return { codigo: codigo || '', descripcion: descripcion || '', cantidad: cantidad || '' };
  },

  buildRepuestoDescripcion_(item) {
    return [item.descripcion, item.detalle, item.detalles, item.title, item.nombre]
      .map(value => this.normalizeString_(value))
      .filter(Boolean)
      .join(' - ');
  },

  isReplacementAction_(value) {
    const text = this.normalizeString_(value).toLowerCase();
    if (!text) {
      return false;
    }

    return REPLACEMENT_KEYWORDS.some(keyword => text.includes(keyword));
  },





  guessExtension_(mimeType) {
    if (!mimeType || typeof mimeType !== 'string') {
      return 'jpg';
    }

    const normalized = mimeType.trim().toLowerCase();
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

  sanitizeFileName_(fileName, numeroRemito, index, mimeType) {
    const fallbackBase = (numeroRemito || 'remito').replace(/[^A-Za-z0-9_-]+/g, '-');
    const baseName = (typeof fileName === 'string' && fileName.trim()
      ? fileName.trim()
      : `${fallbackBase}-foto-${index + 1}`)
      .replace(/[/\\]/g, '-');

    const extension = this.guessExtension_(mimeType);
    const normalized = baseName.replace(/[^A-Za-z0-9._-]+/g, '_');
    if (normalized.toLowerCase().endsWith(`.${extension}`)) {
      return normalized;
    }

    const withoutExistingExtension = normalized.replace(/\.[^.]+$/, '');
    return `${withoutExistingExtension}.${extension}`;
  },

  extractBase64Data_(value) {
    if (value === null || value === undefined) {
      return '';
    }

    const text = String(value).trim();
    if (!text) {
      return '';
    }

    const commaIndex = text.indexOf(',');
    if (commaIndex !== -1) {
      return text.slice(commaIndex + 1);
    }

    return text;
  },

  procesarFotos_(fotos, numeroRemito, idUnico) {
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

      const base64Data = this.extractBase64Data_(foto.base64Data || foto.data || foto.contenido);
      const existingId = this.extractDriveFileIdFromValue_(
        foto.driveFileId || foto.driveId || foto.fileId || foto.id || foto.url
      );

      if (!base64Data) {
        resultados[i] = existingId;
        continue;
      }

      if (!folder) {
        folder = this.getFotosFolder_();
      }

      const mimeType = typeof foto.mimeType === 'string' && foto.mimeType.trim()
        ? foto.mimeType.trim()
        : 'image/jpeg';

      const uniqueBase = numeroRemito || idUnico || 'remito';
      const fileName = this.sanitizeFileName_(foto.fileName, uniqueBase, i, mimeType);

      let blob;
      try {
        blob = Utilities.newBlob(Utilities.base64Decode(base64Data), mimeType, fileName);
      } catch (error) {
        throw new Error(`No se pudo procesar la foto ${i + 1}: ${error.message}`);
      }

      try {
        const file = folder.createFile(blob);
        const fileId = file.getId();
        try {
          const renamed = this.buildPhotoFileNameFromId_(fileId, uniqueBase, i, mimeType);
          file.setName(renamed);
        } catch (renameError) {
          Logger.log('No se pudo renombrar la foto %s (%s): %s', i + 1, fileId, renameError);
        }
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        resultados[i] = fileId;
      } catch (error) {
        throw new Error(`No se pudo guardar la foto ${i + 1} en Drive: ${error.message}`);
      }
    }

    return resultados;
  },

  buildPhotoFileNameFromId_(fileId, uniqueBase, index, mimeType) {
    const safeBase = (uniqueBase || 'remito').replace(/[^A-Za-z0-9_-]+/g, '-');
    const extension = this.guessExtension_(mimeType);
    const safeId = String(fileId || '').replace(/[^A-Za-z0-9_-]+/g, '');
    const paddedIndex = String(index + 1).padStart(2, '0');
    return `${safeBase}-foto-${paddedIndex}-${safeId}.${extension}`;
  },

  /**
   * Prepara los datos para un nuevo remito a partir de un reporte existente.
   * Y lo guarda en la hoja de remitos.
   *
   * @param {object} reporteData - Objeto con los datos del reporte de mantenimiento.
   * @param {string} observaciones - Las observaciones ingresadas por el técnico para el remito.
   * @param {string} usuarioMail - El mail del técnico que crea el remito.
   * @param {Array<object>} [fotos] - Lista de fotos capturadas o subidas desde el dispositivo.
   * @returns {object} - Un objeto representando el remito con su número asignado.
   */
  crearRemito(reporteData, observaciones, usuarioMail, fotos) {
    // 1. Generar datos únicos para el remito
    const siguienteNumero = ns.RemitoRepository.getNextRemitoNumber();
    const fechaCreacion = new Date();
    const idUnico = Utilities.getUuid(); // Un ID único para el registro del remito

    // 2. Normalizar los repuestos del reporte para almacenarlos y utilizarlos en el remito
    const repuestosDetalle = this.buildRepuestosFromReporteData_(reporteData);
    const repuestosTexto = this.buildRepuestosSummary_(repuestosDetalle);

    // 3. Construir el objeto del remito con todos los datos
    const remito = {
      NumeroRemito: siguienteNumero,
      FechaCreacion: fechaCreacion,
      MailTecnico: usuarioMail,
      NumeroReporte: reporteData.numero_reporte || '', // Usar el número de reporte del objeto data
      NombreCliente: reporteData.cliente,
      Direccion: reporteData.direccion,
      CUIT: reporteData.cliente_cuit || '',
      Telefono: reporteData.cliente_telefono || '',
      MailCliente: reporteData.cliente_email || '',
      ModeloEquipo: reporteData.modelo,
      NumeroSerie: reporteData.n_serie,
      IDInterna: reporteData.id_interna,
      Repuestos: repuestosTexto,
      RepuestosDetalle: repuestosDetalle,
      repuestos: repuestosDetalle,
      Observaciones: observaciones,
      IdUnico: idUnico,
      // Incluir datos adicionales del formulario para el PDF
      tecnico: reporteData.tecnico || usuarioMail,
      proximo_mant: reporteData.proximo_mant || '',
      sanitizacion: reporteData.sanitizacion || 'N/A',
      // Parámetros de operación (Sección B del formulario)
      fugas_found: reporteData.fugas_found,
      fugas_left: reporteData.fugas_left,
      cond_red_found: reporteData.cond_red_found,
      cond_red_left: reporteData.cond_red_left,
      cond_perm_found: reporteData.cond_perm_found,
      cond_perm_left: reporteData.cond_perm_left,
      rechazo_found: reporteData.rechazo_found,
      rechazo_left: reporteData.rechazo_left,
      presion_found: reporteData.presion_found,
      presion_left: reporteData.presion_left,
      caudal_perm_found: reporteData.caudal_perm_found,
      caudal_perm_left: reporteData.caudal_perm_left,
      caudal_rech_found: reporteData.caudal_rech_found,
      caudal_rech_left: reporteData.caudal_rech_left,
      relacion_found: reporteData.relacion_found,
      relacion_left: reporteData.relacion_left,
      precarga_found: reporteData.precarga_found,
      precarga_left: reporteData.precarga_left,
      presostato_alta_found: reporteData.presostato_alta_found,
      presostato_alta_left: reporteData.presostato_alta_left,
      presostato_baja_found: reporteData.presostato_baja_found,
      presostato_baja_left: reporteData.presostato_baja_left,
      // Registro de componentes (Sección C del formulario)
      etapa1_accion: reporteData.etapa1_accion,
      etapa1_detalles: reporteData.etapa1_detalles,
      etapa2_accion: reporteData.etapa2_accion,
      etapa2_detalles: reporteData.etapa2_detalles,
      etapa3_accion: reporteData.etapa3_accion,
      etapa3_detalles: reporteData.etapa3_detalles,
      etapa4_accion: reporteData.etapa4_accion,
      etapa4_detalles: reporteData.etapa4_detalles,
      etapa5_accion: reporteData.etapa5_accion,
      etapa5_detalles: reporteData.etapa5_detalles,
      etapa6_accion: reporteData.etapa6_accion,
      etapa6_detalles: reporteData.etapa6_detalles,
    };

    const fotosProcesadas = this.procesarFotos_(fotos, remito.NumeroRemito, idUnico);
    const fotoDriveIds = [];
    const fotoUrls = [];
    for (let i = 0; i < MAX_REMITO_FOTOS; i += 1) {
      const fileId = fotosProcesadas[i] || '';
      const url = this.getDirectDriveImageUrl_(fileId);
      remito[`Foto${i + 1}Id`] = fileId;
      remito[`Foto${i + 1}URL`] = url;
      fotoDriveIds.push(fileId);
      fotoUrls.push(url);
    }
    remito.fotosDriveIds = fotoDriveIds;
    remito.fotos = fotoUrls;

    // 4. Preparar los datos del remito como un array, en el orden de los encabezados de la hoja
    const remitoRowData = [
      remito.NumeroRemito,
      remito.FechaCreacion,
      remito.MailTecnico,
      remito.NumeroReporte,
      remito.NombreCliente,
      remito.Direccion,
      remito.CUIT,
      remito.Telefono,
      remito.MailCliente,
      remito.ModeloEquipo,
      remito.NumeroSerie,
      remito.IDInterna,
      remito.Repuestos,
      remito.Observaciones,
      remito.IdUnico,
      remito.Foto1Id,
      remito.Foto2Id,
      remito.Foto3Id,
      remito.Foto4Id
    ];

    // 5. GUARDAR EL REMITO REALMENTE EN LA HOJA DE CÁLCULO
    ns.RemitoRepository.guardar(remitoRowData);

    // 6. Notificar por correo electrónico con un resumen y el remito en PDF.
    const emailStatus = {
      sent: false,
      skipped: false,
    };

    try {
      const resumen = this.buildRemitoResumenTexto_(remito);
      const sendResult = this.enviarRemitoPorCorreo_(remito, resumen);
      if (sendResult && typeof sendResult === 'object') {
        emailStatus.sent = Boolean(sendResult.sent);
        emailStatus.skipped = Boolean(sendResult.skipped);
        if (sendResult.message) {
          emailStatus.message = String(sendResult.message);
        }
        // Exponer el id del PDF guardado en Drive (si el workflow lo devolvió)
        if (sendResult.pdfDriveId) {
          emailStatus.pdfDriveId = String(sendResult.pdfDriveId);
          remito.pdfDriveId = String(sendResult.pdfDriveId);
        }
      } else if (sendResult === true) {
        emailStatus.sent = true;
      }
    } catch (emailError) {
      const message = (emailError && emailError.message) ? emailError.message : String(emailError);
      emailStatus.error = message;
      Logger.log('No se pudo enviar el correo del remito %s: %s', remito.NumeroRemito, emailError);
    }

    remito.emailStatus = emailStatus;

    // 7. Devolver el objeto remito completo (con su número asignado) al frontend
    return remito;
  },

  buildRemitoResumenTexto_(remito) {
    const lineas = [];
    lineas.push(`Número de Remito: ${remito.NumeroRemito || 'Sin número'}`);
    if (remito.NombreCliente) {
      lineas.push(`Cliente: ${remito.NombreCliente}`);
    }
    if (remito.Direccion) {
      lineas.push(`Dirección: ${remito.Direccion}`);
    }
    if (remito.NumeroReporte) {
      lineas.push(`Reporte asociado: ${remito.NumeroReporte}`);
    }
    if (remito.ModeloEquipo || remito.NumeroSerie) {
      const partesEquipo = [];
      if (remito.ModeloEquipo) {
        partesEquipo.push(`Modelo ${remito.ModeloEquipo}`);
      }
      if (remito.NumeroSerie) {
        partesEquipo.push(`N° Serie ${remito.NumeroSerie}`);
      }
      lineas.push(`Equipo: ${partesEquipo.join(' - ')}`);
    }
    if (remito.Repuestos) {
      lineas.push(`Repuestos utilizados: ${remito.Repuestos}`);
    }
    if (remito.Observaciones) {
      lineas.push(`Observaciones: ${remito.Observaciones}`);
    }

    return lineas.join('\n');
  },

  buildRemitoEmailSubject_(remito) {
    const cliente = remito.NombreCliente || 'Sin cliente';
    const numero = remito.NumeroRemito || 'Sin número';
    return `Remito de servicio "${cliente}", numero de remito "${numero}"`;
  },

  buildRemitoEmailBody_(remito, resumen) {
    const fecha = remito.FechaCreacion
      ? Utilities.formatDate(new Date(remito.FechaCreacion), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm')
      : '';
    const lineas = [];
    lineas.push('Se generó un nuevo remito de servicio con el siguiente detalle:');
    if (fecha) {
      lineas.push(`Fecha de creación: ${fecha}`);
    }
    if (remito.MailTecnico) {
      lineas.push(`Generado por: ${remito.MailTecnico}`);
    }
    if (resumen) {
      lineas.push('', resumen);
    }
    return lineas.join('\n');
  },

  buildRemitoPrintableData_(remito, resumen) {
    if (!remito || typeof remito !== 'object') {
      return null;
    }

    const numero = this.resolveRemitoValue_(remito, ['NumeroRemito', 'numero_remito', 'remitoNumero', 'NumeroReporte', 'numero_reporte']);
    const fecha = this.formatDateForDisplay_(remito.FechaCreacion || remito.FechaRemito || remito.fechaRemito || remito.FechaRemitoISO);
    const proximoMantenimiento = this.formatDateForDisplay_(remito.proximo_mant || remito.ProximoMantenimiento);

    const cliente = {
      nombre: this.resolveRemitoValue_(remito, ['NombreCliente', 'clienteNombre', 'cliente']),
      direccion: this.resolveRemitoValue_(remito, ['Direccion', 'cliente_direccion', 'ubicacion']),
      telefono: this.resolveRemitoValue_(remito, ['Telefono', 'cliente_telefono']),
      email: this.resolveRemitoValue_(remito, ['MailCliente', 'cliente_email']),
      cuit: this.resolveRemitoValue_(remito, ['CUIT', 'cliente_cuit']),
    };

    const equipo = {
      descripcion: this.resolveRemitoValue_(remito, ['DescripcionEquipo', 'EquipoDescripcion', 'ModeloSistema', 'ModeloEquipo', 'modelo']),
      modelo: this.resolveRemitoValue_(remito, ['ModeloEquipo', 'Modelo', 'ModeloSistema']),
      serie: this.resolveRemitoValue_(remito, ['NumeroSerie', 'n_serie', 'numero_serie']),
      interno: this.resolveRemitoValue_(remito, ['IDInterna', 'id_interna', 'ActivoInterno']),
      ubicacion: this.resolveRemitoValue_(remito, ['Ubicacion', 'ubicacion', 'Direccion', 'cliente_direccion']),
      tecnico: this.resolveRemitoValue_(remito, ['TecnicoResponsable', 'tecnico', 'MailTecnico']),
    };

    // Parámetros de operación
    const parametrosOperacion = this.buildParametrosOperacion_(remito);

    // Registro de componentes
    const registroComponentes = this.buildRegistroComponentes_(remito);

    // Sanitización
    const sanitizacion = this.resolveRemitoValue_(remito, ['sanitizacion', 'Sanitizacion']) || 'N/A';

    const repuestosFuente = Array.isArray(remito.RepuestosDetalle) && remito.RepuestosDetalle.length
      ? remito.RepuestosDetalle
      : (Array.isArray(remito.repuestos) ? remito.repuestos : []);

    const repuestosLista = Array.isArray(repuestosFuente) && repuestosFuente.length
      ? repuestosFuente
      : this.buildComponentesFromRemitoData_(remito);

    const repuestos = Array.isArray(repuestosLista)
      ? repuestosLista
        .map(item => this.normalizeRepuestoItem_(item))
        .filter(Boolean)
        .map(item => ({
          codigo: this.normalizeString_(item.codigo),
          descripcion: this.normalizeString_(item.descripcion),
          cantidad: this.normalizeString_(item.cantidad),
        }))
        .filter(item => this.hasContent_(item.codigo) || this.hasContent_(item.descripcion) || this.hasContent_(item.cantidad))
      : [];

    const observaciones = this.normalizeString_(remito.Observaciones || remito.observaciones || resumen);
    const fotos = this.buildPrintablePhotos_(remito);
    const logo = this.resolveLogoForPdf_(remito?.LogoUrl || remito?.logoUrl);
    const logoSource = logo || this.resolveLogoForPdf_(REMITO_PDF_LOGO_URL);

    return {
      numero,
      fecha,
      proximoMantenimiento,
      cliente,
      equipo,
      parametrosOperacion,
      registroComponentes,
      sanitizacion,
      repuestos,
      observaciones,
      fotos,
      logo: logoSource,
    };
  },

  /**
   * Extrae los parámetros de operación del reporte
   */
  buildParametrosOperacion_(remito) {
    if (!remito || typeof remito !== 'object') {
      return null;
    }

    const getValue = (keys) => {
      for (const key of keys) {
        const val = remito[key];
        if (val !== undefined && val !== null && val !== '') {
          return val;
        }
      }
      return '—';
    };

    return {
      fugas: {
        found: getValue(['fugas_found', 'FugasFound']),
        left: getValue(['fugas_left', 'FugasLeft']),
      },
      conductividadRed: {
        found: getValue(['cond_red_found', 'CondRedFound']),
        left: getValue(['cond_red_left', 'CondRedLeft']),
        unit: 'µS/cm',
      },
      conductividadPermeado: {
        found: getValue(['cond_perm_found', 'CondPermFound']),
        left: getValue(['cond_perm_left', 'CondPermLeft']),
        unit: 'µS/cm',
      },
      rechazoIonico: {
        found: getValue(['rechazo_found', 'RechazoFound']),
        left: getValue(['rechazo_left', 'RechazoLeft']),
        unit: '%',
      },
      presion: {
        found: getValue(['presion_found', 'PresionFound']),
        left: getValue(['presion_left', 'PresionLeft']),
        unit: 'bar',
      },
      caudalPermeado: {
        found: getValue(['caudal_perm_found', 'CaudalPermFound']),
        left: getValue(['caudal_perm_left', 'CaudalPermLeft']),
        unit: 'l/min',
      },
      caudalRechazo: {
        found: getValue(['caudal_rech_found', 'CaudalRechFound']),
        left: getValue(['caudal_rech_left', 'CaudalRechLeft']),
        unit: 'l/min',
      },
      relacionRechazoPermeado: {
        found: getValue(['relacion_found', 'RelacionFound']),
        left: getValue(['relacion_left', 'RelacionLeft']),
        unit: '',
      },
      precargaTanque: {
        found: getValue(['precarga_found', 'PrecargaFound']),
        left: getValue(['precarga_left', 'PrecargaLeft']),
        unit: 'bar',
      },
      presostatoAlta: {
        found: getValue(['presostato_alta_found', 'PresostatoAltaFound']),
        left: getValue(['presostato_alta_left', 'PresostatoAltaLeft']),
      },
      presostatoBaja: {
        found: getValue(['presostato_baja_found', 'PresostaBajaFound']),
        left: getValue(['presostato_baja_left', 'PresostaBajaLeft']),
      },
    };
  },

  /**
   * Extrae el registro de componentes del reporte
   */
  buildRegistroComponentes_(remito) {
    if (!remito || typeof remito !== 'object') {
      return [];
    }

    const stages = [
      { id: 'etapa1', title: '1ª Sedimentos (PP)' },
      { id: 'etapa2', title: '2ª Carbón Bloque (CTO)' },
      { id: 'etapa3', title: '3ª Carbón GAC / PP' },
      { id: 'etapa4', title: '4ª Membrana RO' },
      { id: 'etapa5', title: '5ª Post-Filtro' },
      { id: 'etapa6', title: '6ª Adicional' },
    ];

    return stages.map(stage => {
      const accionKey = `${stage.id}_accion`;
      const detallesKey = `${stage.id}_detalles`;

      const accion = this.normalizeString_(remito[accionKey]) || 'Inspeccionado';
      const detalles = this.normalizeString_(remito[detallesKey]);

      const cambiado = /cambi|reempl|instal|nuevo/i.test(accion);

      return {
        id: stage.id,
        title: stage.title,
        accion,
        detalles,
        cambiado,
      };
    });
  },

  buildPrintablePhotos_(remito) {
    const fotos = [];
    const seen = new Set();

    const appendPhoto = (src, label) => {
      const normalizedSrc = this.normalizeString_(src);
      if (!normalizedSrc || seen.has(normalizedSrc)) {
        return;
      }

      const resolvedSrc = this.normalizePhotoSourceForPdf_(normalizedSrc);
      if (!resolvedSrc) {
        return;
      }

      seen.add(normalizedSrc);
      fotos.push({
        src: resolvedSrc,
        label: this.normalizeString_(label),
      });
    };

    if (Array.isArray(remito?.fotos)) {
      remito.fotos.forEach((src, index) => {
        const label = Array.isArray(remito?.fotosLabels) ? remito.fotosLabels[index] : '';
        appendPhoto(src, label || remito[`Foto${index + 1}Label`]);
      });
    }

    for (let index = 1; index <= MAX_REMITO_FOTOS; index += 1) {
      appendPhoto(remito[`Foto${index}URL`], remito[`Foto${index}Label`]);
    }

    return fotos;
  },

  normalizePhotoSourceForPdf_(source) {
    if (!source) {
      return '';
    }

    if (source.startsWith('data:')) {
      return source;
    }

    const fileId = this.extractDriveFileIdFromValue_(source);
    if (fileId) {
      const dataUrl = this.getPhotoDataUrlFromFileId_(fileId);
      if (dataUrl) {
        return dataUrl;
      }
      return this.getDirectDriveImageUrl_(fileId);
    }

    return source;
  },

  buildRemitoPdfInfoRows_(entries = []) {
    return entries
      .map(entry => {
        const label = this.escapeHtml_(entry?.label || '');
        const value = this.escapeHtml_(entry?.value || '');
        const displayValue = value || '<span class="placeholder">—</span>';
        return `<tr><th scope="row">${label}</th><td>${displayValue}</td></tr>`;
      })
      .join('');
  },

  /**
   * Genera la sección de parámetros de operación
   */
  buildRemitoPdfParametrosSection_(params) {
    if (!params) {
      return '';
    }

    const rows = [
      { label: 'Fugas visibles', found: params.fugas?.found, left: params.fugas?.left, unit: '' },
      { label: 'Conductividad Red', found: params.conductividadRed?.found, left: params.conductividadRed?.left, unit: params.conductividadRed?.unit },
      { label: 'Conductividad Permeado', found: params.conductividadPermeado?.found, left: params.conductividadPermeado?.left, unit: params.conductividadPermeado?.unit },
      { label: '% Rechazo Iónico', found: params.rechazoIonico?.found, left: params.rechazoIonico?.left, unit: params.rechazoIonico?.unit, highlight: true },
      { label: 'Presión Entrada Membrana', found: params.presion?.found, left: params.presion?.left, unit: params.presion?.unit },
      { label: 'Caudal Permeado', found: params.caudalPermeado?.found, left: params.caudalPermeado?.left, unit: params.caudalPermeado?.unit },
      { label: 'Caudal Rechazo', found: params.caudalRechazo?.found, left: params.caudalRechazo?.left, unit: params.caudalRechazo?.unit },
      { label: 'Relación Rechazo:Permeado', found: params.relacionRechazoPermeado?.found, left: params.relacionRechazoPermeado?.left, unit: '' },
      { label: 'Precarga Tanque', found: params.precargaTanque?.found, left: params.precargaTanque?.left, unit: params.precargaTanque?.unit },
      { label: 'Test Presostato Alta', found: params.presostatoAlta?.found, left: params.presostatoAlta?.left, unit: '' },
      { label: 'Test Presostato Baja', found: params.presostatoBaja?.found, left: params.presostatoBaja?.left, unit: '' },
    ];

    const formatValue = (val, unit) => {
      if (val === undefined || val === null || val === '' || val === '—') return '—';
      const escaped = this.escapeHtml_(String(val));
      return unit ? `${escaped} ${this.escapeHtml_(unit)}` : escaped;
    };

    const tableRows = rows.map(row => {
      const foundVal = formatValue(row.found, row.unit);
      const leftVal = formatValue(row.left, row.unit);
      const highlightClass = row.highlight ? ' class="highlight-row"' : '';
      return `
        <tr${highlightClass}>
          <td class="param-label">${this.escapeHtml_(row.label)}</td>
          <td class="param-value">${foundVal}</td>
          <td class="param-value">${leftVal}</td>
        </tr>
      `;
    }).join('');

    return `
      <section class="section">
        <h2 class="section__title">Parámetros de Operación</h2>
        <table class="params-table">
          <thead>
            <tr>
              <th>Parámetro</th>
              <th>Estado Inicial (As Found)</th>
              <th>Estado Final (As Left)</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </section>
    `;
  },

  /**
   * Genera la sección de registro de componentes
   */
  buildRemitoPdfComponentesSection_(componentes, sanitizacion) {
    if (!Array.isArray(componentes) || componentes.length === 0) {
      return '';
    }

    const componentRows = componentes.map(comp => {
      const accionClass = comp.cambiado ? 'accion-cambiado' : 'accion-inspeccionado';
      const accionIcon = comp.cambiado ? '🔄' : '✓';
      const detalles = this.escapeHtml_(comp.detalles) || '<span class="placeholder">—</span>';
      return `
        <tr>
          <td class="comp-title">${this.escapeHtml_(comp.title)}</td>
          <td class="comp-detalles">${detalles}</td>
          <td class="comp-accion ${accionClass}">
            <span class="accion-badge">${accionIcon} ${this.escapeHtml_(comp.accion)}</span>
          </td>
        </tr>
      `;
    }).join('');

    const sanitizacionClass = sanitizacion === 'Realizada' ? 'sanitizacion-realizada' : 
                              sanitizacion === 'No Realizada' ? 'sanitizacion-pendiente' : 'sanitizacion-na';
    const sanitizacionIcon = sanitizacion === 'Realizada' ? '✓' : 
                             sanitizacion === 'No Realizada' ? '⚠' : '—';

    return `
      <section class="section">
        <h2 class="section__title">Registro de Componentes</h2>
        <table class="components-table">
          <thead>
            <tr>
              <th>Etapa</th>
              <th>Detalles</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            ${componentRows}
          </tbody>
        </table>
        <div class="sanitizacion-row ${sanitizacionClass}">
          <span class="sanitizacion-label">Sanitización del Sistema:</span>
          <span class="sanitizacion-value">${sanitizacionIcon} ${this.escapeHtml_(sanitizacion || 'N/A')}</span>
        </div>
      </section>
    `;
  },

  buildRemitoPdfRepuestosRows_(repuestos = []) {
    if (!Array.isArray(repuestos) || repuestos.length === 0) {
      return '<tr class="empty-row"><td colspan="4">Sin repuestos registrados.</td></tr>';
    }

    return repuestos
      .map((item, index) => {
        const posicion = this.escapeHtml_(String(index + 1));
        const codigo = this.escapeHtml_(item.codigo);
        const descripcion = this.escapeHtml_(item.descripcion);
        const cantidad = this.escapeHtml_(item.cantidad);
        return `
          <tr>
            <td class="index">${posicion}</td>
            <td>${codigo || '<span class="placeholder">—</span>'}</td>
            <td>${descripcion || '<span class="placeholder">—</span>'}</td>
            <td class="cantidad">${cantidad || '<span class="placeholder">—</span>'}</td>
          </tr>
        `;
      })
      .join('');
  },

  buildRemitoPdfPhotosSection_(fotos = []) {
    if (!Array.isArray(fotos) || fotos.length === 0) {
      return '<p class="placeholder">Sin fotos adjuntas para este remito.</p>';
    }

    const items = fotos
      .map((foto, index) => {
        const labelValue = this.normalizeString_(foto?.label) || `Foto ${index + 1}`;
        const sanitizedLabel = this.escapeHtml_(labelValue);
        const sourceValue = this.normalizeString_(foto?.src);
        if (!sourceValue) {
          return '';
        }

        const sanitizedSource = this.escapeHtml_(sourceValue);
        const altText = this.escapeHtml_(`Registro fotográfico ${labelValue}`);
        return `
          <figure class="photo-item">
            <div class="photo-item__frame">
              <img src="${sanitizedSource}" alt="${altText}">
            </div>
            <figcaption>${sanitizedLabel}</figcaption>
          </figure>
        `;
      })
      .filter(Boolean)
      .join('');

    return `<div class="photo-grid">${items}</div>`;
  },

  buildRemitoPdfHtml_(data) {
    if (!data) {
      return '';
    }

    const numero = this.escapeHtml_(data.numero) || '—';
    const fecha = this.escapeHtml_(data.fecha) || '—';
    const proximoMantenimiento = this.escapeHtml_(data.proximoMantenimiento) || '';
    const logoUrl = this.escapeHtml_(data.logo || '');
    const observaciones = data.observaciones
      ? this.escapeHtml_(data.observaciones).replace(/\r?\n/g, '<br>')
      : '<span class="placeholder">Sin observaciones registradas.</span>';

    const clienteRows = this.buildRemitoPdfInfoRows_([
      { label: 'Razón social', value: data.cliente?.nombre },
      { label: 'Dirección', value: data.cliente?.direccion },
      { label: 'Teléfono', value: data.cliente?.telefono },
      { label: 'Email', value: data.cliente?.email },
      { label: 'CUIT', value: data.cliente?.cuit },
    ]);

    const equipoRows = this.buildRemitoPdfInfoRows_([
      { label: 'Modelo', value: data.equipo?.modelo },
      { label: 'N° de serie', value: data.equipo?.serie },
      { label: 'Activo / ID interno', value: data.equipo?.interno },
      { label: 'Ubicación', value: data.equipo?.ubicacion },
      { label: 'Técnico responsable', value: data.equipo?.tecnico },
    ]);

    // Nuevas secciones
    const parametrosSection = this.buildRemitoPdfParametrosSection_(data.parametrosOperacion);
    const componentesSection = this.buildRemitoPdfComponentesSection_(data.registroComponentes, data.sanitizacion);

    const repuestosRows = this.buildRemitoPdfRepuestosRows_(data.repuestos);
    const fotosSection = this.buildRemitoPdfPhotosSection_(data.fotos);

    // Próximo mantenimiento
    const proximoMantHtml = proximoMantenimiento 
      ? `<div class="proximo-mantenimiento">
           <span class="proximo-label">📅 Próximo Mantenimiento Programado:</span>
           <span class="proximo-fecha">${proximoMantenimiento}</span>
         </div>`
      : '';

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Remito ${numero}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    :root {
      color-scheme: only light;
    }

    @page {
      size: A4;
      margin: 1cm;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      font-size: 11px;
      line-height: 1.4;
      color: #111827;
      background: #f3f4f6;
    }

    .document {
      background: #ffffff;
      padding: 20px;
      border-radius: 12px;
      box-shadow: 0 10px 25px rgba(15, 23, 42, 0.08);
    }

    .document__header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      border-bottom: 3px solid #2563eb;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }

    .document__identity {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .document__title {
      font-size: 20px;
      font-weight: 700;
      color: #1f2937;
      margin: 0;
    }

    .document__subtitle {
      font-size: 12px;
      color: #6b7280;
      margin: 0;
    }

    .document__meta {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      color: #374151;
      font-weight: 600;
      font-size: 12px;
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

    .two-columns {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }

    .section {
      margin-bottom: 16px;
    }

    .section--compact {
      margin-bottom: 12px;
    }

    .section__title {
      font-size: 12px;
      font-weight: 700;
      margin: 0 0 8px;
      color: #1f2937;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      padding-bottom: 4px;
      border-bottom: 2px solid #e5e7eb;
    }

    .info-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
    }

    .info-table th,
    .info-table td {
      text-align: left;
      padding: 5px 8px;
      border-bottom: 1px solid #e5e7eb;
      vertical-align: top;
    }

    .info-table th {
      width: 35%;
      font-weight: 600;
      background: #f9fafb;
      color: #374151;
    }

    .info-table tr:last-child th,
    .info-table tr:last-child td {
      border-bottom: none;
    }

    /* Tabla de Parámetros de Operación */
    .params-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      overflow: hidden;
    }

    .params-table thead {
      background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
      color: #ffffff;
    }

    .params-table th {
      padding: 8px 10px;
      text-align: center;
      font-weight: 600;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .params-table th:first-child {
      text-align: left;
      width: 40%;
    }

    .params-table td {
      padding: 6px 10px;
      border-bottom: 1px solid #e5e7eb;
    }

    .params-table td.param-label {
      font-weight: 500;
      color: #374151;
      background: #f9fafb;
    }

    .params-table td.param-value {
      text-align: center;
      font-weight: 600;
      color: #1f2937;
    }

    .params-table tr:last-child td {
      border-bottom: none;
    }

    .params-table tr.highlight-row td {
      background: #fef3c7;
    }

    .params-table tr.highlight-row td.param-label {
      background: #fde68a;
    }

    /* Tabla de Componentes */
    .components-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      overflow: hidden;
    }

    .components-table thead {
      background: linear-gradient(135deg, #065f46 0%, #10b981 100%);
      color: #ffffff;
    }

    .components-table th {
      padding: 8px 10px;
      text-align: left;
      font-weight: 600;
      font-size: 10px;
      text-transform: uppercase;
    }

    .components-table td {
      padding: 6px 10px;
      border-bottom: 1px solid #e5e7eb;
      vertical-align: middle;
    }

    .components-table td.comp-title {
      font-weight: 600;
      color: #1f2937;
      width: 25%;
      background: #f9fafb;
    }

    .components-table td.comp-detalles {
      width: 45%;
      color: #4b5563;
    }

    .components-table td.comp-accion {
      width: 30%;
      text-align: center;
    }

    .accion-badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 9px;
      font-weight: 600;
      text-transform: uppercase;
    }

    .accion-cambiado .accion-badge {
      background: #fef3c7;
      color: #92400e;
      border: 1px solid #f59e0b;
    }

    .accion-inspeccionado .accion-badge {
      background: #d1fae5;
      color: #065f46;
      border: 1px solid #10b981;
    }

    .sanitizacion-row {
      margin-top: 10px;
      padding: 10px 14px;
      border-radius: 6px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: 600;
    }

    .sanitizacion-realizada {
      background: #d1fae5;
      border: 1px solid #10b981;
      color: #065f46;
    }

    .sanitizacion-pendiente {
      background: #fef3c7;
      border: 1px solid #f59e0b;
      color: #92400e;
    }

    .sanitizacion-na {
      background: #f3f4f6;
      border: 1px solid #d1d5db;
      color: #6b7280;
    }

    /* Tabla de Repuestos */
    .repuestos-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      overflow: hidden;
    }

    .repuestos-table thead {
      background: linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%);
      color: #ffffff;
    }

    .repuestos-table th,
    .repuestos-table td {
      padding: 8px 10px;
      border-bottom: 1px solid #e5e7eb;
    }

    .repuestos-table th {
      text-transform: uppercase;
      font-size: 10px;
      letter-spacing: 0.03em;
      font-weight: 600;
    }

    .repuestos-table td.index {
      width: 40px;
      font-weight: 600;
      text-align: center;
      background: #f9fafb;
    }

    .repuestos-table td.cantidad {
      text-align: center;
      width: 70px;
      font-weight: 600;
    }

    .repuestos-table tr:last-child td {
      border-bottom: none;
    }

    .placeholder {
      color: #9ca3af;
      font-style: italic;
    }

    .observaciones {
      padding: 12px;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      background: #f9fafb;
      min-height: 60px;
      font-size: 11px;
    }

    .proximo-mantenimiento {
      margin-top: 12px;
      padding: 10px 14px;
      background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
      border: 1px solid #3b82f6;
      border-radius: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .proximo-label {
      font-weight: 600;
      color: #1e40af;
    }

    .proximo-fecha {
      font-weight: 700;
      font-size: 13px;
      color: #1e3a8a;
    }

    .photo-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
    }

    .photo-item {
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .photo-item__frame {
      position: relative;
      overflow: hidden;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
      background: #111827;
      aspect-ratio: 4 / 3;
    }

    .photo-item__frame img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      background: #111827;
    }

    .photo-item figcaption {
      font-size: 9px;
      color: #4b5563;
      text-align: center;
    }

    .document__footer {
      margin-top: 20px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      padding-top: 16px;
      border-top: 2px solid #e5e7eb;
    }

    .firma {
      border-top: 1px solid #374151;
      padding-top: 8px;
      text-align: center;
      color: #6b7280;
      font-size: 10px;
      margin-top: 40px;
    }

    @media print {
      body {
        background: #ffffff;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .document {
        box-shadow: none;
        padding: 0;
      }

      .section {
        page-break-inside: avoid;
      }

      .photo-item {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="document">
    <header class="document__header">
      <div class="document__identity">
        <p class="document__title">Reporte de Mantenimiento Preventivo</p>
        <p class="document__subtitle">Ósmosis Inversa</p>
        <div class="document__meta">
          <span>N° Remito: <strong>${numero}</strong></span>
          <span>Fecha: <strong>${fecha}</strong></span>
        </div>
      </div>
      ${logoUrl ? `<div class="document__logo"><img src="${logoUrl}" alt="Logo de OHM Agua"></div>` : ''}
    </header>

    <div class="two-columns">
      <section class="section section--compact">
        <h2 class="section__title">Datos del Cliente</h2>
        <table class="info-table">
          <tbody>
            ${clienteRows}
          </tbody>
        </table>
      </section>

      <section class="section section--compact">
        <h2 class="section__title">Datos del Equipo</h2>
        <table class="info-table">
          <tbody>
            ${equipoRows}
          </tbody>
        </table>
      </section>
    </div>

    ${parametrosSection}

    ${componentesSection}

    <section class="section">
      <h2 class="section__title">Repuestos y Materiales Utilizados</h2>
      <table class="repuestos-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Código</th>
            <th>Descripción</th>
            <th>Cant.</th>
          </tr>
        </thead>
        <tbody>
          ${repuestosRows}
        </tbody>
      </table>
    </section>

    <section class="section">
      <h2 class="section__title">Observaciones y Recomendaciones</h2>
      <div class="observaciones">${observaciones}</div>
      ${proximoMantHtml}
    </section>

    <section class="section">
      <h2 class="section__title">Registro Fotográfico</h2>
      ${fotosSection}
    </section>

    <footer class="document__footer">
      <div class="firma">
        <p>Firma del Técnico OHM Agua</p>
      </div>
      <div class="firma">
        <p>Firma y Aclaración del Cliente</p>
      </div>
    </footer>
  </div>
</body>
</html>`;
  },

  buildRemitoPdfAdjunto_(remito, resumen) {
    try {
      const printableData = this.buildRemitoPrintableData_(remito, resumen);
      if (!printableData) {
        return null;
      }

      const html = this.buildRemitoPdfHtml_(printableData);
      if (!html) {
        return null;
      }

      const htmlOutput = HtmlService.createHtmlOutput(html).setWidth(794).setHeight(1123);
      const pdfBlob = htmlOutput.getAs('application/pdf');
      pdfBlob.setName(`Remito-${remito.NumeroRemito || 'sin-numero'}.pdf`);
      return pdfBlob;
    } catch (error) {
      Logger.log('No se pudo generar el PDF del remito %s: %s', remito.NumeroRemito, error);
      return null;
    }
  },

  getPdfFolder_() {
    if (!REMITO_PDF_FOLDER_ID) {
      return null;
    }

    if (this.pdfFolderCache) {
      return this.pdfFolderCache;
    }

    try {
      this.pdfFolderCache = DriveApp.getFolderById(REMITO_PDF_FOLDER_ID);
    } catch (error) {
      Logger.log('No se pudo acceder a la carpeta configurada para los PDF de remitos: %s', error);
      this.pdfFolderCache = null;
    }

    return this.pdfFolderCache;
  },

  saveRemitoPdfToDrive_(pdfBlob, remito) {
    if (!pdfBlob) {
      return;
    }

    const folder = this.getPdfFolder_();
    if (!folder) {
      return;
    }

    try {
      const blob = pdfBlob.copyBlob();
      const filename = blob.getName() || `Remito-${remito?.NumeroRemito || 'sin-numero'}.pdf`;
      blob.setName(filename);
      const file = folder.createFile(blob);
      try {
        // Hacerlo accesible por enlace (si se desea). Ajustar según política de seguridad.
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      } catch (shareErr) {
        Logger.log('No se pudo cambiar el sharing del PDF %s: %s', file.getId(), shareErr);
      }
      Logger.log('PDF del remito %s guardado en Drive con id %s', remito?.NumeroRemito, file.getId());
      return file.getId();
    } catch (error) {
      Logger.log('No se pudo guardar el PDF del remito %s en Drive: %s', remito?.NumeroRemito, error);
    }
  },

  enviarRemitoPorCorreo_(remito, resumen) {
    const destinatario = REMITO_NOTIFICATIONS_EMAIL;
    if (!destinatario) {
      return {
        sent: false,
        skipped: true,
        message: 'El destinatario para las notificaciones de remitos no está configurado.',
      };
    }

    const subject = this.buildRemitoEmailSubject_(remito);
    const body = this.buildRemitoEmailBody_(remito, resumen);
    const pdf = this.buildRemitoPdfAdjunto_(remito, resumen);

    const opciones = {
      name: 'Remitos OBM',
    };

    let savedPdfId = null;
    if (pdf) {
      opciones.attachments = [pdf];
      try {
        savedPdfId = this.saveRemitoPdfToDrive_(pdf, remito) || null;
      } catch (saveErr) {
        Logger.log('Error guardando PDF en Drive antes de enviar email: %s', saveErr);
      }
    }

    MailApp.sendEmail(destinatario, subject, body, opciones);

    return {
      sent: true,
      skipped: false,
      pdfDriveId: savedPdfId,
    };
  },

  /**
   * Obtiene un listado de remitos con paginación.
   * @param {number} page - El número de página a obtener (basado en 1).
   * @param {number} pageSize - La cantidad de remitos por página.
   * @returns {object} Un objeto con los remitos, total de páginas y página actual.
   */
  obtenerRemitos(page = 1, pageSize = 20) {
    const sheet = ns.RemitoRepository.getSheet_();
    const lastRow = sheet.getLastRow();
    const headers = ns.RemitoRepository.getHeaders();

    // Si solo hay encabezados o no hay datos, devolver un objeto vacío
    if (lastRow < 2) { 
      return { remitos: [], totalPages: 0, currentPage: 1 };
    }

    // Obtener todos los datos excluyendo la fila de encabezados
    const columnCount = Math.min(headers.length, sheet.getLastColumn());
    const dataRange = sheet.getRange(2, 1, lastRow - 1, columnCount);
    const allRemitosData = dataRange.getValues();

    // Verificación adicional: si no hay datos después de los encabezados
    if (!allRemitosData || allRemitosData.length === 0) {
        return { remitos: [], totalPages: 0, currentPage: 1 };
    }

    // Calcular paginación
    const totalRemitos = allRemitosData.length;
    const totalPages = Math.ceil(totalRemitos / pageSize);
    const currentPage = Math.max(1, Math.min(page, totalPages)); // Asegura que la página esté dentro de los límites

    // Calcular el índice de inicio y fin para la página actual
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalRemitos);

    const remitosPageData = allRemitosData.slice(startIndex, endIndex);

    // Mapear los datos de las filas a objetos con sus encabezados
    const remitos = remitosPageData.map(row => {
      const remito = {};
      headers.forEach((header, index) => {
        // Convertir la fecha si es la columna de fecha
        if (header === 'FechaCreacion' && row[index] instanceof Date) {
            remito[header] = row[index].toLocaleDateString(); // Formatear a string de fecha
        } else {
            remito[header] = row[index];
        }
      });

      const fotosDriveIds = [];
      const fotosUrls = [];
      for (let i = 1; i <= MAX_REMITO_FOTOS; i += 1) {
        const idKey = `Foto${i}Id`;
        const urlKey = `Foto${i}URL`;
        const rawValue = remito[idKey] || remito[urlKey];
        const fileId = this.extractDriveFileIdFromValue_(rawValue);
        const directUrl = this.getDirectDriveImageUrl_(fileId);

        remito[idKey] = fileId || '';
        remito[urlKey] = directUrl || '';

        fotosDriveIds.push(fileId || '');
        fotosUrls.push(directUrl || '');
      }

      remito.fotosDriveIds = fotosDriveIds;
      remito.fotos = fotosUrls;
      return remito;
    });

    Logger.log('Respuesta de obtenerRemitos:', { // Mantenemos el log para debug
      remitos: remitos,
      totalPages: totalPages,
      currentPage: currentPage
    });

    return {
      remitos: remitos,
      totalPages: totalPages,
      currentPage: currentPage
    };
  }
};


    ns.REMITO_FOTOS_FOLDER_ID = REMITO_FOTOS_FOLDER_ID;
    ns.MAX_REMITO_FOTOS = MAX_REMITO_FOTOS;
    ns.COMPONENT_STAGE_TITLES = COMPONENT_STAGE_TITLES;
    ns.REPLACEMENT_KEYWORDS = REPLACEMENT_KEYWORDS;
    ns.REMITO_NOTIFICATIONS_EMAIL = REMITO_NOTIFICATIONS_EMAIL;
    ns.REMITO_PDF_FOLDER_ID = REMITO_PDF_FOLDER_ID;
    ns.REMITO_PDF_LOGO_URL = REMITO_PDF_LOGO_URL;
    ns.RemitoService = RemitoService;
  })(global.OBM = global.OBM || {});
})(typeof window !== 'undefined' ? window : this);
