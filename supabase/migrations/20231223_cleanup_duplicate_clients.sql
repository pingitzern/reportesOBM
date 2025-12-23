-- ============================================================
-- LIMPIEZA DE CLIENTES DUPLICADOS
-- Fecha: 2025-12-23
-- Basado en: docs/Limpieza de Clientes Duplicados y Dependencias.md
-- ============================================================

-- ============================================
-- FASE 1: VERIFICACIÓN DE SEGURIDAD
-- Ejecutar primero para confirmar que los IDs NO tienen dependencias
-- Resultado esperado: todos con equipos_count=0 y ablandadores_count=0
-- ============================================

SELECT c.id, c.razon_social, 
       COUNT(DISTINCT e.id) as equipos_count,
       COUNT(DISTINCT ea.id) as ablandadores_count,
       COUNT(DISTINCT m.id) as mantenimientos_count
FROM clients c
LEFT JOIN equipments e ON e.client_id = c.id
LEFT JOIN equipos_ablandador ea ON ea.cliente_id = c.id
LEFT JOIN maintenances m ON m.client_id = c.id
WHERE c.id IN (
  'e47f3e84-8442-4dc3-847c-1dad601559a3',  -- Belén Guazzoni
  '99dd6548-c5c0-428e-931c-5b0b8617e16a',  -- Julian Andrade
  '5c75034a-76fc-4ae7-9dce-ab5f36f6f922',  -- Augusto Lopez Prieto
  '5c7a10f3-67ac-4444-bad7-e23a57f18a12',  -- Florencia Pellegrini
  '2d8a3493-72c2-4d98-9db1-6a853ac180f9',  -- Merck S.A.
  'ebd86dba-bc66-4d7d-983b-7ee784f333b0',  -- Alejandro Ragosta
  '1f30c440-9ea7-4ae7-8d19-36527c416be8',  -- Marcelo Goniz
  '3ab0737b-510d-43f9-ac7a-286574ec55fe',  -- Emiliano Gomez
  '89af0ebb-a8c7-45bf-8c06-d63a5a6da438'   -- Andrea Ceretani (duplicado)
)
GROUP BY c.id, c.razon_social
ORDER BY c.razon_social;

-- ============================================
-- FASE 2: CORRECCIÓN DE NOMBRE
-- "Adrea Ceretani" -> "Andrea Ceretani" (typo en el registro con equipos)
-- ============================================

UPDATE clients
SET razon_social = 'Andrea Ceretani'
WHERE id = '5b4b903f-0446-409e-8623-28f69c1ee042'
  AND razon_social ILIKE '%adrea%';

-- ============================================
-- FASE 3: ELIMINACIÓN DE DUPLICADOS
-- Solo ejecutar después de confirmar Fase 1 (todos con 0 dependencias)
-- ============================================

DELETE FROM clients
WHERE id IN (
  'e47f3e84-8442-4dc3-847c-1dad601559a3',  -- Belén Guazzoni (dup sin equipos)
  '99dd6548-c5c0-428e-931c-5b0b8617e16a',  -- Julian Andrade (dup sin equipos)
  '5c75034a-76fc-4ae7-9dce-ab5f36f6f922',  -- Augusto Lopez Prieto (dup sin equipos)
  '5c7a10f3-67ac-4444-bad7-e23a57f18a12',  -- Florencia Pellegrini (dup sin equipos)
  '2d8a3493-72c2-4d98-9db1-6a853ac180f9',  -- Merck S.A. (dup sin equipos de lab)
  'ebd86dba-bc66-4d7d-983b-7ee784f333b0',  -- Alejandro Ragosta (dup sin equipos)
  '1f30c440-9ea7-4ae7-8d19-36527c416be8',  -- Marcelo Goniz (dup sin equipos)
  '3ab0737b-510d-43f9-ac7a-286574ec55fe',  -- Emiliano Gomez (dup sin equipos)
  '89af0ebb-a8c7-45bf-8c06-d63a5a6da438'   -- Andrea Ceretani (dup con nombre correcto pero sin equipos)
);

-- ============================================
-- VERIFICACIÓN FINAL
-- Confirmar que los clientes correctos siguen existiendo
-- ============================================

SELECT c.id, c.razon_social, 
       COUNT(DISTINCT e.id) as equipos,
       COUNT(DISTINCT ea.id) as ablandadores
FROM clients c
LEFT JOIN equipments e ON e.client_id = c.id
LEFT JOIN equipos_ablandador ea ON ea.cliente_id = c.id
WHERE c.id IN (
  'e47b35f4-5173-47fc-a6b4-334bb44443cf',  -- Belén Guazzoni (mantener)
  '9bc8cdd4-e30c-4b6c-a6ba-1fa4a197769f',  -- Julian Andrade (mantener)
  '4c433b51-5188-4058-ae71-46f319ba1969',  -- Augusto Lopez Prieto (mantener)
  '39574725-150b-40ee-91e1-022ef8063fe5',  -- Florencia Pellegrini (mantener)
  'e1dd2bbd-deaf-41ff-8bdd-ad701b0c14df',  -- Merck S.A. (mantener)
  '14ff6a9a-03eb-4992-b741-0c52bc780d64',  -- Alejandro Ragosta (mantener)
  '1c49f3ef-c3b4-4300-a776-9abc1a74e27c',  -- Marcelo Goniz (mantener)
  '3e991265-3e30-4f51-80fe-be960820b0d4',  -- Emiliano Gomez (mantener)
  '5b4b903f-0446-409e-8623-28f69c1ee042'   -- Andrea Ceretani (mantener, nombre corregido)
)
GROUP BY c.id, c.razon_social
ORDER BY c.razon_social;
