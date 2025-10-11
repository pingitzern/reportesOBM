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
│   ├── AuthService.txt             # Servicio de autenticación (hoja `login`)
│   ├── SessionService.txt          # Gestión de sesiones en la hoja `sessions`
│   ├── Codigo2025.txt              # Router principal y lógica de mantenimientos
│   ├── RemitoRepository2025.txt    # Acceso a la hoja de remitos
│   └── RemitoService 2025.txt      # Lógica de negocio para crear/listar remitos
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
- `AuthService.txt`: autenticación contra la pestaña `login` del Google Sheet.
- `SessionService.txt`: persistencia y validación de tokens de sesión en la pestaña `sessions`.
- `Codigo2025.txt`: router de Apps Script y lógica principal de mantenimientos/clientes.
- `RemitoRepository2025.txt`: helper para crear y escribir en la hoja de remitos.
- `RemitoService 2025.txt`: funciones para generar remitos, gestionar fotos y paginar resultados.

Cada archivo `.txt` contiene el código que debes pegar en un archivo `.gs` con el mismo nombre (sin la extensión) dentro de tu proyecto de Apps Script.

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

### 2. Configurar el proyecto de Apps Script
1. Abre la hoja y navega a **Extensiones > Apps Script**.
2. Si todavía conservas un archivo histórico llamado `gestor.gs`, elimínalo del proyecto antes de continuar. El código está dividido en módulos independientes y mantener ese archivo provoca conflictos al actualizar.
3. Crea los archivos necesarios en tu proyecto de Apps Script y pega el contenido correspondiente:
   - `Codigo2025.gs` ⟵ [`scripts/Codigo2025.txt`](scripts/Codigo2025.txt)
   - `AuthService.gs` ⟵ [`scripts/AuthService.txt`](scripts/AuthService.txt)
   - `SessionService.gs` ⟵ [`scripts/SessionService.txt`](scripts/SessionService.txt)
   - `RemitoRepository2025.gs` ⟵ [`scripts/RemitoRepository2025.txt`](scripts/RemitoRepository2025.txt)
   - `RemitoService 2025.gs` ⟵ [`scripts/RemitoService 2025.txt`](scripts/RemitoService%202025.txt)
4. Ajusta los IDs y constantes según tu entorno:
   - `Codigo2025.gs` expone los valores por defecto `SHEET_ID`, `SHEET_NAME` y `CLIENTES_SHEET_NAME`. Modifícalos al inicio del archivo o crea propiedades de script con esos nombres para evitar hardcodear los datos.
   - `AuthService.gs` comparte el `SHEET_ID` y espera una pestaña `login` con las columnas `mail` y `password`.
   - `RemitoService 2025.gs` define `REMITO_FOTOS_FOLDER_ID` (carpeta de Drive donde se guardan las fotos) y `MAX_REMITO_FOTOS`. Actualiza el ID con el de tu carpeta (`1SH7Zz7g_2sbYsFHMfVQj3Admdy8L3FVz` según la configuración proporcionada).
5. Guarda el proyecto (por ejemplo `Gestor Reportes OBM`).

> 📘 ¿Vienes de la versión anterior con un único `gestor.gs`? Sigue la guía de migración [`docs/migracion-apps-script.md`](docs/migracion-apps-script.md) para limpiar archivos viejos y copiar los nuevos módulos sin conflictos.

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

Al iniciar la aplicación el usuario debe autenticarse mediante el modal integrado en la interfaz. El token y el nombre de usuario se validan contra los valores configurados en la propiedad `AUTHORIZED_USERS` del Apps Script y, una vez aceptados, se almacenan en `localStorage` para reutilizarlos en sesiones posteriores. Todas las peticiones `guardar`, `buscar`, `actualizar`, `eliminar` y `dashboard` incluyen automáticamente esas credenciales, y también es posible cerrar sesión desde el encabezado para forzar un nuevo inicio de sesión.

### Ejecutar en desarrollo
1. Clona el repositorio y entra en la carpeta `reportesOBM`.
2. Instala las dependencias con `npm install`.
3. Lanza el entorno de desarrollo con `npm run dev`. El script ejecuta previamente `npm run build:css` para garantizar que `styles.build.css` esté actualizado y luego inicia el servidor de Vite (por defecto en `http://localhost:5173/`).
4. Abre la URL indicada en la consola y verifica que las pestañas y formularios respondan correctamente.
5. Ajusta `window.__APP_CONFIG__` en el HTML o inyecta la configuración antes de cargar `frontend/js/main.js`.

### Regenerar el CSS de Tailwind
- Edita los estilos base en `frontend/css/styles.css`. El archivo generado `frontend/css/styles.build.css` no debe modificarse a mano.
- Ejecuta `npm run build:css` cada vez que agregues clases o cambies estilos para actualizar la salida consumida por `index.html`.
- Si prefieres recompilar automáticamente mientras desarrollas, puedes ejecutar `npm run build:css -- --watch` en una terminal aparte.

## Despliegue
1. Ejecuta `npm run build` para generar la carpeta `dist/` con los assets optimizados (el comando compila Tailwind y empaca el frontend con Vite).
2. Sube el contenido de `dist/` al servicio de hosting elegido (Firebase Hosting, Netlify, GitHub Pages, etc.).
3. Inserta la configuración `window.__APP_CONFIG__` en el HTML del entorno productivo apuntando al despliegue del Apps Script.
4. Habilita HTTPS; Google Apps Script solo acepta solicitudes seguras.
5. Mantén sincronizados los encabezados de la hoja con `Codigo2025.gs` y `RemitoService 2025.gs`; si agregas columnas, actualiza esos archivos y redepliega la API.

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
5. **Actualización de documentación:** cualquier cambio en la estructura de datos debe reflejarse tanto en este README como en los comentarios de los archivos `.gs` correspondientes.
6. **Pull Request:** abre una PR enlazando el issue, describe el cambio y añade capturas si afectan a la UI. Asegúrate de que la rama esté actualizada con `main` antes de solicitar revisión.
7. **Revisión y despliegue:** atiende comentarios de revisión, actualiza el Apps Script y la configuración de `API_URL` en los entornos necesarios una vez fusionado el cambio.

Mantén la coherencia entre el frontend y la hoja de cálculo: los campos que se envían desde `frontend/js/forms.js` deben coincidir con los encabezados definidos en `Codigo2025.gs` y `RemitoService 2025.gs` para evitar errores en producción.
