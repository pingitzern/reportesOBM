# reportesOBM

Sistema para gestionar el mantenimiento preventivo de equipos de ósmosis bajo mesada. La interfaz web permite cargar, editar y visualizar reportes mientras que un script de Google Apps Script persiste la información en Google Sheets.

## Estructura del repositorio

```
├── frontend/
│   ├── css/                 # Estilos base y utilidades (Tailwind + reglas personalizadas)
│   ├── index.html           # Entrada principal del frontend
│   ├── js/                  # Código JavaScript modular de la SPA
│   └── public/              # Activos estáticos servidos por Vite (logo OHM Agua accesible como /OHM-agua.png, etc.)
├── scripts/
│   ├── Codigo2025.gs        # Punto de entrada (router) que expone la API REST
│   ├── AuthService.gs       # Validación de usuarios contra la pestaña `login`
│   ├── SessionService.gs    # Manejo de tokens de sesión y limpieza programada
│   ├── RemitoRepository2025.gs # Utilidades para la hoja de remitos
│   └── RemitoService2025.gs # Lógica de generación y almacenamiento de remitos con fotos
└── README.md
```

### frontend/
- **css/**: contiene `styles.css` (fuente con directivas de Tailwind) y `styles.build.css` (salida compilada que se enlaza desde `index.html`).
- **js/**: código JavaScript organizado por responsabilidades.
  - `config.js`: resuelve la URL de la API y expone constantes de conversión utilizadas en formularios.
  - `api.js`: cliente ligero para llamar al Apps Script (`guardar`, `buscar`, `actualizar`, `eliminar` y `dashboard`).
  - `auth.js`: gestiona el flujo de inicio de sesión, muestra el modal de autenticación y persiste el token de acceso del usuario.
  - `forms.js`: lógica de inicialización del formulario, cálculos automáticos y serialización de datos.
  - `search.js`: renderiza resultados, abre el modal de edición y gestiona acciones de edición/eliminación.
  - `dashboard.js`: construye los gráficos de Chart.js y los indicadores de métricas.
  - `state.js` y `main.js`: coordinan estado compartido, eventos de la UI y el enrutamiento por pestañas.

Los módulos se cargan desde `frontend/index.html` mediante `<script type="module" src="frontend/js/main.js"></script>`.

### scripts/
- `Codigo2025.gs`: implementa el router principal del backend en Google Apps Script. Define el contrato de datos con la hoja de cálculo, operaciones CRUD, los agregados que alimentan el dashboard y delega la autenticación y manejo de remitos a los servicios específicos.
- `AuthService.gs`: encapsula la autenticación contra la pestaña `login` del spreadsheet.
- `SessionService.gs`: gestiona los tokens temporales para el frontend (creación, validación, limpieza periódica) almacenados en la pestaña `sessions`.
- `RemitoRepository2025.gs`: funciones utilitarias para manipular la hoja donde se guardan los remitos, para generar numeración correlativa y para alinear las columnas destinadas a fotos.
- `RemitoService2025.gs`: compone y persiste los remitos a partir de reportes existentes y maneja la subida de fotografías al Drive configurado. El PDF final se genera desde el frontend y se descarga localmente mediante la vista de impresión del navegador.

## Configuración de Google Sheets y Apps Script

### 1. Preparar la hoja de cálculo
1. Crea una copia de la hoja de control o diseña una nueva en blanco.
2. Define la fila 1 con los encabezados exactos (en este orden):
   ```text
   Cliente, Fecha_Servicio, Direccion, Tecnico_Asignado, Modelo_Equipo,
   ID_Interna_Activo, Numero_Serie, Proximo_Mantenimiento,
   Fugas_Visibles_Found, Fugas_Visibles_Left,
   Conductividad_Red_Found, Conductividad_Red_Left,
   Conductividad_Permeado_Found, Conductividad_Permeado_Left,
   Rechazo_Ionico_Found, Rechazo_Ionico_Left,
   Presion_Entrada_Found, Presion_Entrada_Left,
   Caudal_Permeado_Found, Caudal_Permeado_Left,
   Caudal_Rechazo_Found, Caudal_Rechazo_Left,
   Relacion_Rechazo_Permeado_Found, Relacion_Rechazo_Permeado_Left,
   Precarga_Tanque_Found, Precarga_Tanque_Left,
   Test_Presostato_Alta_Found, Test_Presostato_Alta_Left,
   Test_Presostato_Baja_Found, Test_Presostato_Baja_Left,
   Etapa1_Detalles, Etapa1_Accion,
   Etapa2_Detalles, Etapa2_Accion,
   Etapa3_Detalles, Etapa3_Accion,
   Etapa4_Detalles, Etapa4_Accion,
   Etapa5_Detalles, Etapa5_Accion,
   Etapa6_Detalles, Etapa6_Accion,
   Sanitizacion_Sistema, Resumen_Recomendaciones,
   Numero_Reporte, Actualizado_por, Timestamp, ID_Unico
   ```
3. Anota el ID del documento (la cadena entre `/d/` y `/edit` en la URL del Sheet).
4. Si necesitas múltiples hojas dentro del mismo documento, asegúrate de que la pestaña que actuará como base de datos coincida con el valor que cargarás en la propiedad `SHEET_NAME` del proyecto de Apps Script.
5. Crea una pestaña adicional para el directorio de clientes (por defecto se espera `clientes`) con los encabezados:
   ```text
   Nombre, Direccion, Telefono, Mail, CUIT
   ```
   Cada fila debe contener los datos normalizados del cliente que quieras exponer a través de la API.
6. Añade una pestaña `login` con las columnas mínimas `mail` y `password` (puedes sumar `Nombre`, `Cargo`, `Rol` y otras columnas informativas). El backend validará las credenciales contra esta pestaña.
   - El servicio de sesiones (`SessionService.gs`) creará automáticamente una pestaña `sessions` la primera vez que se ejecute, por lo que no es necesario crearla a mano.

### 2. Configurar el proyecto de Apps Script
1. Abre la hoja y navega a **Extensiones > Apps Script**.
2. Copia el contenido de los archivos `scripts/Codigo2025.gs`, `scripts/AuthService.gs`, `scripts/SessionService.gs`, `scripts/RemitoRepository2025.gs` y `scripts/RemitoService2025.gs` en el editor (un archivo por pestaña del proyecto de Apps Script).
3. Define las propiedades del script `SHEET_ID`, `SHEET_NAME` y `CLIENTES_SHEET_NAME`:
   - Abre **Project Settings** (icono de engranaje en la barra lateral). En la sección **Script properties**, pulsa **Add script property** y crea las claves `SHEET_ID` (con el ID del documento de Google Sheets), `SHEET_NAME` (con el nombre exacto de la pestaña que actúa como base de datos principal) y `CLIENTES_SHEET_NAME` (con el nombre de la pestaña que contiene el padrón de clientes; si usas el valor por defecto basta con indicar `clientes`).
   - Como alternativa, edita la función `initProperties()` incluida al inicio de `Codigo2025.gs` con tus valores y ejecútala una vez desde **Run > Run function > initProperties**. Esto almacenará los campos en las propiedades del script; posteriormente puedes volver a dejar la función con valores genéricos si lo prefieres.
4. Guarda el proyecto (por ejemplo `Gestor Reportes OBM`).

### 3. Publicar la API
1. En el editor de Apps Script ve a **Deploy > Test deployments** para comprobar que `doPost` responde sin errores con un payload de prueba.
2. Selecciona **Deploy > New deployment**, tipo **Web app**.
3. Define:
   - *Description*: por ejemplo `API reportes OBM`.
   - *Execute as*: `Me`.
   - *Who has access*: `Anyone` (o `Anyone with Google account` si el consumo estará autenticado).
4. Haz clic en **Deploy** y copia la URL generada; será tu `API_URL`.
5. Cada cambio en cualquiera de los archivos `.gs` requiere una nueva implementación o actualización de la existente.

## Configuración del frontend

### Definir la URL de la API
La aplicación necesita conocer la URL publicada en el paso anterior. Puedes configurarla de dos maneras:

- **En tiempo de ejecución (recomendado para despliegues estáticos):**
  ```html
  <script>
    window.__APP_CONFIG__ = {
      API_URL: 'https://script.google.com/macros/s/.../exec',
    };
  </script>
  <script type="module" src="frontend/js/main.js"></script>
  ```
- **Variable de entorno:** si sirves la app con un entorno Node o un bundler que exponga `process.env.API_URL`, `frontend/js/config.js` la detectará automáticamente.

Si no se define ninguna de las opciones, la consola mostrará una advertencia y las peticiones fallarán.

### Autenticación en la SPA

Al iniciar la aplicación el usuario debe autenticarse mediante el modal integrado en la interfaz. Las credenciales se verifican contra la pestaña `login` del spreadsheet (gestionada por `AuthService.gs`) y, si son válidas, se genera un token temporal almacenado en la pestaña `sessions` mediante `SessionService.gs`. El token y el correo se guardan en `localStorage` para reutilizarlos en sesiones posteriores. Todas las peticiones `guardar`, `buscar`, `actualizar`, `eliminar`, `dashboard` y remitos incluyen automáticamente esas credenciales, y también es posible cerrar sesión desde el encabezado para forzar un nuevo inicio de sesión.

Para entornos de desarrollo compartidos mantenemos una cuenta administrativa de referencia. Las credenciales actuales se documentan en `docs/credentials.md`; cada vez que se actualice la contraseña en la pestaña `login` conviene reflejar el cambio en ese archivo para que el equipo disponga de un único punto de consulta.

### Ejecutar en desarrollo
1. Clona el repositorio y entra en la carpeta `reportesOBM`.
2. Instala las dependencias con `npm install`.
3. Lanza el entorno de desarrollo con `npm run dev`. El script ejecuta previamente `npm run build:css` para garantizar que `styles.build.css` esté actualizado y luego inicia el servidor de Vite (por defecto en `http://localhost:5173/`).
4. Abre la URL indicada en la consola y verifica que las pestañas y formularios respondan correctamente.
5. Si necesitas probar desde otro dispositivo en la misma red local (por ejemplo, un celular), mantén el servidor en ejecución y abre `http://<IP-de-tu-notebook>:5173/` desde el navegador del dispositivo. Puedes obtener la IP local con `ipconfig` (Windows) o `ifconfig`/`ip addr` (macOS/Linux). El servidor de Vite ya está configurado para aceptar conexiones externas, solo asegúrate de que ambos dispositivos estén en la misma red y que el firewall permita el acceso.
6. Ajusta `window.__APP_CONFIG__` en el HTML o inyecta la configuración antes de cargar `frontend/js/main.js`.

### Regenerar el CSS de Tailwind
- Edita los estilos base en `frontend/css/styles.css`. El archivo generado `frontend/css/styles.build.css` no debe modificarse a mano.
- Ejecuta `npm run build:css` cada vez que agregues clases o cambies estilos para actualizar la salida consumida por `index.html`.
- Si prefieres recompilar automáticamente mientras desarrollas, puedes ejecutar `npm run build:css -- --watch` en una terminal aparte.

## Despliegue
1. Ejecuta `npm run build` para generar la carpeta `dist/` con los assets optimizados (el comando compila Tailwind y empaca el frontend con Vite).
2. Sube el contenido de `dist/` al servicio de hosting elegido (Firebase Hosting, Netlify, GitHub Pages, etc.).
3. Inserta la configuración `window.__APP_CONFIG__` en el HTML del entorno productivo apuntando al despliegue del Apps Script.
4. Habilita HTTPS; Google Apps Script solo acepta solicitudes seguras.
5. Mantén sincronizados los encabezados de la hoja con el script; si agregas columnas, actualiza `Codigo2025.gs` (y los servicios relacionados si corresponde) y redepliega la API.

## Requisitos y flujo de trabajo para colaboradores

### Requisitos básicos
- Git >= 2.30.
- Node.js >= 18 (para disponer de `npx` y servidores estáticos de prueba).
- Cuenta de Google con acceso de edición a la hoja de cálculo utilizada para desarrollo.
- Navegador moderno con soporte de ES Modules.

### Flujo de trabajo sugerido
1. **Planificación:** crea un issue describiendo el cambio y discútelo con el equipo.
2. **Entorno local:** clona el repositorio, configura un Sheet de prueba (puedes duplicar el existente) y despliega un Apps Script propio siguiendo los pasos anteriores.
3. **Rama de trabajo:** crea una rama descriptiva (`feature/…` o `fix/…`) y realiza commits atómicos con mensajes en imperativo.
4. **Pruebas manuales:** ejecuta el servidor estático, verifica flujo de carga/edición/búsqueda, revisa la consola y, si se modifican datos, confirma que aparecen correctamente en el Sheet.
5. **Actualización de documentación:** cualquier cambio en la estructura de datos debe reflejarse tanto en este README como en los comentarios de `Codigo2025.gs` y los servicios relacionados.
6. **Pull Request:** abre una PR enlazando el issue, describe el cambio y añade capturas si afectan a la UI. Asegúrate de que la rama esté actualizada con `main` antes de solicitar revisión.
7. **Revisión y despliegue:** atiende comentarios de revisión, actualiza el Apps Script y la configuración de `API_URL` en los entornos necesarios una vez fusionado el cambio.

Mantén la coherencia entre el frontend y la hoja de cálculo: los campos que se envían desde `frontend/js/forms.js` deben coincidir con los encabezados definidos en `scripts/Codigo2025.gs` para evitar errores en producción.
