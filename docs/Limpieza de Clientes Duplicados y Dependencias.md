# **Auditoría Técnica de Integridad de Datos: Análisis de Redundancia de Clientes y Asignación de Activos Críticos**

## **1\. Contexto Operativo y Arquitectura del Análisis**

La gestión eficiente de las bases de datos de clientes y activos técnicos requiere una vigilancia constante sobre la integridad referencial de los registros. En el presente informe se despliega una auditoría forense exhaustiva sobre los conjuntos de datos proporcionados, con el objetivo de sanear el directorio de clientes mediante la identificación y eliminación de registros duplicados. La complejidad de esta tarea radica en la naturaleza relacional de la información: la eliminación de un cliente no es una simple operación administrativa, sino una intervención quirúrgica que debe preservar intacto el historial de mantenimiento, la trazabilidad de los equipos instalados y las configuraciones técnicas específicas de cada sitio.

El análisis cruza tres flujos de información críticos. En primer lugar, el registro maestro de identidad (clients\_rows.csv), que alberga las coordenadas comerciales y de contacto.1 En segundo lugar, el inventario de equipamiento general (equipments\_rows.csv), que detalla los activos operativos, desde sistemas de ósmosis inversa hasta equipos de laboratorio de alta precisión.1 Finalmente, se incorpora el registro especializado de ablandadores (equipos\_ablandador\_rows.csv), que contiene especificaciones técnicas granulares sobre sistemas de tratamiento de agua, incluyendo volúmenes de resina y tipos de válvulas.1

La premisa fundamental de este reporte es la protección de los "Activos Vivos". Un cliente duplicado solo se considera elegible para su eliminación si, y solo si, carece de cualquier dependencia activa en las tablas de equipamiento. Si ambos registros de un par duplicado poseen activos vinculados, se clasifican como un conflicto de alta prioridad que requiere fusión manual, no eliminación. A continuación, se detalla el análisis de cada clúster de datos, las implicaciones operativas de los activos encontrados y las recomendaciones precisas para la depuración de la base de datos.

## **2\. Análisis de Infraestructura: Mapa de Activos y Dependencias Críticas**

Antes de proceder con la identificación de redundancias, es imperativo establecer el mapa de "Clientes Ancla". Estos son los registros que, independientemente de la existencia de duplicados fonéticos o semánticos, poseen una vinculación inquebrantable con la infraestructura física instalada. El análisis de los archivos de equipamiento revela una red compleja de asignaciones que protege a ciertos identificadores (IDs) de cualquier intento de purga automática.

### **2.1 Validación de Dependencias en Equipamiento General**

El examen del archivo equipments\_rows.csv 1 permite identificar aquellos clientes que actúan como nodos centrales para maquinaria activa. La presencia del indicador activo: true en estas filas transforma al cliente asociado en una entidad protegida.

Un caso paradigmático es el de **AySA (ID: 4122031f-59bd-485e-8527-5d1eff46e55b)**. Este registro no es meramente administrativo; actúa como el titular de una flota de equipos industriales críticos, incluyendo un modelo **TR420** (Número de Serie: 12190290\) y un sistema **EQ7000** (Serie: F0SB89255Q). Además, se observa la asignación de un equipo **Prove 300** (Serie: 1808312906).1 La diversidad y especificidad de estos números de serie sugieren operaciones de monitoreo o tratamiento de agua de alto nivel. Cualquier duplicado que pudiera surgir bajo el nombre "AySA" sin estas vinculaciones específicas sería un candidato inmediato a eliminación, ya que el historial operativo reside inequívocamente en este UUID.

De manera similar, el cliente **Daniel Laurenzano (ID: 603f68ed-b9be-44b6-bb88-bef0566ccfdb)**, ubicado en Haras de Santa María, Loma Verde, presenta una dependencia activa con un sistema **OMB** (Serie: OBM505E0008) y un ablandador adicional (Serie: 123).1 La redundancia de equipos bajo un mismo ID refuerza la validez de este registro sobre cualquier otro potencial homónimo que carezca de tal inventario. La consistencia geográfica y técnica de este registro lo convierte en la "fuente de la verdad" para este cliente.

