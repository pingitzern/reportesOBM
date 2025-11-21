import { API_URL, DEV_MOCKS_ENABLED } from './config.js';
import { getCurrentToken, handleSessionExpiration } from './modules/login/auth.js';
import { state } from './modules/mantenimiento/state.js';

const PUBLIC_ACTIONS = new Set(['login', 'version_info']);

// ⚠️ SOLO PARA DESARROLLO - Mocks para navegar sin backend
const DEV_MODE = DEV_MOCKS_ENABLED;
const MOCK_DASHBOARD = {
    total: 18,
    esteMes: 4,
    proximos: 3,
    tecnicos: 5,
    mensual: [3, 1, 2, 1, 2, 1, 1, 2, 0, 3, 1, 1],
    tecnicosData: [
        { tecnico: 'Laura Silva', count: 6 },
        { tecnico: 'Juan Pérez', count: 5 },
        { tecnico: 'María López', count: 4 },
        { tecnico: 'Equipo Guardia', count: 3 },
    ],
    proximosMantenimientos: [
        { cliente: 'Hospital General', fecha: '2025-12-02', tecnico: 'Laura Silva', dias_restantes: 5 },
        { cliente: 'Fábrica Textil SA', fecha: '2025-12-04', tecnico: 'Juan Pérez', dias_restantes: 7 },
        { cliente: 'Complejo Deportivo Municipal', fecha: '2025-12-05', tecnico: 'Equipo Guardia', dias_restantes: 8 },
    ],
};
const MOCK_CLIENTES = [
    {
        key: 'cliente1',
        razon_social: 'Complejo Deportivo Municipal',
        direccion: 'Parque Industrial Sector B',
        telefono: '011-4567-8900',
        email: 'contacto@cliente.com.ar',
        cuit: '30-12345678-9',
    },
    {
        key: 'cliente2',
        razon_social: 'Hospital General',
        direccion: 'Av. Principal 1234',
        telefono: '011-5555-1234',
        email: 'info@hospital.com.ar',
        cuit: '30-98765432-1',
    },
    {
        key: 'cliente3',
        razon_social: 'Fábrica Textil SA',
        direccion: 'Zona Industrial 789',
        telefono: '011-6666-7890',
        email: 'admin@fabrica.com',
        cuit: '30-55555555-5',
    },
];
const MOCK_MANTENIMIENTOS = [
    {
        ID_Unico: 'DEV-001',
        Cliente: 'Hospital General',
        Fecha_Servicio: '2025-11-27',
        Tecnico_Asignado: 'Laura Silva',
        Modelo_Equipo: 'Ósmosis inversa',
        Proximo_Mantenimiento: '2026-01-05',
    },
    {
        ID_Unico: 'DEV-002',
        Cliente: 'Fábrica Textil SA',
        Fecha_Servicio: '2025-11-25',
        Tecnico_Asignado: 'Juan Pérez',
        Modelo_Equipo: 'Ablandador',
        Proximo_Mantenimiento: '2025-12-18',
    },
];
const MOCK_REMITOS = [
    {
        numeroRemito: 'REM-DEV-001',
        numeroReporte: 'REP-DEV-034',
        cliente: 'Hospital General',
        fechaRemito: '27/11/2025',
        fechaRemitoISO: '2025-11-27',
        fechaServicio: '26/11/2025',
        fechaServicioISO: '2025-11-26',
        tecnico: 'Laura Silva',
        observaciones: 'Chequeo general y recambio de filtros',
        direccion: 'Av. Principal 1234',
        telefono: '011-5555-1234',
        email: 'info@hospital.com.ar',
        cuit: '30-98765432-1',
        reporteId: 'REP-DEV-034',
    },
];
const MOCK_REMITOS_RESPONSE = {
    remitos: MOCK_REMITOS,
    totalPages: 1,
    totalItems: MOCK_REMITOS.length,
    currentPage: 1,
    pageSize: 20,
};

function getMockResponse(action) {
    switch (action) {
    case 'dashboard':
        return MOCK_DASHBOARD;
    case 'clientes':
        state.clientes = MOCK_CLIENTES;
        state.clientesLoaded = true;
        return state.clientes;
    case 'buscar':
        return MOCK_MANTENIMIENTOS;
    case 'guardar':
    case 'actualizar':
    case 'guardar_ablandador':
    case 'actualizar_remito':
        return { saved: true };
    case 'generar_pdf_ablandador':
        return { pdfUrl: '#', nombre: 'mantenimiento-ablandador-dev.pdf' };
    case 'obtener_remitos':
        return { ...MOCK_REMITOS_RESPONSE };
    case 'crear_remito':
        return {
            remitoId: 'REM-DEV-NEW',
            numeroRemito: 'REM-DEV-NEW',
        };
    case 'eliminar_remito':
    case 'eliminar':
        return { deleted: true };
    case 'version_info':
        return { version: 'dev' };
    case 'login':
        return { token: getCurrentToken() || 'dev-token' };
    default:
        return {};
    }
}

