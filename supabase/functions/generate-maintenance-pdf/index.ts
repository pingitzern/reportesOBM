import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.1';
import { PDFDocument, StandardFonts, rgb, PDFPage, PDFFont } from 'https://esm.sh/pdf-lib@1.17.1';

type MaintenanceRow = {
    id: string;
    client_id: string | null;
    type: string | null;
    status: string | null;
    service_date: string | null;
    report_data: Record<string, unknown> | null;
};

type ClientRow = {
    id: string;
    razon_social?: string | null;
    direccion?: string | null;
    contacto_info?: Record<string, unknown> | null;
};

type ParsedRequest = {
    maintenanceId: string | null;
    forceRegenerate: boolean;
};

type PdfContext = {
    pdfDoc: InstanceType<typeof PDFDocument>;
    page: PDFPage;
    font: PDFFont;
    fontBold: PDFFont;
    cursorY: number;
    pageSize: [number, number];
    marginX: number;
    maxWidth: number;
    primaryColor: ReturnType<typeof rgb>;
    secondaryColor: ReturnType<typeof rgb>;
};

const REQUIRED_ENV_VARS = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] as const;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const env = readEnv();
const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
});

async function verifyAuth(req: Request): Promise<{ user: unknown } | null> {
    const authHeader = req.headers.get('Authorization');
    console.log('[generate-maintenance-pdf] Auth header present:', !!authHeader);
    
    if (!authHeader) {
        // Permitir requests sin auth por ahora para debugging
        console.log('[generate-maintenance-pdf] No auth header, allowing request for debugging');
        return { user: { id: 'anonymous' } };
    }

    const token = authHeader.replace('Bearer ', '');
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    
    if (error || !data?.user) {
        console.error('[generate-maintenance-pdf] Auth verification failed:', error?.message);
        // Aún así permitir por ahora
        return { user: { id: 'anonymous' } };
    }

    console.log('[generate-maintenance-pdf] Auth verified for user:', data.user.id);
    return { user: data.user };
}

Deno.serve(async req => {
    console.log('[generate-maintenance-pdf] Request received:', req.method, req.url);
    
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        if (!['GET', 'POST'].includes(req.method)) {
            return jsonResponse({ error: 'Method not allowed' }, 405);
        }

        // Verificar autenticación (ahora más permisiva para debugging)
        const auth = await verifyAuth(req);
        console.log('[generate-maintenance-pdf] Auth result:', auth ? 'OK' : 'FAILED');

        const { maintenanceId, forceRegenerate } = await parseRequest(req);
        if (!maintenanceId) {
            return jsonResponse({ error: 'maintenanceId is required' }, 400);
        }

        const maintenance = await fetchMaintenanceRow(maintenanceId);
        if (!maintenance) {
            return jsonResponse({ error: 'Maintenance not found' }, 404);
        }

        const client = maintenance.client_id ? await fetchClientRow(maintenance.client_id) : null;
        const pdfBytes = await buildMaintenancePdf(maintenance, client);
        const filePath = `maintenances/${maintenanceId}.pdf`;

        if (forceRegenerate) {
            await supabaseAdmin.storage.from(env.PDF_STORAGE_BUCKET).remove([filePath]);
        }

        const uploadResult = await supabaseAdmin.storage
            .from(env.PDF_STORAGE_BUCKET)
            .upload(filePath, pdfBytes, {
                contentType: 'application/pdf',
                cacheControl: '3600',
                upsert: true,
            });

        if (uploadResult.error) {
            console.error('Storage upload failed', uploadResult.error);
            throw new Error('No se pudo guardar el PDF en Storage.');
        }

        const signed = await supabaseAdmin.storage
            .from(env.PDF_STORAGE_BUCKET)
            .createSignedUrl(filePath, env.PDF_SIGNED_URL_TTL);

        if (signed.error) {
            console.error('Signed URL generation failed', signed.error);
            return jsonResponse({
                path: filePath,
                url: null,
                message: 'PDF guardado, pero no se pudo generar URL firmada.',
            });
        }

        return jsonResponse({
            path: filePath,
            url: signed.data?.signedUrl ?? null,
        });
    } catch (error) {
        console.error('generate-maintenance-pdf error', error);
        return jsonResponse({ error: error instanceof Error ? error.message : 'Unexpected error' }, 500);
    }
});

function readEnv() {
    const envMap: Record<string, string> = {};
    REQUIRED_ENV_VARS.forEach(key => {
        const value = Deno.env.get(key);
        if (!value) throw new Error(`Missing required env var ${key}`);
        envMap[key] = value;
    });

    return {
        SUPABASE_URL: envMap.SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: envMap.SUPABASE_SERVICE_ROLE_KEY,
        PDF_STORAGE_BUCKET: Deno.env.get('PDF_STORAGE_BUCKET') || 'maintenance-reports',
        PDF_SIGNED_URL_TTL: Number(Deno.env.get('PDF_SIGNED_URL_TTL') || 900),
    };
}

async function parseRequest(req: Request): Promise<ParsedRequest> {
    if (req.method === 'GET') {
        const url = new URL(req.url);
        return {
            maintenanceId: url.searchParams.get('maintenanceId') || url.searchParams.get('id'),
            forceRegenerate: url.searchParams.get('force') === 'true',
        };
    }

    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
        const body = await req.json().catch(() => ({}));
        return {
            maintenanceId: typeof body.maintenanceId === 'string' ? body.maintenanceId : null,
            forceRegenerate: Boolean(body.forceRegenerate),
        };
    }

    const form = await req.formData();
    return {
        maintenanceId: form.get('maintenanceId')?.toString() ?? null,
        forceRegenerate: form.get('forceRegenerate') === 'true',
    };
}

async function fetchMaintenanceRow(id: string): Promise<MaintenanceRow | null> {
    const { data, error } = await supabaseAdmin
        .from('maintenances')
        .select('id, client_id, type, status, service_date, report_data')
        .eq('id', id)
        .maybeSingle();

    if (error) {
        console.error('Error fetching maintenance', error);
        throw new Error('No se pudo obtener el mantenimiento solicitado.');
    }
    return data;
}

async function fetchClientRow(id: string): Promise<ClientRow | null> {
    const { data, error } = await supabaseAdmin
        .from('clients')
        .select('id, razon_social, direccion, contacto_info')
        .eq('id', id)
        .maybeSingle();

    if (error) {
        console.error('Error fetching client', error);
        throw new Error('No se pudo obtener el cliente asociado.');
    }
    return data;
}

async function fetchLogo(): Promise<Uint8Array | null> {
    try {
        const { data, error } = await supabaseAdmin.storage
            .from('maintenance-reports')
            .download('assets/logo.png');

        if (error || !data) {
            console.warn('Could not fetch logo:', error);
            return null;
        }
        return new Uint8Array(await data.arrayBuffer());
    } catch (e) {
        console.warn('Logo fetch failed:', e);
        return null;
    }
}