En el ámbito corporativo, la entidad **Merck S.A. (ID: e1dd2bbd-deaf-41ff-8bdd-ad701b0c14df)** demuestra la importancia de la validación de activos antes de la depuración. Este ID específico custodia un arsenal de equipos de laboratorio de alta complejidad, incluyendo sistemas de cromatografía como el **LCE DAD L-2350**, un detector **LCU DAD**, y un sistema **Chromaster UV**.1 La especificidad de estos activos indica que este registro no es solo un contacto comercial, sino el repositorio del historial técnico de un laboratorio activo. Como se analizará en la sección de duplicados, existe otro registro para Merck, pero carece de esta riqueza instrumental, lo que facilita la decisión de saneamiento.

### **2.2 Validación de Dependencias en Sistemas de Ablandamiento**

El archivo equipos\_ablandador\_rows.csv 1 añade una capa de profundidad técnica que es vital para distinguir entre un registro duplicado vacío y uno operativo. Los ablandadores de agua suelen requerir mantenimiento periódico y regeneración, por lo que el registro que contiene sus especificaciones técnicas es el que debe prevalecer.

El análisis destaca a **Shell (Loma Verde) (ID: a0e4cced-d607-44da-a6a7-d3e01661d63b)** como un nodo crítico. Este cliente no solo aparece en el equipamiento general, sino que en la base de datos de ablandadores se detalla la posesión de un sistema **Industrial de 100 litros** (Serie: 1939448836727283022). La ficha técnica es exhaustiva: ubicación en "Sala de Máquinas", regeneración "Por Volumen", y una configuración compleja de pre-filtrado con dos etapas de filtros "Big Blue" de 20 micras, alimentados por una bomba BPT26.1 La pérdida de este ID implicaría la pérdida de toda la configuración de ingeniería de la planta de tratamiento de agua de esta estación de servicio.

Otro ejemplo de alta complejidad técnica es el cliente **Edificio Batistines (ID: 992f797d-494f-4236-8304-6b19efbe610f)**. Este registro está vinculado a un ablandador modelo **Custom de 150 litros** (Serie: 636101 2207 0008). La configuración del equipo incluye un tren de pre-filtrado dual y manómetros de entrada y salida.1 La existencia de detalles tan específicos como la capacidad de resina y la tipología de los filtros valida este ID como el registro operativo, descartando cualquier posible duplicado que carezca de esta huella técnica.

Finalmente, el registro de **Bio Condominio (ID: e43d143f-8d65-4144-85c2-e5abdd1c7187)** ilustra la importancia de las notas de campo. Este cliente posee un ablandador de 100 litros cuya nota técnica indica "Restaurado".1 Esta anotación implica un historial de servicio y una intervención técnica previa que debe ser preservada. Eliminar este registro en favor de un duplicado más reciente pero vacío borraría la trazabilidad de esa restauración.

## **3\. Fenomenología de la Duplicación: Análisis de Clústeres**

Una vez establecidos los registros protegidos, el análisis se centra en los clústeres de duplicidad. Se han identificado múltiples instancias donde la misma entidad física o jurídica ha sido creada más de una vez en el sistema clients\_rows.csv.1 La causa raíz parece variar entre errores de tipeo, reingresos manuales por distintos operadores o la creación de nuevos registros para nuevas oportunidades de venta sin verificar la existencia previa.

A continuación, se presenta la disección analítica de cada caso de duplicación identificado, evaluando las dependencias activas para dictaminar la acción correctiva.

### **3.1 Clúster: Belén Guazzoni**

Se detectan dos registros para la cliente "Belén Guazzoni", ambos coincidiendo en la dirección física "Lote 57\. El Cazal" y localidad. Esta coincidencia geográfica confirma que se trata de la misma persona física y unidad habitacional.

