# Actualización rápida a V5

## A. GitHub Pages

Reemplaza el proyecto por el contenido de este paquete y haz commit/push. Los archivos críticos son:

- `parser.py`
- `js/pdf-service.js`
- `js/app.js`
- `js/generator.js`
- `js/config.js`
- `index.html`

Espera a que **GitHub Actions** quede en verde y recarga la página con `Ctrl + F5`.

## B. Google Apps Script

1. Reemplaza todo `Code.gs` con `backend/Code.gs` de V5.
2. Mantén `BackendBridge.html`.
3. Si usas manifiesto visible, reemplaza `appsscript.json` con `backend/appsscript.json`.
4. **Implementar → Administrar implementaciones → Editar → Nueva versión → Implementar**.
5. Autoriza los permisos de Sheets, Drive y correo. La URL `/exec` puede seguir siendo la misma.
6. Si la sección Correo muestra autorización pendiente, ejecuta una vez `authorizePortalServices()` desde el editor de Apps Script y acepta permisos; después vuelve a publicar una nueva versión.

## C. Conectar consecutivos

En la aplicación, con usuario administrador:

1. **Configuración → Consecutivos**.
2. Pega la URL/ID del Google Sheet real.
3. Indica el nombre exacto de la pestaña.
4. Define el prefijo (por ejemplo `SST`).
5. Pulsa **Guardar y validar**.
6. Confirma que el panel muestre el número de registros leídos y el siguiente consecutivo esperado.

## D. Reanalizar certificados antiguos

Los PDFs guardados con un motor anterior se reanalizan al volverlos a cargar porque V5 usa `pipelineVersion`. Para forzar la actualización de un certificado que ya esté abierto, pulsa **Reanalizar**.
