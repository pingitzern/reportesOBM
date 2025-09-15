// Configuración
const API_URL = 'https://script.google.com/macros/s/AKfycbwcgwPPAxcSzK9RywqySXV0z4MVihaEbcIwdz4_UJDxNjre9s3ZNX2dCQA3l6lBEzO1Xw/exec';

// Variables globales
let mantenimientos = [];
let mantenimientoEditando = null;
let chartMensual = null;
let chartTecnicos = null;
const LMIN_TO_LPH = 60;
const LMIN_TO_GPD = (60 * 24) / 3.78541;

// Función para inicializar todo
function inicializarSistema() {
    console.log('🔧 Inicializando sistema...');

    // Configurar fecha automática
    const today = new Date();
    const fechaInput = document.getElementById('fecha');
    if (fechaInput) {
        fechaInput.value = today.toLocaleDateString('es-AR', { year: 'numeric', month: '2-digit', day: '2-digit' });
    }

    // Conectar botones principales
    const guardarBtn = document.getElementById('guardarButton');
    const resetBtn = document.getElementById('resetButton');
    const buscarBtn = document.getElementById('buscar-btn');
    const limpiarBtn = document.getElementById('limpiar-btn');

    if (guardarBtn) {
        guardarBtn.onclick = guardarNuevoMantenimiento;
        console.log('✅ Botón guardar conectado');
    } else {
        console.log('❌ No se encontró botón guardar');
    }

    if (resetBtn) {
        resetBtn.onclick = function() {
            document.getElementById('maintenance-form').reset();
            const today = new Date();
            const fechaInput = document.getElementById('fecha');
            if (fechaInput) {
                fechaInput.value = today.toLocaleDateString('es-AR', { year: 'numeric', month: '2-digit', day: '2-digit' });
            }
        };
        console.log('✅ Botón reset conectado');
    }

    if (buscarBtn) {
        buscarBtn.onclick = buscarMantenimientos;
        console.log('✅ Botón buscar conectado');
    }

    if (limpiarBtn) {
        limpiarBtn.onclick = limpiarBusqueda;
        console.log('✅ Botón limpiar conectado');
    }

    // Conectar pestañas
    const tabNuevoBtn = document.getElementById('tab-nuevo-btn');
    const tabBuscarBtn = document.getElementById('tab-buscar-btn');
    const tabDashboardBtn = document.getElementById('tab-dashboard-btn');

    if (tabNuevoBtn) tabNuevoBtn.onclick = () => showTab('nuevo');
    if (tabBuscarBtn) tabBuscarBtn.onclick = () => showTab('buscar');
    if (tabDashboardBtn) tabDashboardBtn.onclick = () => showTab('dashboard');

    console.log('✅ Pestañas conectadas');

    // Configurar eventos para cálculos automáticos
    const inputs = document.querySelectorAll('input[type="number"]');
    inputs.forEach(input => {
        input.addEventListener('input', calculateAll);
    });

    // Configurar conversiones de caudal
    const configurarConversiones = () => {
        const caudalInputs = ['caudal_perm_found', 'caudal_perm_left', 'caudal_rech_found', 'caudal_rech_left'];
        caudalInputs.forEach(id => {
            const input = document.getElementById(id);
            const conv = document.getElementById(`${id}_conv`);
            if (input && conv) {
                input.addEventListener('input', () => updateConversions(input, conv));
            }
        });
    };
    configurarConversiones();

    // Configurar colores de estado
    const statusSelects = document.querySelectorAll('select[id$="_found"], select[id$="_left"], select#sanitizacion_status');
    statusSelects.forEach(select => {
        setStatusColor(select);
        select.addEventListener('change', () => setStatusColor(select));
    });

    console.log('🎉 Sistema inicializado correctamente');
}

// Mostrar/ocultar pestañas
function showTab(tabName) {
    console.log('Cambiando a pestaña:', tabName);
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.add('hidden'));
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));

    const tabElement = document.getElementById(`tab-${tabName}`);
    if (tabElement) {
        tabElement.classList.remove('hidden');
    }

    // Activar el botón de la pestaña correspondiente
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
        if (button.id === `tab-${tabName}-btn`) {
            button.classList.add('active');
        }
    });

    if (tabName === 'dashboard') {
        cargarDashboard();
    }
}

