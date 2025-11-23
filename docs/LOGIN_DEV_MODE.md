# 🔐 Modo Desarrollo vs Producción - Sistema de Login

## Problema Identificado

El sistema tenía `DEV_MODE = true` en `frontend/js/modules/login/auth.js`, lo que causaba:

1. ❌ El frontend generaba tokens mock (`dev-token-XXXXX`)
2. ❌ El backend de Google Apps Script rechazaba estos tokens
3. ❌ No se cargaban datos (clientes, dashboard, remitos)

## Solución Implementada

Se cambió `DEV_MODE = false` para que el sistema use autenticación real.

---

## 📋 Cómo Funciona el Sistema de Autenticación

### Modo Producción (`DEV_MODE = false`)

```javascript
const DEV_MODE = false;
```

**Comportamiento:**
- ✅ Muestra pantalla de login al cargar
- ✅ Valida credenciales con el backend
- ✅ Genera token JWT válido
- ✅ Token se almacena en localStorage
- ✅ Todas las peticiones incluyen el token
- ✅ Backend valida el token en cada petición

**Flujo:**
1. Usuario ingresa email y contraseña
2. Frontend envía `action: 'login'` al backend
3. Backend valida credenciales
4. Backend genera token de sesión
5. Frontend guarda token y datos de usuario
6. Todas las peticiones posteriores incluyen el token

---

### Modo Desarrollo (`DEV_MODE = true`)

```javascript
const DEV_MODE = true;
```

⚠️ **ADVERTENCIA: El backend NO está configurado para aceptar tokens mock**

**Comportamiento actual:**
- ❌ Salta la pantalla de login
- ❌ Genera token mock sin validar
- ❌ Backend rechaza peticiones con token mock
- ❌ No se cargan datos

**Para que funcione correctamente necesitarías:**

1. Modificar `scripts/Codigo2025.gs` para detectar tokens mock
2. Agregar lógica de bypass de autenticación
3. ⚠️ **NO RECOMENDADO** para producción

---

## 🔧 Configuración Actual

### Frontend
- **Archivo:** `frontend/js/modules/login/auth.js`
- **Variable:** `DEV_MODE`
- **Valor actual:** `false` ✅

### Backend
- **Archivo:** `scripts/Codigo2025.gs`
- **Acciones públicas:** `login`, `version_info`
- **Requieren token:** todas las demás acciones

---

## 🚀 Cómo Usar el Sistema

### Para Desarrollo Normal (RECOMENDADO)

1. Mantén `DEV_MODE = false`
2. Usa credenciales válidas para hacer login
3. El token se guarda automáticamente
4. Refresca la página y seguirás autenticado (si el token no expiró)

### Credenciales de Prueba

**Ubicación:** Google Sheets → Pestaña `usuarios`

**Estructura:**
```
| mail | password | nombre | cargo | rol |
```

### Tiempo de Sesión

- **Duración:** 60 minutos (configurable en `SessionService.gs`)
- **Renovación:** Automática en cada petición si `renew: true`
- **Almacenamiento:** localStorage del navegador

---

## 🔒 Seguridad

### ✅ Buenas Prácticas Implementadas

1. **Tokens únicos:** UUID generados por Google Apps Script
2. **Expiración:** Tokens expiran después de 60 minutos
3. **Revocación:** Sistema de logout invalida el token
4. **Renovación:** Los tokens pueden renovarse automáticamente
5. **Validación:** Backend valida token en cada petición protegida

### ⚠️ Consideraciones

- Los tokens se almacenan en localStorage (accesible por JavaScript)
- No usar credenciales sensibles en desarrollo
- Los tokens mock NO deben usarse en producción
- Configurar HTTPS en producción para proteger tokens

---

## 🐛 Troubleshooting

### "No hay una sesión activa"

**Causa:** Token inválido, expirado o no existente

**Solución:**
```javascript
// 1. Verificar en consola del navegador
localStorage.getItem('reportesOBM.user')

// 2. Si está corrupto, limpiar
localStorage.removeItem('reportesOBM.user')

// 3. Recargar y hacer login nuevamente
```

### "Token inválido" o "Sesión expirada"

**Causa:** Token no reconocido por el backend o expirado

**Solución:**
1. Hacer logout
2. Hacer login nuevamente
3. Si persiste, verificar que el backend esté desplegado correctamente

### No se cargan datos después de login

**Causa:** 
- Backend no responde
- Token no se está enviando en las peticiones
- Acciones requieren token pero no está configurado

**Diagnóstico:**
```javascript
// En consola del navegador
import { getCurrentToken } from './js/modules/login/auth.js';
getCurrentToken(); // Debe retornar un string
```

---

## 📝 Cambios Realizados

### `frontend/js/modules/login/auth.js`

```diff
- const DEV_MODE = true;
+ const DEV_MODE = false;
```

### `frontend/js/api.js`

- ✅ Añadida función `isDevMode()` import
- ✅ Implementado sistema de acciones públicas en modo dev
- ✅ Validación condicional de token según modo

---

## 🎯 Próximos Pasos (Opcional)

Si deseas un verdadero modo desarrollo sin login:

1. **Backend:** Modificar `Codigo2025.gs`
   ```javascript
   // Detectar token mock
   if (data.token && data.token.startsWith('dev-token-')) {
     // Bypass autenticación
     // Solo en ambiente de desarrollo
   }
   ```

2. **Frontend:** Variables de entorno
   ```javascript
   const DEV_MODE = import.meta.env.DEV;
   ```

3. **Seguridad:** Nunca desplegar con DEV_MODE en producción

---

**Fecha:** Noviembre 2025  
**Branch:** featUI  
**Autor:** GitHub Copilot
