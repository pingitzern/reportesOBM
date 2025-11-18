import createSoftenerModule from './ablandador.js';

function makeForm() {
  return `
    <form id="softener-maintenance-form">
      <input id="softener-volumen-resina" type="number" value="" />
      <input id="softener-dureza-agua-cruda" type="number" value="" />
      <input id="softener-factor-proteccion" type="checkbox" />
      <input id="softener-autonomia-recomendada" type="number" readonly />
      <button type="reset" id="softener-reset-button"></button>
      <button type="button" id="softener-save-button"></button>
    </form>
  `;
}

describe('ablandador módulo - cálculo de autonomía', () => {
  let module;

  beforeEach(() => {
    document.body.innerHTML = makeForm();
    module = createSoftenerModule();
    module.initialize();
  });

  test('calcula autonomía correctamente sin factor de protección', () => {
    const volumen = document.getElementById('softener-volumen-resina');
    const dureza = document.getElementById('softener-dureza-agua-cruda');
    const autonomia = document.getElementById('softener-autonomia-recomendada');

    volumen.value = '25';
    dureza.value = '240';

    // trigger input event
    volumen.dispatchEvent(new Event('input'));

    expect(autonomia.value).toBe('6.25');
  });

  test('calcula autonomía aplicando factor de protección 20%', () => {
    const volumen = document.getElementById('softener-volumen-resina');
    const dureza = document.getElementById('softener-dureza-agua-cruda');
    const autonomia = document.getElementById('softener-autonomia-recomendada');
    const factor = document.getElementById('softener-factor-proteccion');

    volumen.value = '25';
    dureza.value = '240';
    factor.checked = true;

    // trigger change event for checkbox and input for recalculation
    factor.dispatchEvent(new Event('change'));

    expect(autonomia.value).toBe('5');
  });
});
