-- ProcuEstudio - esquema inicial v1
-- Borrador para Postgres/Supabase. No ejecutar sin revisar RLS, auth y nombres finales.

create extension if not exists "pgcrypto";

create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key,
  email text not null unique,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  role text not null check (role in ('admin', 'lawyer', 'collaborator')),
  created_at timestamptz not null default now(),
  unique (workspace_id, profile_id)
);

create table clients (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  display_name text not null,
  legal_name text,
  document_number text,
  email text,
  phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table courts (
  id uuid primary key default gen_random_uuid(),
  jurisdiction text not null,
  portal text not null,
  name text not null,
  code text,
  venue text,
  created_at timestamptz not null default now()
);

create table cases (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  client_id uuid references clients(id) on delete set null,
  court_id uuid references courts(id) on delete set null,
  portal text not null,
  jurisdiction text not null,
  external_id text,
  case_number text,
  case_year text,
  normalized_number text,
  caption text not null,
  matter text,
  status text,
  origin_url text,
  started_at date,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, portal, jurisdiction, external_id),
  unique (workspace_id, portal, jurisdiction, normalized_number, court_id)
);

create table case_parties (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  role text not null check (role in ('actor', 'defendant', 'third_party', 'other')),
  name text not null,
  document_number text,
  address text,
  confirmed boolean not null default false,
  source_snapshot_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table lawyers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  full_name text not null,
  bar_registration text,
  email text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table case_lawyers (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  lawyer_id uuid not null references lawyers(id) on delete cascade,
  role text,
  confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  unique (case_id, lawyer_id)
);

create table source_snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  case_id uuid references cases(id) on delete set null,
  schema_version text not null,
  source_app text not null,
  source_version text,
  portal text not null,
  jurisdiction text not null,
  origin_url text,
  captured_at timestamptz not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

alter table case_parties
  add constraint case_parties_source_snapshot_id_fkey
  foreign key (source_snapshot_id) references source_snapshots(id) on delete set null;

create table movements (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  source_snapshot_id uuid references source_snapshots(id) on delete set null,
  external_id text,
  movement_date date,
  title text,
  description text,
  full_text text,
  folio text,
  signed_by jsonb not null default '[]'::jsonb,
  content_hash text,
  created_at timestamptz not null default now(),
  unique (case_id, external_id),
  unique (case_id, movement_date, content_hash)
);

create table documents (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  movement_id uuid references movements(id) on delete set null,
  source_snapshot_id uuid references source_snapshots(id) on delete set null,
  external_id text,
  title text not null,
  mime_type text,
  remote_url text,
  storage_path text,
  storage_mode text not null default 'remote-reference'
    check (storage_mode in ('remote-reference', 'uploaded', 'generated')),
  sha256 text,
  captured_at timestamptz,
  created_at timestamptz not null default now(),
  unique (case_id, external_id),
  unique (case_id, sha256)
);

create table field_suggestions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  case_id uuid not null references cases(id) on delete cascade,
  source_snapshot_id uuid references source_snapshots(id) on delete set null,
  field_path text not null,
  suggested_value text not null,
  confidence numeric(4, 3) not null check (confidence >= 0 and confidence <= 1),
  reason text not null,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected', 'superseded')),
  decided_by uuid references profiles(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  case_id uuid references cases(id) on delete cascade,
  assigned_to uuid references profiles(id) on delete set null,
  title text not null,
  description text,
  status text not null default 'open'
    check (status in ('open', 'done', 'cancelled')),
  due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table deadlines (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  case_id uuid not null references cases(id) on delete cascade,
  title text not null,
  due_date date not null,
  status text not null default 'pending'
    check (status in ('pending', 'met', 'cancelled')),
  source text not null default 'manual'
    check (source in ('manual', 'suggested', 'imported')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table sync_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  case_id uuid references cases(id) on delete set null,
  source_snapshot_id uuid references source_snapshots(id) on delete set null,
  status text not null check (status in ('success', 'partial', 'failed')),
  stats jsonb not null default '{}'::jsonb,
  error_code text,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index cases_workspace_updated_idx on cases(workspace_id, updated_at desc);
create unique index courts_unique_idx on courts(jurisdiction, portal, name, coalesce(code, ''));
create index movements_case_date_idx on movements(case_id, movement_date desc);
create index documents_case_idx on documents(case_id);
create index field_suggestions_case_status_idx on field_suggestions(case_id, status);
create index tasks_workspace_status_due_idx on tasks(workspace_id, status, due_at);
create index deadlines_workspace_due_idx on deadlines(workspace_id, due_date);
