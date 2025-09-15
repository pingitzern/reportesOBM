import { API_URL } from './config.js';

async function postJSON(payload) {
    if (!API_URL) {
        throw new Error('API_URL no está configurada.');
    }

    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
        },
        body: JSON.stringify(payload),
    });

    const result = await response.json();

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
    if (!API_URL) {
        throw new Error('API_URL no está configurada.');
    }

    const response = await fetch(`${API_URL}?action=dashboard`);
    const result = await response.json();

    if (result.result !== 'success') {
        throw new Error(result.error || 'Error desconocido');
    }

    return result.data;
}
