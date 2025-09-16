import { jest } from '@jest/globals';

const REPORT_NUMBER = 'REP-TEST-123456';

describe('handleGuardarClick', () => {
    let handleGuardarClick;
    let guardarMantenimientoMock;
    let setReportNumberMock;
    let resetFormMock;
    let generateReportNumberMock;
    let getFormDataMock;
    let formData;

    beforeEach(async () => {
        jest.resetModules();
        jest.useFakeTimers();

        formData = { cliente: 'Test' };
        guardarMantenimientoMock = jest.fn().mockResolvedValue(undefined);
        setReportNumberMock = jest.fn();
        resetFormMock = jest.fn();
        generateReportNumberMock = jest.fn().mockReturnValue(REPORT_NUMBER);
        getFormDataMock = jest.fn().mockReturnValue(formData);

        jest.unstable_mockModule('../config.js', () => ({
            API_URL: 'http://localhost/api',
        }));

        jest.unstable_mockModule('../forms.js', () => ({
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
        }));

        jest.unstable_mockModule('../auth.js', () => ({
            initializeAuth: jest.fn(),
        }));

        jest.unstable_mockModule('../templates.js', () => ({
            renderComponentStages: jest.fn(),
        }));

        jest.unstable_mockModule('../search.js', () => ({
            clearSearchResults: jest.fn(),
            getEditFormValues: jest.fn(),
            openEditModal: jest.fn(),
            closeEditModal: jest.fn(),
            renderSearchResults: jest.fn(),
        }));

        jest.unstable_mockModule('../dashboard.js', () => ({
            renderDashboard: jest.fn(),
        }));

        const mainModule = await import('../main.js');
        ({ handleGuardarClick } = mainModule.__testables__);

        document.body.innerHTML = '<button id="guardarButton">Guardar</button>';
        window.alert = jest.fn();
        window.print = jest.fn();

        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
        document.body.innerHTML = '';
    });

    test('usa el mismo número de reporte para guardar y mostrar', async () => {
        await handleGuardarClick();

        expect(generateReportNumberMock).toHaveBeenCalledTimes(1);
        expect(getFormDataMock).toHaveBeenCalledTimes(1);

        expect(formData.numero_reporte).toBe(REPORT_NUMBER);
        expect(guardarMantenimientoMock).toHaveBeenCalledWith(formData);
        expect(setReportNumberMock).toHaveBeenCalledWith(REPORT_NUMBER);

        const savedNumber = guardarMantenimientoMock.mock.calls[0][0].numero_reporte;
        const displayedNumber = setReportNumberMock.mock.calls[0][0];
        expect(savedNumber).toBe(displayedNumber);

        const generateCallOrder = generateReportNumberMock.mock.invocationCallOrder[0];
        const formDataCallOrder = getFormDataMock.mock.invocationCallOrder[0];
        expect(generateCallOrder).toBeLessThan(formDataCallOrder);

        expect(resetFormMock).not.toHaveBeenCalled();
        jest.runAllTimers();
        expect(window.print).toHaveBeenCalledTimes(1);
        expect(resetFormMock).toHaveBeenCalledTimes(1);
    });
});
