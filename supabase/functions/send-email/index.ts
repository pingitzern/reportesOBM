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
    type: 'remito' | 'reporte' | 'notificacion' | 'custom';
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

function jsonResponse(body: Record<string, unknown>, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            ...corsHeaders,
        },
    });
}
