import { __testables__ } from './remitos-gestion.js';

const { normalizeRemitoForDisplay } = __testables__;

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
        });
    });
});
