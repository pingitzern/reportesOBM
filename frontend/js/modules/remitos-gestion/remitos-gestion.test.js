import { __testables__ } from './remitos-gestion.js';

const {
    normalizeRemitoForDisplay,
    parseRemitoNumericSuffix,
    determineNextNumeroRemito,
    ensureNumeroRemitoAsignado,
    state,
    setDependencies,
} = __testables__;

beforeEach(() => {
    setDependencies({
        obtenerRemitos: async () => ({ remitos: [] }),
    });
    state.remitos = [];
    state.formMode = 'list';
    state.formData = { numeroRemito: '' };
    state.isGeneratingNumeroRemito = false;
    state.numeroRemitoError = null;
});

afterEach(() => {
    setDependencies({});
});

describe('normalizeRemitoForDisplay', () => {
    it('mapea campos alternativos como NombreCliente y FechaCreacion', () => {
        const remito = normalizeRemitoForDisplay({
            NumeroRemito: 'REM-0001',
            NumeroReporte: 'REP-2024-001',
            NombreCliente: 'Cliente Demo',
            FechaCreacion: '2024-05-01',
            Direccion: 'Calle Falsa 123',
            Telefono: '+54 11 5555-5555',
            MailCliente: 'cliente@example.com',
            MailTecnico: 'tecnico@example.com',
            Observaciones: 'Sin novedades',
            IdUnico: 'ID-XYZ-123',
            CUIT: '30-12345678-9',
        });

        expect(remito).toMatchObject({
            numeroRemito: 'REM-0001',
            numeroReporte: 'REP-2024-001',
            cliente: 'Cliente Demo',
            fechaRemito: '2024-05-01',
            direccion: 'Calle Falsa 123',
            telefono: '+54 11 5555-5555',
            email: 'cliente@example.com',
            tecnico: 'tecnico@example.com',
            observaciones: 'Sin novedades',
            reporteId: 'ID-XYZ-123',
            cuit: '30-12345678-9',
        });
    });
});

describe('parseRemitoNumericSuffix', () => {
    it('extrae el sufijo numérico del remito', () => {
        expect(parseRemitoNumericSuffix('REM-0042')).toBe(42);
        expect(parseRemitoNumericSuffix('rem-0007')).toBe(7);
        expect(parseRemitoNumericSuffix('SIN NUMERO')).toBeNaN();
    });
});

describe('determineNextNumeroRemito', () => {
    it('usa los remitos locales y remotos para calcular el siguiente número', async () => {
        state.remitos = [
            { numeroRemito: 'REM-0010' },
            { NumeroRemito: 'REM-0015' },
        ];

        setDependencies({
            obtenerRemitos: async () => ({
                remitos: [{ numeroRemito: 'REM-0020' }],
            }),
        });

        const result = await determineNextNumeroRemito();
        expect(result).toEqual({ numero: 'REM-0021', error: null });
    });

    it('retorna error cuando no puede obtener números', async () => {
        setDependencies({
            obtenerRemitos: async () => {
                throw new Error('Fallo remoto');
            },
        });

        const result = await determineNextNumeroRemito();
        expect(result.numero).toBe('');
        expect(result.error).toBeInstanceOf(Error);
        expect(result.error.message).toBe('Fallo remoto');
    });
});

describe('ensureNumeroRemitoAsignado', () => {
    it('actualiza el formulario en modo creación con el siguiente número disponible', async () => {
        state.formMode = 'create';
        state.formData = { numeroRemito: '' };

        setDependencies({
            obtenerRemitos: async () => ({
                remitos: [{ numeroRemito: 'REM-0005' }],
            }),
        });

        await ensureNumeroRemitoAsignado({ reRender: false });

        expect(state.formData.numeroRemito).toBe('REM-0006');
        expect(state.numeroRemitoError).toBeNull();
    });
});
