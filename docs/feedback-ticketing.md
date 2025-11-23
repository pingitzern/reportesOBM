# Sistema de Feedback Activo

## Objetivo
Recibir aportes de usuarios finales directamente desde el frontend y guardarlos en la pestaña `feedback` de la planilla `BaseDatosMantenimientosRO` para priorizar mejoras.

## Flujo
1. El usuario abre el menú o el botón flotante “¿Tenés sugerencias?” y completa el formulario.
2. El frontend (módulo `frontend/js/modules/feedback/feedback.js`) valida la entrada y llama a `enviarFeedbackTicket` en `frontend/js/api.js`.
3. El Apps Script procesa la acción `crear_ticket_feedback`, valida el token y delega en `OBM.FeedbackService`.
4. `FeedbackService` asegura los encabezados y guarda la fila en la hoja `feedback` con la estructura:
   - Timestamp
   - Usuario/Mail
   - Categoría
   - Impacto
   - Mensaje
   - Contacto Info
   - Permitir Contacto
   - Origen URL
   - User Agent
   - Estado (default `Nuevo`).
5. Se retorna un mensaje de confirmación al frontend y se muestra el toast de éxito.

## Deploy
- Ejecutar `npm run build` para regenerar `styles.build.css`.
- Sincronizar scripts con `npm run clasp:push` y luego desplegar desde la consola de Apps Script.
- Verificar que la hoja `feedback` existe y que la propiedad `FEEDBACK_SHEET_NAME` coincide.
