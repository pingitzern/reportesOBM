/* global Chart */

let chartMensual = null;
let chartTecnicos = null;

function getElement(id) {
    return document.getElementById(id);
}

function createMonthlyChart(datos = []) {
    const canvas = getElement('chart-mensual');
    if (!canvas) {
        return;
    }

    if (chartMensual) {
        chartMensual.destroy();
    }

    chartMensual = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
            datasets: [
                {
                    label: 'Mantenimientos por Mes',
                    data: datos,
                    backgroundColor: 'rgba(54, 162, 235, 0.5)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1,
                },
            ],
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1,
                    },
                },
            },
        },
    });
}

function createTechnicianChart(datos = []) {
    const canvas = getElement('chart-tecnicos');
    if (!canvas) {
        return;
    }

    if (chartTecnicos) {
        chartTecnicos.destroy();
    }

    chartTecnicos = new Chart(canvas, {
        type: 'pie',
        data: {
            labels: datos.map(d => d.tecnico),
            datasets: [
                {
                    data: datos.map(d => d.count),
                    backgroundColor: [
                        'rgba(255, 99, 132, 0.5)',
                        'rgba(54, 162, 235, 0.5)',
                        'rgba(255, 206, 86, 0.5)',
                        'rgba(75, 192, 192, 0.5)',
                        'rgba(153, 102, 255, 0.5)',
                        'rgba(255, 159, 64, 0.5)',
                    ],
                    borderWidth: 1,
                },
            ],
        },
        options: {
            responsive: true,
        },
    });
}

function renderUpcomingMaintenances(mantenimientos = []) {
    const tabla = getElement('tabla-proximos');
    if (!tabla) {
        return;
    }

    tabla.innerHTML = '';

    if (!mantenimientos.length) {
        const emptyRow = document.createElement('tr');
        const emptyCell = document.createElement('td');
        emptyCell.colSpan = 4;
        emptyCell.className = 'px-6 py-4 text-center';
        emptyCell.textContent = 'No hay próximos mantenimientos';
        emptyRow.appendChild(emptyCell);
        tabla.appendChild(emptyRow);
        return;
    }

    mantenimientos.forEach(m => {
        const fila = document.createElement('tr');

        const createCell = (text) => {
            const cell = document.createElement('td');
            cell.className = 'px-6 py-4 whitespace-nowrap';
            cell.textContent = text;
            return cell;
        };

        fila.appendChild(createCell(m.cliente || 'N/A'));
        fila.appendChild(createCell(m.fecha || 'N/A'));
        fila.appendChild(createCell(m.tecnico || 'N/A'));
        fila.appendChild(createCell(`${m.dias_restantes} días`));

        tabla.appendChild(fila);
    });
}

export function renderDashboard(data) {
    if (!data) {
        return;
    }

    const total = getElement('total-mantenimientos');
    const mes = getElement('mantenimientos-mes');
    const proximos = getElement('proximos-mantenimientos');
    const tecnicos = getElement('tecnicos-activos');

    if (total) total.textContent = data.total ?? 0;
    if (mes) mes.textContent = data.esteMes ?? 0;
    if (proximos) proximos.textContent = data.proximos ?? 0;
    if (tecnicos) tecnicos.textContent = data.tecnicos ?? 0;

    createMonthlyChart(Array.isArray(data.mensual) ? data.mensual : []);
    createTechnicianChart(Array.isArray(data.tecnicosData) ? data.tecnicosData : []);
    renderUpcomingMaintenances(Array.isArray(data.proximosMantenimientos) ? data.proximosMantenimientos : []);
}

export function createDashboardModule(api, dependencies = {}) {
    const { obtenerDashboard } = api;
    const { showView: showViewFn } = dependencies;

    async function fetchAndRender() {
        try {
            const data = await obtenerDashboard();
            renderDashboard(data);
        } catch (error) {
            console.error('Error cargando dashboard:', error);
        }
    }

    async function show() {
        if (typeof showViewFn === 'function') {
            showViewFn('tab-dashboard');
        }
        await fetchAndRender();
    }

    async function initialize() {
        await fetchAndRender();
    }

    return {
        initialize,
        show,
        refresh: fetchAndRender,
    };
}
