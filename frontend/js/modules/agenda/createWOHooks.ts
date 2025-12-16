/**
 * Hooks para el formulario de creación de Work Orders
 */

import { useState, useEffect, useCallback } from 'react';
import type { Client, Sistema, CatalogoServicio } from './createWOTypes';
import { getSupabase } from './api';

// Usar el singleton de Supabase para tener la sesión del usuario
const supabase = getSupabase();

// =====================================================
// Hook: Búsqueda de Clientes
// =====================================================

// Función para normalizar texto (quitar acentos)
function normalizeText(text: string): string {
    return text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}

export function useClientSearch() {
    const [clients, setClients] = useState<Client[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const searchClients = useCallback(async (query: string) => {
        console.log('[useClientSearch] Buscando:', query);

        if (!query || query.length < 2) {
            setClients([]);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            // Usar ilike de Supabase directamente - funciona con acentos en PostgreSQL
            const { data, error: dbError } = await supabase
                .from('clients')
                .select('id, razon_social, direccion, lat, lng, telefono, email')
                .ilike('razon_social', `%${query}%`)
                .order('razon_social')
                .limit(20);

            console.log('[useClientSearch] Resultado:', { total: data?.length, dbError });

            if (dbError) throw dbError;

            setClients(data || []);
            console.log('[useClientSearch] Clientes encontrados:', data?.length || 0, data?.map(c => c.razon_social));
        } catch (err) {
            console.error('[useClientSearch] Error:', err);
            setError(err instanceof Error ? err.message : 'Error buscando clientes');
            setClients([]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    return { clients, searchClients, isLoading, error };
}

// =====================================================
// Hook: Catálogo de Servicios
// =====================================================

export function useCatalogoServicios() {
    const [sistemas, setSistemas] = useState<Sistema[]>([]);
    const [servicios, setServicios] = useState<CatalogoServicio[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadCatalogo();
    }, []);

    const loadCatalogo = async () => {
        setIsLoading(true);
        console.log('[useCatalogoServicios] Cargando catálogo...');
        try {
            // Cargar sistemas
            const { data: sistemasData, error: sistemasError } = await supabase
                .from('sistemas')
                .select('id, nombre, descripcion')
                .order('nombre');

            console.log('[useCatalogoServicios] Sistemas:', { data: sistemasData, error: sistemasError });

            // Cargar catálogo de servicios
            const { data: serviciosData, error: serviciosError } = await supabase
                .from('catalogo_servicios')
                .select('id, sistema_id, tipo_tarea, duracion_estimada_min, descripcion, requiere_habilidades')
                .eq('activo', true)
                .order('tipo_tarea');

            console.log('[useCatalogoServicios] Servicios:', { data: serviciosData, error: serviciosError });

            setSistemas(sistemasData || []);
            setServicios(serviciosData || []);
        } catch (err) {
            console.error('[useCatalogoServicios] Error:', err);
        } finally {
            setIsLoading(false);
        }
    };

    // Obtener servicios filtrados por sistema
    const getServiciosBySistema = useCallback((sistemaId: string | null) => {
        if (!sistemaId) return servicios;
        return servicios.filter(s => s.sistema_id === sistemaId);
    }, [servicios]);

    // Obtener duración estimada de un servicio
    const getDuracionEstimada = useCallback((servicioId: string) => {
        const servicio = servicios.find(s => s.id === servicioId);
        return servicio?.duracion_estimada_min || 60;
    }, [servicios]);

    return { sistemas, servicios, getServiciosBySistema, getDuracionEstimada, isLoading };
}

// =====================================================
// Hook: Equipos del Cliente
// =====================================================

interface ClientEquipment {
    equipo_id: string;
    serie: string;
    modelo: string;
    tag_id: string;
    sistema_id: string;
    sistema_nombre: string;
    sistema_codigo: string;
    sistema_categoria: string;
}

export function useClientEquipments() {
    const [equipments, setEquipments] = useState<ClientEquipment[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const loadClientEquipments = useCallback(async (clientId: string | null) => {
        if (!clientId) {
            setEquipments([]);
            return;
        }

        setIsLoading(true);
        console.log('[useClientEquipments] Cargando equipos para cliente:', clientId);

        try {
            // Usar la función RPC que ya existe
            const { data, error } = await supabase
                .rpc('get_equipos_cliente', { p_client_id: clientId });

            console.log('[useClientEquipments] Resultado:', { data, error });

            if (error) {
                // Si la RPC falla, intenta query directa
                console.log('[useClientEquipments] RPC falló, intentando query directa...');
                const { data: directData, error: directError } = await supabase
                    .from('equipments')
                    .select(`
                        id,
                        serial_number,
                        modelo,
                        tag_id,
                        sistema_id,
                        sistemas(id, nombre, codigo, categoria)
                    `)
                    .eq('client_id', clientId)
                    .eq('activo', true);

                console.log('[useClientEquipments] Query directa:', { directData, directError });

                if (directError) throw directError;

                // Mapear al formato esperado
                const mapped = (directData || []).map((e: any) => ({
                    equipo_id: e.id,
                    serie: e.serial_number,
                    modelo: e.modelo,
                    tag_id: e.tag_id,
                    sistema_id: e.sistema_id,
                    sistema_nombre: e.sistemas?.nombre || 'Sin sistema',
                    sistema_codigo: e.sistemas?.codigo || '',
                    sistema_categoria: e.sistemas?.categoria || '',
                }));
                setEquipments(mapped);
            } else {
                setEquipments(data || []);
            }
        } catch (err) {
            console.error('[useClientEquipments] Error:', err);
            setEquipments([]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Obtener sistemas únicos de los equipos del cliente
    const getClientSistemas = useCallback(() => {
        const sistemasMap = new Map<string, { id: string; nombre: string; categoria: string }>();
        equipments.forEach(eq => {
            if (eq.sistema_id && !sistemasMap.has(eq.sistema_id)) {
                sistemasMap.set(eq.sistema_id, {
                    id: eq.sistema_id,
                    nombre: eq.sistema_nombre,
                    categoria: eq.sistema_categoria,
                });
            }
        });
        return Array.from(sistemasMap.values());
    }, [equipments]);

    return { equipments, loadClientEquipments, getClientSistemas, isLoading };
}

// =====================================================
// Hook: Validación del Comodín
// =====================================================

export function useComodinValidation(userId: string | null) {
    const [usosRestantes, setUsosRestantes] = useState<number>(3);
    const [isValidating, setIsValidating] = useState(false);
    const [validated, setValidated] = useState(false);

    const validateComodin = useCallback(async () => {
        if (!userId) {
            setUsosRestantes(0);
            return false;
        }

        setIsValidating(true);
        try {
            const { data, error } = await supabase
                .rpc('obtener_usos_comodin_restantes', { p_usuario_id: userId });

            if (error) throw error;

            const restantes = typeof data === 'number' ? data : 3;
            setUsosRestantes(restantes);
            setValidated(true);
            return restantes > 0;
        } catch (err) {
            console.error('[useComodinValidation] Error:', err);
            setUsosRestantes(0);
            return false;
        } finally {
            setIsValidating(false);
        }
    }, [userId]);

    return { usosRestantes, validateComodin, isValidating, validated };
}

// =====================================================
// Hook: Crear Work Order
// =====================================================

export interface CreateWOPayload {
    cliente_id: string;
    catalogo_servicio_id?: string;
    titulo: string;
    descripcion?: string;
    prioridad: 'Baja' | 'Media' | 'Alta' | 'EMERGENCIA_COMODIN';
    tiempo_servicio_estimado?: number;
    notas_internas?: string;
    creador_id: string;
}

export function useCreateWorkOrder() {
    const [isCreating, setIsCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const createWorkOrder = useCallback(async (payload: CreateWOPayload) => {
        setIsCreating(true);
        setError(null);

        try {
            const { data, error: funcError } = await supabase.functions.invoke('work-orders', {
                body: {
                    action: 'create',
                    ...payload,
                },
            });

            if (funcError) {
                console.error('[useCreateWorkOrder] funcError:', funcError);
                // Intenta extraer el mensaje de error del body si existe
                let errorMsg = funcError.message || 'Error invocando Edge Function';

                if (funcError instanceof Error && 'context' in funcError) {
                    try {
                        // @ts-ignore - access safe internal property
                        const body = await funcError.context.json();
                        if (body && body.error) {
                            errorMsg = body.error;
                            if (body.details) {
                                console.error('[useCreateWorkOrder] Detalles del error:', body.details);
                            }
                        }
                    } catch (ignore) { /* Body no es JSON */ }
                }

                throw new Error(errorMsg);
            }

            if (!data.success) {
                throw new Error(data.error || 'Error creando Work Order');
            }

            console.log('[useCreateWorkOrder] ✅ WO creada:', data.wo);
            return { success: true, wo: data.wo };

        } catch (err: any) {
            const message = err.message || 'Error desconocido';
            console.error('[useCreateWorkOrder] Error catch:', err);
            setError(message);
            return { success: false, error: message };
        } finally {
            setIsCreating(false);
        }
    }, []);

    return { createWorkOrder, isCreating, error };
}

// =====================================================
// Hook: Eliminar Work Order
// =====================================================

export function useDeleteWorkOrder() {
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    const deleteWorkOrder = useCallback(async (woId: string) => {
        setIsDeleting(true);
        setDeleteError(null);

        try {
            console.log('[useDeleteWorkOrder] Initiating delete for WO id:', woId);
            const { data, error: funcError } = await supabase.functions.invoke('work-orders', {
                body: {
                    action: 'delete',
                    wo_id: woId,
                },
            });
            console.log('[useDeleteWorkOrder] Received response:', { data, funcError });

            if (funcError) {
                console.error('[useDeleteWorkOrder] funcError:', funcError);
                let errorMsg = funcError.message || 'Error invoking Edge Function';
                if (funcError instanceof Error && 'context' in funcError) {
                    try {
                        // @ts-ignore - access safe internal property
                        const body = await funcError.context.json();
                        if (body && body.error) errorMsg = body.error;
                    } catch (e) {
                        // Try reading as text
                        try {
                            // @ts-ignore
                            const text = await funcError.context.text();
                            console.error('[useDeleteWorkOrder] Error body text:', text);
                            if (text) errorMsg += `: ${text}`;
                        } catch (ignore) { }
                    }
                }
                throw new Error(errorMsg);
            }

            if (!data.success) {
                throw new Error(data.error || 'Error deleting Work Order');
            }

            console.log('[useDeleteWorkOrder] ✅ WO deleted:', woId);
            return { success: true };

        } catch (err: any) {
            const message = err.message || 'Error desconocido';
            console.error('[useDeleteWorkOrder] Error catch:', err);
            setDeleteError(message);
            return { success: false, error: message };
        } finally {
            setIsDeleting(false);
        }
    }, []);

    return { deleteWorkOrder, isDeleting, deleteError };
}

// =====================================================
// Hook: Google Places Autocomplete (simplificado)
// =====================================================

export function usePlacesAutocomplete() {
    const [suggestions, setSuggestions] = useState<google.maps.places.AutocompletePrediction[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const searchPlaces = useCallback(async (input: string) => {
        if (!input || input.length < 3) {
            setSuggestions([]);
            return;
        }

        // Verificar si la API de Google Maps está cargada
        if (!window.google?.maps?.places) {
            console.warn('[usePlacesAutocomplete] Google Maps API not loaded');
            return;
        }

        setIsLoading(true);
        try {
            const service = new google.maps.places.AutocompleteService();
            const response = await service.getPlacePredictions({
                input,
                componentRestrictions: { country: 'ar' },
                types: ['address'],
            });
            setSuggestions(response?.predictions || []);
        } catch (err) {
            console.error('[usePlacesAutocomplete] Error:', err);
            setSuggestions([]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const getPlaceDetails = useCallback(async (placeId: string): Promise<{ lat: number; lng: number; address: string } | null> => {
        if (!window.google?.maps?.places) return null;

        return new Promise((resolve) => {
            const service = new google.maps.places.PlacesService(document.createElement('div'));
            service.getDetails(
                { placeId, fields: ['geometry', 'formatted_address'] },
                (place, status) => {
                    if (status === google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
                        resolve({
                            lat: place.geometry.location.lat(),
                            lng: place.geometry.location.lng(),
                            address: place.formatted_address || '',
                        });
                    } else {
                        resolve(null);
                    }
                }
            );
        });
    }, []);

    return { suggestions, searchPlaces, getPlaceDetails, isLoading };
}
