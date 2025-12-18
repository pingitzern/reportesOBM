import React from 'react';
import { Calendar, CalendarDays, Grid3X3 } from 'lucide-react';
import { ViewMode } from './types';

interface ViewSelectorProps {
    currentView: ViewMode;
    onViewChange: (view: ViewMode) => void;
}

/**
 * Selector de vista: Día / Semana / Mes
 */
export function ViewSelector({ currentView, onViewChange }: ViewSelectorProps) {
    const views: { mode: ViewMode; label: string; icon: React.ReactNode }[] = [
        { mode: 'day', label: 'Día', icon: <Calendar size={16} /> },
        { mode: 'week', label: 'Semana', icon: <CalendarDays size={16} /> },
        { mode: 'month', label: 'Mes', icon: <Grid3X3 size={16} /> },
    ];

    return (
        <div className="flex rounded-lg border border-slate-200 overflow-hidden bg-white shadow-sm">
            {views.map(({ mode, label, icon }) => (
                <button
                    key={mode}
                    onClick={() => onViewChange(mode)}
                    className={`
                        flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-all
                        ${currentView === mode
                            ? 'bg-indigo-600 text-white'
                            : 'bg-white text-slate-600 hover:bg-slate-50'
                        }
                        ${mode !== 'day' ? 'border-l border-slate-200' : ''}
                    `}
                >
                    {icon}
                    {label}
                </button>
            ))}
        </div>
    );
}

export default ViewSelector;
