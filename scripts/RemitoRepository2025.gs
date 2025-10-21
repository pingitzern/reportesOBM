// Contenido para RemitoRepository.gs

const REMITOS_SHEET_NAME = 'remitos';
const REMITOS_HEADERS = [
  'NumeroRemito', 'FechaCreacion', 'MailTecnico', 'NumeroReporte',
  'NombreCliente', 'Direccion', 'CUIT', 'Telefono', 'MailCliente',
  'ModeloEquipo', 'NumeroSerie', 'IDInterna',
  'Repuestos', 'Observaciones', 'IdUnico',
  'Foto1Id', 'Foto2Id', 'Foto3Id', 'Foto4Id',
  'PdfURL', 'DocFileId', 'DocURL'
];

const RemitoRepository = {
  REMITOS_HEADERS,
  /**
   * Obtiene la hoja de Remitos. Si no existe, la crea con los encabezados.
   */
  getSheet_() {
    const ss = SheetRepository.getSpreadsheet();
    let sheet = ss.getSheetByName(REMITOS_SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(REMITOS_SHEET_NAME);
      sheet.appendRow(this.REMITOS_HEADERS);
      // Inmovilizar la primera fila (encabezados)
      sheet.setFrozenRows(1);
    } else {
      // Ensure desired headers exist, but DO NOT delete or reorder custom columns added by users.
      const desiredHeaders = this.REMITOS_HEADERS;
      const lastColumn = Math.max(1, sheet.getLastColumn());
      let currentHeaders = lastColumn > 0
        ? sheet.getRange(1, 1, 1, lastColumn).getValues()[0]
        : [];

      // If header row is empty, populate with desired headers
      const hasHeaders = currentHeaders.some(value => String(value || '').trim() !== '');
      if (!hasHeaders) {
        sheet.getRange(1, 1, 1, desiredHeaders.length).setValues([desiredHeaders]);
      } else {
        // For each desired header, if it's missing, append a new column at the end and set it.
        currentHeaders = currentHeaders.slice();
        desiredHeaders.forEach(function(desiredHeader) {
          if (currentHeaders.indexOf(desiredHeader) === -1) {
            // Append column at the end
            const appendAfter = sheet.getLastColumn();
            sheet.insertColumnAfter(appendAfter || 1);
            const newCol = sheet.getLastColumn();
            sheet.getRange(1, newCol).setValue(desiredHeader);
            currentHeaders.push(desiredHeader);
          }
        });

        // Do NOT delete extra columns. Finally, ensure the first row contains at least the desired headers
        // by writing desired headers into their existing positions if they are in the sheet already.
        // (We avoid reordering to preserve user columns and formulas.)
        // No further action required.
      }
    }
    sheet.setFrozenRows(1);
    return sheet;
  },

  /**
   * Busca el último número de remito y devuelve el siguiente.
   * @returns {number} El siguiente número de remito a utilizar.
   */
  getNextRemitoNumber() {
    const sheet = this.getSheet_();
    const DEFAULT_PREFIX = 'REM-';
    const DEFAULT_PADDING = 4;

    // getLastRow() devuelve 0 si la hoja está vacía y 1 si solo tiene encabezados.
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return `${DEFAULT_PREFIX}${String(1).padStart(DEFAULT_PADDING, '0')}`;
    }

    // Obtenemos el valor de la última fila, primera columna (NumeroRemito)
    const rawValue = sheet.getRange(lastRow, 1).getValue();

    let prefix = DEFAULT_PREFIX;
    let numericPart = Number.NaN;
    let padding = DEFAULT_PADDING;

    if (typeof rawValue === 'number' && !Number.isNaN(rawValue)) {
      numericPart = rawValue;
      padding = Math.max(String(Math.trunc(rawValue)).length, DEFAULT_PADDING);
    } else if (typeof rawValue === 'string') {
      const normalized = rawValue.trim();
      if (normalized) {
        const match = normalized.match(/^(.*?)(\d+)$/);
        if (match) {
          prefix = match[1] || prefix;
          numericPart = parseInt(match[2], 10);
          padding = Math.max(match[2].length, DEFAULT_PADDING);
        } else {
          const fallback = parseInt(normalized, 10);
          if (!Number.isNaN(fallback)) {
            numericPart = fallback;
            padding = Math.max(String(fallback).length, DEFAULT_PADDING);
          }
        }
      }
    }

    if (!Number.isFinite(numericPart)) {
      // Si no pudimos interpretar el número anterior, usamos la cantidad de filas como base.
      numericPart = lastRow - 1; // No contamos la fila de encabezados.
    }

    const nextNumber = Math.max(0, Math.trunc(numericPart)) + 1;
    const padded = String(nextNumber).padStart(padding, '0');
    return `${prefix}${padded}`;
  },

  /**
   * Guarda una nueva fila con los datos de un remito.
   * @param {Array} remitoRowData - Un array con los datos del remito en el orden de REMITOS_HEADERS.
   */
  guardar(remitoRowData) {
    const sheet = this.getSheet_();
    sheet.appendRow(remitoRowData);
  },

  /**
   * Devuelve los encabezados configurados para la hoja de remitos.
   * @returns {string[]} Lista de encabezados.
   */
  getHeaders() {
    return this.REMITOS_HEADERS;
  }
};

