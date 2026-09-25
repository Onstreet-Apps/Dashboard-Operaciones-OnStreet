-- ============================================================================
-- On Street — Supabase, paso 2: RPCs de Alta / Baja de Móvil
-- ============================================================================
-- Ejecutar DESPUÉS de schema.sql. Estas funciones son las que Apps Script
-- llama desde altaMovil() / bajaMovil() en Código.js, vía
-- POST /rest/v1/rpc/alta_movil y /rest/v1/rpc/baja_movil.
--
-- Cada una hace sus dos escrituras (moviles + movil_periodos_operacion) en
-- una sola transacción: si algo falla a mitad de camino, Postgres deshace
-- todo — no puede quedar un móvil dado de alta en "moviles" sin su período
-- de operación, que era justo el riesgo que teníamos con Flota/Base sueltas.

create or replace function alta_movil(
  p_cliente text,
  p_movil text,
  p_sucursal text,
  p_kam text,
  p_conductor text,
  p_fecha_inicio date
)
returns moviles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_movil moviles;
begin
  insert into moviles (cliente, movil, sucursal, kam, conductor_actual)
  values (p_cliente, p_movil, nullif(p_sucursal, ''), nullif(p_kam, ''), nullif(p_conductor, ''))
  returning * into v_movil;

  insert into movil_periodos_operacion (movil_id, fecha_inicio)
  values (v_movil.id, p_fecha_inicio);

  return v_movil;
end;
$$;

create or replace function baja_movil(
  p_movil_id uuid,
  p_fecha_termino date
)
returns moviles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_movil moviles;
begin
  update movil_periodos_operacion
  set fecha_termino = p_fecha_termino
  where movil_id = p_movil_id
    and fecha_termino is null;

  update moviles
  set estado = 'dado_de_baja'
  where id = p_movil_id
  returning * into v_movil;

  if v_movil.id is null then
    raise exception 'Móvil no encontrado: %', p_movil_id;
  end if;

  return v_movil;
end;
$$;

-- Por defecto Postgres deja estas funciones ejecutables por CUALQUIER rol
-- (incluida "anon", la que usa la publishable key que sí queda expuesta en
-- el navegador). Como estas dos escriben datos, solo la service role
-- (la que usa Apps Script) puede llamarlas.
revoke execute on function alta_movil(text, text, text, text, text, date) from public;
revoke execute on function baja_movil(uuid, date) from public;
grant execute on function alta_movil(text, text, text, text, text, date) to service_role;
grant execute on function baja_movil(uuid, date) to service_role;
