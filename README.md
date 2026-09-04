# Portal SST · Recomendaciones Médicas V10.11

Versión limpia de producción con tema púrpura oscuro de alto contraste y auditoría de regresión funcional.

## Funcionalidad conservada y verificada
- Dos motores especializados: `JER_TABLA` y `CONTROL_PERIODICO`, con fallback genérico.
- Detección estructural por formato, normalización clínica y auditoría visual con Gemini.
- Procesamiento masivo de hasta 50 PDF (`4` extracciones locales y `3` auditorías IA concurrentes).
- Estados `REALIZADO`, `NORMAL`, `NO APLICA` y `APTO` tratados como estados, no como recomendaciones pendientes.
- Normalización semántica del tipo de examen para evitar falsos positivos entre sinónimos.
- Bloqueo de generación cuando quedan campos clínicos obligatorios o discrepancias reales sin resolver.
- Plantilla DOCX validada por marcadores; Word, PDF y vista previa salen de la misma plantilla activa.
- Exámenes realizados impresos solo por nombre, sin `- REALIZADO`.
- Recomendaciones agrupadas en un único párrafo cohesivo por examen, sin omitir el detalle clínico.
- Restricciones, observaciones, PVE/SVE y remisiones conservadas por separado.
- Vista previa del PDF original ajustada al ancho y navegación por página.
- Correo individual o a un destinatario común, selección de documentos y adjuntos en PDF, Word o ambos.
- División automática del envío masivo cuando el peso supera el límite seguro.
- Google Sheets V10.9: consecutivos y registro SST en archivos separados, más base técnica `DocumentosProcesados`.
- Diagnóstico de Apps Script, prueba de escritura y validación estricta de versión del backend.
- GitHub Pages estático: sin Vite, React ni Firebase.

## Interfaz V10.11
- Fondo berenjena/negro, paneles púrpura profundo y acentos violeta/lila.
- Contraste reforzado para textos, formularios, navegación, tablas, estados y botones.
- Estados de éxito/advertencia/error mantienen verde, dorado y coral para lectura inmediata.
- Foco visible para navegación por teclado.

## Backend requerido
`2026.09.04-v10.9-two-sheet-routing`

Los archivos de Apps Script están únicamente en `backend/`.
