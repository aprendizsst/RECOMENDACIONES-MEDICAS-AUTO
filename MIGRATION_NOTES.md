# Mapa de migración · Streamlit → GitHub Pages

Este archivo documenta cómo se trasladó la funcionalidad de `legacy/app_streamlit_original.py` a la versión publicable en GitHub Pages.

| Función original | Implementación web | Estado |
|---|---|---|
| Login, registro y cambio de contraseña | Apps Script + Google Sheets + token de sesión | Conservada |
| SQLite local | IndexedDB para caché + Sheets para datos compartidos | Migrada |
| Carga múltiple de PDF | File API + drag & drop | Conservada/mejorada |
| `pdfplumber` | PDF.js | Migrada |
| OCR con `pytesseract` | Tesseract.js | Migrada |
| Parser/reglas de `app.py` | `parser.py` ejecutado con Pyodide | Conservada |
| Validación visual Gemini | Apps Script → Gemini | Conservada sin exponer la API key |
| Segunda revisión IA | Backend Apps Script | Conservada |
| Edición manual de datos | Editor web con autoguardado | Conservada/mejorada |
| `session_state` | estado JS + IndexedDB | Migrada |
| No reprocesar PDF ya cargado | huella SHA-256 del archivo | Mejorada |
| No regenerar salida sin cambios | fingerprint de datos/plantilla/firma/formato | Conservada/mejorada |
| Vista de PDF original | visor PDF.js multipágina | Conservada/mejorada |
| Plantilla DOCX | motor DOCX en navegador con JSZip/XML | Conservada |
| Firma sobre DOCX | inserción DrawingML en el DOCX | Conservada |
| LibreOffice/docx2pdf | PDF nativo con jsPDF | Sustituida por restricción de GitHub Pages |
| Generación individual/masiva | generador incremental + caché | Conservada/mejorada |
| Descarga individual | Blob URL | Conservada |
| ZIP colectivo | JSZip | Conservada |
| SMTP + contraseña de aplicación | MailApp en Apps Script | Sustituida por alternativa segura |
| CC / CCO | MailApp | Conservada |
| Asunto/cuerpo editables | editor web | Conservada |
| Historial de correo | Google Sheets + copia local | Conservada |
| Tablas mezcladas con flujo | sección independiente “Control y tablas” | Mejorada |
| Plantilla/firma por equipo | Drive compartido por el backend + caché local | Mejorada |
| Streamlit UI | SPA HTML/CSS/JS responsive | Rediseñada |

## Dos diferencias controladas

### PDF

GitHub Pages no ejecuta LibreOffice, por lo que el PDF no puede obtenerse convirtiendo el DOCX en el servidor. La versión web genera un PDF nativo con el mismo contenido validado. Para conservar exactamente la plantilla institucional, seleccione **Word (.docx)** como salida.

### Correo

Se elimina el uso de contraseña SMTP en el navegador. El envío lo ejecuta la cuenta Google propietaria del despliegue de Apps Script mediante `MailApp`, manteniendo Para, CC, CCO, asunto, cuerpo, adjunto e historial.

## Privacidad operacional

Los PDF y documentos generados se guardan en IndexedDB del navegador. Solo se envía el PDF al backend/Gemini cuando la validación visual está habilitada. Antes de usar el portal con información médica real, la organización debe validar sus requisitos internos de privacidad, tratamiento de datos y uso de servicios externos.


## V5 — endurecimiento del motor

La versión V5 incorpora extracción por secciones clínicas, relectura OCR estructural, auditoría visual doble con Gemini, caché versionada, validación directa de consecutivos en Google Sheets bajo bloqueo y correo mediante MailApp con diagnóstico de cuota y trazabilidad de errores. Consulta `PATCH_V5.md` para el detalle.