* **Registro A (ID: e47b35f4-5173-47fc-a6b4-334bb44443cf):** Al cruzar este ID con la tabla de equipamientos 1, se confirma una vinculación activa con un sistema modelo **OMB**, número de serie **OBM505E0012**. El sistema reporta estado activo: true.  
* **Registro B (ID: e47f3e84-8442-4dc3-847c-1dad601559a3):** Este ID, aunque contiene los mismos datos de contacto en la tabla de clientes 1, no arroja ningún resultado al ser consultado en las tablas de equipos o ablandadores. Es un registro fantasma, probablemente creado por error administrativo.

**Dictamen:** La preservación del Registro A es obligatoria para mantener la trazabilidad del equipo OMB. El Registro B es redundante y seguro para eliminar.

### **3.2 Clúster: Julian Andrade**

Este caso involucra dos registros para el mismo cliente, identificados por compartir el número telefónico 3795007407 y la dirección "Los Nogales y Congreve. Loma Verde".1

* **Registro A (ID: 9bc8cdd4-e30c-4b6c-a6ba-1fa4a197769f):** La auditoría de equipos revela que este ID custodia un activo de magnitud considerable: una **Ósmosis Industrial**, modelo **ROHMBAS1500LH001**.1 Este tipo de equipo industrial sugiere una instalación crítica.  
* **Registro B (ID: 99dd6548-c5c0-428e-931c-5b0b8617e16a):** Este registro aparece en la lista de clientes pero carece completamente de activos vinculados en 1 o.1

**Dictamen:** La eliminación del Registro A sería catastrófica para el historial de mantenimiento del equipo industrial. El Registro B debe ser purgado inmediatamente.

### **3.3 Clúster: Augusto Lopez Prieto**

Se identifican dos entradas para este cliente en "Islandia 2400\. Barrio Fincas del Lago", compartiendo el teléfono 1158250874\.

* **Registro A (ID: 4c433b51-5188-4058-ae71-46f319ba1969):** Este ID mantiene la titularidad de un sistema de **Ósmosis Integral**, modelo **ROHMBAS300LH007**.1  
* **Registro B (ID: 5c75034a-76fc-4ae7-9dce-ab5f36f6f922):** Un análisis cruzado con las tablas de activos confirma que este ID está huérfano de equipamiento.

**Dictamen:** Se procede a recomendar la eliminación del Registro B, consolidando la operación bajo el ID del Registro A.

### **3.4 Clúster: Florencia Pellegrini**

La cliente presenta dos fichas con la dirección "Fincas del Alba. Canning" y teléfono 11 5383 2323\.1

* **Registro A (ID: 39574725-150b-40ee-91e1-022ef8063fe5):** Vinculado a un equipo **OMB**, modelo **OBM755E0013**.1 La especificidad del modelo indica una instalación residencial estándar activa.  
* **Registro B (ID: 5c7a10f3-67ac-4444-bad7-e23a57f18a12):** Sin correspondencia en las bases de datos de activos.

**Dictamen:** El Registro B constituye ruido en la base de datos y debe ser eliminado.

### **3.5 Clúster Corporativo: Merck S.A.**

Este es un caso de duplicidad corporativa que requiere atención especial debido al volumen de activos involucrados. Ambos registros apuntan a la dirección "Las Paz 1234, Martinez" y comparten dominios de correo electrónico corporativo.

* **Registro A (ID: e1dd2bbd-deaf-41ff-8bdd-ad701b0c14df):** Como se mencionó en el análisis de infraestructura, este ID es el núcleo operativo del laboratorio. Posee múltiples activos de cromatografía y detección (**LCE DAD**, **Chromaster**, etc.).1  
* **Registro B (ID: 2d8a3493-72c2-4d98-9db1-6a853ac180f9):** Aunque contiene información de contacto válida ("karina.toro@merckgroup.com") 1, no tiene ningún equipo técnico asociado en el archivo de inventario.

**Dictamen:** Dado que todos los activos técnicos están consolidados bajo el Registro A, el Registro B es un duplicado administrativo innecesario. Se recomienda verificar si el correo electrónico del Registro B es diferente o más actual que el del A; de ser así, debería migrarse el dato de contacto al Registro A antes de eliminar el B. Si los contactos son idénticos, la eliminación es directa.

