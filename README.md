# Portal SST · Recomendaciones Médicas V10.16

V10.16 conserva las mejoras de V10.15 y agrega dos controles importantes:

1. **Tipo de examen canónico en el encabezado y la plantilla**: Ingreso, Egreso, Seguimiento laboral, Periódico, Post incapacidad y Cambio de cargo. Los conceptos de aptitud (por ejemplo, “cumple con el cargo”) nunca se usan como tipo de examen.
2. **Zona automática desde el lugar del PDF**: el municipio/ciudad detectado en `Lugar` se normaliza y se usa como zona para agrupación y envío masivo de correos. Si se corrige el Lugar, la Zona se recalcula automáticamente.

Se mantienen: motores JER_TABLA/CONTROL_PERIODICO, estados REALIZADO, auditoría IA y recuperación, procesamiento de hasta 50 PDF, recomendaciones compactas sin pérdida, Word/PDF, visor original, correo individual/común/por zona, PDF/Word/ambos, consecutivos y sincronización con Google Sheets.

Backend requerido: `2026.09.07-v10.16-exam-type-auto-zone`.
