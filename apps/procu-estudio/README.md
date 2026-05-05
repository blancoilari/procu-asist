# ProcuEstudio

App web para convertir causas importadas desde ProcuAsist en gestion diaria del estudio juridico.

## Estado

Este es el esqueleto inicial del producto premium:

- dashboard operativo
- listado de causas
- detalle de causa con timeline
- contrato TypeScript para `case-snapshot.v1`
- endpoint `POST /api/imports/procuasist/case-snapshot`
- modo demo sin base real

## Instalacion

```bash
cd apps/procu-estudio
npm install
cp .env.example .env.local
npm run dev
```

## Endpoint de importacion

```txt
POST /api/imports/procuasist/case-snapshot
```

Mientras `PROCU_ESTUDIO_DEMO_MODE=true`, el endpoint valida el payload y devuelve una respuesta simulada. Cuando se conecte Supabase, debe persistir:

- `source_snapshots`
- `cases`
- `movements`
- `documents`
- `field_suggestions`
- `sync_runs`

Contrato completo: `../../docs/plans/procu-estudio-sync-contract.md`.

Schema inicial: `../../docs/plans/procu-estudio-schema-v1.sql`.
