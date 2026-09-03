# Upgrade V10.3 · normalización semántica del tipo de examen

## Problema corregido
V10.2 podía bloquear un documento cuando el motor local y Gemini describían el mismo tipo de examen con palabras distintas, por ejemplo `EXAMEN DE SEGUIMIENTO CON RESTRICCIONES` frente a `SEGUIMIENTO LABORAL`.

## Nueva regla
- Se normalizan familias semánticas: INGRESO, PERIODICO, SEGUIMIENTO, EGRESO, CAMBIO_CARGO y POST_INCAPACIDAD.
- En perfiles JER_TABLA o CONTROL_PERIODICO de alta confianza se conserva el valor explícito del PDF.
- Una diferencia de redacción no genera revisión.
- Una contradicción material entre categorías sí genera `discrepancia IA: tipo_examen`.
- Gemini fue instruido para copiar el texto explícito del PDF y no activar revisión por sinónimos.

## Ejemplos equivalentes
- EXAMEN DE SEGUIMIENTO CON RESTRICCIONES = SEGUIMIENTO LABORAL
- CONTROL PERIÓDICO CON RECOMENDACIONES = EXAMEN PERIÓDICO
- PREOCUPACIONAL = INGRESO
- RETIRO = EGRESO
- POST INCAPACIDAD = REINTEGRO / REINCORPORACIÓN

## Ejemplo de conflicto real
INGRESO vs EGRESO sí requiere revisión.
