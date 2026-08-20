# PATCH V3 — Corrección de conexión Apps Script

## Error corregido
En `backend/Code.gs`, la respuesta HTML de `doPost()` cerraba la etiqueta script como `<\/script>` en el HTML final. Eso impedía que el JavaScript de respuesta se ejecutara y, por tanto, GitHub Pages agotaba el tiempo de espera al probar `ping`.

La V3 usa un cierre HTML real `</script>` y mejora el diagnóstico del frontend para mostrar el error concreto si el backend vuelve a fallar.

## Actualización mínima
1. Reemplazar `backend/Code.gs` en Google Apps Script.
2. Guardar y publicar una **Nueva versión** de la implementación Web App existente.
3. En GitHub reemplazar `js/backend.js`, `js/app.js`, `js/config.js` e `index.html`.
4. Esperar GitHub Actions y recargar con Ctrl+F5.

La URL `/exec` existente se conserva.
