/**
 * API Client para el módulo de Agenda/Scheduler v2
 * Conecta con Supabase y las Edge Functions
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { WorkOrder, Tecnico, ScheduledTask, Prioridad, Estado, Habilidad } from './types';

// Supabase client
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabaseClient: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
    if (!supabaseClient) {
        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
            throw new Error('Supabase credentials not configured');
        }
        supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return supabaseClient;
}

// =====================================================
// WORK ORDERS
// =====================================================

/**
 * Obtener WOs en estado Bolsa_Trabajo (backlog)
 */
export async function fetchBacklogWorkOrders(): Promise<WorkOrder[]> {
    const supabase = getSupabase();

    const { data, error } = await supabase
        .from('ordenes_trabajo_detalle')
        .select('*')
        .eq('estado', 'Bolsa_Trabajo')
        .order('prioridad', { ascending: true })
        .order('created_at', { ascending: true });

    if (error) {
        console.error('[API] Error fetching backlog:', error);
        throw error;
    }

    return (data || []).map(mapDbWorkOrderToWO);
}

/**
 * Obtener WOs programadas para una fecha
 */
export async function fetchScheduledWorkOrders(date: Date): Promise<ScheduledTask[]> {
    const supabase = getSupabase();

    const dateStr = date.toISOString().split('T')[0];

    const { data, error } = await supabase
        .from('ordenes_trabajo_detalle')
        .select('*')
        .eq('estado', 'Asignada')
        .gte('fecha_programada', `${dateStr}T00:00:00`)
        .lt('fecha_programada', `${dateStr}T23:59:59`);

    if (error) {
        console.error('[API] Error fetching scheduled:', error);
        throw error;
    }

    return (data || []).map(mapDbWorkOrderToScheduledTask);
}

/**
 * Obtener WOs programadas para un rango de fechas (para vista semanal/mensual)
 */
export async function fetchWorkOrdersForDateRange(
    startDate: Date,
    endDate: Date
): Promise<WorkOrder[]> {
    const supabase = getSupabase();

    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    console.log(`[API] Fetching WOs for range: ${startStr} to ${endStr}`);

    const { data, error } = await supabase
        .from('ordenes_trabajo_detalle')
        .select('*')
        .in('estado', ['Asignada', 'Confirmada_Cliente', 'En_Progreso'])
        .gte('fecha_programada', `${startStr}T00:00:00`)
        .lte('fecha_programada', `${endStr}T23:59:59`);

    if (error) {
        console.error('[API] Error fetching WOs for range:', error);
        throw error;
    }

    console.log(`[API] Found ${data?.length || 0} WOs for date range`);
    return (data || []).map(mapDbWorkOrderToWO);
}

/**
 * Respuesta de la API de asignación
 */
export interface AssignWorkOrderResult {
    success: boolean;
    error?: string;
    warning?: string;
    wo?: {
        id: string;
        numero_wo: string;
        titulo: string;
        prioridad: Prioridad;
        estado: Estado;
        fecha_programada: string;
        tiempo_servicio_estimado: number;
        tiempo_viaje_ida_estimado: number;
        tiempo_viaje_vuelta_estimado: number;
        tecnico_nombre: string;
        cliente_nombre: string;
        cliente_direccion?: string;
        distancia_km?: number;
    };
}

/**
 * Asignar una WO a un técnico - v2 con cálculo real de viaje
 */
export async function assignWorkOrder(
    woId: string,
    tecnicoId: string,
    horaInicio: string,
    fecha: Date
): Promise<AssignWorkOrderResult> {
    const supabase = getSupabase();

    // Combinar fecha + hora en ISO string
    const dateStr = fecha.toISOString().split('T')[0];
    const fechaHoraInicio = `${dateStr}T${horaInicio}:00`;

    console.log('[API] Llamando work-orders/assign:', { woId, tecnicoId, fechaHoraInicio });

    try {
        const { data, error } = await supabase.functions.invoke('work-orders', {
            body: {
                action: 'assign',
                wo_id: woId,
                tecnico_id: tecnicoId,
                fecha_hora_inicio: fechaHoraInicio,
            },
        });

        if (error) {
            console.error('[API] Error en Edge Function:', error);
            return {
                success: false,
                error: error.message || 'Error en Edge Function'
            };
        }

        if (!data.success) {
            console.error('[API] Error en respuesta:', data.error);
            return {
                success: false,
                error: data.error || 'Error desconocido'
            };
        }

        console.log('[API] ✅ Asignación exitosa:', data);

        return {
            success: true,
            warning: data.warning,
            wo: data.wo,
        };

    } catch (err) {
        console.error('[API] Error de red:', err);
        return {
            success: false,
            error: err instanceof Error ? err.message : 'Error de red'
        };
    }
}

