-- ============================================================================
-- On Street — Schema Supabase, migración #1: Flota / Base
-- ============================================================================
-- Reemplaza las pestañas "Flota" y "Base" (hoy desincronizadas, editadas a
-- mano por separado) por una sola fuente de verdad. Ejecutar en el SQL
-- Editor de Supabase cuando el proyecto esté creado.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- updated_at automático en cualquier tabla que lo tenga
-- ---------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- moviles — reemplaza la pestaña "Flota" (foto actual del vehículo)
-- ---------------------------------------------------------------------------
create table moviles (
  id uuid primary key default gen_random_uuid(),
  cliente text not null,
  movil text not null,                    -- patente / notación
  sucursal text,
  kam text,
  conductor_actual text,
  estado text not null default 'activo'
    check (estado in ('activo', 'pausado', 'dado_de_baja')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cliente, movil)
);

create trigger moviles_set_updated_at
  before update on moviles
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- movil_periodos_operacion — reemplaza la pestaña "Base" (fechas de alta/baja)
-- A diferencia de "Base" (columnas fijas Periodo 1 / Periodo 2), acá se
-- puede tener cualquier cantidad de períodos por móvil.
-- ---------------------------------------------------------------------------
create table movil_periodos_operacion (
  id uuid primary key default gen_random_uuid(),
  movil_id uuid not null references moviles(id) on delete cascade,
  fecha_inicio date not null,
  fecha_termino date,                     -- null = sigue operando
  created_at timestamptz not null default now(),
  constraint periodo_valido check (fecha_termino is null or fecha_termino >= fecha_inicio)
);

create index idx_periodos_movil_fecha
  on movil_periodos_operacion (movil_id, fecha_inicio desc);

-- Función helper: ¿este móvil debería estar operando en tal fecha?
-- Esto es lo que hoy NO existe en Código.js (readUnificador cuenta todo
-- móvil de Flota como "esperado" sin mirar fecha de inicio) — con esta
-- función el dashboard puede filtrar correctamente los "próximos a operar".
create or replace function movil_operativo_en(p_movil_id uuid, p_fecha date)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from movil_periodos_operacion
    where movil_id = p_movil_id
      and fecha_inicio <= p_fecha
      and (fecha_termino is null or fecha_termino >= p_fecha)
  );
$$;

-- ---------------------------------------------------------------------------
-- cambios_titular — reemplaza la pestaña "Cambios de Titular" (auditoría)
-- ---------------------------------------------------------------------------
create table cambios_titular (
  id uuid primary key default gen_random_uuid(),
  movil_id uuid not null references moviles(id) on delete cascade,
  titular_anterior text,
  titular_nuevo text not null,
  rutas_racha int,
  desde date,
  confirmado_por text,
  created_at timestamptz not null default now()
);

create index idx_cambios_titular_movil
  on cambios_titular (movil_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security — habilitado en todo, política mínima por ahora.
-- Se afina cuando migremos Usuarios (paso 2) y tengamos roles reales
-- (auth.uid() -> usuarios_perfil.rol). Por ahora: cualquier usuario
-- autenticado puede leer; escribir queda reservado a la service role
-- (o sea, solo desde Apps Script / backend, nunca desde el navegador).
-- ---------------------------------------------------------------------------
alter table moviles enable row level security;
alter table movil_periodos_operacion enable row level security;
alter table cambios_titular enable row level security;

create policy moviles_select_authenticated
  on moviles for select
  to authenticated
  using (true);

create policy periodos_select_authenticated
  on movil_periodos_operacion for select
  to authenticated
  using (true);

create policy cambios_titular_select_authenticated
  on cambios_titular for select
  to authenticated
  using (true);

-- Sin políticas de insert/update/delete para "authenticated": solo la
-- service role (usada desde Apps Script) puede escribir, hasta que
-- definamos roles reales en el paso 2 (Usuarios).
