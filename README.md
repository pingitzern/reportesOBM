# reportesOBM

Control de MP de osmosis bajo mesada

## Configuración de la API

La aplicación requiere la URL del backend para poder guardar y consultar los mantenimientos. Por seguridad, la URL no se deja codificada en el repositorio. Configúrala de una de las siguientes maneras:

- **Configuración en tiempo de ejecución (recomendada):** Antes de cargar `public/js/main.js`, define la variable global `window.__APP_CONFIG__`.

  ```html
  <script>
    window.__APP_CONFIG__ = {
      API_URL: 'https://tu-api.example.com',
    };
  </script>
  <script type="module" src="public/js/main.js"></script>
  ```

- **Variable de entorno:** expón la variable `API_URL` en el entorno que sirva la aplicación. El archivo `public/js/config.js` la detectará cuando exista un objeto `process.env` (por ejemplo en un empaquetado server-side).

Si ninguna de las opciones anteriores está configurada, la aplicación mostrará una advertencia en la consola y las llamadas a la API fallarán.
