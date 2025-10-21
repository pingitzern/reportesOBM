# CLASP deploy

Este documento describe cómo sincronizar y desplegar el proyecto Apps Script usando `clasp`.

Requisitos
- Node.js y npm
- `npm install -g @google/clasp`
- Haber ejecutado `clasp login` con la cuenta correcta

Pasos rápidos
1. Desde la raíz del repo:
   ```powershell
   # revisar estado
   clasp status

   # subir cambios
   clasp push

   # crear deployment
   clasp deploy --description "mi deploy"
   ```

Script automático
- Hay un script `deploy-clasp.ps1` en la raíz que ejecuta `clasp push` y `clasp deploy` en un solo paso.
  ```powershell
  .\deploy-clasp.ps1
  ```

Notas importantes
- Guardá y probá cambios localmente usando `clasp run` o ejecutando funciones desde el editor antes de generar un deployment.
- Si tu frontend usa la URL de un Web App publicada, actualizá la implementación o creá una nueva para que apunte a la versión con los cambios.
