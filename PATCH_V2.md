# Corrección V2 — conexión GitHub Pages ↔ Apps Script

Esta versión reemplaza el handshake persistente por iframe por solicitudes POST dirigidas a iframes efímeros. Esto evita el problema de comunicación observado entre GitHub Pages y Google Apps Script/HtmlService.

## Archivos modificados

- `js/backend.js`: nuevo transporte POST sin CORS y validación por nonce.
- `backend/Code.gs`: se añade `doPost(e)` para despachar las solicitudes y devolver la respuesta mediante `postMessage`.
- `js/config.js`: URL del despliegue actual configurada como backend predeterminado.
- `index.html`: texto de ayuda actualizado.

## Actualización

1. En Apps Script, sustituir `Code.gs` por el incluido en esta versión.
2. Guardar.
3. `Implementar > Administrar implementaciones > Editar > Nueva versión > Implementar`.
4. Mantener la misma URL `/exec`.
5. En GitHub, reemplazar al menos `js/backend.js`, `js/config.js` e `index.html`; o subir el proyecto completo.
6. Esperar el despliegue de GitHub Pages y recargar con `Ctrl + F5`.

No se debe ejecutar `apiDispatch()` manualmente.
