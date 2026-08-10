# Libreta de Control de Cuadrilla — Mobile 1.3.2

Versión optimizada exclusivamente para teléfonos.

## Cambios principales
- Flujo vertical móvil: Datos → Tiempo y torres → Vista previa → Jornada.
- Clave predeterminada: 5969.
- Pieza predeterminada: 4350.
- Labor predeterminada: Deshoja.
- Hora inicio y hora fin con cálculo automático de horas/minutos.
- Torres seleccionables del 01 al 129.
- 10 torres = 1 hectárea.
- ₡4.350 por hectárea.
- Deshacer último registro.
- Borrador automático recuperable con LocalStorage.
- Reporte final, compartir/correo, PDF/impresión y Excel/CSV.
- PWA instalable y offline.
- Eliminado completamente el campo “¿Qué hizo ahí?”.

## Reportes 1.3.0
- Vista móvil en tarjetas.
- Vista de PDF reacomodada a A4 vertical, sin tabla cortada.
- Resumen superior con trabajadores, horas, torres, hectáreas y monto.
- Tabla compacta: Trabajador, Horario, Labor/Pieza, Torres, Ha y Monto.
- Word con encabezado, KPIs y tabla detallada.
- Excel `.xls` con formato, encabezado, KPIs y tabla detallada.

- Hora inicio y hora fin editables antes de guardar.

## Auditoría 1.3.2
- Confirmado: Hora inicio y Hora fin son editables antes de guardar.
- Confirmado: selector de torres 01–129.
- Confirmado: no existen vectores.
- Confirmado: eliminado “¿Qué hizo ahí?”.
- PDF, Word y Excel usan la misma matriz compacta de 6 columnas.
- Los tres reportes incluyen encabezado, KPIs y fila final de totales.
- PDF se ajusta a A4 vertical y evita cortes de fila.
- Word se ajusta a A4 con anchos de columna definidos.
- Excel se entrega en `.xls` con formato visual y los mismos datos del PDF/Word.
