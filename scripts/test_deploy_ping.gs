// test_deploy_ping.gs
// Archivo de prueba para verificar push/deploy desde clasp.
// Provee un endpoint GET simple para comprobar que la versión desplegada corresponde al código.

function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ result: 'success', data: { msg: 'ping from deployed test', time: new Date().toISOString() } }))
    .setMimeType(ContentService.MimeType.JSON);
}

function testPushMarker() {
  Logger.log('testPushMarker executed at ' + new Date().toISOString());
  return { ok: true, ts: new Date().toISOString() };
}
