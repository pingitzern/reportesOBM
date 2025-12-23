/**
 * Edge Function para envío de emails con Resend
 * 
 * Endpoints:
 *   POST /send-email  - Enviar email
 * 
 * Tipos de email soportados:
 *   - remito: Envío de remito con PDF adjunto
 *   - reporte: Envío de reporte de mantenimiento
 *   - notificacion: Notificación general
 *   - custom: Email personalizado
 */

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const FROM_EMAIL = 'OHM Instrumental <notificaciones@ohminstrumental.net>';

interface EmailPayload {
    type: 'remito' | 'reporte' | 'notificacion' | 'custom' | 'wo-tecnico' | 'wo-cliente' | 'wo-cancelacion' | 'wo-cancelacion-cliente' | 'wo-confirmar-cliente' | 'wo-confirmada-interno' | 'wo-rechazada-interno' | 'feedback-notificacion';
    to: string | string[];
    subject?: string;
    data?: Record<string, unknown>;
    attachments?: Array<{
        filename: string;
        content: string; // Base64 encoded
        contentType?: string;
    }>;
    // Para custom
    html?: string;
    text?: string;
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
        const payload: EmailPayload = await req.json();

        if (!payload.to) {
            return jsonResponse({ error: 'Se requiere destinatario (to)' }, 400);
        }

        if (!payload.type) {
            return jsonResponse({ error: 'Se requiere tipo de email (type)' }, 400);
        }

        // Generar contenido del email según el tipo
        const emailContent = generateEmailContent(payload);

        // Preparar request a Resend
        const resendPayload: Record<string, unknown> = {
            from: FROM_EMAIL,
            to: Array.isArray(payload.to) ? payload.to : [payload.to],
            subject: emailContent.subject,
            html: emailContent.html,
        };

        // Agregar texto plano si existe
        if (emailContent.text) {
            resendPayload.text = emailContent.text;
        }

        // Agregar adjuntos si existen
        if (payload.attachments && payload.attachments.length > 0) {
            resendPayload.attachments = payload.attachments.map(att => ({
                filename: att.filename,
                content: att.content,
                content_type: att.contentType || 'application/pdf',
            }));
        }

        // Enviar email via Resend
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(resendPayload),
        });

        const result = await response.json();

        if (!response.ok) {
            console.error('Resend error:', result);
            return jsonResponse({
                error: result.message || 'Error al enviar email',
                details: result
            }, response.status);
        }

        return jsonResponse({
            success: true,
            message: 'Email enviado exitosamente',
            emailId: result.id,
            to: payload.to,
        });

    } catch (error) {
        console.error('send-email error:', error);
        return jsonResponse({
            error: error instanceof Error ? error.message : 'Error inesperado'
        }, 500);
    }
});

function generateEmailContent(payload: EmailPayload): { subject: string; html: string; text?: string } {
    const { type, data, subject } = payload;

    switch (type) {
        case 'remito':
            return generateRemitoEmail(data || {}, subject);

        case 'reporte':
            return generateReporteEmail(data || {}, subject);

        case 'notificacion':
            return generateNotificacionEmail(data || {}, subject);

        case 'wo-tecnico':
            return generateWOTecnicoEmail(data || {}, subject);

        case 'wo-cliente':
            return generateWOClienteEmail(data || {}, subject);

        case 'wo-cancelacion':
            return generateWOCancelacionEmail(data || {}, subject);

        case 'wo-cancelacion-cliente':
            return generateWOCancelacionClienteEmail(data || {}, subject);

        case 'wo-confirmar-cliente':
            return generateWOConfirmarClienteEmail(data || {}, subject);

        case 'wo-confirmada-interno':
            return generateWOConfirmadaInternoEmail(data || {}, subject);

        case 'wo-rechazada-interno':
            return generateWORechazadaInternoEmail(data || {}, subject);

        case 'feedback-notificacion':
            return generateFeedbackNotificacionEmail(data || {}, subject);

        case 'custom':
            return {
                subject: subject || 'Mensaje de OHM Instrumental',
                html: payload.html || '<p>Sin contenido</p>',
                text: payload.text,
            };

        default:
            return {
                subject: subject || 'Mensaje de OHM Instrumental',
                html: '<p>Sin contenido</p>',
            };
    }
}

