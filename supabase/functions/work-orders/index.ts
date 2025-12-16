/**
 * Edge Function: work-orders (v2 - Robusta)
 * 
 * Gestión de Work Orders con cálculo logístico real
 * 
 * Endpoints:
 *   POST { action: "create", ... }
 *   POST { action: "assign", wo_id, tecnico_id, fecha_hora_inicio }
 *   POST { action: "update-status", wo_id, estado }
 */

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.1';

// =====================================================
// CONFIGURACIÓN
// =====================================================

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY') || '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
});

// Default fallback para tiempo de viaje si Google Maps falla
const DEFAULT_TRAVEL_TIME_MIN = 30;

// =====================================================
// TIPOS
// =====================================================

type Prioridad = 'Baja' | 'Media' | 'Alta' | 'EMERGENCIA_COMODIN';
type Estado = 'Bolsa_Trabajo' | 'Asignada' | 'Confirmada_Cliente' | 'En_Progreso' | 'Completada' | 'Cancelada';

interface Coordinates {
    lat: number;
    lng: number;
}

interface AssignPayload {
    action: 'assign';
    wo_id: string;
    tecnico_id: string;
    fecha_hora_inicio: string; // ISO string o "YYYY-MM-DDTHH:mm"
}

interface CreatePayload {
    action: 'create';
    cliente_id: string;
    catalogo_servicio_id?: string;
    equipo_id?: string;
    prioridad: Prioridad;
    titulo: string;
    descripcion?: string;
    notas_internas?: string;
    tiempo_servicio_estimado?: number;
    creador_id: string;
}

interface UpdateStatusPayload {
    action: 'update-status';
    wo_id: string;
    estado: Estado;
}

type WorkOrderPayload = AssignPayload | CreatePayload | UpdateStatusPayload;

// =====================================================
// MAIN HANDLER
// =====================================================

Deno.serve(async (req) => {
    // CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    if (req.method !== 'POST') {
        return jsonResponse({ error: 'Método no permitido' }, 405);
    }

    try {
        const payload: WorkOrderPayload = await req.json();

        console.log('[work-orders] Recibido:', JSON.stringify(payload));

        if (!payload.action) {
            return jsonResponse({ error: 'Se requiere action: create | assign | update-status' }, 400);
        }

        switch (payload.action) {
            case 'assign':
                return await handleAssign(payload as AssignPayload);

            case 'create':
                return await handleCreate(payload as CreatePayload);

            case 'delete':
                return await handleDelete(payload as any);

            case 'update-status':
                return await handleUpdateStatus(payload as UpdateStatusPayload);

            default:
                return jsonResponse({ error: `Acción no soportada` }, 400);
        }

    } catch (error) {
        console.error('[work-orders] Error crítico:', error);
        return jsonResponse({
            error: error instanceof Error ? error.message : 'Error interno del servidor',
            details: error instanceof Error ? error.stack : undefined,
        }, 500);
    }
});

// =====================================================
// HANDLER: ASSIGN (La función principal corregida)
// =====================================================

