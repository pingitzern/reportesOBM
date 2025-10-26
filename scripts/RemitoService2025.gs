// Contenido para RemitoService.gs

const REMITO_FOTOS_FOLDER_ID = '1SH7Zz7g_2sbYsFHMfVQj3Admdy8L3FVz';
const REMITO_PDF_FOLDER_ID = '1BKBPmndOGet7yVZ4UtFCkhrt402eXH4X';
const MAX_REMITO_FOTOS = 4;
const REMITO_LOGO_DATA_URL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAABTYAAAJYCAYAAABYc7mcAAAAAXNSR0IArs4c6QAAAARnQU1BAACx" +
  'jwv8YQUAAAAJcEhZcwAACxMA' +
  'AAsTAQCanBgAAAJZaVRYdFhNTDpjb20uYWRvYmUueG1wAAAAAAA8P3hwYWNrZXQgYmVnaW49J++7vycgaWQ9J1c1TTBNcENlaGlI' +
  'enJlU3pOVGN6a2M5ZCc/Pg0KPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyI+PHJkZjpSREYgeG1sbnM6cmRmPSJo' +
  'dHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj48cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0idXVp' +
  'ZDpmYWY1YmRkNS1iYTNkLTExZGEtYWQzMS1kMzNkNzUxODJmMWIiIHhtbG5zOmV4aWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20vZXhp' +
  'Zi8xLjAvIj48ZXhpZjpEYXRlVGltZU9yaWdpbmFsPjIwMjUtMDItMjNUMTc6MTQ6MjY8L2V4aWY6RGF0ZVRpbWVPcmlnaW5hbD48' +
  'L3JkZjpEZXNjcmlwdGlvbj48cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0idXVpZDpmYWY1YmRkNS1iYTNkLTExZGEtYWQzMS1k' +
  'MzNkNzUxODJmMWIiIHhtbG5zOnhtcD0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLyI+PHhtcDpDcmVhdGVEYXRlPjIwMjUt' +
  'MDItMjNUMTc6MTQ6MjY8L3htcDpDcmVhdGVEYXRlPjwvcmRmOkRlc2NyaXB0aW9uPjwvcmRmOlJERj48L3g6eG1wbWV0YT4NCjw/' +
  'eHBhY2tldCBlbmQ9J3cnPz7vFR1HAAAAIXRFWHRDcmVhdGlvbiBUaW1lADIwMjU6MDI6MjMgMTc6MTQ6MjasGwdaAABk5ElEQVR4' +
  'Xu3dT28cV343+lNNyUaMxE/7GomR4GbSugEukAd4YCoTjTErUbA4XpqaQdYmX8GIsLKWtLYEyq+A9PrBjOnlRB6QWhkyZ0L6FZh5' +
  'Be5neT0i6y5YPUOX+y+r6tSf/nyAhszTskh2V1VXfet3ficEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  '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' +

const COMPONENT_STAGE_TITLES = {
  etapa1: '1ª Sedimentos (PP)',
  etapa2: '2ª Carbón Bloque (CTO)',
  etapa3: '3ª Carbón GAC / PP',
  etapa4: '4ª Membrana RO',
  etapa5: '5ª Post-Filtro',
  etapa6: '6ª Adicional'
};

const REPLACEMENT_KEYWORDS = ['cambi', 'reempl', 'instal', 'nuevo'];

