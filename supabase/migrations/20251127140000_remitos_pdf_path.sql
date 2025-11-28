-- Agregar columna pdf_path para guardar el path del PDF generado en Storage
ALTER TABLE public.remitos ADD COLUMN IF NOT EXISTS pdf_path text;

-- Comentario
COMMENT ON COLUMN public.remitos.pdf_path IS 'Path del PDF del remito en Storage bucket remito-photos';
