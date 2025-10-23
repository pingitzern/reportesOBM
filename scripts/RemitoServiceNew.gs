// RemitoServiceNew - MVP implementation
// - Saves uploaded photos (base64) into a configured Drive folder
// - Creates a Google Doc containing report info + images
// - Exports the Doc as PDF into a configured PDFs folder
// - Returns file IDs and drive URLs for the created Doc and PDF

// Configure these two IDs with the Drive folders you provided
const REMITO_PDFS_FOLDER_ID = '1BKBPmndOGet7yVZ4UtFCkhrt402eXH4X'; // folder for generated PDFs
const REMITO_PHOTOS_FOLDER_ID = '1SH7Zz7g_2sbYsFHMfVQj3Admdy8L3FVz'; // folder for uploaded photos

function buildDriveDirectUrl(fileId) {
  return `https://drive.google.com/uc?export=view&id=${encodeURIComponent(fileId)}`;
}

function savePhotoBase64ToDrive(base64Data, mimeType, fileName) {
  const folder = DriveApp.getFolderById(REMITO_PHOTOS_FOLDER_ID);
  const bytes = Utilities.base64Decode(base64Data);
  const blob = Utilities.newBlob(bytes, mimeType, fileName || `photo_${Date.now()}`);
  const file = folder.createFile(blob);
  return file;
}

function saveExistingDriveFileToFolder(fileId) {
  // Make a copy of an existing Drive file into our photos folder to keep ownership/consistency
  const original = DriveApp.getFileById(fileId);
  const folder = DriveApp.getFolderById(REMITO_PHOTOS_FOLDER_ID);
  const copy = original.makeCopy(original.getName(), folder);
  return copy;
}

function createDocWithImages(reportInfo, photoFileIds, docName) {
  const doc = DocumentApp.create(docName || `Remito ${new Date().toISOString()}`);
  const body = doc.getBody();

  // Header with basic report info
  body.appendParagraph('REMITO').setHeading(DocumentApp.ParagraphHeading.HEADING1);
  if (reportInfo && typeof reportInfo === 'object') {
    const lines = [];
    if (reportInfo.NumeroRemito) lines.push(`Número: ${reportInfo.NumeroRemito}`);
    if (reportInfo.cliente || reportInfo.clienteNombre) lines.push(`Cliente: ${reportInfo.clienteNombre || reportInfo.cliente}`);
    if (reportInfo.direccion) lines.push(`Dirección: ${reportInfo.direccion}`);
    if (reportInfo.fecha_display || reportInfo.fecha) lines.push(`Fecha: ${reportInfo.fecha_display || reportInfo.fecha}`);
    if (reportInfo.observaciones) lines.push(`Observaciones: ${reportInfo.observaciones}`);
    lines.forEach(l => body.appendParagraph(l));
  }

  // Append images
  if (Array.isArray(photoFileIds) && photoFileIds.length) {
    body.appendParagraph('Fotos:');
    photoFileIds.forEach((fid) => {
      try {
        const blob = DriveApp.getFileById(fid).getBlob();
        const img = body.appendImage(blob);
        try { img.setWidth(500); } catch (e) { /* ignore if not supported */ }
        body.appendParagraph('');
      } catch (e) {
        // ignore missing files
        body.appendParagraph(`(imagen no disponible: ${fid})`);
      }
    });
  }

  doc.saveAndClose();
  return doc.getId();
}

function exportDocToPdfInFolder(docId, pdfName) {
  const pdfBlob = DriveApp.getFileById(docId).getAs(MimeType.PDF);
  const folder = DriveApp.getFolderById(REMITO_PDFS_FOLDER_ID);
  const file = folder.createFile(pdfBlob).setName(pdfName || `remito-${docId}.pdf`);
  return file;
}

const RemitoServiceNew = {
  crearRemito(reporteData, observaciones, usuarioMail, fotos) {
    // reporteData: object
    // fotos: array of { base64Data, mimeType, fileName } or { driveFileId }
    const createdPhotoFileIds = [];
    try {
      if (Array.isArray(fotos)) {
        fotos.forEach((f, idx) => {
          if (!f) return;
          if (f.driveFileId) {
            const copy = saveExistingDriveFileToFolder(f.driveFileId);
            createdPhotoFileIds.push(copy.getId());
          } else if (f.base64Data) {
            const name = f.fileName || `remito-photo-${Date.now()}-${idx + 1}`;
            const file = savePhotoBase64ToDrive(f.base64Data, f.mimeType || 'image/jpeg', name);
            createdPhotoFileIds.push(file.getId());
          }
        });
      }

      // Build a document with images
      const numero = `R-${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss')}`;
      const docName = `Remito ${numero}`;
      const mergedReport = Object.assign({}, reporteData || {});
      mergedReport.observaciones = observaciones || mergedReport.observaciones || '';
      mergedReport.NumeroRemito = numero;

      const docId = createDocWithImages(mergedReport, createdPhotoFileIds, docName);
      const pdfFile = exportDocToPdfInFolder(docId, `${docName}.pdf`);

      return {
        NumeroRemito: numero,
        DocFileId: docId,
        DocUrl: buildDriveDirectUrl(docId),
        PdfFileId: pdfFile.getId(),
        PdfUrl: buildDriveDirectUrl(pdfFile.getId()),
        PhotoFileIds: createdPhotoFileIds
      };
    } catch (error) {
      throw new Error(`Error creando remito: ${error.message}`);
    }
  },

  obtenerRemitos(page = 1, pageSize = 20) {
    return { remitos: [], page, pageSize };
  }
};

// expose symbol for router
this.RemitoServiceNew = RemitoServiceNew;
