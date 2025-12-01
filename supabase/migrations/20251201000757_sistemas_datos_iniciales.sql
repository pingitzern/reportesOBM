-- ============================================================================
-- MIGRACIÓN: Datos iniciales del catálogo de Sistemas
-- Descripción: Carga los sistemas desde el catálogo existente
-- ============================================================================

-- Insertar sistemas con categorías asignadas automáticamente
insert into public.sistemas (nombre, codigo, descripcion, vida_util_dias, categoria) values
-- ABLANDADORES
('Ablandador 25 CAB', 'SOFTN25LPFC', 'Ablandador automático de 25 Litros de resina, según descripción técnica. Incluye un cartucho de prefiltracion de sólidos + cloro.', 2555, 'ablandador'),
('Ablandador 50 CAB', 'SOFTN50LPFC', 'Ablandador automatico de 50 Litros de resina, según descripción técnica. Incluye un cartucho de prefiltracion de sólidos + cloro y una bolsa de sal de 25 Kg.', 2555, 'ablandador'),
('Ablandador 75 CAB', 'SOFTN75LPFC', 'Ablandador automatico de 75 litros de resina, segun descripcion técnica. Incluye un cartucho de prefiltración de sólidos + cloro y una bolsa de sal de 25 Kg.', 2555, 'ablandador'),
('Ablandador 50 PP', 'SOFTN50LPP', 'Ablandador automático de 50 L de resina catiónica con prefiltración de solidos. Incluye tanque salero, válvula de bypass, accesorios de instalación y bolsa de sal de 25 Kg.', 365, 'ablandador'),
('Ablandador 25 PP', 'AA25PP', 'Ablandador automático de agua 25 litros con filtro de particulas', 365, 'ablandador'),
('Ablandador 150 PP', NULL, NULL, 2555, 'ablandador'),
('Ablandador 125L', 'Ablandador125', 'Ablandador de agua de 125 litros de resina con cabezal runxin F116 O similar', 365, 'ablandador'),
('Ablandador 200 l', 'SOFTN200LPFC', 'Ablandador automatico de 200 l de resina', 720, 'ablandador'),
('Ablandador 250 l', 'SOFTN250L', 'Ablandador automático de 250 l de resina con sistema de prefiltración', 1000, 'ablandador'),
('Ablandador 25 CAB Sin instalacion', 'SOFT25LPFCSIN', 'Ablandador automatico de 25 Litros de resina, según descripción técnica. Incluye un cartucho de prefiltracion de sólidos + cloro y una bolsa de sal de 25 Kg. No incluye servicio técnico de instalación.', 2555, 'ablandador'),
('Ablandador AA25L (S/I)', 'SOFTN25LPFPSIN', 'Ablandador automático de 25 litros de resina, según descripción técnica. Incluye un cartucho de prefiltración de sólidos, válvula de bypass y una bolsa de sal de 25 Kg.', 1100, 'ablandador'),
('Ablandador AA75L de resina (S/I)', 'SOFTN75LFPSIN', 'Ablandador automático de 75 Litros de resina, según descripción técnica. Incluye un cartucho de prefiltración de sólidos y una bolsa de sal de 25 Kg. No Incluye instalación.', 1100, 'ablandador'),
('Ablandador 20L CAB', 'Ablandador20CAB', 'Ablandador de 20 litros con filtro de carbón en bloque', 365, 'ablandador'),
('Ablandador compacto HF2500', 'OHMABLAHF25', 'Ablandador, 2500 l/h, marca Elektrim', 720, 'ablandador'),
('Ablandador auromatico de agua marca Elektrim, HF2500', 'ELKTHF2500', 'Ablandador automatico de agua compacto, de 23 litros de resina. Marca Elektrim. Modelo HF 2500. Caudal max. de servicio 2,2 m3/h. Entrada y saluda de 1"', 365, 'ablandador'),

