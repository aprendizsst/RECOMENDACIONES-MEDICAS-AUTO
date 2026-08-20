# PATCH V4 — jsPDF

Corrección del error `Cannot destructure property jsPDF of window.jspdf as it is undefined`.

- Se cambia el CDN principal de jsPDF 2.5.2 a 2.5.1.
- El generador PDF ahora carga jsPDF bajo demanda si la carga inicial falla.
- Se añaden fallbacks automáticos a jsDelivr y unpkg.
- Se incrementa la versión de caché de scripts a `20260820-4`.

Después de subir los archivos a GitHub Pages, esperar el workflow y hacer `Ctrl+F5`.
