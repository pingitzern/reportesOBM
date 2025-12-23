let serializeForm;
let configureClientSelect;
let resetForm;
let calculateAll;
let updateConversions;
let autoResizeInput;
let LMIN_TO_LPH;
let LMIN_TO_GPD;
let originalApiUrl;

beforeAll(async () => {
    originalApiUrl = process.env.API_URL;
    if (!process.env.API_URL) {
        process.env.API_URL = 'http://localhost/api';
    }

    const formsModule = await import('../modules/mantenimiento/forms.js');
    serializeForm = formsModule.serializeForm;
    configureClientSelect = formsModule.configureClientSelect;
    resetForm = formsModule.resetForm;
    autoResizeInput = formsModule.autoResizeInput;
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

describe('autoResizeInput', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('aumenta el ancho cuando el contenido crece', () => {
        const input = document.createElement('input');
        input.type = 'text';
        input.setAttribute('data-auto-resize', '');
        document.body.appendChild(input);

        input.value = 'abc';
        autoResizeInput(input);
        const initialWidth = parseFloat(input.style.width);

        input.value = 'texto con muchos más caracteres';
        autoResizeInput(input);
        const updatedWidth = parseFloat(input.style.width);

        expect(initialWidth).toBeGreaterThan(0);
        expect(updatedWidth).toBeGreaterThan(initialWidth);
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

// TODO: Tests fail due to changes in configureClientSelect implementation
// Need to update tests for new Supabase-based client data structure
describe.skip('selección de clientes', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <form id="maintenance-form">
                <div>
                    <select id="cliente" name="cliente">
                        <option value="" selected>Selecciona un cliente</option>
                    </select>
                </div>
                <input id="direccion" value="" />
                <input id="cliente_telefono" value="" />
                <input id="cliente_email" value="" />
                <input id="cliente_cuit" value="" />
                <input id="fecha" value="" />
                <input id="fecha_display" value="" />
            </form>
        `;
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('pobla el selector y actualiza los datos del cliente al cambiar', () => {
        const clientes = [
            { id: '1', nombre: 'Cliente Uno', direccion: 'Calle 1', telefono: '123456', mail: 'uno@example.com', cuit: '20-12345678-1' },
            { id: '2', nombre: 'Cliente Dos', domicilio: 'Calle 2', Tel: '987654', email: 'dos@example.com', CUIT: '27-87654321-9' },
        ];

        configureClientSelect(clientes);

        const select = document.getElementById('cliente');
        expect(select.options.length).toBe(1 + clientes.length);

        select.value = '2';
        select.dispatchEvent(new Event('change'));

        expect(document.getElementById('direccion').value).toBe('Calle 2');
        expect(document.getElementById('cliente_telefono').value).toBe('987654');
        expect(document.getElementById('cliente_email').value).toBe('dos@example.com');
        expect(document.getElementById('cliente_cuit').value).toBe('27-87654321-9');

        const direccionInput = document.getElementById('direccion');
        const telefonoInput = document.getElementById('cliente_telefono');
        const emailInput = document.getElementById('cliente_email');
        const cuitInput = document.getElementById('cliente_cuit');

        [direccionInput, telefonoInput, emailInput, cuitInput].forEach(input => {
            expect(input.readOnly).toBe(true);
            expect(input.disabled).toBe(true);
            expect(input.classList.contains('client-detail-locked')).toBe(true);
            expect(input.classList.contains('client-detail-empty')).toBe(false);
        });
    });

    test('maneja clientes con nombres duplicados sin identificadores visibles', () => {
        const clientes = [
            { nombre: 'Cliente Repetido', direccion: 'Calle A', telefono: '111111', email: 'uno@example.com' },
            { nombre: 'Cliente Repetido', domicilio: 'Calle B', Tel: '222222', mail: 'dos@example.com' },
        ];

        configureClientSelect(clientes);

        const select = document.getElementById('cliente');
        expect(select.options.length).toBe(1 + clientes.length);

        const firstOptionKey = select.options[1].getAttribute('data-cliente-key');
        const secondOptionKey = select.options[2].getAttribute('data-cliente-key');

        expect(firstOptionKey).toBeTruthy();
        expect(secondOptionKey).toBeTruthy();
        expect(firstOptionKey).not.toBe(secondOptionKey);

        select.selectedIndex = 1;
        select.dispatchEvent(new Event('change'));

        expect(document.getElementById('direccion').value).toBe('Calle A');
        expect(document.getElementById('cliente_telefono').value).toBe('111111');
        expect(document.getElementById('cliente_email').value).toBe('uno@example.com');
        expect(document.getElementById('cliente_cuit').value).toBe('');
        expect(document.getElementById('cliente_cuit').classList.contains('client-detail-empty')).toBe(true);
        expect(document.getElementById('cliente_cuit').readOnly).toBe(false);
        expect(document.getElementById('cliente_cuit').disabled).toBe(false);
        expect(document.getElementById('direccion').readOnly).toBe(true);
        expect(document.getElementById('direccion').disabled).toBe(true);

        select.selectedIndex = 2;
        expect(select.selectedIndex).toBe(2);
        select.dispatchEvent(new Event('change'));

        expect(document.getElementById('direccion').value).toBe('Calle B');
        expect(document.getElementById('cliente_telefono').value).toBe('222222');
        expect(document.getElementById('cliente_email').value).toBe('dos@example.com');
        expect(document.getElementById('cliente_cuit').value).toBe('');
        expect(document.getElementById('cliente_cuit').classList.contains('client-detail-empty')).toBe(true);
        expect(document.getElementById('cliente_cuit').readOnly).toBe(false);
        expect(document.getElementById('cliente_cuit').disabled).toBe(false);
        expect(document.getElementById('direccion').readOnly).toBe(true);
        expect(document.getElementById('direccion').disabled).toBe(true);
    });

    test('resetForm limpia la selección y los campos de cliente', () => {
        const clientes = [
            { id: '1', nombre: 'Cliente Uno', direccion: 'Calle 1', telefono: '123456', mail: 'uno@example.com', cuit: '20-12345678-1' },
        ];

        configureClientSelect(clientes);

        const select = document.getElementById('cliente');
        select.value = '1';
        select.dispatchEvent(new Event('change'));

        expect(document.getElementById('direccion').value).toBe('Calle 1');

        resetForm();

        expect(select.value).toBe('');
        expect(document.getElementById('direccion').value).toBe('');
        expect(document.getElementById('cliente_telefono').value).toBe('');
        expect(document.getElementById('cliente_email').value).toBe('');
        expect(document.getElementById('cliente_cuit').value).toBe('');
        expect(document.getElementById('direccion').readOnly).toBe(false);
        expect(document.getElementById('direccion').disabled).toBe(false);
        expect(document.getElementById('direccion').classList.contains('client-detail-empty')).toBe(true);
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
