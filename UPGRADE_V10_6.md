# V10.6 · Correo masivo y adjuntos seleccionables

## Cambios

- Selección persistente de documentos en el módulo Correo.
- Modo **Cada trabajador**: cada colaborador recibe sus propios archivos usando el correo extraído/editado.
- Modo **Un destinatario**: todos los documentos seleccionados se envían a un correo común sin diligenciar destinatarios uno por uno.
- Formato de adjunto seleccionable: **PDF**, **Word** o **PDF + Word**.
- Los formatos alternos se generan bajo demanda desde la misma plantilla y conservan el mismo consecutivo.
- Si un envío consolidado supera el tamaño seguro, el frontend divide los adjuntos automáticamente en varios paquetes dirigidos al mismo correo.
- Apps Script acepta múltiples adjuntos en una sola solicitud y registra los nombres en `HistorialCorreos`.
- Backend requerido: `2026.09.03-v10.6-email-batch`.

## Despliegue

1. Actualizar GitHub Pages con los archivos V10.6.
2. Reemplazar en Apps Script `Code.gs`, `BackendBridge.html` y `appsscript.json` desde `backend/`.
3. Guardar y crear una nueva versión de la implementación Web App.
4. Recargar GitHub Pages con Ctrl+F5.
