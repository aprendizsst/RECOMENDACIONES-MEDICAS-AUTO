# PATCH V5 — Motor clínico multiformato, correo y consecutivos

Esta versión corrige tres problemas reportados en producción: extracción clínica inestable cuando cambia el formato del certificado, envío de correos y validación de consecutivos contra Google Sheets.

## 1. Motor de extracción multiformato

- El parser ya no depende de una plantilla única: segmenta por significado las zonas de exámenes, recomendaciones, observaciones, remisiones y vigilancia epidemiológica.
- Se ampliaron alias de encabezados usados por diferentes proveedores: paraclínicos, ayudas diagnósticas, recomendaciones al trabajador, observaciones médicas, remisiones a especialistas, PVE/SVE, etc.
- Las recomendaciones se asocian a un examen únicamente por relación estructural explícita (fila, columna, encabezado, prefijo o proximidad dentro del bloque), no por palabras clínicas sueltas.
- Los cambios de bloque de recomendaciones reinician el contexto del examen para evitar que una recomendación general termine asociada al último examen de una tabla.
- Remisiones: se exige contenido explícito del bloque de remisiones o frases inequívocas de remitir/interconsulta; controles y exámenes futuros no se convierten en remisiones.
- Vigilancia epidemiológica: no se infiere ingreso por una recomendación auditiva, visual, respiratoria u osteomuscular. Se exige un bloque PVE/SVE o lenguaje explícito de ingreso/inclusión/continuidad. Las filas con `NO` se descartan individualmente.
- Observaciones: en bloques mixtos “observaciones y recomendaciones”, las frases de acción pasan a recomendaciones y lo descriptivo permanece en observaciones.
- Se agregó una puntuación de calidad y una lista de campos que requieren revisión.
- Si la lectura de texto embebido queda débil, el portal hace una segunda lectura OCR estructural y conserva la extracción con mejor puntaje.
- El OCR reconstruye líneas a partir de coordenadas de palabras para conservar mejor tablas/columnas.
- Gemini realiza una extracción visual y una segunda auditoría centrada en recomendaciones por examen, remisiones, vigilancia y observaciones. La fusión exige evidencia y da prioridad a asociaciones locales explícitas.

## 2. Caché versionada

La caché ahora incluye `pipelineVersion`. Si se vuelve a subir un PDF procesado con una versión anterior del motor, se reanaliza automáticamente. También existe el botón **Reanalizar** para forzar una lectura nueva del certificado seleccionado.

## 3. Consecutivos en Google Sheets

Se corrigió un error del frontend que consultaba `SSTBackend.ready`, propiedad inexistente. Ese fallo hacía que la generación cayera al consecutivo local incluso con backend conectado.

Ahora:

- el administrador puede indicar la URL/ID de la hoja de cálculo real, la pestaña y el prefijo;
- el backend localiza la columna de consecutivo en las primeras filas y reconoce varias variantes de encabezado;
- lee el mayor consecutivo válido del año actual;
- si existe columna de año, filtra por el año de la fila;
- utiliza `LockService` para impedir que dos usuarios obtengan el mismo número al mismo tiempo;
- registra hash del PDF, trabajador, identificación, examen y usuario cuando usa una hoja administrada por el bot;
- mantiene un ledger interno (`ConsecutivosControl`) para poder reutilizar el mismo consecutivo para el mismo PDF incluso cuando la hoja externa no tiene columna de hash;
- si la pestaña indicada es incompatible, crea `Consecutivos_BOT` en vez de modificar una tabla existente.

Con backend activo, si Google Sheets falla, la generación se detiene y muestra el error: ya no crea silenciosamente un número local que pueda duplicarse.

## 4. Correo

- Se reemplazó `GmailApp` por `MailApp`.
- Se valida destinatario, CC, CCO, asunto, cuerpo y adjunto.
- Se registra tanto el envío exitoso como el error en `HistorialCorreos`.
- La interfaz consulta la cuota de correo disponible y muestra el estado del servicio.
- El backend devuelve el error real de autorización/cuota/envío en lugar de ocultarlo.
- El adjunto tiene un límite preventivo de 20 MB.

Después de reemplazar `Code.gs`, hay que publicar una **nueva versión** de la Web App y aceptar los permisos de Sheets/Drive/correo. Si Google no solicita permisos automáticamente, ejecutar una vez `authorizePortalServices()` desde el editor de Apps Script con la cuenta propietaria.

## Archivos principales modificados

- `parser.py`
- `js/pdf-service.js`
- `js/app.js`
- `js/generator.js`
- `js/config.js`
- `index.html`
- `backend/Code.gs`
- `backend/appsscript.json`
