# Plan Maestro 2026 - ProcuAsist

Ultima actualizacion: 2026-04-28

## 1. Decisiones madre

### 1.1 Producto

ProcuAsist queda como la capa gratis.

La promesa del producto gratis es:

- automatizar trabajo repetitivo
- ahorrar tiempo de procuracion
- centralizar causas y movimientos
- no depender de servidores externos
- respetar un modelo local-first

La promesa del producto pago vendra despues:

- sync entre dispositivos
- trabajo en equipo
- copiloto IA sobre expediente
- plazos, digest y tableros
- preparacion de borradores
- modulos premium por materia

### 1.2 Foco jurisdiccional

El foco principal del roadmap pasa a ser:

1. SCBA / MEV
2. SCBA / PyNE (notificaciones y presentaciones electronicas)
3. PJN
4. EJE como soporte secundario

### 1.3 Estrategia tecnica

En la etapa gratis:

- storage local como fuente de verdad
- nada de Supabase obligatorio
- nada de cuentas obligatorias
- cero dependencia del backend para que la extension funcione

En la etapa paga:

- backend aparte
- sync opcional
- auth y billing separados de la extension gratis

### 1.4 Naming

- mantener `ProcuAsist` para el producto gratis
- no renombrar ahora
- evaluar nueva marca o submarca solo cuando exista la plataforma paga

### 1.5 PyNE

PyNE entra como iniciativa premium estrategica, pero no para automatizar la firma final desde el dia uno.

Primer objetivo premium razonable en PyNE:

- preparar borradores
- completar campos
- dejar la presentacion lista para revision/firma
- ayudar con adjuntos y metadatos

No objetivo inicial:

- firma automatica ciega
- envio automatico sin control humano

## 2. Como leer costos

En este plan se usan dos metricas:

### 2.1 Costo de caja

Es el dinero real que hay que pagar de bolsillo en:

- GitHub
- Chrome Web Store
- hosting
- Supabase
- dominios
- herramientas

### 2.2 Costo de construccion

Es el valor del trabajo tecnico, aunque lo hagas vos o con ayuda.

Sirve para medir:

- cuanto esfuerzo vale cada fase
- cuanto costaria tercerizar
- donde conviene invertir tiempo

### 2.3 Regla practica

- `4k` = USD 4.000
- `8k` = USD 8.000

Si el trabajo se hace in-house, el costo de caja puede ser muy bajo aunque el costo de construccion sea alto.

## 3. Estado actual resumido

### 3.1 Lo que ya existe

- extension publicada en Chrome Web Store
- repo enlazado a GitHub
- soporte MEV / PJN / EJE
- popup, options, sidepanel, background, offscreen
- credenciales locales con PIN
- descarga ZIP en MEV y PJN
- importacion desde resultados y sets de busqueda MEV
- vista de movimientos desde fecha para causas MEV monitoreadas
- monitoreo basico

### 3.2 Problemas detectados

- documentacion publica desalineada con el estado real del producto
- claims viejos en README, manual y assets de release
- UI inyectada no unificada entre portales
- archivos grandes y concentracion de logica
- monitoreo documentado distinto a lo que hace el codigo
- EJE sin la misma madurez que SCBA y PJN

### 3.3 Decision de trabajo

Primero se consolida lo gratis.

Despues se arma la plataforma paga.

## 4. Reglas de ejecucion

### 4.1 Antes de meter features nuevas

No agregar features premium mientras no se cumplan estas condiciones:

- docs publicas actualizadas
- Store actualizada
- UI unificada
- MEV / PJN estables
- QA manual repetible
- logs y diagnostico minimos

### 4.2 Definicion de terminado

Una tarea se considera terminada solo si:

- compila
- se probo manualmente
- se actualizo la documentacion si correspondia
- no deja claims publicos falsos
- tiene criterio de rollback si toca algo sensible

### 4.3 Prioridad por portal

- P0: SCBA / MEV
- P1: PJN
- P2: SCBA notificaciones
- P3: EJE

## 5. Estructura recomendada de GitHub

## 5.1 Visibilidad del repo

Decision pendiente a confirmar manualmente en GitHub:

- si el repo queda publico
- o si pasa a privado

Sugerencia:

- core privado
- feedback publico por mail o repo separado

Checklist:

