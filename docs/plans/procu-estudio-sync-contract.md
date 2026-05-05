# ProcuEstudio - contrato inicial de sincronizacion

Ultima actualizacion: 2026-05-02

Este documento define el primer contrato entre la extension ProcuAsist y la futura app web ProcuEstudio.

Objetivo:

> Enviar una captura estructurada de una causa judicial desde el navegador del abogado hacia la app web, sin exigir carga manual pesada.

## 1. Principios

- La extension sigue siendo el conector judicial.
- La app web no necesita credenciales judiciales en la primera etapa.
- La sincronizacion ocurre por accion explicita del usuario.
- Cada dato importado conserva fuente y fecha.
- Los datos inciertos se guardan como sugerencias.
- La app debe ser idempotente: reenviar la misma causa no debe duplicar todo.

## 2. Endpoint inicial

Propuesta:

```txt
POST /api/imports/procuasist/case-snapshot
```

Autenticacion:

- usuario logueado en ProcuEstudio
- token de sesion web o token de dispositivo emitido por la app
- workspace seleccionado por el usuario

Headers sugeridos:

```txt
Authorization: Bearer <token>
Content-Type: application/json
X-ProcuAsist-Version: 0.6.x
X-ProcuAsist-Source: chrome-extension
```

## 3. Payload v1

```json
{
  "schemaVersion": "case-snapshot.v1",
  "capturedAt": "2026-05-02T15:00:00.000Z",
  "source": {
    "app": "procu-asist",
    "extensionVersion": "0.6.2",
    "portal": "mev",
    "jurisdiction": "scba",
    "originUrl": "https://mev.scba.gov.ar/...",
    "captureMode": "manual"
  },
  "case": {
    "externalId": "mev:scba:12345-2026",
    "caseNumber": "12345",
    "caseYear": "2026",
    "normalizedNumber": "12345-2026",
    "caption": "PEREZ JUAN C/ GOMEZ ANA S/ DANOS Y PERJUICIOS",
    "courtName": "Juzgado Civil y Comercial Nro. 1",
    "courtCode": null,
    "venue": "La Plata",
    "matter": null,
    "status": null,
    "startedAt": null
  },
  "movements": [
    {
      "externalId": "mev:movement:abc123",
      "date": "2026-04-30",
      "title": "PROVEIDO",
      "description": "Tengase presente...",
      "fullText": "Tengase presente lo manifestado...",
      "folio": null,
      "signedBy": [],
      "documentRefs": [
        {
          "externalId": "mev:doc:def456",
          "title": "proveido.pdf",
          "url": "https://docs.scba.gov.ar/...",
          "mimeType": "application/pdf",
          "sha256": null
        }
      ]
    }
  ],
  "documents": [
    {
      "externalId": "mev:doc:def456",
      "title": "proveido.pdf",
      "url": "https://docs.scba.gov.ar/...",
      "mimeType": "application/pdf",
      "capturedAt": "2026-05-02T15:00:00.000Z",
      "storageMode": "remote-reference"
    }
  ],
  "suggestions": [
    {
      "field": "party.actor.name",
      "value": "PEREZ JUAN",
      "confidence": 0.72,
      "sourcePath": "case.caption",
      "reason": "parsed_from_caption",
      "status": "pending"
    },
    {
      "field": "party.defendant.name",
      "value": "GOMEZ ANA",
      "confidence": 0.72,
      "sourcePath": "case.caption",
      "reason": "parsed_from_caption",
      "status": "pending"
    },
    {
      "field": "case.matter",
      "value": "DANOS Y PERJUICIOS",
      "confidence": 0.68,
      "sourcePath": "case.caption",
      "reason": "parsed_from_caption",
      "status": "pending"
    }
  ],
  "raw": {
    "portalPayload": null,
    "htmlSnapshotStored": false
  }
}
```

## 4. Campos obligatorios

Minimo para crear causa:

- `schemaVersion`
- `capturedAt`
- `source.portal`
- `source.jurisdiction`
- `source.originUrl`
- `case.normalizedNumber` o `case.externalId`
- `case.caption`

Minimo para crear movimiento:

- `date`
- `title` o `description`

## 5. Idempotencia y deduplicacion

La app debe deduplicar por prioridad:

1. `case.externalId`
2. combinacion `portal + jurisdiction + normalizedNumber + courtName`
3. combinacion difusa `portal + jurisdiction + caption + courtName`

Movimientos:

1. `movement.externalId`
2. `caseId + date + title + hash(fullText/description)`

Documentos:

1. `document.externalId`
2. `sha256`
3. `caseId + title + url`

## 6. Estados de sugerencias

Estados posibles:

- `pending`
- `accepted`
- `rejected`
- `superseded`

La app no debe convertir sugerencias en datos confirmados sin accion del usuario, salvo reglas muy seguras definidas luego.

## 7. Storage de documentos

Version inicial:

- guardar referencia remota al documento si el portal lo permite
- no descargar ni subir automaticamente todos los PDFs al backend

Version posterior:

- upload explicito de ZIP/PDF generado por ProcuAsist
- extraccion de texto
- OCR si hace falta
- resumen con citas

## 8. Respuesta del endpoint

```json
{
  "ok": true,
  "workspaceId": "wrk_123",
  "caseId": "case_123",
  "created": true,
  "stats": {
    "movementsCreated": 12,
    "movementsSkipped": 0,
    "documentsCreated": 3,
    "suggestionsCreated": 4
  },
  "caseUrl": "https://app.procuestudio.com/cases/case_123"
}
```

Errores esperados:

```json
{
  "ok": false,
  "code": "workspace_required",
  "message": "Selecciona un estudio antes de importar causas."
}
```

Codigos iniciales:

- `unauthorized`
- `workspace_required`
- `invalid_schema`
- `missing_case_identity`
- `portal_not_supported`
- `rate_limited`
- `server_error`

## 9. Seguridad y privacidad

Primera version:

- no enviar usuarios ni contrasenas judiciales
- no enviar tokens PJN/MEV al backend
- no enviar HTML completo por defecto
- no enviar documentos completos sin accion explicita
- registrar auditoria de importacion

Datos sensibles:

- caratulas
- partes
- movimientos
- documentos
- datos de matricula
- domicilios

El usuario debe entender que al sincronizar una causa esos datos pasan del almacenamiento local de ProcuAsist a la nube de ProcuEstudio.

## 10. Cambios necesarios en ProcuAsist

P0 experimental:

- agregar configuracion "Conectar con ProcuEstudio"
- guardar token de sync localmente
- boton "Enviar a ProcuEstudio" en la botonera de causa
- construir `case-snapshot.v1` desde parsers existentes
- mostrar resultado:
  - importada
  - actualizada
  - error con mensaje claro

P1:

- seleccion de workspace
- importacion masiva desde listados
- reintentos
- cola local offline
- historial de sincronizaciones

## 11. Cambios necesarios en ProcuEstudio

P0:

- auth
- workspace
- endpoint de importacion
- tablas de causas, movimientos, documentos y sugerencias
- pantalla de listado de causas
- pantalla de detalle con timeline

P1:

- pantalla de revision de sugerencias
- clientes
- tareas
- vencimientos
- bandeja diaria

