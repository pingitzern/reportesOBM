# generate-maintenance-pdf

Supabase Edge Function responsable de generar y almacenar un PDF para cada mantenimiento.

## Pre-requisitos

1. Crear un bucket privado para los reportes (una sola vez):
   ```bash
   supabase storage create-bucket maintenance-reports --private
   ```
2. Configurar secretos para el proyecto (local y remoto):
   ```bash
   supabase secrets set \
     --project-ref <project-ref> \
     SUPABASE_URL=<project-url> \
     SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
     PDF_STORAGE_BUCKET=maintenance-reports \
     PDF_SIGNED_URL_TTL=900
   ```

## Ejecución local

```bash
supabase functions serve generate-maintenance-pdf --env-file ./supabase/.env
```

Realizar una petición de prueba:

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"maintenanceId":"<uuid>"}' \
  http://localhost:54321/functions/v1/generate-maintenance-pdf
```

## Flujo

1. El frontend envía `maintenanceId` (y opcionalmente `forceRegenerate`).
2. La función obtiene el mantenimiento + cliente asociado usando el service-role key.
3. Se construye un PDF básico con los datos principales (biblioteca `pdf-lib`).
4. El archivo se guarda como `maintenances/<maintenanceId>.pdf` en el bucket indicado.
5. Se devuelve la URL firmada (válida `PDF_SIGNED_URL_TTL` segundos) junto con la ruta en Storage.

## Próximos pasos

- Mejorar la plantilla PDF para replicar exactamente el layout de los reportes actuales.
- Guardar la ruta del PDF en la tabla `maintenances` para saber si ya existe uno generado.
- Agregar autenticación (por ejemplo valida tokens JWT del frontend) antes de permitir la generación.
