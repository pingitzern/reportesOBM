# Migración del Apps Script monolítico a módulos 2025

Si tu proyecto de Apps Script todavía tiene un archivo único `gestor.gs`, sigue estos pasos para adoptar la versión modular y evitar conflictos al actualizar desde el repositorio.

## 1. Respaldar tu código actual
1. Abre el editor de Apps Script asociado al Sheet.
2. Descarga una copia del proyecto (`File > Download project`) o duplica el archivo `gestor.gs` en otra pestaña para conservarlo como referencia.

## 2. Eliminar el archivo legado
1. En el panel izquierdo, haz clic en los tres puntos del archivo `gestor.gs`.
2. Selecciona **Delete** para removerlo definitivamente. No debe quedar ningún archivo con ese nombre.

> Si tu PR en GitHub muestra un conflicto porque `scripts/gestor.gs` existe en `main`, resuélvelo borrando el archivo durante la fusión. El repositorio ya no lo incluye.

## 3. Crear los nuevos módulos
1. Crea archivos vacíos con los siguientes nombres dentro de tu proyecto de Apps Script:
   - `Codigo2025.gs`
   - `AuthService.gs`
   - `SessionService.gs`
   - `RemitoRepository2025.gs`
   - `RemitoService 2025.gs`
2. Copia el contenido de cada archivo `.txt` del repositorio a su archivo `.gs` correspondiente.

## 4. Actualizar constantes e IDs
1. Ajusta `SHEET_ID`, `SHEET_NAME` y `CLIENTES_SHEET_NAME` en `Codigo2025.gs`.
2. Verifica que `AuthService.gs` y `SessionService.gs` utilicen el mismo `SHEET_ID` y que existan las pestañas `login` y `sessions`.
3. En `RemitoService 2025.gs`, reemplaza `REMITO_FOTOS_FOLDER_ID` con el ID de la carpeta de Drive donde se subirán las fotos y revisa `MAX_REMITO_FOTOS`.

## 5. Probar y desplegar
1. Ejecuta `guardarRemito` desde el editor para confirmar que las dependencias se resuelven correctamente.
2. Usa **Deploy > Test deployments** para validar una petición POST con fotos.
3. Una vez verificado, realiza un **New deployment** para publicar la URL actualizada.

Siguiendo esta migración solo tendrás los módulos necesarios y evitarás que Google Apps Script mantenga referencias a `gestor.gs`, lo cual elimina los conflictos cuando actualices desde GitHub.
