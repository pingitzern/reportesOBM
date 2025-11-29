# Estado de Situación del Sistema de Login

**Fecha de análisis:** 29 de Noviembre de 2025  
**Rama:** `ajustesFLOW`

---

## 1. Archivos Involucrados

| Archivo | Propósito |
|---------|-----------|
| `frontend/js/modules/login/auth.js` | Lógica principal de autenticación |
| `frontend/js/supabaseClient.js` | Cliente de Supabase (conexión a BD) |
| `frontend/index.html` (líneas 1501-1530) | HTML del formulario de login |
| `frontend/css/styles.css` | Estilos del login (`.login-container`, `.login-card`, etc.) |

---

## 2. Validación de Credenciales

### ✅ Autenticación REAL contra Supabase Auth

- Usa `supabase.auth.signInWithPassword()` con email/password
- Las credenciales se validan contra la tabla de usuarios de Supabase Auth
- **NO está hardcodeado en el frontend**

### Flujo de autenticación:

```javascript
// auth.js - función requestAuthentication()
const { data, error } = await supabase.auth.signInWithPassword({
    email: mail.trim(),
    password: password.trim(),
});
```

### ⚠️ Problema de seguridad detectado:

```javascript
// supabaseClient.js - PROBLEMA CRÍTICO
const supabaseKey = "eyJhbGci...v5A" // ← Esta es la SERVICE ROLE KEY
```

La **service_role key** tiene permisos de administrador y **NO debería estar expuesta en el frontend**. Debería usarse la **anon key**.

---

## 3. Persistencia de Sesión

### ✅ Usa LocalStorage

```javascript
const STORAGE_KEY = 'reportesOBM.user';
```

### Estructura de datos guardados:

```javascript
{
    user: {
        nombre: "string",
        cargo: "string", 
        rol: "string"     // "tecnico", "admin", etc.
    },
    token: "jwt_token_string",
    expiresAt: "2025-11-30T10:00:00.000Z" // ISO date o null
}
```

### Flujo de persistencia:

1. **Login exitoso** → `persistAuth()` guarda sesión en `localStorage`
2. **Recarga de página** → `loadStoredAuth()` recupera la sesión del storage
3. **Validación** → `isTokenActive()` verifica que el token no haya expirado
4. **Sincronización** → `syncSupabaseSession()` verifica con Supabase que la sesión siga activa

### Funciones clave:

| Función | Propósito |
|---------|-----------|
| `loadStoredAuth()` | Lee sesión de localStorage |
| `persistAuth(auth)` | Guarda sesión en localStorage |
| `clearStoredAuth()` | Limpia sesión de localStorage |
| `isTokenActive(token, expiresAt)` | Verifica si el token sigue vigente |
| `syncSupabaseSession()` | Sincroniza con el estado real de Supabase |

---

## 4. Seguridad

### Evaluación por aspecto:

| Aspecto | Estado | Detalle |
|---------|--------|---------|
| Overlay visual | ✅ Funciona | El `login-container` cubre toda la pantalla con `position: fixed` y `z-50` |
| Protección de datos | ⚠️ Parcial | Los datos SÍ requieren token para API calls |
| Token en requests | ✅ Implementado | `getCurrentToken()` usado en `api.js` para autorización |
| Service Role Key expuesta | ❌ **CRÍTICO** | La key está hardcodeada en el frontend |
| DEV_MODE bypass | ⚠️ Existe | `DEV_MODE = false` (desactivado actualmente, OK) |
| Expiración de token | ✅ Implementado | Verifica `expiresAt` antes de usar token |
| Logout | ✅ Implementado | Limpia localStorage y llama a `supabase.auth.signOut()` |

### Modo Desarrollo (DEV_MODE)

Existe un flag para desarrollo que permite saltear el login:

```javascript
// auth.js
const DEV_MODE = false; // Actualmente desactivado ✅

const DEV_USER = {
    nombre: 'Modo desarrollo',
    cargo: 'UI Preview',
    rol: 'Administrador',
};
```

Cuando `DEV_MODE = true`:
- Se salta la pantalla de login
- Se usa un token mock
- El usuario tiene rol "Administrador"

---

## 5. Funciones Exportadas (API pública)

