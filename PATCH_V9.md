# V9 · Salida clínica, consecutivos y lote robusto

Cambios principales:

- Corrige la lectura de consecutivos con miles (`42.613` -> 42613) y conserva el estilo de la hoja (`42.614`).
- Reserva los consecutivos de un lote en una sola llamada a Apps Script para reducir timeouts de `nextConsecutive`.
- El mismo PDF conserva su consecutivo mediante `documentKey`/ledger.
- La salida Word/PDF/vista previa usa la plantilla institucional como única fuente visual.
- `{{Recomendaciones médicas}}` ahora genera un único párrafo narrativo continuo.
- Los nombres de los exámenes con recomendación se insertan en **negrita** dentro del párrafo.
- Los exámenes sin recomendación NO se imprimen en el bloque de recomendaciones.
- Observaciones, remisiones y PVE/SVE quedan en blanco si no existe información positiva real.
- Deduplicación global: una misma recomendación no puede aparecer repetida bajo varios exámenes o también como general.
- La IA ya no puede crear una asociación examen->recomendación sin una evidencia que contenga el examen y la recomendación en el mismo bloque/fila.
- Mantiene las viñetas exclusivamente para la lista de exámenes realizados.
- Se incrementan versiones de pipeline, IA y motor documental para invalidar salidas/caché V8.
