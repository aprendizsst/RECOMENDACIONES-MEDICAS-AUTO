# Actualización V9

1. Reemplaza el contenido del repositorio por esta V9 y espera el deploy de GitHub Pages.
2. En Apps Script reemplaza `Code.gs` por `backend/Code.gs` de V9.
3. Conserva `BackendBridge.html` y `appsscript.json` (puedes reemplazarlos por los incluidos si prefieres mantener todo sincronizado).
4. Publica una NUEVA versión de la Web App sin cambiar la URL `/exec`.
5. Abre GitHub Pages con `Ctrl + F5`.
6. En Configuración > Consecutivos pulsa `Guardar y validar`; debe mostrar `actual` y `siguiente` con el formato real de la hoja. Ej.: actual `42.613`, siguiente `42.614`.
7. Genera primero una vista previa individual y después un lote de 2-3 certificados.
8. Si ya existían salidas V8, V9 las regenera automáticamente por cambio de fingerprint del motor documental.
