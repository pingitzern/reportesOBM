
function makeForm() {
  return `
    <form id="softener-maintenance-form">
      <select id="softener-equipo-regeneracion-tipo">
        <option value="Por Volumen">Por Volumen</option>
        <option value="Por Tiempo">Por Tiempo</option>
      </select>

      <input id="softener-cabezal-hora-cabezal-found" type="time" />
      <input id="softener-cabezal-hora-cabezal-left" type="time" />
      <input id="softener-cabezal-hora-regeneracion-found" type="time" />
      <input id="softener-cabezal-hora-regeneracion-left" type="time" />

      <input id="softener-cabezal-p1-found" type="number" />
      <input id="softener-cabezal-p2-found" type="number" />
      <input id="softener-cabezal-p3-found" type="number" />
      <input id="softener-cabezal-p4-found" type="number" />

      <input id="softener-cabezal-p1-left" type="number" />
      <input id="softener-cabezal-p2-left" type="number" />
      <input id="softener-cabezal-p3-left" type="number" />
      <input id="softener-cabezal-p4-left" type="number" />

      <input id="softener-cabezal-frecuencia-dias-found" type="number" />
      <input id="softener-cabezal-frecuencia-dias-left" type="number" />

      <button type="button" id="softener-save-button">Guardar</button>
      <button type="reset" id="softener-reset-button">Limpiar</button>
    </form>
  `;
}

describe('collectFormData contract - cabezal defaults and visibility', () => {
  beforeEach(() => {
    // mock alert to avoid jsdom not-implemented errors
    window.alert = () => {};
    document.body.innerHTML = makeForm();
  });

  test('seccion_C_cabezal is included and defaults applied to As Left on reset/save', async () => {
    let capturedPayload = null;

    const guardarStub = async ({ payload }) => {
      capturedPayload = payload;
      return { success: true };
    };

    const obtenerClientesStub = async () => [];

    // set API_URL before importing module to reduce console warnings (best-effort)
    window.__APP_CONFIG__ = { API_URL: 'http://test' };

    const { default: createSoftenerModule } = await import('./ablandador.js');
    const module = createSoftenerModule({ guardarMantenimientoAblandador: guardarStub, obtenerClientes: obtenerClientesStub });
    module.initialize();

    // After initialize, resetCabezalSection should have set defaults for found and left
    // Click guardar to trigger collection and our stub
    const saveBtn = document.getElementById('softener-save-button');
    saveBtn.click();

    // wait for async handlers
    await new Promise(r => setTimeout(r, 20));

    expect(capturedPayload).not.toBeNull();
    expect(capturedPayload.seccion_C_cabezal).toBeDefined();

    const cabezal = capturedPayload.seccion_C_cabezal;

    // defaults requested: regen 02:00 and P1..P4 (15,60,10,5) and hora actual present
    expect(typeof cabezal.hora_cabezal_as_found).toBe('string');
    expect(typeof cabezal.hora_cabezal_as_left).toBe('string');
    expect(cabezal.hora_regeneracion_as_found).toBe('02:00');
    expect(cabezal.hora_regeneracion_as_left).toBe('02:00');

    expect(cabezal.p1_retrolavado_min_found).toBe(15);
    expect(cabezal.p2_salmuera_min_found).toBe(60);
    expect(cabezal.p3_enjuague_min_found).toBe(10);
    expect(cabezal.p4_llenado_salero_min_found).toBe(5);

    // As Left should have same defaults per your request
    expect(cabezal.p1_retrolavado_min_left).toBe(15);
    expect(cabezal.p2_salmuera_min_left).toBe(60);
    expect(cabezal.p3_enjuague_min_left).toBe(10);
    expect(cabezal.p4_llenado_salero_min_left).toBe(5);
  });
});