function generateRemitoEmail(data: Record<string, unknown>, customSubject?: string): { subject: string; html: string; text: string } {
    const cliente = data.cliente as string || 'Cliente';
    const numeroRemito = data.numeroRemito as string || '';
    const fecha = data.fecha as string || new Date().toLocaleDateString('es-AR');
    const tecnico = data.tecnico as string || '';
    const descripcion = data.descripcion as string || '';

    const subject = customSubject || `Remito ${numeroRemito} - OHM Instrumental`;

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f4f5;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">OHM Instrumental</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 14px;">Remito de Servicio</p>
        </div>
        
        <!-- Content -->
        <div style="background: white; padding: 30px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <p style="color: #374151; font-size: 16px; margin: 0 0 20px 0;">
                Estimado/a <strong>${cliente}</strong>,
            </p>
            
            <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
                Adjunto encontrará el remito correspondiente al servicio realizado.
            </p>
            
            <!-- Info Box -->
            <div style="background: #f9fafb; border-radius: 12px; padding: 20px; margin: 20px 0;">
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Remito N°:</td>
                        <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600; text-align: right;">${numeroRemito}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Fecha:</td>
                        <td style="padding: 8px 0; color: #111827; font-size: 14px; text-align: right;">${fecha}</td>
                    </tr>
                    ${tecnico ? `
                    <tr>
                        <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Técnico:</td>
                        <td style="padding: 8px 0; color: #111827; font-size: 14px; text-align: right;">${tecnico}</td>
                    </tr>
                    ` : ''}
                </table>
            </div>
            
            ${descripcion ? `
            <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 20px 0;">
                <strong>Descripción:</strong><br>
                ${descripcion}
            </p>
            ` : ''}
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            
            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
                Este es un email automático. Por favor no responda a este mensaje.<br>
                Si tiene alguna consulta, contáctenos a <a href="mailto:info@ohminstrumental.net" style="color: #4f46e5;">info@ohminstrumental.net</a>
            </p>
        </div>
        
        <!-- Footer -->
        <div style="text-align: center; padding: 20px;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                © ${new Date().getFullYear()} OHM Instrumental. Todos los derechos reservados.
            </p>
        </div>
    </div>
</body>
</html>`;

    const text = `
OHM Instrumental - Remito de Servicio

Estimado/a ${cliente},

Adjunto encontrará el remito correspondiente al servicio realizado.

Remito N°: ${numeroRemito}
Fecha: ${fecha}
${tecnico ? `Técnico: ${tecnico}` : ''}
${descripcion ? `Descripción: ${descripcion}` : ''}

---
Este es un email automático. Por favor no responda a este mensaje.
Si tiene alguna consulta, contáctenos a info@ohminstrumental.net

© ${new Date().getFullYear()} OHM Instrumental
`;

    return { subject, html, text };
}

function generateReporteEmail(data: Record<string, unknown>, customSubject?: string): { subject: string; html: string; text: string } {
    const cliente = data.cliente as string || 'Cliente';
    const tipoReporte = data.tipoReporte as string || 'Mantenimiento';
    const equipo = data.equipo as string || '';
    const fecha = data.fecha as string || new Date().toLocaleDateString('es-AR');
    const tecnico = data.tecnico as string || '';

    const subject = customSubject || `Reporte de ${tipoReporte} - OHM Instrumental`;

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f4f5;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">OHM Instrumental</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 14px;">Reporte de ${tipoReporte}</p>
        </div>
        
        <!-- Content -->
        <div style="background: white; padding: 30px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <p style="color: #374151; font-size: 16px; margin: 0 0 20px 0;">
                Estimado/a <strong>${cliente}</strong>,
            </p>
            
            <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
                Adjunto encontrará el reporte de ${tipoReporte.toLowerCase()} correspondiente.
            </p>
            
            <!-- Info Box -->
            <div style="background: #f0fdf4; border-radius: 12px; padding: 20px; margin: 20px 0; border-left: 4px solid #10b981;">
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Tipo:</td>
                        <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600; text-align: right;">${tipoReporte}</td>
                    </tr>
                    ${equipo ? `
                    <tr>
                        <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Equipo:</td>
                        <td style="padding: 8px 0; color: #111827; font-size: 14px; text-align: right;">${equipo}</td>
                    </tr>
                    ` : ''}
                    <tr>
                        <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Fecha:</td>
                        <td style="padding: 8px 0; color: #111827; font-size: 14px; text-align: right;">${fecha}</td>
                    </tr>
                    ${tecnico ? `
                    <tr>
                        <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Técnico:</td>
                        <td style="padding: 8px 0; color: #111827; font-size: 14px; text-align: right;">${tecnico}</td>
                    </tr>
                    ` : ''}
                </table>
            </div>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            
            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
                Este es un email automático. Por favor no responda a este mensaje.<br>
                Si tiene alguna consulta, contáctenos a <a href="mailto:info@ohminstrumental.net" style="color: #059669;">info@ohminstrumental.net</a>
            </p>
        </div>
        
        <!-- Footer -->
        <div style="text-align: center; padding: 20px;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                © ${new Date().getFullYear()} OHM Instrumental. Todos los derechos reservados.
            </p>
        </div>
    </div>
</body>
</html>`;

    const text = `
OHM Instrumental - Reporte de ${tipoReporte}

Estimado/a ${cliente},

Adjunto encontrará el reporte de ${tipoReporte.toLowerCase()} correspondiente.

Tipo: ${tipoReporte}
${equipo ? `Equipo: ${equipo}` : ''}
Fecha: ${fecha}
${tecnico ? `Técnico: ${tecnico}` : ''}

---
Este es un email automático. Por favor no responda a este mensaje.
Si tiene alguna consulta, contáctenos a info@ohminstrumental.net

© ${new Date().getFullYear()} OHM Instrumental
`;

    return { subject, html, text };
}

function generateNotificacionEmail(data: Record<string, unknown>, customSubject?: string): { subject: string; html: string; text: string } {
    const titulo = data.titulo as string || 'Notificación';
    const mensaje = data.mensaje as string || '';
    const nombre = data.nombre as string || '';

    const subject = customSubject || `${titulo} - OHM Instrumental`;

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f4f5;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #f59e0b 0%, #f97316 100%); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">OHM Instrumental</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 14px;">${titulo}</p>
        </div>
        
        <!-- Content -->
        <div style="background: white; padding: 30px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            ${nombre ? `
            <p style="color: #374151; font-size: 16px; margin: 0 0 20px 0;">
                Hola <strong>${nombre}</strong>,
            </p>
            ` : ''}
            
            <div style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
                ${mensaje.replace(/\n/g, '<br>')}
            </div>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            
            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
                Si tiene alguna consulta, contáctenos a <a href="mailto:info@ohminstrumental.net" style="color: #f59e0b;">info@ohminstrumental.net</a>
            </p>
        </div>
        
        <!-- Footer -->
        <div style="text-align: center; padding: 20px;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                © ${new Date().getFullYear()} OHM Instrumental. Todos los derechos reservados.
            </p>
        </div>
    </div>
</body>
</html>`;

    const text = `
OHM Instrumental - ${titulo}

${nombre ? `Hola ${nombre},` : ''}

${mensaje}

---
Si tiene alguna consulta, contáctenos a info@ohminstrumental.net

© ${new Date().getFullYear()} OHM Instrumental
`;

    return { subject, html, text };
}

