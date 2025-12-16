import React from 'react';
import { MapPin, Star, Briefcase } from 'lucide-react';
import { Tecnico, ScheduledTask, TimeSlot, SCHEDULER_CONFIG, PRIORIDAD_COLORS } from './types';
import { DroppableSlot, calculateBlockWidth, calculateBlockPosition } from './TimeGrid';

interface TechnicianRowProps {
    tecnico: Tecnico;
    slots: TimeSlot[];
    scheduledTasks: ScheduledTask[];
    onTaskClick?: (task: ScheduledTask) => void;
}

/**
 * Fila de un técnico con sus tareas programadas
 */
export function TechnicianRow({ tecnico, slots, scheduledTasks, onTaskClick }: TechnicianRowProps) {
    const { INTERVALO_MIN, PIXEL_POR_MINUTO } = SCHEDULER_CONFIG;
    const slotWidth = INTERVALO_MIN * PIXEL_POR_MINUTO;
    const rowHeight = 80; // pixels

    // Filtrar tareas de este técnico
    const tasks = scheduledTasks.filter(t => t.tecnico_id === tecnico.id);

    // Calcular ocupación del día (8:00 a 18:00 = 10 horas = 600 minutos)
    const JORNADA_MINUTOS = 600;
    const minutosOcupados = tasks.reduce((total, task) => {
        return total + task.viaje_ida_min + task.servicio_min + task.viaje_vuelta_min;
    }, 0);
    const porcentajeOcupacion = Math.min(100, Math.round((minutosOcupados / JORNADA_MINUTOS) * 100));
    const horasOcupadas = (minutosOcupados / 60).toFixed(1);

    return (
        <div className="flex border-b border-slate-200 min-h-[80px]">
            {/* Info del técnico */}
            <div className="w-56 flex-shrink-0 bg-slate-50 border-r border-slate-200 p-3">
                <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                        {tecnico.nombre.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                    </div>

                    <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm text-slate-800 truncate">
                            {tecnico.nombre}
                        </h4>

                        {/* Skills resumidos */}
                        <div className="flex flex-wrap gap-1 mt-1">
                            {tecnico.habilidades.slice(0, 2).map((hab, idx) => (
                                <span
                                    key={idx}
                                    className="px-1.5 py-0.5 bg-slate-200 text-slate-600 rounded text-[10px] font-medium"
                                >
                                    {hab.nombre.length > 8 ? hab.nombre.substring(0, 8) + '...' : hab.nombre}
                                </span>
                            ))}
                            {tecnico.habilidades.length > 2 && (
                                <span className="text-[10px] text-slate-400">
                                    +{tecnico.habilidades.length - 2}
                                </span>
                            )}
                        </div>

                        {/* Ocupación del día */}
                        <div className="mt-2">
                            <div className="flex items-center justify-between text-[10px] mb-0.5">
                                <span className="text-slate-500">{horasOcupadas}h / 10h</span>
                                <span className={`font-semibold ${porcentajeOcupacion >= 80 ? 'text-red-600' :
                                    porcentajeOcupacion >= 50 ? 'text-amber-600' :
                                        'text-green-600'
                                    }`}>
                                    {porcentajeOcupacion}%
                                </span>
                            </div>
                            <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                <div
                                    className={`h-full transition-all duration-300 ${porcentajeOcupacion >= 80 ? 'bg-red-500' :
                                        porcentajeOcupacion >= 50 ? 'bg-amber-500' :
                                            'bg-green-500'
                                        }`}
                                    style={{ width: `${porcentajeOcupacion}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Timeline */}
            <div className="flex relative" style={{ height: `${rowHeight}px` }}>
                {/* Background slots */}
                {slots.map(slot => (
                    <DroppableSlot
                        key={slot.hora}
                        tecnicoId={tecnico.id}
                        slot={slot}
                        scheduledTasks={tasks}
                    />
                ))}

                {/* Tareas programadas (posicionadas absolutamente) */}
                {tasks.map(task => (
                    <ScheduledTaskBlock
                        key={task.wo.id}
                        task={task}
                        slots={slots}
                        rowHeight={rowHeight}
                        onClick={() => onTaskClick?.(task)}
                    />
                ))}
            </div>
        </div>
    );
}

interface ScheduledTaskBlockProps {
    task: ScheduledTask;
    slots: TimeSlot[];
    rowHeight: number;
    onClick?: () => void;
}

/**
 * Bloque de tarea programada con estructura de "sándwich" (viaje-servicio-viaje)
 */
function ScheduledTaskBlock({ task, slots, rowHeight, onClick }: ScheduledTaskBlockProps) {
    const { wo, viaje_ida_min, servicio_min, viaje_vuelta_min, hora_inicio } = task;

    const totalDuration = viaje_ida_min + servicio_min + viaje_vuelta_min;
    const totalWidth = calculateBlockWidth(totalDuration);
    const position = calculateBlockPosition(hora_inicio, slots);

    // Calcular alturas proporcionales
    const padding = 4;
    const availableHeight = rowHeight - (padding * 2);

    const travelHeight = 8; // Altura fija para viajes
    const serviceHeight = availableHeight - (travelHeight * 2) - 4; // Espacio para servicio

    // Calcular anchos
    const idaWidth = calculateBlockWidth(viaje_ida_min);
    const servicioWidth = calculateBlockWidth(servicio_min);
    const vueltaWidth = calculateBlockWidth(viaje_vuelta_min);

    const colors = PRIORIDAD_COLORS[wo.prioridad];

    return (
        <div
            className="absolute top-1 bottom-1 flex flex-col rounded-lg overflow-hidden cursor-pointer
                       shadow-md hover:shadow-lg transition-shadow border border-slate-200"
            style={{
                left: `${position}px`,
                width: `${totalWidth}px`,
            }}
            onClick={onClick}
        >
            {/* Viaje Ida */}
            {viaje_ida_min > 0 && (
                <div
                    className="bg-slate-300 flex items-center justify-center"
                    style={{ height: `${travelHeight}px`, width: `${idaWidth}px` }}
                >
                    <span className="text-[8px] text-slate-600 font-medium">
                        🚗 {viaje_ida_min}min
                    </span>
                </div>
            )}

            {/* Servicio (centro) */}
            <div
                className={`flex-1 ${colors.bg} flex flex-col justify-center px-2 min-h-0`}
                style={{ marginLeft: `${idaWidth}px`, width: `${servicioWidth}px` }}
            >
                <span className={`text-xs font-semibold ${colors.text} truncate`}>
                    {wo.cliente_nombre}
                </span>
                <span className="text-[10px] text-slate-500 truncate">
                    {wo.titulo}
                </span>
                <span className="text-[10px] text-slate-400">
                    {servicio_min} min
                </span>
            </div>

            {/* Viaje Vuelta */}
            {viaje_vuelta_min > 0 && (
                <div
                    className="bg-slate-300 flex items-center justify-center"
                    style={{
                        height: `${travelHeight}px`,
                        marginLeft: `${idaWidth + servicioWidth}px`,
                        width: `${vueltaWidth}px`
                    }}
                >
                    <span className="text-[8px] text-slate-600 font-medium">
                        🚗 {viaje_vuelta_min}min
                    </span>
                </div>
            )}
        </div>
    );
}

export default TechnicianRow;