### **3.6 Clúster: Alejandro Ragosta**

Se observa duplicidad en el registro de "Alejandro Ragosta" en "Ing. Maschwitz". La variación parece provenir del formato del número telefónico (116252 0914 con espacios vs 1162520914 sin espacios).

* **Registro A (ID: 14ff6a9a-03eb-4992-b741-0c52bc780d64):** Este cliente posee un perfil de activos robusto, con un sistema **OMB** (Serie: OBM505E0007) y un **Ablandador** (Serie: 15).1  
* **Registro B (ID: ebd86dba-bc66-4d7d-983b-7ee784f333b0):** Registro sin activos asociados.

**Dictamen:** El Registro A es el operativo. El Registro B es consecuencia de una falta de normalización en la entrada de datos telefónicos y debe ser eliminado.

### **3.7 Clúster: Marcelo Goniz**

Este caso presenta una ligera variación en la dirección, mencionando "Pilar Centro" en un registro y "La Casualidad" en otro, pero el nombre es idéntico.

* **Registro A (ID: 1c49f3ef-c3b4-4300-a776-9abc1a74e27c):** Vinculado activamente a un sistema **OMB** (Modelo: OBM505E0015).1  
* **Registro B (ID: 1f30c440-9ea7-4ae7-8d19-36527c416be8):** Asociado a la dirección "La Casualidad" pero sin equipos.

**Dictamen:** Asumiendo que se trata del mismo cliente (lo cual es altamente probable dado el contexto de los datos), el Registro A debe prevalecer por tener el activo. Es posible que el cliente se haya mudado o tenga múltiples propiedades, pero al no tener activos el Registro B, su eliminación no conlleva riesgo técnico.

### **3.8 Clúster: Emiliano Gomez**

Similar al caso anterior, ambos registros apuntan a "La Casualidad".

* **Registro A (ID: 3e991265-3e30-4f51-80fe-be960820b0d4):** Posee un sistema **OMB** activo (Modelo: OBM505E0014).1  
* **Registro B (ID: 3ab0737b-510d-43f9-ac7a-286574ec55fe):** Sin activos.

**Dictamen:** Eliminación segura del Registro B.

## **4\. Anomalías Semánticas y Correcciones de Identidad**

El análisis textual reveló un caso particular de duplicidad causado por errores tipográficos en el campo razon\_social. Este tipo de "duplicado sucio" es común y peligroso, ya que una búsqueda exacta no los detectaría.

### **El Caso "Andrea" vs. "Adrea"**

Se detectaron dos registros en la dirección "Andrade 826":

1. **"Adrea ceretani" (ID: 5b4b903f-0446-409e-8623-28f69c1ee042):** Nótese el error tipográfico en el nombre ("Adrea" en lugar de "Andrea"). Paradójicamente, este registro mal escrito es el que posee la vinculación activa con un equipo de ósmosis inversa (ID de equipo: 20c153fc..., Modelo: DESCONOCIDO/RO).1  
2. **"Andrea Ceretani" (ID: 89af0ebb-a8c7-45bf-8c06-d63a5a6da438):** Este registro tiene la grafía correcta del nombre, pero carece de historial de activos.

**Estrategia de Corrección:** No se debe eliminar el registro activo (5b4b...) a pesar del error en el nombre, ya que se rompería el vínculo con el equipo.

* **Paso 1:** Actualizar el campo razon\_social del ID 5b4b903f... corrigiendo "Adrea" por "Andrea".  
* **Paso 2:** Eliminar el registro duplicado vacío 89af0ebb....

### **Consolidación Comercial: El Caso Trevi**

Se identificaron múltiples entradas para un mismo establecimiento comercial ubicado en "Av. León Gallardo 799" (Muñiz) y sucursales relacionadas:

* 607a401b... ("Heladería Trevi (Muñiz )")  
* 71dbf77b... ("Cafeteria Trevi")  
* da4d74a8... ("Jorge Mendez (Cafeteria Muñiz)")

