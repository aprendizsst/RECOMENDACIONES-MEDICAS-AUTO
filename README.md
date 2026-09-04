
## V10.14 · Recuperación de auditoría IA

- Corrige la incompatibilidad entre `thinkingLevel` y modelos Gemini 2.5.
- El lote usa `gemini-3.5-flash` y fallbacks Gemini 3.x compatibles.
- Para lotes de más de 20 PDF la auditoría se serializa para reducir 429/503.
- El botón **Probar IA real y validar pendientes** ejecuta una generación real antes de reintentar el lote.
- Se conservan motores JER/CONTROL PERIODICO, plantillas, Word/PDF, correo masivo y sincronización con Sheets/consecutivos.

# Portal SST · Recomendaciones Médicas V10.13

V10.13 conserva la interfaz púrpura, los motores especializados, procesamiento masivo, plantillas Word/PDF, correo individual/masivo y enrutamiento de Google Sheets de las versiones anteriores, y recalibra la auditoría IA para lotes grandes.

## Cambios principales

- El tablero separa **Revisión clínica** de **Auditoría IA pendiente**.
- Los perfiles `JER_TABLA` y `CONTROL_PERIODICO` conservan prioridad cuando la extracción estructural es de alta confianza.
- Diferencias de redacción, puntuación, lugar, observaciones o formato de fecha ya no generan revisiones falsas.
- Se mantienen como conflictos materiales: identificación distinta, tipo de examen realmente contradictorio, fecha realmente distinta, nombre claramente incompatible, remisión negativa vs positiva y campos clínicos faltantes.
- En lotes se prioriza `gemini-3.5-flash` estable y se mantienen `gemini-3.5-flash-lite`, `gemini-3.8-flash` y `gemini-3.7-flash` como respaldo.
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

`2026.09.04-v10.14-ai-compatibility-recovery`
