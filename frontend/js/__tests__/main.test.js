import { jest } from '@jest/globals';

const REPORT_NUMBER = 'REP-TEST-123456';
const FULL_DOM_TEMPLATE = `
<div id="tab-nuevo" class="tab-content">
    <form id="maintenance-form">
        <select id="cliente" name="cliente">
            <option value="">Selecciona un cliente</option>
            <option value="CLI-001" selected>Cliente Demo</option>
        </select>
        <input type="text" id="direccion" name="direccion" value="Av. Siempre Viva 742">
        <input type="text" id="cliente_telefono" name="cliente_telefono" value="+54 11 5555-5555">
        <input type="text" id="cliente_email" name="cliente_email" value="cliente@demo.com">
        <input type="text" id="cliente_cuit" name="cliente_cuit" value="20-12345678-9">
        <input type="text" id="tecnico" name="tecnico" value="Juan Pérez">
        <input type="text" id="modelo" name="modelo" value="Equipo RO-5000">
        <input type="text" id="id_interna" name="id_interna" value="ACT-45">
        <input type="text" id="n_serie" name="n_serie" value="SN-123">
        <input type="text" id="fecha_display" value="01/06/2024">
        <input type="hidden" id="fecha" name="fecha" value="2024-06-01">
    </form>
    <button id="guardarButton">Guardar</button>
    <button id="generar-remito-btn" disabled>Generar Remito</button>
</div>
<div id="tab-buscar" class="hidden"></div>
<div id="tab-dashboard" class="hidden"></div>
<div id="remito-view" class="hidden">
    <input id="remito-numero" readonly>
    <input id="remito-fecha" readonly>
    <input id="remito-cliente-nombre" readonly>
    <input id="remito-cliente-direccion" readonly>
    <input id="remito-cliente-telefono" readonly>
    <input id="remito-cliente-email" readonly>
    <input id="remito-cliente-cuit" readonly>
    <input id="remito-equipo-descripcion" readonly>
    <input id="remito-equipo-modelo" readonly>
    <input id="remito-equipo-serie" readonly>
    <input id="remito-equipo-interno" readonly>
    <input id="remito-equipo-ubicacion" readonly>
    <input id="remito-equipo-tecnico" readonly>
    <textarea id="remito-observaciones"></textarea>
    <button id="remito-agregar-repuesto" type="button">Agregar repuesto</button>
    <table><tbody id="remito-repuestos-body"></tbody></table>
    <button id="finalizar-remito-btn">Finalizar y Guardar Remito</button>
</div>
`.trim();

const MOCK_COMPONENT_STAGES = [
    { id: 'etapa1', title: '1ª Etapa' },
    { id: 'etapa2', title: '2ª Etapa' },
];

