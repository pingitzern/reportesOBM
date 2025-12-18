import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { WorkOrder, getCargaColor } from './types';

interface MonthViewProps {
    workOrders: WorkOrder[]; // WOs for the month
    currentMonth: Date; // Any date in the target month
    onDayClick: (date: Date) => void;
    onMonthChange: (direction: 'prev' | 'next') => void;
}

/**
 * Obtiene el primer día del mes
 */
function getMonthStart(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1);
}

/**
 * Obtiene el último día del mes
 */
export function getMonthEnd(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

/**
 * Genera los días del calendario (incluyendo días del mes anterior/siguiente para completar semanas)
 */
function generateCalendarDays(month: Date): Date[] {
    const days: Date[] = [];
    const monthStart = getMonthStart(month);
    const monthEnd = getMonthEnd(month);

    // Día de la semana del primer día (0=Dom, 1=Lun, etc.)
    // Ajustamos para que Lunes sea 0
    let startDayOfWeek = monthStart.getDay();
    startDayOfWeek = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

    // Agregar días del mes anterior para completar la primera semana
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
        const day = new Date(monthStart);
        day.setDate(day.getDate() - i - 1);
        days.push(day);
    }

    // Agregar todos los días del mes actual
    for (let d = 1; d <= monthEnd.getDate(); d++) {
        days.push(new Date(month.getFullYear(), month.getMonth(), d));
    }

    // Agregar días del mes siguiente para completar la última semana (hasta 42 días = 6 semanas)
    while (days.length < 42) {
        const lastDay = days[days.length - 1];
        const nextDay = new Date(lastDay);
        nextDay.setDate(nextDay.getDate() + 1);
        days.push(nextDay);
    }

    return days;
}

/**
 * Formatea fecha a 'YYYY-MM-DD'
 */
function toDateKey(date: Date): string {
    return date.toISOString().split('T')[0];
}

interface DayData {
    date: Date;
    dateKey: string;
    workOrderCount: number;
    totalHours: number;
    isCurrentMonth: boolean;
    isToday: boolean;
    isWeekend: boolean;
}

/**
 * Calcula datos por día
 */
function calculateDayData(days: Date[], workOrders: WorkOrder[], currentMonth: Date): DayData[] {
    const today = toDateKey(new Date());
    const currentMonthNum = currentMonth.getMonth();

    return days.map(date => {
        const dateKey = toDateKey(date);
        const dayOfWeek = date.getDay();

        // Filtrar WOs para este día
        const dayWOs = workOrders.filter(wo =>
            wo.fecha_programada?.startsWith(dateKey)
        );

        const totalMinutes = dayWOs.reduce((sum, wo) => sum + (wo.tiempo_servicio_estimado || 60), 0);

        return {
            date,
            dateKey,
            workOrderCount: dayWOs.length,
            totalHours: totalMinutes / 60,
            isCurrentMonth: date.getMonth() === currentMonthNum,
            isToday: dateKey === today,
            isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
        };
    });
}

/**
 * Vista Mes: Calendario mensual con indicadores de carga
 */
export function MonthView({ workOrders, currentMonth, onDayClick, onMonthChange }: MonthViewProps) {
    const calendarDays = generateCalendarDays(currentMonth);
    const dayData = calculateDayData(calendarDays, workOrders, currentMonth);

    const dayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

    // Formato del header del mes
    const formatMonthHeader = () => {
        return currentMonth.toLocaleDateString('es-AR', {
            month: 'long',
            year: 'numeric'
        }).replace(/^\w/, c => c.toUpperCase());
    };

    // Dividir días en semanas (7 días cada una)
    const weeks: DayData[][] = [];
    for (let i = 0; i < dayData.length; i += 7) {
        weeks.push(dayData.slice(i, i + 7));
    }

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Month Navigation Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
                <button
                    onClick={() => onMonthChange('prev')}
                    className="p-1.5 rounded-lg hover:bg-slate-200 transition-colors"
                    title="Mes anterior"
                >
                    <ChevronLeft size={20} className="text-slate-600" />
                </button>

                <h3 className="text-lg font-semibold text-slate-700 capitalize">
                    {formatMonthHeader()}
                </h3>

                <button
                    onClick={() => onMonthChange('next')}
                    className="p-1.5 rounded-lg hover:bg-slate-200 transition-colors"
                    title="Mes siguiente"
                >
                    <ChevronRight size={20} className="text-slate-600" />
                </button>
            </div>

            {/* Calendar Grid */}
            <div className="p-2">
                {/* Day headers */}
                <div className="grid grid-cols-7 mb-1">
                    {dayNames.map((name, idx) => (
                        <div
                            key={name}
                            className={`
                                text-center text-xs font-semibold py-2
                                ${idx >= 5 ? 'text-slate-400' : 'text-slate-500'}
                            `}
                        >
                            {name}
                        </div>
                    ))}
                </div>

                {/* Weeks */}
                {weeks.map((week, weekIdx) => (
                    <div key={weekIdx} className="grid grid-cols-7 gap-1">
                        {week.map(day => {
                            const carga = getCargaColor(day.totalHours);

                            return (
                                <div
                                    key={day.dateKey}
                                    onClick={() => onDayClick(day.date)}
                                    className={`
                                        relative p-2 min-h-[70px] rounded-lg cursor-pointer transition-all
                                        hover:ring-2 hover:ring-indigo-400 hover:shadow-sm
                                        ${!day.isCurrentMonth ? 'opacity-40' : ''}
                                        ${day.isToday ? 'ring-2 ring-indigo-500 bg-indigo-50' : ''}
                                        ${day.isWeekend && !day.isToday ? 'bg-slate-50' : 'bg-white'}
                                        ${day.workOrderCount > 0 && day.isCurrentMonth ? carga.bg : ''}
                                        border border-slate-100
                                    `}
                                    title={day.workOrderCount > 0
                                        ? `${day.workOrderCount} WO(s) - ${day.totalHours.toFixed(1)}h`
                                        : 'Sin WOs'
                                    }
                                >
                                    {/* Day number */}
                                    <div className={`
                                        text-sm font-semibold mb-1
                                        ${day.isToday
                                            ? 'text-white bg-indigo-600 w-6 h-6 rounded-full flex items-center justify-center'
                                            : day.isCurrentMonth
                                                ? 'text-slate-700'
                                                : 'text-slate-400'
                                        }
                                    `}>
                                        {day.date.getDate()}
                                    </div>

                                    {/* WO count badge */}
                                    {day.workOrderCount > 0 && day.isCurrentMonth && (
                                        <div className="flex flex-col items-center">
                                            <span className={`text-xl font-bold ${carga.text}`}>
                                                {day.workOrderCount}
                                            </span>
                                            <span className={`text-xs ${carga.text} opacity-75`}>
                                                {day.totalHours.toFixed(1)}h
                                            </span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>

            {/* Legend */}
            <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center gap-4 text-xs text-slate-500">
                <span className="font-medium">Carga total:</span>
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
                <span className="ml-auto text-slate-400">Click en un día para ver el detalle</span>
            </div>
        </div>
    );
}

export default MonthView;
