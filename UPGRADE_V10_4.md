# Upgrade V10.4 · salida compacta y visor PDF corregido

## Exámenes realizados
La carta imprime únicamente el nombre de cada examen. Los estados internos (`REALIZADO`, `NORMAL`, `APTO`, etc.) se conservan para validación y trazabilidad, pero ya no aparecen junto al nombre del examen en la salida institucional.

## Recomendaciones en un solo párrafo
Todas las recomendaciones clínicas se integran en un único párrafo justificado y en el mismo orden de `examenes_lista`. Cada bloque conserva el texto completo del certificado y queda identificado mediante una etiqueta en negrita del tipo `Para Audiometría:`. No se resumen ni se eliminan recomendaciones.

Ejemplo conceptual:

`Recomendaciones: Para Audiometría: [texto completo]. Para Espirometría: [texto completo]. Para Optometría: [texto completo].`

Esto reduce saltos verticales, mejora la lectura y aprovecha mejor una página A4 sin mezclar recomendaciones entre exámenes.

## Vista previa del PDF original
El visor PDF fue corregido para:

- ajustar cada página al ancho real disponible;
- evitar el desplazamiento lateral causado por el centrado flex de un canvas sobredimensionado;
- renderizar en alta densidad mediante el `transform` oficial de PDF.js en lugar de modificar manualmente el contexto;
- reajustarse automáticamente al cambiar el tamaño de la ventana o del panel;
- reutilizar el PDF ya abierto al cambiar de página.

## Backend
V10.4 no cambia Apps Script ni el esquema de Gemini. No requiere una nueva implementación del backend si V10.3 ya está desplegada.