// =====================================================
// TEMPLATE: WO TÉCNICO (Nueva Asignación con GPS)
// =====================================================
function generateWOTecnicoEmail(data: Record<string, unknown>, customSubject?: string): { subject: string; html: string; text: string } {
    const tecnicoNombre = data.tecnicoNombre as string || 'Técnico';
    const numeroWO = data.numeroWO as string || '';
    const clienteNombre = data.clienteNombre as string || 'Cliente';
    const clienteTelefono = data.clienteTelefono as string || '';
    const clienteDireccion = data.clienteDireccion as string || '';
    const clienteLat = data.clienteLat as number || null;
    const clienteLng = data.clienteLng as number || null;
    const tipoServicio = data.tipoServicio as string || 'Servicio Técnico';
    const fechaProgramada = data.fechaProgramada as string || '';
    const tiempoEstimado = data.tiempoEstimado as number || 60;
    const descripcion = data.descripcion as string || '';
    const notasInternas = data.notasInternas as string || '';
    const prioridad = data.prioridad as string || 'Media';
    const tokenConfirmacion = data.tokenConfirmacion as string || '';

    // URLs de confirmación
    const SUPABASE_URL = 'https://nvoihnnwpzeofzexblyg.supabase.co';
    const confirmUrl = tokenConfirmacion
        ? `${SUPABASE_URL}/functions/v1/confirm-wo?token=${tokenConfirmacion}&tipo=tecnico&accion=confirmar`
        : '';
    const rejectUrl = tokenConfirmacion
        ? `${SUPABASE_URL}/functions/v1/confirm-wo?token=${tokenConfirmacion}&tipo=tecnico&accion=rechazar`
        : '';

    const subject = customSubject || `🔧 Nueva OT Asignada: ${numeroWO} - ${clienteNombre}`;

    // Construir link de GPS - Usamos la dirección de texto para mayor precisión
    // ya que las coordenadas almacenadas pueden estar incorrectas
    const gpsLink = clienteDireccion
        ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(clienteDireccion)}`
        : (clienteLat && clienteLng ? `https://www.google.com/maps/dir/?api=1&destination=${clienteLat},${clienteLng}` : '#');

    // Color de prioridad
    const prioridadColors: Record<string, string> = {
        'Baja': '#3b82f6',
        'Media': '#f59e0b',
        'Alta': '#f97316',
        'EMERGENCIA_COMODIN': '#dc2626',
    };
    const prioridadColor = prioridadColors[prioridad] || '#f59e0b';

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f4f5;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">🔧 Nueva Orden de Trabajo</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px; font-weight: 600;">${numeroWO}</p>
        </div>
        
        <!-- Content -->
        <div style="background: white; padding: 30px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <p style="color: #374151; font-size: 16px; margin: 0 0 20px 0;">
                Hola <strong>${tecnicoNombre}</strong>,
            </p>
            
            <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
                Se te ha asignado una nueva orden de trabajo. A continuación los detalles:
            </p>
            
            <!-- Info Card -->
            <div style="background: #f9fafb; border-radius: 12px; padding: 20px; margin: 20px 0; border-left: 4px solid ${prioridadColor};">
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 10px 0; color: #6b7280; font-size: 14px; vertical-align: top; width: 40%;">📋 Cliente:</td>
                        <td style="padding: 10px 0; color: #111827; font-size: 14px; font-weight: 600;">${clienteNombre}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 0; color: #6b7280; font-size: 14px; vertical-align: top;">📍 Dirección:</td>
                        <td style="padding: 10px 0; color: #111827; font-size: 14px;">${clienteDireccion}</td>
                    </tr>
                    ${clienteTelefono ? `
                    <tr>
                        <td style="padding: 10px 0; color: #6b7280; font-size: 14px; vertical-align: top;">📞 Teléfono:</td>
                        <td style="padding: 10px 0; color: #111827; font-size: 14px;"><a href="tel:${clienteTelefono}" style="color: #4f46e5; text-decoration: none; font-weight: 600;">${clienteTelefono}</a></td>
                    </tr>
                    ` : ''}
                    <tr>
                        <td style="padding: 10px 0; color: #6b7280; font-size: 14px; vertical-align: top;">🔧 Servicio:</td>
                        <td style="padding: 10px 0; color: #111827; font-size: 14px;">${tipoServicio}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 0; color: #6b7280; font-size: 14px; vertical-align: top;">📅 Fecha:</td>
                        <td style="padding: 10px 0; color: #111827; font-size: 14px; font-weight: 600;">${fechaProgramada}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 0; color: #6b7280; font-size: 14px; vertical-align: top;">⏱️ Tiempo est.:</td>
                        <td style="padding: 10px 0; color: #111827; font-size: 14px;">${tiempoEstimado} minutos</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 0; color: #6b7280; font-size: 14px; vertical-align: top;">⚡ Prioridad:</td>
                        <td style="padding: 10px 0;">
                            <span style="background: ${prioridadColor}20; color: ${prioridadColor}; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;">${prioridad}</span>
                        </td>
                    </tr>
                </table>
            </div>
            
            ${descripcion ? `
            <div style="background: #fffbeb; border-radius: 8px; padding: 16px; margin: 20px 0; border-left: 4px solid #f59e0b;">
                <p style="color: #92400e; font-size: 14px; margin: 0;">
                    <strong>📝 Qué hacer:</strong><br>
                    ${descripcion}
                </p>
            </div>
            ` : ''}
            
            ${notasInternas ? `
            <div style="background: #fef2f2; border-radius: 8px; padding: 16px; margin: 20px 0; border-left: 4px solid #dc2626;">
                <p style="color: #991b1b; font-size: 14px; margin: 0;">
                    <strong>🔒 Notas Internas:</strong><br>
                    ${notasInternas}
                </p>
            </div>
            ` : ''}
            
            ${tokenConfirmacion ? `
            <!-- Botones de Confirmación -->
            <div style="background: #f0fdf4; border-radius: 12px; padding: 20px; margin: 20px 0; border: 2px solid #86efac; text-align: center;">
                <p style="color: #166534; font-size: 14px; font-weight: 600; margin: 0 0 16px 0;">
                    ¿Podés asistir a esta orden de trabajo?
                </p>
                <div style="display: flex; justify-content: center; gap: 12px; flex-wrap: wrap;">
                    <a href="${confirmUrl}" 
                       style="display: inline-block; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); 
                              color: white; text-decoration: none; padding: 14px 28px; border-radius: 10px; 
                              font-weight: 700; font-size: 14px; box-shadow: 0 4px 14px rgba(34, 197, 94, 0.4);">
                        ✅ SÍ, CONFIRMO
                    </a>
                    <a href="${rejectUrl}" 
                       style="display: inline-block; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); 
                              color: white; text-decoration: none; padding: 14px 28px; border-radius: 10px; 
                              font-weight: 700; font-size: 14px; box-shadow: 0 4px 14px rgba(239, 68, 68, 0.4);">
                        ❌ NO PUEDO
                    </a>
                </div>
            </div>
            ` : ''}
            
            <!-- GPS Button -->
            <div style="text-align: center; margin: 30px 0;">
                <a href="${gpsLink}" 
                   style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); 
                          color: white; text-decoration: none; padding: 16px 32px; border-radius: 12px; 
                          font-weight: 700; font-size: 16px; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4);">
                    📍 NAVEGAR CON GPS
                </a>
            </div>
            
            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 20px 0 0 0;">
                El botón de navegación abrirá Google Maps con la ruta hacia el cliente.
            </p>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            
            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
                Este es un email automático del sistema de OHM Instrumental.<br>
                Si tienes alguna consulta, contactá a tu supervisor.
            </p>
        </div>
        
        <!-- Footer -->
        <div style="text-align: center; padding: 20px;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                © ${new Date().getFullYear()} OHM Instrumental. Todos los derechos reservados.
            </p>
        </div>
    </div>
</body>
</html>`;

    const text = `
🔧 NUEVA ORDEN DE TRABAJO - ${numeroWO}

