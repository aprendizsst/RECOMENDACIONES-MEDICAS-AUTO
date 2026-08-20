# V6.2 — Validación IA automática

- La validación con Gemini queda activa por defecto y no requiere pulsar ningún botón.
- Cada PDF nuevo se audita automáticamente después del parser local/OCR.
- Los documentos de caché que no tengan una auditoría IA vigente se validan automáticamente al volver a cargarlos.
- Al abrir el portal, los certificados pendientes de auditoría IA se revisan automáticamente si Apps Script está conectado.
- Se guarda trazabilidad por documento: `aiValidationStatus`, `aiValidationVersion`, `aiValidatedAt`, `aiLastAttemptAt` y `aiError`.
- El botón **Validar con IA** se conserva únicamente para forzar una nueva auditoría manual de un caso puntual.
- La opción de validación automática se muestra bloqueada/activa en Configuración para evitar que se deshabilite accidentalmente.
- Si Gemini no está disponible, el motor local/OCR conserva el resultado y el documento queda marcado como IA pendiente para reintento posterior.