// Funciones del formulario original
function calculateAll() {
    const condRedFound = parseFloat(document.getElementById('cond_red_found').value) || 0;
    const condPermFound = parseFloat(document.getElementById('cond_perm_found').value) || 0;
    const condRedLeft = parseFloat(document.getElementById('cond_red_left').value) || 0;
    const condPermLeft = parseFloat(document.getElementById('cond_perm_left').value) || 0;

    const caudalPermFound = parseFloat(document.getElementById('caudal_perm_found').value) || 0;
    const caudalRechFound = parseFloat(document.getElementById('caudal_rech_found').value) || 0;
    const caudalPermLeft = parseFloat(document.getElementById('caudal_perm_left').value) || 0;
    const caudalRechLeft = parseFloat(document.getElementById('caudal_rech_left').value) || 0;

    // Calcular rechazo iónico
    const rechazoFound = condRedFound > 0 ? ((1 - (condPermFound / condRedFound)) * 100).toFixed(2) : '';
    const rechazoLeft = condRedLeft > 0 ? ((1 - (condPermLeft / condRedLeft)) * 100).toFixed(2) : '';

    document.getElementById('rechazo_found').value = rechazoFound ? `${rechazoFound} %` : '';
    document.getElementById('rechazo_left').value = rechazoLeft ? `${rechazoLeft} %` : '';

    // Calcular relación rechazo:permeado
    const relacionFound = caudalPermFound > 0 ? (caudalRechFound / caudalPermFound).toFixed(1) : '';
    const relacionLeft = caudalPermLeft > 0 ? (caudalRechLeft / caudalPermLeft).toFixed(1) : '';

    document.getElementById('relacion_found').value = relacionFound ? `${relacionFound}:1` : '';
    document.getElementById('relacion_left').value = relacionLeft ? `${relacionLeft}:1` : '';
}

function updateConversions(inputEl, outputEl) {
    const lmin = parseFloat(inputEl.value);
    if (!isNaN(lmin) && lmin >= 0) {
        const lph = lmin * LMIN_TO_LPH;
        const gpd = lmin * LMIN_TO_GPD;
        outputEl.textContent = `(${lph.toFixed(1)} l/h | ${gpd.toFixed(0)} GPD)`;
    } else {
        outputEl.textContent = '';
    }
}

function setStatusColor(selectElement) {
    selectElement.classList.remove('status-pass', 'status-fail', 'status-na');
    const value = selectElement.value;
    if (value === 'Pasa' || value === 'Realizada' || value === 'No') {
        selectElement.classList.add('status-pass');
    } else if (value === 'Falla' || value === 'No Realizada' || value === 'Sí') {
        selectElement.classList.add('status-fail');
    } else {
        selectElement.classList.add('status-na');
    }
}