Hola ${tecnicoNombre},

Se te ha asignado una nueva orden de trabajo:

📋 Cliente: ${clienteNombre}
${clienteTelefono ? `📞 Teléfono: ${clienteTelefono}` : ''}
📍 Dirección: ${clienteDireccion}
🔧 Servicio: ${tipoServicio}
📅 Fecha: ${fechaProgramada}
⏱️ Tiempo estimado: ${tiempoEstimado} minutos
⚡ Prioridad: ${prioridad}
${descripcion ? `\n📝 Qué hacer: ${descripcion}` : ''}
${notasInternas ? `\n🔒 Notas Internas: ${notasInternas}` : ''}

🗺️ NAVEGAR CON GPS: ${gpsLink}

---
OHM Instrumental - Sistema de Gestión
`;

    return { subject, html, text };
}

// =====================================================
// TEMPLATE: WO CLIENTE (Confirmación de Servicio)
// =====================================================
function generateWOClienteEmail(data: Record<string, unknown>, customSubject?: string): { subject: string; html: string; text: string } {
    const clienteNombre = data.clienteNombre as string || 'Cliente';
    const numeroWO = data.numeroWO as string || '';
    const tecnicoNombre = data.tecnicoNombre as string || 'Nuestro técnico';
    const fechaProgramada = data.fechaProgramada as string || '';
    const tipoServicio = data.tipoServicio as string || 'Servicio Técnico';
    const descripcion = data.descripcion as string || '';

    const subject = customSubject || `✅ Servicio Técnico Programado - OHM Instrumental`;

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f4f5;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">OHM Instrumental</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 14px;">Servicio Técnico Programado</p>
        </div>
        
        <!-- Content -->
        <div style="background: white; padding: 30px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <p style="color: #374151; font-size: 16px; margin: 0 0 20px 0;">
                Estimado/a <strong>${clienteNombre}</strong>,
            </p>
            
            <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
                Le informamos que hemos programado un servicio técnico para su empresa. 
                A continuación encontrará los detalles de la visita:
            </p>
            
            <!-- Info Card -->
            <div style="background: #f0fdf4; border-radius: 12px; padding: 24px; margin: 20px 0; border: 1px solid #bbf7d0;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <div style="display: inline-block; background: #dcfce7; border-radius: 50%; padding: 16px;">
                        <span style="font-size: 32px;">📅</span>
                    </div>
                </div>
                
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 12px 0; color: #6b7280; font-size: 14px; border-bottom: 1px solid #e5e7eb;">Fecha y Hora:</td>
                        <td style="padding: 12px 0; color: #111827; font-size: 16px; font-weight: 700; text-align: right; border-bottom: 1px solid #e5e7eb;">${fechaProgramada}</td>
                    </tr>
                    <tr>
                        <td style="padding: 12px 0; color: #6b7280; font-size: 14px; border-bottom: 1px solid #e5e7eb;">Técnico Asignado:</td>
                        <td style="padding: 12px 0; color: #111827; font-size: 14px; font-weight: 600; text-align: right; border-bottom: 1px solid #e5e7eb;">${tecnicoNombre}</td>
                    </tr>
                    <tr>
                        <td style="padding: 12px 0; color: #6b7280; font-size: 14px; border-bottom: 1px solid #e5e7eb;">Tipo de Servicio:</td>
                        <td style="padding: 12px 0; color: #111827; font-size: 14px; text-align: right; border-bottom: 1px solid #e5e7eb;">${tipoServicio}</td>
                    </tr>
                    <tr>
                        <td style="padding: 12px 0; color: #6b7280; font-size: 14px;">Referencia:</td>
                        <td style="padding: 12px 0; color: #6b7280; font-size: 14px; text-align: right;">${numeroWO}</td>
                    </tr>
                </table>
            </div>
            
            ${descripcion ? `
            <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 20px 0;">
                <strong>Detalle del servicio:</strong><br>
                ${descripcion}
            </p>
            ` : ''}
            
            <!-- Important Notice -->
            <div style="background: #fef3c7; border-radius: 8px; padding: 16px; margin: 20px 0; border-left: 4px solid #f59e0b;">
                <p style="color: #92400e; font-size: 13px; margin: 0;">
                    <strong>📌 Importante:</strong> Por favor asegúrese de que haya personal disponible 
                    para recibir a nuestro técnico en el horario programado. En caso de necesitar 
                    reprogramar, contáctenos con anticipación.
                </p>
            </div>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            
            <p style="color: #6b7280; font-size: 14px; text-align: center; margin: 0 0 10px 0;">
                ¿Tiene alguna consulta? Contáctenos:
            </p>
            <p style="text-align: center; margin: 0;">
                <a href="mailto:info@ohminstrumental.net" style="color: #059669; text-decoration: none; font-weight: 600;">info@ohminstrumental.net</a>
            </p>
        </div>
        
        <!-- Footer -->
        <div style="text-align: center; padding: 20px;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                © ${new Date().getFullYear()} OHM Instrumental. Todos los derechos reservados.<br>
                Este es un mensaje automático, por favor no responda a este correo.
            </p>
        </div>
    </div>
</body>
</html>`;

    const text = `
✅ SERVICIO TÉCNICO PROGRAMADO - OHM Instrumental

Estimado/a ${clienteNombre},

Le informamos que hemos programado un servicio técnico para su empresa.

DETALLES DE LA VISITA:
📅 Fecha y Hora: ${fechaProgramada}
👤 Técnico: ${tecnicoNombre}
🔧 Servicio: ${tipoServicio}
📋 Referencia: ${numeroWO}
${descripcion ? `\nDetalle: ${descripcion}` : ''}

📌 IMPORTANTE: Por favor asegúrese de que haya personal disponible 
para recibir a nuestro técnico en el horario programado.

---
OHM Instrumental
info@ohminstrumental.net
`;

    return { subject, html, text };
}

