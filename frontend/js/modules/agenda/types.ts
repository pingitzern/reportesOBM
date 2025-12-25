/**
 * Tipos para el Scheduler Board
 */

export interface Coordinates {
    lat: number;
    lng: number;
}

export type Prioridad = 'Baja' | 'Media' | 'Alta' | 'EMERGENCIA_COMODIN';
export type Estado = 'Bolsa_Trabajo' | 'Asignada' | 'Confirmada_Cliente' | 'En_Progreso' | 'Completada' | 'Cancelada';

export interface WorkOrder {
    id: string;
    numero_wo: string;
    titulo: string;
    descripcion?: string;
    cliente_id: string;
    cliente_nombre: string;
    cliente_direccion?: string;
    equipo_id?: string;
    equipo_nombre?: string;
    prioridad: Prioridad;
    estado: Estado;
    tiempo_servicio_estimado: number; // minutos
    tiempo_viaje_ida_estimado?: number; // minutos
    tiempo_viaje_vuelta_estimado?: number; // minutos
    fecha_programada?: string;
    hora_inicio?: string; // HH:mm
    tecnico_asignado_id?: string;
    tecnico_nombre?: string;
    // Campos de confirmación
    confirmacion_tecnico?: 'pendiente' | 'confirmada' | 'rechazada';
    confirmacion_cliente?: 'pendiente' | 'confirmada' | 'rechazada';
    // Creador
    creador_nombre?: string;
}

export interface Habilidad {
    habilidad_id: string;
    nombre: string;
    categoria: string;
    nivel: number;
}

export interface Tecnico {
    id: string;
    nombre: string;
    email: string;
    avatar_url?: string;
    habilidades: Habilidad[];
    lat?: number;
    lng?: number;
    score_ponderado: number;
}

export interface ScheduledTask {
    wo: WorkOrder;
    tecnico_id: string;
    hora_inicio: string; // HH:mm format
    // Tiempos calculados
    viaje_ida_min: number;
    servicio_min: number;
    viaje_vuelta_min: number;
}

export interface TimeSlot {
    hora: string; // HH:mm
    minutos: number; // Minutos desde inicio del día (ej: 480 para 08:00)
}

// Configuración del scheduler
export const SCHEDULER_CONFIG = {
    HORA_INICIO: 8, // 08:00
    HORA_FIN: 18, // 18:00
    INTERVALO_MIN: 30, // 30 minutos por slot
    PIXEL_POR_MINUTO: 2, // Ancho en pixels por minuto
};

// Colores por prioridad
export const PRIORIDAD_COLORS: Record<Prioridad, { bg: string; border: string; text: string }> = {
    'Baja': { bg: 'bg-slate-100', border: 'border-slate-300', text: 'text-slate-700' },
    'Media': { bg: 'bg-blue-100', border: 'border-blue-400', text: 'text-blue-800' },
    'Alta': { bg: 'bg-amber-100', border: 'border-amber-500', text: 'text-amber-800' },
    'EMERGENCIA_COMODIN': { bg: 'bg-red-100', border: 'border-red-500', text: 'text-red-800' },
};

// Badge colors por prioridad
export const PRIORIDAD_BADGES: Record<Prioridad, string> = {
    'Baja': 'bg-slate-200 text-slate-700',
    'Media': 'bg-blue-200 text-blue-800',
    'Alta': 'bg-amber-200 text-amber-800',
    'EMERGENCIA_COMODIN': 'bg-red-500 text-white',
};

// Colores y iconos de confirmación
export const CONFIRMACION_CONFIG: Record<string, { icon: string; bg: string; text: string; label: string }> = {
    'pendiente': { icon: '⏳', bg: 'bg-amber-100', text: 'text-amber-700', label: 'Pendiente' },
    'confirmada': { icon: '✅', bg: 'bg-green-100', text: 'text-green-700', label: 'Confirmado' },
    'rechazada': { icon: '❌', bg: 'bg-red-100', text: 'text-red-700', label: 'Rechazado' },
};

// Tipos para vistas de agenda
export type ViewMode = 'day' | 'week' | 'month';

// Datos de un día para vista semana/mes
export interface DaySummary {
    date: Date;
    dateKey: string; // 'YYYY-MM-DD'
    workOrderCount: number;
    totalServiceHours: number;
    isToday: boolean;
    isCurrentMonth: boolean;
}

// Datos de técnico para vista semana
export interface TechnicianWeekSummary {
    tecnico: Tecnico;
    days: DaySummary[];
}

// Helpers para calcular carga
export const CARGA_THRESHOLDS = {
    BAJA: 4,    // 0-4 horas
    MEDIA: 6,   // 4-6 horas
    ALTA: 8,    // 6+ horas
};

export function getCargaColor(hours: number): { bg: string; text: string; indicator: string } {
    if (hours === 0) {
        return { bg: 'bg-slate-50', text: 'text-slate-400', indicator: '—' };
    } else if (hours <= CARGA_THRESHOLDS.BAJA) {
        return { bg: 'bg-emerald-50', text: 'text-emerald-700', indicator: '🟢' };
    } else if (hours <= CARGA_THRESHOLDS.MEDIA) {
        return { bg: 'bg-amber-50', text: 'text-amber-700', indicator: '🟡' };
    } else {
        return { bg: 'bg-red-50', text: 'text-red-700', indicator: '🔴' };
    }
}
