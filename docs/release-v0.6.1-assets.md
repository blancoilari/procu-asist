# Assets de release - ProcuAsist v0.6.1

Materiales para actualizar Chrome Web Store con la version gratuita estabilizada.

## 1. Resumen de version

ProcuAsist v0.6.1 consolida la version gratuita: mejora importaciones MEV, agrega busqueda de movimientos desde fecha y deja mas claro el flujo de monitoreo sin requerir cuentas externas ni backend.

## 2. Descripcion corta

> Descarga expedientes MEV/SCBA y PJN en ZIP, importa causas, monitorea movimientos y ayuda a revisar novedades.

## 3. Descripcion larga sugerida

```text
ProcuAsist es una extension gratuita de Chrome para abogados argentinos que automatiza tareas repetitivas en portales judiciales.

HECHO POR UN ABOGADO DE LA MATRICULA, PARA COLEGAS
No requiere crear una cuenta. Tus datos se guardan localmente en tu navegador.

QUE HACE
- Descarga expedientes completos de MEV/SCBA en ZIP.
- Descarga expedientes de PJN desde SCW cuando el portal permite acceder a los documentos.
- Permite seleccionar que actuaciones incluir antes de generar el ZIP.
- Guarda marcadores de causas y permite abrirlas rapido desde el panel lateral.
- Monitorea causas MEV y muestra alertas de movimientos.
- Busca movimientos desde una fecha indicada en causas monitoreadas.
- Importa causas desde resultados y sets de busqueda MEV.
- Cifra credenciales localmente con PIN maestro.

PORTALES SOPORTADOS
- MEV / SCBA: mev.scba.gov.ar
- PJN: scw.pjn.gov.ar, portalpjn.pjn.gov.ar, api.pjn.gov.ar
- JUSCABA / EJE: eje.jus.gov.ar, con funciones basicas

SEGURIDAD Y PRIVACIDAD
Las credenciales se cifran con AES-GCM y quedan guardadas en tu computadora. ProcuAsist no necesita servidores para funcionar en su version gratuita.

DISCLAIMER
ProcuAsist se ofrece "tal cual", sin garantias. No reemplaza el control manual de actuaciones judiciales ni el criterio profesional del abogado.
```

## 4. Screenshots seleccionadas

Carpeta fuente: `D:\Descargas`

Copias normalizadas para Chrome Web Store: `docs/store-assets/v0.6.1/screenshots-1280x800`

- [x] `01_mev_inicio_.png` - MEV / SCBA como portal principal.
- [x] `02_Menu_procu_Asist_.png` - Panel lateral de ProcuAsist.
- [x] `03_menu_flotante_.png` - Botonera flotante unificada en MEV.
- [x] `04_descargar_expte_completo_.png` - Modal para seleccionar pasos procesales MEV.
- [x] `04_b_archivo_zip_.png` - Archivo ZIP generado desde MEV.
- [x] `04_c_archivos_.png` - Contenido descomprimido del ZIP MEV.
- [x] `04_d_pdf_ejemplo_.png` - Ejemplo de PDF de paso procesal MEV.
- [x] `05_monitoreo_por_fechas_.png` - Busqueda de movimientos desde una fecha.
- [x] `05_b_marcadores_.png` - Marcadores con causas importadas desde MEV.
- [x] `06_PJN_descarga_Expte_completo_.png` - Modal ZIP PJN.
- [x] `07_zip_pjn_.png` - Archivo ZIP generado desde PJN.
- [x] `08_zip_descomprimido_.png` - Contenido descomprimido del ZIP PJN.
- [x] `09_ejemplo_pdf_pjn_.png` - Ejemplo de PDF descargado desde PJN.

Para Chrome Web Store conviene subir primero 5 capturas principales:

- `02_Menu_procu_Asist_.png`
- `03_menu_flotante_.png`
- `04_descargar_expte_completo_.png`
- `05_monitoreo_por_fechas_.png`
- `06_PJN_descarga_Expte_completo_.png`

Como la Store suele limitar a 5 capturas, reservar como alternativas si conviene reemplazar alguna principal:

- `04_c_archivos_.png`
- `04_d_pdf_ejemplo_.png`
- `08_zip_descomprimido_.png`
- `09_ejemplo_pdf_pjn_.png`

## 5. Checklist tecnico

- [x] `npm run compile`
- [x] `npm run build`
- [x] `npm run zip`
- [ ] QA manual segun `docs/qa-v0.6.1.md`
- [x] ZIP generado: `.output/procu-asist-0.6.1-chrome.zip` o equivalente WXT.
- [ ] Commit y push a GitHub.
- [ ] Version enviada a revision en Chrome Web Store.

## 6. Mensaje para compartir

```text
Actualice ProcuAsist, la extension gratis de Chrome para abogados.

Ahora importa sets de busqueda MEV, permite buscar movimientos desde una fecha y mantiene la descarga ZIP de MEV/SCBA y PJN.

Chrome Web Store:
https://chromewebstore.google.com/detail/procuasist-copiloto-legal/dbkfeofoijnkclfpigimiodcccpjakem
```
