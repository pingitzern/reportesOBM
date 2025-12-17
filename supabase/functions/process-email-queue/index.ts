/**
 * Edge Function: process-email-queue
 * 
 * Procesa la cola de emails pendientes.
 * Ejecutado por pg_cron cada minuto o manualmente.
 * 
 * - Busca emails con estado 'pendiente' y programado_para <= NOW()
 * - Envía cada uno llamando a send-email
 * - Actualiza estado a 'enviado' o 'error'
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.1';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
});

interface QueuedEmail {
    id: string;
    wo_id: string;
    tipo: string;
    destinatario: string;
    destinatario_nombre: string | null;
    data: Record<string, unknown>;
    estado: string;
    programado_para: string;
}

Deno.serve(async (req) => {
    // CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    console.log('[process-email-queue] Iniciando procesamiento de cola...');

    try {
        // Buscar emails pendientes cuyo tiempo de envío ya llegó
        const now = new Date().toISOString();
        const { data: pendingEmails, error: fetchError } = await supabaseAdmin
            .from('email_queue')
            .select('*')
            .eq('estado', 'pendiente')
            .lte('programado_para', now)
            .order('programado_para', { ascending: true })
            .limit(50); // Procesar máximo 50 por ejecución

        if (fetchError) {
            console.error('[process-email-queue] Error buscando emails:', fetchError);
            return jsonResponse({ error: 'Error accediendo a la cola', details: fetchError.message }, 500);
        }

        if (!pendingEmails || pendingEmails.length === 0) {
            console.log('[process-email-queue] No hay emails pendientes para procesar');
            return jsonResponse({ success: true, processed: 0, message: 'No hay emails pendientes' });
        }

        console.log(`[process-email-queue] Encontrados ${pendingEmails.length} emails pendientes`);

        let processed = 0;
        let errors = 0;

        for (const email of pendingEmails as QueuedEmail[]) {
            try {
                console.log(`[process-email-queue] Enviando email ${email.id} tipo ${email.tipo} a ${email.destinatario}`);

                // Llamar a send-email
                const sendResponse = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        type: email.tipo,
                        to: email.destinatario,
                        data: email.data,
                    }),
                });

                const sendResult = await sendResponse.json();

                if (sendResponse.ok) {
                    // Email enviado exitosamente
                    await supabaseAdmin
                        .from('email_queue')
                        .update({
                            estado: 'enviado',
                            enviado_at: new Date().toISOString(),
                        })
                        .eq('id', email.id);

                    console.log(`[process-email-queue] ✅ Email ${email.id} enviado correctamente`);
                    processed++;
                } else {
                    // Error al enviar
                    await supabaseAdmin
                        .from('email_queue')
                        .update({
                            estado: 'error',
                            error_mensaje: sendResult.error || 'Error desconocido',
                        })
                        .eq('id', email.id);

                    console.error(`[process-email-queue] ❌ Error enviando email ${email.id}:`, sendResult);
                    errors++;
                }
            } catch (emailError) {
                // Error en el fetch
                await supabaseAdmin
                    .from('email_queue')
                    .update({
                        estado: 'error',
                        error_mensaje: emailError instanceof Error ? emailError.message : 'Error de red',
                    })
                    .eq('id', email.id);

                console.error(`[process-email-queue] ❌ Error procesando email ${email.id}:`, emailError);
                errors++;
            }
        }

        console.log(`[process-email-queue] Procesamiento completado: ${processed} enviados, ${errors} errores`);

        return jsonResponse({
            success: true,
            processed,
            errors,
            total: pendingEmails.length,
        });

    } catch (error) {
        console.error('[process-email-queue] Error general:', error);
        return jsonResponse({
            error: error instanceof Error ? error.message : 'Error interno',
        }, 500);
    }
});

function jsonResponse(body: Record<string, unknown>, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            ...corsHeaders,
        },
    });
}
