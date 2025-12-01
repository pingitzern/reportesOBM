/**
 * Edge Function para administración de usuarios
 * Endpoints:
 *   GET  /admin-users              - Listar todos los usuarios
 *   GET  /admin-users?id=xxx       - Obtener un usuario específico
 *   POST /admin-users              - Crear nuevo usuario
 *   PUT  /admin-users              - Actualizar usuario existente
 *   DELETE /admin-users?id=xxx     - Eliminar usuario
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.1';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
});

// Roles válidos en el sistema
const VALID_ROLES = ['Administrador', 'tecnico', 'supervisor'];

Deno.serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // Verificar que el usuario que hace la petición es admin
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return jsonResponse({ error: 'No autorizado' }, 401);
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(token);

        if (authError || !requestingUser) {
            return jsonResponse({ error: 'Token inválido' }, 401);
        }

        // Verificar que el usuario es administrador
        const userRole = requestingUser.user_metadata?.rol || requestingUser.app_metadata?.role;
        if (!isAdmin(userRole)) {
            return jsonResponse({ error: 'Acceso denegado. Se requiere rol de Administrador.' }, 403);
        }

        const url = new URL(req.url);
        const userId = url.searchParams.get('id');

        switch (req.method) {
            case 'GET':
                return userId ? await getUser(userId) : await listUsers();

            case 'POST':
                return await createUser(await req.json());

            case 'PUT':
                return await updateUser(await req.json());

            case 'DELETE':
                if (!userId) {
                    return jsonResponse({ error: 'Se requiere el ID del usuario' }, 400);
                }
                return await deleteUser(userId);

            case 'PATCH':
                // PATCH se usa para enviar email de reset de contraseña
                return await sendPasswordReset(await req.json());

            default:
                return jsonResponse({ error: 'Método no permitido' }, 405);
        }
    } catch (error) {
        console.error('admin-users error:', error);
        return jsonResponse({ 
            error: error instanceof Error ? error.message : 'Error inesperado' 
        }, 500);
    }
});

function isAdmin(role: string | undefined): boolean {
    if (!role) return false;
    const normalizedRole = role.toLowerCase().trim();
    return normalizedRole === 'administrador' || normalizedRole === 'admin';
}

async function listUsers() {
    const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();

    if (error) {
        console.error('Error listing users:', error);
        return jsonResponse({ error: 'Error al listar usuarios' }, 500);
    }

    // Mapear a formato simplificado para el frontend
    const mappedUsers = users.map(user => ({
        id: user.id,
        email: user.email,
        nombre: user.user_metadata?.nombre || user.user_metadata?.full_name || '',
        cargo: user.user_metadata?.cargo || '',
        rol: user.user_metadata?.rol || user.app_metadata?.role || 'tecnico',
        telefono: user.user_metadata?.telefono || '',
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at,
        email_confirmed_at: user.email_confirmed_at,
        banned_until: user.banned_until,
    }));

    return jsonResponse({ users: mappedUsers });
}

async function getUser(userId: string) {
    const { data: { user }, error } = await supabaseAdmin.auth.admin.getUserById(userId);

    if (error || !user) {
        return jsonResponse({ error: 'Usuario no encontrado' }, 404);
    }

    return jsonResponse({
        user: {
            id: user.id,
            email: user.email,
            nombre: user.user_metadata?.nombre || user.user_metadata?.full_name || '',
            cargo: user.user_metadata?.cargo || '',
            rol: user.user_metadata?.rol || user.app_metadata?.role || 'tecnico',
            telefono: user.user_metadata?.telefono || '',
            created_at: user.created_at,
            last_sign_in_at: user.last_sign_in_at,
            email_confirmed_at: user.email_confirmed_at,
            banned_until: user.banned_until,
        }
    });
}

interface CreateUserPayload {
    email: string;
    password: string;
    nombre?: string;
    cargo?: string;
    rol?: string;
    telefono?: string;
}

async function createUser(payload: CreateUserPayload) {
    const { email, password, nombre, cargo, rol, telefono } = payload;

    if (!email || !password) {
        return jsonResponse({ error: 'Email y contraseña son requeridos' }, 400);
    }

    if (password.length < 6) {
        return jsonResponse({ error: 'La contraseña debe tener al menos 6 caracteres' }, 400);
    }

    // Validar rol si se proporciona
    const userRole = rol || 'tecnico';
    if (!VALID_ROLES.includes(userRole)) {
        return jsonResponse({ 
            error: `Rol inválido. Roles válidos: ${VALID_ROLES.join(', ')}` 
        }, 400);
    }

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: email.trim(),
        password,
        email_confirm: true, // Confirmar email automáticamente
        user_metadata: {
            nombre: nombre?.trim() || '',
            cargo: cargo?.trim() || '',
            rol: userRole,
            telefono: telefono?.trim() || '',
        },
    });

    if (error) {
        console.error('Error creating user:', error);
        if (error.message.includes('already been registered')) {
            return jsonResponse({ error: 'Ya existe un usuario con ese email' }, 400);
        }
        return jsonResponse({ error: error.message }, 400);
    }

    return jsonResponse({
        message: 'Usuario creado exitosamente',
        user: {
            id: data.user.id,
            email: data.user.email,
            nombre: data.user.user_metadata?.nombre || '',
            cargo: data.user.user_metadata?.cargo || '',
            rol: data.user.user_metadata?.rol || 'tecnico',
            telefono: data.user.user_metadata?.telefono || '',
        }
    }, 201);
}

interface UpdateUserPayload {
    id: string;
    email?: string;
    password?: string;
    nombre?: string;
    cargo?: string;
    rol?: string;
    telefono?: string;
    banned?: boolean;
}

async function updateUser(payload: UpdateUserPayload) {
    const { id, email, password, nombre, cargo, rol, telefono, banned } = payload;

    if (!id) {
        return jsonResponse({ error: 'ID de usuario es requerido' }, 400);
    }

    // Obtener usuario actual para preservar metadata existente
    const { data: { user: existingUser }, error: fetchError } = 
        await supabaseAdmin.auth.admin.getUserById(id);

    if (fetchError || !existingUser) {
        return jsonResponse({ error: 'Usuario no encontrado' }, 404);
    }

    // Validar rol si se proporciona
    if (rol && !VALID_ROLES.includes(rol)) {
        return jsonResponse({ 
            error: `Rol inválido. Roles válidos: ${VALID_ROLES.join(', ')}` 
        }, 400);
    }

    // Construir objeto de actualización
    const updateData: {
        email?: string;
        password?: string;
        user_metadata?: Record<string, string>;
        ban_duration?: string;
    } = {};

    if (email && email !== existingUser.email) {
        updateData.email = email.trim();
    }

    if (password && password.length >= 6) {
        updateData.password = password;
    } else if (password && password.length > 0 && password.length < 6) {
        return jsonResponse({ error: 'La contraseña debe tener al menos 6 caracteres' }, 400);
    }

    // Actualizar metadata preservando valores existentes
    updateData.user_metadata = {
        ...existingUser.user_metadata,
        nombre: nombre !== undefined ? nombre.trim() : existingUser.user_metadata?.nombre || '',
        cargo: cargo !== undefined ? cargo.trim() : existingUser.user_metadata?.cargo || '',
        rol: rol !== undefined ? rol : existingUser.user_metadata?.rol || 'tecnico',
        telefono: telefono !== undefined ? telefono.trim() : existingUser.user_metadata?.telefono || '',
    };

    // Manejar ban/unban
    if (banned === true) {
        updateData.ban_duration = '876000h'; // ~100 años (básicamente permanente)
    } else if (banned === false) {
        updateData.ban_duration = 'none';
    }

    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(id, updateData);

    if (error) {
        console.error('Error updating user:', error);
        return jsonResponse({ error: error.message }, 400);
    }

    return jsonResponse({
        message: 'Usuario actualizado exitosamente',
        user: {
            id: data.user.id,
            email: data.user.email,
            nombre: data.user.user_metadata?.nombre || '',
            cargo: data.user.user_metadata?.cargo || '',
            rol: data.user.user_metadata?.rol || 'tecnico',
            telefono: data.user.user_metadata?.telefono || '',
            banned_until: data.user.banned_until,
        }
    });
}

async function deleteUser(userId: string) {
    // Verificar que el usuario existe
    const { data: { user }, error: fetchError } = 
        await supabaseAdmin.auth.admin.getUserById(userId);

    if (fetchError || !user) {
        return jsonResponse({ error: 'Usuario no encontrado' }, 404);
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (error) {
        console.error('Error deleting user:', error);
        return jsonResponse({ error: error.message }, 400);
    }

    return jsonResponse({ 
        message: 'Usuario eliminado exitosamente',
        deletedUserId: userId 
    });
}

async function sendPasswordReset(payload: { email: string }) {
    const { email } = payload;

    if (!email) {
        return jsonResponse({ error: 'Se requiere el email del usuario' }, 400);
    }

    try {
        // Primero verificamos que el usuario existe y obtenemos su nombre
        const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        
        if (listError) {
            console.error('Error listing users:', listError);
            return jsonResponse({ error: 'Error al verificar usuario' }, 400);
        }

        const user = users.find((u: { email?: string }) => u.email === email);
        if (!user) {
            return jsonResponse({ error: 'Usuario no encontrado con ese email' }, 404);
        }

        const userName = user.user_metadata?.nombre || user.user_metadata?.full_name || email;

        // Generar link de recuperación
        // Usar la URL de producción o la configurada en SITE_URL
        const siteUrl = Deno.env.get('SITE_URL') || 'https://ohminstrumental.net';
        const { data, error } = await supabaseAdmin.auth.admin.generateLink({
            type: 'recovery',
            email: email,
            options: {
                redirectTo: `${siteUrl}`,
            }
        });

        if (error) {
            console.error('Error generating recovery link:', error);
            return jsonResponse({ error: error.message }, 400);
        }

        const recoveryLink = data.properties?.action_link;
        
        if (!recoveryLink) {
            return jsonResponse({ error: 'No se pudo generar el link de recuperación' }, 500);
        }

        // Enviar email con Resend
        const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
        if (!RESEND_API_KEY) {
            // Si no hay API key, devolver el link como fallback
            return jsonResponse({
                message: 'Link generado (Resend no configurado)',
                email: email,
                recoveryLink: recoveryLink,
                emailSent: false
            });
        }

        const emailHtml = generatePasswordResetEmail(userName, recoveryLink);
        
        const resendResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: 'OHM Instrumental <notificaciones@ohminstrumental.net>',
                to: [email],
                subject: 'Restablecer contraseña - OHM Instrumental',
                html: emailHtml,
            }),
        });

        const resendResult = await resendResponse.json();

        if (!resendResponse.ok) {
            console.error('Resend error:', resendResult);
            // Si falla Resend, devolver el link como fallback
            return jsonResponse({
                message: 'No se pudo enviar el email, pero aquí está el link',
                email: email,
                recoveryLink: recoveryLink,
                emailSent: false,
                resendError: resendResult.message
            });
        }

        return jsonResponse({
            message: 'Email de recuperación enviado exitosamente',
            email: email,
            emailSent: true,
            emailId: resendResult.id
        });
    } catch (err) {
        console.error('sendPasswordReset error:', err);
        return jsonResponse({ 
            error: err instanceof Error ? err.message : 'Error inesperado al generar recuperación' 
        }, 500);
    }
}

// Template de email para reset de contraseña
function generatePasswordResetEmail(nombre: string, resetLink: string): string {
    return `
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
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 14px;">Restablecer Contraseña</p>
        </div>
        
        <!-- Content -->
        <div style="background: white; padding: 30px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <p style="color: #374151; font-size: 16px; margin: 0 0 20px 0;">
                Hola <strong>${nombre}</strong>,
            </p>
            
            <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
                Recibimos una solicitud para restablecer la contraseña de tu cuenta. 
                Hacé clic en el botón de abajo para crear una nueva contraseña.
            </p>
            
            <!-- Button -->
            <div style="text-align: center; margin: 30px 0;">
                <a href="${resetLink}" 
                   style="display: inline-block; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); 
                          color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; 
                          font-weight: 600; font-size: 14px;">
                    Restablecer Contraseña
                </a>
            </div>
            
            <!-- Warning Box -->
            <div style="background: #fef3c7; border-radius: 8px; padding: 16px; margin: 20px 0; border-left: 4px solid #f59e0b;">
                <p style="color: #92400e; font-size: 13px; margin: 0;">
                    <strong>⚠️ Importante:</strong> Este link expira en 24 horas. Si no solicitaste restablecer tu contraseña, podés ignorar este email.
                </p>
            </div>
            
            <p style="color: #9ca3af; font-size: 12px; margin: 20px 0 0 0;">
                Si el botón no funciona, copiá y pegá este link en tu navegador:<br>
                <a href="${resetLink}" style="color: #4f46e5; word-break: break-all; font-size: 11px;">${resetLink}</a>
            </p>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            
            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
                Si tenés alguna consulta, contactanos a <a href="mailto:info@ohminstrumental.net" style="color: #4f46e5;">info@ohminstrumental.net</a>
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
