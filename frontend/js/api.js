import { getCurrentToken, handleSessionExpiration, isDevMode } from './modules/login/auth.js';
import { state } from './modules/mantenimiento/state.js';
import { supabase } from './supabaseClient.js';

// ============================================================================
// AUTENTICACIÓN - Supabase Auth
// ============================================================================

export async function login(email, password) {
    const credentials = {
        email: typeof email === 'string' ? email.trim() : '',
        password: typeof password === 'string' ? password : '',
    };

    const { data, error } = await supabase.auth.signInWithPassword(credentials);

    if (error || !data?.session) {
        console.error('Supabase auth login failed', error);
        throw new Error('Credenciales inválidas. Verificá tu mail y contraseña.');
    }

    return data;
}

export async function verificarSesion() {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
        console.error('Supabase getSession failed', error);
        throw new Error('No se pudo verificar la sesión actual.');
    }
    return data;
}

export async function renovarToken() {
    const { data, error } = await supabase.auth.refreshSession();
    if (error) {
        console.error('Supabase refreshSession failed', error);
        throw new Error('No se pudo renovar la sesión.');
    }
    return data;
}

export async function guardarMantenimiento(datos) {
    return guardarMantenimientoSupabase(datos);
}

export async function guardarMantenimientoAblandador({ payload } = {}) {
    const normalizedPayload = { ...(payload || {}) };
    normalizedPayload.type = 'softener';
    return guardarMantenimientoSupabase(normalizedPayload);
}

export async function generarPdfAblandador({ maintenanceId, forceRegenerate = false } = {}) {
    if (!maintenanceId) {
        throw new Error('maintenanceId es requerido para generar el PDF.');
    }

    const { data, error } = await supabase.functions.invoke('generate-maintenance-pdf', {
        body: { maintenanceId, forceRegenerate },
    });

    if (error) {
        console.error('Supabase PDF generation failed', error);
        throw new Error('No se pudo generar el PDF del ablandador.');
    }

    return data;
}

export async function buscarMantenimientos(filtros = {}) {
    // Construir query base
    let query = supabase
        .from('maintenances')
        .select(`
            id,
            client_id,
            equipment_id,
            technician_id,
            service_date,
            status,
            type,
            report_data,
            clients:client_id (
                id,
                razon_social
            ),
            profiles:technician_id (
                id,
                full_name
            )
        `)
        .order('service_date', { ascending: false });

    // Filtro por cliente (busca en razon_social del cliente o en report_data)
    if (filtros.cliente && filtros.cliente.trim()) {
        const clienteSearch = filtros.cliente.trim().toLowerCase();
        // Primero buscar clientes que coincidan
        const { data: matchingClients } = await supabase
            .from('clients')
            .select('id')
            .ilike('razon_social', `%${clienteSearch}%`);
        
        if (matchingClients && matchingClients.length > 0) {
            const clientIds = matchingClients.map(c => c.id);
            query = query.in('client_id', clientIds);
        } else {
            // Si no hay clientes, buscar en report_data
            query = query.or(`report_data->>Cliente.ilike.%${clienteSearch}%,report_data->>cliente.ilike.%${clienteSearch}%`);
        }
    }

    // Filtro por técnico (busca en full_name del perfil o en report_data)
    if (filtros.tecnico && filtros.tecnico.trim()) {
        const tecnicoSearch = filtros.tecnico.trim().toLowerCase();
        const { data: matchingTecnicos } = await supabase
            .from('profiles')
            .select('id')
            .ilike('full_name', `%${tecnicoSearch}%`);
        
        if (matchingTecnicos && matchingTecnicos.length > 0) {
            const tecnicoIds = matchingTecnicos.map(t => t.id);
            query = query.in('technician_id', tecnicoIds);
        } else {
            query = query.or(`report_data->>Tecnico_Asignado.ilike.%${tecnicoSearch}%,report_data->>tecnico.ilike.%${tecnicoSearch}%`);
        }
    }

    // Filtro por fecha
    if (filtros.fecha && filtros.fecha.trim()) {
        const fecha = filtros.fecha.trim();
        // Buscar mantenimientos en esa fecha específica
        query = query.gte('service_date', `${fecha}T00:00:00`)
                     .lte('service_date', `${fecha}T23:59:59`);
    }

    // Límite de resultados
    query = query.limit(100);

    const { data, error } = await query;

    if (error) {
        console.error('Error buscando mantenimientos:', error);
        throw new Error('No se pudieron buscar los mantenimientos.');
    }

    // Normalizar resultados al formato esperado por el frontend
    return (data || []).map(m => {
        const reportData = m.report_data || {};
        const clienteName = m.clients?.razon_social || reportData.Cliente || reportData.cliente || '';
        const tecnicoName = m.profiles?.full_name || reportData.Tecnico_Asignado || reportData.tecnico || '';
        
        return {
            // ID único para edición/eliminación
            ID_Unico: m.id,
            id: m.id,
            // Campos principales
            Cliente: clienteName,
            cliente: clienteName,
            Fecha_Servicio: m.service_date ? m.service_date.split('T')[0] : '',
            fecha_servicio: m.service_date,
            Tecnico_Asignado: tecnicoName,
            tecnico: tecnicoName,
            Modelo_Equipo: reportData.Modelo_Equipo || reportData.modelo || reportData.equipo || '',
            // Campos adicionales del report_data para edición
            Proximo_Mantenimiento: reportData.Proximo_Mantenimiento || reportData.proximo_mantenimiento || '',
            Conductividad_Permeado_Left: reportData.Conductividad_Permeado_Left || reportData.conductividad_permeado || 0,
            Resumen_Recomendaciones: reportData.Resumen_Recomendaciones || reportData.resumen || '',
            // Tipo de mantenimiento
            type: m.type,
            status: m.status,
            // Todo el report_data por si se necesita
            ...reportData
        };
    });
}