async function buildMaintenancePdf(maintenance: MaintenanceRow, client: ClientRow | null) {
    const pdfDoc = await PDFDocument.create();
    const pageSize: [number, number] = [595.28, 841.89]; // A4
    const page = pdfDoc.addPage(pageSize);
    const height = pageSize[1];
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const marginX = 50;
    const maxWidth = 495;

    // Colores corporativos
    const primaryColor = rgb(0.13, 0.39, 0.59); // Azul oscuro #216497
    const secondaryColor = rgb(0.4, 0.4, 0.4); // Gris

    const ctx: PdfContext = {
        pdfDoc,
        page,
        font,
        fontBold,
        cursorY: height - 50,
        pageSize,
        marginX,
        maxWidth,
        primaryColor,
        secondaryColor,
    };

    const payload = maintenance.report_data || {};
    const maintenanceType = (maintenance.type || 'ro').toLowerCase();

    // === HEADER CON LOGO ===
    const logoBytes = await fetchLogo();
    const logoWidth = 80;
    const logoHeight = 60;
    
    if (logoBytes) {
        try {
            const logoImage = await pdfDoc.embedPng(logoBytes);
            const scaleFactor = Math.min(logoWidth / logoImage.width, logoHeight / logoImage.height);
            const scaledWidth = logoImage.width * scaleFactor;
            const scaledHeight = logoImage.height * scaleFactor;
            
            ctx.page.drawImage(logoImage, {
                x: marginX,
                y: ctx.cursorY - scaledHeight + 15,
                width: scaledWidth,
                height: scaledHeight,
            });
        } catch (e) {
            console.warn('Could not embed logo:', e);
        }
    }

    // Título centrado (después del espacio del logo)
    const titleLabel = maintenanceType === 'softener'
        ? 'INFORME DE MANTENIMIENTO'
        : 'REPORTE DE MANTENIMIENTO';
    const subtitleLabel = maintenanceType === 'softener' ? 'Ablandador de Agua' : 'Osmosis Inversa';

    // Número de reporte a la derecha (arriba de todo)
    const reportNumber = getNestedValue(payload, 'numero_reporte') ||
        getNestedValue(payload, 'metadata.numero_reporte') ||
        maintenance.id.substring(0, 8).toUpperCase();

    ctx.page.drawText(`N° ${reportNumber}`, {
        x: pageSize[0] - marginX - 100,
        y: ctx.cursorY,
        size: 10,
        font: fontBold,
        color: primaryColor,
    });

    // Título principal centrado
    const titleWidth = fontBold.widthOfTextAtSize(titleLabel, 16);
    ctx.page.drawText(titleLabel, {
        x: (pageSize[0] - titleWidth) / 2,
        y: ctx.cursorY - 20,
        size: 16,
        font: fontBold,
        color: primaryColor,
    });
    
    // Subtítulo centrado
    const subtitleWidth = font.widthOfTextAtSize(subtitleLabel, 11);
    ctx.page.drawText(subtitleLabel, {
        x: (pageSize[0] - subtitleWidth) / 2,
        y: ctx.cursorY - 38,
        size: 11,
        font: font,
        color: secondaryColor,
    });

    ctx.cursorY -= 50;

    // Línea divisoria
    drawHorizontalLine(ctx, primaryColor);
    ctx.cursorY -= 10;

    // === INFORMACIÓN DEL CLIENTE ===
    drawSectionTitleCompact(ctx, 'INFORMACION DEL CLIENTE');

    const clienteSection = getSection(payload, 'seccion_A_cliente');
    const clientName = clienteSection.nombre || client?.razon_social || 'Cliente no especificado';
    const clientAddress = getNestedValue(payload, 'direccion') || clienteSection.direccion || client?.direccion || 'Sin direccion';
    const clientPhone = getNestedValue(payload, 'cliente_telefono') || clienteSection.telefono || '';
    const serviceDate = clienteSection.fecha_servicio || maintenance.service_date;

    const clientTableData: string[][] = [
        ['Cliente', String(clientName)],
        ['Direccion', String(clientAddress)],
    ];
    if (clientPhone) clientTableData.push(['Telefono', String(clientPhone)]);
    clientTableData.push(['Fecha del Servicio', formatDateDisplay(serviceDate as string)]);
    clientTableData.push(['Estado', capitalize(maintenance.status || 'finalizado')]);

    drawCompactTable(ctx, clientTableData, [120, 360], false);
    ctx.cursorY -= 8;

    // === CONTENIDO ESPECÍFICO POR TIPO ===
    if (maintenanceType === 'softener') {
        await drawSoftenerContent(ctx, payload);
    } else {
        await drawROContent(ctx, payload);
    }

    // === FOOTER ===
    drawFooter(ctx, maintenance.id);

    return pdfDoc.save();
}

