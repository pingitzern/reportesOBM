function dailySessionsCleanup() {
  const ns = this.OBM = this.OBM || {};
  if (typeof ns.dailySessionsCleanup !== 'function') {
    throw new Error('OBM.dailySessionsCleanup is not defined');
  }
  return ns.dailySessionsCleanup();
}

(function(global) {
  (function(ns) {
    'use strict';

const SessionService = {
  // guardamos sesiones en la MISMA planilla, pestaña 'sessions'
  SHEET_NAME: 'sessions',

  // Configuraciones
  SESSION_TTL_MIN: 60,     // minutos de validez del token
  CLEAN_KEEP_DAYS: 7,      // borrar sesiones expiradas hace > 7 días

  getSheet_() {
    const ss = ns.SheetRepository.getSpreadsheet();
    let sheet = ss.getSheetByName(this.SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(this.SHEET_NAME);
      sheet.appendRow(['token', 'mail', 'createdAtIso', 'expiresAtIso', 'revoked']);
    }
    return sheet;
  },

  now_() { return new Date(); },
  addMinutes_(date, minutes) { return new Date(date.getTime() + minutes * 60000); },
  addDays_(date, days) { return new Date(date.getTime() + days * 86400000); },

  iso_(d) {
    const tz = Session.getScriptTimeZone ? Session.getScriptTimeZone() : 'GMT';
    return Utilities.formatDate(d, tz, "yyyy-MM-dd'T'HH:mm:ssXXX");
  },

  uuid_() {
    return Utilities.getUuid();
  },

  createSession(mail) {
    const sheet = this.getSheet_();
    const token = this.uuid_();
    const now = this.now_();
    const expires = this.addMinutes_(now, this.SESSION_TTL_MIN);

    sheet.appendRow([token, mail, this.iso_(now), this.iso_(expires), 'false']);
    return { token, mail, createdAt: this.iso_(now), expiresAt: this.iso_(expires) };
  },

  validateSession(token, opts = { renew: false }) {
    if (!token) throw new Error('Falta token');

    const sheet = this.getSheet_();
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const rows = data.slice(1);

    const idx = {
      token: headers.indexOf('token'),
      mail: headers.indexOf('mail'),
      expiresAtIso: headers.indexOf('expiresAtIso'),
      revoked: headers.indexOf('revoked')
    };

    const i = rows.findIndex(r => String(r[idx.token]) === String(token));
    if (i === -1) throw new Error('Token inválido');

    const row = rows[i];
    if (String(row[idx.revoked]) === 'true') throw new Error('Sesión revocada');

    const now = this.now_();
    const expiresAt = new Date(row[idx.expiresAtIso]);
    if (now > expiresAt) throw new Error('Sesión expirada');

    if (opts.renew) {
      const newExpires = this.addMinutes_(now, this.SESSION_TTL_MIN);
      sheet.getRange(i + 2, idx.expiresAtIso + 1).setValue(this.iso_(newExpires));
      return { token, mail: row[idx.mail], expiresAt: this.iso_(newExpires) };
    }

    return { token, mail: row[idx.mail], expiresAt: row[idx.expiresAtIso] };
  },

  invalidateSession(token) {
    const sheet = this.getSheet_();
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const rows = data.slice(1);

    const idxToken = headers.indexOf('token');
    const idxRevoked = headers.indexOf('revoked');

    const i = rows.findIndex(r => String(r[idxToken]) === String(token));
    if (i === -1) return false;

    sheet.getRange(i + 2, idxRevoked + 1).setValue('true');
    return true;
  },

  /***********************
   * LIMPIEZA DE SESIONES
   * - Borra filas revocadas
   * - Borra expiradas hace > CLEAN_KEEP_DAYS
   ***********************/
  cleanExpiredSessions() {
    const sheet = this.getSheet_();
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return 0;

    const headers = data[0];
    const rows = data.slice(1);

    const idx = {
      token: headers.indexOf('token'),
      expiresAtIso: headers.indexOf('expiresAtIso'),
      revoked: headers.indexOf('revoked')
    };

    const now = this.now_();
    const cutoff = this.addDays_(now, -this.CLEAN_KEEP_DAYS);

    // Recorremos de abajo hacia arriba para poder eliminar sin desplazar índices
    let removed = 0;
    for (let r = rows.length - 1; r >= 0; r--) {
      const revoked = String(rows[r][idx.revoked]) === 'true';
      const expiredAt = new Date(rows[r][idx.expiresAtIso]);
      const veryOld = expiredAt < cutoff;
      if (revoked || veryOld) {
        sheet.deleteRow(r + 2); // +2 por encabezado y base 1
        removed++;
      }
    }
    return removed;
  },

  // Helper opcional para crear el trigger programado (diario 03:00)
  createDailyCleanupTrigger() {
    // eliminamos triggers anteriores de esta función
    ScriptApp.getProjectTriggers()
      .filter(t => t.getHandlerFunction() === 'dailySessionsCleanup')
      .forEach(t => ScriptApp.deleteTrigger(t));

    ScriptApp.newTrigger('dailySessionsCleanup')
      .timeBased()
      .atHour(3)
      .everyDays(1)
      .create();
  }
};

/**
 * Función que llama el trigger diario.
 * Podés ejecutarla manualmente para probar la limpieza.
 */
function dailySessionsCleanup() {
  const removed = SessionService.cleanExpiredSessions();
  console.log('Sesiones limpiadas:', removed);
}


    ns.SessionService = SessionService;
    ns.dailySessionsCleanup = dailySessionsCleanup;
  })(global.OBM = global.OBM || {});
})(typeof window !== 'undefined' ? window : this);
