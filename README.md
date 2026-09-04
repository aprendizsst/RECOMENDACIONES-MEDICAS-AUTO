# Portal SST · Recomendaciones Médicas V10.13

V10.13 conserva la interfaz púrpura, los motores especializados, procesamiento masivo, plantillas Word/PDF, correo individual/masivo y enrutamiento de Google Sheets de las versiones anteriores, y recalibra la auditoría IA para lotes grandes.

## Cambios principales

- El tablero separa **Revisión clínica** de **Auditoría IA pendiente**.
- Los perfiles `JER_TABLA` y `CONTROL_PERIODICO` conservan prioridad cuando la extracción estructural es de alta confianza.
- Diferencias de redacción, puntuación, lugar, observaciones o formato de fecha ya no generan revisiones falsas.
- Se mantienen como conflictos materiales: identificación distinta, tipo de examen realmente contradictorio, fecha realmente distinta, nombre claramente incompatible, remisión negativa vs positiva y campos clínicos faltantes.
- En lotes se prioriza `gemini-2.5-flash` estable y se mantienen `gemini-3.8-flash` y `gemini-2.5-flash-lite` como respaldo.
- Los errores transitorios 408/429/5xx usan reintentos, cambio de modelo y una recuperación diferida.
- Botón **Reintentar IA pendientes** para completar la auditoría sin volver a cargar los PDF.

## Funcionalidades conservadas

- Hasta 50 PDF por lote.
- Motores JER, Control Periódico y fallback genérico.
- Estados `REALIZADO`, `NORMAL`, `NO APLICA` y `APTO` tratados como estados, no recomendaciones.
- Normalización semántica del tipo de examen.
- Recomendaciones completas por examen y salida compacta en párrafos.
- Exámenes realizados impresos solo por nombre.
- Restricciones, observaciones, remisiones y PVE/SVE independientes.
- Plantilla DOCX validada y generación Word/PDF.
- Vista previa del PDF original ajustada al ancho.
- Correo individual o a un destinatario común, con PDF, Word o ambos y selección de archivos.
- Consecutivos, base técnica `DocumentosProcesados`, registro SST y sincronización con Google Sheets.

## Backend requerido

`2026.09.04-v10.13-ai-batch-recalibrated`
