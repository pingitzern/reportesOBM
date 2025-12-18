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

interface UnassignPayload {
    action: 'unassign';
    wo_id: string;
    motivo?: string; // Motivo de la cancelación
}

interface RepositionPayload {
    action: 'reposition';
    wo_id: string;
    nuevo_tecnico_id: string;
    fecha_hora_inicio: string;
    tecnico_anterior_id?: string; // Para enviar notificación de cancelación
}

type WorkOrderPayload = AssignPayload | CreatePayload | UpdateStatusPayload | UnassignPayload | RepositionPayload;

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

            case 'unassign':
                return await handleUnassign(payload as UnassignPayload);

            case 'reposition':
                return await handleReposition(payload as RepositionPayload);

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
            descripcion,
            notas_internas,
            prioridad,
            estado,
            tiempo_servicio_estimado,
            token_confirmacion,
            cliente_id,
            clients!inner (
                id,
                razon_social,
                direccion,
                lat,
                lng,
                email,
                telefono
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
    // PASO C: Cálculo Logístico con Origen Encadenado
    // ─────────────────────────────────────────────────

    let tiempoViajeEstimado = DEFAULT_TRAVEL_TIME_MIN;
    let distanciaKm = 0;
    let warningMessage: string | null = null;

    // Encontrar el punto de origen correcto (cliente anterior o base del técnico)
    const { origin: origenCoords } = await findOriginForNewWO(
        tecnico_id,
        tecnicoCoords,
        fecha_hora_inicio,
        wo_id
    );

    console.log('[work-orders/assign] Origen calculado:', origenCoords);

    if (origenCoords && clienteCoords && GOOGLE_MAPS_API_KEY) {
        try {
            // Usar la hora de inicio de la WO para predicción de tráfico
            const departureTime = new Date(fecha_hora_inicio);
            const travelResult = await calculateDistanceMatrix(origenCoords, clienteCoords, departureTime);

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
        if (!origenCoords) warningMessage = 'Sin coordenadas de origen, usando tiempo por defecto';
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
    // PASO D.1: Recalcular WOs posteriores en cascada
    // ─────────────────────────────────────────────────
    const fechaAsignacion = fecha_hora_inicio.split('T')[0];
    const recalcResult = await recalculateSubsequentWOs(
        tecnico_id,
        tecnicoCoords,
        fechaAsignacion,
        fecha_hora_inicio
    );

    if (recalcResult.recalculated > 0) {
        console.log(`[work-orders/assign] ♻️ Recalculadas ${recalcResult.recalculated} WOs posteriores`);
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

    // ─────────────────────────────────────────────────
    // PASO F: ENCOLAR NOTIFICACIONES (delay de 2 minutos)
    // ─────────────────────────────────────────────────
    const fechaFormateada = new Date(fecha_hora_inicio).toLocaleString('es-AR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });

    const DELAY_MS = 2 * 60 * 1000; // 2 minutos
    const enviarEn = new Date(Date.now() + DELAY_MS).toISOString();

    const emailData = {
        tecnicoNombre: tecnico.full_name,
        numeroWO: wo.numero_wo,
        clienteNombre: cliente.razon_social,
        clienteTelefono: cliente.telefono || null,
        clienteDireccion: cliente.direccion || '',
        clienteLat: cliente.lat,
        clienteLng: cliente.lng,
        tipoServicio: wo.titulo || 'Servicio Técnico',
        fechaProgramada: fechaFormateada,
        tiempoEstimado: wo.tiempo_servicio_estimado || 60,
        descripcion: wo.descripcion || '',
        notasInternas: wo.notas_internas || '',
        prioridad: wo.prioridad || 'Media',
        tokenConfirmacion: (wo as any).token_confirmacion || '',
    };

    // Encolar emails (no bloquea la respuesta)
    const emailsToQueue = [];

    // Email al técnico
    if (tecnico.email) {
        emailsToQueue.push({
            wo_id: wo_id,
            tipo: 'wo-tecnico',
            destinatario: tecnico.email,
            destinatario_nombre: tecnico.full_name,
            data: emailData,
            programado_para: enviarEn,
        });
    }

    // Email al cliente
    if (cliente.email) {
        emailsToQueue.push({
            wo_id: wo_id,
            tipo: 'wo-cliente',
            destinatario: cliente.email,
            destinatario_nombre: cliente.razon_social,
            data: emailData,
            programado_para: enviarEn,
        });
    }

    if (emailsToQueue.length > 0) {
        supabaseAdmin
            .from('email_queue')
            .insert(emailsToQueue)
            .then(({ error }) => {
                if (error) {
                    console.error('[work-orders/assign] Error encolando emails:', error);
                } else {
                    console.log(`[work-orders/assign] ✉️ ${emailsToQueue.length} email(s) encolados para envío en 2 minutos`);
                }
            });
    }

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
// HANDLER: UNASSIGN (Desasignar WO y cancelar/enviar emails)
// =====================================================

async function handleUnassign(payload: UnassignPayload): Promise<Response> {
    const { wo_id, motivo } = payload;
    console.log(`[work-orders/unassign] Desasignando wo_id: ${wo_id}`);

    if (!wo_id) return jsonResponse({ error: 'Se requiere wo_id' }, 400);

    // Obtener WO con datos necesarios para email de cancelación
    const { data: wo, error: woError } = await supabaseAdmin
        .from('ordenes_trabajo')
        .select(`
            id,
            numero_wo,
            titulo,
            estado,
            fecha_programada,
            tiempo_servicio_estimado,
            tecnico_asignado_id,
            cliente_id,
            clients!inner (
                id,
                razon_social,
                direccion,
                email
            )
        `)
        .eq('id', wo_id)
        .single();

    if (woError || !wo) {
        console.error('[work-orders/unassign] WO no encontrada:', woError);
        return jsonResponse({ error: 'Orden de trabajo no encontrada' }, 404);
    }

    // Verificar que está asignada
    if (wo.estado !== 'Asignada') {
        return jsonResponse({
            error: `No se puede desasignar una WO en estado '${wo.estado}'`,
            estado_actual: wo.estado
        }, 400);
    }

    // Obtener datos del técnico para posible email de cancelación
    let tecnico = null;
    if (wo.tecnico_asignado_id) {
        const { data: t } = await supabaseAdmin
            .from('profiles')
            .select('id, full_name, email')
            .eq('id', wo.tecnico_asignado_id)
            .single();
        tecnico = t;
    }

    // ─────────────────────────────────────────────────
    // PASO 1: Cancelar emails pendientes
    // ─────────────────────────────────────────────────
    const { data: pendingEmails } = await supabaseAdmin
        .from('email_queue')
        .select('id, estado')
        .eq('wo_id', wo_id)
        .eq('estado', 'pendiente');

    const pendingCount = pendingEmails?.length || 0;

    // Marcar emails pendientes como cancelados
    if (pendingCount > 0) {
        await supabaseAdmin
            .from('email_queue')
            .update({ estado: 'cancelado' })
            .eq('wo_id', wo_id)
            .eq('estado', 'pendiente');

        console.log(`[work-orders/unassign] ✅ ${pendingCount} email(s) pendientes cancelados`);
    }

    // ─────────────────────────────────────────────────
    // PASO 2: Si ya se enviaron emails, enviar cancelación
    // ─────────────────────────────────────────────────
    const { data: sentEmails } = await supabaseAdmin
        .from('email_queue')
        .select('id, tipo, destinatario')
        .eq('wo_id', wo_id)
        .eq('estado', 'enviado');

    const sentToTecnico = sentEmails?.find(e => e.tipo === 'wo-tecnico');
    const sentToCliente = sentEmails?.find(e => e.tipo === 'wo-cliente');

    // Formatear fecha para el email de cancelación
    const fechaFormateada = wo.fecha_programada
        ? new Date(wo.fecha_programada).toLocaleString('es-AR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        })
        : 'No especificada';

    const cliente = wo.clients as any;

    // Enviar cancelación al técnico si ya recibió el email
    if (sentToTecnico && tecnico?.email) {
        await supabaseAdmin
            .from('email_queue')
            .insert({
                wo_id: wo_id,
                tipo: 'wo-cancelacion',
                destinatario: tecnico.email,
                destinatario_nombre: tecnico.full_name,
                data: {
                    tecnicoNombre: tecnico.full_name,
                    numeroWO: wo.numero_wo,
                    clienteNombre: cliente?.razon_social || 'Cliente',
                    clienteDireccion: cliente?.direccion || '',
                    tipoServicio: wo.titulo || 'Servicio Técnico',
                    fechaProgramada: fechaFormateada,
                    motivo: motivo || 'Reprogramación por parte de coordinación',
                },
                programado_para: new Date().toISOString(),
            });

        console.log(`[work-orders/unassign] ✉️ Email de cancelación encolado para técnico: ${tecnico.email}`);
    }

    // Enviar cancelación al cliente si ya recibió la confirmación
    if (sentToCliente && cliente?.email) {
        await supabaseAdmin
            .from('email_queue')
            .insert({
                wo_id: wo_id,
                tipo: 'wo-cancelacion-cliente',
                destinatario: cliente.email,
                destinatario_nombre: cliente.razon_social,
                data: {
                    clienteNombre: cliente.razon_social || 'Cliente',
                    numeroWO: wo.numero_wo,
                    tipoServicio: wo.titulo || 'Servicio Técnico',
                    fechaProgramada: fechaFormateada,
                    motivo: motivo || 'Reprogramación por parte de nuestro equipo',
                },
                programado_para: new Date().toISOString(),
            });

        console.log(`[work-orders/unassign] ✉️ Email de cancelación encolado para cliente: ${cliente.email}`);
    }

    // ─────────────────────────────────────────────────
    // PASO 3: Actualizar WO a Bolsa_Trabajo
    // ─────────────────────────────────────────────────
    const { error: updateError } = await supabaseAdmin
        .from('ordenes_trabajo')
        .update({
            estado: 'Bolsa_Trabajo',
            tecnico_asignado_id: null,
            fecha_programada: null,
            tiempo_viaje_ida_estimado: null,
            tiempo_viaje_vuelta_estimado: null,
        })
        .eq('id', wo_id);

    if (updateError) {
        console.error('[work-orders/unassign] Error actualizando WO:', updateError);
        return jsonResponse({ error: 'Error al desasignar la orden de trabajo' }, 500);
    }

    console.log(`[work-orders/unassign] ✅ WO ${wo.numero_wo} desasignada y devuelta a Bolsa_Trabajo`);

    return jsonResponse({
        success: true,
        numero_wo: wo.numero_wo,
        emails_cancelados: pendingCount,
        email_cancelacion_enviado: !!sentToTecnico,
    });
}

// =====================================================
// HANDLER: REPOSITION (Reubicar WO a otro técnico/hora)
// =====================================================

async function handleReposition(payload: RepositionPayload): Promise<Response> {
    const { wo_id, nuevo_tecnico_id, fecha_hora_inicio, tecnico_anterior_id } = payload;
    console.log(`[work-orders/reposition] Reubicando wo_id: ${wo_id} → técnico: ${nuevo_tecnico_id}`);

    if (!wo_id || !nuevo_tecnico_id || !fecha_hora_inicio) {
        return jsonResponse({ error: 'Se requiere wo_id, nuevo_tecnico_id y fecha_hora_inicio' }, 400);
    }

    // Obtener WO con datos
    const { data: wo, error: woError } = await supabaseAdmin
        .from('ordenes_trabajo')
        .select(`
            id,
            numero_wo,
            titulo,
            estado,
            fecha_programada,
            tiempo_servicio_estimado,
            tecnico_asignado_id,
            cliente_id,
            clients!inner (
                id,
                razon_social,
                direccion,
                email,
                lat,
                lng
            )
        `)
        .eq('id', wo_id)
        .single();

    if (woError || !wo) {
        console.error('[work-orders/reposition] WO no encontrada:', woError);
        return jsonResponse({ error: 'Orden de trabajo no encontrada' }, 404);
    }

    const tecnicoAnteriorId = tecnico_anterior_id || wo.tecnico_asignado_id;
    const cambioTecnico = tecnicoAnteriorId && tecnicoAnteriorId !== nuevo_tecnico_id;

    // Obtener datos del técnico anterior si hay cambio
    let tecnicoAnterior: { id: string; full_name: string; email: string } | null = null;
    if (cambioTecnico && tecnicoAnteriorId) {
        const { data: t } = await supabaseAdmin
            .from('profiles')
            .select('id, full_name, email')
            .eq('id', tecnicoAnteriorId)
            .single();
        tecnicoAnterior = t;
    }

    // Obtener datos del nuevo técnico
    const { data: nuevoTecnico, error: tecnicoError } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, email, lat, lng')
        .eq('id', nuevo_tecnico_id)
        .single();

    if (tecnicoError || !nuevoTecnico) {
        return jsonResponse({ error: 'Técnico nuevo no encontrado' }, 404);
    }

    const cliente = wo.clients as any;

    // ─────────────────────────────────────────────────
    // PASO 1: Si hay cambio de técnico, cancelar emails pendientes al anterior
    // ─────────────────────────────────────────────────
    if (cambioTecnico) {
        // Cancelar emails pendientes al técnico anterior
        const { data: pendingEmails } = await supabaseAdmin
            .from('email_queue')
            .select('id')
            .eq('wo_id', wo_id)
            .eq('estado', 'pendiente');

        if (pendingEmails && pendingEmails.length > 0) {
            await supabaseAdmin
                .from('email_queue')
                .update({ estado: 'cancelado' })
                .eq('wo_id', wo_id)
                .eq('estado', 'pendiente');

            console.log(`[work-orders/reposition] ✅ ${pendingEmails.length} emails pendientes cancelados`);
        }

        // Verificar si ya se envió email al técnico anterior
        const { data: sentEmails } = await supabaseAdmin
            .from('email_queue')
            .select('id, tipo')
            .eq('wo_id', wo_id)
            .eq('estado', 'enviado')
            .eq('tipo', 'wo-tecnico');

        const fechaOriginalFormateada = wo.fecha_programada
            ? new Date(wo.fecha_programada).toLocaleString('es-AR', {
                weekday: 'long', day: 'numeric', month: 'long',
                year: 'numeric', hour: '2-digit', minute: '2-digit',
            })
            : 'No especificada';

        // Enviar cancelación al técnico anterior si ya había recibido email
        if (sentEmails && sentEmails.length > 0 && tecnicoAnterior?.email) {
            await supabaseAdmin
                .from('email_queue')
                .insert({
                    wo_id: wo_id,
                    tipo: 'wo-cancelacion',
                    destinatario: tecnicoAnterior.email,
                    destinatario_nombre: tecnicoAnterior.full_name,
                    data: {
                        tecnicoNombre: tecnicoAnterior.full_name,
                        numeroWO: wo.numero_wo,
                        clienteNombre: cliente?.razon_social || 'Cliente',
                        clienteDireccion: cliente?.direccion || '',
                        tipoServicio: wo.titulo || 'Servicio Técnico',
                        fechaProgramada: fechaOriginalFormateada,
                        motivo: 'Servicio reasignado a otro técnico',
                    },
                    programado_para: new Date().toISOString(), // Enviar inmediatamente
                });

            console.log(`[work-orders/reposition] ✉️ Email de cancelación enviado a técnico anterior: ${tecnicoAnterior.email}`);
        }
    }

    // ─────────────────────────────────────────────────
    // PASO 2: Calcular tiempo de viaje con origen encadenado
    // ─────────────────────────────────────────────────
    const tecnicoCoords: Coordinates | null = (nuevoTecnico.lat && nuevoTecnico.lng)
        ? { lat: nuevoTecnico.lat, lng: nuevoTecnico.lng }
        : null;

    const clienteCoords: Coordinates | null = (cliente?.lat && cliente?.lng)
        ? { lat: cliente.lat, lng: cliente.lng }
        : null;

    // Encontrar el punto de origen correcto
    const { origin: origenCoords } = await findOriginForNewWO(
        nuevo_tecnico_id,
        tecnicoCoords,
        fecha_hora_inicio,
        wo_id
    );

    let tiempoViajeEstimado = DEFAULT_TRAVEL_TIME_MIN;
    if (origenCoords && clienteCoords && GOOGLE_MAPS_API_KEY) {
        try {
            const departureTime = new Date(fecha_hora_inicio);
            const travelResult = await calculateDistanceMatrix(origenCoords, clienteCoords, departureTime);
            if (travelResult) {
                tiempoViajeEstimado = travelResult.duration_min;
                console.log(`[work-orders/reposition] ✅ Tiempo viaje calculado: ${tiempoViajeEstimado} min`);
            }
        } catch (err) {
            console.warn('[work-orders/reposition] ⚠️ Error calculando viaje:', err);
        }
    }

    // ─────────────────────────────────────────────────
    // PASO 2.1: Actualizar WO con nuevo técnico, hora y tiempos
    // ─────────────────────────────────────────────────
    const updateData = {
        tecnico_asignado_id: nuevo_tecnico_id,
        fecha_programada: fecha_hora_inicio,
        tiempo_viaje_ida_estimado: tiempoViajeEstimado,
        tiempo_viaje_vuelta_estimado: Math.round(tiempoViajeEstimado * 0.9),
        estado: 'Asignada' as Estado,
        updated_at: new Date().toISOString(),
    };

    const { data: updatedWO, error: updateError } = await supabaseAdmin
        .from('ordenes_trabajo')
        .update(updateData)
        .eq('id', wo_id)
        .select()
        .single();

    if (updateError) {
        console.error('[work-orders/reposition] Error actualizando WO:', updateError);
        return jsonResponse({ error: 'Error al reposicionar la orden de trabajo' }, 500);
    }

    // ─────────────────────────────────────────────────
    // PASO 2.2: Recalcular WOs posteriores en cascada
    // ─────────────────────────────────────────────────
    const fechaDia = fecha_hora_inicio.split('T')[0];
    await recalculateSubsequentWOs(nuevo_tecnico_id, tecnicoCoords, fechaDia, fecha_hora_inicio);

    // ─────────────────────────────────────────────────
    // PASO 3: Encolar notificación al nuevo técnico (con delay si es cambio de técnico)
    // ─────────────────────────────────────────────────
    const fechaNuevaFormateada = new Date(fecha_hora_inicio).toLocaleString('es-AR', {
        weekday: 'long', day: 'numeric', month: 'long',
        year: 'numeric', hour: '2-digit', minute: '2-digit',
    });

    const DELAY_MS = cambioTecnico ? 0 : 2 * 60 * 1000; // Sin delay si es cambio de técnico
    const enviarEn = new Date(Date.now() + DELAY_MS).toISOString();

    const emailData = {
        tecnicoNombre: nuevoTecnico.full_name,
        numeroWO: wo.numero_wo,
        clienteNombre: cliente?.razon_social || 'Cliente',
        clienteDireccion: cliente?.direccion || '',
        tipoServicio: wo.titulo || 'Servicio Técnico',
        fechaProgramada: fechaNuevaFormateada,
        tiempoEstimado: wo.tiempo_servicio_estimado || 60,
        prioridad: 'Media',
    };

    // Email al nuevo técnico
    if (nuevoTecnico.email) {
        await supabaseAdmin
            .from('email_queue')
            .insert({
                wo_id: wo_id,
                tipo: 'wo-tecnico',
                destinatario: nuevoTecnico.email,
                destinatario_nombre: nuevoTecnico.full_name,
                data: emailData,
                programado_para: enviarEn,
            });

        console.log(`[work-orders/reposition] ✉️ Email encolado para nuevo técnico: ${nuevoTecnico.email}`);
    }

    // Email al cliente (si cambió de técnico, notificar inmediatamente)
    if (cambioTecnico && cliente?.email) {
        await supabaseAdmin
            .from('email_queue')
            .insert({
                wo_id: wo_id,
                tipo: 'wo-cliente',
                destinatario: cliente.email,
                destinatario_nombre: cliente.razon_social,
                data: {
                    ...emailData,
                    clienteNombre: cliente.razon_social,
                },
                programado_para: new Date().toISOString(),
            });

        console.log(`[work-orders/reposition] ✉️ Email encolado para cliente: ${cliente.email}`);
    }

    console.log(`[work-orders/reposition] ✅ WO ${wo.numero_wo} reposicionada → ${nuevoTecnico.full_name}`);

    return jsonResponse({
        success: true,
        numero_wo: wo.numero_wo,
        cambio_tecnico: cambioTecnico,
        tecnico_anterior: tecnicoAnterior?.full_name,
        tecnico_nuevo: nuevoTecnico.full_name,
        wo: updatedWO,
    });
}

// =====================================================
// HELPERS: CÁLCULO DE TIEMPOS ENCADENADOS
// =====================================================

interface ScheduledWO {
    id: string;
    fecha_programada: string;
    tiempo_servicio_estimado: number | null;
    tiempo_viaje_ida_estimado: number | null;
    clients: { lat: number | null; lng: number | null } | null;
}

/**
 * Encuentra las coordenadas del punto de origen para una nueva WO.
 * - Si hay WOs anteriores del mismo técnico/día, usa la ubicación del último cliente
 * - Si no hay, usa las coordenadas base del técnico
 */
async function findOriginForNewWO(
    tecnicoId: string,
    tecnicoCoords: Coordinates | null,
    fechaHoraInicio: string,
    excludeWoId?: string
): Promise<{ origin: Coordinates | null; previousWO: ScheduledWO | null }> {
    const fechaAsignacion = fechaHoraInicio.split('T')[0];
    const horaInicioNueva = new Date(fechaHoraInicio).getTime();

    // Buscar otras WOs del mismo técnico para el mismo día
    const { data: otrasWOs, error } = await supabaseAdmin
        .from('ordenes_trabajo')
        .select(`
            id,
            fecha_programada,
            tiempo_servicio_estimado,
            tiempo_viaje_ida_estimado,
            clients!inner (lat, lng)
        `)
        .eq('tecnico_asignado_id', tecnicoId)
        .gte('fecha_programada', `${fechaAsignacion}T00:00:00`)
        .lt('fecha_programada', `${fechaAsignacion}T23:59:59`)
        .neq('id', excludeWoId || 'no-exclude')
        .in('estado', ['Asignada', 'Confirmada_Cliente', 'En_Progreso'])
        .order('fecha_programada', { ascending: true });

    if (error || !otrasWOs || otrasWOs.length === 0) {
        // No hay otras WOs, usar base del técnico
        console.log('[work-orders] Sin WOs previas, usando base del técnico');
        return { origin: tecnicoCoords, previousWO: null };
    }

    // Encontrar la WO que termina justo antes de nuestra hora de inicio
    let previousWO: ScheduledWO | null = null;
    for (const otraWO of otrasWOs) {
        const horaInicioOtra = new Date(otraWO.fecha_programada).getTime();
        const duracionOtraMs = (
            (otraWO.tiempo_viaje_ida_estimado || DEFAULT_TRAVEL_TIME_MIN) +
            (otraWO.tiempo_servicio_estimado || 60)
        ) * 60 * 1000;
        const horaFinOtra = horaInicioOtra + duracionOtraMs;

        // Si esta WO termina antes de nuestra hora, es candidata
        if (horaFinOtra <= horaInicioNueva) {
            previousWO = otraWO as ScheduledWO;
        }
    }

    if (previousWO) {
        const clienteAnterior = previousWO.clients as { lat: number | null; lng: number | null } | null;
        if (clienteAnterior?.lat && clienteAnterior?.lng) {
            console.log(`[work-orders] Origen desde cliente anterior (WO ${previousWO.id})`);
            return {
                origin: { lat: clienteAnterior.lat, lng: clienteAnterior.lng },
                previousWO
            };
        }
    }

    // No encontró WO anterior válida, usar base
    console.log('[work-orders] Sin WO anterior válida, usando base del técnico');
    return { origin: tecnicoCoords, previousWO: null };
}

/**
 * Recalcula los tiempos de viaje de todas las WOs posteriores a una hora dada
 * para un técnico específico en un día.
 */
async function recalculateSubsequentWOs(
    tecnicoId: string,
    tecnicoCoords: Coordinates | null,
    fechaDia: string,
    despuesDeHora: string
): Promise<{ recalculated: number; errors: number }> {
    console.log(`[work-orders] Recalculando WOs posteriores a ${despuesDeHora}...`);

    // Obtener todas las WOs del día para este técnico, ordenadas por hora
    const { data: wosDelDia, error } = await supabaseAdmin
        .from('ordenes_trabajo')
        .select(`
            id,
            numero_wo,
            fecha_programada,
            tiempo_servicio_estimado,
            tiempo_viaje_ida_estimado,
            clients!inner (id, lat, lng)
        `)
        .eq('tecnico_asignado_id', tecnicoId)
        .gte('fecha_programada', `${fechaDia}T00:00:00`)
        .lt('fecha_programada', `${fechaDia}T23:59:59`)
        .in('estado', ['Asignada', 'Confirmada_Cliente', 'En_Progreso'])
        .order('fecha_programada', { ascending: true });

    if (error || !wosDelDia || wosDelDia.length === 0) {
        console.log('[work-orders] No hay WOs para recalcular');
        return { recalculated: 0, errors: 0 };
    }

    const horaLimite = new Date(despuesDeHora).getTime();
    let recalculated = 0;
    let errors = 0;

    // Construir lista ordenada y recalcular cada una
    let ultimaUbicacion = tecnicoCoords;

    for (const wo of wosDelDia) {
        const horaWO = new Date(wo.fecha_programada).getTime();
        const clienteWO = wo.clients as { id: string; lat: number | null; lng: number | null } | null;

        // Actualizar la última ubicación para WOs que terminaron ANTES de la hora límite
        if (horaWO < horaLimite) {
            if (clienteWO?.lat && clienteWO?.lng) {
                ultimaUbicacion = { lat: clienteWO.lat, lng: clienteWO.lng };
            }
            continue; // No recalcular, solo actualizar ubicación
        }

        // Esta WO está DESPUÉS de la hora límite, recalcular
        const clienteCoords: Coordinates | null = (clienteWO?.lat && clienteWO?.lng)
            ? { lat: clienteWO.lat, lng: clienteWO.lng }
            : null;

        if (!ultimaUbicacion || !clienteCoords) {
            console.log(`[work-orders] WO ${wo.numero_wo}: sin coordenadas, skip`);
            // Actualizar ubicación para la siguiente
            if (clienteCoords) ultimaUbicacion = clienteCoords;
            continue;
        }

        try {
            const departureTime = new Date(wo.fecha_programada);
            const travelResult = await calculateDistanceMatrix(ultimaUbicacion, clienteCoords, departureTime);

            if (travelResult) {
                await supabaseAdmin
                    .from('ordenes_trabajo')
                    .update({
                        tiempo_viaje_ida_estimado: travelResult.duration_min,
                        tiempo_viaje_vuelta_estimado: Math.round(travelResult.duration_min * 0.9),
                    })
                    .eq('id', wo.id);

                console.log(`[work-orders] ✅ WO ${wo.numero_wo} recalculada: ${travelResult.duration_min} min`);
                recalculated++;
            } else {
                console.warn(`[work-orders] ⚠️ WO ${wo.numero_wo}: no se pudo calcular`);
                errors++;
            }
        } catch (e) {
            console.error(`[work-orders] ❌ Error recalculando WO ${wo.numero_wo}:`, e);
            errors++;
        }

        // Actualizar ubicación para la siguiente WO
        ultimaUbicacion = clienteCoords;
    }

    console.log(`[work-orders] Recálculo completado: ${recalculated} actualizadas, ${errors} errores`);
    return { recalculated, errors };
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

// =====================================================
// ENVÍO DE NOTIFICACIONES POR EMAIL
// =====================================================

interface NotificationData {
    tecnicoEmail: string | null;
    tecnicoNombre: string;
    clienteEmail: string | null;
    clienteNombre: string;
    clienteTelefono: string | null;
    numeroWO: string;
    fechaProgramada: string;
    tipoServicio: string;
    descripcion: string;
    notasInternas: string;
    tiempoEstimado: number;
    clienteDireccion: string;
    clienteLat: number | null;
    clienteLng: number | null;
    prioridad: string;
}

async function sendAssignmentNotifications(data: NotificationData): Promise<void> {
    console.log('[work-orders/notify] Iniciando envío de notificaciones...');

    const sendEmailEndpoint = `${SUPABASE_URL}/functions/v1/send-email`;

    // Email al técnico (si tiene email)
    if (data.tecnicoEmail) {
        try {
            console.log(`[work-orders/notify] Enviando email al técnico: ${data.tecnicoEmail}`);
            const response = await fetch(sendEmailEndpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    type: 'wo-tecnico',
                    to: data.tecnicoEmail,
                    data: {
                        tecnicoNombre: data.tecnicoNombre,
                        numeroWO: data.numeroWO,
                        clienteNombre: data.clienteNombre,
                        clienteTelefono: data.clienteTelefono,
                        clienteDireccion: data.clienteDireccion,
                        clienteLat: data.clienteLat,
                        clienteLng: data.clienteLng,
                        tipoServicio: data.tipoServicio,
                        fechaProgramada: data.fechaProgramada,
                        tiempoEstimado: data.tiempoEstimado,
                        descripcion: data.descripcion,
                        notasInternas: data.notasInternas,
                        prioridad: data.prioridad,
                    },
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                console.error('[work-orders/notify] Error enviando email al técnico:', error);
            } else {
                console.log('[work-orders/notify] ✅ Email al técnico enviado correctamente');
            }
        } catch (error) {
            console.error('[work-orders/notify] Error fetch email técnico:', error);
        }
    } else {
        console.log('[work-orders/notify] Técnico sin email configurado, no se envía notificación');
    }

    // Email al cliente (si tiene email)
    if (data.clienteEmail) {
        try {
            console.log(`[work-orders/notify] Enviando email al cliente: ${data.clienteEmail}`);
            const response = await fetch(sendEmailEndpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    type: 'wo-cliente',
                    to: data.clienteEmail,
                    data: {
                        clienteNombre: data.clienteNombre,
                        numeroWO: data.numeroWO,
                        tecnicoNombre: data.tecnicoNombre,
                        fechaProgramada: data.fechaProgramada,
                        tipoServicio: data.tipoServicio,
                        descripcion: data.descripcion,
                    },
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                console.error('[work-orders/notify] Error enviando email al cliente:', error);
            } else {
                console.log('[work-orders/notify] ✅ Email al cliente enviado correctamente');
            }
        } catch (error) {
            console.error('[work-orders/notify] Error fetch email cliente:', error);
        }
    } else {
        console.log('[work-orders/notify] Cliente sin email configurado, no se envía notificación');
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
