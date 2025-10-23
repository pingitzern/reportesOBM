// Minimal scaffold for new remitos module
export function createRemitosModule({ showView, apiUrl, getToken } = {}) {
  let lastReport = null;

  function initialize() {
    // noop: wire up later
  }

  function handleMaintenanceSaved(report) {
    lastReport = report ? JSON.parse(JSON.stringify(report)) : null;
  }

  async function generateRemito({ fotos = [], observaciones = '' } = {}) {
    if (!lastReport) throw new Error('No report available');
    const token = typeof getToken === 'function' ? getToken() : '';
    const payload = { action: 'crear_remito', token, reporteData: lastReport, fotos, observaciones };
    const resp = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain; charset=utf-8' }, body: JSON.stringify(payload) });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const json = await resp.json();
    return json;
  }

  return { initialize, handleMaintenanceSaved, generateRemito };
}

// Test helper: sends a tiny 1x1 PNG (transparent) to the new endpoint
export async function sendTestRemito(apiUrl, token) {
  const tinyPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';
  const fotos = [{ base64Data: tinyPngBase64, mimeType: 'image/png', fileName: 'test.png' }];
  const payload = { action: 'crear_remito_new', token, reporteData: { cliente: 'Prueba' }, observaciones: 'test-e2e', fotos };
  const resp = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain; charset=utf-8' }, body: JSON.stringify(payload) });
  return resp.json();
}
