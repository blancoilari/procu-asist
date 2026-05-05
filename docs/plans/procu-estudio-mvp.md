# ProcuEstudio - MVP de gestion judicial asistida

Ultima actualizacion: 2026-05-02

## 1. Tesis del producto

ProcuEstudio no debe competir como "otro sistema de gestion juridica" que obliga al abogado a cargar todo de cero.

La promesa inicial es:

> El estudio se arma desde los portales judiciales. El abogado revisa, confirma y completa lo minimo.

El diferencial frente a sistemas tradicionales es que ProcuAsist ya conoce MEV, PJN y EJE desde adentro del flujo real de trabajo. La extension debe funcionar como conector judicial; la app web debe convertir esa informacion en gestion diaria.

## 2. Usuario objetivo inicial

Estudios chicos y medianos de Argentina, especialmente con carga fuerte en:

- SCBA / MEV
- PJN / SCW
- eventualmente SCBA PyNE

Perfil ideal para la beta:

- 1 a 5 abogados
- sin sistema de gestion sofisticado o con planillas dispersas
- dolor fuerte por revisar portales, cargar causas y avisar novedades a clientes
- tolerancia a una beta si el ahorro de carga manual es evidente

## 3. Problema principal

Cuando aparece un sistema nuevo, el abogado no quiere cargar:

- ficha de la causa
- actor
- demandado
- materia
- juzgado
- abogados intervinientes
- datos de matricula
- domicilios
- movimientos historicos
- escritos y presentaciones
- documentos

Ese trabajo de carga inicial mata la adopcion.

ProcuEstudio debe resolverlo con importacion asistida desde los portales y desde documentos ya existentes.

## 4. Producto minimo vendible

La beta no debe intentar ser un ERP juridico completo.

Debe demostrar una cosa muy fuerte:

> Abri una causa real, importala desde ProcuAsist y mirala convertida en expediente vivo dentro del estudio.

### 4.1 Funciones P0

- Autenticacion de usuarios.
- Workspace por estudio.
- Roles simples: administrador, abogado, colaborador.
- Listado de causas.
- Ficha de causa importada desde ProcuAsist.
- Movimientos de la causa.
- Documentos asociados.
- Clientes vinculados a causas.
- Partes detectadas como sugerencias.
- Tareas manuales.
- Vencimientos manuales.
- Bandeja diaria con novedades y tareas.
- Historial de fuentes por dato importado.

### 4.2 Funciones P1

- Digest diario/semanal para el abogado.
- Resumen para cliente.
- Portal cliente basico.
- Busqueda global.
- Export PDF/Excel.
- Etiquetas y estados internos.
- Auditoria de cambios.

### 4.3 Fuera de alcance inicial

- Facturacion completa.
- Contabilidad.
- Firma automatica.
- Presentacion automatica sin revision humana.
- App mobile nativa.
- Multiples jurisdicciones nuevas.
- Migracion masiva desde todos los sistemas competidores.
- IA que tome decisiones juridicas sin citas ni supervision.

## 5. Flujo principal de importacion

1. El abogado navega una causa en MEV o PJN.
2. ProcuAsist detecta datos visibles del portal.
3. El abogado hace click en "Enviar a ProcuEstudio".
4. La extension arma un paquete estructurado con:
   - datos normalizados
   - movimientos
   - documentos detectados
   - URL de origen
   - fecha de captura
   - portal y jurisdiccion
5. La app web recibe el paquete.
6. Si la causa no existe, la crea.
7. Si existe, agrega movimientos/documentos nuevos y actualiza datos no conflictivos.
8. Los datos inciertos quedan como sugerencias.
9. El abogado confirma, corrige o descarta sugerencias.

## 6. Principio de confianza

Cada dato automatico debe tener trazabilidad.

Ejemplo:

- Actor probable: "Juan Perez"
- Confianza: 0.72
- Fuente: caratula MEV capturada el 2026-05-02
- Estado: pendiente de confirmacion

Reglas:

- No sobrescribir datos confirmados por humanos sin aviso.
- No mezclar datos de fuentes distintas sin guardar origen.
- No ocultar incertidumbre.
- Preferir "dato sugerido" antes que "dato falso con seguridad".

## 7. Datos a extraer primero

### 7.1 Desde ficha/listado de causa

- portal
- jurisdiccion
- numero de expediente
- caratula
- organismo/juzgado
- estado si esta disponible
- URL de origen
- fecha de captura

### 7.2 Desde movimientos

- fecha
- titulo/tramite
- descripcion/texto
- fojas si existen
- firmantes si existen
- documentos asociados
- identificador tecnico si el portal lo expone

### 7.3 Desde caratula y texto

Como sugerencias, no como verdad final:

