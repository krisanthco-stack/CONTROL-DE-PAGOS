# Libreta de Control de Cuadrilla

Aplicación web progresiva (PWA) para el control diario de cuadrillas de campo.

## Versión

**GitHub 1.1.0**

## Funciones principales

- Capataz fijo: **Marco Tulio Castillo, capataz deshoja**.
- Bloque actual editable y persistente.
- Área total de supervisión editable y persistente.
- Base local de trabajadores.
- Autocompletado de clave, cuadrilla y labor.
- Registro diario de pieza, obra, cable, terreno, torre inicial, torre final y actividad.
- Cálculo automático de torres realizadas.
- Conversión automática usando exclusivamente la regla **10 torres = 1 hectárea**.
- Reporte de horas trabajadas por registro.
- Totales diarios por trabajador.
- Cálculo económico a **₡4.350 por hectárea**.
- Reporte diario para PDF/impresión.
- Exportación Word.
- Exportación Excel/CSV.
- Envío de resumen mediante el cliente de correo del dispositivo.
- Almacenamiento local con IndexedDB.
- PWA instalable.
- Funcionamiento offline después de la primera carga correcta.

## Archivos de publicación

```text
/
├── index.html
├── styles.css
├── app.js
├── manifest.webmanifest
├── sw.js
├── logo.svg
├── icon-192.png
├── icon-512.png
├── maskable-512.png
├── .nojekyll
└── README.md
```

## GitHub Pages

El proyecto está preparado para publicarse desde la raíz de la rama `main`.

Una vez que el repositorio exista y los archivos estén en `main`, configure GitHub Pages para servir la raíz del repositorio.

## Datos

Los trabajadores, registros diarios, bloque, área de supervisión y correo se almacenan localmente en el dispositivo/navegador mediante IndexedDB. El funcionamiento offline depende de que la aplicación haya sido cargada correctamente al menos una vez desde el sitio publicado.

## Nota sobre correo

La versión actual abre el cliente de correo o la función de compartir del dispositivo con el resumen preparado. No envía correos automáticamente desde un servidor.

## Repositorio previsto

`krisanthco-stack/libreta-control-cuadrilla`
