# Portal SST · Recomendaciones Médicas V10.18

V10.18 conserva íntegramente V10.17 y añade dos mejoras de presentación sin modificar el pipeline clínico, IA, zonas, correo ni Apps Script.

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
