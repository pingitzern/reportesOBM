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
const REMITO_PDF_FOLDER_ID = '1uBFPFT-rcfkbeaSFPCMNtmJAcMedEuwa';

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
    const siguienteNumero = RemitoRepository.getNextRemitoNumber();
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
      IdUnico: idUnico
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
    RemitoRepository.guardar(remitoRowData);

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
      cliente,
      equipo,
      repuestos,
      observaciones,
      fotos,
      logo: logoSource,
    };
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
      { label: 'Descripción', value: data.equipo?.descripcion },
      { label: 'Modelo', value: data.equipo?.modelo },
      { label: 'N° de serie', value: data.equipo?.serie },
      { label: 'Activo / ID interno', value: data.equipo?.interno },
      { label: 'Ubicación', value: data.equipo?.ubicacion },
      { label: 'Técnico responsable', value: data.equipo?.tecnico },
    ]);

    const repuestosRows = this.buildRemitoPdfRepuestosRows_(data.repuestos);
    const fotosSection = this.buildRemitoPdfPhotosSection_(data.fotos);

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
      margin: 1.5cm;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      font-size: 12px;
      line-height: 1.5;
      color: #111827;
      background: #f3f4f6;
    }

    .document {
      background: #ffffff;
      padding: 28px;
      border-radius: 12px;
      box-shadow: 0 10px 25px rgba(15, 23, 42, 0.08);
    }

    .document__header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      border-bottom: 2px solid #2563eb;
      padding-bottom: 18px;
      margin-bottom: 24px;
    }

    .document__identity {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .document__title {
      font-size: 22px;
      font-weight: 700;
      color: #1f2937;
      margin: 0;
    }

    .document__meta {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      color: #374151;
      font-weight: 600;
    }

    .document__logo {
      flex: none;
      max-width: 140px;
    }

    .document__logo img {
      width: 100%;
      height: auto;
      display: block;
    }

    .section {
      margin-bottom: 24px;
    }

    .section__title {
      font-size: 15px;
      font-weight: 700;
      margin: 0 0 12px;
      color: #1f2937;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .info-table {
      width: 100%;
      border-collapse: collapse;
      background: #f9fafb;
      border-radius: 10px;
      overflow: hidden;
    }

    .info-table th,
    .info-table td {
      padding: 10px 14px;
      text-align: left;
    }

    .info-table th {
      width: 180px;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #6b7280;
      background: #e5e7eb;
    }

    .info-table td {
      color: #1f2937;
      font-weight: 500;
      border-bottom: 1px solid #e5e7eb;
    }

    .info-table tr:last-child td {
      border-bottom: none;
    }

    .repuestos-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      overflow: hidden;
    }

    .repuestos-table th,
    .repuestos-table td {
      padding: 10px;
      border-bottom: 1px solid #e5e7eb;
    }

    .repuestos-table th {
      text-transform: uppercase;
      font-size: 11px;
      letter-spacing: 0.05em;
      color: #4b5563;
      background: #f3f4f6;
    }

    .repuestos-table td.index {
      width: 48px;
      font-weight: 600;
      text-align: center;
    }

    .repuestos-table td.cantidad {
      text-align: right;
      width: 80px;
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
      padding: 16px;
      border: 1px solid #d1d5db;
      border-radius: 10px;
      background: #f9fafb;
      min-height: 90px;
    }

    .photo-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 16px;
    }

    .photo-item {
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .photo-item__frame {
      position: relative;
      overflow: hidden;
      border-radius: 12px;
      border: 1px solid #e5e7eb;
      background: #111827;
      aspect-ratio: 3 / 2;
    }

    .photo-item__frame img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      background: #111827;
    }

    .photo-item figcaption {
      font-size: 11px;
      color: #4b5563;
      text-align: center;
    }

    .document__footer {
      margin-top: 32px;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 24px;
    }

    .firma {
      border-top: 1px solid #9ca3af;
      padding-top: 12px;
      text-align: center;
      color: #6b7280;
    }

    @media print {
      body {
        background: #ffffff;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .document {
        box-shadow: none;
      }

      .document__header {
        margin-bottom: 18px;
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
        <p class="document__title">Remito de servicio</p>
        <div class="document__meta">
          <span>Número: <strong>${numero}</strong></span>
          <span>Fecha: <strong>${fecha}</strong></span>
        </div>
      </div>
      ${logoUrl ? `<div class="document__logo"><img src="${logoUrl}" alt="Logo de OHM Agua"></div>` : ''}
    </header>

    <section class="section">
      <h2 class="section__title">Datos del cliente</h2>
      <table class="info-table">
        <tbody>
          ${clienteRows}
        </tbody>
      </table>
    </section>

    <section class="section">
      <h2 class="section__title">Datos del equipo</h2>
      <table class="info-table">
        <tbody>
          ${equipoRows}
        </tbody>
      </table>
    </section>

    <section class="section">
      <h2 class="section__title">Repuestos y materiales</h2>
      <table class="repuestos-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Código</th>
            <th>Descripción</th>
            <th>Cantidad</th>
          </tr>
        </thead>
        <tbody>
          ${repuestosRows}
        </tbody>
      </table>
    </section>

    <section class="section">
      <h2 class="section__title">Observaciones</h2>
      <div class="observaciones">${observaciones}</div>
    </section>

    <section class="section">
      <h2 class="section__title">Registro fotográfico</h2>
      ${fotosSection}
    </section>

    <footer class="document__footer">
      <div class="firma">
        <p>Firma del responsable de OHM Agua</p>
      </div>
      <div class="firma">
        <p>Firma y aclaración del cliente</p>
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
      folder.createFile(blob);
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

    if (pdf) {
      opciones.attachments = [pdf];
      this.saveRemitoPdfToDrive_(pdf, remito);
    }

    MailApp.sendEmail(destinatario, subject, body, opciones);

    return {
      sent: true,
      skipped: false,
    };
  },

  /**
   * Obtiene un listado de remitos con paginación.
   * @param {number} page - El número de página a obtener (basado en 1).
   * @param {number} pageSize - La cantidad de remitos por página.
   * @returns {object} Un objeto con los remitos, total de páginas y página actual.
   */
  obtenerRemitos(page = 1, pageSize = 20) {
    const sheet = RemitoRepository.getSheet_();
    const lastRow = sheet.getLastRow();
    const headers = RemitoRepository.getHeaders();

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
