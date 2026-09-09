# Despliegue V10.26

## V10.26 · Bloque de firma protegido y salto de página seguro

- Reduce el espacio posterior a **Atentamente,** de la plantilla al usar firma digital.
- Mantiene juntos **Atentamente + firma + nombre + cargo** mediante propiedades de paginación Word.
- La firma conserva proporción, alineación izquierda y una altura máxima segura.
- No modifica la solución V10.25 del encabezado, escala Carta ni las funciones de IA, zonas, correo o consecutivos.
- Motor: `2026-09-09.10.26-signature-page-safe-pdf`.


## V10.26 · Corrección final de encabezado y escala PDF

- No cambia Apps Script ni el backend.
- El PDF ya no modifica la geometría interna renderizada por Word/docx-preview.
- Se protege el encabezado completo: logo, código, versión, fecha, página, asunto y consecutivo.
- El tamaño Carta se aplica al canvas final, manteniendo la proporción y la calidad del contenido.
- Motor: `2026-09-09.10.26-signature-page-safe-pdf`.


## V10.24 · Escala Carta nativa sin pérdida de proporción

- La captura PDF se fija a la dimensión física de Carta: 816 × 1056 CSS px (8.5 × 11 in a 96 dpi).
- Renderiza a escala 3x (~288 dpi) y usa PNG para conservar nitidez de texto, bordes, logo y firma.
- El PDF inserta la página 1:1 en 215.9 × 279.4 mm; ya no calcula una escala a partir de una altura accidental del navegador.
- Corrige el documento angosto dentro de la hoja sin estirar letras ni cambiar la posición del logo.
- Conserva firma/nombre/cargo a la izquierda, paginación 1:1, Word, IA, zonas, correo, consecutivos y backend V10.16.
- El nuevo motor `2026-09-08.10.24-letter-native-scale-pdf` invalida la caché anterior.

## V10.23 · PDF idéntico a la vista previa, sin estirar

- El PDF reutiliza el mismo HTML ya generado para la vista previa; no vuelve a renderizar la plantilla en un contenedor de ancho diferente.
- Corrige el desplazamiento del logo causado por diferencias entre el render oculto y la vista previa.
- La captura se inserta en hoja Carta conservando siempre su relación de aspecto; no se estira texto ni encabezado.
- Se usa PNG para conservar mejor la nitidez de letras, líneas, logo y firma.
- Se conserva la alineación izquierda de firma, nombre y cargo del coordinador.
- No cambia parser, IA, zonas, correo, consecutivos ni backend.

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



## V10.22 · Firma y coordinador alineados a la izquierda

- La firma insertada en la plantilla queda anclada al margen izquierdo del párrafo.
- El nombre **VÍCTOR ALONSO MORENO CASAS** y el cargo **Coordinador SST** se fuerzan a alineación izquierda incluso si una plantilla cargada los tenía centrados.
- La vista previa usa esa misma estructura DOCX y el PDF conserva la misma posición.
- Se mantiene tamaño Carta, origen fijo de página y todas las mejoras funcionales anteriores.

## V10.21 · Corrección de posición del logo en PDF

- Mantiene PDF en tamaño Carta (8.5 × 11 in).
- Conserva exactamente el origen y las coordenadas de cada página renderizada desde Word.
- Elimina el recorte/recentrado por contenido de V10.20 que podía desplazar el logo institucional.
- La vista previa y el PDF usan la misma SECTION de `docx-preview`, sin modificar la posición horizontal de imágenes, encabezados o tablas.
- Invalida la caché documental para regenerar los PDF con el motor corregido.
- No modifica IA, parser clínico, zonas, correo, consecutivos, Apps Script ni generación Word.

## V10.20 · PDF Carta fiel a la plantilla

- PDF fijo en tamaño Carta (8.5 × 11 pulgadas).
- La paginación sigue siendo 1:1 con la vista previa DOCX.
- Corrige el exceso de margen lateral causado por el contenedor oculto de renderizado.
- No se agrega un segundo margen al insertar la página en el PDF.
- Captura a mayor resolución para mejorar texto, bordes, logos y firma.
- Se conservan sin cambios IA, parser clínico, zonas, correo, consecutivos y backend V10.16.