-- Agregar columna pdf_path a maintenances para almacenar la ruta del PDF generado
ALTER TABLE public.maintenances ADD COLUMN IF NOT EXISTS pdf_path text;

-- Crear índice para búsquedas por pdf_path
CREATE INDEX IF NOT EXISTS idx_maintenances_pdf_path ON public.maintenances(pdf_path) WHERE pdf_path IS NOT NULL;

-- Comentario descriptivo
COMMENT ON COLUMN public.maintenances.pdf_path IS 'Ruta del archivo PDF del reporte de mantenimiento en Supabase Storage';