async function drawSoftenerContent(ctx: PdfContext, payload: Record<string, unknown>) {
    // === INFORMACIÓN DEL TÉCNICO ===
    const clienteSection = getSection(payload, 'seccion_A_cliente');
    const tecnico = clienteSection.tecnico || '';
    const contacto = clienteSection.contacto || '';
    const localidad = clienteSection.localidad || '';
    
    if (tecnico || contacto || localidad) {
        ensureSpace(ctx, 50);
        const infoAdicionalData: string[][] = [];
        if (tecnico) infoAdicionalData.push(['Tecnico Responsable', String(tecnico)]);
        if (contacto) infoAdicionalData.push(['Contacto en Sitio', String(contacto)]);
        if (localidad) infoAdicionalData.push(['Localidad', String(localidad)]);
        
        if (infoAdicionalData.length > 0) {
            drawCompactTable(ctx, infoAdicionalData, [150, 330], false);
            ctx.cursorY -= 6;
        }
    }

    // === INFORMACIÓN DEL EQUIPO ===
    ensureSpace(ctx, 100);
    const equipoSection = getSection(payload, 'seccion_B_equipo');
    const modelo = equipoSection.modelo || '';
    const nSerie = equipoSection.numero_serie || '';
    const tipoEquipo = equipoSection.tipo || 'Ablandador';
    const ubicacion = equipoSection.ubicacion || '';
    const volumenResina = equipoSection.volumen_resina || '';
    const tipoRegeneracion = equipoSection.tipo_regeneracion || '';
    const trenPrefiltrado = equipoSection.tren_prefiltrado as Record<string, unknown> | null;
    const prefiltro = formatPrefiltroEquipo(equipoSection.prefiltro, trenPrefiltrado);
    const proteccionEntrada = equipoSection.proteccion_entrada || '';
    const manometros = equipoSection.manometros || '';
    const notasEquipo = equipoSection.notas_equipo || '';
    
    drawSectionTitleCompact(ctx, 'INFORMACION DEL EQUIPO');
    const equipoData: string[][] = [
        ['Tipo', String(tipoEquipo), 'Modelo', String(modelo)],
        ['N. Serie', String(nSerie), 'Ubicacion', String(ubicacion)],
        ['Vol. Resina (L)', String(volumenResina), 'Regeneracion', String(tipoRegeneracion)],
        ['Prefiltro', String(prefiltro), 'Proteccion Entrada', String(proteccionEntrada) || 'N/A'],
    ];
    if (manometros) {
        equipoData.push(['Manometros', String(manometros), '', '']);
    }
    drawCompactTable4Col(ctx, equipoData);
    
    if (notasEquipo) {
        ctx.cursorY -= 2;
        ctx.page.drawText(`Notas: ${notasEquipo}`, {
            x: ctx.marginX,
            y: ctx.cursorY,
            size: 7,
            font: ctx.font,
            color: rgb(0.4, 0.4, 0.4),
        });
        ctx.cursorY -= 10;
    }
    ctx.cursorY -= 6;

    // === CONFIGURACIÓN DEL CABEZAL (As Found / As Left) ===
    const cabezalSection = getSection(payload, 'seccion_C_cabezal');
    if (Object.keys(cabezalSection).length > 0) {
        ensureSpace(ctx, 130);
        drawSectionTitleCompact(ctx, 'CONFIGURACION DEL CABEZAL');
        
        const cabezalData: string[][] = [
            ['Parametro', 'As Found', 'As Left'],
            ['Hora del Cabezal', String(cabezalSection.hora_cabezal_as_found || '-'), String(cabezalSection.hora_cabezal_as_left || '-')],
            ['Hora Regeneracion', String(cabezalSection.hora_regeneracion_as_found || '-'), String(cabezalSection.hora_regeneracion_as_left || '-')],
            ['P1 - Retrolavado (min)', formatNum(cabezalSection.p1_retrolavado_min_found), formatNum(cabezalSection.p1_retrolavado_min_left)],
            ['P2 - Salmuera (min)', formatNum(cabezalSection.p2_salmuera_min_found), formatNum(cabezalSection.p2_salmuera_min_left)],
            ['P3 - Enjuague (min)', formatNum(cabezalSection.p3_enjuague_min_found), formatNum(cabezalSection.p3_enjuague_min_left)],
            ['P4 - Llenado Salero (min)', formatNum(cabezalSection.p4_llenado_salero_min_found), formatNum(cabezalSection.p4_llenado_salero_min_left)],
        ];
        
        // Si es por tiempo, agregar frecuencia
        if (cabezalSection.frecuencia_dias_found || cabezalSection.frecuencia_dias_left) {
            cabezalData.push(['Frecuencia (dias)', formatNum(cabezalSection.frecuencia_dias_found), formatNum(cabezalSection.frecuencia_dias_left)]);
        }
        
        drawCompactTable(ctx, cabezalData, [180, 150, 150], true);
        ctx.cursorY -= 6;
    }

    // === PARÁMETROS DE OPERACIÓN ===
    const paramsOpSection = getSection(payload, 'seccion_B_parametros_operacion');
    if (Object.keys(paramsOpSection).length > 0) {
        ensureSpace(ctx, 80);
        drawSectionTitleCompact(ctx, 'PARAMETROS DE OPERACION');
        
        const paramsOpData: string[][] = [
            ['Parametro', 'As Found', 'As Left'],
            ['Presion Entrada (bar)', formatNum(paramsOpSection.presion_entrada_as_found), formatNum(paramsOpSection.presion_entrada_as_left)],
            ['Test Cloro Entrada (ppm)', formatNum(paramsOpSection.test_cloro_entrada_as_found), formatNum(paramsOpSection.test_cloro_entrada_as_left)],
            ['Dureza Salida (ppm)', formatNum(paramsOpSection.dureza_salida_as_found), formatNum(paramsOpSection.dureza_salida_as_left)],
        ];
        
        drawCompactTable(ctx, paramsOpData, [180, 150, 150], true);
        ctx.cursorY -= 6;
    }

    // === AUTONOMÍA ===
    const parametrosSection = getSection(payload, 'seccion_C_parametros');
    if (Object.keys(parametrosSection).length > 0) {
        ensureSpace(ctx, 70);
        drawSectionTitleCompact(ctx, 'CALCULO DE AUTONOMIA');
        
        const durezaCruda = parametrosSection.dureza_agua_cruda || '-';
        const autonomiaRest = parametrosSection.autonomia_restante || '-';
        const seteoActual = parametrosSection.seteo_actual_autonomia || '-';
        const autonomiaRec = parametrosSection.autonomia_recomendada || '-';
        const proteccion = parametrosSection.aplicar_proteccion_20 ? 'SI' : 'NO';
        const ajustado = parametrosSection.autonomia_ajustada_valor_calculado ? 'SI' : 'NO';
        
        const autonomiaData: string[][] = [
            ['Dureza Agua Cruda (ppm)', String(durezaCruda), 'Seteo Actual', String(seteoActual)],
            ['Autonomia Restante', String(autonomiaRest), 'Autonomia Recomendada', String(autonomiaRec)],
            ['Proteccion 20%', proteccion, 'Valor Ajustado', ajustado],
        ];
        drawCompactTable4Col(ctx, autonomiaData);
        ctx.cursorY -= 6;
    }

    // === CHECKLIST DE TAREAS ===
    const checklistSection = getSection(payload, 'seccion_D_checklist');
    if (Object.keys(checklistSection).length > 0) {
        ensureSpace(ctx, 80);
        drawSectionTitleCompact(ctx, 'TAREAS REALIZADAS');
        
        const tasks: [string, boolean][] = [
            ['Inspeccion de Fugas', !!checklistSection.inspeccion_fugas],
            ['Verificacion Hora Correcta', !!checklistSection.verificacion_hora],
            ['Limpieza Tanque Sal', !!checklistSection.limpieza_tanque_sal],
            ['Verificacion Nivel Agua', !!checklistSection.verificacion_nivel_agua],
            ['Carga de Sal', !!checklistSection.carga_sal],
            ['Verif. Parametros Ciclo', !!checklistSection.verificacion_parametros_ciclo],
            ['Ajuste Autonomia', !!checklistSection.ajuste_autonomia],
            ['Regeneracion Manual', !!checklistSection.regeneracion_manual],
        ];
        
        // Verificar si hay tren de prefiltrado
        const trenPrefiltradoChecklist = checklistSection.tren_prefiltrado as Record<string, unknown> | null;
        
        // Agregar cambio de filtro si aplica (modo simple o tren)
        if (trenPrefiltradoChecklist && trenPrefiltradoChecklist.es_tren) {
            // Modo tren: verificar si se cambiaron filtros
            const filtrosCambiados = (trenPrefiltradoChecklist.filtros_cambiados || []) as Array<Record<string, unknown>>;
            if (filtrosCambiados.length > 0) {
                tasks.push([`Cambio Filtros (${filtrosCambiados.length} etapas)`, true]);
            }
        } else if (checklistSection.cambio_filtro_realizado) {
            tasks.push(['Cambio de Filtro', true]);
        }
        
        drawCompactChecklistTable(ctx, tasks);
        
        // Mostrar detalles de cambio de filtro
        if (trenPrefiltradoChecklist && trenPrefiltradoChecklist.es_tren) {
            // Modo tren: mostrar cada filtro cambiado
            const filtrosCambiados = (trenPrefiltradoChecklist.filtros_cambiados || []) as Array<Record<string, unknown>>;
            if (filtrosCambiados.length > 0) {
                ctx.cursorY -= 4;
                ctx.page.drawText('Filtros reemplazados:', {
                    x: ctx.marginX,
                    y: ctx.cursorY,
                    size: 7,
                    font: ctx.fontBold,
                    color: rgb(0.2, 0.5, 0.2),
                });
                ctx.cursorY -= 10;
                
                filtrosCambiados.forEach(filtro => {
                    const etapaNum = filtro.etapa || '?';
                    const tipo = String(filtro.tipo || '-');
                    const lote = filtro.lote_serie ? ` (Lote: ${filtro.lote_serie})` : '';
                    ctx.page.drawText(`  • Etapa ${etapaNum}: ${tipo}${lote}`, {
                        x: ctx.marginX,
                        y: ctx.cursorY,
                        size: 7,
                        font: ctx.font,
                        color: rgb(0.2, 0.5, 0.2),
                    });
                    ctx.cursorY -= 10;
                });
            }
        } else if (checklistSection.cambio_filtro_realizado && (checklistSection.filtro_tipo_instalado || checklistSection.filtro_lote_serie)) {
            // Modo simple: mostrar detalle del filtro
            ctx.cursorY -= 4;
            const filtroInfo = `Filtro instalado: ${checklistSection.filtro_tipo_instalado || '-'} | Lote/Serie: ${checklistSection.filtro_lote_serie || '-'}`;
            ctx.page.drawText(filtroInfo, {
                x: ctx.marginX,
                y: ctx.cursorY,
                size: 7,
                font: ctx.font,
                color: rgb(0.2, 0.5, 0.2),
            });
            ctx.cursorY -= 10;
        }
        
        // Otros trabajos
        if (checklistSection.otros) {
            ctx.page.drawText(`Otros: ${checklistSection.otros}`, {
                x: ctx.marginX,
                y: ctx.cursorY,
                size: 7,
                font: ctx.font,
                color: rgb(0.3, 0.3, 0.3),
            });
            ctx.cursorY -= 10;
        }
        
        // Observaciones del checklist
        if (checklistSection.observaciones) {
            ctx.page.drawText(`Observaciones: ${checklistSection.observaciones}`, {
                x: ctx.marginX,
                y: ctx.cursorY,
                size: 7,
                font: ctx.font,
                color: rgb(0.3, 0.3, 0.3),
            });
            ctx.cursorY -= 10;
        }
        
        ctx.cursorY -= 4;
    }

    // === CONDICIONES DEL SITIO ===
    const condicionesSection = getSection(payload, 'seccion_F_condiciones');
    if (Object.keys(condicionesSection).length > 0) {
        const hasData = condicionesSection.presion_entrada_as_found || condicionesSection.presion_salida_as_found || 
                        condicionesSection.nivel_sal_as_found || condicionesSection.estado_gabinete ||
                        condicionesSection.temperatura_ambiente;
        if (hasData) {
            ensureSpace(ctx, 90);
            drawSectionTitleCompact(ctx, 'CONDICIONES DEL SITIO');
            
            const condData: string[][] = [
                ['', 'As Found', 'As Left'],
                ['Presion Entrada (bar)', formatNum(condicionesSection.presion_entrada_as_found), formatNum(condicionesSection.presion_entrada_as_left)],
                ['Presion Salida (bar)', formatNum(condicionesSection.presion_salida_as_found), formatNum(condicionesSection.presion_salida_as_left)],
                ['Nivel de Sal', String(condicionesSection.nivel_sal_as_found || '-'), String(condicionesSection.nivel_sal_as_left || '-')],
            ];
            
            drawCompactTable(ctx, condData, [180, 150, 150], true);
            
            // Info adicional de condiciones
            const condExtras: string[] = [];
            if (condicionesSection.temperatura_ambiente) condExtras.push(`Temp. Ambiente: ${condicionesSection.temperatura_ambiente}`);
            if (condicionesSection.estado_gabinete) condExtras.push(`Estado Gabinete: ${condicionesSection.estado_gabinete}`);
            
            if (condExtras.length > 0) {
                ctx.cursorY -= 2;
                ctx.page.drawText(condExtras.join(' | '), {
                    x: ctx.marginX,
                    y: ctx.cursorY,
                    size: 7,
                    font: ctx.font,
                    color: rgb(0.3, 0.3, 0.3),
                });
                ctx.cursorY -= 10;
            }
            
            // Observaciones de condiciones
            if (condicionesSection.observaciones) {
                ctx.page.drawText(`Obs: ${condicionesSection.observaciones}`, {
                    x: ctx.marginX,
                    y: ctx.cursorY,
                    size: 7,
                    font: ctx.font,
                    color: rgb(0.3, 0.3, 0.3),
                });
                ctx.cursorY -= 10;
            }
            ctx.cursorY -= 4;
        }
    }

    // === RESUMEN DEL SERVICIO ===
    const resumenSection = getSection(payload, 'seccion_E_resumen');
    const trabajoRealizado = resumenSection.trabajo_realizado || '';
    const recomendaciones = resumenSection.recomendaciones || '';
    const materiales = resumenSection.materiales || '';
    const comentariosCliente = resumenSection.comentarios_cliente || '';
    
    if (trabajoRealizado || recomendaciones || materiales || comentariosCliente) {
        ensureSpace(ctx, 60);
        drawSectionTitleCompact(ctx, 'RESUMEN DEL SERVICIO');
        
        if (trabajoRealizado) {
            ensureSpace(ctx, 40);
            ctx.page.drawText('Trabajo Realizado:', {
                x: ctx.marginX,
                y: ctx.cursorY,
                size: 7,
                font: ctx.fontBold,
                color: rgb(0.2, 0.2, 0.2),
            });
            ctx.cursorY -= 9;
            drawCompactParagraph(ctx, String(trabajoRealizado));
            ctx.cursorY -= 4;
        }
        
        if (recomendaciones) {
            ensureSpace(ctx, 40);
            ctx.page.drawText('Recomendaciones:', {
                x: ctx.marginX,
                y: ctx.cursorY,
                size: 7,
                font: ctx.fontBold,
                color: rgb(0.2, 0.2, 0.2),
            });
            ctx.cursorY -= 9;
            drawCompactParagraph(ctx, String(recomendaciones));
            ctx.cursorY -= 4;
        }
        
        if (materiales) {
            ensureSpace(ctx, 40);
            ctx.page.drawText('Materiales Utilizados:', {
                x: ctx.marginX,
                y: ctx.cursorY,
                size: 7,
                font: ctx.fontBold,
                color: rgb(0.2, 0.2, 0.2),
            });
            ctx.cursorY -= 9;
            drawCompactParagraph(ctx, String(materiales));
            ctx.cursorY -= 4;
        }
        
        if (comentariosCliente) {
            ensureSpace(ctx, 40);
            ctx.page.drawText('Comentarios del Cliente:', {
                x: ctx.marginX,
                y: ctx.cursorY,
                size: 7,
                font: ctx.fontBold,
                color: rgb(0.2, 0.2, 0.2),
            });
            ctx.cursorY -= 9;
            drawCompactParagraph(ctx, String(comentariosCliente));
            ctx.cursorY -= 4;
        }
    }

    // === PRÓXIMO MANTENIMIENTO ===
    const proximoMant = resumenSection.proximo_servicio;
    if (proximoMant) {
        ensureSpace(ctx, 40);
        drawSectionTitleCompact(ctx, 'PROXIMO MANTENIMIENTO');
        const proxManData: string[][] = [
            ['Fecha Programada', formatDateDisplay(String(proximoMant))],
        ];
        drawCompactTable(ctx, proxManData, [150, 330], false);
        ctx.cursorY -= 6;
    }

    // === CIERRE Y CONFORMIDAD ===
    const cierreSection = getSection(payload, 'seccion_G_cierre');
    if (Object.keys(cierreSection).length > 0) {
        const hasData = cierreSection.conformidad_cliente || cierreSection.representante_cliente || 
                        cierreSection.medio_confirmacion || cierreSection.requiere_seguimiento ||
                        cierreSection.observaciones_finales;
        if (hasData) {
            ensureSpace(ctx, 80);
            drawSectionTitleCompact(ctx, 'CIERRE Y CONFORMIDAD');
            
            const cierreData: string[][] = [];
            if (cierreSection.conformidad_cliente) {
                cierreData.push(['Conformidad del Cliente', String(cierreSection.conformidad_cliente)]);
            }
            if (cierreSection.representante_cliente) {
                cierreData.push(['Representante del Cliente', String(cierreSection.representante_cliente)]);
            }
            if (cierreSection.medio_confirmacion) {
                cierreData.push(['Medio de Confirmacion', String(cierreSection.medio_confirmacion)]);
            }
            if (cierreSection.requiere_seguimiento !== undefined) {
                cierreData.push(['Requiere Seguimiento', cierreSection.requiere_seguimiento ? 'SI' : 'NO']);
            }
            
            if (cierreData.length > 0) {
                drawCompactTable(ctx, cierreData, [180, 300], false);
            }
            
            if (cierreSection.observaciones_finales) {
                ensureSpace(ctx, 40);
                ctx.cursorY -= 4;
                ctx.page.drawText('Observaciones Finales:', {
                    x: ctx.marginX,
                    y: ctx.cursorY,
                    size: 7,
                    font: ctx.fontBold,
                    color: rgb(0.2, 0.2, 0.2),
                });
                ctx.cursorY -= 9;
                drawCompactParagraph(ctx, String(cierreSection.observaciones_finales));
            }
            ctx.cursorY -= 6;
        }
    }

    // === FIRMAS ===
    ensureSpace(ctx, 80);
    await drawSignatureSection(ctx, payload);
}

