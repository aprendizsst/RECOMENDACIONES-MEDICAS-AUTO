# Despliegue V10.18

1. Reemplaza en GitHub los archivos del portal con el contenido de esta carpeta.
2. **No es necesario volver a desplegar Apps Script** si ya reporta `2026.09.07-v10.16-exam-type-auto-zone`.
3. Espera a que GitHub Pages publique la nueva versión.
4. Haz `Ctrl + F5` para limpiar recursos del frontend.
5. Genera nuevamente los PDF: el nuevo `documentEngineVersion` invalida la caché de documentos generados por el motor anterior.
6. Prueba al menos un documento de una página y otro de varias páginas; compara página por página la vista previa contra el PDF.

## Qué debe validarse

- Ningún texto, firma o bloque queda cortado al final de página.
- No hay páginas omitidas ni duplicadas.
- La cantidad y el orden de páginas coinciden con la vista previa.
- El PDF conserva encabezado, pie, logos y márgenes de la plantilla renderizada.
- Word, correo, zonas, consecutivos e IA continúan funcionando como en V10.17.