// Función para guardar el nuevo mantenimiento
async function guardarNuevoMantenimiento() {
    console.log('💾 Intentando guardar mantenimiento...');

    const guardarBtn = document.getElementById('guardarButton');
    const originalText = guardarBtn.textContent;
    guardarBtn.textContent = "Guardando...";
    guardarBtn.disabled = true;

    try {
        const datos = {
            action: 'guardar',
            cliente: document.getElementById('cliente').value,
            fecha: document.getElementById('fecha').value,
            direccion: document.getElementById('direccion').value,
            tecnico: document.getElementById('tecnico').value,
            modelo: document.getElementById('modelo').value,
            id_interna: document.getElementById('id_interna').value,
            n_serie: document.getElementById('n_serie').value,
            proximo_mant: document.getElementById('proximo_mant').value,
            fugas_found: document.getElementById('fugas_found').value,
            fugas_left: document.getElementById('fugas_left').value,
            cond_red_found: document.getElementById('cond_red_found').value || 0,
            cond_red_left: document.getElementById('cond_red_left').value || 0,
            cond_perm_found: document.getElementById('cond_perm_found').value || 0,
            cond_perm_left: document.getElementById('cond_perm_left').value || 0,
            rechazo_found: document.getElementById('rechazo_found').value,
            rechazo_left: document.getElementById('rechazo_left').value,
            presion_found: document.getElementById('presion_found').value || 0,
            presion_left: document.getElementById('presion_left').value || 0,
            caudal_perm_found: document.getElementById('caudal_perm_found').value || 0,
            caudal_perm_left: document.getElementById('caudal_perm_left').value || 0,
            caudal_rech_found: document.getElementById('caudal_rech_found').value || 0,
            caudal_rech_left: document.getElementById('caudal_rech_left').value || 0,
            relacion_found: document.getElementById('relacion_found').value,
            relacion_left: document.getElementById('relacion_left').value,
            precarga_found: document.getElementById('precarga_found').value || 0,
            precarga_left: document.getElementById('precarga_left').value || 0,
            presostato_alta_found: document.getElementById('presostato_alta_found').value,
            presostato_alta_left: document.getElementById('presostato_alta_left').value,
            presostato_baja_found: document.getElementById('presostato_baja_found').value,
            presostato_baja_left: document.getElementById('presostato_baja_left').value,
            etapa1_detalles: document.getElementById('etapa1_detalles').value,
            etapa1_accion: document.querySelector('input[name="etapa1_action"]:checked')?.value || '',
            etapa2_detalles: document.getElementById('etapa2_detalles').value,
            etapa2_accion: document.querySelector('input[name="etapa2_action"]:checked')?.value || '',
            etapa3_detalles: document.getElementById('etapa3_detalles').value,
            etapa3_accion: document.querySelector('input[name="etapa3_action"]:checked')?.value || '',
            etapa4_detalles: document.getElementById('etapa4_detalles').value,
            etapa4_accion: document.querySelector('input[name="etapa4_action"]:checked')?.value || '',
            etapa5_detalles: document.getElementById('etapa5_detalles').value,
            etapa5_accion: document.querySelector('input[name="etapa5_action"]:checked')?.value || '',
            etapa6_detalles: document.getElementById('etapa6_detalles').value,
            etapa6_accion: document.querySelector('input[name="etapa6_action"]:checked')?.value || '',
            sanitizacion: document.getElementById('sanitizacion_status').value,
            resumen: document.getElementById('resumen').value,
            numero_reporte: 'REP-' + new Date().getTime()
        };

        console.log('📤 Enviando datos:', datos);

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain; charset=utf-8'
            },
            body: JSON.stringify(datos)
        });

        const result = await response.json();
        console.log('📥 Respuesta del servidor:', result);

        if (result.result === 'success') {
            alert('✅ Mantenimiento guardado correctamente en el sistema');

            // Generar número de reporte para impresión
            const now = new Date();
            const padZero = (num) => String(num).padStart(2, '0');
            const timestamp = `${now.getFullYear()}${padZero(now.getMonth() + 1)}${padZero(now.getDate())}-${padZero(now.getHours())}${padZero(now.getMinutes())}${padZero(now.getSeconds())}`;
            document.getElementById('report-number-display').textContent = `REP-${timestamp}`;

            // Imprimir después de guardar
            setTimeout(() => {
                window.print();
            }, 500);

        } else {
            throw new Error(result.error || 'Error desconocido');
        }
    } catch (error) {
        console.error('❌ Error:', error);
        alert('❌ Error al guardar los datos: ' + error.message);
    } finally {
        guardarBtn.textContent = originalText;
        guardarBtn.disabled = false;
    }
}

// Buscar mantenimientos
async function buscarMantenimientos() {
    console.log('🔍 Buscando mantenimientos...');
    const cliente = document.getElementById('buscar-cliente').value;
    const tecnico = document.getElementById('buscar-tecnico').value;
    const fecha = document.getElementById('buscar-fecha').value;

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain; charset=utf-8'
            },
            body: JSON.stringify({
                action: 'buscar',
                cliente: cliente,
                tecnico: tecnico,
                fecha: fecha
            })
        });

        const result = await response.json();

        if (result.result === 'success') {
            mantenimientos = result.data;
            mostrarResultadosBusqueda();
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('Error buscando mantenimientos:', error);
        alert('Error al buscar mantenimientos');
    }
}

