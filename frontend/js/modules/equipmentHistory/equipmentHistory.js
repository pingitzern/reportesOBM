/**
 * Módulo de Historial de Equipos
 * Permite ver el historial de mantenimientos y remitos de un equipo específico.
 */

// =========================================================================
// ESTADO
// =========================================================================

let containerEl = null;
let selectedClientId = null;
let selectedEquipmentId = null;
let clientesCache = [];
let equiposCache = [];

// =========================================================================
// CONSTANTES
// =========================================================================

const CONTAINER_ID = 'equipment-history-container';
const PERIODS = [
    { value: '3m', label: 'Últimos 3 meses' },
    { value: '6m', label: 'Últimos 6 meses' },
    { value: '1y', label: 'Último año' },
    { value: 'all', label: 'Todo' },
];

// =========================================================================
// UI TEMPLATES
// =========================================================================

function createHistorySection() {
    return `
        <div id="${CONTAINER_ID}" class="mt-8 bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <!-- Header -->
            <div class="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
                <h2 class="text-xl font-bold text-white flex items-center gap-2">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
                    </svg>
                    Historial de Equipo
                </h2>
                <p class="text-indigo-100 text-sm mt-1">Consultá el historial completo de mantenimientos y remitos de un equipo.</p>
            </div>
            
            <!-- Filtros -->
            <div class="p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <!-- Selector Cliente -->
                    <div>
                        <label for="history-client-select" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cliente</label>
                        <select id="history-client-select" class="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                            <option value="">Seleccionar cliente...</option>
                        </select>
                    </div>
                    
                    <!-- Selector Equipo -->
                    <div>
                        <label for="history-equipment-select" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Equipo</label>
                        <select id="history-equipment-select" class="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" disabled>
                            <option value="">Primero seleccioná un cliente</option>
                        </select>
                    </div>
                    
                    <!-- Selector Período -->
                    <div>
                        <label for="history-period-select" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Período</label>
                        <select id="history-period-select" class="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                            ${PERIODS.map(p => `<option value="${p.value}">${p.label}</option>`).join('')}
                        </select>
                    </div>
                    
                    <!-- Botón Buscar -->
                    <div class="flex items-end">
                        <button id="history-search-btn" class="w-full px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2" disabled>
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                            </svg>
                            Buscar
                        </button>
                    </div>
                </div>
            </div>
            
            <!-- Timeline Container -->
            <div id="history-timeline" class="p-6">
                <div class="text-center text-gray-500 dark:text-gray-400 py-12">
                    <svg class="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                    </svg>
                    <p class="text-lg font-medium">Seleccioná un cliente y equipo para ver su historial</p>
                    <p class="text-sm mt-1">El historial incluirá todos los mantenimientos y remitos relacionados.</p>
                </div>
            </div>
        </div>
    `;
}

