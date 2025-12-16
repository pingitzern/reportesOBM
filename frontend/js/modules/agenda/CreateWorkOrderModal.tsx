/**
 * Modal para crear nuevas Work Orders
 * 
 * Features:
 * - Autocomplete de clientes
 * - Google Places para direcciones nuevas
 * - Selección cascada de servicios
 * - Validación del comodín de emergencia
 * - Formulario con react-hook-form + zod
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { X, Search, MapPin, Clock, AlertTriangle, Loader2, CheckCircle, Building2 } from 'lucide-react';
import {
    createWOSchema,
    CreateWOFormData,
    TIPO_TAREA_LABELS,
    PRIORIDAD_CONFIG,
    Client
} from './createWOTypes';
import {
    useClientSearch,
    useCatalogoServicios,
    useComodinValidation,
    useCreateWorkOrder,
    usePlacesAutocomplete,
    useClientEquipments,
} from './createWOHooks';

interface CreateWorkOrderModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (numeroWO: string) => void;
    creadorId: string;
}

export function CreateWorkOrderModal({ isOpen, onClose, onSuccess, creadorId }: CreateWorkOrderModalProps) {
    // Estado local
    const [clientSearchQuery, setClientSearchQuery] = useState('');
    const [showClientDropdown, setShowClientDropdown] = useState(false);
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [showAddressInput, setShowAddressInput] = useState(false);
    const [addressQuery, setAddressQuery] = useState('');
    const [showAddressDropdown, setShowAddressDropdown] = useState(false);
    const [comodinError, setComodinError] = useState<string | null>(null);

    // Hooks
    const { clients, searchClients, isLoading: isSearchingClients } = useClientSearch();
    const { sistemas, servicios, getServiciosBySistema, getDuracionEstimada, isLoading: isLoadingCatalogo } = useCatalogoServicios();
    const { usosRestantes, validateComodin, isValidating } = useComodinValidation(creadorId);
    const { createWorkOrder, isCreating, error: creationError } = useCreateWorkOrder();
    const { suggestions: placeSuggestions, searchPlaces, getPlaceDetails, isLoading: isSearchingPlaces } = usePlacesAutocomplete();
    const { equipments: clientEquipments, loadClientEquipments, getClientSistemas } = useClientEquipments();

    // Formulario
    const {
        register,
        handleSubmit,
        control,
        watch,
        setValue,
        reset,
        formState: { errors, isValid },
    } = useForm<CreateWOFormData>({
        resolver: zodResolver(createWOSchema),
        mode: 'onChange',
        defaultValues: {
            prioridad: 'Media',
            tiempo_servicio_estimado: 60,
            titulo: '',
            descripcion: '',
        },
    });

    const selectedPrioridad = watch('prioridad');
    const selectedSistemaId = watch('sistema_id');
    const selectedCatalogoId = watch('catalogo_servicio_id');

    // Efectos
    useEffect(() => {
        if (clientSearchQuery.length >= 2) {
            searchClients(clientSearchQuery);
            setShowClientDropdown(true);
        } else {
            setShowClientDropdown(false);
        }
    }, [clientSearchQuery, searchClients]);

    useEffect(() => {
        if (addressQuery.length >= 3) {
            searchPlaces(addressQuery);
            setShowAddressDropdown(true);
        } else {
            setShowAddressDropdown(false);
        }
    }, [addressQuery, searchPlaces]);

    // Auto-llenar duración cuando se selecciona un servicio
    useEffect(() => {
        if (selectedCatalogoId) {
            const duracion = getDuracionEstimada(selectedCatalogoId);
            setValue('tiempo_servicio_estimado', duracion);
        }
    }, [selectedCatalogoId, getDuracionEstimada, setValue]);

    // Validar comodín cuando se selecciona EMERGENCIA
    useEffect(() => {
        if (selectedPrioridad === 'EMERGENCIA_COMODIN') {
            validateComodin().then(canUse => {
                if (!canUse) {
                    setComodinError('Has agotado tus 3 usos de emergencia este mes. Selecciona "Alta" en su lugar.');
                    setValue('prioridad', 'Alta');
                } else {
                    setComodinError(null);
                }
            });
        } else {
            setComodinError(null);
        }
    }, [selectedPrioridad, validateComodin, setValue]);

    // Handlers
    const handleClientSelect = useCallback((client: Client) => {
        setSelectedClient(client);
        setClientSearchQuery(client.razon_social);
        setValue('cliente_id', client.id);
        setValue('cliente_nombre', client.razon_social);
        setValue('direccion', client.direccion);
        setValue('lat', client.lat || undefined);
        setValue('lng', client.lng || undefined);
        setShowClientDropdown(false);

        // Auto-generar título
        setValue('titulo', `Servicio para ${client.razon_social}`);

        // Cargar equipos del cliente para filtrar sistemas
        loadClientEquipments(client.id);
    }, [setValue, loadClientEquipments]);

    const handlePlaceSelect = useCallback(async (placeId: string, description: string) => {
        const details = await getPlaceDetails(placeId);
        if (details) {
            setAddressQuery(details.address);
            setValue('direccion', details.address);
            setValue('lat', details.lat);
            setValue('lng', details.lng);
        }
        setShowAddressDropdown(false);
    }, [getPlaceDetails, setValue]);

    const onSubmit = async (data: CreateWOFormData) => {
        console.log('[CreateWOModal] onSubmit llamado con:', data);
        // Validar si el ID del catálogo es un UUID válido (los hardcodeados como 'MP' o 'INSTA' no lo son)
        const isUUID = (str?: string | null) => str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

        const catalogoIdReal = isUUID(data.catalogo_servicio_id) ? data.catalogo_servicio_id : undefined;

        const result = await createWorkOrder({
            cliente_id: data.cliente_id,
            catalogo_servicio_id: catalogoIdReal,
            titulo: data.titulo,
            descripcion: data.descripcion,
            prioridad: data.prioridad,
            tiempo_servicio_estimado: data.tiempo_servicio_estimado,
            notas_internas: data.notas_internas,
            creador_id: creadorId,
        });

        if (result.success && result.wo) {
            onSuccess(result.wo.numero_wo);
            handleClose();
        } else {
            // El error ya se setea en el hook, pero podriamos hacer un toast o alert
            console.error('Error creando WO:', result.error);
        }
    };

    const handleClose = () => {
        reset();
        setSelectedClient(null);
        setClientSearchQuery('');
        setAddressQuery('');
        setShowAddressInput(false);
        setComodinError(null);
        onClose();
    };

    if (!isOpen) return null;

    // Servicios principales para Ablandador y Osmosis
    const SERVICIOS_PRINCIPALES = [
        { id: 'INSTA', tipo_tarea: 'INSTA', descripcion: 'Instalación', duracion_estimada_min: 120 },
        { id: 'MP', tipo_tarea: 'MP', descripcion: 'Mantenimiento Preventivo', duracion_estimada_min: 60 },
        { id: 'REV', tipo_tarea: 'REV', descripcion: 'Revisión', duracion_estimada_min: 45 },
        { id: 'REL', tipo_tarea: 'REL', descripcion: 'Relevamiento', duracion_estimada_min: 30 },
    ];

    // Determinar categoría del sistema seleccionado
    const sistemaSeleccionado = clientEquipments.find(eq => eq.sistema_id === selectedSistemaId);
    const categoriaSeleccionada = sistemaSeleccionado?.sistema_categoria?.toLowerCase() || '';

    // Si es ablandador u osmosis, mostrar servicios principales
    // Para el resto, mostrar todos los servicios de la BD
    const esEquipoAguas = categoriaSeleccionada === 'ablandador' || categoriaSeleccionada === 'osmosis';
    const serviciosFiltrados = esEquipoAguas ? SERVICIOS_PRINCIPALES : servicios;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={handleClose}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-indigo-600 to-purple-600">
                    <div>
                        <h2 className="text-xl font-bold text-white">Nueva Orden de Trabajo</h2>
                        <p className="text-indigo-200 text-sm">Completa los datos para crear una nueva WO</p>
                    </div>
                    <button
                        onClick={handleClose}
                        className="p-2 rounded-lg hover:bg-white/20 transition-colors"
                    >
                        <X className="w-5 h-5 text-white" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit(onSubmit, (formErrors) => {
                    console.error('[CreateWOModal] Errores de validación:', formErrors);
                    alert('Error de validación: ' + Object.keys(formErrors).map(k => `${k}: ${(formErrors as any)[k]?.message}`).join(', '));
                })} className="p-4 overflow-y-auto max-h-[calc(90vh-120px)]">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                        {/* === COLUMNA IZQUIERDA === */}
                        <div className="space-y-3">

                            {/* Cliente */}
                            <div className="relative">
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    <Building2 className="w-4 h-4 inline mr-1" />
                                    Cliente *
                                </label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="text"
                                        value={clientSearchQuery}
                                        onChange={(e) => setClientSearchQuery(e.target.value)}
                                        placeholder="Buscar cliente..."
                                        className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    />
                                    {isSearchingClients && (
                                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />
                                    )}
                                </div>

                                {/* Dropdown de clientes */}
                                {showClientDropdown && clients.length > 0 && (
                                    <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                        {clients.map(client => (
                                            <button
                                                key={client.id}
                                                type="button"
                                                onClick={() => handleClientSelect(client)}
                                                className="w-full px-4 py-2 text-left hover:bg-indigo-50 transition-colors"
                                            >
                                                <div className="font-medium text-slate-800">{client.razon_social}</div>
                                                <div className="text-xs text-slate-500 truncate">{client.direccion}</div>
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {errors.cliente_id && (
                                    <p className="mt-1 text-xs text-red-500">{errors.cliente_id.message}</p>
                                )}
                            </div>

                            {/* Cliente seleccionado */}
                            {selectedClient && (
                                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                                    <div className="flex items-start gap-2">
                                        <MapPin className="w-4 h-4 text-slate-400 mt-0.5" />
                                        <div className="flex-1">
                                            <p className="text-sm text-slate-600">{selectedClient.direccion}</p>
                                            {selectedClient.lat && selectedClient.lng ? (
                                                <p className="text-xs text-green-600 mt-1">✓ Coordenadas disponibles</p>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => setShowAddressInput(true)}
                                                    className="text-xs text-indigo-600 hover:underline mt-1"
                                                >
                                                    + Agregar coordenadas precisas
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Input de dirección con Google Places */}
                            {showAddressInput && (
                                <div className="relative">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        <MapPin className="w-4 h-4 inline mr-1" />
                                        Dirección precisa
                                    </label>
                                    <input
                                        type="text"
                                        value={addressQuery}
                                        onChange={(e) => setAddressQuery(e.target.value)}
                                        placeholder="Buscar dirección..."
                                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                    />

                                    {showAddressDropdown && placeSuggestions.length > 0 && (
                                        <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                            {placeSuggestions.map(suggestion => (
                                                <button
                                                    key={suggestion.place_id}
                                                    type="button"
                                                    onClick={() => handlePlaceSelect(suggestion.place_id, suggestion.description)}
                                                    className="w-full px-4 py-2 text-left hover:bg-indigo-50 text-sm"
                                                >
                                                    {suggestion.description}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Título */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Título de la WO *
                                </label>
                                <input
                                    {...register('titulo')}
                                    placeholder="Ej: Mantenimiento preventivo osmosis"
                                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                />
                                {errors.titulo && (
                                    <p className="mt-1 text-xs text-red-500">{errors.titulo.message}</p>
                                )}
                            </div>

                            {/* Descripción */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Descripción
                                </label>
                                <textarea
                                    {...register('descripcion')}
                                    rows={2}
                                    placeholder="Detalles adicionales del servicio..."
                                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 resize-none"
                                />
                            </div>
                        </div>

                        {/* === COLUMNA DERECHA === */}
                        <div className="space-y-3">

                            {/* Sistema / Equipo */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Tipo de Equipo
                                    {selectedClient && clientEquipments.length > 0 && (
                                        <span className="text-xs text-green-600 ml-2">
                                            ({clientEquipments.length} equipo{clientEquipments.length !== 1 ? 's' : ''} del cliente)
                                        </span>
                                    )}
                                </label>
                                <Controller
                                    name="sistema_id"
                                    control={control}
                                    render={({ field }) => {
                                        // Si hay cliente seleccionado, mostrar solo sus sistemas
                                        const clientSistemas = selectedClient ? getClientSistemas() : [];
                                        const sistemasToShow = clientSistemas.length > 0 ? clientSistemas : sistemas;

                                        return (
                                            <select
                                                {...field}
                                                value={field.value || ''}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
                                            >
                                                <option value="">
                                                    {selectedClient && clientSistemas.length === 0
                                                        ? 'Sin equipos registrados'
                                                        : 'Todos los tipos'}
                                                </option>
                                                {sistemasToShow.map(sistema => (
                                                    <option key={sistema.id} value={sistema.id}>
                                                        {sistema.nombre}
                                                    </option>
                                                ))}
                                            </select>
                                        );
                                    }}
                                />
                            </div>

                            {/* Tipo de Tarea */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Tipo de Servicio
                                </label>
                                <Controller
                                    name="catalogo_servicio_id"
                                    control={control}
                                    render={({ field }) => (
                                        <select
                                            {...field}
                                            value={field.value || ''}
                                            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
                                        >
                                            <option value="">Seleccionar servicio...</option>
                                            {serviciosFiltrados.map(servicio => (
                                                <option key={servicio.id} value={servicio.id}>
                                                    {servicio.descripcion} ({servicio.duracion_estimada_min} min)
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                />
                                {errors.catalogo_servicio_id && (
                                    <p className="mt-1 text-xs text-red-500">{errors.catalogo_servicio_id.message}</p>
                                )}
                            </div>

                            {/* Duración Estimada */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    <Clock className="w-4 h-4 inline mr-1" />
                                    Duración Estimada (minutos) *
                                </label>
                                <input
                                    type="number"
                                    {...register('tiempo_servicio_estimado', { valueAsNumber: true })}
                                    min={15}
                                    max={480}
                                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                />
                                {errors.tiempo_servicio_estimado && (
                                    <p className="mt-1 text-xs text-red-500">{errors.tiempo_servicio_estimado.message}</p>
                                )}
                            </div>

                            {/* Prioridad */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Prioridad *
                                </label>
                                <Controller
                                    name="prioridad"
                                    control={control}
                                    render={({ field }) => (
                                        <div className="grid grid-cols-2 gap-2">
                                            {Object.entries(PRIORIDAD_CONFIG).map(([key, config]) => (
                                                <button
                                                    key={key}
                                                    type="button"
                                                    onClick={() => field.onChange(key)}
                                                    className={`px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all ${field.value === key
                                                        ? `${config.color} border-current ring-2 ring-offset-1`
                                                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                                                        }`}
                                                >
                                                    {config.icon} {key === 'EMERGENCIA_COMODIN' ? 'Emergencia' : key}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                />

                                {/* Warning de comodín */}
                                {selectedPrioridad === 'EMERGENCIA_COMODIN' && !comodinError && (
                                    <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                                        <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5" />
                                        <p className="text-xs text-amber-700">
                                            Te quedan <strong>{usosRestantes}</strong> usos de emergencia este mes
                                        </p>
                                    </div>
                                )}

                                {comodinError && (
                                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                                        <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5" />
                                        <p className="text-xs text-red-700">{comodinError}</p>
                                    </div>
                                )}
                            </div>

                            {/* Notas Internas */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Notas Internas
                                </label>
                                <textarea
                                    {...register('notas_internas')}
                                    rows={2}
                                    placeholder="Notas solo visibles para el equipo..."
                                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 resize-none text-sm"
                                />
                            </div>

                            {/* Mensaje de Error General */}
                            {creationError && (
                                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 animate-pulse">
                                    <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-medium text-red-800">Error al crear la orden</p>
                                        <p className="text-xs text-red-600">{creationError}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-end gap-3 mt-4 pt-3 border-t border-slate-200">
                        <button
                            type="button"
                            onClick={handleClose}
                            className="px-5 py-2.5 text-slate-600 hover:text-slate-800 font-medium transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isCreating || !selectedClient}
                            className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium rounded-lg hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                        >
                            {isCreating ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Creando...
                                </>
                            ) : (
                                <>
                                    <CheckCircle className="w-4 h-4" />
                                    Crear Work Order
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default CreateWorkOrderModal;
