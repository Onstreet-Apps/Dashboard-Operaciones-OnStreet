-- ============================================================================
-- On Street — Supabase, migración #5: calendario_planificado
-- ============================================================================
-- Reemplaza la lectura en vivo de "CalendarioTransformado" (spreadsheet
-- Informes GPS), usada tanto por readSegundaRuta() como por la Fase 1 de
-- readPerdidaRutaData(). Sin columna única: el sheet no garantiza una sola
-- fila por móvil+fecha, así que sincronizarCalendarioASupabase() (en
-- Código.js) borra todo y vuelve a insertar en cada corrida — barato, es un
-- calendario de planificación, no un histórico que crece sin límite.

create table calendario_planificado (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  movil text not null,               -- nombre completo tal como aparece en la columna "Móvil" del calendario
  horario_inicio_1 text,
  horario_fin_1 text,
  horario_inicio_2 text,
  horario_fin_2 text,
  created_at timestamptz not null default now()
);

create index idx_calendario_planificado_fecha on calendario_planificado (fecha);
create index idx_calendario_planificado_movil_fecha on calendario_planificado (movil, fecha);

alter table calendario_planificado enable row level security;

create policy calendario_planificado_select_authenticated
  on calendario_planificado for select
  to authenticated
  using (true);

-- Sin políticas de insert/update/delete para "authenticated": solo la
-- service role (Apps Script) escribe acá.
