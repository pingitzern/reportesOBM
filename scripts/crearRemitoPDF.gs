const REMITOS_FOLDER_ID = '1BKBPmndOGet7yVZ4UtFCkhrt402eXH4X';

function crearRemitoPDF(remitoData) {
  validarRemitoData_(remitoData);

  if (!REMITOS_FOLDER_ID) {
    throw new Error('NEEDS_INFO: Configurar REMITOS_FOLDER_ID.');
  }

  const folder = DriveApp.getFolderById(REMITOS_FOLDER_ID);
  const templateData = buildTemplateData_(remitoData);

  const template = HtmlService.createTemplateFromFile('remito-pdf-template');
  template.reporte = templateData;

  const htmlOutput = template.evaluate();
  const htmlContent = htmlOutput.getContent();
  const pdfBaseName = buildPdfBaseName_(remitoData);
  const pdfBlob = Utilities
    .newBlob(htmlContent, 'text/html', `${pdfBaseName}.html`)
    .getAs(MimeType.PDF)
    .setName(`${pdfBaseName}.pdf`);

  const pdfFile = folder.createFile(pdfBlob);
  pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return {
    pdfFileId: pdfFile.getId(),
    pdfUrl: pdfFile.getUrl(),
    name: pdfFile.getName()
  };
}

function validarRemitoData_(remitoData) {
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
}

function buildTemplateData_(remitoData) {
  const detalles = [
    { label: 'Número de remito', value: normalizeText_(remitoData.numero) },
    { label: 'Fecha de creación', value: formatDate_(remitoData.fecha) },
    { label: 'Número de reporte', value: normalizeText_(remitoData.reporte) },
    { label: 'Cliente', value: normalizeText_(remitoData.cliente) },
    { label: 'Dirección', value: normalizeText_(remitoData.direccion) },
    { label: 'Teléfono', value: normalizeText_(remitoData.telefono) },
    { label: 'Correo del cliente', value: normalizeText_(remitoData.correo) },
    { label: 'CUIT', value: normalizeText_(remitoData.cuit) },
    { label: 'Modelo de equipo', value: normalizeText_(remitoData.modelo) },
    { label: 'Número de serie', value: normalizeText_(remitoData.serie) },
    { label: 'ID interna', value: normalizeText_(remitoData.idInterna) },
    { label: 'Técnico responsable', value: normalizeText_(remitoData.tecnico) }
  ];

  const repuestos = Array.isArray(remitoData.repuestos)
    ? remitoData.repuestos
      .map(item => normalizeText_(item))
      .filter(text => text !== '—')
      .map(text => `• ${text}`)
      .join('\n')
    : normalizeText_(remitoData.repuestos);

  return {
    titulo: 'Remito de Servicio',
    fechaGeneracion: formatDate_(new Date()),
    detalles,
    repuestos: repuestos !== '—' ? repuestos : 'No se registraron repuestos reemplazados.',
    observaciones: (function () {
      const observacionesNormalizadas = normalizeText_(remitoData.observaciones);
      return observacionesNormalizadas !== '—'
        ? observacionesNormalizadas
        : 'Sin observaciones adicionales.';
    }()),
    fotos: buildFotosParaTemplate_(remitoData.fotosIds),
    nota: 'Documento generado automáticamente a partir del sistema de reportes OBM.'
  };
}

function buildFotosParaTemplate_(fotosIds) {
  if (!Array.isArray(fotosIds) || fotosIds.length === 0) {
    return [];
  }

  const maxFotos = 4;
  const fotos = [];

  for (let index = 0; index < fotosIds.length && fotos.length < maxFotos; index += 1) {
    const fotoId = fotosIds[index];
    if (!fotoId) {
      continue;
    }

    try {
      const file = DriveApp.getFileById(fotoId);
      const blob = file.getBlob().getAs(MimeType.PNG);
      const base64 = Utilities.base64Encode(blob.getBytes());
      fotos.push({
        url: `data:image/png;base64,${base64}`
      });
    } catch (error) {
      Logger.log('No se pudo agregar la foto %s al PDF del remito: %s', fotoId, error && error.message);
    }
  }

  return fotos;
}

function buildPdfBaseName_(remitoData) {
  const numero = (remitoData.numero || 'REMITO').replace(/[\\/:*?"<>|]+/g, '-');
  const cliente = (remitoData.cliente || '').trim();
  const sanitizedCliente = cliente ? cliente.replace(/[\\/:*?"<>|]+/g, '-').slice(0, 120) : 'Sin-cliente';
  return `Remito ${numero} - ${sanitizedCliente}`.trim();
}

function normalizeText_(value) {
  if (value === null || value === undefined) {
    return '—';
  }

  const text = String(value).trim();
  return text ? text : '—';
}

function formatDate_(value) {
  const timezone = Session.getScriptTimeZone ? Session.getScriptTimeZone() : 'America/Buenos_Aires';

  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, timezone, 'dd/MM/yyyy HH:mm');
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) {
      return Utilities.formatDate(parsed, timezone, 'dd/MM/yyyy HH:mm');
    }
    return value.trim();
  }

  return '—';
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