- verificar visibilidad del repo
- revisar colaboradores
- revisar secrets
- revisar si el repo esta linkeado en la Store y en docs publicas

## 5.2 Branching

- `main`: estable
- `dev`: opcional, si el flujo empieza a crecer
- ramas cortas por ticket: `feat/...`, `fix/...`, `docs/...`

## 5.3 Milestones

- `M0 - saneamiento publico`
- `M1 - ui unificada`
- `M2 - scba/mev hardening`
- `M3 - pjn hardening`
- `M4 - importaciones y vista por fecha`
- `M5 - free v1 estable`
- `M6 - discovery premium pyne/pjn`
- `M7 - backend paid foundation`

## 5.4 Labels

- `type:bug`
- `type:feature`
- `type:refactor`
- `type:docs`
- `type:research`
- `priority:p0`
- `priority:p1`
- `priority:p2`
- `portal:scba`
- `portal:pjn`
- `portal:eje`
- `portal:pyne`
- `area:ui`
- `area:background`
- `area:storage`
- `area:pdf`
- `area:store`
- `area:qa`

## 5.5 CI minima

GitHub Actions:

- `npm.cmd run compile`
- `npm.cmd run build`

Mas adelante:

- empaquetado para release
- chequeos de versionado

## 6. Roadmap por fases

## 6.1 Fase A - saneamiento publico y operativo

Ventana sugerida: 1 a 2 semanas

Objetivo:

- alinear repo, docs, Store y claims publicos al estado real del producto

Costo de caja:

- USD 0 a 100

Costo de construccion:

- USD 2.000 a 5.000

Entregables:

- README actualizado
- manual actualizado
- assets de release actualizados
- descripcion de Store corregida
- capturas nuevas
- roadmap coherente

## 6.2 Fase B - UI unificada

Ventana sugerida: 2 a 3 semanas

Objetivo:

- que la experiencia visual y funcional de las acciones sea una sola en todos los portales

Costo de caja:

- USD 0 a 100

Costo de construccion:

- USD 4.000 a 8.000

Entregables:

- action bar comun
- iconografia comun
- orden comun de botones
- estados comunes
- overlays y modales comunes

## 6.3 Fase C - hardening SCBA / MEV

Ventana sugerida: 3 a 4 semanas

Objetivo:

- dejar SCBA/MEV como el nucleo mas solido del producto gratis

Costo de caja:

- USD 0 a 200

Costo de construccion:

- USD 6.000 a 12.000

Entregables:

- login y post-login estables
- monitoreo confiable
- ZIP robusto
- importaciones consistentes
- mensajes de error comprensibles

## 6.4 Fase D - hardening PJN

Ventana sugerida: 2 a 3 semanas

Objetivo:

- consolidar PJN al mismo nivel funcional que ya promete el producto

Costo de caja:

- USD 0 a 200

Costo de construccion:

- USD 5.000 a 10.000

Entregables:

- mejor manejo de sesiones
- collector robusto
- mejores estados de descarga
- importacion de listados/favoritos

## 6.5 Fase E - vista de trabajo e importaciones

Ventana sugerida: 2 a 3 semanas

Objetivo:

- convertir la extension en una herramienta de seguimiento diario, no solo de automatizacion puntual

Costo de caja:

- USD 0 a 200

Costo de construccion:

- USD 4.000 a 8.000

Entregables:

- importacion desde sets/resultados MEV
- importacion desde listados/favoritos PJN
- vista "movimientos desde fecha"
- filtros utiles para trabajo diario

## 6.6 Fase F - free v1 estable

Ventana sugerida: 1 a 2 semanas

Objetivo:

- publicar una version gratis defendible y prolija

Costo de caja:

- USD 0 a 200

Costo de construccion:

- USD 2.000 a 5.000

Entregables:

- Store revisada
- capturas nuevas
- manual publico correcto
- telemetry/logs minimos locales
- flujo de soporte definido

## 6.7 Fase G - discovery premium

Ventana sugerida: 2 a 3 semanas

Objetivo:

- relevar PyNE y escritos PJN con criterio de producto y riesgo

Costo de caja:

- USD 0 a 200

Costo de construccion:

- USD 3.000 a 7.000

Entregables:

- mapa de flujo PyNE
- mapa de flujo PJN escritos
- alcance del MVP premium
- no-go list de automatizaciones riesgosas

