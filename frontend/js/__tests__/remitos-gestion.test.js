import { jest } from '@jest/globals';
import { createRemitosGestionModule, __testables__ } from '../modules/remitos-gestion/remitos-gestion.js';

const {
    buildCreateRemitoRequest,
    state,
    handleFormSubmit,
} = __testables__;

describe('remitos gestion module', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="remitos-gestion-container"></div>';
        state.formMode = 'create';
        state.viewMode = 'form';
        state.isSaving = false;
        state.isLoading = false;
        state.feedback = null;
        state.currentPage = 1;
        state.pageSize = 20;
        state.formData = {
            numeroRemito: '',
            numeroReporte: '',
            cliente: '',
            fechaRemitoISO: '',
            fechaServicioISO: '',
            tecnico: '',
            observaciones: '',
            direccion: '',
            telefono: '',
            email: '',
            reporteId: '',
        };
    });

    test('buildCreateRemitoRequest normaliza los campos del formulario', () => {
        const payload = buildCreateRemitoRequest({
            numeroRemito: ' REM-0005 ',
            numeroReporte: 'REP-123',
            cliente: 'Cliente Demo',
            fechaRemito: '05/04/2024',
            fechaRemitoISO: '2024-04-05',
            fechaServicioISO: '2024-04-10',
            tecnico: ' Técnica ',
            observaciones: ' Entregado ',
            direccion: ' Av. Siempre Viva 123 ',
            telefono: ' 123456 ',
            email: ' demo@correo.test ',
            reporteId: ' ID-789 ',
        });

        expect(payload).toMatchObject({
            observaciones: 'Entregado',
            reporteData: expect.objectContaining({
                NumeroRemito: 'REM-0005',
                NumeroReporte: 'REP-123',
                clienteNombre: 'Cliente Demo',
                FechaRemito: '05/04/2024',
                FechaRemitoISO: '2024-04-05',
                FechaServicioISO: '2024-04-10',
                Tecnico: 'Técnica',
                Direccion: 'Av. Siempre Viva 123',
                Telefono: '123456',
                Email: 'demo@correo.test',
                reporteId: 'ID-789',
            }),
        });
    });

    test('handleFormSubmit envía el remito usando la estructura esperada', async () => {
        const crearRemito = jest.fn().mockResolvedValue({});
        const obtenerRemitos = jest.fn().mockResolvedValue({
            remitos: [],
            totalPages: 0,
            currentPage: 1,
            totalItems: 0,
            pageSize: 20,
        });

        createRemitosGestionModule({
            crearRemito,
            obtenerRemitos,
            actualizarRemito: jest.fn(),
            eliminarRemito: jest.fn(),
        });

        state.formData = {
            numeroRemito: 'REM-0007',
            numeroReporte: 'REP-020',
            cliente: 'Cliente Test',
            fechaRemitoISO: '2024-05-10',
            fechaServicioISO: '2024-05-11',
            tecnico: 'Juan Pérez',
            observaciones: 'Entrega exitosa',
            direccion: 'Calle 123',
            telefono: '+54 11 5555-5555',
            email: 'cliente@test.com',
            reporteId: 'ID-999',
        };

        await handleFormSubmit();

        expect(crearRemito).toHaveBeenCalledTimes(1);
        const requestPayload = crearRemito.mock.calls[0][0];
        expect(requestPayload).toMatchObject({
            observaciones: 'Entrega exitosa',
            reporteData: expect.objectContaining({
                NumeroRemito: 'REM-0007',
                NumeroReporte: 'REP-020',
                clienteNombre: 'Cliente Test',
                FechaRemitoISO: '2024-05-10',
                FechaServicioISO: '2024-05-11',
                Tecnico: 'Juan Pérez',
                Direccion: 'Calle 123',
                Telefono: '+54 11 5555-5555',
                Email: 'cliente@test.com',
                reporteId: 'ID-999',
            }),
        });

        expect(obtenerRemitos).toHaveBeenCalledTimes(1);
    });
});