-- OSMOSIS
('Osmosis Bajo Mesada 50/75GPD 5e', 'OHMORBMZ5', 'Sistema de osmosis inversa de 5 etapas de purificación 75 GPD con tanque de almacenamiento de 12 Litros', 2555, 'osmosis'),
('Osmosis Bajo Mesada 50/75GPD 6e', 'OHMORBMEZ6', 'Sistema de osmosis inversa de 6 etapas de purificación 75 GPD con tanque de almacenamiento de 12 Litros', 2555, 'osmosis'),
('Osmosis Bajo Mesada Industrial', NULL, NULL, 2555, 'osmosis'),
('Osmosis 300 l/h', 'OHMRO300LTS', 'Sistema de osmosis inversa para producción de 300 l/h de agua potable, con sistema de pretratamiento.', 2555, 'osmosis'),
('Osmosis 600 l/h', 'OHMRO600LTS', 'Sistema de osmosis inversa para producción de 600 l/h de agua potable, con sistema de pretratamiento', 720, 'osmosis'),
('Osmosis 1500 l/h', 'OHMRO1500LTS', 'Sistema de osmosis inversa para produccion de 1500 l/h de agua potable, con sistema de pretatamiento y bomba de baja presión.', 2555, 'osmosis'),
('Osmosis Inversa 1000 l/h', 'OHMRO1000LTS', 'Sistema de osmosis inversa para producción de 1000 l/h de agua potable, con sistema de pretratamiento y bomba de baja presión.', 2555, 'osmosis'),
('Osmosis bajo mesada 100 GPD/ 6E', '0HMORBMEZ100', 'Sistema de osmosis inversa de 6 etapas de purificación 75 GPD con tanque de almacenamiento de 12 Litros', 720, 'osmosis'),
('Osmosis bajo mesada 200 GPD 5E', 'OBM5ETAPACRA', 'Sistema de osmosis bajo mesada de 5 etapas de purificación de 200 GPD con tanque de almacenamiento de 12 litros.', 720, 'osmosis'),
('Osmosis bajo mesada 600GPD', 'EQUIOSMOUTR700A', 'Equipo osmosis UTR 700A', 720, 'osmosis'),
('Osmosis bajo mesada doble paso 50/75 gpd- 5e', 'OIBMDP775E', 'Sistema de osmosis inversa de 5 etapas de purificación, con doble paso de osmosis inversa 75 GPD con tanque de almacenamiento de 12 Litros.', 3000, 'osmosis'),
('Osmosis inversa 300 l/h- Bomba multiple etapa', 'OHMRO300BME', 'Sistema de osmosis inversa para producción de 300 l/h de agua potable, con sistema de pretratamiento. La bomba de alta presión es una bomba de multiples etapas con bajo nivel de ruido.', 365, 'osmosis'),

-- HPLC / CROMATOGRAFÍA
('HPLC CHROMASTER UV 5410', 'HPLCUV5410', 'Sistema cromatográfico modelo Chromaster con detector UV 5410, Bomba CM5160, Inyector automático CM5260, Horno calefactor de columnas CM5310', 2555, 'hplc'),
('HPLC LaChrom Elite DAD 2350', 'DAD 2350', 'HPLC LCE DAD con horno L-2350', 2550, 'hplc'),
('HPLC LaChrom Elite ULTRA DAD', 'LCU DAD', 'HPLC LaChrom Elite ULTRA con detector DAD', 2550, 'hplc'),
('HPLC Uv-vis LaCrom Elite', 'HPLC Uv-Vis 2420', 'Sistema HPLC con detector UV-Vis L-2420', 2250, 'hplc'),
('HPLC Agulent 1220', 'G4288c 1220 LC System VL', 'Cromatografo liquido modular, sin horno y válvula de inyección Manual', 2552, 'hplc'),
('HPLC Varían 920LC', 'HPLCVAR920LC', 'Sistema cromatografico Varían con detector de Fluorescecia y celda de Bromacion', 2250, 'hplc'),

-- MANTENIMIENTO PREVENTIVO HPLC
('MP HPLC CHROMASTER UV 5410', 'MPHPLCCM5410', 'MANTENIMIENTO PREVENTIVO para sistema cromatográfico modelo Chromaster con detector UV 5410, Bomba CM5160, Inyector automático CM5260, Horno calefactor de columnas CM5310', 365, 'servicio'),
('MP HPLC CHROMASTER DAD 5430', 'MPHPLCCM5430', 'MANTENIMIENTO PREVENTIVO para sistema cromatográfico modelo Chromaster con detector DAD 5430, Bomba CM5160, Inyector automático CM5260, Horno calefactor de columnas CM5310', 365, 'servicio'),
('OQ HPLC CHROMASTER UV 5410', 'OQHPLCCM5410', 'Calificación Operacional (OQ) para sistema cromatográfico modelo Chromaster con detector UV 5410', 356, 'servicio'),
('OQ HPLC CHROMASTER DAD 5430', 'OQHPLCCM5430', 'CALIFICACION OPERACIONAL (OQ) para sistema cromatográfico modelo Chromaster con detector DAD 5430', 365, 'servicio'),

-- PURIFICADORES Y EQUIPOS DE LABORATORIO
('Purificador de Agua', NULL, 'Milli-Q® Reference A+', 1, 'laboratorio'),
('Mili-Q IQ 7015', 'F2HB35837C', 'Purificador de agua Milli-Q', 0, 'laboratorio'),
('EQ7000', 'Purificador de agua', 'Purificador de agua EQ7000', 2558, 'laboratorio'),
('Espectrofotómetro', NULL, 'Prove 300', 1, 'laboratorio'),
('Spectroquant', 'Pharo 300', 'Espectro fotometro Pharo 300', 2558, 'laboratorio'),
('Termoreactor', 'TR 420', 'Termoreactor', 2558, 'laboratorio'),
('Muestreador de Aire', NULL, 'FKC', 365, 'laboratorio'),

