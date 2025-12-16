/**
 * Edge Function: technician-matching
 * 
 * Algoritmo de sugerencia de técnicos para Work Orders
 * 
 * Endpoints:
 *   POST /technician-matching { wo_id }
 *   POST /technician-matching { cliente_id, catalogo_servicio_id? }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.1';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
});

// Tipos
interface Coordinates {
    lat: number;
    lng: number;
}

interface TecnicoSugerido {
    id: string;
    nombre: string;
    email: string;
    distancia_km: number;
    habilidades: HabilidadTecnico[];
    score_ponderado: number;
    tiene_todas_habilidades: boolean;
}

interface HabilidadTecnico {
    habilidad_id: string;
    nombre: string;
    categoria: string;
    nivel: number;
}

interface MatchingPayload {
    wo_id?: string;
    cliente_id?: string;
    catalogo_servicio_id?: string;
}

Deno.serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    if (req.method !== 'POST') {
        return jsonResponse({ error: 'Método no permitido' }, 405);
    }

    try {
        const payload: MatchingPayload = await req.json();

        // Opción 1: Buscar por WO existente
        if (payload.wo_id) {
            return await handleMatchByWO(payload.wo_id);
        }

        // Opción 2: Buscar por cliente y servicio
        if (payload.cliente_id) {
            return await handleMatchByClient(payload.cliente_id, payload.catalogo_servicio_id);
        }

        return jsonResponse({ error: 'Se requiere wo_id o cliente_id' }, 400);

    } catch (error) {
        console.error('technician-matching error:', error);
        return jsonResponse({
            error: error instanceof Error ? error.message : 'Error inesperado'
        }, 500);
    }
});

/**
 * Buscar técnicos para una WO existente
 */
async function handleMatchByWO(wo_id: string): Promise<Response> {
    // Obtener la WO con datos del cliente y catálogo
    const { data: wo, error: woError } = await supabaseAdmin
        .from('ordenes_trabajo')
        .select(`
            id,
            numero_wo,
            cliente_id,
            catalogo_servicio_id,
            clients!inner (
                id,
                razon_social,
                lat,
                lng
            ),
            catalogo_servicios (
                id,
                tipo_tarea,
                requiere_habilidades
            )
        `)
        .eq('id', wo_id)
        .single();

    if (woError || !wo) {
        return jsonResponse({ error: 'Orden de trabajo no encontrada' }, 404);
    }

    const cliente = wo.clients as unknown as { id: string; razon_social: string; lat: number | null; lng: number | null };
    const catalogo = wo.catalogo_servicios as unknown as { id: string; tipo_tarea: string; requiere_habilidades: string[] | null } | null;

    if (!cliente.lat || !cliente.lng) {
        return jsonResponse({
            error: 'El cliente no tiene coordenadas. Ejecute batch-geocode primero.',
            cliente_id: cliente.id,
            cliente_nombre: cliente.razon_social
        }, 400);
    }

    const clienteCoords: Coordinates = { lat: cliente.lat, lng: cliente.lng };
    const habilidadesRequeridas = catalogo?.requiere_habilidades || [];

    const tecnicos = await findMatchingTechnicians(clienteCoords, habilidadesRequeridas);

    return jsonResponse({
        numero_wo: wo.numero_wo,
        cliente: cliente.razon_social,
        tipo_tarea: catalogo?.tipo_tarea || 'Sin especificar',
        habilidades_requeridas: habilidadesRequeridas.length,
        tecnicos_sugeridos: tecnicos.length,
        tecnicos,
    });
}

/**
 * Buscar técnicos para un cliente/servicio sin WO
 */