export async function actualizarMantenimiento(datos) {
    if (!datos || typeof datos !== 'object') {
        throw new Error('Datos del mantenimiento inválidos.');
    }

    const maintenanceId = datos.id || datos.maintenanceId;
    if (!maintenanceId) {
        throw new Error('ID del mantenimiento requerido para actualizar.');
    }

    // Preparar datos para actualizar
    const updateData = {};

    if (datos.client_id !== undefined) updateData.client_id = datos.client_id;
    if (datos.equipment_id !== undefined) updateData.equipment_id = datos.equipment_id;
    if (datos.technician_id !== undefined) updateData.technician_id = datos.technician_id;
    if (datos.service_date !== undefined) updateData.service_date = datos.service_date;
    if (datos.status !== undefined) updateData.status = datos.status;
    if (datos.type !== undefined) updateData.type = datos.type;
    
    // Si hay datos del reporte, actualizarlos
    if (datos.report_data !== undefined) {
        updateData.report_data = datos.report_data;
    } else {
        // Construir report_data desde campos individuales
        const reportFields = { ...datos };
        delete reportFields.id;
        delete reportFields.maintenanceId;
        delete reportFields.client_id;
        delete reportFields.equipment_id;
        delete reportFields.technician_id;
        delete reportFields.service_date;
        delete reportFields.status;
        delete reportFields.type;
        
        if (Object.keys(reportFields).length > 0) {
            // Obtener report_data actual y merge
            const { data: current } = await supabase
                .from('maintenances')
                .select('report_data')
                .eq('id', maintenanceId)
                .single();
            
            updateData.report_data = {
                ...(current?.report_data || {}),
                ...reportFields
            };
        }
    }

    const { data, error } = await supabase
        .from('maintenances')
        .update(updateData)
        .eq('id', maintenanceId)
        .select()
        .single();

    if (error) {
        console.error('Error actualizando mantenimiento:', error);
        throw new Error('No se pudo actualizar el mantenimiento.');
    }

    return { success: true, data };
}

export async function eliminarMantenimiento(id) {
    const maintenanceId = typeof id === 'object' ? (id.id || id.maintenanceId) : id;
    
    if (!maintenanceId) {
        throw new Error('ID del mantenimiento requerido para eliminar.');
    }

    // Obtener el mantenimiento para saber si tiene PDF asociado
    const { data: maintenance } = await supabase
        .from('maintenances')
        .select('report_data')
        .eq('id', maintenanceId)
        .single();

    // Si tiene PDF en Storage, eliminarlo
    if (maintenance?.report_data?.pdf_path) {
        await supabase.storage
            .from('maintenance-reports')
            .remove([maintenance.report_data.pdf_path]);
    }

    const { error } = await supabase
        .from('maintenances')
        .delete()
        .eq('id', maintenanceId);

    if (error) {
        console.error('Error eliminando mantenimiento:', error);
        throw new Error('No se pudo eliminar el mantenimiento.');
    }

    return { success: true };
}

