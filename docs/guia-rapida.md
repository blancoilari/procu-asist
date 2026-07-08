# ProcuAsist - Guía rápida (v0.8.0)

Una página con los pasos esenciales. Para el detalle completo, ver `manual-usuario.md`.

---

## 1. Instalar la extensión y fijar el ícono

1. Entrá a la ficha de Chrome Web Store: https://chromewebstore.google.com/detail/procuasist-copiloto-legal/dbkfeofoijnkclfpigimiodcccpjakem
2. Clic en **"Agregar a Chrome"** y después en **"Agregar extensión"**.
3. Clic en el ícono de pieza de rompecabezas (arriba a la derecha de Chrome).
4. Buscá ProcuAsist y clic en el alfiler (pin) para fijarlo en la barra.

---

## 2. Cargar las credenciales de los portales

1. Al instalar, ProcuAsist abre la **bienvenida** con los campos para cargar usuario y contraseña de **MEV** y **PJN** (las mismas que ya usás para entrar a esos portales). Cargalas ahí mismo y clic en **"Guardar"** en cada portal.
2. Si la salteaste: panel lateral, pestaña **Ajustes**, botón **"Credenciales de portales y configuración avanzada"**, y cargalas en la sección **Credenciales**.
3. No hay PIN: las credenciales se guardan encriptadas en tu navegador con una clave propia del dispositivo y nunca salen de tu computadora.
4. Con las credenciales guardadas, ProcuAsist te loguea solo en los portales y te reconecta cuando la sesión se cae. En MEV, el departamento judicial que elijas al entrar queda aprendido para la próxima reconexión.

---

## 3. Guardar y monitorear una causa

1. Entrá a la página de una causa puntual en MEV o en PJN/SCW.
2. En la botonera flotante (esquina inferior derecha), clic en **"Guardar"**.
3. Listo: queda guardada **y monitoreada** al mismo tiempo, sin pasos extra. Aparece en la pestaña **Causas** del panel lateral.
4. Para pausar los avisos de una causa sin borrarla: en el menú de los tres puntos de su tarjeta, elegí **"Pausar avisos"**.
5. Para dejar de seguirla del todo: en el mismo menú, elegí **"Eliminar causa"** (borra marcador, monitoreo y alertas juntos).

---

## 4. Descargar un expediente completo

**En MEV:**
1. Clic en el botón de descarga de la botonera flotante, dentro de la causa.
2. En el modal "Seleccionar pasos procesales a descargar", dejá todos tildados o elegí los que quieras.
3. Clic en **"ZIP (N)"** (un PDF por paso + resumen) o en **"Un PDF (N)"** (todo junto en un solo archivo).

**En PJN:**
1. Clic en el botón de descarga dentro del expediente en scw.pjn.gov.ar.
2. Elegí las actuaciones (podés filtrar por categoría) y confirmá.
3. Cada documento tiene 45 segundos de margen antes de saltarse por error. Si querés frenar todo, usá **"Cancelar descarga"** mientras está en curso.

---

## 5. Importar un set o listado completo

**Resultados o set de búsqueda MEV:**
1. En la página de resultados o del set, clic en **"Importar"** / **"Importar set"**.
2. Si el set abarca varios departamentos judiciales, elegí **"Todos los departamentos (N)"** o **"Solo este departamento"**.
3. Confirmá qué causas importar en el modal final. Quedan todas guardadas y monitoreadas.

**Listado PJN (Relacionados o Favoritos):**
1. Clic en **"Importar"** en el listado.
2. ProcuAsist recorre todas las páginas solo; el modal te dice cuántas recolectó.
3. Elegí cuáles importar y confirmá.

**Todo de una vez (recién instalás y querés traer tus causas):**
1. Dejá abiertas y logueadas las pestañas de MEV y/o PJN/SCW. En MEV tenés que haber entrado a un departamento judicial (cualquiera: el asistente recorre todos).
2. Panel lateral, pestaña **Causas**, botón **"Importar todo"**: el asistente detecta los portales, estima los listados PJN y lista tus sets MEV.
3. Elegí las fuentes y confirmá. Los sets MEV se recorren completos, **departamento por departamento** (ProcuAsist cambia de departamento solo si hace falta).
4. Todas las causas importadas quedan guardadas y con **avisos activos**. Si alguna no te interesa, pausás sus avisos desde la lista de Causas.
5. Podés cancelar en cualquier momento; al final hay un resumen (importadas, duplicadas salteadas, errores).

---

## 6. Ver alertas y plazos

**Alertas:**
1. Panel lateral, pestaña **Causas**, sub-pestaña **Alertas**.
2. El badge rojo **NOVEDAD** marca causas con movimientos sin leer.
3. Clic en una tarjeta: abre la causa y la marca leída. O usá **"Marcar todas como leídas"**.
4. Para buscar desde una fecha puntual: campo **"Desde"** + botón **"Buscar movimientos desde esa fecha"** (necesita el portal abierto con sesión activa).
5. En MEV, el escaneo automático usa un atajo por **novedades de set** (beta): consulta tus sets en una sola pasada y solo re-lee lo que se movió. Se apaga en Ajustes; el botón **"Escanear ahora"** siempre revisa causa por causa.

**Plazos:**
1. Panel lateral, pestaña **Plazos**.
2. Completá "Qué vence", fecha de notificación, cantidad de días y tipo (Hábiles o Corridos).
3. Clic en **"Agregar plazo"**: queda en la lista de vencimientos con badge de urgencia.
4. Cargá ferias o feriados puente propios de tu jurisdicción en **"Ferias y días inhábiles"** (la feria de enero y los feriados nacionales 2026-2027 ya vienen cargados).
5. Clic en **"Exportar a calendario (.ics)"** para pasar los vencimientos a Google Calendar u Outlook.

---

*ProcuAsist v0.8.0 - Copiloto Legal para Abogados Argentinos. Manual completo en `docs/manual-usuario.md`.*
