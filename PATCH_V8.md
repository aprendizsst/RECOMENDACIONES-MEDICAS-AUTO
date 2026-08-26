# V8 — Motor estructural y editor corregido

## Correcciones críticas

1. Corregido `normalizedMap()` en `js/app.js`: V7 tenía un `else` asociado al `if` interno y los mapas `recomendaciones_por_examen` tipo objeto se ignoraban. Esto producía tarjetas de examen con textareas vacíos aunque el parser sí tuviera recomendaciones.
2. El parser V8 repara filas colapsadas como `OPTOMETRIA CONTROL ANUAL ...` cuando PDF.js/OCR pierde la frontera de columna.
3. `REALIZADO` se conserva en `estado_por_examen`; no se convierte en recomendación ni se pierde.
4. Observaciones acepta `Observaciones: texto`, `Observaciones texto` y continuaciones hasta la siguiente sección clínica.
5. PVE/SVE reconoce bloques partidos en varias líneas y combinaciones como `VISUAL SVE` / `SVE VISUAL`.
6. Remisiones captura destinos aun si el encabezado y el primer destino llegan en la misma línea.
7. PDF.js y OCR usan anclas X repetidas para reconstruir columnas aunque `item.width` venga inflado por la caja de la celda.
8. La carga por lote aísla errores por archivo: un PDF defectuoso ya no aborta los demás.
9. Recomendaciones de cada examen se muestran en un párrafo; las viñetas se reservan para la lista de exámenes.
10. La plantilla DOCX incluye el estado del examen en la lista cuando existe y mantiene la plantilla como fuente de Word/PDF/vista previa.
11. El diagnóstico de Gemini ya no usa una URL de modelo incompleta para comprobar disponibilidad.

## Caso de regresión añadido

- Optometría → `CONTROL ANUAL // CONTINUAR USO PERMANENTE DE RX OPTICA // PAUSAS ACTIVAS VISUALES`
- Examen médico ocupacional → recomendación larga con EPP, higiene postural, pausas de 5 minutos cada 2 horas, hábitos saludables y actividad física.
- Énfasis osteomuscular → `REALIZADO` como estado.
- Observaciones sin `:`.
- Encabezado PVE partido en dos líneas + `VISUAL SVE`.
- `Información de Remisiones NUTRICION` en una sola línea + `MEDICINA GENERAL EPS` en la siguiente.
