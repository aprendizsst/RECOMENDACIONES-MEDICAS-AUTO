# Actualización rápida a V7

## GitHub Pages

Reemplaza el proyecto por el contenido de esta carpeta/ZIP y confirma que la raíz conserve:

- `index.html`
- `parser.py`
- `js/`
- `css/`
- `assets/`
- `.github/workflows/pages.yml`

Haz commit, espera el despliegue verde en **Actions** y recarga con `Ctrl + F5`.

## Google Apps Script

Reemplaza:

- `backend/Code.gs` → `Code.gs`
- `backend/appsscript.json` → manifiesto del proyecto

Conserva `BackendBridge.html`.

Desde el editor ejecuta una sola vez `authorizePortalServices`, acepta todos los permisos y luego ejecuta `testGeminiPermission` y `testGeminiApi`. Ambas pruebas deben devolver `ok: true` antes de publicar una nueva versión de la Web App.

## Uso esperado

1. Inicia sesión: el lote anterior desaparece del navegador.
2. Carga uno o varios PDF.
3. El motor local detecta el formato y Gemini valida automáticamente cada archivo.
4. Selecciona los PDF que quieres incluir mediante los checks de la lista.
5. Usa **Vista previa seleccionados**, **Vista previa individual** o **Vista previa de todo el lote**.
6. La salida usa exclusivamente la plantilla DOCX activa.

Si la IA no está lista, la extracción local queda visible, pero la generación se bloquea para evitar documentos incompletos.