async function drawROContent(ctx: PdfContext, payload: Record<string, unknown>) {
    // === INFORMACIÓN DEL EQUIPO ===
    const modelo = payload.modelo || '';
    const nSerie = payload.n_serie || '';
    const idInterna = payload.id_interna || '';
    const tecnico = payload.tecnico || '';
    const proximoMant = payload.proximo_mant || '';

    if (modelo || nSerie || idInterna || tecnico) {
        drawSectionTitleCompact(ctx, 'INFORMACION DEL EQUIPO');
        const equipoData: string[][] = [];
        if (modelo) equipoData.push(['Modelo', String(modelo)]);
        if (nSerie) equipoData.push(['Numero de Serie', String(nSerie)]);
        if (idInterna) equipoData.push(['ID Interna / Activo', String(idInterna)]);
        if (tecnico) equipoData.push(['Tecnico Responsable', String(tecnico)]);
        
        drawCompactTable(ctx, equipoData, [150, 330], false);
        ctx.cursorY -= 8;
    }

    // === PARÁMETROS DE OPERACIÓN (TABLA AS FOUND / AS LEFT) ===
    drawSectionTitleCompact(ctx, 'PARAMETROS DE OPERACION');
    
    const paramsTableData: string[][] = [
        ['Parametro', 'As Found', 'As Left'],
        ['Fugas Visibles', String(payload.fugas_found || 'No'), String(payload.fugas_left || 'No')],
        ['Conductividad Red (uS/cm)', formatMetric(payload.cond_red_found), formatMetric(payload.cond_red_left)],
        ['Conductividad Permeado (uS/cm)', formatMetric(payload.cond_perm_found), formatMetric(payload.cond_perm_left)],
        ['% Rechazo Ionico', formatMetric(payload.rechazo_found, '%'), formatMetric(payload.rechazo_left, '%')],
        ['Presion Entrada (bar)', formatMetric(payload.presion_found, 'bar'), formatMetric(payload.presion_left, 'bar')],
        ['Caudal Permeado (l/min)', formatMetric(payload.caudal_perm_found), formatMetric(payload.caudal_perm_left)],
        ['Caudal Rechazo (l/min)', formatMetric(payload.caudal_rech_found), formatMetric(payload.caudal_rech_left)],
        ['Relacion Rechazo:Permeado', formatMetric(payload.relacion_found), formatMetric(payload.relacion_left)],
        ['Precarga Tanque (bar)', formatMetric(payload.precarga_found), formatMetric(payload.precarga_left)],
        ['Test Presostato Alta', formatPresostato(payload.presostato_alta_found), formatPresostato(payload.presostato_alta_left)],
        ['Test Presostato Baja', formatPresostato(payload.presostato_baja_found), formatPresostato(payload.presostato_baja_left)],
    ];

    drawCompactTable(ctx, paramsTableData, [180, 150, 150], true);
    ctx.cursorY -= 8;

    // === REGISTRO DE COMPONENTES + SANITIZACIÓN (en paralelo para ahorrar espacio) ===
    drawSectionTitleCompact(ctx, 'REGISTRO DE COMPONENTES');

    const componentStages = [
        { id: 'etapa1', title: '1. Sedimentos (PP)' },
        { id: 'etapa2', title: '2. Carbon Bloque (CTO)' },
        { id: 'etapa3', title: '3. Carbon GAC / PP' },
        { id: 'etapa4', title: '4. Membrana RO' },
        { id: 'etapa5', title: '5. Post-Filtro' },
        { id: 'etapa6', title: '6. Adicional' },
    ];

    const componentTableData: string[][] = [['Etapa', 'Detalles', 'Accion']];
    
    componentStages.forEach(stage => {
        const accion = String(payload[`${stage.id}_accion`] || 'Inspeccionado');
        const detalles = String(payload[`${stage.id}_detalles`] || '--');
        componentTableData.push([stage.title, detalles, accion]);
    });

    // Agregar sanitización como última fila de la tabla de componentes
    const sanitizacion = payload.sanitizacion || 'N/A';
    componentTableData.push(['Sanitizacion', '--', formatSanitizacion(sanitizacion)]);

    drawComponentsTableCompact(ctx, componentTableData);
    ctx.cursorY -= 8;

    // === OBSERVACIONES ===
    const resumen = payload.resumen as string || '';
    if (resumen) {
        drawSectionTitleCompact(ctx, 'OBSERVACIONES Y RECOMENDACIONES');
        drawCompactParagraph(ctx, resumen);
        ctx.cursorY -= 8;
    }

    // === PRÓXIMO MANTENIMIENTO ===
    if (proximoMant) {
        drawSectionTitleCompact(ctx, 'PROXIMO MANTENIMIENTO');
        const proxManData: string[][] = [
            ['Fecha Programada', formatDateDisplay(String(proximoMant))],
        ];
        drawCompactTable(ctx, proxManData, [150, 330], false);
        ctx.cursorY -= 8;
    }

    // === FIRMAS ===
    await drawSignatureSection(ctx, payload);
}

