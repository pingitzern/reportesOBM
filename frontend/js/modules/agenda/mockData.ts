/**
 * Datos mock para desarrollo del Scheduler
 */

import { WorkOrder, Tecnico, ScheduledTask } from './types';

// Mock Técnicos
export const mockTecnicos: Tecnico[] = [
    {
        id: 'tech-1',
        nombre: 'Juan Pérez',
        email: 'juan.perez@ohm.com',
        habilidades: [
            { habilidad_id: 'h1', nombre: 'Osmosis', categoria: 'equipos', nivel: 5 },
            { habilidad_id: 'h2', nombre: 'Ablandador', categoria: 'equipos', nivel: 4 },
        ],
        lat: -34.6037,
        lng: -58.3816,
        score_ponderado: 4.8,
    },
    {
        id: 'tech-2',
        nombre: 'María García',
        email: 'maria.garcia@ohm.com',
        habilidades: [
            { habilidad_id: 'h1', nombre: 'Osmosis', categoria: 'equipos', nivel: 4 },
            { habilidad_id: 'h3', nombre: 'HPLC', categoria: 'equipos', nivel: 5 },
        ],
        lat: -34.5875,
        lng: -58.4110,
        score_ponderado: 4.5,
    },
    {
        id: 'tech-3',
        nombre: 'Carlos López',
        email: 'carlos.lopez@ohm.com',
        habilidades: [
            { habilidad_id: 'h2', nombre: 'Ablandador', categoria: 'equipos', nivel: 5 },
            { habilidad_id: 'h4', nombre: 'Tableros', categoria: 'electrica', nivel: 3 },
        ],
        lat: -34.6158,
        lng: -58.4333,
        score_ponderado: 4.2,
    },
    {
        id: 'tech-4',
        nombre: 'Ana Martínez',
        email: 'ana.martinez@ohm.com',
        habilidades: [
            { habilidad_id: 'h1', nombre: 'Osmosis', categoria: 'equipos', nivel: 3 },
        ],
        lat: -34.5980,
        lng: -58.3700,
        score_ponderado: 4.0,
    },
];

// Mock Work Orders (Backlog)
export const mockBacklogWOs: WorkOrder[] = [
    {
        id: 'wo-1',
        numero_wo: 'WO-2025-0001',
        titulo: 'MP Osmosis Mensual',
        descripcion: 'Mantenimiento preventivo mensual del equipo de osmosis',
        cliente_id: 'cli-1',
        cliente_nombre: 'Laboratorio Farmacéutico SA',
        cliente_direccion: 'Av. Corrientes 1234, CABA',
        equipo_nombre: 'Osmosis 300 L/h',
        prioridad: 'Alta',
        estado: 'Bolsa_Trabajo',
        tiempo_servicio_estimado: 120, // 2 horas
    },
    {
        id: 'wo-2',
        numero_wo: 'WO-2025-0002',
        titulo: 'Calibración Ablandador',
        descripcion: 'Calibración y ajuste del cabezal',
        cliente_id: 'cli-2',
        cliente_nombre: 'Hospital Central',
        cliente_direccion: 'Av. Las Heras 3092, CABA',
        equipo_nombre: 'Ablandador 25 CAB',
        prioridad: 'Media',
        estado: 'Bolsa_Trabajo',
        tiempo_servicio_estimado: 90,
    },
    {
        id: 'wo-3',
        numero_wo: 'WO-2025-0003',
        titulo: 'Instalación Osmosis Nueva',
        descripcion: 'Instalación completa de nuevo equipo',
        cliente_id: 'cli-3',
        cliente_nombre: 'Clínica del Norte',
        cliente_direccion: 'Av. Cabildo 555, CABA',
        equipo_nombre: 'Osmosis 500 L/h',
        prioridad: 'EMERGENCIA_COMODIN',
        estado: 'Bolsa_Trabajo',
        tiempo_servicio_estimado: 240, // 4 horas
    },
    {
        id: 'wo-4',
        numero_wo: 'WO-2025-0004',
        titulo: 'Revisión Rutinaria',
        descripcion: 'Control general del equipo',
        cliente_id: 'cli-4',
        cliente_nombre: 'Industria Alimenticia SRL',
        cliente_direccion: 'Zona Industrial Pacheco',
        equipo_nombre: 'Ablandador Duplex',
        prioridad: 'Baja',
        estado: 'Bolsa_Trabajo',
        tiempo_servicio_estimado: 60,
    },
    {
        id: 'wo-5',
        numero_wo: 'WO-2025-0005',
        titulo: 'Reparación Membrana',
        descripcion: 'Reemplazo de membrana dañada',
        cliente_id: 'cli-5',
        cliente_nombre: 'Universidad de Buenos Aires',
        cliente_direccion: 'Ciudad Universitaria',
        equipo_nombre: 'Osmosis HPLC',
        prioridad: 'Alta',
        estado: 'Bolsa_Trabajo',
        tiempo_servicio_estimado: 180,
    },
];

// Mock Scheduled Tasks (ya asignadas)
export const mockScheduledTasks: ScheduledTask[] = [
    {
        wo: {
            id: 'wo-scheduled-1',
            numero_wo: 'WO-2025-0010',
            titulo: 'MP Programado',
            cliente_id: 'cli-10',
            cliente_nombre: 'Sanatorio Alemán',
            cliente_direccion: 'Av. Pueyrredón 1640',
            prioridad: 'Media',
            estado: 'Asignada',
            tiempo_servicio_estimado: 90,
            tecnico_asignado_id: 'tech-1',
            tecnico_nombre: 'Juan Pérez',
        },
        tecnico_id: 'tech-1',
        hora_inicio: '09:00',
        viaje_ida_min: 30,
        servicio_min: 90,
        viaje_vuelta_min: 25,
    },
    {
        wo: {
            id: 'wo-scheduled-2',
            numero_wo: 'WO-2025-0011',
            titulo: 'Calibración Anual',
            cliente_id: 'cli-11',
            cliente_nombre: 'Lab. Elea',
            prioridad: 'Alta',
            estado: 'Asignada',
            tiempo_servicio_estimado: 120,
            tecnico_asignado_id: 'tech-2',
            tecnico_nombre: 'María García',
        },
        tecnico_id: 'tech-2',
        hora_inicio: '10:30',
        viaje_ida_min: 20,
        servicio_min: 120,
        viaje_vuelta_min: 30,
    },
];
