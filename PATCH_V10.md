# V10 · extracción por formato, lotes y control de calidad

Versión: `2026.09.03-github-pages-v10`

## Problemas corregidos

- Se eliminó la mezcla V8/V9: `index.html` y `/js` quedan sincronizados con la versión actual.
- Se añadió un motor determinístico independiente para cada formato clínico conocido:
  - `JER_TABLA`: información del paciente + tabla examen/recomendación + restricciones + PVE + remisiones.
  - `CONTROL_PERIODICO`: concepto médico ocupacional + matriz de restricciones + tres columnas de recomendaciones.
- Pyodide/parser legado queda como respaldo, no como primera etapa para todos los PDF.
- OCR integral se ejecuta únicamente cuando la extracción estructural sigue incompleta.
- Gemini funciona como auditor visual. En perfiles de alta confianza se evita sobrescribir silenciosamente datos estructurales; las discrepancias pasan a revisión manual.
- La segunda lectura Gemini dejó de ser obligatoria para todos los archivos: solo se ejecuta en baja confianza o cuando la primera auditoría solicita revisión.
- Se añadieron reintentos con backoff para respuestas 429/500/503 de Gemini.
- Procesamiento por lotes de hasta 50 PDF con concurrencia acotada para no bloquear el navegador.
- Se añadió control de calidad visible por lote y por documento.
- La generación se bloquea si quedan discrepancias, campos críticos o fragmentos pendientes de revisión.
- Se agregó captura y edición explícita de restricciones laborales.
- Correcciones ortográficas seguras para errores OCR frecuentes, preservando dosis, tiempos, pesos, lateralidad y significado clínico.
- La plantilla base fue reorganizada como carta SST institucional, con encabezado azul, exámenes con marca, recomendaciones y restricciones en párrafos legibles.
- El asunto del documento normaliza automáticamente seguimiento, periódico, ingreso, egreso, cambio de cargo y post incapacidad.
- Los nombres de salida incluyen el consecutivo.
- Se corrigió la sincronización de plantillas compartidas: si el administrador restaura la plantilla base, otros equipos ya no conservan una plantilla compartida obsoleta en IndexedDB.

## Consecutivos / Google Sheets

- Reserva masiva de consecutivos mediante una sola lectura principal y escritura por bloques.
- `LockService` sigue protegiendo la asignación concurrente.
- Se mantiene un ledger de control por `documentKey` para reutilizar el consecutivo del mismo documento.
- El estado de consecutivos informa duplicados, claves de documento conflictivas, hoja operativa y hoja de control.

## Regla de seguridad de la V10

La aplicación no debe interpretar una auditoría IA como garantía absoluta. Si el motor estructural y Gemini discrepan en un campo de alta confianza, el documento queda marcado para comparación humana con el PDF original antes de generar.