const RemitoService = {
  fotosFolderCache: null,
  pdfFolderCache: null,

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

  getPdfFolder_() {
    if (!REMITO_PDF_FOLDER_ID) {
      throw new Error('Configura el ID de la carpeta de PDFs de remitos antes de generar archivos.');
    }

    if (this.pdfFolderCache) {
      return this.pdfFolderCache;
    }

    try {
      this.pdfFolderCache = DriveApp.getFolderById(REMITO_PDF_FOLDER_ID);
    } catch (error) {
      throw new Error('No se pudo acceder a la carpeta configurada para los PDFs de remitos.');
    }

    return this.pdfFolderCache;
  },

  normalizeForPdf_(value) {
    if (value === null || value === undefined) {
      return '';
    }
    if (value instanceof Date) {
      return this.formatDateForPdf_(value);
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
    if (typeof value === 'string') {
      return value.trim();
    }
    return String(value);
  },

  formatDateForPdf_(value) {
    if (value instanceof Date) {
      return Utilities.formatDate(value, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return this.formatDateForPdf_(new Date(value));
    }
    if (typeof value === 'string') {
      return value.trim();
    }
    return '';
  },

  buildPdfFileBase_(numeroRemito, nombreCliente) {
    const baseParts = [];
    if (numeroRemito) {
      baseParts.push(String(numeroRemito));
    }
    if (nombreCliente) {
      baseParts.push(String(nombreCliente));
    }
    const rawBase = baseParts.length > 0 ? baseParts.join('-') : 'remito';
    return rawBase.replace(/[^A-Za-z0-9_-]+/g, '-');
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
    const normalized = this.normalizeForPdf_(value);
    return typeof normalized === 'string' ? normalized : '';
  },

  hasContent_(value) {
    return Boolean(this.normalizeString_(value));
  },

  escapeHtml_(text) {
    if (text === null || text === undefined) {
      return '';
    }

    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  convertToHtmlWithBreaks_(text) {
    if (!text) {
      return '';
    }

    return this.escapeHtml_(text).replace(/\r?\n/g, '<br>');
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

  buildDriveImageDataUrl_(fileId) {
    const normalizedId = this.extractDriveFileIdFromValue_(fileId);
    if (!normalizedId) {
      return '';
    }

    try {
      const file = DriveApp.getFileById(normalizedId);
      let blob = file.getBlob();

      const originalMime = blob.getContentType() || '';
      const isSupportedMime = /^image\/(png|jpe?g|gif|bmp|webp)$/i.test(originalMime);

      if (!isSupportedMime) {
        try {
          blob = blob.getAs('image/png');
        } catch (conversionError) {
          Logger.log('No se pudo convertir la imagen %s a PNG para incrustarla en el PDF: %s', normalizedId, conversionError);
        }
      }

      const mimeType = blob.getContentType() || (isSupportedMime ? originalMime : 'image/png') || 'image/jpeg';
      const base64 = Utilities.base64Encode(blob.getBytes());
      return `data:${mimeType};base64,${base64}`;
    } catch (error) {
      Logger.log('No se pudo obtener el blob de la imagen %s para incrustarla en el PDF: %s', normalizedId, error);
    }

    return '';
  },

  buildClienteRowsForTemplate_(remito) {
    return [
      { label: 'Razón social', value: this.resolveRemitoValue_(remito, ['clienteNombre', 'cliente.nombre', 'cliente', 'cliente_nombre', 'NombreCliente']) },
      { label: 'Dirección', value: this.resolveRemitoValue_(remito, ['direccion', 'cliente_direccion', 'ubicacion', 'Direccion']) },
      { label: 'Teléfono', value: this.resolveRemitoValue_(remito, ['cliente_telefono', 'telefono_cliente', 'telefono', 'Telefono']) },
      { label: 'Email', value: this.resolveRemitoValue_(remito, ['cliente_email', 'email', 'correo', 'MailCliente']) },
      { label: 'CUIT', value: this.resolveRemitoValue_(remito, ['cliente_cuit', 'cuit', 'CUIT']) }
    ];
  },

  buildEquipoRowsForTemplate_(remito) {
    return [
      { label: 'Descripción', value: this.resolveRemitoValue_(remito, ['equipo', 'modelo', 'descripcion_equipo', 'ModeloEquipo']) },
      { label: 'Modelo', value: this.resolveRemitoValue_(remito, ['modelo', 'modelo_equipo', 'ModeloEquipo']) },
      { label: 'N° de serie', value: this.resolveRemitoValue_(remito, ['n_serie', 'numero_serie', 'NumeroSerie']) },
      { label: 'Activo / ID interno', value: this.resolveRemitoValue_(remito, ['id_interna', 'codigo_interno', 'IDInterna']) },
      { label: 'Ubicación', value: this.resolveRemitoValue_(remito, ['ubicacion', 'direccion', 'cliente_direccion', 'Direccion']) },
      { label: 'Técnico responsable', value: this.resolveRemitoValue_(remito, ['tecnico', 'tecnico_asignado', 'MailTecnico']) }
    ];
  },

  buildRepuestosForTemplate_(remito) {
    const repuestos = [];

    if (Array.isArray(remito?.repuestos)) {
      repuestos.push(...remito.repuestos);
    }

    if (Array.isArray(remito?.RepuestosDetalle)) {
      repuestos.push(...remito.RepuestosDetalle);
    }

    if (Array.isArray(remito?.componentes)) {
      repuestos.push(...remito.componentes);
    }

    if (repuestos.length === 0) {
      repuestos.push(...this.buildComponentesFromRemitoData_(remito));
    }

    return repuestos
      .map(item => this.normalizeRepuestoItem_(item))
      .filter(item => item && (this.hasContent_(item.codigo) || this.hasContent_(item.descripcion) || this.hasContent_(item.cantidad)));
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

  collectFotoCandidatesForTemplate_(remito) {
    const candidates = [];
    const seen = new Set();

    const pushCandidate = candidate => {
      if (!candidate) {
        return;
      }

      const key = this.normalizeString_(
        candidate.driveId || candidate.id || candidate.url || candidate.src || candidate.dataUrl || candidate.source
      );

      if (!key || seen.has(key)) {
        return;
      }

      seen.add(key);
      candidates.push(candidate);
    };

    if (Array.isArray(remito?.fotos)) {
      remito.fotos.forEach((entry, index) => {
        if (!entry) {
          return;
        }

        if (typeof entry === 'string') {
          pushCandidate({ url: entry, label: `Foto ${index + 1}` });
          return;
        }

        if (typeof entry === 'object') {
          pushCandidate({
            url: entry.url || entry.href || entry.link,
            dataUrl: entry.dataUrl || entry.data || entry.base64,
            driveId: entry.driveFileId || entry.driveId || entry.fileId || entry.id,
            label: entry.label || entry.caption || entry.descripcion || `Foto ${index + 1}`
          });
        }
      });
    }

    if (Array.isArray(remito?.fotosDriveIds)) {
      remito.fotosDriveIds.forEach((id, index) => {
        const driveId = this.normalizeString_(id);
        if (driveId) {
          pushCandidate({ driveId, label: `Foto ${index + 1}` });
        }
      });
    }

    if (Array.isArray(remito?.fotosIds)) {
      remito.fotosIds.forEach((id, index) => {
        const driveId = this.normalizeString_(id);
        if (driveId) {
          pushCandidate({ driveId, label: `Foto ${index + 1}` });
        }
      });
    }

    for (let slot = 1; slot <= MAX_REMITO_FOTOS; slot += 1) {
      const idValue = this.normalizeString_(remito[`Foto${slot}Id`]);
      const urlValue = this.normalizeString_(remito[`Foto${slot}URL`]);
      if (idValue) {
        pushCandidate({ driveId: idValue, label: `Foto ${slot}` });
      } else if (urlValue) {
        pushCandidate({ url: urlValue, label: `Foto ${slot}` });
      }
    }

    return candidates;
  },

  buildFotosForTemplate_(remito) {
    const candidates = this.collectFotoCandidatesForTemplate_(remito);
    const fotos = [];

    for (let index = 0; index < candidates.length && fotos.length < MAX_REMITO_FOTOS; index += 1) {
      const candidate = candidates[index];
      const label = candidate.label || `Foto ${fotos.length + 1}`;

      const directData = this.normalizeString_(candidate.dataUrl || candidate.src || candidate.source);
      if (directData && directData.indexOf('data:') === 0) {
        fotos.push({ src: directData, label });
        continue;
      }

      const directUrl = this.normalizeString_(candidate.url);
      if (directUrl && directUrl.indexOf('data:') === 0) {
        fotos.push({ src: directUrl, label });
        continue;
      }

      let driveId = this.normalizeString_(candidate.driveId || candidate.id);
      if (!driveId && directUrl) {
        driveId = this.extractDriveFileIdFromValue_(directUrl);
      }

      if (driveId) {
        const embedded = this.buildDriveImageDataUrl_(driveId);
        if (embedded) {
          fotos.push({ src: embedded, label });
          continue;
        }

        const normalizedUrl = this.normalizeDriveUrl_(driveId);
        if (normalizedUrl) {
          fotos.push({ src: normalizedUrl, label });
          continue;
        }
      }

      if (directUrl) {
        fotos.push({ src: directUrl, label });
      }
    }

    return fotos;
  },

  buildPdfTemplateData_(remito) {
    const numero = this.normalizeForPdf_(remito.NumeroRemito);
    const fecha = this.formatDateForPdf_(remito.FechaCreacion) || this.formatDateForPdf_(new Date());
    const cliente = this.buildClienteRowsForTemplate_(remito);
    const equipo = this.buildEquipoRowsForTemplate_(remito);
    const repuestos = this.buildRepuestosForTemplate_(remito);
    const observacionesTexto = this.normalizeForPdf_(remito.Observaciones);
    const observacionesHtml = observacionesTexto
      ? this.convertToHtmlWithBreaks_(observacionesTexto)
      : '<span class="placeholder">Sin observaciones registradas.</span>';
    const fotos = this.buildFotosForTemplate_(remito);

    return {
      titulo: 'Remito de servicio',
      numero: numero || '—',
      fecha: fecha || this.formatDateForPdf_(new Date()),
      fechaGeneracion: this.formatDateForPdf_(new Date()),
      logoDataUrl: REMITO_LOGO_DATA_URL,
      cliente,
      equipo,
      repuestos,
      observacionesTexto: observacionesTexto || '',
      observacionesHtml,
      fotos,
      nota: 'Documento generado automáticamente a partir del sistema de reportes OBM.'
    };
  },

  generarPdfRemito_(remito) {
    const folder = this.getPdfFolder_();
    const fileBase = this.buildPdfFileBase_(remito.NumeroRemito, remito.NombreCliente);
    const documentName = `Remito-${fileBase}`;
    try {
      const template = HtmlService.createTemplateFromFile('remito-pdf-template');
      const reporte = this.buildPdfTemplateData_(remito);
      Logger.log('URLs de fotos finales pasadas al template del PDF: %s', JSON.stringify(reporte.fotos.map(f => f.src)));
      template.reporte = reporte;

      const htmlOutput = template.evaluate();
      const htmlContent = htmlOutput.getContent();
      const htmlBlob = Utilities.newBlob(htmlContent, 'text/html', `${documentName}.html`);
      const pdfBlob = htmlBlob.getAs(MimeType.PDF).setName(`${documentName}.pdf`);
      const pdfFile = folder.createFile(pdfBlob);
      pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

      return {
        id: pdfFile.getId(),
        url: pdfFile.getUrl(),
        name: pdfFile.getName()
      };
    } catch (error) {
      throw new Error(`No se pudo componer el PDF del remito: ${error.message}`);
    }
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

    // 2. Normalizar los repuestos del reporte para almacenarlos y utilizarlos en el PDF
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
      PdfURL: '',
      PdfFileId: ''
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

    let pdfInfo = null;
    try {
      pdfInfo = this.generarPdfRemito_(remito);
      remito.PdfURL = pdfInfo.url || '';
      remito.PdfFileId = pdfInfo.id || '';
    } catch (error) {
      throw new Error(`No se pudo generar el PDF del remito: ${error.message}`);
    }

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
      remito.Foto4Id,
      remito.PdfURL
    ];

    // 5. GUARDAR EL REMITO REALMENTE EN LA HOJA DE CÁLCULO
    try {
      RemitoRepository.guardar(remitoRowData);
    } catch (error) {
      if (pdfInfo && pdfInfo.id) {
        try {
          DriveApp.getFileById(pdfInfo.id).setTrashed(true);
        } catch (cleanupError) {
          Logger.log('No se pudo eliminar el PDF del remito %s tras un error al guardar: %s', remito.NumeroRemito, cleanupError);
        }
      }
      throw error;
    }

    // 6. Devolver el objeto remito completo (con su número asignado) al frontend
    return remito;
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