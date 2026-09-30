# Capturas sinteticas de portales - ProcuAsist v0.8.1

Material para reemplazar las capturas de la ficha de Chrome Web Store (y del
repositorio) que se sacaron contra portales judiciales reales y muestran
numeros de expediente, caratulas, partes, cedulas, nombres de funcionarios y el
usuario de MEV de una persona concreta.

Estas cinco imagenes NO son capturas de pantalla reales: son maquetas HTML/CSS
que reproducen la apariencia de MEV/SCBA y de PJN/SCW con la interfaz que
ProcuAsist inyecta encima. Se generan con Playwright y se verifican a 1280x800,
que es el tamano que pide la Store.

## Datos ficticios (regla dura)

Todo el contenido es inventado. No hay caratulas, partes, numeros de
expediente, receptorias, juzgados, cedulas, fojas ni nombres de funcionarios de
causas reales. Las partes son personas juridicas inventadas de nombre
transparente (CONSTRUCTORA EJEMPLO S.R.L., ASEGURADORA MODELO S.A.,
COOPERATIVA EJEMPLO LTDA., TRANSPORTES MUESTRA S.A.): no aparece ninguna
persona humana, ni siquiera con nombre inventado. Los numeros estan elegidos
para que se lean como de demostracion (LP - 90123 - 2024, CIV 012345/2024,
nidCausa=9000001, cid=9000001) y el usuario del portal es "usuariodemo".

Al editar los HTML, mantener esa regla: no pegar nunca datos de una causa real,
ni siquiera parcialmente tachados. Tachar con negro no alcanza (varias de las
capturas viejas que este material reemplaza tenian tachados que dejaban leer el
dato al lado, en el codigo de barras o en el nombre del archivo ZIP).

## Las cinco imagenes

| Archivo | Que muestra |
|---|---|
| `01-mev-expediente.png` | Expediente MEV con la barra flotante de ProcuAsist (Configurar, Descargar expediente, Guardar, Monitoreando) |
| `02-mev-modal-pasos.png` | Dialogo "Seleccionar pasos procesales a descargar" sobre el expediente MEV |
| `03-pjn-modal-zip.png` | Dialogo "Descargar expediente" sobre PJN/SCW, con el aviso de actuaciones historicas, las categorias y la seleccion |
| `04-zip-descomprimido.png` | El ZIP descargado y descomprimido: PDF resumen mas un archivo por actuacion, con fecha y descripcion en el nombre |
| `05-pdf-resumen.png` | Primera pagina del PDF resumen que genera la extension |

## Que captura reemplaza a cual

Lista de las imagenes del repositorio que contienen datos reales, con su
reemplazo. **La ficha viva de la Store se controla en el dashboard de Chrome
Web Store**: hay que abrir la ficha, comparar imagen por imagen y subir el
reemplazo de las que esten publicadas. Las que no esten publicadas igual hay
que sacarlas del repositorio, que es publico.

### Set `docs/store-assets/v0.6.1/screenshots-1280x800/` (capturas de la ficha 0.6.1)

| Capturas a reemplazar | Que dato real muestran | Reemplazo |
|---|---|---|
| `01_mev_inicio_.png` | Set de busqueda real, tres expedientes con su numero, juzgado, y el usuario MEV solo parcialmente tachado | `01-mev-expediente.png` |
| `03_menu_flotante_.png` | Caratula con la demandada legible, `nidCausa`/`pidJuzgado` reales en la URL y el texto del codigo de barras con la actora sin tachar | `01-mev-expediente.png` |
| `04_descargar_expte_completo_.png` | Listado completo de actuaciones reales con fechas | `02-mev-modal-pasos.png` |
| `04_b_archivo_zip_.png` | Nombre del ZIP con el numero de expediente real, repetido seis veces en el menu de 7-Zip | `04-zip-descomprimido.png` |
| `04_c_archivos_.png` | Nombres de archivo de actuaciones reales | `04-zip-descomprimido.png` |
| `04_d_pdf_ejemplo_.png` | Caratula, numeros de notificacion electronica y nombre y apellido de la jueza firmante | `05-pdf-resumen.png` |
| `05_b_marcadores_.png` | Panel con varias causas reales: caratulas, numeros y juzgados | `01-mev-expediente.png` (o una de las promocionales de `v0.7.0`, que ya son sinteticas) |
| `05_monitoreo_por_fechas_.png` | Alertas de causas reales | Una de las promocionales de `v0.7.0` (`02-alertas-por-expediente.png`), ya sintetica |
| `06_PJN_descarga_Expte_completo_.png` | `cid` real en la URL y numeros de cedula electronica completos | `03-pjn-modal-zip.png` |
| `07_zip_pjn_.png` | Nombre del ZIP con el expediente PJN real, repetido seis veces | `04-zip-descomprimido.png` |
| `08_zip_descomprimido_.png` | Nombres de archivo de escritos y despachos reales | `04-zip-descomprimido.png` |
| `09_ejemplo_pdf_pjn_.png` | Resolucion judicial real completa, con juzgado y caratula | `05-pdf-resumen.png` |

