# Despliegue V10.19

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


## V10.20 · PDF Carta fiel a la plantilla

- PDF fijo en tamaño Carta (8.5 × 11 pulgadas).
- La paginación sigue siendo 1:1 con la vista previa DOCX.
- Corrige el exceso de margen lateral causado por el contenedor oculto de renderizado.
- No se agrega un segundo margen al insertar la página en el PDF.
- Captura a mayor resolución para mejorar texto, bordes, logos y firma.
- Se conservan sin cambios IA, parser clínico, zonas, correo, consecutivos y backend V10.16.