/**
 * Reposicionar una WO ya asignada (cambiar técnico y/o hora)
 * Envía notificaciones al técnico anterior si corresponde
 */
export async function repositionWorkOrder(
    woId: string,
    nuevoTecnicoId: string,
    horaInicio: string,
    fecha: Date,
    tecnicoAnteriorId?: string
): Promise<AssignWorkOrderResult> {
    const supabase = getSupabase();

    // Combinar fecha + hora en ISO string
    const dateStr = fecha.toISOString().split('T')[0];
    const fechaHoraInicio = `${dateStr}T${horaInicio}:00`;

    console.log('[API] Llamando work-orders/reposition:', { woId, nuevoTecnicoId, tecnicoAnteriorId, fechaHoraInicio });

    try {
        const { data, error } = await supabase.functions.invoke('work-orders', {
            body: {
                action: 'reposition',
                wo_id: woId,
                nuevo_tecnico_id: nuevoTecnicoId,
                fecha_hora_inicio: fechaHoraInicio,
                tecnico_anterior_id: tecnicoAnteriorId,
            },
        });

        if (error) {
            console.error('[API] Error en Edge Function:', error);
            return {
                success: false,
                error: error.message || 'Error en Edge Function'
            };
        }

        if (!data.success) {
            console.error('[API] Error en respuesta:', data.error);
            return {
                success: false,
                error: data.error || 'Error desconocido'
            };
        }

        console.log('[API] ✅ Reposición exitosa:', data);

        return {
            success: true,
            warning: data.warning,
            wo: data.wo,
        };

    } catch (err) {
        console.error('[API] Error de red:', err);
        return {
            success: false,
            error: err instanceof Error ? err.message : 'Error de red'
        };
    }
}

/**
 * Desasignar una WO (volver a Bolsa_Trabajo)
 * Usa la acción 'unassign' que maneja la cancelación de emails pendientes
 */
export async function unassignWorkOrder(woId: string, motivo?: string): Promise<{ success: boolean; error?: string }> {
    const supabase = getSupabase();

    try {
        const { data, error } = await supabase.functions.invoke('work-orders', {
            body: {
                action: 'unassign',
                wo_id: woId,
                motivo: motivo || 'Reprogramación por parte de coordinación',
            },
        });

        if (error) throw error;

        if (!data.success) {
            return { success: false, error: data.error };
        }

        console.log(`[API] WO desasignada. Emails cancelados: ${data.emails_cancelados}, Cancelación enviada: ${data.email_cancelacion_enviado}`);
        return { success: true };

    } catch (err) {
        console.error('[API] Error unassigning WO:', err);
        return { success: false, error: err instanceof Error ? err.message : 'Error desconocido' };
    }
}

// =====================================================
// TÉCNICOS
// =====================================================

/**
 * Obtener técnicos activos con sus habilidades
 */
export async function fetchTechnicians(): Promise<Tecnico[]> {
    const supabase = getSupabase();

    const { data, error } = await supabase
        .from('tecnicos_con_habilidades')
        .select('*')
        .order('nombre');

    if (error) {
        console.error('[API] Error fetching technicians:', error);
        throw error;
    }

    return (data || []).map(mapDbTecnicoToTecnico);
}

// =====================================================
// GEO SERVICES
// =====================================================

/**
 * Calcular tiempo de viaje entre dos puntos
 */
export async function calculateTravelTime(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number }
): Promise<{ duration_min: number; distance_km: number } | null> {
    const supabase = getSupabase();

    try {
        const { data, error } = await supabase.functions.invoke('geo-services', {
            body: {
                action: 'distance-matrix',
                origin,
                destination,
            },
        });

        if (error) throw error;

        return {
            duration_min: data?.duration_traffic_min || data?.duration_min || 30,
            distance_km: data?.distance_km || 0,
        };
    } catch (err) {
        console.error('[API] Error calculating travel time:', err);
        return null;
    }
}

// =====================================================
// MAPPERS
// =====================================================

