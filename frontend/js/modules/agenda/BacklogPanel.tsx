import React, { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Briefcase, Clock, Filter, Search, AlertCircle, Plus, Undo2 } from 'lucide-react';
import { WorkOrder, Prioridad, PRIORIDAD_BADGES } from './types';
import { WorkOrderCard } from './WorkOrderCard';
import { WorkOrderDetailsModal } from './WorkOrderDetailsModal';

interface BacklogPanelProps {
    workOrders: WorkOrder[];
    searchTerm: string;
    onSearchChange: (term: string) => void;
    filterPrioridad: Prioridad | 'all';
    onFilterChange: (filter: Prioridad | 'all') => void;
    onWorkOrderClick?: (wo: WorkOrder) => void;
    onCreateClick?: () => void;
    onDeleteWO?: (woId: string) => void;
    readOnly?: boolean;
    isDragging?: boolean; // When any drag is happening
    activeWOId?: string | null; // ID of the currently dragged WO (for ghost effect)
}

/**
 * Panel izquierdo con la bolsa de trabajo (WOs sin asignar)
 */
export function BacklogPanel({
    workOrders,
    searchTerm,
    onSearchChange,
    filterPrioridad,
    onFilterChange,
    onWorkOrderClick,
    onCreateClick,
    onDeleteWO,
    readOnly = false,
    isDragging = false,
    activeWOId = null,
}: BacklogPanelProps) {
    // Droppable zone for canceling drag (returning to backlog)
    const { isOver, setNodeRef: setDropRef } = useDroppable({
        id: 'backlog-cancel-zone',
        data: { type: 'cancel' },
    });
    // Filtrar WOs
    const filteredWOs = workOrders.filter(wo => {
        const matchesSearch =
            wo.cliente_nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
            wo.numero_wo.toLowerCase().includes(searchTerm.toLowerCase()) ||
            wo.titulo.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesPrioridad = filterPrioridad === 'all' || wo.prioridad === filterPrioridad;

        return matchesSearch && matchesPrioridad;
    });

    // Ordenar por prioridad
    const prioridadOrden: Record<Prioridad, number> = {
        'EMERGENCIA_COMODIN': 0,
        'Alta': 1,
        'Media': 2,
        'Baja': 3,
    };

    const sortedWOs = [...filteredWOs].sort((a, b) =>
        prioridadOrden[a.prioridad] - prioridadOrden[b.prioridad]
    );

    const prioridadOptions: (Prioridad | 'all')[] = ['all', 'EMERGENCIA_COMODIN', 'Alta', 'Media', 'Baja'];

    // Estado para el modal de detalles
    const [selectedWOForDetails, setSelectedWOForDetails] = useState<WorkOrder | null>(null);

    return (
        <div className="w-80 flex-shrink-0 bg-slate-50 border-r border-slate-200 flex flex-col h-full">
            {/* Header */}
            <div className="p-4 border-b border-slate-200 bg-white">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-indigo-100 rounded-lg">
                            <Briefcase size={20} className="text-indigo-600" />
                        </div>
                        <div>
                            <h2 className="font-bold text-slate-800">Bolsa de Trabajo</h2>
                            <span className="text-xs text-slate-500">
                                {sortedWOs.length} orden{sortedWOs.length !== 1 ? 'es' : ''} pendiente{sortedWOs.length !== 1 ? 's' : ''}
                            </span>
                        </div>
                    </div>
                    {onCreateClick && (
                        <button
                            onClick={onCreateClick}
                            className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
                            title="Nueva Orden de Trabajo"
                        >
                            <Plus size={18} />
                        </button>
                    )}
                </div>

                {/* Search */}
                <div className="relative mb-3">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Buscar WO, cliente..."
                        value={searchTerm}
                        onChange={e => onSearchChange(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm
                                   focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                </div>

                {/* Filter by priority */}
                <div className="flex flex-wrap gap-1.5">
                    {prioridadOptions.map(p => (
                        <button
                            key={p}
                            onClick={() => onFilterChange(p)}
                            className={`
                                px-2.5 py-1 rounded-full text-xs font-medium transition-all
                                ${filterPrioridad === p
                                    ? 'bg-indigo-600 text-white shadow-sm'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }
                            `}
                        >
                            {p === 'all' ? 'Todas' : p === 'EMERGENCIA_COMODIN' ? '🔥' : p}
                        </button>
                    ))}
                </div>
            </div>

            {/* Work Orders List - Droppable zone to cancel drag */}
            <div
                ref={setDropRef}
                className={`flex-1 overflow-y-auto p-3 space-y-3 transition-colors relative
                    ${isDragging && isOver ? 'bg-amber-50 border-2 border-dashed border-amber-300' : ''}
                    ${isDragging && !isOver ? 'bg-slate-100' : ''}
                `}
            >
                {/* Drop here to cancel indicator */}
                {isDragging && (
                    <div className={`absolute inset-0 flex items-center justify-center pointer-events-none z-10
                        ${isOver ? 'opacity-100' : 'opacity-0'}
                        transition-opacity duration-200
                    `}>
                        <div className="bg-amber-100 border border-amber-300 rounded-lg px-4 py-2 flex items-center gap-2 shadow-lg">
                            <Undo2 size={18} className="text-amber-600" />
                            <span className="text-amber-700 font-medium text-sm">Soltar para cancelar</span>
                        </div>
                    </div>
                )}

                {sortedWOs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                        <AlertCircle size={32} className="mb-2" />
                        <span className="text-sm">No hay órdenes pendientes</span>
                    </div>
                ) : (
                    sortedWOs.map(wo => (
                        <WorkOrderCard
                            key={wo.id}
                            wo={wo}
                            isDragging={activeWOId === wo.id}
                            onClick={() => onWorkOrderClick?.(wo)}
                            onDelete={() => onDeleteWO?.(wo.id)}
                            onViewDetails={() => setSelectedWOForDetails(wo)}
                        />
                    ))
                )}
            </div>

            {/* Footer stats */}
            <div className="p-3 border-t border-slate-200 bg-white">
                <div className="grid grid-cols-4 gap-2 text-center">
                    {(['EMERGENCIA_COMODIN', 'Alta', 'Media', 'Baja'] as Prioridad[]).map(p => {
                        const count = workOrders.filter(wo => wo.prioridad === p).length;
                        return (
                            <div key={p} className="text-xs">
                                <span className={`inline-block px-2 py-0.5 rounded-full ${PRIORIDAD_BADGES[p]}`}>
                                    {count}
                                </span>
                                <span className="block mt-1 text-slate-400 text-[10px]">
                                    {p === 'EMERGENCIA_COMODIN' ? 'Emerg.' : p}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Modal de detalles */}
            {selectedWOForDetails && (
                <WorkOrderDetailsModal
                    wo={selectedWOForDetails}
                    isOpen={true}
                    onClose={() => setSelectedWOForDetails(null)}
                />
            )}
        </div>
    );
}

export default BacklogPanel;