async function postJSON(payload) {
    const requestPayload = { ...(payload || {}) };
    const rawAction = typeof requestPayload.action === 'string'
        ? requestPayload.action
        : undefined;

    const action = typeof rawAction === 'string'
        ? rawAction.trim()
        : '';

    if (action) {
        requestPayload.action = action;
    }

    if (DEV_MODE) {
        return getMockResponse(action);
    }

    if (!PUBLIC_ACTIONS.has(action)) {
        const token = getCurrentToken();
        if (!token) {
            throw new Error('No hay una sesión activa. Por favor, ingresá de nuevo.');
        }
        requestPayload.token = token;
    }

    if (!API_URL) {
        throw new Error('API_URL no está configurada.');
    }

    let response;
    try {
        response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
            },
            body: JSON.stringify(requestPayload),
        });
    } catch (error) {
        if (error?.name === 'AbortError') {
            throw new Error('La solicitud excedió el tiempo de espera. Inténtalo nuevamente.');
        }

        if (error instanceof TypeError) {
            throw new Error('No se pudo conectar con el servidor. Verifica tu conexión a internet.');
        }

        throw new Error(error?.message || 'Error inesperado al comunicarse con el servidor.');
    }

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    let result;
    try {
        result = await response.json();
    } catch (error) {
        throw new Error('No se pudo interpretar la respuesta del servidor.');
    }

    if (result.result !== 'success') {
        const rawError = typeof result.error === 'string'
            ? result.error.trim()
            : typeof result.message === 'string'
                ? result.message.trim()
                : '';

        if (rawError === 'Sesión expirada' || rawError === 'Token inválido') {
            handleSessionExpiration();
            throw new Error('Tu sesión ha expirado. Por favor, ingresá de nuevo.');
        }

        throw new Error(rawError || 'Error desconocido');
    }

    return result.data;
}

export async function guardarMantenimiento(datos) {
    return postJSON({
        action: 'guardar',
        ...datos,
    });
}

export async function guardarMantenimientoAblandador(datos) {
    return postJSON({
        action: 'guardar_ablandador',
        ...(datos ?? {}),
    });
}

export async function generarPdfAblandador(datos) {
    return postJSON({
        action: 'generar_pdf_ablandador',
        ...(datos ?? {}),
    });
}

export async function buscarMantenimientos(filtros) {
    return postJSON({
        action: 'buscar',
        ...filtros,
    });
}

export async function actualizarMantenimiento(datos) {
    return postJSON({
        action: 'actualizar',
        ...datos,
    });
}

export async function eliminarMantenimiento(id) {
    return postJSON({
        action: 'eliminar',
        id,
    });
}

export async function obtenerDashboard() {
    return postJSON({
        action: 'dashboard',
    });
}

export async function obtenerClientes({ forceRefresh = false } = {}) {
    // En modo desarrollo, retornar datos mock
    if (DEV_MODE) {
        state.clientes = MOCK_CLIENTES;
        state.clientesLoaded = true;
        return state.clientes;
    }
    
    if (!forceRefresh && state.clientesLoaded) {
        return state.clientes;
    }

    const data = await postJSON({
        action: 'clientes',
    });

    if (!Array.isArray(data)) {
        throw new Error('La respuesta de clientes no es válida.');
    }

    state.clientes = data;
    state.clientesLoaded = true;

    return state.clientes;
}

export async function obtenerRemitos({ page = 1, pageSize = 20 } = {}) {
    return postJSON({
        action: 'obtener_remitos',
        page,
        pageSize,
    });
}

export async function crearRemito(datos) {
    return postJSON({
        action: 'crear_remito',
        ...(datos ?? {}),
    });
}

export async function actualizarRemito(datos) {
    return postJSON({
        action: 'actualizar_remito',
        ...(datos ?? {}),
    });
}

export async function eliminarRemito(remitoId) {
    if (remitoId && typeof remitoId === 'object') {
        return postJSON({
            action: 'eliminar_remito',
            ...remitoId,
        });
    }

    return postJSON({
        action: 'eliminar_remito',
        remitoId,
    });
}

export async function obtenerVersionServidor() {
    return postJSON({
        action: 'version_info',
    });
}