// Título de sección compacto
function drawSectionTitleCompact(ctx: PdfContext, title: string) {
    ctx.cursorY -= 4;
    ctx.page.drawText(title, {
        x: ctx.marginX,
        y: ctx.cursorY,
        size: 9,
        font: ctx.fontBold,
        color: ctx.primaryColor,
    });
    ctx.cursorY -= 12;
}

// Tabla compacta con bordes - offsets ajustados para evitar superposicion
function drawCompactTable(ctx: PdfContext, data: string[][], colWidths: number[], hasHeader: boolean) {
    const rowHeight = 14;
    const padding = 4;
    const startX = ctx.marginX;
    const tableWidth = colWidths.reduce((a, b) => a + b, 0);
    const borderColor = rgb(0.78, 0.78, 0.78);
    const headerBg = rgb(0.94, 0.94, 0.97);

    data.forEach((row, rowIndex) => {
        const rowY = ctx.cursorY;
        let xOffset = startX;
        const isHeader = hasHeader && rowIndex === 0;

        // Fondo del header
        if (isHeader) {
            ctx.page.drawRectangle({
                x: startX,
                y: rowY - rowHeight + 4,
                width: tableWidth,
                height: rowHeight,
                color: headerBg,
            });
        }

        // Dibujar celdas
        row.forEach((cell, colIndex) => {
            // Borde izquierdo
            ctx.page.drawLine({
                start: { x: xOffset, y: rowY + 4 },
                end: { x: xOffset, y: rowY - rowHeight + 4 },
                thickness: 0.5,
                color: borderColor,
            });

            // Texto - usar fuente adaptativa si es necesario
            let displayText = cell;
            let fontSize = 8;
            const maxTextWidth = colWidths[colIndex] - padding * 2;
            
            // Reducir fuente antes de truncar
            if (ctx.font.widthOfTextAtSize(displayText, fontSize) > maxTextWidth) {
                fontSize = 7;
            }
            if (ctx.font.widthOfTextAtSize(displayText, fontSize) > maxTextWidth) {
                fontSize = 6;
            }
            // Solo truncar si aun no cabe
            if (ctx.font.widthOfTextAtSize(displayText, fontSize) > maxTextWidth && displayText.length > 3) {
                while (ctx.font.widthOfTextAtSize(displayText, fontSize) > maxTextWidth && displayText.length > 3) {
                    displayText = displayText.slice(0, -4) + '...';
                }
            }

            ctx.page.drawText(displayText, {
                x: xOffset + padding,
                y: rowY - 9,
                size: fontSize,
                font: isHeader ? ctx.fontBold : ctx.font,
                color: isHeader ? ctx.primaryColor : rgb(0.15, 0.15, 0.15),
            });

            xOffset += colWidths[colIndex];
        });

        // Borde derecho
        ctx.page.drawLine({
            start: { x: startX + tableWidth, y: rowY + 4 },
            end: { x: startX + tableWidth, y: rowY - rowHeight + 4 },
            thickness: 0.5,
            color: borderColor,
        });

        // Borde superior (primera fila)
        if (rowIndex === 0) {
            ctx.page.drawLine({
                start: { x: startX, y: rowY + 4 },
                end: { x: startX + tableWidth, y: rowY + 4 },
                thickness: 0.5,
                color: borderColor,
            });
        }

        // Borde inferior
        ctx.page.drawLine({
            start: { x: startX, y: rowY - rowHeight + 4 },
            end: { x: startX + tableWidth, y: rowY - rowHeight + 4 },
            thickness: 0.5,
            color: borderColor,
        });

        ctx.cursorY -= rowHeight;
    });
}