async function handleAssign(payload: AssignPayload): Promise<Response> {
    const { wo_id, tecnico_id, fecha_hora_inicio } = payload;

    console.log(`[work-orders/assign] Iniciando asignación: WO=${wo_id}, Técnico=${tecnico_id}, Fecha=${fecha_hora_inicio}`);

    // ─────────────────────────────────────────────────
    // PASO A: Validación
    // ─────────────────────────────────────────────────

    if (!wo_id || !tecnico_id || !fecha_hora_inicio) {
        return jsonResponse({
            error: 'Parámetros incompletos',
            required: ['wo_id', 'tecnico_id', 'fecha_hora_inicio'],
            received: { wo_id: !!wo_id, tecnico_id: !!tecnico_id, fecha_hora_inicio: !!fecha_hora_inicio }
        }, 400);
    }

    // Obtener la WO con datos del cliente
    const { data: wo, error: woError } = await supabaseAdmin
        .from('ordenes_trabajo')
        .select(`
            id,
            numero_wo,
            titulo,
            estado,
            tiempo_servicio_estimado,
            cliente_id,
            clients!inner (
                id,
                razon_social,
                direccion,
                lat,
                lng
            )
        `)
        .eq('id', wo_id)
        .single();

    if (woError || !wo) {
        console.error('[work-orders/assign] WO no encontrada:', woError);
        return jsonResponse({ error: 'Orden de trabajo no encontrada', wo_id }, 404);
    }

    console.log(`[work-orders/assign] WO encontrada: ${wo.numero_wo}`);

    // Verificar estado válido para asignar
    if (!['Bolsa_Trabajo', 'Asignada'].includes(wo.estado)) {
        return jsonResponse({
            error: `No se puede asignar una WO en estado '${wo.estado}'`,
            estado_actual: wo.estado
        }, 400);
    }

    // Obtener el técnico con sus coordenadas
    const { data: tecnico, error: tecnicoError } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, email, lat, lng, direccion_base, activo')
        .eq('id', tecnico_id)
        .single();

    if (tecnicoError || !tecnico) {
        console.error('[work-orders/assign] Técnico no encontrado:', tecnicoError);
        return jsonResponse({ error: 'Técnico no encontrado', tecnico_id }, 404);
    }

    if (tecnico.activo === false) {
        return jsonResponse({ error: 'El técnico no está activo', tecnico_id }, 400);
    }

    console.log(`[work-orders/assign] Técnico encontrado: ${tecnico.full_name}`);

    // ─────────────────────────────────────────────────
    // PASO B: Obtención de Coordenadas
    // ─────────────────────────────────────────────────

    const cliente = wo.clients as unknown as {
        id: string;
        razon_social: string;
        direccion: string;
        lat: number | null;
        lng: number | null
    };

    const tecnicoCoords: Coordinates | null = (tecnico.lat && tecnico.lng)
        ? { lat: tecnico.lat, lng: tecnico.lng }
        : null;

    const clienteCoords: Coordinates | null = (cliente.lat && cliente.lng)
        ? { lat: cliente.lat, lng: cliente.lng }
        : null;

    console.log('[work-orders/assign] Coordenadas:', {
        tecnico: tecnicoCoords,
        cliente: clienteCoords,
    });

    // ─────────────────────────────────────────────────
    // PASO C: Cálculo Logístico (Distance Matrix)
    // ─────────────────────────────────────────────────

    let tiempoViajeEstimado = DEFAULT_TRAVEL_TIME_MIN;
    let distanciaKm = 0;
    let warningMessage: string | null = null;

    if (tecnicoCoords && clienteCoords && GOOGLE_MAPS_API_KEY) {
        try {
            // Usar la hora de inicio de la WO para predicción de tráfico
            const departureTime = new Date(fecha_hora_inicio);
            const travelResult = await calculateDistanceMatrix(tecnicoCoords, clienteCoords, departureTime);

            if (travelResult) {
                tiempoViajeEstimado = travelResult.duration_min;
                distanciaKm = travelResult.distance_km;
                console.log(`[work-orders/assign] ✅ Tiempo de viaje calculado: ${tiempoViajeEstimado} min, ${distanciaKm} km`);
            } else {
                warningMessage = 'No se pudo calcular tiempo de viaje, usando valor por defecto';
                console.warn('[work-orders/assign] ⚠️', warningMessage);
            }
        } catch (err) {
            warningMessage = `Error en Distance Matrix: ${err instanceof Error ? err.message : 'desconocido'}`;
            console.warn('[work-orders/assign] ⚠️', warningMessage);
        }
    } else {
        if (!tecnicoCoords) warningMessage = 'Técnico sin coordenadas, usando tiempo por defecto';
        else if (!clienteCoords) warningMessage = 'Cliente sin coordenadas, usando tiempo por defecto';
        else if (!GOOGLE_MAPS_API_KEY) warningMessage = 'API Key de Google Maps no configurada';

        console.warn('[work-orders/assign] ⚠️', warningMessage);
    }

    // ─────────────────────────────────────────────────
    // PASO D: Persistencia Transaccional
    // ─────────────────────────────────────────────────

    const updateData = {
        tecnico_asignado_id: tecnico_id,
        fecha_programada: fecha_hora_inicio,
        tiempo_viaje_ida_estimado: tiempoViajeEstimado,
        tiempo_viaje_vuelta_estimado: Math.round(tiempoViajeEstimado * 0.9), // Vuelta ~10% menos (menos tráfico)
        estado: 'Asignada' as Estado,
        updated_at: new Date().toISOString(),
    };

    console.log('[work-orders/assign] Actualizando WO:', updateData);

    const { data: updatedWO, error: updateError } = await supabaseAdmin
        .from('ordenes_trabajo')
        .update(updateData)
        .eq('id', wo_id)
        .select(`
            id,
            numero_wo,
            titulo,
            descripcion,
            prioridad,
            estado,
            fecha_programada,
            tiempo_servicio_estimado,
            tiempo_viaje_ida_estimado,
            tiempo_viaje_vuelta_estimado,
            cliente_id,
            tecnico_asignado_id,
            clients (
                id,
                razon_social,
                direccion,
                lat,
                lng
            )
        `)
        .single();

    if (updateError) {
        console.error('[work-orders/assign] Error actualizando WO:', updateError);
        return jsonResponse({
            error: 'Error al actualizar la orden de trabajo',
            details: updateError.message
        }, 500);
    }

    // ─────────────────────────────────────────────────
    // PASO E: Respuesta
    // ─────────────────────────────────────────────────

    const responseData = {
        success: true,
        warning: warningMessage,
        wo: {
            ...updatedWO,
            tecnico_nombre: tecnico.full_name,
            cliente_nombre: cliente.razon_social,
            cliente_direccion: cliente.direccion,
            distancia_km: distanciaKm,
        },
    };

    console.log(`[work-orders/assign] ✅ Asignación completada: ${wo.numero_wo} → ${tecnico.full_name}`);

    return jsonResponse(responseData);
}

