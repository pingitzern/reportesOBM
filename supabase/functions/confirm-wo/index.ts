/**
 * Edge Function: confirm-wo
 * 
 * Endpoint público para confirmar/rechazar WOs vía email.
 * Recibe un token único y actualiza el estado de confirmación.
 * Retorna una página HTML con el resultado.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.1';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
});

// Obtener usuarios por roles (ventas, jefe_servicio, coordinador)
async function getUsersByRoles(roles: string[]): Promise<Array<{ email: string; nombre: string; rol: string }>> {
    try {
        const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();
        if (error || !users) return [];

        return users
            .filter(user => {
                const userRol = user.user_metadata?.rol?.toLowerCase() || '';
                return roles.some(r => r.toLowerCase() === userRol);
            })
            .map(user => ({
                email: user.email || '',
                nombre: user.user_metadata?.nombre || user.email?.split('@')[0] || 'Usuario',
                rol: user.user_metadata?.rol || '',
            }))
            .filter(u => u.email); // Solo usuarios con email
    } catch (e) {
        console.error('[confirm-wo] Error fetching users by role:', e);
        return [];
    }
}

interface ConfirmPayload {
    token: string;
    tipo: 'tecnico' | 'cliente';
    accion: 'confirmar' | 'rechazar';
    motivo?: string;
}

Deno.serve(async (req) => {
    const url = new URL(req.url);

    // Soportar tanto GET (desde email) como POST
    let payload: ConfirmPayload;

    if (req.method === 'GET') {
        payload = {
            token: url.searchParams.get('token') || '',
            tipo: (url.searchParams.get('tipo') as 'tecnico' | 'cliente') || 'tecnico',
            accion: (url.searchParams.get('accion') as 'confirmar' | 'rechazar') || 'confirmar',
            motivo: url.searchParams.get('motivo') || undefined,
        };
    } else if (req.method === 'POST') {
        payload = await req.json();
    } else if (req.method === 'OPTIONS') {
        return new Response(null, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            },
        });
    } else {
        return htmlResponse('error', 'Método no permitido', 'Use GET o POST');
    }

    const { token, tipo, accion, motivo } = payload;

    console.log(`[confirm-wo] Token: ${token}, Tipo: ${tipo}, Acción: ${accion}`);

    // Validar token
    if (!token || token.length < 10) {
        return htmlResponse('error', 'Token Inválido', 'El enlace de confirmación no es válido o ha expirado.');
    }

    // Buscar WO por token
    const { data: wo, error: woError } = await supabaseAdmin
        .from('ordenes_trabajo')
        .select(`
            id,
            numero_wo,
            titulo,
            estado,
            confirmacion_tecnico,
            confirmacion_cliente,
            tecnico_asignado_id,
            cliente_id,
            fecha_programada,
            clients!inner (
                id,
                razon_social,
                email
            )
        `)
        .eq('token_confirmacion', token)
        .single();

    if (woError || !wo) {
        console.error('[confirm-wo] WO no encontrada:', woError);
        return htmlResponse('error', 'Orden No Encontrada', 'No se encontró la orden de trabajo asociada a este enlace.');
    }

    // Verificar que la WO está en estado válido
    if (wo.estado === 'Cancelada' || wo.estado === 'Completada') {
        return htmlResponse('warning', 'Orden Cerrada', `Esta orden de trabajo ya fue ${wo.estado.toLowerCase()}.`);
    }

    // Procesar según tipo y acción
    if (tipo === 'tecnico') {
        // Verificar que no se haya confirmado ya
        if (wo.confirmacion_tecnico === 'confirmada' && accion === 'confirmar') {
            return htmlResponse('info', 'Ya Confirmada', 'Ya habías confirmado tu asistencia a esta orden de trabajo.');
        }
        if (wo.confirmacion_tecnico === 'rechazada' && accion === 'rechazar') {
            return htmlResponse('info', 'Ya Rechazada', 'Ya habías rechazado esta orden de trabajo.');
        }

        // Actualizar confirmación técnico
        const updateData: Record<string, unknown> = {
            confirmacion_tecnico: accion === 'confirmar' ? 'confirmada' : 'rechazada',
            confirmacion_tecnico_at: new Date().toISOString(),
        };

        if (accion === 'rechazar' && motivo) {
            updateData.rechazo_motivo = motivo;
        }

        const { error: updateError } = await supabaseAdmin
            .from('ordenes_trabajo')
            .update(updateData)
            .eq('id', wo.id);

        if (updateError) {
            console.error('[confirm-wo] Error actualizando:', updateError);
            return htmlResponse('error', 'Error', 'Hubo un error al procesar tu confirmación.');
        }

        if (accion === 'confirmar') {
            // Encolar email al cliente para que confirme
            const cliente = wo.clients as any;
            const fechaFormateada = wo.fecha_programada
                ? new Date(wo.fecha_programada).toLocaleString('es-AR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                })
                : 'A coordinar';

            if (cliente?.email) {
                await supabaseAdmin
                    .from('email_queue')
                    .insert({
                        wo_id: wo.id,
                        tipo: 'wo-confirmar-cliente',
                        destinatario: cliente.email,
                        destinatario_nombre: cliente.razon_social,
                        data: {
                            clienteNombre: cliente.razon_social,
                            numeroWO: wo.numero_wo,
                            tipoServicio: wo.titulo || 'Servicio Técnico',
                            fechaProgramada: fechaFormateada,
                            tokenConfirmacion: token,
                        },
                        programado_para: new Date().toISOString(),
                    });

                console.log(`[confirm-wo] ✉️ Email de confirmación encolado para cliente: ${cliente.email}`);
            }

            // NOTIFICAR A VENTAS Y JEFE DE SERVICIO
            const notifyUsers = await getUsersByRoles(['ventas', 'jefe_servicio']);
            const tecnicoNombre = await getTecnicoNombre(wo.tecnico_asignado_id);

            for (const user of notifyUsers) {
                await supabaseAdmin
                    .from('email_queue')
                    .insert({
                        wo_id: wo.id,
                        tipo: 'wo-confirmada-interno',
                        destinatario: user.email,
                        destinatario_nombre: user.nombre,
                        data: {
                            destinatarioNombre: user.nombre,
                            numeroWO: wo.numero_wo,
                            tecnicoNombre: tecnicoNombre,
                            clienteNombre: cliente?.razon_social || 'Cliente',
                            tipoServicio: wo.titulo || 'Servicio Técnico',
                            fechaProgramada: fechaFormateada,
                        },
                        programado_para: new Date().toISOString(),
                    });
                console.log(`[confirm-wo] ✉️ Notificación interna encolada para ${user.rol}: ${user.email}`);
            }

            return htmlResponse('success', '¡Confirmado!',
                `Has confirmado tu asistencia a la orden ${wo.numero_wo}. El cliente será notificado.`);
        } else {
            // Notificar a coordinación sobre el rechazo
            const notifyUsers = await getUsersByRoles(['ventas', 'jefe_servicio', 'coordinador']);
            const tecnicoNombre = await getTecnicoNombre(wo.tecnico_asignado_id);
            const cliente = wo.clients as any;

            const fechaFormateada = wo.fecha_programada
                ? new Date(wo.fecha_programada).toLocaleString('es-AR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                })
                : 'A coordinar';

            for (const user of notifyUsers) {
                await supabaseAdmin
                    .from('email_queue')
                    .insert({
                        wo_id: wo.id,
                        tipo: 'wo-rechazada-interno',
                        destinatario: user.email,
                        destinatario_nombre: user.nombre,
                        data: {
                            destinatarioNombre: user.nombre,
                            numeroWO: wo.numero_wo,
                            tecnicoNombre: tecnicoNombre,
                            clienteNombre: cliente?.razon_social || 'Cliente',
                            tipoServicio: wo.titulo || 'Servicio Técnico',
                            fechaProgramada: fechaFormateada,
                            motivo: motivo || 'No especificado',
                        },
                        programado_para: new Date().toISOString(),
                    });
                console.log(`[confirm-wo] ⚠️ Notificación de rechazo encolada para ${user.rol}: ${user.email}`);
            }

            console.log(`[confirm-wo] ⚠️ Técnico rechazó WO ${wo.numero_wo}`);

            return htmlResponse('warning', 'Rechazo Registrado',
                `Has indicado que no puedes asistir a la orden ${wo.numero_wo}. Coordinación será notificada.`);
        }

    } else if (tipo === 'cliente') {
        // Verificar que el técnico ya confirmó
        if (wo.confirmacion_tecnico !== 'confirmada') {
            return htmlResponse('warning', 'Pendiente',
                'El técnico aún no ha confirmado su asistencia. Por favor intente más tarde.');
        }

        // Verificar que no se haya confirmado ya
        if (wo.confirmacion_cliente === 'confirmada' && accion === 'confirmar') {
            return htmlResponse('info', 'Ya Confirmada', 'Ya había confirmado esta visita.');
        }

        // Actualizar confirmación cliente
        const updateData: Record<string, unknown> = {
            confirmacion_cliente: accion === 'confirmar' ? 'confirmada' : 'rechazada',
            confirmacion_cliente_at: new Date().toISOString(),
        };

        // Si ambos confirmaron, actualizar estado a Confirmada_Cliente
        if (accion === 'confirmar') {
            updateData.estado = 'Confirmada_Cliente';
        }

        if (accion === 'rechazar' && motivo) {
            updateData.rechazo_motivo = motivo;
        }

        const { error: updateError } = await supabaseAdmin
            .from('ordenes_trabajo')
            .update(updateData)
            .eq('id', wo.id);

        if (updateError) {
            console.error('[confirm-wo] Error actualizando:', updateError);
            return htmlResponse('error', 'Error', 'Hubo un error al procesar su confirmación.');
        }

        if (accion === 'confirmar') {
            return htmlResponse('success', '¡Visita Confirmada!',
                `Gracias por confirmar. Su visita para la orden ${wo.numero_wo} está confirmada.`);
        } else {
            return htmlResponse('warning', 'Solicitud Registrada',
                'Hemos registrado su solicitud de reprogramación. Nos pondremos en contacto a la brevedad.');
        }
    }

    return htmlResponse('error', 'Error', 'Tipo de confirmación no válido.');
});

function htmlResponse(status: 'success' | 'error' | 'warning' | 'info', title: string, message: string) {
    // Redirigir a página estática del frontend para evitar problemas de encoding
    const baseUrl = 'https://gilded-nasturtium-ce1040.netlify.app';
    const redirectUrl = `${baseUrl}/confirmacion.html?status=${status}&title=${encodeURIComponent(title)}&message=${encodeURIComponent(message)}`;

    return new Response(null, {
        status: 302,
        headers: {
            'Location': redirectUrl,
        },
    });
}

// Helper para obtener nombre del técnico
async function getTecnicoNombre(tecnicoId: string | null): Promise<string> {
    if (!tecnicoId) return 'Técnico';
    try {
        const { data } = await supabaseAdmin.auth.admin.getUserById(tecnicoId);
        return data?.user?.user_metadata?.nombre || 'Técnico';
    } catch {
        return 'Técnico';
    }
}