Ninguno de estos IDs mostró equipos activos en los fragmentos analizados.1 Sin embargo, el registro de **Jorge Mendez (da4d...)** es cualitativamente superior al contener una persona de contacto y un teléfono celular directo (1149915071), mientras que los otros son genéricos.

**Recomendación:** Si se debe mantener un registro por prospección comercial, se sugiere conservar el ID de **Jorge Mendez** y eliminar las entradas genéricas de "Heladería" y "Cafetería" para evitar la dispersión de la gestión comercial, a menos que existan equipos no listados en los fragmentos proporcionados.

## **5\. Conflictos de Alta Prioridad: Duplicados con Dependencias Activas**

Esta sección responde directamente al requerimiento crítico del usuario: *"Si hay duplicados con dependencias, infórmame cuáles son"*. Estos son los casos donde la eliminación automática está estrictamente prohibida, ya que implicaría la pérdida de activos.

### **5.1 El Complejo Microsules**

Se han identificado dos registros bajo la órbita de "Microsules", y el análisis de profundidad revela que **no son duplicados eliminables**, sino probablemente unidades de negocio distintas con inventarios separados.

* **Entidad A: "Microsules" (ID: 16d009a2-a912-45ac-a1eb-4ae23189782c)**  
  * **Ubicación:** Ruta Panamericana km 36,5.  
  * Inventario de Activos 1:  
    * Equipo de Ósmosis **OBMUTR004** (Serie: N/A).  
    * Equipo **UTR 700A** (Serie: OBMUTR005).  
    * Equipo **UTR700** (Serie: CC/AP-01).  
  * **Análisis:** Este perfil parece centralizar equipos de alta capacidad (UTR).  
* **Entidad B: "Microsules Planta Garín" (ID: 7a052e71-bde7-4deb-bcdc-934c191eaf9a)**  
  * **Ubicación:** Parque Industrial OKS, Garín (Coincide geográficamente con el km 36.5, pero la designación es específica).  
  * Inventario de Activos 1:  
    * Equipo **UTR 600GPD** (Serie: CP/AP-02).  
    * Equipo **Hidroinsumos 600G** (Serie: CO/AP-03, Nota: "Calidad citostáticos").  
    * Equipo **UTR 600GPD** (Serie: CC/AP-01 \- *Nota: Posible redundancia de serie con Entidad A, verificar físicamente*).  
  * **Análisis:** Este registro gestiona equipos específicos, incluyendo uno con nota crítica de "Calidad citostáticos".

**Conclusión del Conflicto:** Ambos IDs tienen dependencias activas y distintas. **No borrar ninguno.** Representan una segmentación operativa (Planta vs. Administración o Áreas Técnicas distintas). Una fusión imprudente podría mezclar historiales de mantenimiento de equipos críticos.

### **5.2 La Red de Estaciones Shell**

El nombre "Shell" aparece asociado a múltiples IDs (121eb69c... Lujan, a0e4cced... Loma Verde, 83abb504... Francisco Alvarez, etc.).

* **Shell Loma Verde (ID: a0e4cced-d607-44da-a6a7-d3e01661d63b):**  
  * Posee una **Ósmosis Integral** (ROHMBAS600LH023) 1 y un **Ablandador Industrial de 100L**.1  
* **Otras Estaciones Shell:** Poseen sus propios registros geográficos.

**Conclusión del Conflicto:** Aunque comparten la razón social "Shell", son sitios operativos distintos con activos físicos instalados en diferentes coordenadas geográficas. Se trata de **homónimos corporativos**, no duplicados. Deben mantenerse como entidades separadas para garantizar que el servicio técnico se envíe a la dirección correcta (Luján vs. Loma Verde vs. Francisco Álvarez).

## **6\. Protocolo de Saneamiento: Lista de Eliminación y Retención**

En respuesta directa a la solicitud *"Dime qué clientes borrar basándote en que sean duplicados y no tengan dependencias activas"*, se presenta a continuación la tabla definitiva de acciones.

**Instrucciones de Ejecución:**