// =====================================================
// HANDLER: CREATE
// =====================================================

async function handleCreate(payload: CreatePayload): Promise<Response> {
    try {
        const { cliente_id, catalogo_servicio_id, equipo_id, prioridad, titulo, descripcion, notas_internas, creador_id, tiempo_servicio_estimado: tiempoEstimadoPayload } = payload;

        console.log('[work-orders/create] Iniciando creación:', { cliente_id, titulo, tiempoEstimadoPayload });

        // Validaciones básicas
        if (!cliente_id) return jsonResponse({ error: 'Se requiere cliente_id' }, 400);
        if (!prioridad) return jsonResponse({ error: 'Se requiere prioridad' }, 400);
        if (!titulo) return jsonResponse({ error: 'Se requiere titulo' }, 400);
        if (!creador_id) return jsonResponse({ error: 'Se requiere creador_id' }, 400);

        // Validar que el cliente existe
        const { data: cliente, error: clienteError } = await supabaseAdmin
            .from('clients')
            .select('id, razon_social')
            .eq('id', cliente_id)
            .single();

        if (clienteError || !cliente) {
            console.error('[work-orders/create] Cliente error:', clienteError);
            return jsonResponse({ error: 'Cliente no encontrado' }, 404);
        }

        // Si es EMERGENCIA_COMODIN, validar límite mensual
        if (prioridad === 'EMERGENCIA_COMODIN') {
            const { data: puedeUsar, error: comodinError } = await supabaseAdmin
                .rpc('validar_uso_comodin', { p_usuario_id: creador_id });

            if (comodinError) {
                console.error('[work-orders/create] Error validando comodín:', comodinError);
                return jsonResponse({ error: 'Error validando uso del comodín' }, 500);
            }

            if (!puedeUsar) {
                return jsonResponse({
                    error: 'Límite de comodín de emergencia alcanzado',
                    code: 'COMODIN_LIMIT_EXCEEDED'
                }, 403);
            }
        }

        // Obtener duración: Prioridad al payload (permite override manual), fallback al catálogo
        let tiempoServicioEstimado: number | null = tiempoEstimadoPayload || null;

        if (!tiempoServicioEstimado && catalogo_servicio_id) {
            const { data: catalogo } = await supabaseAdmin
                .from('catalogo_servicios')
                .select('duracion_estimada_min')
                .eq('id', catalogo_servicio_id)
                .single();

            if (catalogo) {
                tiempoServicioEstimado = catalogo.duracion_estimada_min;
            }
        }

        // Crear la WO
        const insertData = {
            cliente_id,
            catalogo_servicio_id: catalogo_servicio_id || null, // Convertir empty strings a null
            equipo_id: equipo_id || null, // Convertir empty strings a null
            prioridad,
            titulo,
            descripcion: descripcion || null,
            notas_internas: notas_internas || null,
            creador_id,
            estado: 'Bolsa_Trabajo',
            tiempo_servicio_estimado: tiempoServicioEstimado,
        };

        const { data: wo, error: woError } = await supabaseAdmin
            .from('ordenes_trabajo')
            .insert(insertData)
            .select('id, numero_wo, prioridad, estado, tiempo_servicio_estimado')
            .single();

        if (woError) {
            console.error('[work-orders/create] Error creando WO en DB:', woError);
            console.error('[work-orders/create] Data intentada:', JSON.stringify(insertData));
            return jsonResponse({ error: `Error DB: ${woError.message}`, details: woError }, 500);
        }

        // Registrar uso de comodín si aplica
        if (prioridad === 'EMERGENCIA_COMODIN' && wo) {
            await supabaseAdmin.from('log_prioridad_comodin').insert({
                usuario_id: creador_id,
                wo_id: wo.id,
                motivo: `Creación de WO emergencia: ${titulo}`,
            });
        }

        console.log(`[work-orders/create] ✅ WO creada: ${wo?.numero_wo}`);

        return jsonResponse({
            success: true,
            wo: { ...wo, cliente_nombre: cliente.razon_social },
        });

    } catch (e: any) {
        console.error('[work-orders/create] Exception:', e);
        return jsonResponse({ error: `Excepción interna: ${e.message}` }, 500);
    }
}

