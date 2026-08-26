# V7 · Motor clínico, IA automática y plantilla institucional

Versión: `2026.08.26-github-pages-v7`

## Cambios principales

- Motor clínico reforzado para los dos formatos de certificado conocidos.
- Conservación de geometría/columnas y rescate OCR cuando la estructura extraída es débil.
- Asociación conservadora de recomendaciones por examen en el formato de tres columnas.
- Conservación literal de recomendaciones completas en el formato examen → recomendación.
- Las recomendaciones de un mismo examen se generan como un único párrafo; las viñetas quedan reservadas para exámenes realizados.
- Gemini es automático y obligatorio para generar: todos los PDF cargados deben quedar `validated`.
- La IA realiza dos pasadas: extracción visual + auditoría adversarial.
- Estado de IA visible por archivo y diagnóstico en Configuración.
- Al iniciar sesión explícitamente comienza un espacio de trabajo limpio. Plantilla, firma y configuración se conservan.
- Selección de archivos por checkbox para vista previa individual, selección o lote completo.
- No se repite extracción/IA para un PDF ya validado en la sesión y con la misma versión del motor.
- La plantilla DOCX activa es la única fuente de Word, PDF y vista previa. No existe fallback visual genérico.
- Cambiar/restaurar plantilla invalida salidas anteriores sin reprocesar los PDF.
- Consecutivos siguen validados mediante Apps Script/Google Sheets.
- Correo continúa usando `MailApp` y trazabilidad de errores.

## Autorización de Gemini

`UrlFetchApp` requiere el scope `script.external_request`. Después de reemplazar `Code.gs` y `appsscript.json`, ejecutar manualmente desde el editor de Apps Script:

1. `authorizePortalServices`
2. `testGeminiPermission` → debe devolver `ok: true`
3. `testGeminiApi` → debe devolver `ok: true`
4. Publicar una **nueva versión** de la Web App manteniendo la misma URL `/exec`.

La interfaz permite comprobar el estado con **Configuración → Probar IA y validar pendientes**.