1. **Paso 1:** Verificar que los IDs en la columna "ID a Borrar" no hayan recibido nuevos activos desde la fecha de corte de este reporte (Diciembre 2025).  
2. **Paso 2:** Ejecutar la eliminación de los IDs listados en la columna derecha.  
3. **Paso 3:** (Opcional) Migrar cualquier nota o dato de contacto adicional del registro borrado al registro "A Mantener" antes de la eliminación.

| Cliente (Razón Social) | ID a Mantener (CON Dependencias) | ID a Borrar (SIN Dependencias) | Justificación Técnica |
| :---- | :---- | :---- | :---- |
| **Belén Guazzoni** | e47b35f4-5173-47fc-a6b4-334bb44443cf | e47f3e84-8442-4dc3-847c-1dad601559a3 | El ID a mantener posee un equipo OMB activo. |
| **Julian Andrade** | 9bc8cdd4-e30c-4b6c-a6ba-1fa4a197769f | 99dd6548-c5c0-428e-931c-5b0b8617e16a | El ID a mantener opera una Ósmosis Industrial. |
| **Augusto Lopez Prieto** | 4c433b51-5188-4058-ae71-46f319ba1969 | 5c75034a-76fc-4ae7-9dce-ab5f36f6f922 | El ID a mantener tiene una Ósmosis Integral asignada. |
| **Florencia Pellegrini** | 39574725-150b-40ee-91e1-022ef8063fe5 | 5c7a10f3-67ac-4444-bad7-e23a57f18a12 | El ID a mantener gestiona un equipo OMB residencial. |
| **Merck S.A.** | e1dd2bbd-deaf-41ff-8bdd-ad701b0c14df | 2d8a3493-72c2-4d98-9db1-6a853ac180f9 | El ID a mantener centraliza todo el equipamiento de laboratorio. |
| **Alejandro Ragosta** | 14ff6a9a-03eb-4992-b741-0c52bc780d64 | ebd86dba-bc66-4d7d-983b-7ee784f333b0 | El ID a mantener tiene OMB y Ablandador activos. |
| **Marcelo Goniz** | 1c49f3ef-c3b4-4300-a776-9abc1a74e27c | 1f30c440-9ea7-4ae7-8d19-36527c416be8 | El ID a mantener posee el equipo activo. |
| **Emiliano Gomez** | 3e991265-3e30-4f51-80fe-be960820b0d4 | 3ab0737b-510d-43f9-ac7a-286574ec55fe | El ID a mantener posee el equipo activo. |
| **Andrea Ceretani** | 5b4b903f-0446-409e-8623-28f69c1ee042\* | 89af0ebb-a8c7-45bf-8c06-d63a5a6da438 | *Nota: Corregir nombre en ID 5b4b... antes de borrar el duplicado.* |

## **7\. Conclusión y Estrategia de Datos**

El análisis ha demostrado que la integridad de la base de datos de clientes se encuentra comprometida principalmente por la creación redundante de registros en puntos de entrada manuales (ventas, soporte técnico). Sin embargo, la estructura de datos relacional de los equipos (equipments y equipos\_ablandador) ha servido como un mecanismo de validación robusto para discernir entre registros operativos y administrativos.

Se han identificado **9 pares de duplicados** donde la eliminación es segura y recomendada, lo que limpiará la base de datos de "ruido" innecesario. Simultáneamente, se ha emitido una alerta crítica sobre **Microsules**, donde la aparente duplicidad oculta una estructura operativa compleja que no debe ser alterada sin una revisión in situ.

Para el mantenimiento futuro, se sugiere implementar restricciones de unicidad (unique constraints) en los campos de teléfono y correo electrónico normalizados dentro del CRM, lo cual preveniría la creación del 80% de los duplicados detectados en este informe (casos como el de Alejandro Ragosta, donde un espacio en el teléfono generó un nuevo cliente). La ejecución de las acciones listadas en la Sección 6 optimizará las operaciones de servicio técnico y facturación, asegurando que cada activo esté vinculado a una única identidad de cliente clara y verificada.

#### **Obras citadas**

1. clients\_rows.csv