export async function obtenerDashboard() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
    
    // Total de mantenimientos
    const { count: totalMantenimientos } = await supabase
        .from('maintenances')
        .select('*', { count: 'exact', head: true });

    // Mantenimientos este mes
    const { count: esteMes } = await supabase
        .from('maintenances')
        .select('*', { count: 'exact', head: true })
        .gte('service_date', startOfMonth)
        .lte('service_date', endOfMonth);

    // Próximos mantenimientos (status pendiente o programado)
    const { data: proximosData, count: proximos } = await supabase
        .from('maintenances')
        .select(`
            id,
            service_date,
            status,
            report_data,
            clients:client_id (razon_social)
        `, { count: 'exact' })
        .in('status', ['pendiente', 'programado', 'borrador'])
        .gte('service_date', now.toISOString())
        .order('service_date', { ascending: true })
        .limit(5);

    // Técnicos activos (que hayan hecho mantenimientos en los últimos 30 días)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: tecnicosData } = await supabase
        .from('maintenances')
        .select('technician_id')
        .gte('service_date', thirtyDaysAgo)
        .not('technician_id', 'is', null);
    
    const tecnicosUnicos = new Set((tecnicosData || []).map(m => m.technician_id));
    const tecnicosActivos = tecnicosUnicos.size;

    // Mantenimientos por mes (últimos 6 meses)
    const mantenimientosPorMes = [];
    for (let i = 5; i >= 0; i--) {
        const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
        
        const { count } = await supabase
            .from('maintenances')
            .select('*', { count: 'exact', head: true })
            .gte('service_date', monthStart.toISOString())
            .lte('service_date', monthEnd.toISOString());
        
        const monthName = monthStart.toLocaleDateString('es-AR', { month: 'short' });
        mantenimientosPorMes.push({
            mes: monthName,
            cantidad: count || 0
        });
    }

    // Distribución por técnico (últimos 30 días)
    const { data: distData } = await supabase
        .from('maintenances')
        .select(`
            technician_id,
            profiles:technician_id (full_name)
        `)
        .gte('service_date', thirtyDaysAgo)
        .not('technician_id', 'is', null);

    const tecnicoCount = {};
    (distData || []).forEach(m => {
        const nombre = m.profiles?.full_name || 'Sin asignar';
        tecnicoCount[nombre] = (tecnicoCount[nombre] || 0) + 1;
    });

    const distribucionTecnico = Object.entries(tecnicoCount).map(([tecnico, cantidad]) => ({
        tecnico,
        cantidad
    }));

    // Próximos mantenimientos formateados
    const proximosMantenimientos = (proximosData || []).map(m => ({
        id: m.id,
        cliente: m.clients?.razon_social || m.report_data?.Cliente || 'N/A',
        fecha: m.service_date ? new Date(m.service_date).toLocaleDateString('es-AR') : 'N/A',
        status: m.status
    }));

    return {
        totalMantenimientos: totalMantenimientos || 0,
        esteMes: esteMes || 0,
        proximos: proximos || 0,
        tecnicosActivos,
        mantenimientosPorMes,
        distribucionTecnico,
        proximosMantenimientos
    };
}

// ============================================================================
// CLIENTES - Supabase
// ============================================================================

export async function obtenerClientes({ forceRefresh = false } = {}) {
    if (!forceRefresh && state.clientesLoaded) {
        return state.clientes;
    }

    const data = await fetchClientesSupabase();

    if (!Array.isArray(data)) {
        throw new Error('La respuesta de clientes no es válida.');
    }

    state.clientes = data.map(normalizeClienteRecord);
    state.clientesLoaded = true;

    return state.clientes;
}

// ============================================================================
// REMITOS - Funciones migradas a Supabase
// ============================================================================

/**
 * Obtiene la lista paginada de remitos desde Supabase
 */