async function handleMatchByClient(cliente_id: string, catalogo_servicio_id?: string): Promise<Response> {
    // Obtener datos del cliente
    const { data: cliente, error: clienteError } = await supabaseAdmin
        .from('clients')
        .select('id, razon_social, lat, lng')
        .eq('id', cliente_id)
        .single();

    if (clienteError || !cliente) {
        return jsonResponse({ error: 'Cliente no encontrado' }, 404);
    }

    if (!cliente.lat || !cliente.lng) {
        return jsonResponse({
            error: 'El cliente no tiene coordenadas. Ejecute batch-geocode primero.',
            cliente_id: cliente.id,
            cliente_nombre: cliente.razon_social
        }, 400);
    }

    const clienteCoords: Coordinates = { lat: cliente.lat, lng: cliente.lng };
    let habilidadesRequeridas: string[] = [];

    // Si se especificó catálogo, obtener habilidades requeridas
    if (catalogo_servicio_id) {
        const { data: catalogo } = await supabaseAdmin
            .from('catalogo_servicios')
            .select('requiere_habilidades')
            .eq('id', catalogo_servicio_id)
            .single();

        if (catalogo?.requiere_habilidades) {
            habilidadesRequeridas = catalogo.requiere_habilidades;
        }
    }

    const tecnicos = await findMatchingTechnicians(clienteCoords, habilidadesRequeridas);

    return jsonResponse({
        cliente: cliente.razon_social,
        habilidades_requeridas: habilidadesRequeridas.length,
        tecnicos_sugeridos: tecnicos.length,
        tecnicos,
    });
}

/**
 * Buscar técnicos activos, filtrar por habilidades y ordenar por distancia
 */
async function findMatchingTechnicians(
    clienteCoords: Coordinates,
    habilidadesRequeridas: string[]
): Promise<TecnicoSugerido[]> {

    // Obtener todos los técnicos activos con sus habilidades
    const { data: tecnicos, error } = await supabaseAdmin
        .from('tecnicos_con_habilidades')
        .select('*');

    if (error) {
        console.error('Error obteniendo técnicos:', error);
        throw new Error('Error obteniendo técnicos');
    }

    if (!tecnicos || tecnicos.length === 0) {
        return [];
    }

    // Procesar cada técnico
    const tecnicosSugeridos: TecnicoSugerido[] = [];

    for (const tecnico of tecnicos) {
        // Si el técnico no tiene coordenadas, lo saltamos
        if (!tecnico.lat || !tecnico.lng) {
            console.log(`[matching] Técnico ${tecnico.nombre} sin coordenadas, omitido`);
            continue;
        }

        const tecnicoCoords: Coordinates = { lat: tecnico.lat, lng: tecnico.lng };
        const distancia_km = haversineDistance(clienteCoords, tecnicoCoords);

        // Parsear habilidades del JSON
        let habilidades: HabilidadTecnico[] = [];
        try {
            habilidades = Array.isArray(tecnico.habilidades)
                ? tecnico.habilidades
                : JSON.parse(tecnico.habilidades || '[]');
        } catch {
            habilidades = [];
        }

        // Verificar si tiene todas las habilidades requeridas
        const habilidadIds = habilidades.map(h => h.habilidad_id);
        const tiene_todas_habilidades = habilidadesRequeridas.length === 0 ||
            habilidadesRequeridas.every(reqId => habilidadIds.includes(reqId));

        // Si hay habilidades requeridas y no las tiene todas, lo ponemos al final
        // pero no lo excluimos (puede ser útil para emergencias)

        tecnicosSugeridos.push({
            id: tecnico.tecnico_id,
            nombre: tecnico.nombre,
            email: tecnico.email,
            distancia_km: Math.round(distancia_km * 10) / 10, // Redondear a 1 decimal
            habilidades,
            score_ponderado: tecnico.score_ponderado || 0,
            tiene_todas_habilidades,
        });
    }

    // Ordenar: primero los que tienen todas las habilidades, luego por distancia
    tecnicosSugeridos.sort((a, b) => {
        // Priorizar los que tienen todas las habilidades
        if (a.tiene_todas_habilidades && !b.tiene_todas_habilidades) return -1;
        if (!a.tiene_todas_habilidades && b.tiene_todas_habilidades) return 1;

        // Luego por distancia
        return a.distancia_km - b.distancia_km;
    });

    return tecnicosSugeridos;
}

/**
 * Calcular distancia entre dos puntos usando fórmula de Haversine
 * Retorna distancia en kilómetros
 */
function haversineDistance(coord1: Coordinates, coord2: Coordinates): number {
    const R = 6371; // Radio de la Tierra en km

    const dLat = toRad(coord2.lat - coord1.lat);
    const dLon = toRad(coord2.lng - coord1.lng);

    const lat1 = toRad(coord1.lat);
    const lat2 = toRad(coord2.lat);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

function toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            ...corsHeaders,
        },
    });
}
