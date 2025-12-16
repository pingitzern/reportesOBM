/**
 * Edge Function: geo-services
 * 
 * Servicios de geolocalización usando Google Maps Platform
 * 
 * Endpoints:
 *   POST /geo-services { action: "geocode", address: "..." }
 *   POST /geo-services { action: "distance-matrix", origin: {lat, lng}, destination: {lat, lng} }
 *   POST /geo-services { action: "batch-geocode", table: "clients" | "profiles" }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.1';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
});

// Tipos
interface GeocodingResult {
    lat: number;
    lng: number;
    formatted_address?: string;
}

interface DistanceMatrixResult {
    distance_km: number;
    duration_min: number;
    duration_traffic_min?: number;
}

interface Coordinates {
    lat: number;
    lng: number;
}

interface GeoServicePayload {
    action: 'geocode' | 'distance-matrix' | 'batch-geocode';
    address?: string;
    origin?: Coordinates;
    destination?: Coordinates;
    table?: 'clients' | 'profiles';
}

Deno.serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    if (req.method !== 'POST') {
        return jsonResponse({ error: 'Método no permitido' }, 405);
    }

    try {
        const payload: GeoServicePayload = await req.json();

        if (!payload.action) {
            return jsonResponse({ error: 'Se requiere action: geocode | distance-matrix | batch-geocode' }, 400);
        }

        switch (payload.action) {
            case 'geocode':
                return await handleGeocode(payload.address);

            case 'distance-matrix':
                return await handleDistanceMatrix(payload.origin, payload.destination);

            case 'batch-geocode':
                return await handleBatchGeocode(payload.table);

            default:
                return jsonResponse({ error: `Acción no soportada: ${payload.action}` }, 400);
        }

    } catch (error) {
        console.error('geo-services error:', error);
        return jsonResponse({
            error: error instanceof Error ? error.message : 'Error inesperado'
        }, 500);
    }
});

/**
 * Geocodificar una dirección usando Google Geocoding API
 */
async function handleGeocode(address?: string): Promise<Response> {
    if (!address) {
        return jsonResponse({ error: 'Se requiere address' }, 400);
    }

    const result = await geocodeAddress(address);
    if (!result) {
        return jsonResponse({ error: 'No se pudo geocodificar la dirección' }, 404);
    }

    return jsonResponse(result);
}

/**
 * Calcular tiempo de viaje usando Google Distance Matrix API
 */
async function handleDistanceMatrix(origin?: Coordinates, destination?: Coordinates): Promise<Response> {
    if (!origin || !destination) {
        return jsonResponse({ error: 'Se requieren origin y destination con lat/lng' }, 400);
    }

    const result = await calculateDistance(origin, destination);
    if (!result) {
        return jsonResponse({ error: 'No se pudo calcular la distancia' }, 404);
    }

    return jsonResponse(result);
}

/**
 * Actualizar coordenadas faltantes en una tabla
 */
async function handleBatchGeocode(table?: string): Promise<Response> {
    if (!table || !['clients', 'profiles'].includes(table)) {
        return jsonResponse({ error: 'Se requiere table: clients | profiles' }, 400);
    }

    const results = await batchGeocodeTable(table as 'clients' | 'profiles');
    return jsonResponse(results);
}

/**
 * Geocodifica una dirección usando Google Geocoding API
 */
async function geocodeAddress(address: string): Promise<GeocodingResult | null> {
    const encodedAddress = encodeURIComponent(address + ', Argentina');
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${GOOGLE_MAPS_API_KEY}`;

    console.log('[geo-services] Geocoding:', address);

    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK' || !data.results || data.results.length === 0) {
        console.error('[geo-services] Geocoding failed:', data.status, data.error_message);
        return null;
    }

    const location = data.results[0].geometry.location;
    return {
        lat: location.lat,
        lng: location.lng,
        formatted_address: data.results[0].formatted_address,
    };
}

/**
 * Calcula distancia y tiempo de viaje usando Google Distance Matrix API
 */
async function calculateDistance(origin: Coordinates, destination: Coordinates): Promise<DistanceMatrixResult | null> {
    const originStr = `${origin.lat},${origin.lng}`;
    const destStr = `${destination.lat},${destination.lng}`;

    // Usamos departure_time=now para obtener tiempo con tráfico
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originStr}&destinations=${destStr}&mode=driving&departure_time=now&key=${GOOGLE_MAPS_API_KEY}`;

    console.log('[geo-services] Distance Matrix:', originStr, '->', destStr);

    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK') {
        console.error('[geo-services] Distance Matrix failed:', data.status, data.error_message);
        return null;
    }

    const element = data.rows[0]?.elements[0];
    if (!element || element.status !== 'OK') {
        console.error('[geo-services] Distance Matrix element failed:', element?.status);
        return null;
    }

    return {
        distance_km: element.distance.value / 1000,
        duration_min: Math.round(element.duration.value / 60),
        duration_traffic_min: element.duration_in_traffic
            ? Math.round(element.duration_in_traffic.value / 60)
            : undefined,
    };
}

/**
 * Actualiza coordenadas faltantes en una tabla
 */
async function batchGeocodeTable(table: 'clients' | 'profiles'): Promise<{
    processed: number;
    updated: number;
    failed: number;
    errors: string[];
}> {
    const addressField = table === 'clients' ? 'direccion' : 'direccion_base';

    // Obtener registros sin coordenadas
    const { data: records, error } = await supabaseAdmin
        .from(table)
        .select(`id, ${addressField}`)
        .or('lat.is.null,lng.is.null')
        .not(addressField, 'is', null);

    if (error) {
        console.error('[geo-services] Error fetching records:', error);
        throw new Error(`Error obteniendo registros: ${error.message}`);
    }

    const results = {
        processed: records?.length || 0,
        updated: 0,
        failed: 0,
        errors: [] as string[],
    };

    if (!records || records.length === 0) {
        return results;
    }

    console.log(`[geo-services] Batch geocoding ${records.length} ${table} records`);

    for (const record of records) {
        const address = record[addressField as keyof typeof record] as string;
        if (!address) continue;

        try {
            const coords = await geocodeAddress(address);
            if (coords) {
                const { error: updateError } = await supabaseAdmin
                    .from(table)
                    .update({ lat: coords.lat, lng: coords.lng })
                    .eq('id', record.id);

                if (updateError) {
                    results.failed++;
                    results.errors.push(`${record.id}: ${updateError.message}`);
                } else {
                    results.updated++;
                }
            } else {
                results.failed++;
                results.errors.push(`${record.id}: No se pudo geocodificar "${address}"`);
            }

            // Rate limiting: esperar 100ms entre requests
            await new Promise(resolve => setTimeout(resolve, 100));

        } catch (e) {
            results.failed++;
            results.errors.push(`${record.id}: ${e instanceof Error ? e.message : 'Error'}`);
        }
    }

    return results;
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            ...corsHeaders,
        },
    });
}