// =====================================================
// TEMPLATE: WO CANCELACIÓN (Servicio Cancelado)
// =====================================================
function generateWOCancelacionEmail(data: Record<string, unknown>, customSubject?: string): { subject: string; html: string; text: string } {
    const tecnicoNombre = data.tecnicoNombre as string || 'Técnico';
    const numeroWO = data.numeroWO as string || '';
    const clienteNombre = data.clienteNombre as string || 'Cliente';
    const clienteDireccion = data.clienteDireccion as string || '';
    const fechaProgramada = data.fechaProgramada as string || '';
    const tipoServicio = data.tipoServicio as string || 'Servicio Técnico';
    const motivo = data.motivo as string || 'Reprogramación por parte de coordinación';

    const subject = customSubject || `🚫 Servicio Cancelado: ${numeroWO} - ${clienteNombre}`;

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f4f5;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">🚫 Servicio Cancelado</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px; font-weight: 600;">${numeroWO}</p>
        </div>
        
        <!-- Content -->
        <div style="background: white; padding: 30px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <p style="color: #374151; font-size: 16px; margin: 0 0 20px 0;">
                Hola <strong>${tecnicoNombre}</strong>,
            </p>
            
            <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
                Te informamos que el siguiente servicio ha sido <strong style="color: #dc2626;">cancelado</strong>:
            </p>
            
            <!-- Info Card -->
            <div style="background: #fef2f2; border-radius: 12px; padding: 20px; margin: 20px 0; border-left: 4px solid #dc2626;">
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 10px 0; color: #6b7280; font-size: 14px; vertical-align: top; width: 40%;">📋 Cliente:</td>
                        <td style="padding: 10px 0; color: #111827; font-size: 14px; font-weight: 600;">${clienteNombre}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 0; color: #6b7280; font-size: 14px; vertical-align: top;">📍 Dirección:</td>
                        <td style="padding: 10px 0; color: #111827; font-size: 14px;">${clienteDireccion}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 0; color: #6b7280; font-size: 14px; vertical-align: top;">🔧 Servicio:</td>
                        <td style="padding: 10px 0; color: #111827; font-size: 14px;">${tipoServicio}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 0; color: #6b7280; font-size: 14px; vertical-align: top;">📅 Fecha original:</td>
                        <td style="padding: 10px 0; color: #111827; font-size: 14px; text-decoration: line-through;">${fechaProgramada}</td>
                    </tr>
                </table>
            </div>
            
            <!-- Motivo -->
            <div style="background: #fef3c7; border-radius: 8px; padding: 16px; margin: 20px 0; border-left: 4px solid #f59e0b;">
                <p style="color: #92400e; font-size: 14px; margin: 0;">
                    <strong>📌 Motivo:</strong><br>
                    ${motivo}
                </p>
            </div>
            
            <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 20px 0;">
                No es necesario que asistas a esta dirección. Si tenés dudas, contactá a tu supervisor.
            </p>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            
            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
                Este es un email automático del sistema de OHM Instrumental.
            </p>
        </div>
        
        <!-- Footer -->
        <div style="text-align: center; padding: 20px;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                © ${new Date().getFullYear()} OHM Instrumental. Todos los derechos reservados.
            </p>
        </div>
    </div>
</body>
</html>`;

    const text = `
🚫 SERVICIO CANCELADO - ${numeroWO}

Hola ${tecnicoNombre},

Te informamos que el siguiente servicio ha sido CANCELADO:

📋 Cliente: ${clienteNombre}
📍 Dirección: ${clienteDireccion}
🔧 Servicio: ${tipoServicio}
📅 Fecha original: ${fechaProgramada} (CANCELADA)

📌 Motivo: ${motivo}

No es necesario que asistas a esta dirección.

---
OHM Instrumental - Sistema de Gestión
`;

    return { subject, html, text };
}

// =====================================================
// TEMPLATE: WO CANCELACIÓN CLIENTE (Servicio Cancelado/Reprogramado)
// =====================================================
function generateWOCancelacionClienteEmail(data: Record<string, unknown>, customSubject?: string): { subject: string; html: string; text: string } {
    const clienteNombre = data.clienteNombre as string || 'Estimado/a cliente';
    const numeroWO = data.numeroWO as string || '';
    const fechaProgramada = data.fechaProgramada as string || '';
    const tipoServicio = data.tipoServicio as string || 'Servicio Técnico';
    const motivo = data.motivo as string || 'Reprogramación por parte de nuestro equipo';

    const subject = customSubject || `📅 Servicio Reprogramado - OHM Instrumental`;

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f4f5;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">📅 Cambio en su Servicio</h1>
        </div>
        
        <!-- Content -->
        <div style="background: white; padding: 30px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <p style="color: #374151; font-size: 16px; margin: 0 0 20px 0;">
                Estimado/a <strong>${clienteNombre}</strong>,
            </p>
            
            <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
                Le informamos que el servicio que teníamos programado ha sido <strong>reprogramado</strong>:
            </p>
            
            <!-- Info Card -->
            <div style="background: #fef3c7; border-radius: 12px; padding: 20px; margin: 20px 0; border-left: 4px solid #f59e0b;">
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 10px 0; color: #92400e; font-size: 14px; vertical-align: top; width: 40%;">📋 Servicio:</td>
                        <td style="padding: 10px 0; color: #92400e; font-size: 14px; font-weight: 600;">${tipoServicio}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 0; color: #92400e; font-size: 14px; vertical-align: top;">📅 Fecha original:</td>
                        <td style="padding: 10px 0; color: #92400e; font-size: 14px; text-decoration: line-through;">${fechaProgramada}</td>
                    </tr>
                </table>
            </div>
            
            <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 20px 0;">
                <strong>Motivo:</strong> ${motivo}
            </p>
            
            <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 20px 0;">
                Nos pondremos en contacto con usted a la brevedad para coordinar una nueva fecha de visita.
            </p>
            
            <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 20px 0;">
                Pedimos disculpas por las molestias ocasionadas.
            </p>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            
            <p style="color: #6b7280; font-size: 14px; margin: 0;">
                Ante cualquier consulta, no dude en contactarnos:<br>
                📧 <a href="mailto:info@ohminstrumental.net" style="color: #0ea5e9;">info@ohminstrumental.net</a>
            </p>
        </div>
        
        <!-- Footer -->
        <div style="text-align: center; padding: 20px;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                © ${new Date().getFullYear()} OHM Instrumental. Todos los derechos reservados.
            </p>
        </div>
    </div>
</body>
</html>`;

    const text = `
📅 CAMBIO EN SU SERVICIO

Estimado/a ${clienteNombre},

Le informamos que el servicio que teníamos programado ha sido reprogramado:

📋 Servicio: ${tipoServicio}
📅 Fecha original: ${fechaProgramada} (REPROGRAMADA)

Motivo: ${motivo}

Nos pondremos en contacto con usted a la brevedad para coordinar una nueva fecha de visita.

Pedimos disculpas por las molestias ocasionadas.

---
OHM Instrumental
info@ohminstrumental.net
`;

    return { subject, html, text };
}