function renderTimelineEvent(event) {
    const isRemito = event.type === 'remito';
    const iconColor = isRemito ? 'text-amber-500' : 'text-emerald-500';
    const badgeColor = isRemito ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300';
    const borderColor = isRemito ? 'border-amber-300 dark:border-amber-600' : 'border-emerald-300 dark:border-emerald-600';

    const icon = isRemito
        ? `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>`
        : `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>`;

    const highlightsHtml = (event.highlights || []).map(h =>
        `<span class="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-700 text-xs font-medium text-gray-700 dark:text-gray-300">${h.label}: <strong>${h.value}</strong></span>`
    ).join('');

    return `
        <div class="relative pl-8 pb-8 border-l-2 ${borderColor} last:border-transparent last:pb-0">
            <!-- Dot -->
            <div class="absolute -left-3 w-6 h-6 rounded-full bg-white dark:bg-gray-800 border-2 ${borderColor} flex items-center justify-center">
                <svg class="w-4 h-4 ${iconColor}" fill="none" stroke="currentColor" viewBox="0 0 24 24">${icon}</svg>
            </div>
            
            <!-- Card -->
            <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
                <div class="p-4">
                    <!-- Header -->
                    <div class="flex items-start justify-between gap-4 mb-3">
                        <div class="flex items-center gap-3">
                            <span class="text-sm font-semibold text-gray-900 dark:text-gray-100">${event.date}</span>
                            <span class="${badgeColor} text-xs font-medium px-2 py-0.5 rounded-full">${isRemito ? 'REMITO' : 'MANTENIMIENTO'}</span>
                        </div>
                        <span class="text-xs text-gray-500 dark:text-gray-400">#${event.reportNumber || 'N/A'}</span>
                    </div>
                    
                    <!-- Highlights -->
                    ${highlightsHtml ? `<div class="flex flex-wrap gap-2 mb-3">${highlightsHtml}</div>` : ''}
                    
                    <!-- Observations -->
                    ${event.observations ? `<p class="text-sm text-gray-600 dark:text-gray-400 italic border-l-2 border-gray-300 pl-3">"${event.observations}"</p>` : ''}
                    
                    <!-- Footer -->
                    <div class="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span>Técnico: ${event.technician || 'N/A'}</span>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderTimeline(events) {
    const timeline = document.getElementById('history-timeline');
    if (!timeline) return;

    if (!events || events.length === 0) {
        timeline.innerHTML = `
            <div class="text-center text-gray-500 dark:text-gray-400 py-12">
                <svg class="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/>
                </svg>
                <p class="text-lg font-medium">No se encontraron registros</p>
                <p class="text-sm mt-1">El equipo no tiene mantenimientos ni remitos en el período seleccionado.</p>
            </div>
        `;
        return;
    }

    timeline.innerHTML = `
        <div class="mb-4 flex items-center justify-between">
            <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-200">${events.length} registro${events.length !== 1 ? 's' : ''} encontrado${events.length !== 1 ? 's' : ''}</h3>
        </div>
        <div class="space-y-0">
            ${events.map(e => renderTimelineEvent(e)).join('')}
        </div>
    `;
}

function renderLoading() {
    const timeline = document.getElementById('history-timeline');
    if (!timeline) return;

    timeline.innerHTML = `
        <div class="text-center py-12">
            <div class="inline-flex items-center gap-3">
                <svg class="animate-spin h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span class="text-gray-600 dark:text-gray-400 font-medium">Cargando historial...</span>
            </div>
        </div>
    `;
}

// =========================================================================
// API FUNCTIONS
// =========================================================================

async function fetchClientes(api) {
    try {
        const clientes = await api.obtenerClientes();
        clientesCache = clientes || [];
        return clientesCache;
    } catch (error) {
        console.error('Error cargando clientes:', error);
        return [];
    }
}

async function fetchEquiposPorCliente(supabase, clientId) {
    try {
        const { data, error } = await supabase
            .from('equipments')
            .select(`
                id,
                serial_number,
                modelo,
                tag_id,
                sistemas:sistema_id (id, nombre, categoria)
            `)
            .eq('client_id', clientId)
            .eq('activo', true)
            .order('serial_number');

        if (error) throw error;
        equiposCache = data || [];
        return equiposCache;
    } catch (error) {
        console.error('Error cargando equipos:', error);
        return [];
    }
}

async function fetchHistorialEquipo(supabase, equipmentId, clientId, period) {
    const desde = getPeriodDate(period);

    try {
        // Buscar mantenimientos por equipment_id
        let maintQuery = supabase
            .from('maintenances')
            .select('*')
            .eq('equipment_id', equipmentId)
            .order('service_date', { ascending: false });

        if (desde) {
            maintQuery = maintQuery.gte('service_date', desde.toISOString());
        }

        const { data: maintenances, error: maintError } = await maintQuery;
        // No throw en error - puede que la tabla no tenga equipment_id, continuamos con remitos
        if (maintError) {
            console.warn('Advertencia cargando mantenimientos:', maintError.message);
        }

        // Buscar remitos por client_id (remitos están vinculados a clientes)
        let remitoQuery = supabase
            .from('remitos')
            .select('*')
            .eq('client_id', clientId)
            .order('fecha_remito', { ascending: false });

        if (desde) {
            remitoQuery = remitoQuery.gte('fecha_remito', desde.toISOString());
        }

        const { data: remitos, error: remitoError } = await remitoQuery;
        if (remitoError) {
            console.warn('Advertencia cargando remitos:', remitoError.message);
        }

        // Transformar y combinar
        const events = [
            ...(maintenances || []).map(m => transformMaintenance(m)),
            ...(remitos || []).map(r => transformRemito(r)),
        ].sort((a, b) => new Date(b.rawDate) - new Date(a.rawDate));

        return events;
    } catch (error) {
        console.error('Error cargando historial:', error);
        return [];
    }
}

function getPeriodDate(period) {
    const now = new Date();
    switch (period) {
        case '3m': return new Date(now.setMonth(now.getMonth() - 3));
        case '6m': return new Date(now.setMonth(now.getMonth() - 6));
        case '1y': return new Date(now.setFullYear(now.getFullYear() - 1));
        default: return null;
    }
}

function transformMaintenance(m) {
    const payload = m.payload || {};
    const seccionC = payload.seccion_C || {};
    const seccionF = payload.seccion_F || {};
    const seccionE = payload.seccion_E || {};

    const highlights = [];

    // Extraer highlights según tipo de mantenimiento
    if (seccionC.dureza_agua_cruda) {
        highlights.push({ label: 'Dureza', value: `${seccionC.dureza_agua_cruda} ppm` });
    }
    if (seccionF.nivel_sal_as_left) {
        highlights.push({ label: 'Sal', value: seccionF.nivel_sal_as_left });
    }
    if (seccionF.presion_entrada_as_left && seccionF.presion_salida_as_left) {
        const deltaP = (seccionF.presion_entrada_as_left - seccionF.presion_salida_as_left).toFixed(2);
        highlights.push({ label: 'ΔP', value: `${deltaP} bar` });
    }

    return {
        type: 'maintenance',
        rawDate: m.service_date,
        date: formatDate(m.service_date),
        reportNumber: m.report_number || payload.metadata?.numero_reporte,
        highlights,
        observations: seccionE.trabajo_realizado || seccionF.observaciones || '',
        technician: m.technician_name || payload.seccion_A_servicio?.tecnico || 'N/A',
    };
}

function transformRemito(r) {
    const highlights = [];

    // Materiales del remito
    if (r.items && Array.isArray(r.items)) {
        const itemsList = r.items.slice(0, 3).map(i => `${i.cantidad}x ${i.descripcion}`).join(', ');
        if (itemsList) {
            highlights.push({ label: 'Items', value: itemsList });
        }
    }

    return {
        type: 'remito',
        rawDate: r.fecha_remito,
        date: formatDate(r.fecha_remito),
        reportNumber: r.numero_remito,
        highlights,
        observations: r.notas || '',
        technician: r.technician_name || 'N/A',
    };
}

function formatDate(dateStr) {
    if (!dateStr) return 'Fecha desconocida';
    try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('es-AR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    } catch {
        return dateStr;
    }
}

// =========================================================================
// EVENT HANDLERS
// =========================================================================

function attachEventListeners(api, supabase) {
    const clientSelect = document.getElementById('history-client-select');
    const equipmentSelect = document.getElementById('history-equipment-select');
    const searchBtn = document.getElementById('history-search-btn');

    if (clientSelect) {
        clientSelect.addEventListener('change', async (e) => {
            selectedClientId = e.target.value;
            equipmentSelect.innerHTML = '<option value="">Cargando equipos...</option>';
            equipmentSelect.disabled = true;
            searchBtn.disabled = true;

            if (selectedClientId) {
                const equipos = await fetchEquiposPorCliente(supabase, selectedClientId);
                equipmentSelect.innerHTML = equipos.length
                    ? `<option value="">Seleccionar equipo...</option>${equipos.map(eq =>
                        `<option value="${eq.id}">${eq.sistemas?.nombre || 'Equipo'} - ${eq.modelo || eq.serial_number || 'Sin modelo'}</option>`
                    ).join('')}`
                    : '<option value="">Sin equipos registrados</option>';
                equipmentSelect.disabled = equipos.length === 0;
            } else {
                equipmentSelect.innerHTML = '<option value="">Primero seleccioná un cliente</option>';
            }
        });
    }

    if (equipmentSelect) {
        equipmentSelect.addEventListener('change', (e) => {
            selectedEquipmentId = e.target.value;
            searchBtn.disabled = !selectedEquipmentId;
        });
    }

    if (searchBtn) {
        searchBtn.addEventListener('click', async () => {
            if (!selectedEquipmentId || !selectedClientId) return;

            const period = document.getElementById('history-period-select')?.value || '1y';
            renderLoading();

            const events = await fetchHistorialEquipo(supabase, selectedEquipmentId, selectedClientId, period);
            renderTimeline(events);
        });
    }
}

// =========================================================================
// EXPORTS
// =========================================================================

export async function initEquipmentHistory(api, supabase, targetElement) {
    // Insertar HTML
    if (targetElement) {
        targetElement.insertAdjacentHTML('beforeend', createHistorySection());
    }

    containerEl = document.getElementById(CONTAINER_ID);
    if (!containerEl) {
        console.warn('EquipmentHistory: Container not found');
        return;
    }

    // Cargar clientes
    const clientes = await fetchClientes(api);
    const clientSelect = document.getElementById('history-client-select');
    if (clientSelect && clientes.length) {
        clientSelect.innerHTML = `
            <option value="">Seleccionar cliente...</option>
            ${clientes.map(c => `<option value="${c.id}">${c.nombre || c.name || c.full_name}</option>`).join('')}
        `;
    }

    // Attach listeners
    attachEventListeners(api, supabase);

    console.log('✅ Módulo de Historial de Equipos inicializado');
}

export function destroyEquipmentHistory() {
    if (containerEl) {
        containerEl.remove();
        containerEl = null;
    }
    selectedClientId = null;
    selectedEquipmentId = null;
}
