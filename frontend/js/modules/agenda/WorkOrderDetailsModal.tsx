import React from 'react';
import { X, Clock, MapPin, User, Wrench, Calendar, AlertCircle, CheckCircle2, XCircle, Timer } from 'lucide-react';
import { WorkOrder, PRIORIDAD_BADGES, PRIORIDAD_COLORS, CONFIRMACION_CONFIG } from './types';

interface WorkOrderDetailsModalProps {
    wo: WorkOrder;
    isOpen: boolean;
    onClose: () => void;
}

/**
 * Modal con todos los detalles de una Work Order
 */
export function WorkOrderDetailsModal({ wo, isOpen, onClose }: WorkOrderDetailsModalProps) {
    if (!isOpen) return null;

    const colors = PRIORIDAD_COLORS[wo.prioridad];

    // Calcular tiempo total estimado
    const tiempoTotal = wo.tiempo_servicio_estimado +
        (wo.tiempo_viaje_ida_estimado || 0) +
        (wo.tiempo_viaje_vuelta_estimado || 0);

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

            {/* Modal */}
            <div
                className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header con color de prioridad */}
                <div className={`${colors.bg} ${colors.border} border-b-4 p-4`}>
                    <div className="flex items-start justify-between">
                        <div>
                            <span className="font-mono text-sm font-bold text-slate-600">
                                {wo.numero_wo}
                            </span>
                            <h2 className={`text-xl font-bold ${colors.text} mt-1`}>
                                {wo.cliente_nombre}
                            </h2>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${PRIORIDAD_BADGES[wo.prioridad]}`}>
                                {wo.prioridad === 'EMERGENCIA_COMODIN' ? '🔥 Emergencia' : wo.prioridad}
                            </span>
                            <button
                                onClick={onClose}
                                className="p-1.5 hover:bg-white/50 rounded-lg transition-colors"
                            >
                                <X size={20} className="text-slate-600" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="p-5 overflow-y-auto max-h-[60vh] space-y-5">
                    {/* Título y descripción */}
                    <div>
                        <h3 className="font-semibold text-slate-800 mb-1">{wo.titulo}</h3>
                        {wo.descripcion ? (
                            <p className="text-slate-600 text-sm leading-relaxed">{wo.descripcion}</p>
                        ) : (
                            <p className="text-slate-400 text-sm italic">Sin descripción adicional</p>
                        )}
                    </div>

                    {/* Dirección */}
                    {wo.cliente_direccion && (
                        <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                            <MapPin size={18} className="text-indigo-500 mt-0.5 flex-shrink-0" />
                            <div>
                                <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Dirección</span>
                                <p className="text-slate-700 text-sm">{wo.cliente_direccion}</p>
                            </div>
                        </div>
                    )}

                    {/* Tiempos */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
                            <Clock size={18} className="text-blue-600" />
                            <div>
                                <span className="text-xs font-medium text-blue-600 uppercase tracking-wide">Servicio</span>
                                <p className="text-blue-800 font-semibold">{wo.tiempo_servicio_estimado} min</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-lg">
                            <Timer size={18} className="text-emerald-600" />
                            <div>
                                <span className="text-xs font-medium text-emerald-600 uppercase tracking-wide">Tiempo Total</span>
                                <p className="text-emerald-800 font-semibold">{tiempoTotal} min</p>
                            </div>
                        </div>

                        {wo.tiempo_viaje_ida_estimado && (
                            <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
                                <span className="text-lg">🚗→</span>
                                <div>
                                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Viaje Ida</span>
                                    <p className="text-slate-700 font-semibold">{wo.tiempo_viaje_ida_estimado} min</p>
                                </div>
                            </div>
                        )}

                        {wo.tiempo_viaje_vuelta_estimado && (
                            <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
                                <span className="text-lg">←🚗</span>
                                <div>
                                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Viaje Vuelta</span>
                                    <p className="text-slate-700 font-semibold">{wo.tiempo_viaje_vuelta_estimado} min</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Equipo y Técnico */}
                    {(wo.equipo_nombre || wo.tecnico_nombre) && (
                        <div className="flex flex-wrap gap-3">
                            {wo.equipo_nombre && (
                                <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 rounded-lg">
                                    <Wrench size={16} className="text-amber-600" />
                                    <span className="text-amber-800 text-sm font-medium">{wo.equipo_nombre}</span>
                                </div>
                            )}
                            {wo.tecnico_nombre && (
                                <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 rounded-lg">
                                    <User size={16} className="text-indigo-600" />
                                    <span className="text-indigo-800 text-sm font-medium">{wo.tecnico_nombre}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Fecha programada */}
                    {wo.fecha_programada && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-purple-50 rounded-lg">
                            <Calendar size={16} className="text-purple-600" />
                            <div>
                                <span className="text-purple-800 text-sm font-medium">
                                    {new Date(wo.fecha_programada).toLocaleDateString('es-AR', {
                                        weekday: 'long',
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric'
                                    })}
                                </span>
                                {wo.hora_inicio && (
                                    <span className="text-purple-600 text-sm ml-2">a las {wo.hora_inicio}</span>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Estados de confirmación */}
                    {wo.estado === 'Asignada' && (wo.confirmacion_tecnico || wo.confirmacion_cliente) && (
                        <div className="border-t border-slate-200 pt-4">
                            <h4 className="text-sm font-semibold text-slate-700 mb-3">Estado de Confirmaciones</h4>
                            <div className="flex gap-3">
                                {wo.confirmacion_tecnico && (
                                    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${CONFIRMACION_CONFIG[wo.confirmacion_tecnico].bg}`}>
                                        <span>{CONFIRMACION_CONFIG[wo.confirmacion_tecnico].icon}</span>
                                        <div>
                                            <span className="text-xs text-slate-500">Técnico</span>
                                            <p className={`text-sm font-medium ${CONFIRMACION_CONFIG[wo.confirmacion_tecnico].text}`}>
                                                {CONFIRMACION_CONFIG[wo.confirmacion_tecnico].label}
                                            </p>
                                        </div>
                                    </div>
                                )}
                                {wo.confirmacion_cliente && (
                                    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${CONFIRMACION_CONFIG[wo.confirmacion_cliente].bg}`}>
                                        <span>{CONFIRMACION_CONFIG[wo.confirmacion_cliente].icon}</span>
                                        <div>
                                            <span className="text-xs text-slate-500">Cliente</span>
                                            <p className={`text-sm font-medium ${CONFIRMACION_CONFIG[wo.confirmacion_cliente].text}`}>
                                                {CONFIRMACION_CONFIG[wo.confirmacion_cliente].label}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t border-slate-200 p-4 bg-slate-50">
                    <div className="flex items-center justify-between">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium 
                            ${wo.estado === 'Bolsa_Trabajo' ? 'bg-slate-200 text-slate-700' :
                                wo.estado === 'Asignada' ? 'bg-blue-200 text-blue-800' :
                                    wo.estado === 'Confirmada_Cliente' ? 'bg-green-200 text-green-800' :
                                        wo.estado === 'En_Progreso' ? 'bg-amber-200 text-amber-800' :
                                            wo.estado === 'Completada' ? 'bg-emerald-200 text-emerald-800' :
                                                'bg-red-200 text-red-800'
                            }`}
                        >
                            {wo.estado.replace(/_/g, ' ')}
                        </span>
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-sm font-medium transition-colors"
                        >
                            Cerrar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default WorkOrderDetailsModal;
