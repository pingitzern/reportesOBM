let serializeForm;
let calculateAll;
let updateConversions;
let LMIN_TO_LPH;
let LMIN_TO_GPD;
let originalApiUrl;

beforeAll(async () => {
    originalApiUrl = process.env.API_URL;
    if (!process.env.API_URL) {
        process.env.API_URL = 'http://localhost/api';
    }

    const formsModule = await import('../forms.js');
    serializeForm = formsModule.serializeForm;
    ({ calculateAll, updateConversions } = formsModule.__testables__);

    const configModule = await import('../config.js');
    ({ LMIN_TO_LPH, LMIN_TO_GPD } = configModule);
});

afterAll(() => {
    if (originalApiUrl === undefined) {
        delete process.env.API_URL;
    } else {
        process.env.API_URL = originalApiUrl;
    }
});

describe('serializeForm', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('serializa campos incluyendo radios sin seleccionar', () => {
        document.body.innerHTML = `
            <form id="test-form">
                <input type="text" name="single" value="valor" />
                <input type="checkbox" name="multi" value="opt1" checked />
                <input type="checkbox" name="multi" value="opt2" checked />
                <input type="radio" name="choice" value="yes" />
                <input type="radio" name="choice" value="no" />
            </form>
        `;

        const form = document.getElementById('test-form');
        const data = serializeForm(form);

        expect(data).toEqual({
            single: 'valor',
            multi: ['opt1', 'opt2'],
            choice: '',
        });
    });

    test('devuelve objeto vacío cuando el elemento no es un formulario', () => {
        expect(serializeForm(null)).toEqual({});
        expect(serializeForm(document.createElement('div'))).toEqual({});
    });
});

describe('calculateAll', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <input id="cond_red_found" value="100" />
            <input id="cond_perm_found" value="20" />
            <input id="cond_red_left" value="50" />
            <input id="cond_perm_left" value="25" />
            <input id="caudal_perm_found" value="10" />
            <input id="caudal_rech_found" value="5" />
            <input id="caudal_perm_left" value="8" />
            <input id="caudal_rech_left" value="12" />
            <input id="rechazo_found" />
            <input id="rechazo_left" />
            <input id="relacion_found" />
            <input id="relacion_left" />
        `;
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('calcula rechazo y relación de caudales', () => {
        calculateAll();

        expect(document.getElementById('rechazo_found').value).toBe('80.00 %');
        expect(document.getElementById('rechazo_left').value).toBe('50.00 %');
        expect(document.getElementById('relacion_found').value).toBe('0.5:1');
        expect(document.getElementById('relacion_left').value).toBe('1.5:1');
    });

    test('deja campos vacíos cuando faltan datos', () => {
        document.getElementById('cond_red_found').value = '';
        document.getElementById('caudal_perm_found').value = '';

        calculateAll();

        expect(document.getElementById('rechazo_found').value).toBe('');
        expect(document.getElementById('relacion_found').value).toBe('');
    });
});

describe('conversiones de caudal', () => {
    test('convierte de L/min a L/h y GPD', () => {
        const input = document.createElement('input');
        const output = document.createElement('span');
        input.value = '5';

        updateConversions(input, output);

        const esperadoLph = (5 * LMIN_TO_LPH).toFixed(1);
        const esperadoGpd = (5 * LMIN_TO_GPD).toFixed(0);
        expect(output.textContent).toBe(`(${esperadoLph} l/h | ${esperadoGpd} GPD)`);
    });

    test('limpia el texto cuando el valor no es válido', () => {
        const input = document.createElement('input');
        const output = document.createElement('span');
        input.value = '-1';

        updateConversions(input, output);

        expect(output.textContent).toBe('');
    });
});
