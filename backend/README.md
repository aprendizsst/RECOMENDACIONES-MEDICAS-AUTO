# Backend de Google Apps Script

Este directorio **no se ejecuta en GitHub Pages**. Sus archivos deben copiarse a un proyecto de Google Apps Script.

- `Code.gs`: API segura, usuarios, Gemini, consecutivos, recursos institucionales compartidos, Gmail e historial.
- `BackendBridge.html`: puente `postMessage` + `google.script.run` para comunicar GitHub Pages con Apps Script sin exponer secretos y sin depender de CORS.
- `appsscript.json`: manifiesto opcional.

La Web App debe desplegarse como **Ejecutar como: Yo** y **Acceso: Cualquiera**. Las operaciones sensibles siguen requiriendo un token de sesión del Portal SST.

La plantilla y la firma compartidas se almacenan en una carpeta privada de Drive creada automáticamente por el script. Solo una sesión con rol `admin` puede modificarlas.
