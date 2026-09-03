# V10.5 · Sincronización real con Apps Script y Google Sheets

## Corrección principal

La V10.4 procesaba los certificados en el navegador (IndexedDB), pero no enviaba la ficha clínica estructurada al backend. V10.5 agrega persistencia remota idempotente en `DocumentosProcesados`.

## Backend

- `ping` devuelve `backendVersion` y capacidades.
- Nueva acción `saveDocumentRecords` para lotes de hasta 50 certificados.
- Upsert por `document_key`: reanalizar el mismo PDF actualiza la fila y no la duplica.
- Nueva acción `backendDiagnostics` y prueba de escritura en `DiagnosticoBackend`.
- `DocumentosProcesados` conserva trabajador, identificación, cargo, tipo de examen, exámenes, estados, recomendaciones, restricciones, observaciones, remisiones, PVE/SVE, calidad, validación IA, campos a revisar y consecutivo.
- La validación de la hoja externa de consecutivos es estricta: si la pestaña o columna no existe, se informa el error. Ya no se crea `Consecutivos_BOT` de forma silenciosa.

## Frontend

- Verifica que la Web App desplegada corresponda exactamente a la V10.5.
- Sincroniza el lote después de extracción/IA.
- Sincroniza cambios manuales con debounce.
- Sincroniza nuevamente al generar para guardar el consecutivo definitivo.
- En Control → Validación se muestra el estado de Apps Script por certificado.
- Configuración incluye **Probar escritura en Sheets**.

## Instalación obligatoria

Esta versión sí requiere actualizar ambos lados:

1. GitHub Pages: subir el contenido de V10.5.
2. Apps Script: reemplazar `Code.gs`, `BackendBridge.html` y `appsscript.json` por los de `/backend`.
3. Ejecutar `authorizePortalServices()` desde el editor.
4. Implementar → Administrar implementaciones → Editar → **Nueva versión** → Implementar.
5. Conservar/copiar la URL `/exec` y probarla desde Configuración.
6. Pulsar **Probar escritura en Sheets**.

Si el frontend detecta un `backendVersion` distinto de `2026.09.03-v10.5-sheets-sync`, mostrará que Apps Script está desactualizado y no intentará fingir una sincronización correcta.
