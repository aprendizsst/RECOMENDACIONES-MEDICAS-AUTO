# Portal SST · Recomendaciones Médicas V10.19

## V10.23 · PDF idéntico a la vista previa, sin estirar

- El PDF reutiliza el mismo HTML ya generado para la vista previa; no vuelve a renderizar la plantilla en un contenedor de ancho diferente.
- Corrige el desplazamiento del logo causado por diferencias entre el render oculto y la vista previa.
- La captura se inserta en hoja Carta conservando siempre su relación de aspecto; no se estira texto ni encabezado.
- Se usa PNG para conservar mejor la nitidez de letras, líneas, logo y firma.
- Se conserva la alineación izquierda de firma, nombre y cargo del coordinador.
- No cambia parser, IA, zonas, correo, consecutivos ni backend.

V10.19 conserva íntegramente V10.17 y añade dos mejoras de presentación sin modificar el pipeline clínico, IA, zonas, correo ni Apps Script.

## PDF fiel a la vista previa

- El PDF ya no vuelve a calcular los saltos de página con `html2pdf`.
- Se reutiliza el mismo render de `docx-preview` usado por la vista previa.
- Cada página renderizada se captura completa y se inserta como una única página A4 del PDF.
- Se evita cortar párrafos, firmas, encabezados o bloques entre páginas.
- Se evita saltar/duplicar páginas por diferencias entre CSS y el algoritmo de paginación.
- El ajuste es proporcional y centrado: no recorta contenido aunque la plantilla tenga una relación de aspecto ligeramente distinta a A4.
- Se espera a fuentes e imágenes antes de crear el PDF.
- El motor documental cambia a `2026-09-08.10.18-preview-faithful-pdf`, invalidando la caché anterior de salidas.

## Interfaz con mayor contraste

- Se mantiene el morado/violeta como color de identidad y acción principal.
- Fondos, paneles, tablas, visores y formularios pasan a neutros oscuros/azulados.
- Azul, verde y ámbar diferencian métricas, procesamiento y estados.
- El área de documentos y correo conserva acentos morados solo cuando hay selección o acción activa.
- La hoja blanca de los visores destaca más frente al fondo.

## Funciones conservadas

Se mantienen todas las funciones de V10.17: tipos de examen canónicos, zona automática por lugar, JER_TABLA/CONTROL_PERIODICO, estados REALIZADO, auditoría IA y recuperación, hasta 50 PDF, recomendaciones compactas, Word/PDF, visor original, correo individual/común/por zona, PDF/Word/ambos, consecutivos y Google Sheets.

Backend requerido: `2026.09.07-v10.16-exam-type-auto-zone`. No requiere cambios de Apps Script.



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
