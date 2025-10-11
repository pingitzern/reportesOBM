// Contenido para RemitoRepository.gs

const REMITOS_SHEET_NAME = 'remitos';
const REMITOS_HEADERS = [
  'NumeroRemito', 'FechaCreacion', 'MailTecnico', 'NumeroReporte',
  'NombreCliente', 'Direccion', 'CUIT', 'Telefono', 'MailCliente',
  'ModeloEquipo', 'NumeroSerie', 'IDInterna',
  'Repuestos', 'Observaciones', 'IdUnico',
  'Foto1URL', 'Foto2URL', 'Foto3URL', 'Foto4URL',
  'PdfURL'
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
      const lastColumn = sheet.getLastColumn();
      if (lastColumn >= 1) {
        const currentHeaders = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
        const missingHeaders = this.REMITOS_HEADERS.filter(header => currentHeaders.indexOf(header) === -1);
        if (missingHeaders.length > 0) {
          sheet.insertColumnsAfter(lastColumn, missingHeaders.length);
          sheet.getRange(1, lastColumn + 1, 1, missingHeaders.length).setValues([missingHeaders]);
        }
      } else {
        sheet.appendRow(this.REMITOS_HEADERS);
        sheet.setFrozenRows(1);
      }
    }
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
