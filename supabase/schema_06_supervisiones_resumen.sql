-- ============================================================================
-- On Street — Supabase, migración #6: supervisiones_resumen
-- ============================================================================
-- Reemplaza la lectura en vivo de "Resumen Supervisiones 2026" + "BBDD
-- Supervisiones" (spreadsheet de Supervisiones). A diferencia de las otras
-- migraciones, acá no se copian filas crudas: sincronizarSupervisionesASupabase()
-- (en Código.js) hace, cada 15 min, TODO el trabajo que antes hacía
-- readSupervisiones() en cada doGet — el matching difuso contra Flota y el
-- recálculo de meses desde los eventos crudos de "BBDD Supervisiones" — y
-- guarda acá el resultado ya resuelto. readSupervisiones() queda como una
-- simple lectura de esta tabla.
--
-- Se borra y reinserta en cada corrida: la tabla entera se recalcula desde
-- cero a partir de las hojas, así que nunca queda a medio actualizar.

create table supervisiones_resumen (
  id uuid primary key default gen_random_uuid(),
  cliente text not null,
  movil text not null,
  nombre text,
  meta numeric not null default 0,
  meses jsonb not null default '{}'::jsonb,   -- {"enero": 2, "febrero": 1, ...}
  total int not null default 0,
  meses_sup int not null default 0,
  pct_movil numeric not null default 0,
  created_at timestamptz not null default now()
);

create index idx_supervisiones_resumen_cliente_movil on supervisiones_resumen (cliente, movil);

alter table supervisiones_resumen enable row level security;

create policy supervisiones_resumen_select_authenticated
  on supervisiones_resumen for select
  to authenticated
  using (true);

-- Sin políticas de insert/update/delete para "authenticated": solo la
-- service role (Apps Script) escribe acá.
