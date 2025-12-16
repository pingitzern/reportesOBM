import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SCHEDULER_CONFIG, TimeSlot } from './types';

interface TimeGridProps {
    slots: TimeSlot[];
}

/**
 * Genera los slots de tiempo para el día
 */
export function generateTimeSlots(): TimeSlot[] {
    const slots: TimeSlot[] = [];
    const { HORA_INICIO, HORA_FIN, INTERVALO_MIN } = SCHEDULER_CONFIG;

    for (let hora = HORA_INICIO; hora < HORA_FIN; hora++) {
        for (let min = 0; min < 60; min += INTERVALO_MIN) {
            const horaStr = `${hora.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
            const minutosTotales = hora * 60 + min;
            slots.push({ hora: horaStr, minutos: minutosTotales });
        }
    }

    return slots;
}

/**
 * Header del grid de tiempo con las horas
 */
export function TimeGridHeader({ slots }: TimeGridProps) {
    const { PIXEL_POR_MINUTO, INTERVALO_MIN } = SCHEDULER_CONFIG;
    const slotWidth = INTERVALO_MIN * PIXEL_POR_MINUTO;

    return (
        <div className="flex sticky top-0 z-20 bg-white border-b border-slate-200">
            {/* Espacio para la columna de técnicos */}
            <div className="w-56 flex-shrink-0 bg-slate-50 border-r border-slate-200 p-2">
                <span className="text-xs font-semibold text-slate-500 uppercase">Técnico</span>
            </div>

            {/* Slots de tiempo */}
            <div className="flex">
                {slots.map((slot, index) => {
                    const isHour = slot.hora.endsWith(':00');
                    return (
                        <div
                            key={slot.hora}
                            style={{ width: `${slotWidth}px` }}
                            className={`
                                flex-shrink-0 py-2 text-center border-r
                                ${isHour ? 'border-slate-300 bg-slate-50' : 'border-slate-100 bg-white'}
                            `}
                        >
                            {isHour && (
                                <span className="text-xs font-semibold text-slate-600">
                                    {slot.hora}
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

interface DroppableSlotProps {
    tecnicoId: string;
    slot: TimeSlot;
    scheduledTasks?: { hora_inicio: string; viaje_ida_min: number; servicio_min: number; viaje_vuelta_min: number }[];
    children?: React.ReactNode;
}

/**
 * Convierte hora "HH:mm" a minutos desde medianoche
 */
function horaToMinutos(hora: string): number {
    const [h, m] = hora.split(':').map(Number);
    return h * 60 + m;
}

/**
 * Verifica si un slot de 30 min está ocupado por alguna tarea
 */
function isSlotOccupied(
    slotMinutos: number,
    scheduledTasks: { hora_inicio: string; viaje_ida_min: number; servicio_min: number; viaje_vuelta_min: number }[]
): boolean {
    const slotFin = slotMinutos + 30; // Slots de 30 minutos

    for (const task of scheduledTasks) {
        const tareaInicio = horaToMinutos(task.hora_inicio);
        const tareaDuracion = task.viaje_ida_min + task.servicio_min + task.viaje_vuelta_min;
        const tareaFin = tareaInicio + tareaDuracion;

        // El slot está ocupado si se superpone con la tarea
        if (slotMinutos < tareaFin && slotFin > tareaInicio) {
            return true;
        }
    }
    return false;
}

/**
 * Un slot droppable en el grid
 */
export function DroppableSlot({ tecnicoId, slot, scheduledTasks = [], children }: DroppableSlotProps) {
    const { PIXEL_POR_MINUTO, INTERVALO_MIN } = SCHEDULER_CONFIG;
    const slotWidth = INTERVALO_MIN * PIXEL_POR_MINUTO;

    const { isOver, setNodeRef } = useDroppable({
        id: `${tecnicoId}-${slot.hora}`,
        data: { tecnicoId, slot },
    });

    const isHour = slot.hora.endsWith(':00');
    const isOccupied = isSlotOccupied(slot.minutos, scheduledTasks);

    return (
        <div
            ref={setNodeRef}
            style={{ width: `${slotWidth}px` }}
            className={`
                h-full border-r relative transition-colors
                ${isHour ? 'border-slate-200' : 'border-slate-100'}
                ${isOccupied
                    ? 'bg-red-50 cursor-not-allowed'
                    : isOver
                        ? 'bg-indigo-100'
                        : 'hover:bg-slate-50'
                }
            `}
            title={isOccupied ? 'Horario ocupado' : `${slot.hora} - Disponible`}
        >
            {children}
        </div>
    );
}

/**
 * Calcula el ancho en pixels para una duración dada
 */
export function calculateBlockWidth(durationMin: number): number {
    return durationMin * SCHEDULER_CONFIG.PIXEL_POR_MINUTO;
}

/**
 * Calcula la posición X para un horario dado
 */
export function calculateBlockPosition(horaInicio: string, slots: TimeSlot[]): number {
    const [hora, min] = horaInicio.split(':').map(Number);
    const minutosTotales = hora * 60 + min;
    const primerSlot = slots[0];

    if (!primerSlot) return 0;

    const offsetMinutos = minutosTotales - primerSlot.minutos;
    return offsetMinutos * SCHEDULER_CONFIG.PIXEL_POR_MINUTO;
}

export default TimeGridHeader;
