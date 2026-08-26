# Notas de arquitectura V7

GitHub Pages ejecuta la interfaz y procesamiento local. Google Apps Script funciona como backend seguro para operaciones que no deben exponer credenciales.

- PDF.js conserva geometría y reconstruye filas/columnas.
- Tesseract.js se usa como rescate OCR.
- Pyodide ejecuta `parser.py` en el navegador.
- Gemini recibe el PDF completo y realiza extracción + segunda auditoría.
- IndexedDB mantiene solo el lote de la sesión; el espacio de trabajo se limpia al inicio de sesión explícito.
- La plantilla DOCX institucional se conserva como recurso separado y no se elimina al limpiar el lote.
- La generación usa la plantilla como única fuente visual. La vista genérica solo permanece en código como utilidad interna y no se usa como fallback de documentos institucionales.