## 6.8 Fase H - backend paid foundation

Ventana sugerida: 4 a 8 semanas

Objetivo:

- crear plataforma paga sin romper el producto gratis

Costo de caja inicial:

- USD 25 a 80 por mes

Costo de construccion:

- USD 18.000 a 35.000

Entregables:

- Supabase
- auth
- workspaces
- sync
- billing
- auditoria
- panel web

## 7. Backlog maestro por epicas

## 7.1 Epic 0 - orden y credibilidad publica

Objetivo:

- que la cara publica del proyecto diga la verdad y ayude a instalarlo

Tareas:

1. corregir [README.md]
2. corregir [docs/manual-usuario.md]
3. corregir [docs/release-v0.4.0-assets.md]
4. revisar [ROADMAP.md]
5. revisar [CHANGELOG.md]
6. revisar [PRIVACY.md]
7. actualizar descripcion y capturas de Chrome Web Store

Archivos impactados:

- `README.md`
- `docs/manual-usuario.md`
- `docs/release-v0.4.0-assets.md`
- `ROADMAP.md`
- `CHANGELOG.md`
- `PRIVACY.md`

Criterios de aceptacion:

- no quedan menciones a "proximamente" si ya existe
- no quedan claims publicos falsos
- PJN aparece donde realmente ya existe
- monitoreo describe lo que efectivamente hace
- Chrome Web Store refleja la version real actual

Estimacion:

- 12 a 20 horas

## 7.2 Epic 1 - UI comun en portales

Objetivo:

- unificar botones y overlays en MEV, PJN y EJE

Tareas:

1. definir action bar comun
2. definir orden comun de botones:
   - Configurar
   - ZIP
   - Guardar
   - Monitorear
3. extraer estilos compartidos
4. extraer utilidades de estado visual
5. reimplementar inyecciones actuales usando componentes/constructores compartidos

Archivos de partida:

- `entrypoints/mev.content.ts`
- `entrypoints/pjn.content.ts`
- `entrypoints/eje.content.ts`
- `modules/ui/icon-strings.ts`
- `modules/ui/portal-colors.ts`

Archivos nuevos sugeridos:

- `modules/ui/portal-action-bar.ts`
- `modules/ui/portal-overlays.ts`
- `modules/ui/portal-actions-theme.ts`

Criterios de aceptacion:

- misma posicion y spacing en todos los portales
- mismos estados visuales
- mismo tratamiento de loading/success/error
- boton de configuracion siempre visible

Estimacion:

- 20 a 32 horas

## 7.3 Epic 2 - SCBA / MEV core

Objetivo:

- cerrar bien el circuito principal del abogado bonaerense

Tareas:

1. revisar flujo de login y post-login
2. revisar keep-alive y session expiry
3. revisar monitoreo y frecuencia
4. revisar ZIP, reintentos y verificacion
5. revisar mensajes de error
6. revisar importacion desde resultados
7. revisar integracion con notificaciones SCBA

Archivos de partida:

- `entrypoints/mev.content.ts`
- `entrypoints/background/case-monitor.ts`
- `entrypoints/background/keep-alive.ts`
- `entrypoints/background/auto-reconnect.ts`
- `modules/pdf/case-zip-generator.ts`
- `modules/pdf/attachment-downloader.ts`
- `modules/portals/mev-parser.ts`
- `modules/storage/monitor-store.ts`

Criterios de aceptacion:

- login robusto
- reconexion clara
- escaneo explicable al usuario
- ZIP estable en expedientes chicos y medianos
- errores exportables para soporte

Estimacion:

- 28 a 48 horas

## 7.4 Epic 3 - PJN core

Objetivo:

- alinear la experiencia PJN a lo que ya se promete publicamente

Tareas:

1. revisar captura de token y manejo de sesion
2. reforzar collector de actuaciones
3. revisar ZIP PJN
4. revisar botonera y modal PJN
5. revisar mensajes cuando falta token o la tab correcta
6. importar favoritos/listados PJN

Archivos de partida:

- `entrypoints/pjn.content.ts`
- `entrypoints/background/pjn-token-capture.ts`
- `modules/portals/pjn-actuaciones-collector.ts`
- `modules/portals/pjn-downloader.ts`
- `modules/portals/pjn-zip-ui.ts`
- `modules/pdf/pjn-zip-generator.ts`