export async function obtenerRemitos({ page = 1, pageSize = 20 } = {}) {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // Obtener total de registros
    const { count, error: countError } = await supabase
        .from('remitos')
        .select('*', { count: 'exact', head: true });

    if (countError) {
        console.error('Error contando remitos:', countError);
        throw new Error('No se pudo obtener el total de remitos.');
    }

    // Obtener remitos con datos del cliente
    const { data, error } = await supabase
        .from('remitos')
        .select(`
            *,
            clients:client_id (
                id,
                razon_social,
                direccion,
                cuit,
                contacto_info
            )
        `)
        .order('fecha_remito', { ascending: false })
        .range(from, to);

    if (error) {
        console.error('Error obteniendo remitos:', error);
        throw new Error('No se pudieron cargar los remitos.');
    }

    // Mapear a formato esperado por el frontend
    const remitos = (data || []).map(remito => ({
        id: remito.id,
        numeroRemito: remito.numero_remito,
        NumeroRemito: remito.numero_remito,
        numeroReporte: remito.numero_reporte,
        NumeroReporte: remito.numero_reporte,
        cliente: remito.cliente_nombre || remito.clients?.razon_social || '',
        Cliente: remito.cliente_nombre || remito.clients?.razon_social || '',
        fechaRemito: remito.fecha_remito,
        FechaRemito: remito.fecha_remito,
        fechaRemitoISO: remito.fecha_remito,
        fechaServicio: remito.fecha_servicio,
        FechaServicio: remito.fecha_servicio,
        fechaServicioISO: remito.fecha_servicio,
        tecnico: remito.technician_id,
        Tecnico: remito.technician_id,
        observaciones: remito.observaciones,
        Observaciones: remito.observaciones,
        direccion: remito.direccion,
        Direccion: remito.direccion,
        telefono: remito.telefono,
        Telefono: remito.telefono,
        email: remito.email,
        Email: remito.email,
        cuit: remito.cuit,
        CUIT: remito.cuit,
        reporteId: remito.maintenance_id,
        ReporteID: remito.maintenance_id,
        // Datos del equipo
        equipo_descripcion: remito.equipo_descripcion || '',
        equipo_modelo: remito.equipo_modelo || '',
        equipo_serie: remito.equipo_serie || '',
        equipo_interno: remito.equipo_interno || '',
        equipo_ubicacion: remito.equipo_ubicacion || '',
        // Repuestos (JSON)
        repuestos: remito.repuestos || [],
        // Path del PDF guardado
        pdf_path: remito.pdf_path || '',
        // Paths de fotos (se resuelven URLs firmadas bajo demanda)
        Foto1Id: remito.foto_1_path || '',
        Foto2Id: remito.foto_2_path || '',
        Foto3Id: remito.foto_3_path || '',
        Foto4Id: remito.foto_4_path || '',
        foto_1_path: remito.foto_1_path || '',
        foto_2_path: remito.foto_2_path || '',
        foto_3_path: remito.foto_3_path || '',
        foto_4_path: remito.foto_4_path || '',
    }));

    const totalItems = count || 0;
    const totalPages = Math.ceil(totalItems / pageSize);

    return {
        remitos,
        totalItems,
        totalPages,
        currentPage: page,
        pageSize,
    };
}

/**
 * Obtiene URL firmada para una foto en Storage
 */
async function getSignedPhotoUrl(path) {
    if (!path) return '';
    
    try {
        const { data, error } = await supabase.storage
            .from('maintenance-reports')
            .createSignedUrl(path, 3600); // 1 hora de validez
        
        if (error) {
            console.warn('Error obteniendo URL firmada:', error);
            return '';
        }
        return data?.signedUrl || '';
    } catch (err) {
        console.warn('Error en getSignedPhotoUrl:', err);
        return '';
    }
}

/**
 * Sube una foto a Storage y retorna el path
 */
async function uploadRemitoPhoto(remitoId, photoData, slotIndex) {
    if (!photoData?.base64Data) return null;

    const mimeType = photoData.mimeType || 'image/jpeg';
    const extension = mimeType.split('/')[1] || 'jpg';
    const fileName = `foto_${slotIndex}.${extension}`;
    const filePath = `Remitos/${remitoId}/${fileName}`;

    // Convertir base64 a Blob
    const byteCharacters = atob(photoData.base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });

    const { error } = await supabase.storage
        .from('maintenance-reports')
        .upload(filePath, blob, {
            contentType: mimeType,
            upsert: true,
        });

    if (error) {
        console.error(`Error subiendo foto ${slotIndex}:`, error);
        return null;
    }

    return filePath;
}

/**
 * Sube un PDF blob al Storage de Supabase
 * @param {string} remitoId - ID del remito
 * @param {Blob} pdfBlob - Blob del PDF generado
 * @param {string} numeroRemito - Número de remito para el nombre del archivo
 * @returns {Promise<string|null>} Path del archivo subido o null si falla
 */
async function uploadRemitoPdfBlob(remitoId, pdfBlob, numeroRemito) {
    if (!pdfBlob) return null;

    // Nombre del archivo: remito_R2025-00001.pdf
    const fileName = `remito_${numeroRemito || remitoId}.pdf`;
    const filePath = `Remitos/${remitoId}/${fileName}`;

    const { error } = await supabase.storage
        .from('maintenance-reports')
        .upload(filePath, pdfBlob, {
            contentType: 'application/pdf',
            upsert: true,
        });

    if (error) {
        console.error('Error subiendo PDF:', error);
        return null;
    }

    return filePath;
}