Del set 0.6.1 solo `02_Menu_procu_Asist_.png` no tiene datos de causas, pero
igual quedo obsoleta: muestra el PIN maestro (eliminado en la 0.8.0) y el
interruptor de Keep-Alive JUSCABA (portal retirado en la 0.8.1). Se reemplaza
por las promocionales sinteticas de `v0.7.0`.

### Set `docs/screenshots-cws/` (capturas de la epoca v0.3.0)

Las ocho imagenes (`01-ajustes`, `02-modal-pasos`, `03-marcadores`,
`04-monitoreo`, cada una en su version original y en la de 1280x800) son las
mas expuestas: **no tienen ningun tachado**. Muestran nombre y apellido de tres
partes, tres numeros de expediente, el juzgado, el usuario de MEV y el nombre
completo del titular de la matricula.

| Capturas a reemplazar | Reemplazo |
|---|---|
| `01-ajustes.png`, `01-ajustes-1280x800.png` | Promocional sintetica de `v0.7.0` de la vista Ajustes, o `01-mev-expediente.png` |
| `02-modal-pasos.png`, `02-modal-pasos-1280x800.png` | `02-mev-modal-pasos.png` |
| `03-marcadores.png`, `03-marcadores-1280x800.png` | `01-mev-expediente.png` mas la promocional `v0.7.0/01-causas-unificada.png` |
| `04-monitoreo.png`, `04-monitoreo-1280x800.png` | Promocional `v0.7.0/02-alertas-por-expediente.png` |

### Manual de usuario

`docs/tutorial/` tiene dieciseis capturas del manual tomadas del uso real.
Se revisaron una por una el 09/09/2026 y se taparon con rectangulo opaco los
datos identificables que quedaban: numero de receptoria, numero de expediente,
juzgado y departamento judicial en `07-guardar-causa.png`, y dos numeros de
cedula electronica mas cuatro filas de pase con el juzgado, la secretaria y la
camara de origen en `11-modal-zip-pjn.png`. La regla, el detalle por captura
y la herramienta (`scripts/tapar-capturas-tutorial.mjs`) estan en
`docs/tutorial/README.md`. Tapadas no dejan de ser capturas de causas reales:
si en algun momento hay que rehacerlas, se rehacen con esta maqueta. Dos de
ellas (`04-configurar-pin.png` y `06-restablecer-pin.png`) ademas quedaron
obsoletas: muestran el PIN maestro, eliminado en la 0.8.0.

## Como se regeneran

Cada imagen tiene su HTML fuente autocontenido; el estilo comun esta en
`_shared.css`. El render a PNG usa Playwright con Chromium.

```sh
# Desde este directorio:
C:\Python314\python.exe _render.py
```

El script abre cada `NN-*.html` con viewport de 1280x800, captura el viewport
exacto (con clip, no full page) y verifica con Pillow que el PNG mida
exactamente 1280x800. Requiere `playwright` (con Chromium instalado) y
`pillow`. Es un script manual, no una tarea agendada.

## Que falta y quien lo hace

Este material queda listo para usar; la subida a la ficha de Chrome Web Store
la hace Patricio. Estado al 29/09/2026, con la 0.8.1 ya publicada: la ficha
pública muestra cinco capturas que son las maquetas sintéticas de la 0.7.0
(`docs/store-assets/v0.7.0`), sin datos reales, y ya no las de la 0.6.1. Estas
cinco de la 0.8.1 no se subieron. La pausa del proyecto (25/09/2026) quedó sin
efecto el 29/09/2026 para publicar la 0.8.1. La purga
del historial de git que sacaba las capturas viejas de la historia se hizo el
09/09/2026 (commit `a4957c8`). El seguimiento vive en el mapa de pendientes del
ecosistema del estudio, fuera de este repositorio (identificador P2).