// Tabla compacta de 4 columnas para datos de equipo - anchos ajustados para mejor legibilidad
function drawCompactTable4Col(ctx: PdfContext, data: string[][]) {
    const colWidths = [130, 110, 130, 110]; // Labels mas anchos, valores mas compactos
    const rowHeight = 16;
    const padding = 5;
    const startX = ctx.marginX;
    const tableWidth = colWidths.reduce((a, b) => a + b, 0);
    const borderColor = rgb(0.75, 0.75, 0.75);
    const labelBg = rgb(0.95, 0.95, 0.98);

    data.forEach((row, rowIndex) => {
        const rowY = ctx.cursorY;
        let xOffset = startX;

        // Fondo alternado para filas
        if (rowIndex % 2 === 1) {
            ctx.page.drawRectangle({
                x: startX,
                y: rowY - rowHeight + 4,
                width: tableWidth,
                height: rowHeight,
                color: rgb(0.98, 0.98, 0.99),
            });
        }

        row.forEach((cell, colIndex) => {
            const isLabel = colIndex === 0 || colIndex === 2;
            
            // Fondo para labels
            if (isLabel && cell) {
                ctx.page.drawRectangle({
                    x: xOffset,
                    y: rowY - rowHeight + 4,
                    width: colWidths[colIndex],
                    height: rowHeight,
                    color: labelBg,
                });
            }

            // Borde izquierdo
            ctx.page.drawLine({
                start: { x: xOffset, y: rowY + 4 },
                end: { x: xOffset, y: rowY - rowHeight + 4 },
                thickness: 0.5,
                color: borderColor,
            });

            // Texto - sin truncar, usar fuente mas pequena si es necesario
            if (cell) {
                let displayText = cell;
                let fontSize = 8;
                const maxTextWidth = colWidths[colIndex] - padding * 2;
                
                // Reducir fuente si el texto es muy largo
                if (ctx.font.widthOfTextAtSize(displayText, fontSize) > maxTextWidth) {
                    fontSize = 7;
                }
                if (ctx.font.widthOfTextAtSize(displayText, fontSize) > maxTextWidth) {
                    fontSize = 6;
                }

                ctx.page.drawText(displayText, {
                    x: xOffset + padding,
                    y: rowY - 10,
                    size: fontSize,
                    font: isLabel ? ctx.fontBold : ctx.font,
                    color: isLabel ? ctx.primaryColor : rgb(0.15, 0.15, 0.15),
                });
            }

            xOffset += colWidths[colIndex];
        });

        // Borde derecho
        ctx.page.drawLine({
            start: { x: startX + tableWidth, y: rowY + 4 },
            end: { x: startX + tableWidth, y: rowY - rowHeight + 4 },
            thickness: 0.5,
            color: borderColor,
        });

        // Borde superior (primera fila)
        if (rowIndex === 0) {
            ctx.page.drawLine({
                start: { x: startX, y: rowY + 4 },
                end: { x: startX + tableWidth, y: rowY + 4 },
                thickness: 0.5,
                color: borderColor,
            });
        }

        // Borde inferior
        ctx.page.drawLine({
            start: { x: startX, y: rowY - rowHeight + 4 },
            end: { x: startX + tableWidth, y: rowY - rowHeight + 4 },
            thickness: 0.5,
            color: borderColor,
        });

        ctx.cursorY -= rowHeight;
    });
}

// Checklist compacto en formato tabla (2 columnas) con mejor diseño
function drawCompactChecklistTable(ctx: PdfContext, tasks: [string, boolean][]) {
    const colWidth = 240;
    const rowHeight = 14;
    const padding = 6;
    const startX = ctx.marginX;
    const tableWidth = colWidth * 2;
    const borderColor = rgb(0.8, 0.8, 0.8);
    const bgColor = rgb(0.98, 0.98, 0.99);
    
    // Dividir tareas en dos columnas
    const midPoint = Math.ceil(tasks.length / 2);
    const leftTasks = tasks.slice(0, midPoint);
    const rightTasks = tasks.slice(midPoint);
    
    const maxRows = Math.max(leftTasks.length, rightTasks.length);
    const totalHeight = maxRows * rowHeight;
    
    // Fondo del checklist
    ctx.page.drawRectangle({
        x: startX,
        y: ctx.cursorY - totalHeight + 4,
        width: tableWidth,
        height: totalHeight,
        color: bgColor,
        borderColor: borderColor,
        borderWidth: 0.5,
    });
    
    // Linea divisoria vertical entre columnas
    ctx.page.drawLine({
        start: { x: startX + colWidth, y: ctx.cursorY + 4 },
        end: { x: startX + colWidth, y: ctx.cursorY - totalHeight + 4 },
        thickness: 0.5,
        color: borderColor,
    });
    
    for (let i = 0; i < maxRows; i++) {
        const rowY = ctx.cursorY;
        
        // Columna izquierda
        if (leftTasks[i]) {
            const [taskName, isDone] = leftTasks[i];
            const checkMark = isDone ? '[X]' : '[ ]';
            const textColor = isDone ? rgb(0.1, 0.45, 0.1) : rgb(0.45, 0.45, 0.45);
            const fontToUse = isDone ? ctx.fontBold : ctx.font;
            
            ctx.page.drawText(`${checkMark} ${taskName}`, {
                x: startX + padding,
                y: rowY - 10,
                size: 8,
                font: fontToUse,
                color: textColor,
            });
        }
        
        // Columna derecha
        if (rightTasks[i]) {
            const [taskName, isDone] = rightTasks[i];
            const checkMark = isDone ? '[X]' : '[ ]';
            const textColor = isDone ? rgb(0.1, 0.45, 0.1) : rgb(0.45, 0.45, 0.45);
            const fontToUse = isDone ? ctx.fontBold : ctx.font;
            
            ctx.page.drawText(`${checkMark} ${taskName}`, {
                x: startX + colWidth + padding,
                y: rowY - 10,
                size: 8,
                font: fontToUse,
                color: textColor,
            });
        }
        
        ctx.cursorY -= rowHeight;
    }
    
    ctx.cursorY -= 2; // Pequeño espacio despues del checklist
}