/**
 * Guarda el PDF blob de un remito en Storage y actualiza la BD
 * @param {string} remitoId - ID del remito
 * @param {Blob} pdfBlob - Blob del PDF generado con jsPDF
 * @param {string} numeroRemito - Número de remito
 * @returns {Promise<string|null>} Path del PDF o null si falla
 */
export async function guardarPdfRemito(remitoId, pdfBlob, numeroRemito) {
    if (!remitoId || !pdfBlob) return null;

    const pdfPath = await uploadRemitoPdfBlob(remitoId, pdfBlob, numeroRemito);
    if (!pdfPath) return null;

    // Actualizar el remito con el path del PDF
    const { error } = await supabase
        .from('remitos')
        .update({ pdf_path: pdfPath })
        .eq('id', remitoId);

    if (error) {
        console.warn('Error actualizando pdf_path en remito:', error);
    }

    return pdfPath;
}

/**
 * Obtiene URL firmada para descargar el PDF del remito
 */
export async function obtenerUrlPdfRemito(pdfPath) {
    if (!pdfPath) return null;

    try {
        const { data, error } = await supabase.storage
            .from('maintenance-reports')
            .createSignedUrl(pdfPath, 3600); // 1 hora de validez

        if (error) {
            console.warn('Error obteniendo URL del PDF:', error);
            return null;
        }
        return data?.signedUrl || null;
    } catch (err) {
        console.warn('Error en obtenerUrlPdfRemito:', err);
        return null;
    }
}

/**
 * Crea un nuevo remito en Supabase
 */
export async function crearRemito(datos) {
    if (!datos || typeof datos !== 'object') {
        throw new Error('Datos del remito inválidos.');
    }

    const reporteData = datos.reporteData || datos;

    // Preparar datos para insertar
    const remitoData = {
        numero_reporte: reporteData.numero_reporte || reporteData.NumeroReporte || null,
        maintenance_id: reporteData.maintenanceId || reporteData.maintenance_id || null,
        client_id: reporteData.clientId || reporteData.client_id || null,
        fecha_remito: new Date().toISOString(),
        fecha_servicio: reporteData.fecha_servicio || reporteData.fecha || null,
        cliente_nombre: reporteData.clienteNombre || reporteData.cliente || reporteData.Cliente || '',
        direccion: reporteData.direccion || reporteData.cliente_direccion || '',
        telefono: reporteData.cliente_telefono || reporteData.telefono || '',
        email: reporteData.cliente_email || reporteData.email || '',
        cuit: reporteData.cliente_cuit || reporteData.cuit || '',
        equipo_descripcion: reporteData.equipo || '',
        equipo_modelo: reporteData.modelo || '',
        equipo_serie: reporteData.n_serie || reporteData.numero_serie || '',
        equipo_interno: reporteData.id_interna || '',
        equipo_ubicacion: reporteData.ubicacion || '',
        observaciones: datos.observaciones || reporteData.observaciones || '',
        repuestos: JSON.stringify(reporteData.repuestos || []),
    };

    // Insertar remito (el numero_remito se genera automáticamente)
    const { data: remito, error } = await supabase
        .from('remitos')
        .insert([remitoData])
        .select()
        .single();

    if (error) {
        console.error('Error creando remito:', error);
        throw new Error('No se pudo crear el remito.');
    }

    // Subir fotos si las hay
    const fotos = datos.fotos || [];
    const fotoPaths = { foto_1_path: null, foto_2_path: null, foto_3_path: null, foto_4_path: null };

    for (let i = 0; i < Math.min(fotos.length, 4); i++) {
        const foto = fotos[i];
        if (foto?.base64Data) {
            const path = await uploadRemitoPhoto(remito.id, foto, i + 1);
            if (path) {
                fotoPaths[`foto_${i + 1}_path`] = path;
            }
        }
    }

    // Actualizar remito con los paths de las fotos si se subieron
    const hasPhotos = Object.values(fotoPaths).some(p => p !== null);
    if (hasPhotos) {
        const { error: updateError } = await supabase
            .from('remitos')
            .update(fotoPaths)
            .eq('id', remito.id);

        if (updateError) {
            console.warn('Error actualizando paths de fotos:', updateError);
        }
    }

    // Guardar el HTML del PDF si se proporciona
    let pdfPath = null;
    if (datos.pdfHtml) {
        pdfPath = await uploadRemitoPdfHtml(remito.id, datos.pdfHtml);
        if (pdfPath) {
            await supabase
                .from('remitos')
                .update({ pdf_path: pdfPath })
                .eq('id', remito.id);
        }
    }

    return {
        success: true,
        data: {
            id: remito.id,
            NumeroRemito: remito.numero_remito,
            numeroRemito: remito.numero_remito,
            pdfPath: pdfPath,
            emailStatus: { skipped: true, message: 'Envío de email pendiente de migración' },
        },
    };
}

