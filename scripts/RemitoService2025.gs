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

const RemitoService = {
  fotosFolderCache: null,

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
    try {
      const resumen = this.buildRemitoResumenTexto_(remito);
      this.enviarRemitoPorCorreo_(remito, resumen);
    } catch (emailError) {
      Logger.log('No se pudo enviar el correo del remito %s: %s', remito.NumeroRemito, emailError);
    }

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

  buildRemitoPdfAdjunto_(remito, resumen) {
    try {
      const doc = DocumentApp.create(`Remito-${remito.NumeroRemito || Utilities.getUuid()}`);
      const body = doc.getBody();
      body.appendParagraph('Remito de Servicio').setHeading(DocumentApp.ParagraphHeading.HEADING1);
      body.appendParagraph(`Número: ${remito.NumeroRemito || 'Sin número'}`);
      if (remito.FechaCreacion) {
        const fecha = Utilities.formatDate(new Date(remito.FechaCreacion), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
        body.appendParagraph(`Fecha: ${fecha}`);
      }
      body.appendParagraph(`Cliente: ${remito.NombreCliente || 'Sin cliente'}`);
      if (remito.Direccion) {
        body.appendParagraph(`Dirección: ${remito.Direccion}`);
      }
      if (remito.NumeroReporte) {
        body.appendParagraph(`Reporte asociado: ${remito.NumeroReporte}`);
      }
      if (remito.ModeloEquipo || remito.NumeroSerie) {
        const partes = [];
        if (remito.ModeloEquipo) {
          partes.push(`Modelo ${remito.ModeloEquipo}`);
        }
        if (remito.NumeroSerie) {
          partes.push(`N° Serie ${remito.NumeroSerie}`);
        }
        body.appendParagraph(`Equipo: ${partes.join(' - ')}`);
      }
      if (remito.Repuestos) {
        body.appendParagraph(`Repuestos utilizados: ${remito.Repuestos}`);
      }
      if (remito.Observaciones) {
        body.appendParagraph(`Observaciones: ${remito.Observaciones}`);
      }
      if (resumen) {
        body.appendParagraph('').appendText(resumen);
      }
      doc.saveAndClose();

      const file = DriveApp.getFileById(doc.getId());
      const pdfBlob = file.getAs('application/pdf');
      pdfBlob.setName(`Remito-${remito.NumeroRemito || 'sin-numero'}.pdf`);
      file.setTrashed(true);

      return pdfBlob;
    } catch (error) {
      Logger.log('No se pudo generar el PDF del remito %s: %s', remito.NumeroRemito, error);
      return null;
    }
  },

  enviarRemitoPorCorreo_(remito, resumen) {
    const destinatario = REMITO_NOTIFICATIONS_EMAIL;
    if (!destinatario) {
      return;
    }

    const subject = this.buildRemitoEmailSubject_(remito);
    const body = this.buildRemitoEmailBody_(remito, resumen);
    const pdf = this.buildRemitoPdfAdjunto_(remito, resumen);

    const opciones = {
      name: 'Remitos OBM',
    };

    if (pdf) {
      opciones.attachments = [pdf];
    }

    MailApp.sendEmail(destinatario, subject, body, opciones);
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