// Tabla de componentes compacta con colores - offsets ajustados
function drawComponentsTableCompact(ctx: PdfContext, data: string[][]) {
    const colWidths = [140, 200, 140];
    const rowHeight = 14;
    const padding = 4;
    const startX = ctx.marginX;
    const tableWidth = colWidths.reduce((a, b) => a + b, 0);
    const borderColor = rgb(0.78, 0.78, 0.78);
    const headerBg = rgb(0.94, 0.94, 0.97);

    data.forEach((row, rowIndex) => {
        const rowY = ctx.cursorY;
        let xOffset = startX;
        const isHeader = rowIndex === 0;
        const isSanitizacion = row[0] === 'Sanitizacion';

        // Fondo del header o sanitización
        if (isHeader) {
            ctx.page.drawRectangle({
                x: startX,
                y: rowY - rowHeight + 4,
                width: tableWidth,
                height: rowHeight,
                color: headerBg,
            });
        } else if (isSanitizacion) {
            ctx.page.drawRectangle({
                x: startX,
                y: rowY - rowHeight + 4,
                width: tableWidth,
                height: rowHeight,
                color: rgb(0.96, 0.96, 0.99),
            });
        }

        // Dibujar celdas
        row.forEach((cell, colIndex) => {
            const isAccionCol = colIndex === 2 && !isHeader;
            const isCambiado = isAccionCol && cell.toLowerCase().includes('cambiado');
            const isRealizada = isAccionCol && cell.toLowerCase().includes('realizada');
            
            // Borde izquierdo
            ctx.page.drawLine({
                start: { x: xOffset, y: rowY + 4 },
                end: { x: xOffset, y: rowY - rowHeight + 4 },
                thickness: 0.5,
                color: borderColor,
            });

            // Color del texto
            let textColor = rgb(0.15, 0.15, 0.15);
            let useFont = ctx.font;
            if (isHeader) {
                textColor = ctx.primaryColor;
                useFont = ctx.fontBold;
            } else if (isCambiado) {
                textColor = rgb(0.85, 0.45, 0.05);
                useFont = ctx.fontBold;
            } else if (isAccionCol && !isCambiado) {
                textColor = isRealizada ? rgb(0.15, 0.55, 0.15) : rgb(0.15, 0.55, 0.15);
            }

            // Texto - usar fuente adaptativa
            let displayText = cell;
            let fontSize = 8;
            const maxTextWidth = colWidths[colIndex] - padding * 2;
            
            if (ctx.font.widthOfTextAtSize(displayText, fontSize) > maxTextWidth) {
                fontSize = 7;
            }
            if (ctx.font.widthOfTextAtSize(displayText, fontSize) > maxTextWidth) {
                fontSize = 6;
            }
            if (ctx.font.widthOfTextAtSize(displayText, fontSize) > maxTextWidth && displayText.length > 3) {
                while (ctx.font.widthOfTextAtSize(displayText, fontSize) > maxTextWidth && displayText.length > 3) {
                    displayText = displayText.slice(0, -4) + '...';
                }
            }

            ctx.page.drawText(displayText, {
                x: xOffset + padding,
                y: rowY - 9,
                size: fontSize,
                font: useFont,
                color: textColor,
            });

            xOffset += colWidths[colIndex];
        });

        // Borde derecho
        ctx.page.drawLine({
            start: { x: startX + tableWidth, y: rowY + 4 },
            end: { x: startX + tableWidth, y: rowY - rowHeight + 4 },
            thickness: 0.5,
            color: borderColor,
        });

        // Borde superior (primera fila)
        if (rowIndex === 0) {
            ctx.page.drawLine({
                start: { x: startX, y: rowY + 4 },
                end: { x: startX + tableWidth, y: rowY + 4 },
                thickness: 0.5,
                color: borderColor,
            });
        }

        // Borde inferior
        ctx.page.drawLine({
            start: { x: startX, y: rowY - rowHeight + 4 },
            end: { x: startX + tableWidth, y: rowY - rowHeight + 4 },
            thickness: 0.5,
            color: borderColor,
        });

        ctx.cursorY -= rowHeight;
    });
}

// Párrafo compacto con borde
function drawCompactParagraph(ctx: PdfContext, text: string) {
    const boxWidth = ctx.maxWidth;
    const padding = 6;
    const lineHeight = 11;
    const borderColor = rgb(0.78, 0.78, 0.78);
    const bgColor = rgb(0.98, 0.98, 0.98);
    
    const lines = wrapText(text, ctx.font, 8, boxWidth - padding * 2);
    const boxHeight = Math.max(lines.length * lineHeight + padding * 2, 22);
    
    // Fondo
    ctx.page.drawRectangle({
        x: ctx.marginX,
        y: ctx.cursorY - boxHeight + 4,
        width: boxWidth,
        height: boxHeight,
        color: bgColor,
        borderColor: borderColor,
        borderWidth: 0.5,
    });
    
    // Texto
    let textY = ctx.cursorY - padding - 4;
    lines.forEach(line => {
        ctx.page.drawText(line, {
            x: ctx.marginX + padding,
            y: textY,
            size: 8,
            font: ctx.font,
            color: rgb(0.15, 0.15, 0.15),
        });
        textY -= lineHeight;
    });
    
    ctx.cursorY -= boxHeight;
}

// Sección de firmas
async function drawSignatureSection(ctx: PdfContext, payload: Record<string, unknown>) {
    ctx.cursorY -= 15;
    
    const lineWidth = 180;
    const leftX = ctx.marginX + 30;
    const rightX = ctx.marginX + ctx.maxWidth - lineWidth - 30;
    const signatureHeight = 40;
    const lineY = ctx.cursorY - signatureHeight - 10;
    
    // Obtener firmas del payload
    const firmas = payload.firmas as Record<string, unknown> | undefined;
    const firmaTecnico = firmas?.tecnico as Record<string, unknown> | undefined;
    const firmaCliente = firmas?.cliente as Record<string, unknown> | undefined;
    
    // === FIRMA DEL TÉCNICO (izquierda) ===
    if (firmaTecnico?.imagen) {
        try {
            const imageData = String(firmaTecnico.imagen);
            // Remover el prefijo data:image/png;base64, si existe
            const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
            const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
            const signatureImage = await ctx.pdfDoc.embedPng(imageBytes);
            
            // Calcular dimensiones manteniendo aspecto
            const aspectRatio = signatureImage.width / signatureImage.height;
            let imgWidth = lineWidth - 20;
            let imgHeight = imgWidth / aspectRatio;
            if (imgHeight > signatureHeight) {
                imgHeight = signatureHeight;
                imgWidth = imgHeight * aspectRatio;
            }
            
            // Dibujar imagen de firma
            ctx.page.drawImage(signatureImage, {
                x: leftX + (lineWidth - imgWidth) / 2,
                y: lineY + 5,
                width: imgWidth,
                height: imgHeight,
            });
        } catch (e) {
            console.warn('No se pudo cargar firma del tecnico:', e);
        }
    }
    
    // Línea firma técnico
    ctx.page.drawLine({
        start: { x: leftX, y: lineY },
        end: { x: leftX + lineWidth, y: lineY },
        thickness: 0.5,
        color: rgb(0.4, 0.4, 0.4),
    });
    
    // Texto firma técnico
    const tecnicoNombre = firmaTecnico?.nombre ? String(firmaTecnico.nombre) : '';
    ctx.page.drawText(tecnicoNombre || 'Firma del Tecnico', {
        x: leftX + (tecnicoNombre ? 10 : 50),
        y: lineY - 12,
        size: 8,
        font: ctx.font,
        color: rgb(0.4, 0.4, 0.4),
    });
    
    // === FIRMA DEL CLIENTE (derecha) ===
    if (firmaCliente?.imagen) {
        try {
            const imageData = String(firmaCliente.imagen);
            const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
            const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
            const signatureImage = await ctx.pdfDoc.embedPng(imageBytes);
            
            const aspectRatio = signatureImage.width / signatureImage.height;
            let imgWidth = lineWidth - 20;
            let imgHeight = imgWidth / aspectRatio;
            if (imgHeight > signatureHeight) {
                imgHeight = signatureHeight;
                imgWidth = imgHeight * aspectRatio;
            }
            
            ctx.page.drawImage(signatureImage, {
                x: rightX + (lineWidth - imgWidth) / 2,
                y: lineY + 5,
                width: imgWidth,
                height: imgHeight,
            });
        } catch (e) {
            console.warn('No se pudo cargar firma del cliente:', e);
        }
    }
    
    // Línea firma cliente
    ctx.page.drawLine({
        start: { x: rightX, y: lineY },
        end: { x: rightX + lineWidth, y: lineY },
        thickness: 0.5,
        color: rgb(0.4, 0.4, 0.4),
    });
    
    // Texto firma cliente
    const clienteNombre = firmaCliente?.nombre ? String(firmaCliente.nombre) : '';
    ctx.page.drawText(clienteNombre || 'Firma y Aclaracion del Cliente', {
        x: rightX + (clienteNombre ? 10 : 25),
        y: lineY - 12,
        size: 8,
        font: ctx.font,
        color: rgb(0.4, 0.4, 0.4),
    });
    
    ctx.cursorY = lineY - 25;
}

function formatPresostato(value: unknown): string {
    if (value === null || value === undefined || value === '') return 'N/A';
    const strValue = String(value);
    if (strValue === 'No Aplica' || strValue === 'N/A') return 'N/A';
    return strValue;
}