// Mostrar resultados de búsqueda
function mostrarResultadosBusqueda() {
    const tabla = document.getElementById('tabla-resultados');
    if (!tabla) {
        console.log('❌ No se encontró la tabla de resultados');
        return;
    }

    tabla.innerHTML = '';

    if (mantenimientos.length === 0) {
        tabla.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center">No se encontraron resultados</td></tr>';
        document.getElementById('resultados-busqueda').classList.remove('hidden');
        return;
    }

    mantenimientos.forEach(mantenimiento => {
        const fila = document.createElement('tr');
        fila.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap">${mantenimiento.Cliente || 'N/A'}</td>
            <td class="px-6 py-4 whitespace-nowrap">${mantenimiento.Fecha_Servicio || 'N/A'}</td>
            <td class="px-6 py-4 whitespace-nowrap">${mantenimiento.Tecnico_Asignado || 'N/A'}</td>
            <td class="px-6 py-4 whitespace-nowrap">${mantenimiento.Modelo_Equipo || 'N/A'}</td>
            <td class="px-6 py-4 whitespace-nowrap">
                <button onclick="editarMantenimiento('${mantenimiento.ID_Unico}')" class="text-blue-600 hover:text-blue-900 mr-2">Editar</button>
                <button onclick="eliminarMantenimiento('${mantenimiento.ID_Unico}')" class="text-red-600 hover:text-red-900">Eliminar</button>
            </td>
        `;
        tabla.appendChild(fila);
    });

    document.getElementById('resultados-busqueda').classList.remove('hidden');
}

// Editar mantenimiento
function editarMantenimiento(id) {
    mantenimientoEditando = mantenimientos.find(m => m.ID_Unico === id);

    document.getElementById('formulario-edicion').innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
                <input type="text" id="edit-cliente" value="${mantenimientoEditando.Cliente || ''}" class="w-full border-gray-300 rounded-md p-2">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Fecha Servicio</label>
                <input type="date" id="edit-fecha" value="${mantenimientoEditando.Fecha_Servicio || ''}" class="w-full border-gray-300 rounded-md p-2">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Técnico</label>
                <input type="text" id="edit-tecnico" value="${mantenimientoEditando.Tecnico_Asignado || ''}" class="w-full border-gray-300 rounded-md p-2">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Próximo Mantenimiento</label>
                <input type="date" id="edit-proximo-mant" value="${mantenimientoEditando.Proximo_Mantenimiento || ''}" class="w-full border-gray-300 rounded-md p-2">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Conductividad Permeado</label>
                <input type="number" id="edit-cond-perm" value="${mantenimientoEditando.Conductividad_Permeado_Left || 0}" class="w-full border-gray-300 rounded-md p-2">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Resumen</label>
                <textarea id="edit-resumen" rows="3" class="w-full border-gray-300 rounded-md p-2">${mantenimientoEditando.Resumen_Recomendaciones || ''}</textarea>
            </div>
        </div>
        <input type="hidden" id="edit-id" value="${mantenimientoEditando.ID_Unico}">
    `;

    document.getElementById('modal-edicion').classList.remove('hidden');
}

// Guardar edición
async function guardarEdicion() {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain; charset=utf-8'
            },
            body: JSON.stringify({
                action: 'actualizar',
                id: document.getElementById('edit-id').value,
                cliente: document.getElementById('edit-cliente').value,
                fecha_servicio: document.getElementById('edit-fecha').value,
                tecnico_asignado: document.getElementById('edit-tecnico').value,
                proximo_mantenimiento: document.getElementById('edit-proximo-mant').value,
                conductividad_permeado_left: document.getElementById('edit-cond-perm').value,
                resumen_recomendaciones: document.getElementById('edit-resumen').value
            })
        });

        const result = await response.json();

        if (result.result === 'success') {
            alert('✅ Cambios guardados correctamente');
            cerrarModal();
            buscarMantenimientos();
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('Error guardando cambios:', error);
        alert('Error al guardar cambios');
    }
}