- actor
- demandado
- materia
- letrados mencionados
- matriculas
- domicilios
- tipo de proceso

### 7.4 Desde documentos/presentaciones

Etapa posterior:

- datos de abogado firmante
- matricula
- domicilio constituido
- domicilio electronico
- objeto de la presentacion
- adjuntos
- posibles plazos mencionados

## 8. Modelo de datos inicial

Entidades minimas:

- `workspaces`: estudios juridicos.
- `profiles`: usuarios.
- `workspace_members`: pertenencia y rol.
- `clients`: clientes del estudio.
- `cases`: causas.
- `case_parties`: partes de una causa.
- `lawyers`: abogados detectados o cargados.
- `courts`: organismos/juzgados normalizados.
- `movements`: movimientos procesales.
- `documents`: documentos y adjuntos.
- `tasks`: tareas internas.
- `deadlines`: vencimientos.
- `source_snapshots`: capturas estructuradas recibidas desde ProcuAsist.
- `field_suggestions`: datos detectados pendientes de confirmacion.
- `sync_runs`: ejecuciones de sincronizacion.

Borrador SQL inicial:

- [procu-estudio-schema-v1.sql](procu-estudio-schema-v1.sql)

## 9. Primer hito tecnico

Hito 1:

> Importar una causa real desde ProcuAsist hacia la app web y verla creada automaticamente.

Incluye:

- app nueva en `apps/procu-estudio` como primer scaffold separable
- app web base
- auth
- tabla de causas
- endpoint de ingesta
- boton experimental en ProcuAsist
- pantalla de detalle de causa
- timeline basico de movimientos

Estado inicial:

- scaffold creado en `apps/procu-estudio`
- dashboard demo
- listado y detalle de causas demo
- endpoint `POST /api/imports/procuasist/case-snapshot`
- validador TypeScript de `case-snapshot.v1`
- pendiente conectar Supabase y agregar autenticacion real

No incluye:

- portal cliente
- IA
- billing
- Docker
- migraciones desde otros sistemas

## 10. Estimacion de calendario

### Semana 1 - Definicion y cimientos

- cerrar alcance MVP
- definir modelo de datos
- definir contrato de sincronizacion
- crear repo/app
- configurar auth y base

### Semana 2 - Primera importacion

- endpoint de ingesta
- pantalla de causas
- pantalla de detalle
- boton experimental en extension
- importar causa real con datos basicos

### Semanas 3 y 4 - Expediente vivo

- movimientos
- documentos
- sugerencias de partes
- fuentes por dato
- deduplicacion de causas y movimientos

### Semanas 5 y 6 - Uso diario

- tareas
- vencimientos
- bandeja diaria
- filtros
- busqueda

### Semanas 7 y 8 - Beta cerrada

- seguridad basica
- auditoria minima
- export de soporte
- onboard de 2 a 5 estudios amigos
- ajustes segun uso real

## 11. Estimacion economica

### Caja inicial

Si se hace como SaaS simple:

- dominio: USD 10 a 25 por anio
- Supabase/Vercel o equivalente: USD 50 a 150 por mes al iniciar
- IA: USD 20 a 200 por mes cuando se active
- email transaccional: USD 0 a 30 por mes al iniciar

### Construccion in-house

La caja es baja, pero el costo real es tiempo.

Estimacion:

- beta funcional: 160 a 280 horas
- v1 comercial chica: 450 a 800 horas
- plataforma madura: 1200+ horas

### Construccion tercerizada

Referencia:

- beta: USD 20k a 45k
- v1 comercial: USD 60k a 120k
- plataforma madura: USD 150k+

## 12. Criterios de exito de la beta

La beta vale la pena si logra:

- importar una causa sin carga manual pesada
- ahorrar tiempo real en alta de expedientes
- mostrar novedades en una bandeja diaria usable
- permitir que el abogado corrija datos con poca friccion
- evitar que el sistema parezca una obligacion administrativa nueva
- generar voluntad de pago en al menos algunos estudios piloto

## 13. Riesgos

- Portales judiciales cambian estructura.
- Datos de partes no siempre estan claramente disponibles.
- Caratulas pueden ser ambiguas.
- Documentos PDF pueden tener OCR malo o formatos variables.
- Sync mal explicado puede generar miedo por privacidad.
- Si la app pide demasiada carga manual, pierde el diferencial.

## 14. Decisiones recomendadas

- Mantener ProcuAsist gratis como producto independiente.
- Crear ProcuEstudio como app nueva.
- Empezar SaaS, dejar Docker para etapa premium/private install.
- No subir credenciales judiciales al backend en la primera version.
- No usar IA hasta tener flujo de importacion y fuentes bien resueltos.
- Disenar todo alrededor de "confirmar sugerencias", no "llenar formularios".