// =====================================================
// HANDLER: UPDATE STATUS
// =====================================================

async function handleUpdateStatus(payload: UpdateStatusPayload): Promise<Response> {
    const { wo_id, estado } = payload;

    if (!wo_id) return jsonResponse({ error: 'Se requiere wo_id' }, 400);
    if (!estado) return jsonResponse({ error: 'Se requiere estado' }, 400);

    const estadosValidos: Estado[] = ['Bolsa_Trabajo', 'Asignada', 'Confirmada_Cliente', 'En_Progreso', 'Completada', 'Cancelada'];
    if (!estadosValidos.includes(estado)) {
        return jsonResponse({ error: `Estado inválido: ${estado}` }, 400);
    }

    // Verificar que la WO existe
    const { data: wo, error: woError } = await supabaseAdmin
        .from('ordenes_trabajo')
        .select('id, numero_wo, estado')
        .eq('id', wo_id)
        .single();

    if (woError || !wo) {
        return jsonResponse({ error: 'Orden de trabajo no encontrada' }, 404);
    }

    // Preparar updates según el nuevo estado
    const updateData: Record<string, unknown> = {
        estado,
        updated_at: new Date().toISOString(),
    };

    if (estado === 'En_Progreso') {
        updateData.fecha_inicio_real = new Date().toISOString();
    } else if (estado === 'Completada') {
        updateData.fecha_fin_real = new Date().toISOString();
    } else if (estado === 'Bolsa_Trabajo') {
        // Desasignar
        updateData.tecnico_asignado_id = null;
        updateData.fecha_programada = null;
        updateData.tiempo_viaje_ida_estimado = null;
        updateData.tiempo_viaje_vuelta_estimado = null;
    }

    const { error: updateError } = await supabaseAdmin
        .from('ordenes_trabajo')
        .update(updateData)
        .eq('id', wo_id);

    if (updateError) {
        console.error('[work-orders/update-status] Error:', updateError);
        return jsonResponse({ error: `Error actualizando estado: ${updateError.message}` }, 500);
    }

    console.log(`[work-orders/update-status] ✅ ${wo.numero_wo}: ${wo.estado} → ${estado}`);

    return jsonResponse({
        success: true,
        numero_wo: wo.numero_wo,
        estado_anterior: wo.estado,
        estado_nuevo: estado,
    });
}

