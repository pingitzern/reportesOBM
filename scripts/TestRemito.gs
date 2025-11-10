function testCrearRemito() {
  const ns = this.OBM = this.OBM || {};
  if (typeof ns.testCrearRemito !== 'function') {
    throw new Error('OBM.testCrearRemito is not defined');
  }
  return ns.testCrearRemito();
}

(function(global) {
  (function(ns) {
    'use strict';

    ns.testCrearRemito = function() {
      const reporteData = {
        cliente: 'Cliente de prueba S.R.L.',
        direccion: 'Calle Falsa 123',
        cliente_email: 'cliente@example.com',
        cliente_telefono: '011-1234-5678',
        numero_reporte: 'REP-TEST-001',
        modelo: 'Modelo X',
        n_serie: 'SN123456',
        id_interna: 'ACT-999'
      };

      const observaciones = 'Prueba automatizada: generar remito y guardar PDF en Drive.';
      const usuarioMail = Session.getActiveUser().getEmail ? Session.getActiveUser().getEmail() : 'test@example.com';

      try {
        const remito = ns.RemitoService.crearRemito(reporteData, observaciones, usuarioMail, []);
        Logger.log('Remito creado OK: %s', JSON.stringify(remito));
        return remito;
      } catch (e) {
        Logger.log('Error en testCrearRemito: %s', e);
        throw e;
      }
    };
  })(global.OBM = global.OBM || {});
})(typeof window !== 'undefined' ? window : this);