// =====================================================
// TEMPLATE: WO CONFIRMAR CLIENTE (Confirmación de visita)
// =====================================================
function generateWOConfirmarClienteEmail(data: Record<string, unknown>, customSubject?: string): { subject: string; html: string; text: string } {
    const clienteNombre = data.clienteNombre as string || 'Estimado/a cliente';
    const numeroWO = data.numeroWO as string || '';
    const fechaProgramada = data.fechaProgramada as string || '';
    const tipoServicio = data.tipoServicio as string || 'Servicio Técnico';
    const tokenConfirmacion = data.tokenConfirmacion as string || '';

    const SUPABASE_URL = 'https://nvoihnnwpzeofzexblyg.supabase.co';
    const confirmUrl = tokenConfirmacion
        ? `${SUPABASE_URL}/functions/v1/confirm-wo?token=${tokenConfirmacion}&tipo=cliente&accion=confirmar`
        : '';
    const rejectUrl = tokenConfirmacion
        ? `${SUPABASE_URL}/functions/v1/confirm-wo?token=${tokenConfirmacion}&tipo=cliente&accion=rechazar`
        : '';

    const subject = customSubject || `📅 Por favor confirme su visita - OHM Instrumental`;

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f4f5;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">📅 Confirmación de Visita</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 14px;">Nuestro técnico ha confirmado su disponibilidad</p>
        </div>
        
        <!-- Content -->
        <div style="background: white; padding: 30px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <p style="color: #374151; font-size: 16px; margin: 0 0 20px 0;">
                Estimado/a <strong>${clienteNombre}</strong>,
            </p>
            
            <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
                Le confirmamos que nuestro técnico estará disponible para realizar el servicio programado:
            </p>
            
            <!-- Info Card -->
            <div style="background: #eff6ff; border-radius: 12px; padding: 20px; margin: 20px 0; border-left: 4px solid #3b82f6;">
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 10px 0; color: #1e40af; font-size: 14px; vertical-align: top; width: 40%;">📋 Servicio:</td>
                        <td style="padding: 10px 0; color: #1e40af; font-size: 14px; font-weight: 600;">${tipoServicio}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 0; color: #1e40af; font-size: 14px; vertical-align: top;">📅 Fecha y hora:</td>
                        <td style="padding: 10px 0; color: #1e40af; font-size: 14px; font-weight: 600;">${fechaProgramada}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 0; color: #1e40af; font-size: 14px; vertical-align: top;">📄 Referencia:</td>
                        <td style="padding: 10px 0; color: #1e40af; font-size: 14px;">${numeroWO}</td>
                    </tr>
                </table>
            </div>
            
            ${tokenConfirmacion ? `
            <!-- Botones de Confirmación -->
            <div style="background: #f0fdf4; border-radius: 12px; padding: 20px; margin: 20px 0; border: 2px solid #86efac; text-align: center;">
                <p style="color: #166534; font-size: 14px; font-weight: 600; margin: 0 0 16px 0;">
                    ¿Puede recibir al técnico en la fecha indicada?
                </p>
                <div style="text-align: center;">
                    <a href="${confirmUrl}" 
                       style="display: inline-block; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); 
                              color: white; text-decoration: none; padding: 16px 32px; border-radius: 10px; 
                              font-weight: 700; font-size: 15px; box-shadow: 0 4px 14px rgba(34, 197, 94, 0.4);
                              margin: 6px;">
                        ✅ SÍ, CONFIRMO LA VISITA
                    </a>
                    <br>
                    <a href="${rejectUrl}" 
                       style="display: inline-block; background: #f1f5f9; 
                              color: #64748b; text-decoration: none; padding: 12px 24px; border-radius: 8px; 
                              font-weight: 600; font-size: 13px; margin: 12px 6px 0 6px; border: 1px solid #cbd5e1;">
                        Solicitar otra fecha
                    </a>
                </div>
            </div>
            ` : ''}
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            
            <p style="color: #6b7280; font-size: 14px; margin: 0;">
                Ante cualquier consulta, no dude en contactarnos:<br>
                📧 <a href="mailto:info@ohminstrumental.net" style="color: #3b82f6;">info@ohminstrumental.net</a>
            </p>
        </div>
        
        <!-- Footer -->
        <div style="text-align: center; padding: 20px;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                © ${new Date().getFullYear()} OHM Instrumental. Todos los derechos reservados.
            </p>
        </div>
    </div>
</body>
</html>`;

    const text = `
📅 CONFIRMACIÓN DE VISITA

Estimado/a ${clienteNombre},

Le confirmamos que nuestro técnico estará disponible para realizar el servicio programado:

📋 Servicio: ${tipoServicio}
📅 Fecha y hora: ${fechaProgramada}
📄 Referencia: ${numeroWO}

Por favor confirme que puede recibir al técnico en la fecha indicada accediendo a:
${confirmUrl}

O si necesita reprogramar:
${rejectUrl}

---
OHM Instrumental
info@ohminstrumental.net
`;

    return { subject, html, text };
}

// =====================================================
// TEMPLATE: WO CONFIRMADA INTERNO (Notificación a equipo)
// =====================================================
function generateWOConfirmadaInternoEmail(data: Record<string, unknown>, customSubject?: string): { subject: string; html: string; text: string } {
    const numeroWO = data.numeroWO as string || '';
    const tecnicoNombre = data.tecnicoNombre as string || 'Técnico';
    const clienteNombre = data.clienteNombre as string || 'Cliente';
    const fechaProgramada = data.fechaProgramada as string || '';
    const tipoServicio = data.tipoServicio as string || 'Servicio Técnico';
    const destinatarioNombre = data.destinatarioNombre as string || '';

    const subject = customSubject || `✅ Técnico confirmó: ${numeroWO} - ${clienteNombre}`;

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f4f5;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">✅ Técnico Confirmó Asistencia</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px; font-weight: 600;">${numeroWO}</p>
        </div>
        
        <!-- Content -->
        <div style="background: white; padding: 30px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            ${destinatarioNombre ? `
            <p style="color: #374151; font-size: 16px; margin: 0 0 20px 0;">
                Hola <strong>${destinatarioNombre}</strong>,
            </p>
            ` : ''}
            
            <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
                El técnico ha confirmado su asistencia para la siguiente orden de trabajo:
            </p>
            
            <!-- Info Card -->
            <div style="background: #f0fdf4; border-radius: 12px; padding: 24px; margin: 20px 0; border: 1px solid #bbf7d0;">
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 12px 0; color: #6b7280; font-size: 14px; border-bottom: 1px solid #e5e7eb;">📋 Orden:</td>
                        <td style="padding: 12px 0; color: #111827; font-size: 14px; font-weight: 600; text-align: right; border-bottom: 1px solid #e5e7eb;">${numeroWO}</td>
                    </tr>
                    <tr>
                        <td style="padding: 12px 0; color: #6b7280; font-size: 14px; border-bottom: 1px solid #e5e7eb;">👤 Técnico:</td>
                        <td style="padding: 12px 0; color: #111827; font-size: 14px; font-weight: 600; text-align: right; border-bottom: 1px solid #e5e7eb;">${tecnicoNombre}</td>
                    </tr>
                    <tr>
                        <td style="padding: 12px 0; color: #6b7280; font-size: 14px; border-bottom: 1px solid #e5e7eb;">🏢 Cliente:</td>
                        <td style="padding: 12px 0; color: #111827; font-size: 14px; text-align: right; border-bottom: 1px solid #e5e7eb;">${clienteNombre}</td>
                    </tr>
                    <tr>
                        <td style="padding: 12px 0; color: #6b7280; font-size: 14px; border-bottom: 1px solid #e5e7eb;">🔧 Servicio:</td>
                        <td style="padding: 12px 0; color: #111827; font-size: 14px; text-align: right; border-bottom: 1px solid #e5e7eb;">${tipoServicio}</td>
                    </tr>
                    <tr>
                        <td style="padding: 12px 0; color: #6b7280; font-size: 14px;">📅 Fecha:</td>
                        <td style="padding: 12px 0; color: #111827; font-size: 14px; font-weight: 600; text-align: right;">${fechaProgramada}</td>
                    </tr>
                </table>
            </div>
            
            <div style="background: #dcfce7; border-radius: 8px; padding: 16px; margin: 20px 0; text-align: center;">
                <p style="color: #166534; font-size: 14px; font-weight: 600; margin: 0;">
                    ✅ El servicio está confirmado por parte del técnico
                </p>
            </div>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            
            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
                Este es un email automático del sistema de coordinación.
            </p>
        </div>
        
        <!-- Footer -->
        <div style="text-align: center; padding: 20px;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                © ${new Date().getFullYear()} OHM Instrumental
            </p>
        </div>
    </div>
</body>
</html>`;

    const text = `
✅ TÉCNICO CONFIRMÓ ASISTENCIA - ${numeroWO}

${destinatarioNombre ? `Hola ${destinatarioNombre},` : ''}

El técnico ha confirmado su asistencia:

📋 Orden: ${numeroWO}
👤 Técnico: ${tecnicoNombre}
🏢 Cliente: ${clienteNombre}
🔧 Servicio: ${tipoServicio}
📅 Fecha: ${fechaProgramada}

El servicio está confirmado por parte del técnico.

---
OHM Instrumental - Sistema de Coordinación
`;

    return { subject, html, text };
}

