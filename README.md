# reportesOBM

Sistema para gestionar el mantenimiento preventivo de equipos de ósmosis bajo mesada. La interfaz web permite cargar, editar y visualizar reportes mientras que un script de Google Apps Script persiste la información en Google Sheets.

## Estructura del repositorio

```
├── frontend/
│   ├── css/                 # Estilos base y utilidades (Tailwind + reglas personalizadas)
│   └── js/                  # Código JavaScript modular de la SPA
├── scripts/
│   └── gestor.gs            # Backend en Google Apps Script que expone la API REST
├── mprobajomesadaOHM2.html  # Entrada principal del frontend
├── OHM-agua.png             # Logo usado en informes y vista de impresión
└── README.md
```

### frontend/
- **css/**: contiene `styles.css` con la configuración de Tailwind y ajustes de impresión.
- **js/**: código JavaScript organizado por responsabilidades.
  - `config.js`: resuelve la URL de la API y expone constantes de conversión utilizadas en formularios.
  - `api.js`: cliente ligero para llamar al Apps Script (`guardar`, `buscar`, `actualizar`, `eliminar` y `dashboard`).
  - `forms.js`: lógica de inicialización del formulario, cálculos automáticos y serialización de datos.
  - `search.js`: renderiza resultados, abre el modal de edición y gestiona acciones de edición/eliminación.
  - `dashboard.js`: construye los gráficos de Chart.js y los indicadores de métricas.
  - `state.js` y `main.js`: coordinan estado compartido, eventos de la UI y el enrutamiento por pestañas.

Los módulos se cargan desde `mprobajomesadaOHM2.html` mediante `<script type="module" src="frontend/js/main.js"></script>`.

### scripts/
- `gestor.gs`: implementa el backend usando Google Apps Script. Define el contrato de datos con la hoja de cálculo, operaciones CRUD y los agregados que alimentan el dashboard.

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
   Numero_Reporte, Timestamp, ID_Unico
   ```
3. Anota el ID del documento (la cadena entre `/d/` y `/edit` en la URL del Sheet).
4. Si necesitas múltiples hojas dentro del mismo documento, asegúrate de que la pestaña que actuará como base de datos coincida con el valor de `SHEET_NAME` definido en el script.

### 2. Configurar el proyecto de Apps Script
1. Abre la hoja y navega a **Extensiones > Apps Script**.
2. Copia el contenido de [`scripts/gestor.gs`](scripts/gestor.gs) en el editor.
3. Sustituye los valores de las constantes iniciales:
   ```javascript
   const SHEET_ID = 'TU_ID_DE_HOJA';
   const SHEET_NAME = 'Nombre de pestaña';
   ```
4. Guarda el proyecto (por ejemplo `Gestor Reportes OBM`).

### 3. Publicar la API
1. En el editor de Apps Script ve a **Deploy > Test deployments** para comprobar que `doPost` responde sin errores con un payload de prueba.
2. Selecciona **Deploy > New deployment**, tipo **Web app**.
3. Define:
   - *Description*: por ejemplo `API reportes OBM`.
   - *Execute as*: `Me`.
   - *Who has access*: `Anyone` (o `Anyone with Google account` si el consumo estará autenticado).
4. Haz clic en **Deploy** y copia la URL generada; será tu `API_URL`.
5. Cada cambio en `gestor.gs` requiere una nueva implementación o actualización de la existente.

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

### Ejecutar en desarrollo
1. Clona el repositorio y entra en la carpeta `reportesOBM`.
2. Usa cualquier servidor estático (por ejemplo `npx serve` o `python -m http.server`) para exponer la raíz del proyecto:
   ```bash
   npx serve .
   # o
   python -m http.server 8080
   ```
3. Abre `http://localhost:3000/mprobajomesadaOHM2.html` (o el puerto configurado) y verifica que las pestañas y formularios respondan correctamente.
4. Ajusta `window.__APP_CONFIG__` en el HTML o en un fragmento inline antes de cargar `frontend/js/main.js`.

## Despliegue
1. Sube `mprobajomesadaOHM2.html`, la carpeta `frontend/` y los recursos estáticos al servidor o servicio de hosting elegido (Firebase Hosting, Netlify, GitHub Pages, etc.).
2. Inserta la configuración `window.__APP_CONFIG__` en el HTML del entorno productivo apuntando al despliegue del Apps Script.
3. Habilita HTTPS; Google Apps Script solo acepta solicitudes seguras.
4. Mantén sincronizados los encabezados de la hoja con el script; si agregas columnas, actualiza `gestor.gs` y redepliega la API.

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
5. **Actualización de documentación:** cualquier cambio en la estructura de datos debe reflejarse tanto en este README como en los comentarios de `gestor.gs`.
6. **Pull Request:** abre una PR enlazando el issue, describe el cambio y añade capturas si afectan a la UI. Asegúrate de que la rama esté actualizada con `main` antes de solicitar revisión.
7. **Revisión y despliegue:** atiende comentarios de revisión, actualiza el Apps Script y la configuración de `API_URL` en los entornos necesarios una vez fusionado el cambio.

Mantén la coherencia entre el frontend y la hoja de cálculo: los campos que se envían desde `frontend/js/forms.js` deben coincidir con los encabezados definidos en `scripts/gestor.gs` para evitar errores en producción.
