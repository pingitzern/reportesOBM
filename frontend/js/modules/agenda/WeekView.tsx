import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Tecnico, WorkOrder, DaySummary, TechnicianWeekSummary, getCargaColor } from './types';

interface WeekViewProps {
    tecnicos: Tecnico[];
    workOrders: WorkOrder[]; // WOs for the week
    weekStart: Date;
    onDayClick: (date: Date) => void;
    onWeekChange: (direction: 'prev' | 'next') => void;
}

/**
 * Genera los 7 días de la semana a partir de una fecha inicial (lunes)
 */
function generateWeekDays(weekStart: Date): Date[] {
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
        const day = new Date(weekStart);
        day.setDate(day.getDate() + i);
        days.push(day);
    }
    return days;
}

/**
 * Obtiene el lunes de la semana para una fecha dada
 */
export function getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

/**
 * Formatea fecha a 'YYYY-MM-DD'
 */
function toDateKey(date: Date): string {
    return date.toISOString().split('T')[0];
}

/**
 * Calcula resumen de cada técnico por día
 */
function calculateTechnicianWeekData(
    tecnicos: Tecnico[],
    workOrders: WorkOrder[],
    weekDays: Date[]
): TechnicianWeekSummary[] {
    const today = toDateKey(new Date());

    return tecnicos.map(tecnico => {
        const days: DaySummary[] = weekDays.map(date => {
            const dateKey = toDateKey(date);

            // Filtrar WOs del técnico para este día
            const techWOs = workOrders.filter(wo =>
                wo.tecnico_asignado_id === tecnico.id &&
                wo.fecha_programada?.startsWith(dateKey)
            );

            const totalMinutes = techWOs.reduce((sum, wo) => sum + (wo.tiempo_servicio_estimado || 60), 0);

            return {
                date,
                dateKey,
                workOrderCount: techWOs.length,
                totalServiceHours: totalMinutes / 60,
                isToday: dateKey === today,
                isCurrentMonth: true,
            };
        });

        return { tecnico, days };
    });
}

/**
 * Vista Semana: Grid de técnicos × días
 */
export function WeekView({ tecnicos, workOrders, weekStart, onDayClick, onWeekChange }: WeekViewProps) {
    const weekDays = generateWeekDays(weekStart);
    const technicianData = calculateTechnicianWeekData(tecnicos, workOrders, weekDays);

    const dayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

    // Formato del header de la semana
    const formatWeekRange = () => {
        const start = weekDays[0];
        const end = weekDays[6];
        const monthStart = start.toLocaleDateString('es-AR', { month: 'short' });
        const monthEnd = end.toLocaleDateString('es-AR', { month: 'short' });

        if (monthStart === monthEnd) {
            return `${start.getDate()} - ${end.getDate()} ${monthStart} ${start.getFullYear()}`;
        }
        return `${start.getDate()} ${monthStart} - ${end.getDate()} ${monthEnd} ${start.getFullYear()}`;
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Week Navigation Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
                <button
                    onClick={() => onWeekChange('prev')}
                    className="p-1.5 rounded-lg hover:bg-slate-200 transition-colors"
                    title="Semana anterior"
                >
                    <ChevronLeft size={20} className="text-slate-600" />
                </button>

                <h3 className="text-sm font-semibold text-slate-700">
                    {formatWeekRange()}
                </h3>

                <button
                    onClick={() => onWeekChange('next')}
                    className="p-1.5 rounded-lg hover:bg-slate-200 transition-colors"
                    title="Semana siguiente"
                >
                    <ChevronRight size={20} className="text-slate-600" />
                </button>
            </div>

            {/* Grid */}
            <div className="overflow-x-auto">
                <table className="w-full">
                    {/* Header: días de la semana */}
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="w-48 px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                                Técnico
                            </th>
                            {weekDays.map((day, idx) => {
                                const isToday = toDateKey(day) === toDateKey(new Date());
                                const isWeekend = idx >= 5;
                                return (
                                    <th
                                        key={idx}
                                        className={`
                                            px-2 py-3 text-center min-w-[100px]
                                            ${isToday ? 'bg-indigo-50' : ''}
                                            ${isWeekend ? 'bg-slate-100' : ''}
                                        `}
                                    >
                                        <div className="text-xs font-semibold text-slate-500">
                                            {dayNames[idx]}
                                        </div>
                                        <div className={`
                                            text-xl font-bold
                                            ${isToday
                                                ? 'text-white bg-indigo-600 w-8 h-8 rounded-full flex items-center justify-center mx-auto'
                                                : 'text-slate-700'
                                            }
                                        `}>
                                            {day.getDate()}
                                        </div>
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>

                    {/* Body: técnicos */}
                    <tbody>
                        {technicianData.map(({ tecnico, days }) => (
                            <tr key={tecnico.id} className="border-b border-slate-100 hover:bg-slate-50">
                                {/* Técnico info */}
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold">
                                            {tecnico.nombre.charAt(0)}
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium text-slate-800">
                                                {tecnico.nombre}
                                            </div>
                                        </div>
                                    </div>
                                </td>

                                {/* Días */}
                                {days.map((day, idx) => {
                                    const isWeekend = idx >= 5;
                                    const carga = getCargaColor(day.totalServiceHours);

                                    return (
                                        <td
                                            key={day.dateKey}
                                            onClick={() => onDayClick(day.date)}
                                            className={`
                                                px-3 py-4 text-center cursor-pointer transition-all
                                                hover:ring-2 hover:ring-indigo-400 hover:ring-inset hover:shadow-sm
                                                ${day.isToday ? 'ring-2 ring-indigo-500 ring-inset bg-indigo-50' : ''}
                                                ${isWeekend && !day.isToday ? 'bg-slate-50' : ''}
                                                ${day.workOrderCount > 0 ? carga.bg : ''}
                                            `}
                                            title={`${day.workOrderCount} WO(s) - ${day.totalServiceHours.toFixed(1)}h`}
                                        >
                                            {day.workOrderCount > 0 ? (
                                                <div className="flex flex-col items-center gap-0.5">
                                                    <span className={`text-2xl font-bold ${carga.text}`}>
                                                        {day.workOrderCount}
                                                    </span>
                                                    <span className={`text-sm font-medium ${carga.text} opacity-75`}>
                                                        {day.totalServiceHours.toFixed(1)}h
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-slate-300 text-lg">—</span>
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Legend */}
            <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center gap-4 text-xs text-slate-500">
                <span className="font-medium">Carga:</span>
                <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300"></span>
                    Baja (&lt;4h)
                </span>
                <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded bg-amber-100 border border-amber-300"></span>
                    Media (4-6h)
                </span>
                <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded bg-red-100 border border-red-300"></span>
                    Alta (&gt;6h)
                </span>
                <span className="ml-auto text-slate-400">Click en una celda para ir a la vista diaria</span>
            </div>
        </div>
    );
}

export default WeekView;