// Cerrar modal
function cerrarModal() {
    document.getElementById('modal-edicion').classList.add('hidden');
}

// Eliminar mantenimiento
async function eliminarMantenimiento(id) {
    if (confirm('¿Estás seguro de que quieres eliminar este mantenimiento?')) {
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain; charset=utf-8'
                },
                body: JSON.stringify({
                    action: 'eliminar',
                    id: id
                })
            });

            const result = await response.json();

            if (result.result === 'success') {
                alert('✅ Mantenimiento eliminado correctamente');
                buscarMantenimientos();
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Error eliminando mantenimiento:', error);
            alert('Error al eliminar mantenimiento');
        }
    }
}

// Limpiar búsqueda
function limpiarBusqueda() {
    document.getElementById('buscar-cliente').value = '';
    document.getElementById('buscar-tecnico').value = '';
    document.getElementById('buscar-fecha').value = '';
    document.getElementById('resultados-busqueda').classList.add('hidden');
}

// Cargar dashboard
async function cargarDashboard() {
    try {
        const response = await fetch(API_URL + '?action=dashboard');
        const result = await response.json();

        if (result.result === 'success') {
            const data = result.data;

            document.getElementById('total-mantenimientos').textContent = data.total;
            document.getElementById('mantenimientos-mes').textContent = data.esteMes;
            document.getElementById('proximos-mantenimientos').textContent = data.proximos;
            document.getElementById('tecnicos-activos').textContent = data.tecnicos;

            crearGraficoMensual(data.mensual);
            crearGraficoTecnicos(data.tecnicosData);
            mostrarProximosMantenimientos(data.proximosMantenimientos);
        }
    } catch (error) {
        console.error('Error cargando dashboard:', error);
    }
}

// Crear gráfico mensual
function crearGraficoMensual(datos) {
    const ctx = document.getElementById('chart-mensual');
    if (!ctx) return;

    if (chartMensual) {
        chartMensual.destroy();
    }
    chartMensual = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
            datasets: [{
                label: 'Mantenimientos por Mes',
                data: datos,
                backgroundColor: 'rgba(54, 162, 235, 0.5)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

// Crear gráfico de técnicos
function crearGraficoTecnicos(datos) {
    const ctx = document.getElementById('chart-tecnicos');
    if (!ctx) return;

    if (chartTecnicos) {
        chartTecnicos.destroy();
    }
    chartTecnicos = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: datos.map(d => d.tecnico),
            datasets: [{
                data: datos.map(d => d.count),
                backgroundColor: [
                    'rgba(255, 99, 132, 0.5)',
                    'rgba(54, 162, 235, 0.5)',
                    'rgba(255, 206, 86, 0.5)',
                    'rgba(75, 192, 192, 0.5)',
                    'rgba(153, 102, 255, 0.5)',
                    'rgba(255, 159, 64, 0.5)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true
        }
    });
}

// Mostrar próximos mantenimientos
function mostrarProximosMantenimientos(mantenimientos) {
    const tabla = document.getElementById('tabla-proximos');
    if (!tabla) return;

    tabla.innerHTML = '';

    if (mantenimientos.length === 0) {
        tabla.innerHTML = '<tr><td colspan="4" class="px-6 py-4 text-center">No hay próximos mantenimientos</td></tr>';
        return;
    }

    mantenimientos.forEach(m => {
        const fila = document.createElement('tr');
        fila.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap">${m.cliente || 'N/A'}</td>
            <td class="px-6 py-4 whitespace-nowrap">${m.fecha || 'N/A'}</td>
            <td class="px-6 py-4 whitespace-nowrap">${m.tecnico || 'N/A'}</td>
            <td class="px-6 py-4 whitespace-nowrap">${m.dias_restantes} días</td>
        `;
        tabla.appendChild(fila);
    });
}

// Inicialización cuando el DOM esté completamente cargado
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 DOM cargado, inicializando sistema...');
    inicializarSistema();
});

// También forzar inicialización por si acaso
window.addEventListener('load', inicializarSistema);

