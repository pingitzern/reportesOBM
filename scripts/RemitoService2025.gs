// Contenido para RemitoService.gs

const REMITO_FOTOS_FOLDER_ID = '1SH7Zz7g_2sbYsFHMfVQj3Admdy8L3FVz';
const REMITO_PDF_FOLDER_ID = '1BKBPmndOGet7yVZ4UtFCkhrt402eXH4X';
const MAX_REMITO_FOTOS = 4;

const A4_PAGE_WIDTH_POINTS = 595.28; // 210 mm
const A4_PAGE_HEIGHT_POINTS = 841.89; // 297 mm
const A4_PAGE_MARGIN_POINTS = 36; // ~0.5 pulgadas
const REMITO_FOTO_MAX_WIDTH_POINTS = A4_PAGE_WIDTH_POINTS - (A4_PAGE_MARGIN_POINTS * 2);
const REMITO_FOTO_MAX_HEIGHT_POINTS = 260;

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

  configurarPaginaPdf_(body) {
    if (!body || typeof body.setAttributes !== 'function') {
      return;
    }

    const atributosPagina = {};
    atributosPagina[DocumentApp.Attribute.PAGE_WIDTH] = A4_PAGE_WIDTH_POINTS;
    atributosPagina[DocumentApp.Attribute.PAGE_HEIGHT] = A4_PAGE_HEIGHT_POINTS;
    atributosPagina[DocumentApp.Attribute.MARGIN_TOP] = A4_PAGE_MARGIN_POINTS;
    atributosPagina[DocumentApp.Attribute.MARGIN_BOTTOM] = A4_PAGE_MARGIN_POINTS;
    atributosPagina[DocumentApp.Attribute.MARGIN_LEFT] = A4_PAGE_MARGIN_POINTS;
    atributosPagina[DocumentApp.Attribute.MARGIN_RIGHT] = A4_PAGE_MARGIN_POINTS;

    try {
      body.setAttributes(atributosPagina);
    } catch (error) {
      Logger.log('No se pudieron aplicar los márgenes y el tamaño de página A4: %s', error);
    }
  },

  generarPdfRemito_(remito) {
    const folder = this.getPdfFolder_();
    const fileBase = this.buildPdfFileBase_(remito.NumeroRemito, remito.NombreCliente);
    const documentName = `Remito-${fileBase}`;

    const document = DocumentApp.create(documentName);
    const documentId = document.getId();
    let pdfFile = null;

    try {
      const body = document.getBody();
      body.clear();

      this.configurarPaginaPdf_(body);

      body.appendParagraph('Remito de Servicio').setHeading(DocumentApp.ParagraphHeading.HEADING1);
      body.appendParagraph(`Generado el ${this.formatDateForPdf_(new Date())}`)
        .setHeading(DocumentApp.ParagraphHeading.HEADING3);

      const detalles = [
        ['Número de remito', this.normalizeForPdf_(remito.NumeroRemito)],
        ['Fecha de creación', this.formatDateForPdf_(remito.FechaCreacion)],
        ['Número de reporte', this.normalizeForPdf_(remito.NumeroReporte)],
        ['Cliente', this.normalizeForPdf_(remito.NombreCliente)],
        ['Dirección', this.normalizeForPdf_(remito.Direccion)],
        ['Teléfono', this.normalizeForPdf_(remito.Telefono)],
        ['Correo del cliente', this.normalizeForPdf_(remito.MailCliente)],
        ['CUIT', this.normalizeForPdf_(remito.CUIT)],
        ['Modelo de equipo', this.normalizeForPdf_(remito.ModeloEquipo)],
        ['Número de serie', this.normalizeForPdf_(remito.NumeroSerie)],
        ['ID interna', this.normalizeForPdf_(remito.IDInterna)],
        ['Técnico responsable', this.normalizeForPdf_(remito.MailTecnico)]
      ];

      const table = body.appendTable(detalles);
      for (let i = 0; i < table.getNumRows(); i += 1) {
        const cell = table.getRow(i).getCell(0);
        cell.setBackgroundColor('#f1f5f9');
        const text = cell.editAsText();
        if (text) {
          text.setBold(true);
        }
      }

      body.appendParagraph('Repuestos reemplazados').setHeading(DocumentApp.ParagraphHeading.HEADING2);
      body.appendParagraph(this.normalizeForPdf_(remito.Repuestos) || 'No se registraron repuestos reemplazados.');

      body.appendParagraph('Observaciones').setHeading(DocumentApp.ParagraphHeading.HEADING2);
      body.appendParagraph(this.normalizeForPdf_(remito.Observaciones) || 'Sin observaciones adicionales.');

      const fotos = [
        this.normalizeForPdf_(remito.Foto1URL),
        this.normalizeForPdf_(remito.Foto2URL),
        this.normalizeForPdf_(remito.Foto3URL),
        this.normalizeForPdf_(remito.Foto4URL)
      ].filter(url => !!url);

      if (fotos.length > 0) {
        body.appendParagraph('Registro fotográfico').setHeading(DocumentApp.ParagraphHeading.HEADING2);
        this.appendFotosGrid_(body, fotos);
      }

      body.appendParagraph(' ');
      body.appendParagraph('Documento generado automáticamente a partir del sistema de reportes OBM.');

      document.saveAndClose();

      const docFile = DriveApp.getFileById(documentId);
      const pdfBlob = docFile.getAs(MimeType.PDF).setName(`${documentName}.pdf`);
      pdfFile = folder.createFile(pdfBlob);
      pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

      return {
        id: pdfFile.getId(),
        url: pdfFile.getUrl(),
        name: pdfFile.getName()
      };
    } catch (error) {
      throw new Error(`No se pudo componer el PDF del remito: ${error.message}`);
    } finally {
      try {
        document.saveAndClose();
      } catch (closeError) {
        // Ignorar errores al cerrar si ya está cerrado
      }

      if (documentId) {
        try {
          DriveApp.getFileById(documentId).setTrashed(true);
        } catch (cleanupError) {
          Logger.log('No se pudo eliminar el documento temporal del remito %s: %s', remito.NumeroRemito, cleanupError);
        }
      }
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

  extractDriveFileId_(url) {
    if (typeof url !== 'string') {
      return '';
    }

    const trimmed = url.trim();
    if (!trimmed) {
      return '';
    }

    const idMatch = trimmed.match(/[-\w]{25,}/);
    return idMatch ? idMatch[0] : '';
  },

  ajustarImagenParaPdf_(image) {
    if (!image || typeof image.getWidth !== 'function' || typeof image.getHeight !== 'function') {
      return;
    }

    const anchoActual = typeof image.getWidth === 'function' ? Number(image.getWidth()) : 0;
    const altoActual = typeof image.getHeight === 'function' ? Number(image.getHeight()) : 0;

    if (anchoActual <= 0 || altoActual <= 0) {
      return;
    }

    const factorAncho = REMITO_FOTO_MAX_WIDTH_POINTS / anchoActual;
    const factorAlto = REMITO_FOTO_MAX_HEIGHT_POINTS / altoActual;
    const factorEscala = Math.min(factorAncho, factorAlto, 1);

    if (factorEscala >= 1) {
      return;
    }

    const nuevoAncho = Math.max(1, Math.round(anchoActual * factorEscala));
    const nuevoAlto = Math.max(1, Math.round(altoActual * factorEscala));

    try {
      image.setWidth(nuevoAncho);
      image.setHeight(nuevoAlto);
    } catch (error) {
      Logger.log('No se pudo ajustar la imagen del remito: %s', error);
    }
  },

  tryAppendImageFromUrl_(container, url) {
    if (!container || typeof container.appendImage !== 'function') {
      return false;
    }

    const driveFileId = this.extractDriveFileId_(url);
    if (!driveFileId) {
      return false;
    }

    try {
      const blob = DriveApp.getFileById(driveFileId).getBlob();
      const image = container.appendImage(blob);
      this.ajustarImagenParaPdf_(image);
      const parent = typeof image.getParent === 'function' ? image.getParent() : null;
      if (parent && typeof parent.setAlignment === 'function') {
        parent.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
        if (typeof parent.setSpacingBefore === 'function') {
          parent.setSpacingBefore(0);
        }
        if (typeof parent.setSpacingAfter === 'function') {
          parent.setSpacingAfter(0);
        }
      }
      return true;
    } catch (error) {
      Logger.log('No se pudo insertar la imagen %s en el PDF: %s', url, error);
      return false;
    }
  },

  appendFotosGrid_(body, fotos) {
    if (!body || typeof body.appendTable !== 'function') {
      return;
    }

    if (!Array.isArray(fotos) || fotos.length === 0) {
      return;
    }

    const columnas = 2;
    const filas = Math.ceil(fotos.length / columnas);
    const tablaInicial = Array.from({ length: filas }, () => new Array(columnas).fill(''));
    const tabla = body.appendTable(tablaInicial);
    tabla.setBorderWidth(0);

    for (let fila = 0; fila < filas; fila += 1) {
      const filaTabla = tabla.getRow(fila);

      for (let columna = 0; columna < columnas; columna += 1) {
        const indiceFoto = (fila * columnas) + columna;
        const celda = filaTabla.getCell(columna);
        celda.clear();
        celda.setPaddingTop(8);
        celda.setPaddingBottom(8);
        celda.setPaddingLeft(8);
        celda.setPaddingRight(8);
        celda.setVerticalAlignment(DocumentApp.VerticalAlignment.TOP);

        if (indiceFoto >= fotos.length) {
          celda.setBorderWidth(0);
          continue;
        }

        celda.setBorderWidth(1);
        celda.setBorderColor('#eeeeee');

        const titulo = celda.appendParagraph(`Foto ${indiceFoto + 1}`);
        titulo.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
        titulo.setBold(true);
        titulo.setFontSize(10);
        titulo.setSpacingBefore(0);
        titulo.setSpacingAfter(4);
        titulo.setKeepWithNext(true);

        const imagenInsertada = this.tryAppendImageFromUrl_(celda, fotos[indiceFoto]);
        if (!imagenInsertada) {
          const enlace = celda.appendParagraph(fotos[indiceFoto]);
          enlace.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
          enlace.setFontSize(9);
          enlace.setSpacingBefore(4);
        }
      }
    }
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
      const existingUrl = typeof foto.url === 'string' ? foto.url.trim() : '';

      if (!base64Data) {
        resultados[i] = existingUrl;
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
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        resultados[i] = file.getUrl();
      } catch (error) {
        throw new Error(`No se pudo guardar la foto ${i + 1} en Drive: ${error.message}`);
      }
    }

    return resultados;
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
    for (let i = 0; i < MAX_REMITO_FOTOS; i += 1) {
      remito[`Foto${i + 1}URL`] = fotosProcesadas[i] || '';
    }

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
      remito.Foto1URL,
      remito.Foto2URL,
      remito.Foto3URL,
      remito.Foto4URL,
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
    const dataRange = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn());
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