/**
 * Actualiza un remito existente en Supabase
 */
export async function actualizarRemito(datos) {
    if (!datos || typeof datos !== 'object') {
        throw new Error('Datos del remito inválidos.');
    }

    const remitoId = datos.remitoId || datos.id;
    if (!remitoId) {
        throw new Error('ID del remito requerido para actualizar.');
    }

    // Preparar datos para actualizar
    const updateData = {};
    
    if (datos.cliente !== undefined) updateData.cliente_nombre = datos.cliente;
    if (datos.direccion !== undefined) updateData.direccion = datos.direccion;
    if (datos.telefono !== undefined) updateData.telefono = datos.telefono;
    if (datos.email !== undefined) updateData.email = datos.email;
    if (datos.cuit !== undefined) updateData.cuit = datos.cuit;
    if (datos.observaciones !== undefined) updateData.observaciones = datos.observaciones;
    if (datos.fechaServicio !== undefined) updateData.fecha_servicio = datos.fechaServicio;
    if (datos.tecnico !== undefined) updateData.technician_id = datos.tecnico;
    if (datos.repuestos !== undefined) updateData.repuestos = JSON.stringify(datos.repuestos);

    const { data: remito, error } = await supabase
        .from('remitos')
        .update(updateData)
        .eq('id', remitoId)
        .select()
        .single();

    if (error) {
        console.error('Error actualizando remito:', error);
        throw new Error('No se pudo actualizar el remito.');
    }

    // Manejar fotos: subir nuevas, eliminar marcadas para remover
    const fotos = datos.fotos || [];
    for (let i = 0; i < Math.min(fotos.length, 4); i++) {
        const foto = fotos[i];
        const pathKey = `foto_${i + 1}_path`;
        
        if (foto?.shouldRemove && remito[pathKey]) {
            // Eliminar foto de Storage
            await supabase.storage
                .from('maintenance-reports')
                .remove([remito[pathKey]]);
            
            await supabase
                .from('remitos')
                .update({ [pathKey]: null })
                .eq('id', remitoId);
        } else if (foto?.base64Data) {
            // Subir nueva foto
            const path = await uploadRemitoPhoto(remitoId, foto, i + 1);
            if (path) {
                await supabase
                    .from('remitos')
                    .update({ [pathKey]: path })
                    .eq('id', remitoId);
            }
        }
    }

    return {
        success: true,
        data: {
            id: remito.id,
            NumeroRemito: remito.numero_remito,
            numeroRemito: remito.numero_remito,
        },
    };
}

/**
 * Elimina un remito de Supabase (incluyendo fotos)
 */
export async function eliminarRemito(remitoId) {
    // Normalizar input
    const id = typeof remitoId === 'object' 
        ? (remitoId.remitoId || remitoId.id)
        : remitoId;

    if (!id) {
        throw new Error('ID del remito requerido para eliminar.');
    }

    // Obtener remito para saber qué fotos eliminar
    const { data: remito, error: fetchError } = await supabase
        .from('remitos')
        .select('foto_1_path, foto_2_path, foto_3_path, foto_4_path')
        .eq('id', id)
        .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Error obteniendo remito para eliminar:', fetchError);
    }

    // Eliminar fotos del Storage
    if (remito) {
        const fotosToDelete = [
            remito.foto_1_path,
            remito.foto_2_path,
            remito.foto_3_path,
            remito.foto_4_path,
        ].filter(Boolean);

        if (fotosToDelete.length > 0) {
            const { error: storageError } = await supabase.storage
                .from('maintenance-reports')
                .remove(fotosToDelete);

            if (storageError) {
                console.warn('Error eliminando fotos:', storageError);
            }
        }
    }

    // Eliminar remito de la base de datos
    const { error } = await supabase
        .from('remitos')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error eliminando remito:', error);
        throw new Error('No se pudo eliminar el remito.');
    }

    return { success: true };
}

export async function obtenerVersionServidor() {
    // Versión hardcodeada - ya no depende del backend de Google Apps Script
    return {
        version: '2.0.0',
        build: 'supabase-migration',
        date: '2025-11-27',
        environment: 'supabase'
    };
}