describe('manejo del guardado de mantenimientos', () => {
    let handleGuardarClick;
    let guardarMantenimientoMock;
    let setReportNumberMock;
    let resetFormMock;
    let generateReportNumberMock;
    let getFormDataMock;
    let getLastSavedReportData;
    let originalAlert;

    beforeEach(async () => {
        jest.resetModules();
        jest.useFakeTimers();

        guardarMantenimientoMock = jest.fn().mockResolvedValue(undefined);
        setReportNumberMock = jest.fn();
        resetFormMock = jest.fn();
        generateReportNumberMock = jest.fn().mockReturnValue(REPORT_NUMBER);
        getFormDataMock = jest.fn().mockReturnValue({ cliente: 'CLI-001' });

        jest.unstable_mockModule('../config.js', () => ({
            API_URL: 'http://localhost/api',
        }));

        jest.unstable_mockModule('../modules/mantenimiento/forms.js', () => ({
            autoFillForm: jest.fn(),
            configureClientSelect: jest.fn(),
            generateReportNumber: generateReportNumberMock,
            getFormData: getFormDataMock,
            initializeForm: jest.fn(),
            resetForm: resetFormMock,
            setReportNumber: setReportNumberMock,
        }));

        jest.unstable_mockModule('../api.js', () => ({
            guardarMantenimiento: guardarMantenimientoMock,
            buscarMantenimientos: jest.fn(),
            actualizarMantenimiento: jest.fn(),
            eliminarMantenimiento: jest.fn(),
            obtenerDashboard: jest.fn(),
            obtenerClientes: jest.fn().mockResolvedValue([]),
            obtenerRemitos: jest.fn().mockResolvedValue({
                remitos: [],
                totalPages: 0,
                currentPage: 0,
                totalItems: 0,
                pageSize: 20,
            }),
            crearRemito: jest.fn(),
            actualizarRemito: jest.fn(),
            eliminarRemito: jest.fn(),
        }));

        jest.unstable_mockModule('../modules/login/auth.js', () => ({
            initializeAuth: jest.fn(),
            getCurrentToken: jest.fn(() => 'token-123'),
        }));

        jest.unstable_mockModule('../modules/mantenimiento/templates.js', () => ({
            renderComponentStages: jest.fn(),
            COMPONENT_STAGES: MOCK_COMPONENT_STAGES,
        }));

        jest.unstable_mockModule('../modules/busqueda/busqueda.js', () => ({
            createSearchModule: jest.fn(() => ({
                initialize: jest.fn(),
                show: jest.fn(),
            })),
        }));

        jest.unstable_mockModule('../modules/dashboard/dashboard.js', () => ({
            createDashboardModule: jest.fn(() => ({
                initialize: jest.fn(),
                show: jest.fn(),
            })),
        }));

        const mainModule = await import('../main.js');
        handleGuardarClick = mainModule.__testables__.handleGuardarClick;
        getLastSavedReportData = mainModule.__testables__.getLastSavedReportDataForTests;

        document.body.innerHTML = FULL_DOM_TEMPLATE;

        originalAlert = window.alert;
        window.alert = jest.fn();

        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
        jest.clearAllMocks();
        window.alert = originalAlert;
        document.body.innerHTML = '';
    });

    test('habilita el botón de remito al guardar y conserva un snapshot del reporte', async () => {
        const generarBtn = document.getElementById('generar-remito-btn');
        expect(generarBtn.disabled).toBe(true);

        await handleGuardarClick();

        expect(guardarMantenimientoMock).toHaveBeenCalledWith(expect.objectContaining({
            numero_reporte: REPORT_NUMBER,
        }));
        expect(setReportNumberMock).toHaveBeenCalledWith(REPORT_NUMBER);

        const button = document.getElementById('generar-remito-btn');
        expect(button.disabled).toBe(false);

        const snapshot = getLastSavedReportData();
        expect(snapshot).toMatchObject({
            cliente: 'CLI-001',
            clienteNombre: 'Cliente Demo',
            direccion: 'Av. Siempre Viva 742',
            cliente_telefono: '+54 11 5555-5555',
        });
        expect(snapshot.fecha_display).toBe('01/06/2024');
    });
});

