# Portal SST · Recomendaciones Médicas · V7

Aplicación estática para GitHub Pages con procesamiento local de PDF/OCR, motor clínico Python mediante Pyodide y backend seguro en Google Apps Script para Gemini, usuarios, consecutivos, recursos compartidos y correo.

## Flujo

`PDF → geometría PDF.js → parser clínico V7 → OCR de rescate si aplica → Gemini automático → auditoría adversarial → revisión → plantilla DOCX institucional → Word/PDF/HTML`

## Funciones V7

- Dos formatos clínicos soportados explícitamente.
- Recomendaciones por examen completas y no resumidas.
- Recomendaciones en párrafo; exámenes realizados en viñetas.
- Observaciones, remisiones y PVE/SVE con reglas por sección.
- IA automática obligatoria para generar.
- Selección individual/múltiple/lote.
- Sesión limpia al iniciar sesión.
- Eliminación individual o total del lote.
- Caché de la sesión para evitar reprocesos.
- Plantilla DOCX validada como fuente única de la salida y la vista previa.
- Consecutivos contra Google Sheets con bloqueo.
- Envío de correo mediante MailApp.

Consulta `UPGRADE_V7.md` para instalar y `PATCH_V7.md` para el detalle técnico.
