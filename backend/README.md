# Backend de Google Apps Script

Este directorio **no se ejecuta en GitHub Pages**. Sus archivos deben copiarse a un proyecto de Google Apps Script.

- `Code.gs`: API segura, usuarios, Gemini, consecutivos, recursos institucionales compartidos, MailApp, Google Sheets e historial.
- `BackendBridge.html`: puente `postMessage` + `google.script.run` para comunicar GitHub Pages con Apps Script sin exponer secretos y sin depender de CORS.
- `appsscript.json`: manifiesto opcional.

La Web App debe desplegarse como **Ejecutar como: Yo** y **Acceso: Cualquiera**. Las operaciones sensibles siguen requiriendo un token de sesión del Portal SST.

La plantilla y la firma compartidas se almacenan en una carpeta privada de Drive creada automáticamente por el script. Solo una sesión con rol `admin` puede modificarlas.


## V5

`Code.gs` puede conectarse a un Google Sheet existente para validar consecutivos. El administrador configura el libro, pestaña y prefijo desde el frontend. El script usa `LockService`, escanea el mayor consecutivo vigente y mantiene un ledger interno para idempotencia por hash del PDF.

El correo usa `MailApp`. Después de copiar una versión nueva de `Code.gs`, vuelve a publicar la Web App como **Nueva versión** y autoriza los scopes. Si fuera necesario, ejecuta una vez `authorizePortalServices()` desde el editor.


## V6

La auditoría Gemini usa una segunda lectura correctiva enfocada en relaciones espaciales de examen/recomendación, campos de Observaciones, Remisiones y PVE/SVE. El modelo predeterminado es `gemini-3.5-flash` y existe respaldo con `gemini-3.1-flash-lite`. Después de reemplazar `Code.gs`, publica una **Nueva versión** de la Web App.