export async function enviarFeedbackTicket(datos) {
    if (!datos || typeof datos !== 'object') {
        throw new Error('Datos del feedback inválidos.');
    }

    // Obtener usuario actual si está autenticado
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id || null;
    const userEmail = sessionData?.session?.user?.email || datos.email || datos.usuario || '';

    // Mapear categorías del frontend al formato de la BD
    const categoriaMap = {
        'bug': 'bug',
        'error': 'bug',
        'mejora': 'mejora',
        'sugerencia': 'mejora',
        'rendimiento': 'rendimiento',
        'performance': 'rendimiento',
        'otro': 'otro',
        'other': 'otro'
    };

    const impactoMap = {
        'bajo': 'bajo',
        'low': 'bajo',
        'medio': 'medio',
        'medium': 'medio',
        'alto': 'alto',
        'high': 'alto',
        'critico': 'critico',
        'critical': 'critico'
    };

    const categoria = categoriaMap[(datos.categoria || datos.category || 'otro').toLowerCase()] || 'otro';
    const impacto = impactoMap[(datos.impacto || datos.impact || 'bajo').toLowerCase()] || 'bajo';

    const feedbackData = {
        user_email: userEmail,
        user_id: userId,
        categoria,
        impacto,
        mensaje: datos.mensaje || datos.message || '',
        contacto_info: datos.contactoInfo || datos.contacto || '',
        permitir_contacto: datos.permitirContacto ?? datos.allowContact ?? false,
        origen_url: datos.origenUrl || datos.url || (typeof window !== 'undefined' ? window.location.href : ''),
        user_agent: datos.userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : ''),
        estado: 'nuevo'
    };

    const { data, error } = await supabase
        .from('feedback')
        .insert([feedbackData])
        .select()
        .single();

    if (error) {
        console.error('Error enviando feedback:', error);
        throw new Error('No se pudo enviar el feedback.');
    }

    return { success: true, ticketId: data.id };
}

export async function fetchClientesSupabase() {
    const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('razon_social', { ascending: true });

    if (error) {
        console.error('Supabase fetch error:', error);
        throw error;
    }

    return data;
}

if (typeof window !== 'undefined') {
    window.testSupabase = fetchClientesSupabase;
}

export async function guardarMantenimientoSupabase(payload = {}) {
    if (!payload || typeof payload !== 'object') {
        throw new Error('Los datos del formulario son inválidos.');
    }

    const clientId = extractClientIdFromPayload(payload);
    if (!clientId) {
        throw new Error('Selecciona un cliente válido antes de guardar.');
    }

    const serviceDate = normalizeDate(payload.fecha_servicio || payload.service_date || payload.fecha);
    const type = determineMaintenanceType(payload);

    const reportData = { ...payload };
    delete reportData.client_id;
    delete reportData.clienteId;
    delete reportData.cliente;
    delete reportData.Cliente;
    delete reportData.razon_social;
    delete reportData.RazonSocial;
    delete reportData.type;
    delete reportData.tipo_mantenimiento;
    delete reportData.service_date;
    delete reportData.fecha_servicio;

    const { data, error } = await supabase
        .from('maintenances')
        .insert({
            client_id: clientId,
            type,
            report_data: reportData,
            service_date: serviceDate,
            status: 'finalizado',
        })
        .select('id')
        .single();

    if (error || !data?.id) {
        console.error('Supabase insert failed:', error);
        throw new Error('No se pudo guardar el mantenimiento en Supabase.');
    }

    let pdfUrl = null;
    try {
        const { data: pdfData, error: pdfError } = await supabase.functions.invoke('generate-maintenance-pdf', {
            body: { maintenanceId: data.id },
        });

        if (pdfError) {
            throw pdfError;
        }

        pdfUrl = pdfData?.url || pdfData?.signedUrl || null;
        if (pdfUrl) {
            await promptPdfDownload(pdfUrl);
        }
    } catch (pdfError) {
        console.warn('No se pudo generar el PDF automáticamente', pdfError);
    }

    return { success: true, maintenanceId: data.id, pdfUrl };
}

async function promptPdfDownload(url) {
    if (typeof window === 'undefined' || !url) {
        return;
    }

    if (window.Swal && typeof window.Swal.fire === 'function') {
        const result = await window.Swal.fire({
            title: 'Reporte generado',
            text: 'El PDF está listo. ¿Querés descargarlo ahora?',
            icon: 'success',
            confirmButtonText: 'Descargar PDF',
            cancelButtonText: 'Cerrar',
            showCancelButton: true,
        });

        if (result.isConfirmed) {
            window.open(url, '_blank', 'noopener');
        }
        return;
    }

    const shouldDownload = window.confirm(
        'El PDF del mantenimiento está listo. Seleccioná Aceptar para descargarlo o Cancelar para cerrar.',
    );
    if (shouldDownload) {
        window.open(url, '_blank', 'noopener');
    }
}

