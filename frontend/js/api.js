import { API_URL } from './config.js';
import { state } from './state.js';

async function postJSON(payload) {
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
            body: JSON.stringify(payload),
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
        throw new Error(result.error || 'Error desconocido');
    }

    return result.data;
}

export async function guardarMantenimiento(datos) {
    return postJSON({
        action: 'guardar',
        ...datos,
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
