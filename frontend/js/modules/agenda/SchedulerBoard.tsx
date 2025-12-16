import React, { useState, useMemo } from 'react';
import {
    DndContext,
    DragOverlay,
    DragStartEvent,
    DragEndEvent,
    closestCenter,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import { Calendar, RefreshCw, ChevronLeft, ChevronRight, Settings } from 'lucide-react';
import {
    WorkOrder,
    Tecnico,
    ScheduledTask,
    Prioridad,
    SCHEDULER_CONFIG
} from './types';
import { BacklogPanel } from './BacklogPanel';
import { TechnicianRow } from './TechnicianRow';
import { TimeGridHeader, generateTimeSlots } from './TimeGrid';
import { WorkOrderCardStatic } from './WorkOrderCard';
import { TaskDetailModal } from './TaskDetailModal';

interface SchedulerBoardProps {
    // Data
    backlogWorkOrders: WorkOrder[];
    tecnicos: Tecnico[];
    scheduledTasks: ScheduledTask[];
    selectedDate: Date;
    // Callbacks
    onDateChange: (date: Date) => void;
    onAssignTask: (woId: string, tecnicoId: string, horaInicio: string) => void;
    onUnassignTask: (woId: string) => void;
    onRefresh?: () => void;
    onCreateWO?: () => void;
    onDeleteWO?: (woId: string) => void;
}

/**
 * Componente principal del Scheduler Board
 */
export function SchedulerBoard({
    backlogWorkOrders,
    tecnicos,
    scheduledTasks,
    selectedDate,
    onDateChange,
    onAssignTask,
    onUnassignTask,
    onRefresh,
    onCreateWO,
    onDeleteWO,
}: SchedulerBoardProps) {
    // State
    const [searchTerm, setSearchTerm] = useState('');
    const [filterPrioridad, setFilterPrioridad] = useState<Prioridad | 'all'>('all');
    const [activeWO, setActiveWO] = useState<WorkOrder | null>(null);
    const [selectedTask, setSelectedTask] = useState<ScheduledTask | null>(null);

    // Time slots
    const timeSlots = useMemo(() => generateTimeSlots(), []);

    // DnD sensors
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        })
    );

    // Format date
    const formatDate = (date: Date) => {
        return date.toLocaleDateString('es-AR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    // Navigate dates
    const goToPreviousDay = () => {
        const newDate = new Date(selectedDate);
        newDate.setDate(newDate.getDate() - 1);
        onDateChange(newDate);
    };

    const goToNextDay = () => {
        const newDate = new Date(selectedDate);
        newDate.setDate(newDate.getDate() + 1);
        onDateChange(newDate);
    };

    const goToToday = () => {
        onDateChange(new Date());
    };

    // DnD handlers
    const handleDragStart = (event: DragStartEvent) => {
        const { active } = event;
        const woData = active.data.current?.wo as WorkOrder;
        if (woData) {
            setActiveWO(woData);
        }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveWO(null);

        if (!over) return;

        const woData = active.data.current?.wo as WorkOrder;
        const dropData = over.data.current as { tecnicoId: string; slot: { hora: string } } | undefined;

        if (woData && dropData?.tecnicoId && dropData?.slot) {
            onAssignTask(woData.id, dropData.tecnicoId, dropData.slot.hora);
        }
    };

    const handleTaskClick = (task: ScheduledTask) => {
        setSelectedTask(task);
    };

    const handleUnassign = (woId: string) => {
        onUnassignTask(woId);
        setSelectedTask(null);
    };

    // Calculate total width for the timeline
    const totalTimelineWidth = timeSlots.length * (SCHEDULER_CONFIG.INTERVALO_MIN * SCHEDULER_CONFIG.PIXEL_POR_MINUTO);

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <div className="flex h-screen bg-slate-100">
                {/* Backlog Panel (Left) */}
                <BacklogPanel
                    workOrders={backlogWorkOrders}
                    searchTerm={searchTerm}
                    onSearchChange={setSearchTerm}
                    filterPrioridad={filterPrioridad}
                    onFilterChange={setFilterPrioridad}
                    onCreateClick={onCreateWO}
                    onDeleteWO={onDeleteWO}
                />

                {/* Main Timeline (Right) */}
                <div className="flex-1 flex flex-col min-w-0">
                    {/* Header */}
                    <div className="bg-white border-b border-slate-200 px-6 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg">
                                    <Calendar size={24} className="text-white" />
                                </div>
                                <div>
                                    <h1 className="text-xl font-bold text-slate-800">
                                        Coordinación de Servicios
                                    </h1>
                                    <p className="text-sm text-slate-500 capitalize">
                                        {formatDate(selectedDate)}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                {/* Date navigation */}
                                <div className="flex items-center bg-slate-100 rounded-xl p-1">
                                    <button
                                        onClick={goToPreviousDay}
                                        className="p-2 hover:bg-white rounded-lg transition-colors"
                                    >
                                        <ChevronLeft size={18} className="text-slate-600" />
                                    </button>
                                    <button
                                        onClick={goToToday}
                                        className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-white rounded-lg transition-colors"
                                    >
                                        Hoy
                                    </button>
                                    <button
                                        onClick={goToNextDay}
                                        className="p-2 hover:bg-white rounded-lg transition-colors"
                                    >
                                        <ChevronRight size={18} className="text-slate-600" />
                                    </button>
                                </div>

                                {/* Refresh */}
                                {onRefresh && (
                                    <button
                                        onClick={onRefresh}
                                        className="p-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                                    >
                                        <RefreshCw size={18} className="text-slate-600" />
                                    </button>
                                )}

                                {/* Settings placeholder */}
                                <button className="p-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">
                                    <Settings size={18} className="text-slate-600" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Timeline Grid */}
                    <div className="flex-1 overflow-auto">
                        <div style={{ minWidth: `${totalTimelineWidth + 224}px` }}>
                            {/* Time header */}
                            <TimeGridHeader slots={timeSlots} />

                            {/* Technician rows */}
                            <div>
                                {tecnicos.length === 0 ? (
                                    <div className="flex items-center justify-center py-20 text-slate-400">
                                        <span>No hay técnicos disponibles</span>
                                    </div>
                                ) : (
                                    tecnicos.map(tecnico => (
                                        <TechnicianRow
                                            key={tecnico.id}
                                            tecnico={tecnico}
                                            slots={timeSlots}
                                            scheduledTasks={scheduledTasks}
                                            onTaskClick={handleTaskClick}
                                        />
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Stats footer */}
                    <div className="bg-white border-t border-slate-200 px-6 py-3">
                        <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-6 text-slate-500">
                                <span>
                                    <strong className="text-slate-700">{tecnicos.length}</strong> técnicos
                                </span>
                                <span>
                                    <strong className="text-slate-700">{scheduledTasks.length}</strong> asignadas
                                </span>
                                <span>
                                    <strong className="text-slate-700">{backlogWorkOrders.length}</strong> pendientes
                                </span>
                            </div>
                            <div className="text-xs text-slate-400">
                                Arrastrá una orden al calendario para asignarla
                            </div>
                        </div>
                    </div>
                </div>

                {/* Drag Overlay */}
                <DragOverlay>
                    {activeWO && <WorkOrderCardStatic wo={activeWO} isCompact />}
                </DragOverlay>

                {/* Task Detail Modal */}
                <TaskDetailModal
                    task={selectedTask}
                    onClose={() => setSelectedTask(null)}
                    onUnassign={handleUnassign}
                />
            </div>
        </DndContext>
    );
}

export default SchedulerBoard;