/**
 * Script de migración para asegurar que las columnas Foto*Id y PdfURL
 * queden ordenadas según REMITOS_HEADERS.
 */
function migrarRemitosFotosYPdf2025() {
  const ss = SheetRepository.getSpreadsheet();
  const sheet = ss.getSheetByName(REMITOS_SHEET_NAME);

  if (!sheet) {
    Logger.log('No existe la hoja de remitos, no hay datos para migrar.');
    return;
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    RemitoRepository.getSheet_();
    Logger.log('No hay filas de datos que requieran migración.');
    return;
  }

  const lastColumn = sheet.getLastColumn();
  const originalData = sheet.getRange(1, 1, lastRow, lastColumn).getValues();
  const originalHeaders = originalData[0] || [];
  const headerIndexMap = {};

  originalHeaders.forEach((header, index) => {
    const normalized = String(header || '').trim();
    if (normalized && headerIndexMap[normalized] === undefined) {
      headerIndexMap[normalized] = index;
    }
  });

  const targetHeaders = RemitoRepository.REMITOS_HEADERS;
  const newData = [targetHeaders];

  for (let rowIndex = 1; rowIndex < originalData.length; rowIndex += 1) {
    const row = originalData[rowIndex];
    const newRow = targetHeaders.map(header => {
      let sourceIndex = headerIndexMap.hasOwnProperty(header) ? headerIndexMap[header] : -1;

      if (sourceIndex === -1) {
        const fotoMatch = header.match(/^Foto(\d+)Id$/);
        if (fotoMatch) {
          const fallbackHeader = `Foto${fotoMatch[1]}URL`;
          sourceIndex = headerIndexMap.hasOwnProperty(fallbackHeader) ? headerIndexMap[fallbackHeader] : -1;
        }
      }

      return sourceIndex >= 0 && sourceIndex < row.length ? row[sourceIndex] : '';
    });
    newData.push(newRow);
  }

  const requiredColumns = targetHeaders.length;
  if (sheet.getMaxColumns() < requiredColumns) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), requiredColumns - sheet.getMaxColumns());
  }

  if (sheet.getMaxRows() < newData.length) {
    sheet.insertRowsAfter(sheet.getMaxRows(), newData.length - sheet.getMaxRows());
  }

  sheet.clearContents();

  const extraColumns = sheet.getMaxColumns() - requiredColumns;
  if (extraColumns > 0) {
    sheet.deleteColumns(requiredColumns + 1, extraColumns);
  }

  sheet.getRange(1, 1, newData.length, requiredColumns).setValues(newData);
  sheet.setFrozenRows(1);

  Logger.log('Migración de columnas de remitos completada. Filas actualizadas: %s', newData.length - 1);
}
