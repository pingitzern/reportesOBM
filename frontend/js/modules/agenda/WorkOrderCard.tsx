import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Clock, MapPin, User, Wrench, Trash2 } from 'lucide-react';
import { WorkOrder, PRIORIDAD_BADGES, PRIORIDAD_COLORS, CONFIRMACION_CONFIG } from './types';

interface WorkOrderCardProps {
    wo: WorkOrder;
    isDragging?: boolean;
    isCompact?: boolean;
    onClick?: () => void;
    onDelete?: () => void;
}

/**
 * Tarjeta de Work Order arrastrable
 */
export function WorkOrderCard({ wo, isDragging, isCompact, onClick, onDelete }: WorkOrderCardProps) {
    const { attributes, listeners, setNodeRef, transform } = useDraggable({
        id: wo.id,
        data: { type: 'workorder', wo },
    });

    const style = transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: 1000,
    } : undefined;

    const colors = PRIORIDAD_COLORS[wo.prioridad];

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            onClick={onClick}
            className={`
                ${colors.bg} ${colors.border}
                border-l-4 rounded-lg p-3 cursor-grab active:cursor-grabbing
                shadow-sm hover:shadow-md transition-all duration-200
                ${isDragging ? 'opacity-50 scale-105 shadow-lg' : ''}
                ${isCompact ? 'p-2' : 'p-3'}
                group relative
            `}
        >
            {/* Header */}
            <div className="flex items-start justify-between gap-2 mb-2">
                <span className="font-mono text-xs font-semibold text-slate-500">
                    {wo.numero_wo}
                </span>

                <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PRIORIDAD_BADGES[wo.prioridad]}`}>
                        {wo.prioridad === 'EMERGENCIA_COMODIN' ? '🔥 Emergencia' : wo.prioridad}
                    </span>

                    {onDelete && !isDragging && (
                        <button
                            onPointerDown={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                console.log('Delete button clicked for WO id:', wo.id);
                                const confirmed = window.confirm('¿Estás seguro de eliminar esta Work Order?');
                                console.log('User confirmed:', confirmed);
                                if (confirmed) {
                                    console.log('Calling onDelete()...');
                                    onDelete();
                                }
                            }}
                            className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-1 rounded transition-colors"
                            title="Eliminar WO"
                        >
                            <Trash2 size={14} />
                        </button>
                    )}
                </div>
            </div>

            {/* Cliente */}
            <h4 className={`font-semibold ${colors.text} ${isCompact ? 'text-sm' : 'text-base'} mb-1 line-clamp-1`}>
                {wo.cliente_nombre}
            </h4>

            {/* Título */}
            <p className="text-sm text-slate-600 mb-2 line-clamp-2">
                {wo.titulo}
            </p>

            {/* Info row */}
            {!isCompact && (
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {wo.tiempo_servicio_estimado} min
                    </span>
                    {wo.equipo_nombre && (
                        <span className="flex items-center gap-1">
                            <Wrench size={12} />
                            {wo.equipo_nombre}
                        </span>
                    )}
                    {wo.tecnico_nombre && (
                        <span className="flex items-center gap-1">
                            <User size={12} />
                            {wo.tecnico_nombre}
                        </span>
                    )}
                </div>
            )}

            {/* Debug confirmación */}
            {console.log('[WorkOrderCard] WO:', wo.numero_wo, 'estado:', wo.estado, 'conf_tec:', wo.confirmacion_tecnico, 'conf_cli:', wo.confirmacion_cliente)}

            {/* Indicadores de confirmación (solo en WOs asignadas) */}
            {wo.estado === 'Asignada' && wo.confirmacion_tecnico && !isCompact && (
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-200">
                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${CONFIRMACION_CONFIG[wo.confirmacion_tecnico].bg} ${CONFIRMACION_CONFIG[wo.confirmacion_tecnico].text}`}>
                        {CONFIRMACION_CONFIG[wo.confirmacion_tecnico].icon} Téc
                    </span>
                    {wo.confirmacion_cliente && (
                        <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${CONFIRMACION_CONFIG[wo.confirmacion_cliente].bg} ${CONFIRMACION_CONFIG[wo.confirmacion_cliente].text}`}>
                            {CONFIRMACION_CONFIG[wo.confirmacion_cliente].icon} Cli
                        </span>
                    )}
                </div>
            )}

            {/* Estado Confirmada_Cliente - ambos confirmaron */}
            {wo.estado === 'Confirmada_Cliente' && !isCompact && (
                <div className="flex items-center gap-1 mt-2 pt-2 border-t border-green-200">
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">
                        ✅✅ Confirmada por ambos
                    </span>
                </div>
            )}

            {/* Compact info */}
            {isCompact && (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Clock size={11} />
                    <span>{wo.tiempo_servicio_estimado} min</span>
                </div>
            )}
        </div>
    );
}

/**
 * Versión estática mejorada de la tarjeta (para el preview mientras se arrastra)
 * Con efecto de "flotando" más pronunciado
 */
export function WorkOrderCardStatic({ wo, isCompact }: { wo: WorkOrder; isCompact?: boolean }) {
    const colors = PRIORIDAD_COLORS[wo.prioridad];

    return (
        <div
            className={`
                ${colors.bg} ${colors.border}
                border-l-4 rounded-lg shadow-2xl
                ${isCompact ? 'p-2 w-64' : 'p-3 w-72'}
                transform rotate-2 scale-105
                ring-2 ring-indigo-400 ring-opacity-50
                opacity-95
            `}
            style={{
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35), 0 0 15px rgba(99, 102, 241, 0.3)',
            }}
        >
            {/* Header with badge */}
            <div className="flex items-start justify-between gap-2 mb-1">
                <span className="font-mono text-xs font-bold text-slate-600">
                    {wo.numero_wo}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PRIORIDAD_BADGES[wo.prioridad]}`}>
                    {wo.prioridad === 'EMERGENCIA_COMODIN' ? '🔥' : wo.prioridad}
                </span>
            </div>

            {/* Client name */}
            <h4 className={`font-semibold ${colors.text} text-sm line-clamp-1 mb-1`}>
                {wo.cliente_nombre}
            </h4>

            {/* Title */}
            <p className="text-xs text-slate-500 line-clamp-1 mb-2">
                {wo.titulo}
            </p>

            {/* Time indicator */}
            <div className="flex items-center gap-2 text-xs text-slate-400">
                <Clock size={12} />
                <span>{wo.tiempo_servicio_estimado} min</span>
                <span className="text-indigo-500 font-medium ml-auto">
                    Arrastrando...
                </span>
            </div>
        </div>
    );
}

export default WorkOrderCard;
