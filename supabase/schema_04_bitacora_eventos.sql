-- ============================================================================
-- On Street — Supabase, migración #4: bitacora_eventos
-- ============================================================================
-- Reemplaza la lectura de la pestaña "BBDD Bitácora" (165KB / no cabe en
-- caché, se recalcula siempre). A diferencia de Finalizados, esta planilla
-- la llena Zapier (Monday → Zapier → Sheets), no Apps Script — así que la
-- planilla sigue existiendo igual que hoy; lo que cambia es que un trigger
-- de Apps Script (sincronizarBitacoraASupabase, en Código.js) copia las
-- filas nuevas hacia acá periódicamente, y el dashboard lee de aquí.

create table bitacora_eventos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  mes int,
  anio int,
  cliente text,
  sucursal text,
  conductor text,
  responsable text,
  tipo text,                -- puede traer varios separados por coma, ej "Contingencia, Atraso"
  detalle text,
  kam text,
  created_at timestamptz not null default now()
);

create index idx_bitacora_fecha on bitacora_eventos (fecha desc);

alter table bitacora_eventos enable row level security;

create policy bitacora_eventos_select_authenticated
  on bitacora_eventos for select
  to authenticated
  using (true);

-- Sin políticas de insert/update/delete para "authenticated": solo la
-- service role (Apps Script) escribe acá.

-- ---------------------------------------------------------------------------
-- RPC: conteo de eventos "Contingencia" por mes, sobre TODO el histórico.
-- Es la única parte de readBitacora() que necesita ver más allá de la
-- ventana de 1-2 años — agregarlo en Postgres es instantáneo aunque el
-- histórico crezca por años, a diferencia de recorrerlo en Apps Script.
-- ---------------------------------------------------------------------------
create or replace function contingencias_por_mes()
returns table(mes text, total bigint)
language sql
stable
as $$
  select to_char(fecha, 'YYYY-MM') as mes, count(*) as total
  from bitacora_eventos
  where 'Contingencia' = any(regexp_split_to_array(trim(tipo), '\s*,\s*'))
  group by 1
  order by 1;
$$;

revoke execute on function contingencias_por_mes() from public;
grant execute on function contingencias_por_mes() to service_role;
