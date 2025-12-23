-- Migration: Add new columns to catalogo_servicios table
-- Run this in Supabase SQL Editor

-- Add nombre column for explicit service name
ALTER TABLE catalogo_servicios
ADD COLUMN IF NOT EXISTS nombre TEXT;

-- Add categorias column for linking to equipment categories (array of category values)
ALTER TABLE catalogo_servicios
ADD COLUMN IF NOT EXISTS categorias TEXT[] DEFAULT '{}';

-- Add precio_base column for future pricing feature
ALTER TABLE catalogo_servicios
ADD COLUMN IF NOT EXISTS precio_base DECIMAL(10,2) DEFAULT NULL;

-- Migrate existing data: copy descripcion to nombre for existing records
UPDATE catalogo_servicios
SET nombre = descripcion
WHERE nombre IS NULL AND descripcion IS NOT NULL;

-- Get sistema category for existing records that have sistema_id
UPDATE catalogo_servicios cs
SET categorias = ARRAY[s.categoria]
FROM sistemas s
WHERE cs.sistema_id = s.id 
  AND (cs.categorias = '{}' OR cs.categorias IS NULL)
  AND s.categoria IS NOT NULL;

-- Add 3 generic "Servicio Especial" entries for edge cases
INSERT INTO catalogo_servicios (nombre, descripcion, tipo_tarea, duracion_estimada_min, categorias, activo)
VALUES 
  ('Servicio Especial Nivel 1', 'Servicio especial genérico - renombrar cuando sea recurrente', 'REP', 60, '{}', true),
  ('Servicio Especial Nivel 2', 'Servicio especial genérico - renombrar cuando sea recurrente', 'REP', 120, '{}', true),
  ('Servicio Especial Nivel 3', 'Servicio especial genérico - renombrar cuando sea recurrente', 'REP', 180, '{}', true);

-- Verify changes
SELECT id, nombre, descripcion, tipo_tarea, duracion_estimada_min, categorias, sistema_id, activo 
FROM catalogo_servicios 
ORDER BY tipo_tarea, nombre;