Criterios de aceptacion:

- estados comprensibles
- menos dependencia de debug-only mental model
- collector confiable
- ZIP consistente

Estimacion:

- 24 a 40 horas

## 7.5 Epic 4 - EJE en modo mantenimiento inteligente

Objetivo:

- sostener EJE sin dejar que desordene el roadmap central

Tareas:

1. unificar UI
2. corregir docs
3. dejar claro que features son beta o parciales
4. revisar login SSO y deteccion basica

Archivos de partida:

- `entrypoints/eje.content.ts`
- `modules/portals/eje-parser.ts`
- `modules/portals/eje-selectors.ts`

Criterios de aceptacion:

- EJE no rompe la experiencia general
- el usuario entiende que esperar

Estimacion:

- 10 a 18 horas

## 7.6 Epic 5 - importaciones y bandejas utiles

Objetivo:

- pasar de herramienta puntual a herramienta de trabajo diario

Tareas:

1. mantener `notificaciones.scba.gov.ar` fuera del flujo gratuito hasta resolver diferencias de login y sincronizacion con MEV
2. sostener y pulir importacion desde sets/resultados MEV
3. agregar importacion desde listados/favoritos PJN en una version posterior
4. sostener y pulir vista "movimientos desde fecha"
5. permitir abrir cada movimiento con link directo cuando sea posible

Archivos de partida:

- `entrypoints/scba-notif.content.ts`
- `entrypoints/mev.content.ts`
- `entrypoints/pjn.content.ts`
- `entrypoints/sidepanel/App.tsx`
- `entrypoints/background/message-router.ts`
- `modules/storage/bookmark-store.ts`
- `modules/storage/monitor-store.ts`

Sugerencias tecnicas:

- primero implementarlo sobre causas guardadas / monitoreadas
- despues evaluar indexacion historica mas compleja

Criterios de aceptacion:

- el abogado puede ver "que se movio desde X fecha"
- puede importar rapido sin cargar de a una causa

Estimacion:

- 18 a 30 horas

## 7.7 Epic 6 - refactor de mantenibilidad

Objetivo:

- bajar riesgo de mantenimiento

Tareas:

1. dividir `sidepanel/App.tsx`
2. dividir `message-router.ts`
3. encapsular logica repetida de content scripts
4. ordenar tipos de mensajes y respuestas
5. agregar small helpers de test manual

Archivos criticos:

- `entrypoints/sidepanel/App.tsx`
- `entrypoints/background/message-router.ts`
- `modules/messages/types.ts`

Criterios de aceptacion:

- menor acoplamiento
- mas claridad para futuras features

Estimacion:

- 16 a 28 horas

## 7.8 Epic 7 - observabilidad y QA

Objetivo:

- hacer soporte y diagnostico posibles sin adivinar

Tareas:

1. modo diagnostico activable
2. export de estado/logs anonimos para soporte
3. tabla de pruebas manuales por portal
4. smoke checklist antes de cada release
5. versionado y notas de release

Archivos de partida:

- `entrypoints/background/*`
- `modules/storage/*`
- `docs/manual-usuario.md`
- `CHANGELOG.md`

Criterios de aceptacion:

- se puede diagnosticar un problema sin pedirle al usuario diez capturas

Estimacion:

- 12 a 24 horas

## 7.9 Epic 8 - discovery premium PyNE / escritos

Objetivo:

- bajar a tierra la expansion premium sin sobreprometer

Sublinea PyNE:

1. mapear acceso con certificado y sin certificado
2. mapear borradores y estados:
   - pendiente
   - recibida
   - observada
   - firmada sin presentar
3. mapear campos:
   - domicilio generador
   - organismo destino
   - titulo
   - tipo de presentacion
   - observaciones personales
   - texto
   - adjuntos
   - tasa de justicia
4. decidir alcance MVP:
   - generacion de borrador
   - prefill seguro
   - armado de adjuntos

Sublinea PJN escritos:

1. relevar flujo real de presentacion
2. detectar que puede prepararse sin riesgo
3. definir frontera entre "ayuda" y "automatizacion peligrosa"

Criterios de aceptacion:

- documento de decision
- mapa de riesgos
- backlog premium priorizado

