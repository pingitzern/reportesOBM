import React, { useState } from 'react';
import { X, Clock, MapPin, User, Wrench, Calendar, AlertTriangle } from 'lucide-react';
import { ScheduledTask, WorkOrder, PRIORIDAD_BADGES, PRIORIDAD_COLORS } from './types';

interface TaskDetailModalProps {
    task: ScheduledTask | null;
    onClose: () => void;
    onUnassign?: (woId: string) => void;
}

/**
 * Modal/Popover con detalles de una tarea programada
 */
export function TaskDetailModal({ task, onClose, onUnassign }: TaskDetailModalProps) {
    if (!task) return null;

    const { wo, viaje_ida_min, servicio_min, viaje_vuelta_min, hora_inicio } = task;
    const colors = PRIORIDAD_COLORS[wo.prioridad];
    const totalTime = viaje_ida_min + servicio_min + viaje_vuelta_min;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className={`${colors.bg} px-5 py-4 border-b ${colors.border}`}>
                    <div className="flex items-start justify-between">
                        <div>
                            <span className="font-mono text-xs font-semibold text-slate-500">
                                {wo.numero_wo}
                            </span>
                            <h3 className={`text-lg font-bold ${colors.text} mt-1`}>
                                {wo.cliente_nombre}
                            </h3>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1 hover:bg-white/50 rounded-lg transition-colors"
                        >
                            <X size={20} className="text-slate-500" />
                        </button>
                    </div>
                    <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-medium ${PRIORIDAD_BADGES[wo.prioridad]}`}>
                        {wo.prioridad === 'EMERGENCIA_COMODIN' ? '🔥 Emergencia' : `Prioridad: ${wo.prioridad}`}
                    </span>
                </div>

                {/* Content */}
                <div className="p-5 space-y-4">
                    {/* Título y descripción */}
                    <div>
                        <h4 className="font-semibold text-slate-800">{wo.titulo}</h4>
                        {wo.descripcion && (
                            <p className="text-sm text-slate-600 mt-1">{wo.descripcion}</p>
                        )}
                    </div>

                    {/* Timeline visual */}
                    <div className="bg-slate-50 rounded-xl p-4">
                        <h5 className="text-xs font-semibold text-slate-500 uppercase mb-3">
                            Desglose de Tiempo
                        </h5>

                        <div className="space-y-2">
                            {/* Viaje Ida */}
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center">
                                    🚗
                                </div>
                                <div className="flex-1">
                                    <span className="text-sm text-slate-700">Viaje de ida</span>
                                </div>
                                <span className="text-sm font-semibold text-slate-800">
                                    {viaje_ida_min} min
                                </span>
                            </div>

                            {/* Servicio */}
                            <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-lg ${colors.bg} flex items-center justify-center`}>
                                    <Wrench size={16} className={colors.text} />
                                </div>
                                <div className="flex-1">
                                    <span className="text-sm text-slate-700">Servicio</span>
                                </div>
                                <span className="text-sm font-semibold text-slate-800">
                                    {servicio_min} min
                                </span>
                            </div>

                            {/* Viaje Vuelta */}
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center">
                                    🚗
                                </div>
                                <div className="flex-1">
                                    <span className="text-sm text-slate-700">Viaje siguiente</span>
                                </div>
                                <span className="text-sm font-semibold text-slate-800">
                                    {viaje_vuelta_min} min
                                </span>
                            </div>

                            {/* Total */}
                            <div className="border-t border-slate-200 pt-2 mt-2 flex items-center justify-between">
                                <span className="text-sm font-semibold text-slate-600">Total</span>
                                <span className="text-lg font-bold text-indigo-600">
                                    {Math.floor(totalTime / 60)}h {totalTime % 60}min
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Info adicional */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-50 rounded-lg p-3">
                            <div className="flex items-center gap-2 text-slate-500 mb-1">
                                <Calendar size={14} />
                                <span className="text-xs">Hora Inicio</span>
                            </div>
                            <span className="font-semibold text-slate-800">{hora_inicio}</span>
                        </div>

                        {wo.tecnico_nombre && (
                            <div className="bg-slate-50 rounded-lg p-3">
                                <div className="flex items-center gap-2 text-slate-500 mb-1">
                                    <User size={14} />
                                    <span className="text-xs">Técnico</span>
                                </div>
                                <span className="font-semibold text-slate-800">{wo.tecnico_nombre}</span>
                            </div>
                        )}
                    </div>

                    {wo.cliente_direccion && (
                        <div className="flex items-start gap-2 text-sm text-slate-600">
                            <MapPin size={16} className="flex-shrink-0 mt-0.5" />
                            <span>{wo.cliente_direccion}</span>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
                    {onUnassign && (
                        <button
                            onClick={() => onUnassign(wo.id)}
                            className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                            Desasignar
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
}

export default TaskDetailModal;
