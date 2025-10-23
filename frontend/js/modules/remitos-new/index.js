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