// =====================================================
// TEMPLATE: WO RECHAZADA INTERNO (Técnico no puede asistir)
// =====================================================
function generateWORechazadaInternoEmail(data: Record<string, unknown>, customSubject?: string): { subject: string; html: string; text: string } {
    const numeroWO = data.numeroWO as string || '';
    const tecnicoNombre = data.tecnicoNombre as string || 'Técnico';
    const clienteNombre = data.clienteNombre as string || 'Cliente';
    const fechaProgramada = data.fechaProgramada as string || '';
    const tipoServicio = data.tipoServicio as string || 'Servicio Técnico';
    const motivo = data.motivo as string || 'No especificado';
    const destinatarioNombre = data.destinatarioNombre as string || '';

    const subject = customSubject || `⚠️ Técnico rechazó: ${numeroWO} - ${clienteNombre}`;

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f4f5;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">⚠️ Técnico No Puede Asistir</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px; font-weight: 600;">${numeroWO}</p>
        </div>
        
        <!-- Content -->
        <div style="background: white; padding: 30px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            ${destinatarioNombre ? `
            <p style="color: #374151; font-size: 16px; margin: 0 0 20px 0;">
                Hola <strong>${destinatarioNombre}</strong>,
            </p>
            ` : ''}
            
            <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
                El técnico ha indicado que <strong>no puede asistir</strong> a la siguiente orden de trabajo:
            </p>
            
            <!-- Info Card -->
            <div style="background: #fef3c7; border-radius: 12px; padding: 24px; margin: 20px 0; border: 1px solid #fcd34d;">
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 12px 0; color: #6b7280; font-size: 14px; border-bottom: 1px solid #fcd34d;">📋 Orden:</td>
                        <td style="padding: 12px 0; color: #111827; font-size: 14px; font-weight: 600; text-align: right; border-bottom: 1px solid #fcd34d;">${numeroWO}</td>
                    </tr>
                    <tr>
                        <td style="padding: 12px 0; color: #6b7280; font-size: 14px; border-bottom: 1px solid #fcd34d;">👤 Técnico:</td>
                        <td style="padding: 12px 0; color: #111827; font-size: 14px; font-weight: 600; text-align: right; border-bottom: 1px solid #fcd34d;">${tecnicoNombre}</td>
                    </tr>
                    <tr>
                        <td style="padding: 12px 0; color: #6b7280; font-size: 14px; border-bottom: 1px solid #fcd34d;">🏢 Cliente:</td>
                        <td style="padding: 12px 0; color: #111827; font-size: 14px; text-align: right; border-bottom: 1px solid #fcd34d;">${clienteNombre}</td>
                    </tr>
                    <tr>
                        <td style="padding: 12px 0; color: #6b7280; font-size: 14px; border-bottom: 1px solid #fcd34d;">🔧 Servicio:</td>
                        <td style="padding: 12px 0; color: #111827; font-size: 14px; text-align: right; border-bottom: 1px solid #fcd34d;">${tipoServicio}</td>
                    </tr>
                    <tr>
                        <td style="padding: 12px 0; color: #6b7280; font-size: 14px;">📅 Fecha:</td>
                        <td style="padding: 12px 0; color: #111827; font-size: 14px; font-weight: 600; text-align: right;">${fechaProgramada}</td>
                    </tr>
                </table>
            </div>
            
            <div style="background: #fef2f2; border-radius: 8px; padding: 16px; margin: 20px 0; border-left: 4px solid #ef4444;">
                <p style="color: #991b1b; font-size: 14px; margin: 0;">
                    <strong>❌ Motivo del rechazo:</strong><br>
                    ${motivo}
                </p>
            </div>
            
            <div style="background: #fffbeb; border-radius: 8px; padding: 16px; margin: 20px 0; text-align: center;">
                <p style="color: #92400e; font-size: 14px; font-weight: 600; margin: 0;">
                    ⚠️ Esta orden requiere reasignación
                </p>
            </div>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            
            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
                Este es un email automático del sistema de coordinación.
            </p>
        </div>
        
        <!-- Footer -->
        <div style="text-align: center; padding: 20px;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                © ${new Date().getFullYear()} OHM Instrumental
            </p>
        </div>
    </div>
</body>
</html>`;

    const text = `
⚠️ TÉCNICO NO PUEDE ASISTIR - ${numeroWO}

${destinatarioNombre ? `Hola ${destinatarioNombre},` : ''}

El técnico ha indicado que NO puede asistir:

📋 Orden: ${numeroWO}
👤 Técnico: ${tecnicoNombre}
🏢 Cliente: ${clienteNombre}
🔧 Servicio: ${tipoServicio}
📅 Fecha: ${fechaProgramada}

❌ Motivo: ${motivo}

⚠️ Esta orden requiere reasignación.

---
OHM Instrumental - Sistema de Coordinación
`;

    return { subject, html, text };
}

