import { API_URL } from './config.js';
import { getCurrentToken, handleSessionExpiration, isDevMode } from './modules/login/auth.js';
import { state } from './modules/mantenimiento/state.js';

// Acciones públicas que no requieren autenticación
const PUBLIC_ACTIONS = new Set(['login', 'version_info']);

// Acciones que se hacen públicas en modo desarrollo
const DEV_PUBLIC_ACTIONS = new Set([
    'obtener_clientes',
    'obtener_dashboard',
    'obtener_remitos',
    'buscar',
    'guardar',
    'guardar_ablandador',
    'actualizar',
    'eliminar',
    'crear_remito',
    'actualizar_remito',
    'eliminar_remito',
    'crear_ticket_feedback',
]);

async function postJSON(payload) {
    if (!API_URL) {
        throw new Error('API_URL no está configurada.');
    }

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

    // Verificar si la acción es pública o si estamos en modo desarrollo
    const isPublicAction = PUBLIC_ACTIONS.has(action) || 
                          (isDevMode() && DEV_PUBLIC_ACTIONS.has(action));

    if (!isPublicAction) {
        const token = getCurrentToken();
        if (!token) {
            throw new Error('No hay una sesión activa. Por favor, ingresá de nuevo.');
        }
        requestPayload.token = token;
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
    // En modo desarrollo, retornar datos mock
    if (DEV_MODE) {
        return {
            totalMantenimientos: 0,
            esteMes: 0,
            proximos: 0,
            tecnicosActivos: 0,
            mantenimientosPorMes: [],
            distribucionTecnico: [],
            proximosMantenimientos: []
        };
    }
    
    return postJSON({
        action: 'dashboard',
    });
}

// ⚠️ SOLO PARA DESARROLLO - Datos mock
const DEV_MODE = false; // Cambiar a false en producción
const MOCK_CLIENTES = [
    {
        key: 'cliente1',
        razon_social: 'Complejo Deportivo Municipal',
        direccion: 'Parque Industrial Sector B',
        telefono: '011-4567-8900',
        email: 'contacto@cliente.com.ar',
        cuit: '30-12345678-9'
    },
    {
        key: 'cliente2',
        razon_social: 'Hospital General',
        direccion: 'Av. Principal 1234',
        telefono: '011-5555-1234',
        email: 'info@hospital.com.ar',
        cuit: '30-98765432-1'
    },
    {
        key: 'cliente3',
        razon_social: 'Fábrica Textil SA',
        direccion: 'Zona Industrial 789',
        telefono: '011-6666-7890',
        email: 'admin@fabrica.com',
        cuit: '30-55555555-5'
    }
];

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

export async function enviarFeedbackTicket(datos) {
    return postJSON({
        action: 'crear_ticket_feedback',
        ...(datos ?? {}),
    });
}

