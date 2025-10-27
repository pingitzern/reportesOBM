# Automatizar despliegue a Google Apps Script

Este documento explica cómo configurar la sincronización automática entre este repositorio y un proyecto de Google Apps Script en la nube.

Resumen de la solución
- Añadimos un workflow de GitHub Actions (`.github/workflows/clasp-deploy.yml`) que, en cada `push`, ejecuta `clasp push` para subir los archivos de la carpeta `scripts/` al proyecto de Apps Script.
- El workflow necesita dos secretos en el repositorio de GitHub: `CLASPRC_JSON` y `APPS_SCRIPT_ID`.

Pasos para obtener los secretos

1. Instala `clasp` localmente si aún no lo tienes:

   npm i -g @google/clasp

2. Autentícate localmente (esto generará `~/.clasprc.json`):

   clasp login

   - Después de ejecutar, copia el contenido de tu archivo `~/.clasprc.json` (no lo publiques en público).

3. En GitHub (repo -> Settings -> Secrets), crea el secret `CLASPRC_JSON` con el contenido exacto de `~/.clasprc.json`.

4. Crea también el secret `APPS_SCRIPT_ID` con el `scriptId` del proyecto de Apps Script al que quieres hacer push.

Notas sobre `.clasp.json` en el repositorio
- Se agregó una plantilla `.clasp.json` con `rootDir` apuntando a `scripts/` y `scriptId` con el texto `REPLACE_WITH_YOUR_SCRIPT_ID`.
- Si prefieres mantener `scriptId` en el archivo del repo, reemplázalo allí mismo. El workflow detecta si `.clasp.json` existe y lo usa; si no existe crea uno a partir de `APPS_SCRIPT_ID`.

Comportamiento esperado y diagnóstico de problemas previos
- Si antes observabas que los cambios sólo se veían al crear un proyecto nuevo, probablemente faltaba un `.clasp.json` con el `scriptId` correcto o la autenticación estaba vinculada a otra cuenta/proyecto. Este workflow fuerza la subida (`clasp push --force`) y usa la credencial restaurada a partir de `CLASPRC_JSON`, por lo que debería reflejar correctamente los cambios.

Recomendaciones locales (opcional)
- Para despliegues desde tu máquina local sin usar Actions:
  - Asegúrate de tener `.clasp.json` con `scriptId` correcto en la raíz del repo (o usa `clasp clone <scriptId>` una vez).
  - Ejecuta `clasp push` cuando quieras subir cambios.

- Para prevenir olvidos, puedes añadir un hook pre-push que ejecute `npx @google/clasp push` o usar `husky` para automatizar hooks de git.

Próximos pasos que puedo implementar por ti
- Añadir un `pre-push` hook con `husky` para ejecutar `clasp push` localmente antes de `git push`.
- Añadir validaciones (por ejemplo, comprobar que `appsscript.json` tenga versión/manifest correcta) y tests mínimos.
