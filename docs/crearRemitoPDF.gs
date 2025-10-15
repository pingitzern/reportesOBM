const REMITOS_FOLDER_ID = 'REEMPLAZAR_CON_ID_DE_CARPETA';

function crearRemitoPDF(remitoData) {
  if (!remitoData || typeof remitoData !== 'object') {
    throw new Error('NEEDS_INFO: remitoData es requerido.');
  }
  if (!remitoData.numero) {
    throw new Error('NEEDS_INFO: numero es requerido.');
  }
  if (!remitoData.cliente) {
    throw new Error('NEEDS_INFO: cliente es requerido.');
  }
  if (!remitoData.fecha) {
    throw new Error('NEEDS_INFO: fecha es requerida.');
  }
  if (!REMITOS_FOLDER_ID) {
    throw new Error('NEEDS_INFO: Configurar REMITOS_FOLDER_ID.');
  }

  const folder = DriveApp.getFolderById(REMITOS_FOLDER_ID);
  const timestamp = new Date().getTime();
  const doc = DocumentApp.create('Remito Temporal ' + remitoData.numero + ' ' + timestamp);
  const docId = doc.getId();
  const body = doc.getBody();
  body.clear();

  body.setMarginTop(36);
  body.setMarginBottom(36);
  body.setMarginLeft(36);
  body.setMarginRight(36);

  body.appendParagraph('Remito de Servicio').setHeading(DocumentApp.ParagraphHeading.HEADING1);

  const metaTable = body.appendTable([
    ['Número', remitoData.numero],
    ['Fecha', remitoData.fecha],
    ['Reporte', remitoData.reporte || ''],
    ['Cliente', remitoData.cliente],
    ['Dirección', remitoData.direccion || ''],
    ['Teléfono', remitoData.telefono || ''],
    ['Correo', remitoData.correo || ''],
    ['CUIT', remitoData.cuit || ''],
    ['Modelo', remitoData.modelo || ''],
    ['Serie', remitoData.serie || ''],
    ['ID Interna', remitoData.idInterna || ''],
    ['Técnico', remitoData.tecnico || '']
  ]);
  metaTable.setBorderWidth(0);
  for (var i = 0; i < metaTable.getNumRows(); i++) {
    var row = metaTable.getRow(i);
    row.getCell(0).setBackgroundColor('#f2f2f2');
    row.getCell(0).setPaddingLeft(6);
    row.getCell(0).setPaddingRight(6);
    row.getCell(1).setPaddingLeft(6);
    row.getCell(1).setPaddingRight(6);
    row.getCell(0).editAsText().setBold(true);
  }

  body.appendParagraph('Repuestos Utilizados').setHeading(DocumentApp.ParagraphHeading.HEADING2);
  if (remitoData.repuestos && remitoData.repuestos.length) {
    var repuestosList = body.appendListItem(remitoData.repuestos[0]);
    repuestosList.setGlyphType(DocumentApp.GlyphType.BULLET);
    for (var r = 1; r < remitoData.repuestos.length; r++) {
      body.appendListItem(remitoData.repuestos[r]).setGlyphType(DocumentApp.GlyphType.BULLET);
    }
  } else {
    body.appendParagraph('Sin repuestos declarados.');
  }

  body.appendParagraph('Observaciones').setHeading(DocumentApp.ParagraphHeading.HEADING2);
  body.appendParagraph(remitoData.observaciones || '');

  body.appendPageBreak();
  body.appendParagraph('Registro Fotográfico').setHeading(DocumentApp.ParagraphHeading.HEADING2);

  var fotos = Array.isArray(remitoData.fotosIds) ? remitoData.fotosIds.slice(0, 4) : [];
  var photoTable = body.appendTable();
  while (photoTable.getNumRows() > 0) {
    photoTable.removeRow(0);
  }
  photoTable.setBorderWidth(0);
  var maxWidth = 240;
  var maxHeight = 320;

  for (var rowIndex = 0; rowIndex < 2; rowIndex++) {
    var row = photoTable.appendTableRow();
    for (var colIndex = 0; colIndex < 2; colIndex++) {
      var cell = row.appendTableCell();
      cell.setPaddingTop(6);
      cell.setPaddingBottom(6);
      cell.setPaddingLeft(6);
      cell.setPaddingRight(6);
      cell.setVerticalAlignment(DocumentApp.VerticalAlignment.MIDDLE);
      var photoIndex = rowIndex * 2 + colIndex;
      if (photoIndex < fotos.length) {
        try {
          var file = DriveApp.getFileById(fotos[photoIndex]);
          var blob = file.getBlob();
          var pngBlob = Utilities.newBlob(blob.getBytes(), blob.getContentType(), file.getName());
          pngBlob = pngBlob.getAs('image/png');
          pngBlob.setName(file.getName() + '.png');
          while (cell.getNumChildren() > 0) {
            cell.removeChild(cell.getChild(0));
          }
          var paragraph = cell.appendParagraph('');
          paragraph.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
          var image = paragraph.addInlineImage(pngBlob);
          var width = image.getWidth();
          var height = image.getHeight();
          if (width > 0 && height > 0) {
            var scale = Math.min(maxWidth / width, maxHeight / height, 1);
            image.setWidth(Math.round(width * scale));
            image.setHeight(Math.round(height * scale));
          }
          var caption = cell.appendParagraph('Foto ' + (photoIndex + 1));
          caption.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
          caption.setSpacingBefore(4);
          caption.setFontSize(9);
        } catch (e) {
          while (cell.getNumChildren() > 0) {
            cell.removeChild(cell.getChild(0));
          }
          var errorParagraph = cell.appendParagraph('Foto no disponible');
          errorParagraph.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
          errorParagraph.editAsText().setForegroundColor('#888888');
        }
      } else {
        while (cell.getNumChildren() > 0) {
          cell.removeChild(cell.getChild(0));
        }
        var placeholderParagraph = cell.appendParagraph('—');
        placeholderParagraph.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
        placeholderParagraph.editAsText().setForegroundColor('#888888');
      }
    }
  }

  doc.saveAndClose();

  var docFile = DriveApp.getFileById(docId);
  var pdfName = 'Remito ' + remitoData.numero + ' - ' + remitoData.cliente + '.pdf';
  var pdfBlob = docFile.getAs('application/pdf').setName(pdfName);
  var pdfFile = folder.createFile(pdfBlob);

  docFile.setTrashed(true);

  return {
    pdfFileId: pdfFile.getId(),
    pdfUrl: pdfFile.getUrl(),
    name: pdfFile.getName()
  };
}

// Ejemplo de uso:
// const resultado = crearRemitoPDF({
//   numero: 'REM-0027',
//   fecha: '2025-10-11 13:57',
//   reporte: 'Cambio de bomba',
//   cliente: 'Cliente Demo',
//   direccion: 'Av. Siempre Viva 742',
//   telefono: '+54 11 1234-5678',
//   correo: 'cliente@example.com',
//   cuit: '30-12345678-9',
//   modelo: 'Modelo X',
//   serie: 'SN123456',
//   idInterna: 'ID-987',
//   tecnico: 'tecnico@example.com',
//   repuestos: ['Bomba', 'Filtro'],
//   observaciones: 'Equipo funcionando correctamente.',
//   fotosIds: ['ID_FOTO_1', 'ID_FOTO_2']
// });
// Logger.log(resultado);