-- SERVICIOS E INSUMOS
('Analisis de agua', 'ANALISOHM', 'Opcional: análisis de nivel de dureza total en el agua de alimentación', 365, 'servicio'),
('Instalacion Ablandador', 'INSTALLOHM', 'Instalacion y puesta en marcha. Incluye los accesorios basicos de instalacion', 365, 'servicio'),
('Viaticos', 'VIATICOHM', 'Viaticos por una visita tecnica', 2, 'servicio'),
('Visita de Relevamiento', 'OHMVISREV', 'Relevamiento general de instalaciones.', 365, 'servicio'),
('Visita de emergencia', 'VSEMEROHM', 'Visita de emergencia', 365, 'servicio'),
('Capacitacion HPLC Basica', 'OHMCAPBASIC', 'Capacitación básica sobre el uso de sistemas HPLC, detección y resolución de problemas, cuidados de módulos y columnas.', 365, 'servicio'),
('Servicio de Mantenimiento OBM', 'OHMSEROBM', 'Recambio de membrana de Osmosis Inversa de 400 gpd en equipo de Osmosis de Bajo Mesada.', 730, 'servicio'),
('Servicio de instalación básico.', 'OHMSERVAA', 'Servicio de instalación de equipo ablandador. Incluye dos visitas, una de relevamiento y, otra, de instalación y puesta en marcha.', 365, 'servicio'),
('Servicio de Mantenimiento AA25L', 'OHMSERVAA25L', 'Servicio de mantenimiento de equipo ablandador de 25L de resina.', 365, 'servicio'),
('Servicio de Mantenimiento AA50L', 'OHMSERAA50L', 'Servicio de Mantenimiento de equipo ablandador de 50L de resina.', 365, 'servicio'),

-- INSUMOS Y REPUESTOS
('Cartuchos de Prefiltración OI BM', 'OHMFILTOI10', 'Mantenimiento de Equipo de Osmosis Inversa. Elementos filtrantes por 3.', 365, 'insumo'),
('Membrana OI BM', 'OHMMEM50', 'Membrana de ósmosis inversa 50gpd.', 730, 'insumo'),
('Bomba presurizadora', 'OHMBOMPR', 'Bomba Presurizadora para aumentar la presión de una red hidráulica.', 1000, 'insumo'),
('Bomba a Diafragma', 'OHMBDIAF', 'Bomba Diafragma para Osmosis Inversa. 26V. (no incluye transformador)', 1000, 'insumo'),
('Bolsa de sal de 25 Kg, marca Dos Anclas', 'OHMSALDOSA', 'Sal lavada, purificada y seca.', 30, 'insumo'),
('Bolsa de sal RINSAL', 'SALRIN25KG', 'Bolsa de sal por 25 Kg, marca Rinsal. Para ablandadores de agua', 1, 'insumo'),
('Cabezal volumetrico Runxin F116Q3', 'RUNXINF116Q3', 'Cabezal Runxin x volumen- Modelo F116Q3. Caudal max. 4 m3/h, conexión entrada y salida 1"', 1, 'insumo'),
('Kit MP CM5160', 'OHMKITCM5160', 'Set de repuestos para bomba Chromaster modelo 5160', 365, 'insumo'),
('OHMD2LAMPCM', '892-2550', 'Lampara de Deuterio (D2) para sistema HPLC', 365, 'insumo'),

-- OTROS EQUIPOS
('ultrafiltración', 'OHMUF400', 'Sistema de Ultrafiltración. Capacidad 400 l/h con limpieza automática.', 720, 'otro'),
('Bomba de Vacio c.Vacuo', 'OHMVACPMPV', 'Bomba de vacío de 1/3 Hp, 70 Litros. 1 Mano vacuómetro, marca IMT ó similar. Con salida inferior', 2558, 'otro'),
('Unidad Filtrante 2000mL comp.', 'OHMUFKITA2000C', 'Sistema de filtración compuesto de Kitasato de 2000 ml, 1 vaso filtrante y 2 mts de manguera apta para alto vacío.', 7000, 'otro'),
('Unidad Filtrante 1000mL comp.', 'OHMUFKITA1000C', 'Sistema de filtración compuesto de Kitasato de 1000 ml, 1 vaso filtrante y 2 mts de manguera apta para alto vacío.', 7000, 'otro'),
('Sistema de cloración automatico', 'CLORCISOHM', 'Clorador para tanque Cisterna. Incluye bomba dosificadora Acquatron A1y Tanque de almacenamiento de cloro de 50 litros.', 2555, 'otro'),
('Disepenser Frio/ Calor para agua de pozo', 'DISPOHMPZ', 'Dispenser para agua de pozo, equipado con sistema de ósmosis inversa.', 1, 'otro')

on conflict (nombre) do update set
    codigo = excluded.codigo,
    descripcion = excluded.descripcion,
    vida_util_dias = excluded.vida_util_dias,
    categoria = excluded.categoria,
    updated_at = now();
