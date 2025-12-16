import React, { useState, useCallback, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { SchedulerBoard } from './SchedulerBoard';
import { CreateWorkOrderModal } from './CreateWorkOrderModal';
import { WorkOrder, Tecnico, ScheduledTask } from './types';
import { mockTecnicos, mockBacklogWOs, mockScheduledTasks } from './mockData';
import api, {
    fetchBacklogWorkOrders,
    fetchTechnicians,
    fetchScheduledWorkOrders,
    assignWorkOrder,
    unassignWorkOrder,
    calculateTravelTime,
} from './api';
import { useDeleteWorkOrder } from './createWOHooks';

// Modo: 'mock' o 'live'
const DATA_MODE: 'mock' | 'live' = 'live';

/**
 * Convierte hora "HH:mm" a minutos desde medianoche
 */
function horaToMinutos(hora: string): number {
    const [h, m] = hora.split(':').map(Number);
    return h * 60 + m;
}

/**
 * Verifica si hay conflicto de horario para un técnico
 * Retorna la tarea con la que hay conflicto, o null si no hay
 */
function checkTimeConflict(
    tecnicoId: string,
    horaInicio: string,
    duracionTotal: number,
    scheduledTasks: ScheduledTask[]
): ScheduledTask | null {
    const nuevoInicio = horaToMinutos(horaInicio);
    const nuevoFin = nuevoInicio + duracionTotal;

    // Filtrar tareas del mismo técnico
    const tareasDelTecnico = scheduledTasks.filter(t => t.tecnico_id === tecnicoId);

    for (const tarea of tareasDelTecnico) {
        const tareaInicio = horaToMinutos(tarea.hora_inicio);
        const tareaDuracion = tarea.viaje_ida_min + tarea.servicio_min + tarea.viaje_vuelta_min;
        const tareaFin = tareaInicio + tareaDuracion;

        // Hay conflicto si los rangos se superponen
        if (nuevoInicio < tareaFin && nuevoFin > tareaInicio) {
            return tarea;
        }
    }

    return null;
}

/**
 * App wrapper para el Scheduler con estado y lógica
 */
function SchedulerApp() {
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [backlogWOs, setBacklogWOs] = useState<WorkOrder[]>([]);
    const [scheduledTasks, setScheduledTasks] = useState<ScheduledTask[]>([]);
    const [tecnicos, setTecnicos] = useState<Tecnico[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [successToast, setSuccessToast] = useState<string | null>(null);
    const [errorToast, setErrorToast] = useState<string | null>(null);

    // Estado para Undo de asignación
    const [undoData, setUndoData] = useState<{ wo: WorkOrder; woId: string; message: string } | null>(null);
    const undoTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

    // Hook para eliminar (Must be before conditional returns)
    const { deleteWorkOrder } = useDeleteWorkOrder();

    // ID del creador (debería venir de auth context)
    const creadorId = '0289360d-be14-445b-96a2-00503afbab76'; // Tu UUID

    // Cargar datos al iniciar
    useEffect(() => {
        loadData();
    }, [selectedDate]);

    const loadData = async () => {
        setIsLoading(true);
        setError(null);

        try {
            if (DATA_MODE === 'mock') {
                // Usar datos mock
                setBacklogWOs(mockBacklogWOs);
                setScheduledTasks(mockScheduledTasks);
                setTecnicos(mockTecnicos);
                console.log('[Scheduler] Loaded MOCK data');
            } else {
                // Cargar datos de Supabase
                console.log('[Scheduler] Loading data from Supabase...');

                const [backlog, techs, scheduled] = await Promise.all([
                    fetchBacklogWorkOrders().catch(err => {
                        console.warn('[Scheduler] Error loading backlog, using mock:', err);
                        return mockBacklogWOs;
                    }),
                    fetchTechnicians().catch(err => {
                        console.warn('[Scheduler] Error loading technicians, using mock:', err);
                        return mockTecnicos;
                    }),
                    fetchScheduledWorkOrders(selectedDate).catch(err => {
                        console.warn('[Scheduler] Error loading scheduled, using mock:', err);
                        return mockScheduledTasks;
                    }),
                ]);

                setBacklogWOs(backlog);
                setTecnicos(techs.length > 0 ? techs : mockTecnicos);
                setScheduledTasks(scheduled);

                console.log('[Scheduler] Loaded LIVE data:', {
                    backlog: backlog.length,
                    tecnicos: techs.length,
                    scheduled: scheduled.length,
                });
            }
        } catch (err) {
            console.error('[Scheduler] Error loading data:', err);
            setError(err instanceof Error ? err.message : 'Error cargando datos');
            // Fallback a mock
            setBacklogWOs(mockBacklogWOs);
            setScheduledTasks(mockScheduledTasks);
            setTecnicos(mockTecnicos);
        } finally {
            setIsLoading(false);
        }
    };

    // Manejar asignación de tarea
    const handleAssignTask = useCallback(async (woId: string, tecnicoId: string, horaInicio: string) => {
        // Encontrar la WO en el backlog
        const wo = backlogWOs.find(w => w.id === woId);
        if (!wo) {
            console.warn('[Scheduler] WO no encontrada en backlog:', woId);
            return;
        }

        // Encontrar el técnico
        const tecnico = tecnicos.find(t => t.id === tecnicoId);
        if (!tecnico) {
            console.warn('[Scheduler] Técnico no encontrado:', tecnicoId);
            return;
        }

        console.log(`[Scheduler] Asignando WO ${wo.numero_wo} a ${tecnico.nombre} a las ${horaInicio}`);

        // Tiempos provisionales mientras la API responde
        const tempViajeIdaMin = 30;
        const tempViajeVueltaMin = 25;
        const duracionTotalEstimada = tempViajeIdaMin + wo.tiempo_servicio_estimado + tempViajeVueltaMin;

        // ⚠️ Verificar si hay conflicto de horario
        const conflicto = checkTimeConflict(tecnicoId, horaInicio, duracionTotalEstimada, scheduledTasks);
        if (conflicto) {
            const mensaje = `⚠️ No se puede asignar: ${tecnico.nombre} ya tiene "${conflicto.wo.cliente_nombre}" a las ${conflicto.hora_inicio}`;
            console.warn('[Scheduler] Conflicto detectado:', mensaje);
            setErrorToast(mensaje);
            setTimeout(() => setErrorToast(null), 4000);
            return;
        }

        // ⏰ Verificar que la tarea termine antes del fin de jornada (18:00)
        const horaInicioMin = horaToMinutos(horaInicio);
        const horaFinTarea = horaInicioMin + duracionTotalEstimada;
        const finJornada = 18 * 60; // 18:00 = 1080 minutos

        if (horaFinTarea > finJornada) {
            const horaFinStr = `${Math.floor(horaFinTarea / 60)}:${(horaFinTarea % 60).toString().padStart(2, '0')}`;
            const mensaje = `⏰ La tarea terminaría a las ${horaFinStr}, después del fin de jornada (18:00)`;
            console.warn('[Scheduler] Excede horario laboral:', mensaje);
            setErrorToast(mensaje);
            setTimeout(() => setErrorToast(null), 4000);
            return;
        }

        // Crear tarea temporal para optimistic update
        const tempTask: ScheduledTask = {
            wo: {
                ...wo,
                estado: 'Asignada',
                tecnico_asignado_id: tecnicoId,
                tecnico_nombre: tecnico.nombre,
                hora_inicio: horaInicio,
            },
            tecnico_id: tecnicoId,
            hora_inicio: horaInicio,
            viaje_ida_min: tempViajeIdaMin,
            servicio_min: wo.tiempo_servicio_estimado,
            viaje_vuelta_min: tempViajeVueltaMin,
        };

        // Optimistic update: mostrar inmediatamente
        setScheduledTasks(prev => [...prev, tempTask]);
        setBacklogWOs(prev => prev.filter(w => w.id !== woId));
        console.log('[Scheduler] UI actualizada con tiempos provisionales');

        // Llamar a la API para persistir y obtener tiempos reales
        if (DATA_MODE === 'live') {
            const result = await assignWorkOrder(woId, tecnicoId, horaInicio, selectedDate);

            if (result.success && result.wo) {
                // ✅ Éxito: Actualizar con tiempos REALES de Distance Matrix
                console.log('[Scheduler] ✅ Tiempos reales recibidos:', {
                    viaje_ida: result.wo.tiempo_viaje_ida_estimado,
                    viaje_vuelta: result.wo.tiempo_viaje_vuelta_estimado,
                    distancia_km: result.wo.distancia_km,
                });

                if (result.warning) {
                    console.warn('[Scheduler] ⚠️ Warning:', result.warning);
                }

                // Actualizar la tarea con los tiempos reales del servidor
                setScheduledTasks(prev => prev.map(task =>
                    task.wo.id === woId
                        ? {
                            ...task,
                            viaje_ida_min: result.wo!.tiempo_viaje_ida_estimado || tempViajeIdaMin,
                            viaje_vuelta_min: result.wo!.tiempo_viaje_vuelta_estimado || tempViajeVueltaMin,
                            wo: {
                                ...task.wo,
                                tiempo_viaje_ida_estimado: result.wo!.tiempo_viaje_ida_estimado,
                                tiempo_viaje_vuelta_estimado: result.wo!.tiempo_viaje_vuelta_estimado,
                            },
                        }
                        : task
                ));

                // ↩️ Configurar datos para Undo (5 segundos para deshacer)
                if (undoTimeoutRef.current) {
                    clearTimeout(undoTimeoutRef.current);
                }

                // ⚠️ Warning si el viaje de ida es significativo (>15 min)
                const viajeRealIda = result.wo!.tiempo_viaje_ida_estimado || tempViajeIdaMin;
                if (viajeRealIda > 15) {
                    const horaInicioMin = horaToMinutos(horaInicio);
                    const horaLlegada = horaInicioMin + viajeRealIda;
                    const horaLlegadaStr = `${Math.floor(horaLlegada / 60)}:${(horaLlegada % 60).toString().padStart(2, '0')}`;
                    setUndoData({
                        wo: wo,
                        woId: woId,
                        message: `✅ ${wo.numero_wo} → El técnico llegará a las ${horaLlegadaStr} (${viajeRealIda} min de viaje)`,
                    });
                } else {
                    setUndoData({
                        wo: wo,
                        woId: woId,
                        message: `✅ ${wo.numero_wo} asignada a ${tecnico.nombre}`,
                    });
                }

                undoTimeoutRef.current = setTimeout(() => {
                    setUndoData(null);
                }, 5000);

            } else {
                // Error pero NO revertimos - dejamos la UI como está
                console.error('[Scheduler] ⚠️ Error en API (UI mantiene cambio):', result.error);
            }
        }
    }, [backlogWOs, tecnicos, selectedDate, scheduledTasks]);

    // Manejar desasignación de tarea
    const handleUnassignTask = useCallback(async (woId: string) => {
        const task = scheduledTasks.find(t => t.wo.id === woId);
        if (!task) return;

        console.log(`[Scheduler] Desasignando WO ${task.wo.numero_wo}`);

        // Devolver la WO al backlog
        const wo: WorkOrder = {
            ...task.wo,
            estado: 'Bolsa_Trabajo',
            tecnico_asignado_id: undefined,
            tecnico_nombre: undefined,
            hora_inicio: undefined,
        };

        // Actualizar localmente primero
        setBacklogWOs(prev => [...prev, wo]);
        setScheduledTasks(prev => prev.filter(t => t.wo.id !== woId));

        // Persistir en Supabase
        if (DATA_MODE === 'live') {
            const result = await unassignWorkOrder(woId);
            if (!result.success) {
                console.error('[Scheduler] Error persisting unassignment:', result.error);
            }
        }
    }, [scheduledTasks]);

    // Refresh
    const handleRefresh = useCallback(() => {
        console.log('[Scheduler] Refrescando datos...');
        loadData();
    }, [selectedDate]);

    // ↩️ Deshacer última asignación
    const handleUndo = useCallback(() => {
        if (!undoData) return;

        console.log('[Scheduler] ↩️ Deshaciendo asignación:', undoData.wo.numero_wo);

        // Limpiar timeout y datos de undo
        if (undoTimeoutRef.current) {
            clearTimeout(undoTimeoutRef.current);
        }

        // Desasignar la WO
        handleUnassignTask(undoData.woId);
        setUndoData(null);
    }, [undoData, handleUnassignTask]);

    // Loading state
    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-100">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-600 font-medium">Cargando Scheduler...</p>
                </div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-100">
                <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-3xl">⚠️</span>
                    </div>
                    <h2 className="text-xl font-bold text-slate-800 mb-2">Error de Conexión</h2>
                    <p className="text-slate-600 mb-4">{error}</p>
                    <button
                        onClick={loadData}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                        Reintentar
                    </button>
                </div>
            </div>
        );
    }

    // Handler para éxito de creación
    const handleWOCreated = (numeroWO: string) => {
        setSuccessToast(`✅ ${numeroWO} creada exitosamente`);
        loadData(); // Refrescar lista
        setTimeout(() => setSuccessToast(null), 4000);
    };

    // Handler para eliminar WO
    const handleDeleteWO = async (woId: string) => {
        console.log('Attempting to delete WO id:', woId);
        const result = await deleteWorkOrder(woId);
        console.log('Delete result:', result);
        if (result.success) {
            console.log('Delete succeeded');
            setSuccessToast(`🗑️ WO eliminada`);
            // Optimistic removing locally
            setBacklogWOs(prev => prev.filter(w => w.id !== woId));
            // Reload to be sure
            loadData(); // Refrescar lista
            setTimeout(() => setSuccessToast(null), 3000);
        } else {
            console.error('Delete failed:', result.error);
            setSuccessToast(`❌ Error: ${result.error}`);
            setTimeout(() => setSuccessToast(null), 8000);
        }
    };

    return (
        <>
            <SchedulerBoard
                backlogWorkOrders={backlogWOs}
                tecnicos={tecnicos}
                scheduledTasks={scheduledTasks}
                selectedDate={selectedDate}
                onDateChange={setSelectedDate}
                onAssignTask={handleAssignTask}
                onUnassignTask={handleUnassignTask}
                onRefresh={handleRefresh}
                onCreateWO={() => setIsCreateModalOpen(true)}
                onDeleteWO={handleDeleteWO}
            />

            {/* Modal de Creación de WO */}
            <CreateWorkOrderModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSuccess={handleWOCreated}
                creadorId={creadorId}
            />

            {/* Toast de éxito */}
            {successToast && (
                <div className="fixed bottom-6 right-6 z-50 px-6 py-3 bg-green-600 text-white rounded-xl shadow-lg flex items-center gap-3 animate-slide-up">
                    <span className="font-medium">{successToast}</span>
                </div>
            )}

            {/* Toast de error */}
            {errorToast && (
                <div className="fixed bottom-6 right-6 z-50 px-6 py-3 bg-red-600 text-white rounded-xl shadow-lg flex items-center gap-3 animate-slide-up">
                    <span className="font-medium">{errorToast}</span>
                </div>
            )}

            {/* Toast de Undo (asignación exitosa con botón deshacer) */}
            {undoData && (
                <div className="fixed bottom-6 right-6 z-50 px-5 py-3 bg-indigo-600 text-white rounded-xl shadow-lg flex items-center gap-4 animate-slide-up">
                    <span className="font-medium">{undoData.message}</span>
                    <button
                        onClick={handleUndo}
                        className="px-3 py-1 bg-white text-indigo-600 rounded-lg text-sm font-semibold hover:bg-indigo-100 transition-colors"
                    >
                        ↩️ Deshacer
                    </button>
                </div>
            )}
        </>
    );
}

/**
 * Función para montar el Scheduler en un elemento del DOM
 */
export function mountScheduler(containerId: string = 'scheduler-root') {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`[Scheduler] Container #${containerId} not found`);
        return;
    }

    const root = createRoot(container);
    root.render(<SchedulerApp />);

    console.log('[Scheduler] Mounted successfully');
}

// Auto-mount disabled - handled by main.js lazy loading
// if (typeof document !== 'undefined') {
//     const container = document.getElementById('scheduler-root');
//     if (container) {
//         mountScheduler();
//     }
// }

export default SchedulerApp;
