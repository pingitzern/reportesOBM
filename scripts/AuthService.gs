(function(global) {
  (function(ns) {
    'use strict';

const AuthService = {
  LOGIN_SHEET_NAME: 'login',

  getLoginSheet_() {
    const ss = ns.SheetRepository.getSpreadsheet();
    const sheet = ss.getSheetByName(this.LOGIN_SHEET_NAME);
    if (!sheet) throw new Error("No se encontró la hoja 'login'.");
    return sheet;
  },

  authenticate(mail, password) {
    if (!mail || !password) throw new Error('El mail y la contraseña son requeridos.');

    const sheet = this.getLoginSheet_();
    const data = sheet.getDataRange().getValues();
    if (!data || data.length < 2) throw new Error("La hoja 'login' no tiene datos.");

    const headers = data[0];
    const rows = data.slice(1);

    const idx = {
      mail: headers.indexOf('mail'),
      password: headers.indexOf('password')
    };
    if (idx.mail === -1 || idx.password === -1) {
      throw new Error("La hoja 'login' debe tener las columnas 'mail' y 'password'.");
    }

    const row = rows.find(r =>
      String(r[idx.mail]).trim().toLowerCase() === String(mail).trim().toLowerCase() &&
      String(r[idx.password]) === String(password)
    );
    if (!row) throw new Error('Mail o contraseña incorrectos.');

    const usuario = {};
    headers.forEach((h, i) => { if (String(h).trim()) usuario[h] = row[i]; });
    return usuario;
  },

  getUserByMail(mail) {
    const sheet = this.getLoginSheet_();
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const rows = data.slice(1);

    const idxMail = headers.indexOf('mail');
    if (idxMail === -1) throw new Error("La hoja 'login' debe tener columna 'mail'.");

    const row = rows.find(r => String(r[idxMail]).trim().toLowerCase() === String(mail).trim().toLowerCase());
    if (!row) throw new Error('Usuario no encontrado.');

    const user = {};
    headers.forEach((h, i) => { if (String(h).trim()) user[h] = row[i]; });
    return user;
  },

  // 🔒 Devuelve SOLO datos públicos (sin 'password')
  listUsers() {
    const sheet = this.getLoginSheet_();
    const data = sheet.getDataRange().getValues();
    if (!data || data.length < 2) return [];

    const headers = data[0];
    const rows = data.slice(1);

    const mailIdx   = headers.indexOf('mail');
    const nombreIdx = headers.indexOf('Nombre');
    const cargoIdx  = headers.indexOf('Cargo');
    const rolIdx    = headers.indexOf('Rol');

    return rows
      .filter(r => r[mailIdx]) // solo filas con mail
      .map(r => ({
        mail:   r[mailIdx],
        nombre: nombreIdx !== -1 ? r[nombreIdx] : '',
        cargo:  cargoIdx  !== -1 ? r[cargoIdx]  : '',
        rol:    rolIdx    !== -1 ? r[rolIdx]    : ''
      }));
  }
};


    ns.AuthService = AuthService;
  })(global.OBM = global.OBM || {});
})(typeof window !== 'undefined' ? window : this);
