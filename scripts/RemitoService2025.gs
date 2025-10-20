// Contenido para RemitoService.gs

const REMITO_FOTOS_FOLDER_ID = '1SH7Zz7g_2sbYsFHMfVQj3Admdy8L3FVz';
const REMITO_PDF_FOLDER_ID = '1BKBPmndOGet7yVZ4UtFCkhrt402eXH4X';
const MAX_REMITO_FOTOS = 4;

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

  buildDriveImageDataUrl_(fileId) {
    const normalizedId = this.extractDriveFileIdFromValue_(fileId);
    if (!normalizedId) {
      return '';
    }

    try {
      const file = DriveApp.getFileById(normalizedId);
      const blob = file.getBlob();
      const mimeType = blob.getContentType() || 'image/jpeg';
      const base64 = Utilities.base64Encode(blob.getBytes());
      return `data:${mimeType};base64,${base64}`;
    } catch (error) {
      Logger.log('No se pudo obtener el blob de la imagen %s para incrustarla en el PDF: %s', normalizedId, error);
    }

    return '';
  },

  buildPdfTemplateData_(remito) {
    const normalize = value => this.normalizeForPdf_(value);
    const fallback = value => {
      const normalized = normalize(value);
      return normalized || '—';
    };

    const fotoSources = [
      remito.Foto1Id || remito.Foto1URL,
      remito.Foto2Id || remito.Foto2URL,
      remito.Foto3Id || remito.Foto3URL,
      remito.Foto4Id || remito.Foto4URL
    ];

    const fotos = fotoSources
      .map(source => {
        const embedded = this.buildDriveImageDataUrl_(source);
        if (embedded) {
          return embedded;
        }
        return this.normalizeDriveUrl_(source);
      })
      .filter(url => !!url);

    const detalles = [
      { label: 'Número de remito', value: fallback(remito.NumeroRemito) },
      { label: 'Fecha de creación', value: this.formatDateForPdf_(remito.FechaCreacion) || '—' },
      { label: 'Número de reporte', value: fallback(remito.NumeroReporte) },
      { label: 'Cliente', value: fallback(remito.NombreCliente) },
      { label: 'Dirección', value: fallback(remito.Direccion) },
      { label: 'Teléfono', value: fallback(remito.Telefono) },
      { label: 'Correo del cliente', value: fallback(remito.MailCliente) },
      { label: 'CUIT', value: fallback(remito.CUIT) },
      { label: 'Modelo de equipo', value: fallback(remito.ModeloEquipo) },
      { label: 'Número de serie', value: fallback(remito.NumeroSerie) },
      { label: 'ID interna', value: fallback(remito.IDInterna) },
      { label: 'Técnico responsable', value: fallback(remito.MailTecnico) }
    ];

    return {
      titulo: 'Remito de Servicio',
      fechaGeneracion: this.formatDateForPdf_(new Date()),
      detalles,
      repuestos: normalize(remito.Repuestos) || 'No se registraron repuestos reemplazados.',
      observaciones: normalize(remito.Observaciones) || 'Sin observaciones adicionales.',
      fotos: fotos.map(url => ({ url })),
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
      Logger.log('URLs de fotos finales pasadas al template del PDF: %s', JSON.stringify(reporte.fotos.map(f => f.url)));
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

    // 2. Extraer los componentes "Cambiado" del reporte para el listado de repuestos
    const repuestosCambiados = Object.entries(reporteData)
      .filter(([key, value]) => key.startsWith('etapa') && key.endsWith('_accion') && value === 'Cambiado')
      .map(([key]) => {
        const etapaNum = key.match(/\d+/)[0]; // Extrae el número de la etapa (ej. "etapa1" -> "1")
        return `Filtro Etapa ${etapaNum}`;
      })
      .join(', '); // Une todos los repuestos encontrados con una coma

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
      Repuestos: repuestosCambiados || 'No se reemplazaron componentes.',
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