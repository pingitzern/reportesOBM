/**
 * Tipos y esquema de validación para el formulario de Work Order
 */

import { z } from 'zod';

// Esquema de validación Zod
export const createWOSchema = z.object({
    // Cliente
    cliente_id: z.string().uuid('Selecciona un cliente'),
    cliente_nombre: z.string().min(1, 'Nombre de cliente requerido'),

    // Dirección (para nuevos clientes o direcciones alternativas)
    direccion: z.string().optional(),
    lat: z.number().optional(),
    lng: z.number().optional(),

    // Servicio
    sistema_id: z.string().optional().nullable().or(z.literal('')),
    catalogo_servicio_id: z.string().optional().nullable().or(z.literal('')),
    tipo_tarea: z.enum(['MP', 'CAL', 'VAL', 'INSTA', 'REP']).optional(),

    // Detalles
    titulo: z.string().min(5, 'El título debe tener al menos 5 caracteres'),
    descripcion: z.string().optional(),
    tiempo_servicio_estimado: z.number().min(15, 'Mínimo 15 minutos').max(480, 'Máximo 8 horas'),

    // Prioridad
    prioridad: z.enum(['Baja', 'Media', 'Alta', 'EMERGENCIA_COMODIN']),

    // Notas
    notas_internas: z.string().optional(),
});

export type CreateWOFormData = z.infer<typeof createWOSchema>;

// Tipos para el catálogo de servicios
export interface Sistema {
    id: string;
    nombre: string;
    descripcion?: string;
}

export interface CatalogoServicio {
    id: string;
    sistema_id: string | null;
    tipo_tarea: 'MP' | 'CAL' | 'VAL' | 'INSTA' | 'REP';
    duracion_estimada_min: number;
    descripcion: string;
    requiere_habilidades: string[];
}

export interface Client {
    id: string;
    razon_social: string;
    direccion: string;
    lat: number | null;
    lng: number | null;
    telefono?: string;
    email?: string;
}

// Labels para tipos de tarea
export const TIPO_TAREA_LABELS: Record<string, string> = {
    'MP': 'Mantenimiento Preventivo',
    'CAL': 'Calibración',
    'VAL': 'Validación',
    'INSTA': 'Instalación',
    'REP': 'Reparación',
};

// Colors para prioridades
export const PRIORIDAD_CONFIG = {
    'Baja': { color: 'bg-blue-100 text-blue-800 border-blue-200', icon: '🔵' },
    'Media': { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: '🟡' },
    'Alta': { color: 'bg-orange-100 text-orange-800 border-orange-200', icon: '🟠' },
    'EMERGENCIA_COMODIN': { color: 'bg-red-100 text-red-800 border-red-200', icon: '🔴' },
};