```javascript
// Obtener información del usuario actual
getCurrentUser()       // → { nombre, cargo, rol } | null
getCurrentUserName()   // → "string" | ""
getCurrentUserRole()   // → "string" | ""
getCurrentToken()      // → "jwt_token" | null

// Control de autenticación
initializeAuth()           // Inicializa el sistema, muestra login si no hay sesión
logout()                   // Cierra sesión
requireAuthentication()    // Asegura que haya sesión activa
handleSessionExpiration()  // Maneja token expirado

// Utilidades (solo para testing)
isDevMode()            // → boolean
```

---

## 6. Problemas Críticos Identificados

### 🚨 1. Service Role Key expuesta en el frontend

**Archivo:** `frontend/js/supabaseClient.js`

```javascript
// PROBLEMA: Esta key tiene permisos de ADMINISTRADOR
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Riesgo:** 
- Cualquier persona que inspeccione el código puede obtener esta key
- Con la service_role key se puede bypassear Row Level Security (RLS)
- Permite acceso completo a TODOS los datos de la base de datos

**Solución:**
- Usar la **anon key** en el frontend (tiene permisos limitados por RLS)
- Mover la service_role key al backend únicamente

### ⚠️ 2. Credenciales hardcodeadas

Las credenciales de Supabase están en texto plano en el código:

```javascript
const supabaseUrl = "https://nvoihnnwpzeofzexblyg.supabase.co"
const supabaseKey = "eyJhbGci..."
```

**Solución:**
- Mover a variables de entorno (`.env`)
- Usar `import.meta.env.VITE_SUPABASE_URL` etc.

### ⚠️ 3. Código comentado obsoleto

El archivo `supabaseClient.js` tiene código comentado que sí usa variables de entorno correctamente, pero está desactivado.

---

## 7. Recomendaciones de Mejora

### Prioridad ALTA (Seguridad):

1. **Cambiar a anon key** - Reemplazar service_role key por anon key en el frontend
2. **Implementar RLS** - Configurar Row Level Security en todas las tablas
3. **Mover credenciales a `.env`** - Usar variables de entorno

### Prioridad MEDIA (UX):

4. **Refresh token automático** - Renovar token antes de que expire
5. **"Recordarme" opcional** - Checkbox para persistencia extendida
6. **Mejor feedback de sesión expirada** - Notificación clara al usuario

### Prioridad BAJA (Nice to have):

7. **Recuperación de contraseña** - Flujo de "Olvidé mi contraseña"
8. **Login con proveedores** - Google, Microsoft, etc.
9. **2FA** - Autenticación de dos factores

---

## 8. Flujo Visual del Login

```
┌─────────────────────────────────────────────────────────────┐
│                         INICIO                               │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   initializeAuth()                           │
│  1. Bind event listeners                                     │
│  2. Check DEV_MODE                                           │
└─────────────────────────┬───────────────────────────────────┘
                          │
              ┌───────────┴───────────┐
              │                       │
              ▼                       ▼
     ┌────────────────┐      ┌────────────────────┐
     │  DEV_MODE=true │      │  DEV_MODE=false    │
     │  (desarrollo)  │      │  (producción)      │
     └───────┬────────┘      └─────────┬──────────┘
             │                         │
             ▼                         ▼
     ┌────────────────┐      ┌────────────────────┐
     │ Usar dev token │      │ syncSupabaseSession│
     │ Mostrar app    │      └─────────┬──────────┘
     └────────────────┘                │
                               ┌───────┴───────┐
                               │               │
                               ▼               ▼
                      ┌──────────────┐  ┌──────────────┐
                      │ Sesión válida│  │ Sin sesión   │
                      └──────┬───────┘  └──────┬───────┘
                             │                 │
                             ▼                 ▼
                      ┌──────────────┐  ┌──────────────┐
                      │ Mostrar app  │  │ Mostrar login│
                      │ Ocultar login│  │ Ocultar app  │
                      └──────────────┘  └──────────────┘
```

---

## 9. Próximos Pasos

- [ ] Reemplazar service_role key por anon key
- [ ] Descomentar código que usa variables de entorno
- [ ] Crear archivo `.env` con credenciales
- [ ] Verificar RLS en Supabase
- [ ] Implementar refresh token
- [ ] Agregar opción "Recordarme"
