# Resumen del enfoque actual

## Objetivo general
El frontend apunta a encadenar el flujo de carga de un mantenimiento con la generación y gestión de remitos. Para lograrlo se coordinan módulos especializados que comparten estado (el reporte recién guardado, las fotos adjuntas y la metadata del cliente) y que llaman a los endpoints del Apps Script mediante el cliente `api.js`.

## Orquestación desde `main.js`
El archivo de entrada crea cada módulo con las dependencias que necesita y define callbacks entre ellos. Cuando el mantenimiento se guarda correctamente se notifica al módulo de remitos para que habilite la generación, y un reset del formulario descarta esos datos compartidos.【F:frontend/js/main.js†L2-L189】

## Módulo de mantenimiento
`createMaintenanceModule` inicializa el formulario, carga el padrón de clientes y gestiona los botones principales. Al guardar, arma un número de reporte (`generateReportNumber`), serializa todos los campos (`getFormData`) y llama a `guardarMantenimiento`. Si la operación tiene éxito, avisa al módulo de remitos mediante `onReportSaved` para que guarde una copia del reporte que se usará luego en el remito.【F:frontend/js/modules/mantenimiento/maintenance.js†L1-L132】【F:frontend/js/modules/mantenimiento/forms.js†L912-L968】

## Módulo de remitos
El módulo `createRemitoModule` conserva una instantánea del último mantenimiento guardado y controla la UI de fotos y repuestos. Con `handleMaintenanceSaved` habilita el botón "Generar remito" y, cuando se confirma, completa el formulario con los datos del reporte. La acción `handleFinalizarRemitoClick` arma el payload para el Apps Script (`action: 'crear_remito'`), adjunta observaciones, repuestos y envía las fotos en base64 (junto con los IDs existentes de Drive si ya estuvieran cargadas) para que el backend las suba a Google Drive y sólo persista los IDs. También valida la sesión y procesa la respuesta para mostrar mensajes de éxito o error.【F:frontend/js/modules/remito/remito.js†L861-L1073】

## Gestión de remitos existentes
`createRemitosGestionModule` es el panel de administración. Usa las funciones `obtenerRemitos`, `crearRemito`, `actualizarRemito` y `eliminarRemito` para paginar, editar y borrar registros. Cada interacción de la tabla se canaliza a través de `renderListado`, que actualiza el estado local y muestra errores si la llamada falla.【F:frontend/js/modules/remitos-gestion/remitos-gestion.js†L1768-L1837】

## Cliente API
Todas las operaciones HTTP pasan por `postJSON` en `api.js`, que inyecta el token de sesión vigente, uniforma los encabezados y traduce los errores de red o autenticación. Allí se exponen los métodos que consumen los módulos anteriores (`guardarMantenimiento`, `obtenerRemitos`, `crearRemito`, etc.).【F:frontend/js/api.js†L1-L160】

## Qué falta revisar
- Validar que el backend esté respondiendo con el formato esperado para `crear_remito` y `obtener_remitos`.
- Confirmar que el token generado en `login` llega correctamente a `postJSON` para evitar rechazos por sesión expirada.
- Probar el flujo completo con fotos grandes para asegurarnos de que la limitación de 5 MB y la normalización de nombres funciona según lo esperado.
