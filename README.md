# Portal SST · Recomendaciones Médicas V10.17

V10.17 conserva íntegramente V10.16 y corrige el módulo de correo que perdió tres funciones auxiliares durante la incorporación de zona automática:

1. **Tipo de examen canónico en el encabezado y la plantilla**: Ingreso, Egreso, Seguimiento laboral, Periódico, Post incapacidad y Cambio de cargo. Los conceptos de aptitud (por ejemplo, “cumple con el cargo”) nunca se usan como tipo de examen.
2. **Zona automática desde el lugar del PDF**: el municipio/ciudad detectado en `Lugar` se normaliza y se usa como zona para agrupación y envío masivo de correos. Si se corrige el Lugar, la Zona se recalcula automáticamente.

Se mantienen: motores JER_TABLA/CONTROL_PERIODICO, estados REALIZADO, auditoría IA y recuperación, procesamiento de hasta 50 PDF, recomendaciones compactas sin pérdida, Word/PDF, visor original, correo individual/común/por zona, PDF/Word/ambos, consecutivos y sincronización con Google Sheets.

Backend requerido: `2026.09.07-v10.16-exam-type-auto-zone`.


## Corrección V10.17

- Restaura `buildEmailAttachments`, `groupEmailAttachments` y `serializeAttachments`.
- Corrige el error `buildEmailAttachments is not defined` al preparar envíos.
- Mantiene correo individual, destinatario común y lotes por zona con PDF, Word o ambos.
- No cambia el pipeline clínico, la validación IA, las plantillas ni Apps Script.