function formatSanitizacion(value: unknown): string {
    if (value === null || value === undefined || value === '' || value === 'N/A') return 'No Aplica';
    const strValue = String(value);
    if (strValue === 'Realizada') return '[SI] Realizada';
    if (strValue === 'No Realizada') return '[!] No Realizada (Pendiente)';
    return strValue;
}

// === HELPER FUNCTIONS ===

function getSection(payload: Record<string, unknown>, key: string): Record<string, unknown> {
    const section = payload[key];
    if (section && typeof section === 'object' && !Array.isArray(section)) {
        return section as Record<string, unknown>;
    }
    return {};
}

function getNestedValue(obj: Record<string, unknown>, path: string): string {
    const parts = path.split('.');
    let current: unknown = obj;
    for (const part of parts) {
        if (current && typeof current === 'object' && part in (current as Record<string, unknown>)) {
            current = (current as Record<string, unknown>)[part];
        } else {
            return '';
        }
    }
    return typeof current === 'string' ? current : '';
}

function drawSectionTitle(ctx: PdfContext, title: string) {
    ensureSpace(ctx, 30);
    ctx.page.drawText(title, {
        x: ctx.marginX,
        y: ctx.cursorY,
        size: 11,
        font: ctx.fontBold,
        color: ctx.primaryColor,
    });
    ctx.cursorY -= 18;
}

function drawInfoRow(ctx: PdfContext, label: string, value: string) {
    ensureSpace(ctx, 16);
    const labelWidth = 180;

    ctx.page.drawText(label + ':', {
        x: ctx.marginX,
        y: ctx.cursorY,
        size: 10,
        font: ctx.fontBold,
        color: ctx.secondaryColor,
    });

    const lines = wrapText(value, ctx.font, 10, ctx.maxWidth - labelWidth);
    lines.forEach((line, i) => {
        ctx.page.drawText(line, {
            x: ctx.marginX + labelWidth,
            y: ctx.cursorY - (i * 12),
            size: 10,
            font: ctx.font,
            color: rgb(0, 0, 0),
        });
    });

    ctx.cursorY -= 14 + (lines.length - 1) * 12;
}

function drawTable(ctx: PdfContext, data: string[][]) {
    const colWidths = [180, 100, 100];
    const rowHeight = 16;
    const startX = ctx.marginX;

    data.forEach((row, rowIndex) => {
        ensureSpace(ctx, rowHeight + 8);
        let xOffset = startX;

        row.forEach((cell, colIndex) => {
            const isHeader = rowIndex === 0;
            ctx.page.drawText(cell, {
                x: xOffset + 5,
                y: ctx.cursorY,
                size: 9,
                font: isHeader ? ctx.fontBold : ctx.font,
                color: isHeader ? ctx.primaryColor : rgb(0, 0, 0),
            });
            xOffset += colWidths[colIndex];
        });

        ctx.cursorY -= rowHeight;

        // Línea bajo el header
        if (rowIndex === 0) {
            ctx.page.drawLine({
                start: { x: startX, y: ctx.cursorY + 4 },
                end: { x: startX + colWidths.reduce((a, b) => a + b, 0), y: ctx.cursorY + 4 },
                thickness: 0.5,
                color: ctx.secondaryColor,
            });
            ctx.cursorY -= 2;
        }
    });
}

function drawChecklist(ctx: PdfContext, items: [string, unknown][]) {
    const colWidth = 220;
    let col = 0;

    items.forEach(([label, value]) => {
        if (value === undefined) return;

        ensureSpace(ctx, 18);
        const checkMark = value ? '[X]' : '[ ]';
        const xPos = ctx.marginX + (col * colWidth);

        ctx.page.drawText(`${checkMark} ${label}`, {
            x: xPos,
            y: ctx.cursorY,
            size: 10,
            font: ctx.font,
            color: value ? rgb(0.1, 0.5, 0.1) : ctx.secondaryColor,
        });

        col++;
        if (col >= 2) {
            col = 0;
            ctx.cursorY -= 16;
        }
    });

    if (col !== 0) ctx.cursorY -= 16;
}

function drawParagraph(ctx: PdfContext, text: string) {
    const lines = wrapText(text, ctx.font, 10, ctx.maxWidth);
    lines.forEach(line => {
        ensureSpace(ctx, 14);
        ctx.page.drawText(line, {
            x: ctx.marginX,
            y: ctx.cursorY,
            size: 10,
            font: ctx.font,
            color: rgb(0, 0, 0),
        });
        ctx.cursorY -= 14;
    });
}

function drawHorizontalLine(ctx: PdfContext, color: ReturnType<typeof rgb>) {
    ctx.page.drawLine({
        start: { x: ctx.marginX, y: ctx.cursorY },
        end: { x: ctx.pageSize[0] - ctx.marginX, y: ctx.cursorY },
        thickness: 1,
        color,
    });
}

function drawFooter(ctx: PdfContext, maintenanceId: string) {
    const footerY = 30;
    const now = new Date().toLocaleString('es-AR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });

    ctx.page.drawText(`Generado: ${now}  |  ID: ${maintenanceId}`, {
        x: ctx.marginX,
        y: footerY,
        size: 8,
        font: ctx.font,
        color: ctx.secondaryColor,
    });

    ctx.page.drawText('OHM Agua - Tratamiento de Agua', {
        x: ctx.pageSize[0] - ctx.marginX - 150,
        y: footerY,
        size: 8,
        font: ctx.font,
        color: ctx.secondaryColor,
    });
}

function ensureSpace(ctx: PdfContext, needed: number) {
    if (ctx.cursorY - needed <= 50) {
        ctx.page = ctx.pdfDoc.addPage(ctx.pageSize);
        ctx.cursorY = ctx.pageSize[1] - 50;
    }
}

function formatDateDisplay(value?: string | null): string {
    if (!value) return 'Sin fecha';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('es-AR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
}

/**
 * Formatea el prefiltro del equipo, soportando modo simple y tren
 */
function formatPrefiltroEquipo(prefiltroSimple: unknown, trenData: Record<string, unknown> | null): string {
    // Verificar si es modo tren
    if (trenData && trenData.es_tren) {
        // Obtener etapas - puede venir como array de objetos o array de strings
        const etapas = (trenData.etapas || trenData.etapas_configuradas || []) as Array<unknown>;
        if (etapas.length > 0) {
            // Formato compacto para el PDF
            const etapasTexto = etapas.map((e, i) => {
                // e puede ser un objeto {etapa, tipo} o un string directamente
                const tipo = (typeof e === 'object' && e !== null) 
                    ? ((e as Record<string, unknown>).tipo || e) 
                    : e;
                return `${i + 1}.${String(tipo).split(' - ')[0]}`; // Solo el tipo sin tamaño para ahorrar espacio
            }).join(' / ');
            const numEtapas = trenData.num_etapas || trenData.total_etapas || etapas.length;
            return `Tren ${numEtapas} etapas: ${etapasTexto}`;
        }
    }
    
    // Modo simple
    return prefiltroSimple ? String(prefiltroSimple) : 'Sin prefiltro';
}

function formatNum(value: unknown): string {
    if (value === null || value === undefined || value === '') return 'N/D';
    return String(value);
}

function formatMetric(value: unknown, unit?: string): string {
    if (value === null || value === undefined || value === '') return 'N/D';
    const numberValue = Number(value);
    if (Number.isNaN(numberValue)) return typeof value === 'string' ? value : 'N/D';
    const formatted = Number.isInteger(numberValue) ? numberValue.toString() : numberValue.toFixed(2);
    return unit ? `${formatted} ${unit}` : formatted;
}

function capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    words.forEach(word => {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const width = font.widthOfTextAtSize(testLine, size);
        if (width <= maxWidth) {
            currentLine = testLine;
        } else {
            if (currentLine) lines.push(currentLine);
            currentLine = word;
        }
    });

    if (currentLine) lines.push(currentLine);
    return lines;
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
