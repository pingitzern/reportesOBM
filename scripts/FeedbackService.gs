(function(global) {
  (function(ns) {
    'use strict';

    const FEEDBACK_HEADERS = Object.freeze([
      'Timestamp',
      'Usuario/Mail',
      'Categoría',
      'Impacto',
      'Mensaje',
      'Contacto Info',
      'Permitir Contacto',
      'Origen URL',
      'User Agent',
      'Estado'
    ]);

    const MIN_MESSAGE_LENGTH = 12;
    const DEFAULT_STATUS = 'Nuevo';

    function normalizeString(value) {
      if (value === null || value === undefined) {
        return '';
      }
      return String(value).trim();
    }

    function booleanLabel(value) {
      return value ? 'Sí' : 'No';
    }

    const FeedbackService = {
      getSheet_() {
        const sheetName = ns.FEEDBACK_SHEET_NAME || 'feedback';
        const sheet = ns.SheetRepository.getSheetByName(sheetName);
        this.ensureHeaders_(sheet);
        return sheet;
      },

      ensureHeaders_(sheet) {
        if (!sheet) {
          throw new Error('No se encontró la hoja de feedback.');
        }

        const headersRange = sheet.getRange(1, 1, 1, FEEDBACK_HEADERS.length);
        const currentValues = headersRange.getValues();
        const row = Array.isArray(currentValues[0]) ? currentValues[0] : [];
        const needsUpdate = FEEDBACK_HEADERS.some((header, index) => {
          return normalizeString(row[index]) !== header;
        });

        if (needsUpdate) {
          headersRange.setValues([FEEDBACK_HEADERS]);
        }

        if (sheet.getFrozenRows() < 1) {
          sheet.setFrozenRows(1);
        }
      },

      buildRow_(payload, usuarioMail) {
        const safePayload = payload && typeof payload === 'object' ? payload : {};
        const timestamp = new Date();
        const categoria = normalizeString(safePayload.categoria) || 'general';
        const impacto = normalizeString(safePayload.impacto) || 'medio';
        const mensaje = normalizeString(safePayload.mensaje);
        if (!mensaje || mensaje.length < MIN_MESSAGE_LENGTH) {
          throw new Error(`El mensaje debe tener al menos ${MIN_MESSAGE_LENGTH} caracteres.`);
        }

        const contacto = normalizeString(safePayload.contacto);
        const permitirContacto = Boolean(safePayload.permitirContacto);
        const origenUrl = normalizeString(safePayload.origenUrl || safePayload.origen_url);
        const userAgent = normalizeString(safePayload.userAgent || safePayload.user_agent);
        const estado = normalizeString(safePayload.estado) || DEFAULT_STATUS;

        return {
          rowValues: [
            timestamp,
            normalizeString(usuarioMail),
            categoria,
            impacto,
            mensaje,
            contacto,
            booleanLabel(permitirContacto),
            origenUrl,
            userAgent,
            estado
          ],
          timestamp,
          estado,
          categoria,
          impacto
        };
      },

      crearTicket(payload, usuarioMail) {
        if (!usuarioMail) {
          throw new Error('No se pudo determinar el usuario autenticado.');
        }

        const sheet = this.getSheet_();
        const rowInfo = this.buildRow_(payload, usuarioMail);
        sheet.appendRow(rowInfo.rowValues);
        const rowNumber = sheet.getLastRow();

        return {
          mensaje: 'Feedback registrado correctamente',
          estado: rowInfo.estado,
          categoria: rowInfo.categoria,
          impacto: rowInfo.impacto,
          timestamp: rowInfo.timestamp,
          rowNumber
        };
      }
    };

    ns.FeedbackService = FeedbackService;
  })(global.OBM = global.OBM || {});
})(typeof window !== 'undefined' ? window : this);
