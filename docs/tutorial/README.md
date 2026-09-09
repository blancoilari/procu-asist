# Capturas del manual de usuario

Las imágenes de esta carpeta ilustran `docs/manual-usuario.md`. Se toman de la
extensión corriendo en un Chrome real, y varias muestran portales judiciales.

## Regla dura

**Este es un repositorio público.** Las capturas del manual se toman con datos
ficticios, o se tapan antes de commitear. No se commitea una captura de una
causa real sin tapar, ni siquiera "por ahora": lo que entra al repositorio
queda en la historia de git aunque después se borre el archivo.

Tapar quiere decir **rectángulo opaco**, nunca desenfoque ni pixelado: un
desenfoque de baja intensidad se revierte y el pixelado de bloques grandes
también. El pixel tapado se pierde y no vuelve.

### Qué se tapa

- Número de expediente y de receptoría, CUIJ, `nidCausa`, `pidJuzgado`, `cid`
  y cualquier identificador de causa que aparezca en pantalla o en la URL.
- Carátula, en cualquier lugar donde se lea (encabezado, tarjeta del panel,
  alerta, título de la pestaña, nombre del archivo ZIP, código de barras).
- Nombres y apellidos de partes, de jueces y de profesionales; matrículas.
- Domicilios, DNI, CUIT y CUIL.
- Números de cédula electrónica.
- El usuario del portal (MEV, PJN) y cualquier dato de la sesión.
- El juzgado y el departamento judicial de la causa que se está mostrando.

### Qué no se tapa

La interfaz, los botones, los menús, los textos de ayuda y las descripciones
genéricas de pasos procesales ("EN LETRA", "TRASLADO - CONTESTA", "RECURSO DE
APELACION - CONTESTA TRASLADO"). Eso es el contenido del tutorial: si se tapa,
la captura deja de explicar lo que vino a explicar.

El nombre del tribunal no es una excepción: se tapa. Un juzgado con número y
secretaría, o una cámara con su oficina de origen, identifican el fuero y la
dependencia donde tramita la causa que la captura está mostrando, y se tapan
también cuando aparecen dentro de una fila de trámite (PASE, RECEPCION PASE):
es el mismo dato que la barra superior de MEV, escrito en otro renglón. No se
midió cuánto reduce el universo de expedientes; en un repositorio público la
duda se resuelve tapando.

## La herramienta

`scripts/tapar-capturas-tutorial.mjs` guarda el manifiesto de rectángulos
aplicados, con el motivo de cada uno, y verifica el resultado con OCR.

```sh
node scripts/tapar-capturas-tutorial.mjs tapar --dry-run   # lista qué taparía
node scripts/tapar-capturas-tutorial.mjs tapar             # aplica
node scripts/tapar-capturas-tutorial.mjs verificar         # OCR sobre las 16
```

`verificar` sale con código 1 si encuentra una coincidencia y con 0 si no
encuentra ninguna, así que se puede colgar de un hook o de una tarea. Salir con
0 imprimiendo `FALLA` sería lo peor de los dos mundos.

En `scripts/` hay además `redact-screenshot.mjs`, anterior: tapa rectángulos
sueltos que se le pasan por línea de comandos, sin manifiesto ni verificación.
Sirve para una imagen que no vive en `docs/tutorial/`. Para las capturas del
manual va siempre la de este README, porque deja escrito qué se tapó y por qué.

`tapar` aborta si la imagen no mide lo que dice el manifiesto o si un rectángulo
se sale del borde (sharp recorta el overlay que se pasa sin avisar, y taparía
solo la parte que entra).

`tapar` es destructivo y modifica los PNG en el lugar. Si se corre dos veces,
vuelve a pintar el mismo rectángulo sobre el rectángulo: no rompe nada, pero
tampoco arregla una captura nueva que no esté en el manifiesto.

Para una captura nueva: mirarla entera, sacar las coordenadas del texto con
`tesseract captura.png stdout -l spa tsv`, agregar la entrada al manifiesto con
el motivo, correr `tapar`, correr `verificar` y **volver a mirar la imagen**.

### El OCR no alcanza

`verificar` se apoya en tesseract y sirve para atrapar lo que se escapó, no
para dar por buena una captura. Se le pasan las imágenes al doble de escala
porque a tamaño original no leía los números de cédula electrónica de
`11-modal-zip-pjn.png`, que estaban perfectamente legibles a ojo. Que el OCR no
encuentre un dato no significa que no esté: la decisión de qué tapar se toma
mirando la imagen.

## Estado de las capturas (revisión del 09/09/2026)

Las dieciséis se revisaron una por una, a ojo y con OCR.

| Captura | Dato identificable | Qué se hizo |
|---|---|---|
| `01-fijar-icono.png` | ninguno | sin cambios |
| `02-panel-lateral.png` | ninguno (panel vacío) | sin cambios |
| `03-instalar-cws.png` | ninguno (la promocional de la ficha ya es sintética) | sin cambios |
| `04-configurar-pin.png` | ninguno | sin cambios |
| `05-guardar-credenciales.png` | usuarios de MEV y PJN, ya tapados con negro | sin cambios |
| `06-restablecer-pin.png` | ninguno | sin cambios |
| `07-guardar-causa.png` | número de receptoría, número de expediente, juzgado y departamento judicial | tres rectángulos |
| `08-menu-causa.png` | carátula, ya borrada en blanco | sin cambios |
| `09-alertas.png` | carátula, ya borrada | sin cambios |
| `10-modal-zip-mev.png` | ninguno (fechas, fojas y descripciones genéricas) | sin cambios |
| `11-modal-zip-pjn.png` | dos números de cédula electrónica; juzgado y secretaría, y cámara con su oficina de origen, en cuatro filas de pase | seis rectángulos |
| `13-importar-pjn-multipagina.png` | listado de causas, ya borrado en blanco | sin cambios |
| `14-importar-todo.png` | nombres de los sets de MEV, ya borrados | sin cambios |
| `15-calcular-plazo.png` | ninguno | sin cambios |
| `16-plazos-vencimientos.png` | ninguno (vencimientos con etiquetas genéricas) | sin cambios |
| `17-backup.png` | ninguno | sin cambios |

Los originales sin tapar siguen en la historia de git. Sacarlos de ahí es la
purga de historial, que va aparte de esta carpeta.

## Lo que queda pendiente

- `04-configurar-pin.png` y `06-restablecer-pin.png` muestran el PIN maestro,
  eliminado en la 0.8.0: quedaron obsoletas por producto, no por privacidad.
- `12-dialogo-multidepartamento.png` nunca se sacó; el manual la referencia y
  la imagen no existe.
- Si en algún momento hay que rehacer una captura de portal sin datos reales,
  la maqueta de datos ficticios está en `docs/store-assets/v0.8.1` (HTML más
  `_render.py` con Playwright).