function mapDbWorkOrderToWO(row: any): WorkOrder {
    return {
        id: row.id,
        numero_wo: row.numero_wo,
        titulo: row.titulo,
        descripcion: row.descripcion,
        cliente_id: row.cliente_id,
        cliente_nombre: row.cliente_razon_social || row.cliente_nombre || 'Cliente',
        cliente_direccion: row.cliente_direccion,
        equipo_id: row.equipo_id,
        equipo_nombre: row.equipo_modelo,
        prioridad: row.prioridad as Prioridad,
        estado: row.estado as Estado,
        tiempo_servicio_estimado: row.tiempo_servicio_estimado || row.duracion_estimada || 60,
        tiempo_viaje_ida_estimado: row.tiempo_viaje_ida_estimado,
        tiempo_viaje_vuelta_estimado: row.tiempo_viaje_vuelta_estimado,
        fecha_programada: row.fecha_programada,
        hora_inicio: extractHoraFromFechaProgramada(row.fecha_programada),
        tecnico_asignado_id: row.tecnico_asignado_id || row.tecnico_id, // La vista usa tecnico_id
        tecnico_nombre: row.tecnico_nombre,
        // Campos de confirmación
        confirmacion_tecnico: row.confirmacion_tecnico,
        confirmacion_cliente: row.confirmacion_cliente,
        // Creador
        creador_nombre: row.creador_nombre,
    };
}

/**
 * Extrae la hora (HH:mm) de un timestamp fecha_programada
 * Maneja correctamente la zona horaria Argentina
 */
function extractHoraFromFechaProgramada(fechaProgramada: string | null): string | undefined {
    if (!fechaProgramada) return undefined;

    try {
        // Si viene como ISO string, extraer la hora directamente del string
        // Formato: "2025-12-16T09:00:00" o "2025-12-16T09:00:00.000Z" o "2025-12-16T09:00:00-03:00"
        const match = fechaProgramada.match(/T(\d{2}):(\d{2})/);
        if (match) {
            const hora = `${match[1]}:${match[2]}`;
            console.log('[API] extractHoraFromFechaProgramada:', { fechaProgramada, horaExtraida: hora });
            return hora;
        }

        // Fallback: usar Date parsing
        const date = new Date(fechaProgramada);
        if (!isNaN(date.getTime())) {
            const hora = date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
            console.log('[API] extractHoraFromFechaProgramada (fallback Date):', { fechaProgramada, horaExtraida: hora });
            return hora;
        }

        console.warn('[API] extractHoraFromFechaProgramada: No se pudo extraer hora de:', fechaProgramada);
        return undefined;
    } catch (error) {
        console.error('[API] extractHoraFromFechaProgramada error:', error);
        return undefined;
    }
}

function mapDbWorkOrderToScheduledTask(row: any): ScheduledTask {
    const wo = mapDbWorkOrderToWO(row);

    return {
        wo,
        tecnico_id: row.tecnico_asignado_id || row.tecnico_id, // La vista usa tecnico_id
        hora_inicio: wo.hora_inicio || '09:00',
        viaje_ida_min: row.tiempo_viaje_ida_estimado || 30,
        servicio_min: wo.tiempo_servicio_estimado,
        viaje_vuelta_min: row.tiempo_viaje_vuelta_estimado || 25,
    };
}

function mapDbTecnicoToTecnico(row: any): Tecnico {
    let habilidades: Habilidad[] = [];

    try {
        if (typeof row.habilidades === 'string') {
            habilidades = JSON.parse(row.habilidades);
        } else if (Array.isArray(row.habilidades)) {
            habilidades = row.habilidades;
        }
    } catch (e) {
        console.warn('[API] Error parsing habilidades:', e);
    }

    return {
        id: row.tecnico_id,
        nombre: row.nombre,
        email: row.email || '',
        habilidades,
        lat: row.lat,
        lng: row.lng,
        score_ponderado: row.score_ponderado || 0,
    };
}

// =====================================================
// EMAIL QUEUE PROCESSING
// =====================================================

/**
 * Procesa la cola de emails pendientes.
 * Se llama al cargar la Agenda como workaround para la falta de pg_cron.
 * No bloquea y no muestra errores al usuario.
 */
async function processEmailQueue(): Promise<void> {
    try {
        const supabase = getSupabase();
        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token;

        if (!token) {
            console.log('[API/processEmailQueue] No hay sesión activa, saltando');
            return;
        }

        const response = await fetch(
            `${SUPABASE_URL}/functions/v1/process-email-queue`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({}),
            }
        );

        if (response.ok) {
            const result = await response.json();
            if (result.processed > 0) {
                console.log(`[API/processEmailQueue] ✉️ ${result.processed} email(s) procesados`);
            }
        }
    } catch (error) {
        // Silenciar errores - esto es background processing
        console.log('[API/processEmailQueue] Error (silenciado):', error);
    }
}

// =====================================================
// EXPORT
// =====================================================

const api = {
    fetchBacklogWorkOrders,
    fetchScheduledWorkOrders,
    fetchWorkOrdersForDateRange,
    assignWorkOrder,
    unassignWorkOrder,
    fetchTechnicians,
    calculateTravelTime,
    processEmailQueue,
};

export default api;