Estimacion:

- 16 a 30 horas

## 7.10 Epic 9 - backend paid foundation

Objetivo:

- habilitar la plataforma paga sin hacer rehacer la extension gratis

Tareas:

1. definir monorepo o repo separado para web app
2. crear org/proyecto Supabase
3. auth
4. tablas de usuarios, estudios, membresias, eventos
5. sync opcional de marcadores/monitores
6. billing
7. panel web base

Dependencias:

- solo empieza cuando la free v1 este estable

Estimacion:

- 80 a 160 horas

## 8. Backlog inicial ejecutable en este repo

Orden recomendado de arranque:

### Ticket P0-01

Titulo:

`docs: alinear README, manual y assets de release al estado real del producto`

Incluye:

- README
- manual
- release assets
- roadmap

### Ticket P0-02

Titulo:

`ui: definir action bar comun para portales`

Incluye:

- spec de botones
- orden
- estados
- estilos

### Ticket P0-03

Titulo:

`refactor: extraer UI compartida para content scripts`

Incluye:

- modulo reusable para action bar
- overlays y modales compartidos

### Ticket P0-04

Titulo:

`scba: corregir y clarificar frecuencia real de monitoreo`

Incluye:

- codigo
- docs
- UX

### Ticket P0-05

Titulo:

`scba: consolidar importacion desde notificaciones.scba.gov.ar`

Estado:

- diferido fuera de v0.6.1
- reservado para una etapa futura de gestion avanzada porque usa otro login y puede no coincidir temporalmente con MEV

Incluye:

- edge cases
- UX de importacion
- mensajes

### Ticket P0-06

Titulo:

`mev: importar expedientes desde resultados y sets de busqueda`

Estado:

- resuelto en v0.6.1
- pendiente de QA manual en portal real

### Ticket P0-07

Titulo:

`pjn: importar favoritos/listados al sidepanel`

Estado:

- replanificado para v0.9.0

### Ticket P0-08

Titulo:

`feature: vista movimientos desde fecha`

Estado:

- resuelto para causas MEV monitoreadas en v0.6.1
- pendiente de QA manual en portal real

### Ticket P0-09

Titulo:

`refactor: dividir sidepanel App en modulos`

### Ticket P0-10

Titulo:

`refactor: dividir message-router por dominios`

### Ticket P0-11

Titulo:

`ops: agregar modo diagnostico y export de soporte`

### Ticket P0-12

Titulo:

`store: actualizar descripcion, capturas y claims de Chrome Web Store`

Estado:

- materiales y capturas preparados para v0.6.1
- pendiente envio manual al dashboard de Chrome Web Store

## 9. Lo que yo arrancaria primero

Si se busca el mejor retorno inmediato, el orden seria:

1. `P0-01 docs y claims`
2. `P0-02 action bar comun`
3. `P0-03 extraer UI compartida`
4. `P0-08 movimientos desde fecha`
5. `P0-12 Store y claims publicos`

Motivo:

- mejora percepcion ya
- baja deuda visible
- ordena el producto gratis
- habilita feedback real de colegas

## 10. Caja real estimada para la etapa gratis

Si se hace sin equipo externo y sin backend pago todavia:

- GitHub: USD 0
- Chrome Web Store: ya resuelto si la extension ya esta publicada
- dominio/landing opcional: USD 0 a 20 por mes
- herramientas varias: USD 0 a 30 por mes

Total razonable:

- USD 0 a 50 por mes

## 11. Caja real estimada cuando arranque la capa paga

- Supabase Pro: desde USD 25 por mes como punto de partida
- mail/transaccional/otros: USD 0 a 30 por mes al inicio
- dominio y hosting web: USD 10 a 40 por mes

Total razonable inicial:

- USD 35 a 100 por mes

Esto no incluye trabajo humano.

## 12. No hacer todavia

- ERP juridico completo
- app mobile nativa
- portal de clientes
- firma automatica ciega en PyNE
- escritos "magicos" sin control
- demasiados portales nuevos

## 13. Resultado esperado

Si se sigue este plan:

- ProcuAsist gratis queda fuerte, confiable y util de verdad
- gana usuarios y reputacion entre colegas
- genera una base legitima para despues lanzar una capa paga mucho mas potente
- evita meter backend, billing e IA antes de tiempo