// =====================================================
// HANDLER: DELETE
// =====================================================

async function handleDelete(payload: { action: 'delete'; wo_id: string }): Promise<Response> {
    const { wo_id } = payload;
    console.log(`[work-orders/delete] Intentando eliminar wo_id: ${wo_id}`);

    if (!wo_id) return jsonResponse({ error: 'Se requiere wo_id' }, 400);

    // Verificar que la WO existe
    const { data: wo, error: woError } = await supabaseAdmin
        .from('ordenes_trabajo')
        .select('id, numero_wo')
        .eq('id', wo_id)
        .single();

    if (woError || !wo) {
        return jsonResponse({ error: 'Orden de trabajo no encontrada' }, 404);
    }

    // Eliminar
    const { error: deleteError } = await supabaseAdmin
        .from('ordenes_trabajo')
        .delete()
        .eq('id', wo_id);

    if (deleteError) {
        console.error('[work-orders/delete] Error:', deleteError);
        return jsonResponse({ error: `Error eliminando WO: ${deleteError.message}` }, 500);
    }

    console.log(`[work-orders/delete] ✅ Eliminada WO: ${wo.numero_wo}`);

    return jsonResponse({
        success: true,
        numero_wo: wo.numero_wo,
    });
}

// =====================================================
// UTILIDADES
// =====================================================

/**
 * Calcula distancia y tiempo usando Google Distance Matrix API
 * @param departureTime - Fecha/hora de partida para predicción de tráfico
 */
async function calculateDistanceMatrix(
    origin: Coordinates,
    destination: Coordinates,
    departureTime?: Date
): Promise<{ duration_min: number; distance_km: number } | null> {

    const originStr = `${origin.lat},${origin.lng}`;
    const destStr = `${destination.lat},${destination.lng}`;

    // Log para verificar que tenemos la API key
    console.log('[work-orders] GOOGLE_MAPS_API_KEY exists:', !!GOOGLE_MAPS_API_KEY, 'length:', GOOGLE_MAPS_API_KEY?.length);

    // Usar timestamp de la hora programada o 'now' si es en el pasado/inmediato
    let departureTimeParam = 'now';
    if (departureTime) {
        const timestamp = Math.floor(departureTime.getTime() / 1000);
        const nowTimestamp = Math.floor(Date.now() / 1000);
        // Solo usar timestamp futuro (Google requiere que sea en el futuro)
        if (timestamp > nowTimestamp + 60) {
            departureTimeParam = String(timestamp);
            console.log('[work-orders] Usando departure_time programado:', departureTime.toISOString());
        } else {
            console.log('[work-orders] Hora programada es pasado/inmediato, usando now');
        }
    }

    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originStr}&destinations=${destStr}&mode=driving&departure_time=${departureTimeParam}&key=${GOOGLE_MAPS_API_KEY}`;

    console.log('[work-orders] Llamando Distance Matrix con:', { origin: originStr, dest: destStr, departureTime: departureTimeParam });

    try {
        const response = await fetch(url);
        const data = await response.json();

        // Log detallado de la respuesta completa
        console.log('[work-orders] Distance Matrix FULL RESPONSE:', JSON.stringify(data, null, 2));

        if (data.status !== 'OK') {
            console.error('[work-orders] Distance Matrix error:', data.status, data.error_message);
            return null;
        }

        const element = data.rows?.[0]?.elements?.[0];
        if (!element || element.status !== 'OK') {
            console.error('[work-orders] Distance Matrix element error:', element?.status);
            return null;
        }

        const result = {
            duration_min: element.duration_in_traffic
                ? Math.round(element.duration_in_traffic.value / 60)
                : Math.round(element.duration.value / 60),
            distance_km: Math.round((element.distance.value / 1000) * 10) / 10,
        };

        console.log('[work-orders] Distance Matrix SUCCESS:', result);
        return result;

    } catch (fetchError) {
        console.error('[work-orders] Distance Matrix FETCH ERROR:', fetchError);
        return null;
    }
}

/**
 * Helper para respuestas JSON con CORS
 */
function jsonResponse(body: Record<string, unknown>, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            ...corsHeaders,
        },
    });
}
