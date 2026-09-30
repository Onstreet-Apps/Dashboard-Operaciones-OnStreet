-- ============================================================================
-- On Street — Supabase, migración #3: rutas_finalizadas
-- ============================================================================
-- Reemplaza la pestaña "Finalizados" (planilla que hoy pesa 442KB / 12s de
-- lectura en cada request porque Apps Script trae TODA la hoja histórica y
-- filtra en JavaScript). En Postgres, filtrar por fecha usa el índice y es
-- prácticamente instantáneo, sin importar cuánto historial se acumule.

create table rutas_finalizadas (
  id uuid primary key default gen_random_uuid(),
  id_item text,                    -- ID / Id Item original (de Inicio de Ruta), si existía
  fecha date not null,
  cliente text not null,
  movil text not null,             -- "Notacion" en la planilla original
  conductor text,
  region text,
  comuna text,
  lugar_atencion text,
  hora_inicio text,                -- se guarda como texto "HH:MM" igual que hoy (formatTime)
  hora_termino text,
  created_at timestamptz not null default now()
);

create index idx_rutas_finalizadas_fecha on rutas_finalizadas (fecha desc);
create index idx_rutas_finalizadas_movil on rutas_finalizadas (cliente, movil, fecha desc);

alter table rutas_finalizadas enable row level security;

create policy rutas_finalizadas_select_authenticated
  on rutas_finalizadas for select
  to authenticated
  using (true);

-- Sin políticas de insert/update/delete para "authenticated": solo la
-- service role (Apps Script) escribe acá, igual que en moviles/periodos.
