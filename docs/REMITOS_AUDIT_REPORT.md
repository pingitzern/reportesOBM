# 📋 Informe de Auditoría - Flujo de Remitos con PDF

**Fecha:** 27 de Noviembre, 2025  
**Autor:** Auditoría de Código  
**Branch:** `feat/supabase-migration`

---

## 1. BASE DE DATOS - Columna `pdf_path`

| Estado | Detalle |
|--------|---------|
| ⚠️ **PENDIENTE DE VERIFICAR** | La migración existe pero requiere verificación en Supabase |

**Archivo de migración:** `supabase/migrations/20251127140000_remitos_pdf_path.sql`

```sql
ALTER TABLE public.remitos ADD COLUMN IF NOT EXISTS pdf_path text;
```

### Verificación requerida

Ejecutar en SQL Editor de Supabase:
```sql
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'remitos' AND column_name = 'pdf_path';
```
- Si devuelve 1 fila → Ya existe ✅
- Si devuelve 0 filas → Ejecutar la migración manualmente

---

## 2. STORAGE - Bucket `maintenance-reports`

| Componente | Estado | Detalle |
|------------|--------|---------|
| Bucket existe | ✅ | `maintenance-reports` |
| Código usa bucket correcto | ✅ | Referencias actualizadas a `maintenance-reports` |
| Ruta de archivos | ✅ | `Remitos/{remitoId}/` |
| **MIME Types** | ❌ | `allowed_mime_types = null` (PROBLEMA) |
| **Políticas RLS** | ✅ | 4 políticas para `service_role` existen |

### Rutas de archivos configuradas

- **Fotos:** `Remitos/{remitoId}/foto_{1-4}.jpeg`
- **PDF:** `Remitos/{remitoId}/remito_{numeroRemito}.pdf`

### Configuración actual del bucket

```json
{
  "id": "maintenance-reports",
  "public": false,
  "file_size_limit": null,
  "allowed_mime_types": null
}
```

---

## 3. CÓDIGO FRONTEND - Estado de Implementación

### Archivos modificados

| Archivo | Cambios realizados |
|---------|-------------------|
| `frontend/js/api.js` | Funciones `uploadRemitoPdfBlob()`, `guardarPdfRemito()`, `obtenerUrlPdfRemito()` |
| `frontend/js/modules/remito/remito.js` | Función `generatePdfBlob()`, integración con jsPDF + html2canvas |
| `frontend/js/modules/remitos-gestion/remitos-gestion.js` | Botón PDF, función `handleDescargarPdfRemito()` |

### Dependencias instaladas

```json
{
  "jspdf": "^x.x.x",
  "html2canvas": "^x.x.x"
}
```

### Flujo implementado

```
1. Usuario crea remito → crearRemito()
2. Se genera HTML del remito → createRemitoPrintHtml()
3. HTML se convierte a PDF blob → generatePdfBlob() [jsPDF + html2canvas]
4. PDF blob se sube a Storage → guardarPdfRemito() → uploadRemitoPdfBlob()
5. Se actualiza columna pdf_path en BD
6. En listado, botón PDF descarga desde Storage → obtenerUrlPdfRemito()
```

---

## 4. ERROR ACTUAL 🚨

### Mensaje de error

```
StorageApiError: new row violates row-level security policy
```

### Ubicación del error

- `api.js:413` - `uploadRemitoPhoto()` (subida de fotos)
- `api.js:442` - `uploadRemitoPdfBlob()` (subida de PDF)

### Causa raíz identificada

El bucket `maintenance-reports` tiene `allowed_mime_types = null`, lo cual puede estar causando restricciones inesperadas a pesar de tener políticas RLS correctas.

---

## 5. ACCIONES REQUERIDAS

### Paso 1: Verificar columna pdf_path

```sql
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'remitos' AND column_name = 'pdf_path';
```

### Paso 2: Actualizar configuración del bucket

```sql
UPDATE storage.buckets 
SET 
    file_size_limit = 52428800,
    allowed_mime_types = ARRAY[
        'application/pdf', 
        'image/jpeg', 
        'image/jpg', 
        'image/png', 
        'image/webp', 
        'image/heic', 
        'image/heif'
    ]
WHERE id = 'maintenance-reports';
```

### Paso 3: (Si sigue fallando) Hacer bucket público temporalmente

```sql
UPDATE storage.buckets SET public = true WHERE id = 'maintenance-reports';
```

Esto aísla si el problema es de RLS o de otra configuración.

---

## 6. RESUMEN DE ESTADO

| # | Componente | Estado |
|---|------------|--------|
| 1 | Migración `pdf_path` | ⚠️ Verificar si se ejecutó |
| 2 | Bucket existe | ✅ OK |
| 3 | Código de generación PDF | ✅ OK |
| 4 | Código de upload | ✅ OK |
| 5 | Políticas RLS Storage | ✅ Existen para service_role |
| 6 | **Config bucket MIME types** | ❌ **PROBLEMA - null** |

---

## 7. ARCHIVOS DE REFERENCIA

### Migraciones SQL

- `supabase/migrations/20251127130000_remitos_table.sql` - Tabla principal
- `supabase/migrations/20251127140000_remitos_pdf_path.sql` - Columna pdf_path
- `supabase/migrations/20251127180000_storage_policies.sql` - Políticas de Storage

### Código Frontend

- `frontend/js/api.js` - Funciones de API para remitos
- `frontend/js/modules/remito/remito.js` - Creación de remitos
- `frontend/js/modules/remitos-gestion/remitos-gestion.js` - Listado y gestión

---

## 8. PRÓXIMOS PASOS POST-FIX

Una vez que el upload funcione:

1. ✅ Probar crear remito con fotos
2. ✅ Verificar que PDF aparece en Storage (`Remitos/{id}/`)
3. ✅ Probar botón "📄 PDF" en listado de remitos
4. ⚠️ Considerar volver bucket a privado si se hizo público
5. 📝 Actualizar documentación de deploy

---

*Generado automáticamente - Auditoría de Código*
