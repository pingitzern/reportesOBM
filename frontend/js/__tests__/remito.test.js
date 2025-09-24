import { storeLastSavedReport, renderRemitoFromStored } from '../remito.js';

function setupRemitoDom() {
    document.body.innerHTML = `
        <span id="remito-numero"></span>
        <span id="remito-fecha"></span>
        <span id="remito-cliente"></span>
        <span id="remito-cliente-direccion"></span>
        <span id="remito-cliente-telefono"></span>
        <span id="remito-cliente-email"></span>
        <span id="remito-cliente-cuit"></span>
        <span id="remito-equipo"></span>
        <span id="remito-equipo-modelo"></span>
        <span id="remito-equipo-serie"></span>
        <span id="remito-equipo-interno"></span>
        <span id="remito-equipo-ubicacion"></span>
        <span id="remito-equipo-tecnico"></span>
        <textarea id="remito-observaciones"></textarea>
        <table><tbody id="remito-repuestos"></tbody></table>
    `;
}

describe('remito.js', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('no renderiza la vista si no hay reporte almacenado', () => {
        setupRemitoDom();
        expect(renderRemitoFromStored()).toBe(false);
    });

    test('completa los datos del remito usando el último reporte guardado', () => {
        setupRemitoDom();

        const reporte = {
            numero_reporte: 'REP-2024-0001',
            fecha: '2024-05-20',
            cliente: 'Cliente Base',
            direccion: 'Av. Central 1000',
            modelo: 'Modelo X',
            n_serie: 'SN-001',
            id_interna: 'INT-001',
            tecnico: 'Juan Pérez',
            resumen: 'Se realizó el mantenimiento anual completo.',
            etapa1_detalles: 'COD123 - Cartucho Sedimentos 5µ',
            etapa1_accion: 'Cambiado',
            etapa2_detalles: '',
            etapa2_accion: 'Inspeccionado',
        };

        const contexto = {
            clienteNombre: 'Cliente Base S.A.',
            clienteDireccion: 'Av. Central 1000',
            clienteTelefono: '123456789',
            clienteEmail: 'contacto@cliente.com',
            clienteCuit: '30-12345678-9',
        };

        storeLastSavedReport(reporte, contexto);
        reporte.modelo = 'Modelo Y';

        expect(renderRemitoFromStored()).toBe(true);

        expect(document.getElementById('remito-numero').textContent).toBe('REP-2024-0001');
        expect(document.getElementById('remito-fecha').textContent).toBe('20/05/2024');
        expect(document.getElementById('remito-cliente').textContent).toBe('Cliente Base S.A.');
        expect(document.getElementById('remito-cliente-direccion').textContent).toBe('Av. Central 1000');
        expect(document.getElementById('remito-cliente-telefono').textContent).toBe('123456789');
        expect(document.getElementById('remito-cliente-email').textContent).toBe('contacto@cliente.com');
        expect(document.getElementById('remito-cliente-cuit').textContent).toBe('30-12345678-9');
        expect(document.getElementById('remito-equipo').textContent).toBe('Modelo X');
        expect(document.getElementById('remito-equipo-modelo').textContent).toBe('Modelo X');
        expect(document.getElementById('remito-equipo-serie').textContent).toBe('SN-001');
        expect(document.getElementById('remito-equipo-interno').textContent).toBe('INT-001');
        expect(document.getElementById('remito-equipo-ubicacion').textContent).toBe('Av. Central 1000');
        expect(document.getElementById('remito-equipo-tecnico').textContent).toBe('Juan Pérez');

        const observaciones = document.getElementById('remito-observaciones');
        expect(observaciones.value).toBe('Se realizó el mantenimiento anual completo.');
        expect(observaciones.readOnly).toBe(true);

        const repuestosBody = document.getElementById('remito-repuestos');
        expect(repuestosBody.children).toHaveLength(1);
        const [repuestoRow] = repuestosBody.children;
        const cells = repuestoRow.querySelectorAll('td');
        expect(cells).toHaveLength(3);
        expect(cells[0].textContent).toBe('COD123');
        expect(cells[1].textContent).toBe('Cartucho Sedimentos 5µ');
        expect(cells[2].textContent).toBe('1');
    });

    test('muestra mensaje cuando no hay repuestos cambiados y permite editar observaciones vacías', () => {
        setupRemitoDom();

        storeLastSavedReport(
            {
                numero_reporte: 'REP-2024-0002',
                fecha: '2024-06-10',
                cliente: 'Cliente B',
                direccion: 'Calle Falsa 123',
                resumen: '',
                etapa1_accion: 'Inspeccionado',
            },
            {
                clienteNombre: '',
                clienteDireccion: '',
                clienteTelefono: '',
                clienteEmail: '',
                clienteCuit: '',
            },
        );

        expect(renderRemitoFromStored()).toBe(true);

        const repuestosBody = document.getElementById('remito-repuestos');
        expect(repuestosBody.children).toHaveLength(1);
        const mensaje = repuestosBody.querySelector('td');
        expect(mensaje.textContent).toBe('No se registraron repuestos cambiados en este mantenimiento.');
        expect(mensaje.colSpan).toBe(3);

        const observaciones = document.getElementById('remito-observaciones');
        expect(observaciones.value).toBe('');
        expect(observaciones.readOnly).toBe(false);

        expect(document.getElementById('remito-cliente-telefono').textContent).toBe('---');
        expect(document.getElementById('remito-cliente-email').textContent).toBe('---');
    });
});
