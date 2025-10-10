# Preparación de la base de datos para adjuntar fotos en los remitos

Para permitir que la aplicación almacene hasta cuatro fotos por remito (por ejemplo, cuando el técnico carga la información desde el celular), tenés que hacer algunos ajustes en la planilla de Google Sheets que actúa como base de datos.

## 1. Crear columnas para las fotos en la hoja `remitos`

En `scripts/RemitoRepository2025.txt` la aplicación define los encabezados que espera en la hoja `remitos` (Google Sheets). Actualmente se guardan columnas como `NumeroRemito`, `NombreCliente`, `Observaciones`, etc.【F:scripts/RemitoRepository2025.txt†L5-L37】

Agregá cuatro nuevas columnas al final de esa hoja llamadas, por ejemplo:

- `Foto1URL`
- `Foto2URL`
- `Foto3URL`
- `Foto4URL`

La aplicación podrá usar esas celdas para guardar los enlaces (URLs públicas o compartidas) de las imágenes que se suban desde el celular. Si preferís otro nombre, asegurate de actualizar los encabezados en el código para que coincidan.

## 2. Alinear los encabezados en el código

Una vez que la planilla tenga las cuatro columnas nuevas, actualizá el array `REMITOS_HEADERS` en `scripts/RemitoRepository2025.txt` para incluirlas. De esta forma, cuando el backend escriba un remito, va a generar las columnas vacías listas para recibir las URLs de las fotos.【F:scripts/RemitoRepository2025.txt†L5-L37】

Ejemplo de cómo quedaría el bloque (mostrado aquí solo como guía; los cambios concretos deben hacerse directamente en el archivo):

```js
const REMITOS_HEADERS = [
  'NumeroRemito', 'FechaCreacion', 'MailTecnico', 'NumeroReporte',
  'NombreCliente', 'Direccion', 'CUIT', 'Telefono', 'MailCliente',
  'ModeloEquipo', 'NumeroSerie', 'IDInterna',
  'Repuestos', 'Observaciones', 'IdUnico',
  'Foto1URL', 'Foto2URL', 'Foto3URL', 'Foto4URL'
];
```

## 3. Preparar el servicio que arma la fila del remito

El servicio que construye los datos antes de guardarlos es `RemitoService.crearRemito` (`scripts/RemitoService 2025.txt`). Ahí se arma el array `remitoRowData` con el mismo orden de columnas que `REMITOS_HEADERS`.【F:scripts/RemitoService 2025.txt†L40-L60】

Añadí cuatro entradas vacías (o con las URLs si ya las tenés disponibles) al final del array, respetando el orden de los encabezados. Esto asegura que cada nuevo remito cree automáticamente las columnas para las fotos.

```js
const remitoRowData = [
  // ... columnas existentes ...
  remito.IdUnico,
  '', '', '', '' // Foto1URL, Foto2URL, Foto3URL, Foto4URL
];
```

Cuando el frontend se actualice para enviar las URLs de las imágenes, reemplazá esos strings vacíos con los valores reales.

## 4. Almacenamiento de las imágenes

Las celdas nuevas solo guardan el enlace de cada foto. Para que los técnicos suban imágenes desde el celular necesitás definir dónde se alojarán (por ejemplo, Google Drive, Firebase Storage, Amazon S3, etc.) y generar un enlace compartible para cada imagen. Ese enlace es el que se guarda en las columnas `FotoXURL`.

## 5. Siguientes pasos en el frontend

En el formulario de remitos (`frontend/js/modules/remitos-gestion/remitos-gestion.js`) todavía no existe una sección de carga de imágenes; solo se capturan campos como cliente, dirección, observaciones, etc.【F:frontend/js/modules/remitos-gestion/remitos-gestion.js†L730-L852】

Una vez que las columnas estén listas en la base, el equipo de frontend puede añadir campos tipo `file` que permitan seleccionar hasta cuatro fotos y subirlas al almacenamiento elegido. Luego deberán enviar las URLs resultantes junto con el resto de los datos del remito para que `RemitoService` las guarde en las columnas nuevas.

---

Con estos ajustes en la hoja y el código, la base de datos va a estar lista para almacenar hasta cuatro fotos por remito en cuanto el frontend incorpore la carga de imágenes.