function extractClientIdFromPayload(payload) {
    const candidateValues = [
        payload.client_id,
        payload.clienteId,
        payload.ClienteId,
        payload.cliente_id,
        payload.cliente,
        payload.Cliente,
        payload.razon_social,
        payload.RazonSocial,
    ];

    for (const value of candidateValues) {
        const resolved = resolveClientIdentifier(value);
        if (resolved) {
            return resolved;
        }
    }

    if (payload.cliente && typeof payload.cliente === 'object') {
        return extractClientIdFromPayload(payload.cliente);
    }

    return null;
}

function resolveClientIdentifier(value) {
    if (typeof value !== 'string') {
        return null;
    }

    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }

    if (isLikelyUuid(trimmed)) {
        return trimmed;
    }

    return findClientIdByName(trimmed);
}

function isLikelyUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function findClientIdByName(name) {
    if (!Array.isArray(state.clientes) || state.clientes.length === 0) {
        return null;
    }

    const target = normalizeComparableString(name);
    if (!target) {
        return null;
    }

    for (const cliente of state.clientes) {
        if (!cliente || typeof cliente !== 'object') {
            continue;
        }

        const nameCandidates = [
            cliente.razon_social,
            cliente.RazonSocial,
            cliente.nombre,
            cliente.Nombre,
            cliente.cliente,
            cliente.Cliente,
        ];

        if (nameCandidates.some(value => normalizeComparableString(value) === target)) {
            if (typeof cliente.id === 'string' && cliente.id.trim()) {
                return cliente.id.trim();
            }
        }
    }

    return null;
}

function normalizeComparableString(value) {
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function normalizeDate(value) {
    if (!value) {
        return new Date().toISOString();
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return new Date().toISOString();
    }
    return date.toISOString();
}

function determineMaintenanceType(payload) {
    const rawType = (payload?.type || payload?.tipo_mantenimiento || '').toString().toLowerCase();
    if (rawType.includes('soft')) {
        return 'softener';
    }

    const formName = (payload?.metadata?.formulario || payload?.formulario || '').toString().toLowerCase();
    if (formName.includes('ablandador') || formName.includes('softener')) {
        return 'softener';
    }
    return 'ro';
}

function normalizeClienteRecord(cliente) {
    if (!cliente || typeof cliente !== 'object') {
        return {};
    }

    const contacto = cliente.contacto_info && typeof cliente.contacto_info === 'object'
        ? cliente.contacto_info
        : {};

    const razonSocial = pickFirstTruthy([
        cliente.razon_social,
        cliente.RazonSocial,
        cliente.nombre,
        cliente.Nombre,
        cliente.cliente,
        cliente.Cliente,
    ]);

    const direccion = pickFirstTruthy([
        cliente.direccion,
        contacto.direccion,
        contacto.Direccion,
        contacto.address,
    ]);

    const telefono = pickFirstTruthy([
        cliente.telefono,
        cliente.Telefono,
        contacto.telefono,
        contacto.Telefono,
        contacto.tel,
        contacto.phone,
    ]);

    const email = pickFirstTruthy([
        cliente.email,
        cliente.Email,
        contacto.email,
        contacto.Email,
        contacto.mail,
        contacto.Mail,
    ]);

    const cuit = pickFirstTruthy([
        cliente.cuit,
        cliente.CUIT,
        contacto.cuit,
        contacto.CUIT,
    ]);

    return {
        ...cliente,
        contacto_info: contacto,
        id: cliente.id,
        nombre: razonSocial || cliente.nombre || '',
        Nombre: razonSocial || cliente.Nombre || '',
        cliente: razonSocial || cliente.cliente || '',
        Cliente: razonSocial || cliente.Cliente || '',
        razon_social: razonSocial || cliente.razon_social || '',
        RazonSocial: razonSocial || cliente.RazonSocial || '',
        direccion,
        Direccion: direccion,
        telefono,
        Telefono: telefono,
        email,
        Email: email,
        cuit,
        CUIT: cuit,
    };
}

function pickFirstTruthy(values) {
    for (const value of values) {
        if (typeof value === 'string' && value.trim()) {
            return value.trim();
        }
    }
    return '';
}