describe('flujo de generación y finalización de remito', () => {
    let handleGenerarRemitoClick;
    let handleFinalizarRemitoClick;
    let setLastSavedReportData;
    let originalAlert;
    let originalFetch;

    beforeEach(async () => {
        jest.resetModules();

        jest.unstable_mockModule('../config.js', () => ({
            API_URL: 'http://localhost/api',
        }));

        jest.unstable_mockModule('../modules/mantenimiento/forms.js', () => ({
            autoFillForm: jest.fn(),
            configureClientSelect: jest.fn(),
            generateReportNumber: jest.fn(),
            getFormData: jest.fn(),
            initializeForm: jest.fn(),
            resetForm: jest.fn(),
            setReportNumber: jest.fn(),
        }));

        jest.unstable_mockModule('../api.js', () => ({
            guardarMantenimiento: jest.fn(),
            buscarMantenimientos: jest.fn(),
            actualizarMantenimiento: jest.fn(),
            eliminarMantenimiento: jest.fn(),
            obtenerDashboard: jest.fn(),
            obtenerClientes: jest.fn().mockResolvedValue([]),
            obtenerRemitos: jest.fn().mockResolvedValue({
                remitos: [],
                totalPages: 0,
                currentPage: 0,
                totalItems: 0,
                pageSize: 20,
            }),
            crearRemito: jest.fn(),
            actualizarRemito: jest.fn(),
            eliminarRemito: jest.fn(),
        }));

        jest.unstable_mockModule('../modules/login/auth.js', () => ({
            initializeAuth: jest.fn(),
            getCurrentToken: jest.fn(() => 'token-abc'),
        }));

        jest.unstable_mockModule('../modules/mantenimiento/templates.js', () => ({
            renderComponentStages: jest.fn(),
            COMPONENT_STAGES: MOCK_COMPONENT_STAGES,
        }));

        jest.unstable_mockModule('../modules/busqueda/busqueda.js', () => ({
            createSearchModule: jest.fn(() => ({
                initialize: jest.fn(),
                show: jest.fn(),
            })),
        }));

        jest.unstable_mockModule('../modules/dashboard/dashboard.js', () => ({
            createDashboardModule: jest.fn(() => ({
                initialize: jest.fn(),
                show: jest.fn(),
            })),
        }));

        const mainModule = await import('../main.js');
        handleGenerarRemitoClick = mainModule.__testables__.handleGenerarRemitoClick;
        handleFinalizarRemitoClick = mainModule.__testables__.handleFinalizarRemitoClick;
        setLastSavedReportData = mainModule.__testables__.setLastSavedReportDataForTests;

        document.body.innerHTML = FULL_DOM_TEMPLATE;
        mainModule.__testables__.initializeRemitoModuleForTests();

        originalAlert = window.alert;
        originalFetch = global.fetch;
        window.alert = jest.fn();
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ result: 'success', data: { NumeroRemito: 'REM-0099' } }),
        });

        jest.clearAllMocks();
    });

    afterEach(() => {
        window.alert = originalAlert;
        global.fetch = originalFetch;
        document.body.innerHTML = '';
        jest.clearAllMocks();
    });

    test('no abre la vista si no hay datos guardados', () => {
        const result = handleGenerarRemitoClick();
        expect(result).toBe(false);
        expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('Primero debés guardar'));
        const view = document.getElementById('remito-view');
        expect(view.classList.contains('hidden')).toBe(true);
    });

    test('muestra la vista del remito con los datos del reporte', () => {
        setLastSavedReportData({
            NumeroRemito: 'REM-0001',
            fecha_display: '01/06/2024',
            clienteNombre: 'Cliente Demo',
            direccion: 'Av. Siempre Viva 742',
            cliente_telefono: '+54 11 5555-5555',
            cliente_email: 'cliente@demo.com',
            cliente_cuit: '20-12345678-9',
            modelo: 'Equipo RO-5000',
            n_serie: 'SN-123',
            id_interna: 'ACT-45',
            tecnico: 'Juan Pérez',
        });

        const result = handleGenerarRemitoClick();
        expect(result).toBe(true);

        const view = document.getElementById('remito-view');
        expect(view.classList.contains('hidden')).toBe(false);

        expect(document.getElementById('remito-numero').value).toBe('REM-0001');
        expect(document.getElementById('remito-fecha').value).toBe('01/06/2024');
        expect(document.getElementById('remito-cliente-nombre').value).toBe('Cliente Demo');
        expect(document.getElementById('remito-equipo-modelo').value).toBe('Equipo RO-5000');
    });

    test('renderiza repuestos derivados cuando hay componentes marcados como cambiados', () => {
        setLastSavedReportData({
            NumeroRemito: 'REM-0003',
            clienteNombre: 'Cliente Demo',
            direccion: 'Av. Siempre Viva 742',
            etapa1_accion: 'Cambiado',
            etapa1_detalles: 'Filtro de sedimentos 5 µm',
        });

        const result = handleGenerarRemitoClick();
        expect(result).toBe(true);

        const rows = document.querySelectorAll('#remito-repuestos-body tr');
        expect(rows.length).toBe(1);
        const descripcionInput = rows[0].querySelector('input[data-field="descripcion"]');
        expect(descripcionInput).toBeInstanceOf(HTMLInputElement);
        expect(descripcionInput.value).toContain('Filtro de sedimentos 5 µm');
        expect(descripcionInput.value).toContain('1ª Etapa');

        const cantidadInput = rows[0].querySelector('input[data-field="cantidad"]');
        expect(cantidadInput).toBeInstanceOf(HTMLInputElement);
        expect(cantidadInput.value).toBe('1');
    });

    test('muestra al menos una fila vacía con inputs editables cuando no hay repuestos', () => {
        setLastSavedReportData({ NumeroRemito: 'REM-0004' });

        const result = handleGenerarRemitoClick();
        expect(result).toBe(true);

        const rows = document.querySelectorAll('#remito-repuestos-body tr');
        expect(rows.length).toBe(1);

        const inputs = rows[0].querySelectorAll('input');
        expect(inputs.length).toBe(3);
        inputs.forEach(input => {
            expect(input.value).toBe('');
        });
    });

    test('agrega una nueva fila vacía al presionar el botón de agregar repuesto', () => {
        setLastSavedReportData({ NumeroRemito: 'REM-0005' });

        const result = handleGenerarRemitoClick();
        expect(result).toBe(true);

        const body = document.getElementById('remito-repuestos-body');
        const initialRows = body.querySelectorAll('tr');
        expect(initialRows.length).toBe(1);

        const addButton = document.getElementById('remito-agregar-repuesto');
        addButton.click();

        const updatedRows = body.querySelectorAll('tr');
        expect(updatedRows.length).toBe(2);

        const newRowInputs = updatedRows[1].querySelectorAll('input');
        expect(newRowInputs.length).toBe(3);
        newRowInputs.forEach(input => {
            expect(input.value).toBe('');
        });
    });

    test('sincroniza y normaliza los repuestos editados antes de finalizar', async () => {
        const savedReport = {
            numero_reporte: 'REP-010',
            componentes: [{ accion: 'Cambiado', detalles: 'Cartucho previo' }],
            repuestos: [
                { codigo: 'OLD-001', descripcion: 'Filtro viejo', cantidad: '1' },
                { codigo: '', descripcion: '', cantidad: '' },
            ],
        };
        setLastSavedReportData(savedReport);

        const renderResult = handleGenerarRemitoClick();
        expect(renderResult).toBe(true);

        const rows = document.querySelectorAll('#remito-repuestos-body tr');
        expect(rows.length).toBeGreaterThan(0);

        const firstRow = rows[0];
        firstRow.querySelector('input[data-field="codigo"]').value = 'NEW-123';
        firstRow.querySelector('input[data-field="descripcion"]').value = 'Cartucho 5 µm';
        firstRow.querySelector('input[data-field="cantidad"]').value = '2.5';

        await handleFinalizarRemitoClick();

        expect(global.fetch).toHaveBeenCalledTimes(1);
        const body = JSON.parse(global.fetch.mock.calls[0][1].body);
        expect(body.reporteData.repuestos).toEqual([
            { codigo: 'NEW-123', descripcion: 'Cartucho 5 µm', cantidad: '2.5' },
        ]);
        expect(body.reporteData.componentes).toEqual([]);

        const rerenderedRows = document.querySelectorAll('#remito-repuestos-body tr');
        expect(rerenderedRows.length).toBe(1);
        const cantidadInput = rerenderedRows[0].querySelector('input[data-field="cantidad"]');
        expect(cantidadInput.value).toBe('2.5');
    });

    test('envía los datos al finalizar y actualiza el número de remito', async () => {
        const savedReport = {
            numero_reporte: 'REP-002',
            clienteNombre: 'Cliente Demo',
        };
        setLastSavedReportData(savedReport);
        document.getElementById('remito-observaciones').value = 'Observaciones finales';

        await handleFinalizarRemitoClick();

        expect(global.fetch).toHaveBeenCalledWith('http://localhost/api', expect.objectContaining({
            method: 'POST',
        }));

        const body = JSON.parse(global.fetch.mock.calls[0][1].body);
        expect(body).toMatchObject({
            action: 'crear_remito',
            token: 'token-abc',
            reporteData: savedReport,
            observaciones: 'Observaciones finales',
        });

        expect(document.getElementById('remito-numero').value).toBe('REM-0099');
        expect(window.alert).toHaveBeenCalledWith('✅ Remito generado correctamente.');
    });
});
