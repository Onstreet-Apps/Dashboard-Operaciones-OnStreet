-- ============================================================================
-- On Street — Supabase, migración #7: gps_estado_actual
-- ============================================================================
-- Reemplaza la lectura en vivo de "Base" (viajes GPS) + "Calendario diario"
-- (alertas, spreadsheet GPS Tiempo Real). A diferencia de las otras
-- migraciones, acá se resuelve TODO en el trigger (igual que Supervisiones):
-- sincronizarGpsASupabase() hace, cada 5 min, lo que antes hacía readGPS() en
-- cada doGet — agrupar por Agrupación, quedarse con el viaje más reciente,
-- matchear contra Flota por fingerprint, y fusionar las alertas — y guarda
-- acá el resultado ya resuelto (una fila por móvil con GPS hoy).
--
-- Es estado del día de hoy, no histórico: se borra y reinserta en cada
-- corrida, así nunca queda una posición vieja mezclada con las nuevas.

create table gps_estado_actual (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  nombre text not null,
  cliente text,
  movil text,
  kam text,
  posicion_lat numeric,
  posicion_lng numeric,
  tipo_alerta text,
  sin_movimiento boolean not null default false,
  alejandose boolean not null default false,
  distancia_metros numeric,
  punto_lat numeric,
  punto_lng numeric,
  atraso_minutos int,
  hora_ultimo text,
  posicion_descripcion text,
  tiene_ruta_calendario boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_gps_estado_actual_fecha on gps_estado_actual (fecha);

alter table gps_estado_actual enable row level security;

create policy gps_estado_actual_select_authenticated
  on gps_estado_actual for select
  to authenticated
  using (true);

-- Sin políticas de insert/update/delete para "authenticated": solo la
-- service role (Apps Script) escribe acá.