// =====================================================
// TEMPLATE: FEEDBACK NOTIFICATION (New Ticket Alert)
// =====================================================
function generateFeedbackNotificacionEmail(data: Record<string, unknown>, customSubject?: string): { subject: string; html: string; text: string } {
    const userEmail = data.userEmail as string || 'Usuario anónimo';
    const userName = data.userName as string || '';
    const categoria = data.categoria as string || 'otro';
    const impacto = data.impacto as string || 'bajo';
    const mensaje = data.mensaje as string || '';
    const origenUrl = data.origenUrl as string || '';
    const ticketId = data.ticketId as string || '';
    const timestamp = new Date().toLocaleString('es-AR', {
        timeZone: 'America/Argentina/Buenos_Aires',
        dateStyle: 'full',
        timeStyle: 'short'
    });

    // Mapeo de categorías a display names y colores
    const categoriaMap: Record<string, { label: string; color: string; emoji: string }> = {
        'bug': { label: 'Error/Bug', color: '#dc2626', emoji: '🐛' },
        'mejora': { label: 'Mejora/Sugerencia', color: '#059669', emoji: '💡' },
        'rendimiento': { label: 'Rendimiento', color: '#f59e0b', emoji: '⚡' },
        'otro': { label: 'Otro', color: '#6b7280', emoji: '📝' },
    };

    const impactoMap: Record<string, { label: string; color: string }> = {
        'bajo': { label: 'Bajo', color: '#3b82f6' },
        'medio': { label: 'Medio', color: '#f59e0b' },
        'alto': { label: 'Alto', color: '#f97316' },
        'critico': { label: 'Crítico', color: '#dc2626' },
    };

    const cat = categoriaMap[categoria] || categoriaMap['otro'];
    const imp = impactoMap[impacto] || impactoMap['bajo'];

    const subject = customSubject || `${cat.emoji} Nuevo Feedback: ${cat.label} (${imp.label})`;

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f4f5;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">📨 Nuevo Ticket de Feedback</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 14px;">ReportesOBM - Sistema de Feedback</p>
        </div>
        
        <!-- Content -->
        <div style="background: white; padding: 30px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <p style="color: #374151; font-size: 16px; margin: 0 0 20px 0;">
                Se ha recibido un nuevo ticket de feedback:
            </p>
            
            <!-- Category & Impact Badges -->
            <div style="display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap;">
                <span style="display: inline-block; background: ${cat.color}15; color: ${cat.color}; padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 600; border: 1px solid ${cat.color}30;">
                    ${cat.emoji} ${cat.label}
                </span>
                <span style="display: inline-block; background: ${imp.color}15; color: ${imp.color}; padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 600; border: 1px solid ${imp.color}30;">
                    ⚡ Impacto: ${imp.label}
                </span>
            </div>
            
            <!-- User Info -->
            <div style="background: #f9fafb; border-radius: 12px; padding: 16px; margin: 20px 0;">
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 30%;">👤 Usuario:</td>
                        <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600;">${userName || userEmail}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">📧 Email:</td>
                        <td style="padding: 8px 0; color: #111827; font-size: 14px;">
                            <a href="mailto:${userEmail}" style="color: #6366f1; text-decoration: none;">${userEmail}</a>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">🕐 Fecha:</td>
                        <td style="padding: 8px 0; color: #111827; font-size: 14px;">${timestamp}</td>
                    </tr>
                    ${ticketId ? `
                    <tr>
                        <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">🎫 Ticket ID:</td>
                        <td style="padding: 8px 0; color: #6b7280; font-size: 12px; font-family: monospace;">${ticketId}</td>
                    </tr>
                    ` : ''}
                </table>
            </div>
            
            <!-- Message -->
            <div style="background: #fef3c7; border-radius: 12px; padding: 20px; margin: 20px 0; border-left: 4px solid #f59e0b;">
                <p style="color: #92400e; font-size: 13px; font-weight: 600; margin: 0 0 10px 0;">📝 Mensaje del usuario:</p>
                <p style="color: #78350f; font-size: 14px; line-height: 1.6; margin: 0; white-space: pre-wrap;">${mensaje}</p>
            </div>
            
            ${origenUrl ? `
            <p style="color: #9ca3af; font-size: 12px; margin: 20px 0 0 0;">
                📍 Origen: <a href="${origenUrl}" style="color: #6366f1;">${origenUrl}</a>
            </p>
            ` : ''}
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            
            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
                Este ticket está pendiente de revisión en el Panel de Administración.<br>
                <a href="https://reportesobm.netlify.app/" style="color: #6366f1;">Ir al Panel Admin</a>
            </p>
        </div>
        
        <!-- Footer -->
        <div style="text-align: center; padding: 20px;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                © ${new Date().getFullYear()} OHM Instrumental - Sistema de Gestión
            </p>
        </div>
    </div>
</body>
</html>`;

    const text = `
📨 NUEVO TICKET DE FEEDBACK
============================

Categoría: ${cat.emoji} ${cat.label}
Impacto: ${imp.label}

👤 Usuario: ${userName || userEmail}
📧 Email: ${userEmail}
🕐 Fecha: ${timestamp}
${ticketId ? `🎫 Ticket ID: ${ticketId}` : ''}

📝 MENSAJE:
${mensaje}

${origenUrl ? `📍 Origen: ${origenUrl}` : ''}

---
Este ticket está pendiente de revisión en el Panel de Administración.
OHM Instrumental - Sistema de Gestión
`;

    return { subject, html, text };
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
