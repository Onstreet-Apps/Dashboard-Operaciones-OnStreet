/**
 * ON STREET — Apps Script v18
 */
// Proyecto conectado con VS Code mediante clasp

const SHEETS = {
  unificador:           '1IzNAVAWVB38YJ1Iy9ZLDhCAJ8xjIDlBbYXI7L9Nc3Sc',
  supervisiones:        '1Ox_gLRbPqVxxuFt2b5lJ5lvPtrXhIy7RNSworQd8Kog',
  bitacora:             '1juemCEa5J9oHyKEWbH0dui2OO6x3sk7qZINqOVedoic',
  finalizados:          '1wNm1No20TkwfZKcC1JtpMdnJ-hA5raWT78C9-hc9C0Y',
  dashboardApi:         '1sr4hSF3GJwdvoOqCSL8lDOUhvt2uPHjiB8vA16VncXw',
  gpsRealTime:          '1r5r9p2byBh15ovWwpgL75FTLUxD6Zlb-HmFtCqPhu3k',
  informesGPS:          '1sbkeem-7PiPpfYsZByzosdrcacsdKQqSYbiQRKuRakY',
  transformCalendarios: '1vtTdj3RSdTNhYPVlpuzQ5bY7_D3aMRFyTiQWlb2oMRI',
  flotaPanel:           '1wcSDazwh82as49Ti1tFKiFdPY1D8od42dxGUHFWFW_A'
};

const SUPERVISIONES_TAB = 'Resumen Supervisiones 2026';
const FINALIZADOS_TAB = 'Finalizados Dashboard'; // pestaña interna en Unificador
const CACHE_DURATION_SECONDS = 300;
const CACHE_GPS_SECONDS = 60;
const CACHE_MAX_BYTES = 95000;
const BITACORA_MONTHS_BACK = 12;
const FINALIZADOS_DAYS_BACK = 30;
const TENDENCIAS_DAYS_BACK = 60;
const KM_DAYS_BACK = 31;

function doGet(e) {
  const params = (e && e.parameter) ? e.parameter : {};
  const source = params.source || null;
  const callback = params.callback || null;

  // Manifest para PWA / Add to Home Screen
  if (source === 'manifest') {
    const url = ScriptApp.getService().getUrl();
    const iconSvg = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'%3E%3Crect width='512' height='512' rx='114' fill='%23E8521A'/%3E%3Ctext x='256' y='338' font-family='system-ui%2C-apple-system%2Csans-serif' font-size='224' font-weight='700' fill='white' text-anchor='middle'%3EOS%3C/text%3E%3C/svg%3E";
    const manifest = {
      name: 'Dashboard On Street',
      short_name: 'Dashboard OS',
      description: 'Operación · Bitácora · Supervisiones · Kilómetros',
      start_url: url,
      id: url,
      scope: url,
      display: 'standalone',
      orientation: 'portrait-primary',
      background_color: '#f7f6f2',
      theme_color: '#E8521A',
      icons: [
        { src: iconSvg, sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        { src: iconSvg, sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' }
      ]
    };
    return ContentService
      .createTextOutput(JSON.stringify(manifest))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // Si NO viene source, muestra el dashboard visual
  if (!source) {
    return HtmlService
      .createHtmlOutputFromFile('Index')
      .setTitle('Dashboard On Street')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  let result;

  const fechaParam = params.fecha || null;
  const fechaSuffix = fechaParam ? fechaParam : 'today';

  try {
    if (source === 'ping') {
      result = {
        ok: true,
        message: 'Apps Script v17 funcionando',
        time: new Date().toISOString(),
        user: Session.getActiveUser().getEmail() || '(sin email)'
      };

    } else if (source === 'login') {
      result = iniciarSesion(params.email || '', params.password || '');

    } else if (source === 'register') {
      result = registrarUsuario(params.nombre || '', params.email || '', params.password || '');

    } else if (source === 'logout') {
      result = cerrarSesion(params.token || null);

    } else if (source === 'reset_request') {
      result = solicitarReset(params.email || '');

    } else if (source === 'reset_confirm') {
      result = confirmarReset(params.token || '', params.password || '');

    } else if (source === 'all') {
      const tokenParam = params.token || null;
      const usuario = verificarToken_(tokenParam);
      if (!usuario) {
        result = { authError: 'token_invalido' };
      } else {
      function safeRead(fn, fallback) {
        try { return fn(); } catch (e) { return fallback !== undefined ? fallback : { error: e.toString() }; }
      }
      const flotaInfo = safeRead(function() { return getCached('flota', readFlota, CACHE_DURATION_SECONDS); }, { flota: [], jefePorMovil: {}, jefePorNombre: {}, kams: [] });

      result = {
        unificador: safeRead(function() { return getCached('unificador_' + fechaSuffix, function() { return readUnificador(flotaInfo, fechaParam); }, CACHE_DURATION_SECONDS); }, null),
        gps:        safeRead(function() { return getCached('gps', function() { return readGPS(flotaInfo); }, CACHE_GPS_SECONDS); }, null),
        historico:  safeRead(function() { return getCached('historico_' + fechaSuffix, function() { return readFinalizados(fechaParam); }, CACHE_DURATION_SECONDS); }, null),
        supervisiones: safeRead(function() { return getCached('supervisiones', function() { return readSupervisiones(flotaInfo); }, CACHE_DURATION_SECONDS); }, null),
        bitacora:   safeRead(function() { return getCached('bitacora_' + fechaSuffix, function() { return readBitacora(fechaParam); }, CACHE_DURATION_SECONDS); }, null),
        segundaRuta: safeRead(function() { return getCached('segunda_ruta_' + fechaSuffix, function() { return readSegundaRuta(fechaParam); }, CACHE_DURATION_SECONDS); }, null),
        // kilómetros se carga bajo demanda vía source=kilometros para no ralentizar la carga inicial
        kams: flotaInfo.kams || [],
        usuario: usuario,
        fechaConsultada: fechaParam || formatDateISO(new Date()),
        lastUpdated: new Date().toISOString()
      };
      }

    } else if (source === 'tab_operacion') {
      result = getTabOperacion({ token: params.token || null, fecha: params.fecha || null });

    } else if (source === 'tab_gps') {
      result = getTabGps({ token: params.token || null });

    } else if (source === 'tab_bitacora') {
      result = getTabBitacora({ token: params.token || null, fecha: params.fecha || null });

    } else if (source === 'tab_supervisiones') {
      result = getTabSupervisiones({ token: params.token || null });

    } else if (source === 'tab_planificacion') {
      result = getTabPlanificacion({ token: params.token || null });

    } else if (source === 'planificacion_add') {
      result = agregarPlanificacionSupervision({
        token: params.token || null,
        fecha: params.fecha || null,
        cliente: params.cliente || null,
        movil: params.movil || null,
        estado: params.estado || null,
        supervisores: params.supervisores || null
      });

    } else if (source === 'planificacion_delete') {
      result = eliminarPlanificacionSupervision({
        token: params.token || null,
        rowIndex: params.rowIndex || null,
        fecha: params.fecha || null,
        movil: params.movil || null
      });

    } else if (source === 'unificador') {
      result = {
        unificador: getCached(
          'unificador_' + fechaSuffix,
          function () {
            return readUnificador(
              getCached('flota', readFlota, CACHE_DURATION_SECONDS),
              fechaParam
            );
          },
          CACHE_DURATION_SECONDS
        ),
        lastUpdated: new Date().toISOString()
      };

    } else if (source === 'gps') {
      result = {
        gps: getCached(
          'gps',
          function () {
            return readGPS(getCached('flota', readFlota, CACHE_DURATION_SECONDS));
          },
          CACHE_GPS_SECONDS
        ),
        lastUpdated: new Date().toISOString()
      };

    } else if (source === 'historico') {
      result = {
        historico: getCached(
          'historico_' + fechaSuffix,
          function () { return readFinalizados(fechaParam); },
          CACHE_DURATION_SECONDS
        ),
        lastUpdated: new Date().toISOString()
      };

    } else if (source === 'supervisiones') {
      result = {
        supervisiones: getCached(
          'supervisiones',
          function () {
            return readSupervisiones(
              getCached('flota', readFlota, CACHE_DURATION_SECONDS)
            );
          },
          CACHE_DURATION_SECONDS
        ),
        lastUpdated: new Date().toISOString()
      };

    } else if (source === 'bitacora') {
      result = {
        bitacora: getCached(
          'bitacora_' + fechaSuffix,
          function () { return readBitacora(fechaParam); },
          CACHE_DURATION_SECONDS
        ),
        lastUpdated: new Date().toISOString()
      };

    } else if (source === 'kilometros') {
      result = {
        kilometros: getCached(
          'kilometros',
          function () {
            return readKilometros(
              getCached('flota', readFlota, CACHE_DURATION_SECONDS)
            );
          },
          CACHE_DURATION_SECONDS
        ),
        lastUpdated: new Date().toISOString()
      };

    } else if (source === 'flotaPanel') {
      result = {
        flotaPanel: getCached('flota_panel', readFlotaPanel, CACHE_DURATION_SECONDS),
        flotaPotenciales: getCached('flota_potenciales', readFlotaClientesPotenciales, CACHE_DURATION_SECONDS),
        lastUpdated: new Date().toISOString()
      };

    } else if (source === 'flota_mes_update') {
      result = actualizarFlotaMes({ token: params.token || null, fila: params.fila || null, mes: params.mes || null, valor: params.valor || '' });

    } else if (source === 'flota_potencial_update') {
      result = actualizarFlotaPotencial({ token: params.token || null, fila: params.fila || null, campo: params.campo || null, valor: params.valor || '' });

    } else if (source === 'flota_potencial_add') {
      result = agregarFlotaPotencial({ token: params.token || null, nombre: params.nombre || '' });

    } else if (source === 'flota_potencial_delete') {
      result = eliminarFlotaPotencial({ token: params.token || null, fila: params.fila || null, nombre: params.nombre || '' });

    } else if (source === 'update_inicio') {
      const rowIdx    = parseInt(e.parameter.rowIdx    || '0', 10);
      const conductor = e.parameter.conductor != null ? String(e.parameter.conductor) : null;
      const comuna    = e.parameter.comuna    != null ? String(e.parameter.comuna)    : null;
      const lugar     = e.parameter.lugar     != null ? String(e.parameter.lugar)     : null;
      result = updateInicioRuta(rowIdx, conductor, comuna, lugar);

    } else if (source === 'update_flota') {
      const cliente   = String(e.parameter.cliente   || '');
      const movil     = String(e.parameter.movil     || '');
      const conductor = String(e.parameter.conductor || '');
      result = updateFlotaConductor(cliente, movil, conductor);

    } else if (source === 'confirmar_titular') {
      var ctUser = params.token ? verificarToken_(params.token) : null;
      result = confirmarTitularDeHecho(
        String(e.parameter.cliente   || ''),
        String(e.parameter.movil     || ''),
        String(e.parameter.conductor || ''),
        String(e.parameter.rutas     || ''),
        String(e.parameter.desde     || ''),
        ctUser ? (ctUser.nombre || ctUser.email || '') : ''
      );

    } else if (source === 'reporte_perdida_ruta') {
      const cliente     = String(e.parameter.cliente     || '');
      const fechaInicio = String(e.parameter.fechaInicio || '');
      const fechaFin    = String(e.parameter.fechaFin    || '');
      result = readPerdidaRutaData(cliente, fechaInicio, fechaFin);

    } else if (source === 'notif_check_planes') {
      const ncToken = params.token || null;
      const ncUser  = verificarToken_(ncToken);
      if (!ncUser || String(ncUser.rol || '').toLowerCase().indexOf('admin') < 0) {
        result = { error: 'token_invalido' };
      } else {
        result = revisarYNotificarPlanesNuevos();
      }

    } else if (source === 'monday_update_plan') {
      const upToken  = params.token || null;
      const upUser   = verificarToken_(upToken);
      if (!upUser) {
        result = { error: 'token_invalido' };
      } else {
        const itemId  = String(params.itemId  || '');
        const colId_  = String(params.colId   || '');
        const newVal  = String(params.value   || '');
        result = updateMondayPlanEstado_(itemId, colId_, newVal);
      }

    } else if (source === 'monday_update_plan_local') {
      const upToken = params.token || null;
      const upUser  = verificarToken_(upToken);
      if (!upUser) {
        result = { error: 'token_invalido' };
      } else {
        const planKey = String(params.planKey || '');
        const newVal  = String(params.value   || '');
        if (!planKey || !newVal) {
          result = { error: 'missing_params' };
        } else {
          PropertiesService.getScriptProperties().setProperty(MONDAY_PLAN_ESTADO_PFX_ + planKey, newVal);
          result = { ok: true };
        }
      }

    } else {
      result = { error: 'source no reconocido' };
    }

  } catch (err) {
    result = {
      error: err.toString(),
      stack: (err.stack || '').slice(0, 800)
    };
  }

  return respond(result, callback);
}

// Callable desde el HTML via google.script.run.getDashboardData(params)
function getDashboardData(params) {
  const token = (params && params.token) || null;
  const usuario = verificarToken_(token);
  if (!usuario) return { authError: 'token_invalido' };

  const fechaParam = (params && params.fecha) || null;
  const fechaSuffix = fechaParam || 'today';
  function safeRead(fn, fallback) {
    try { return fn(); } catch (e) { return (fallback !== undefined) ? fallback : { error: e.toString() }; }
  }
  const flotaInfo = safeRead(function() { return getCached('flota', readFlota, CACHE_DURATION_SECONDS); }, { flota: [], jefePorMovil: {}, jefePorNombre: {}, kams: [] });
  return {
    unificador:   safeRead(function() { return getCached('unificador_'   + fechaSuffix, function() { return readUnificador(flotaInfo, fechaParam); },   CACHE_DURATION_SECONDS); }, null),
    gps:          safeRead(function() { return getCached('gps',                          function() { return readGPS(flotaInfo); },                      CACHE_GPS_SECONDS); },     null),
    historico:    safeRead(function() { return getCached('historico_'    + fechaSuffix, function() { return readFinalizados(fechaParam); },              CACHE_DURATION_SECONDS); }, null),
    supervisiones:safeRead(function() { return getCached('supervisiones',               function() { return readSupervisiones(flotaInfo); },             CACHE_DURATION_SECONDS); }, null),
    bitacora:     safeRead(function() { return getCached('bitacora_'     + fechaSuffix, function() { return readBitacora(fechaParam); },                 CACHE_DURATION_SECONDS); }, null),
    segundaRuta:  safeRead(function() { return getCached('segunda_ruta_' + fechaSuffix, function() { return readSegundaRuta(fechaParam); },              CACHE_DURATION_SECONDS); }, null),
    kams: flotaInfo.kams || [],
    usuario: usuario,
    fechaConsultada: fechaParam || formatDateISO(new Date()),
    lastUpdated: new Date().toISOString()
  };
}

// Callable desde el HTML via google.script.run.getKilometrosData()
function getKilometrosData() {
  function safeRead(fn) { try { return fn(); } catch (e) { return { error: e.toString() }; } }
  const flotaInfo = safeRead(function() { return getCached('flota', readFlota, CACHE_DURATION_SECONDS); });
  return {
    kilometros: safeRead(function() { return getCached('kilometros', function() { return readKilometros(flotaInfo); }, CACHE_DURATION_SECONDS); })
  };
}

// ============================================================================
// LECTOR: PANEL FLOTA (spreadsheet externo "Panel Flota On Street")
// Estructura real (confirmada por captura del sheet): bloques por cliente,
// cada uno con filas de vehículos y, al cierre del bloque, filas "Contrato"
// con datos/subtotales. Columnas: A Cliente, B N°OM, C Nombre Oficina,
// D Marca Modelo, E Año, F Patente, G Formato, H KMs, I..T ENE..DIC.
// Los móviles "Disponibles" y "Reemplazo" están al final del mismo listado,
// bajo los pseudo-clientes "On Street" y "Reemplazo", con el mismo formato.
// ============================================================================
var FLOTA_PANEL_MESES_ = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
var FLOTA_PANEL_COL_ = { cliente:0, om:1, oficina:2, marcaModelo:3, anio:4, patente:5, formato:6, kms:7, mesInicio:8 };
var FLOTA_PANEL_OFICINA_COORDS_ = [
  ['iquique', -20.22, -70.14], ['calama', -22.46, -68.93], ['antofagasta', -23.65, -70.40],
  ['copiapo', -27.37, -70.33], ['la serena', -29.91, -71.25], ['coquimbo', -29.96, -71.34],
  ['mlp', -31.77, -70.96], ['los pelambres', -31.77, -70.96],
  ['quinta cordillera', -32.83, -70.60], ['quillota', -32.88, -71.25], ['quilpue', -33.05, -71.44],
  ['vina del mar', -33.03, -71.55], ['valparaiso', -33.05, -71.63], ['quinta costa', -33.05, -71.63],
  ['lampa', -33.28, -70.87], ['santiago', -33.45, -70.66], ['merced', -33.44, -70.65], ['rm', -33.45, -70.66],
  ['maipu', -33.51, -70.76], ['talagante', -33.66, -70.93], ['san bernardo', -33.59, -70.70],
  ['san antonio', -33.59, -71.61], ['rancagua', -34.17, -70.74], ['o higgins', -34.17, -70.74],
  ['san fernando', -34.58, -70.99], ['curico', -34.98, -71.24], ['talca', -35.43, -71.66],
  ['linares', -35.85, -71.60], ['san carlos', -36.42, -71.96], ['nuble', -36.61, -72.10],
  ['chillan', -36.61, -72.10], ['concepcion', -36.83, -73.05], ['coronel', -37.02, -73.14],
  ['los angeles', -37.46, -72.35], ['temuco', -38.73, -72.60], ['valdivia', -39.82, -73.24],
  ['osorno', -40.57, -73.13], ['puerto montt', -41.47, -72.93], ['pto montt', -41.47, -72.93],
  ['castro', -42.48, -73.76], ['coyhaique', -45.57, -72.07]
];

function normalizarOficinaFlota_(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ñ/g, 'n').replace(/[^a-z0-9]+/g, ' ').trim();
}

function detectarUbicacionOficinaFlota_(oficina, cliente) {
  var n = normalizarOficinaFlota_((cliente || '') + ' ' + (oficina || ''));
  for (var i = 0; i < FLOTA_PANEL_OFICINA_COORDS_.length; i++) {
    var c = FLOTA_PANEL_OFICINA_COORDS_[i];
    if (n.indexOf(c[0]) >= 0) return { lat: c[1], lng: c[2], match: c[0] };
  }
  return null;
}

function parseFlotaKms_(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Math.round(value);

  var s = String(value).trim().replace(/\s/g, '');
  if (!s) return 0;

  if (s.indexOf(',') >= 0) {
    return Math.round(parseFloat(s.replace(/\./g, '').replace(',', '.'))) || 0;
  }

  var parts = s.split('.');
  if (parts.length > 1) {
    var groups = parts.slice(1);
    var looksLikeThousands = parts[0].length <= 3 && groups.every(function(p) { return p.length === 3; });
    if (looksLikeThousands) return parseInt(parts.join(''), 10) || 0;
    return Math.round(parseFloat(s)) || 0;
  }

  return parseInt(s.replace(/[^\d-]/g, ''), 10) || 0;
}

// Busca en una fila el inicio de una sección (por texto de marcador) y
// devuelve su índice de fila, o -1 si no aparece en esa hoja.
function buscarFilaMarcador_(values, textoMarcador) {
  const t = textoMarcador.toLowerCase();
  for (let i = 0; i < values.length; i++) {
    for (let j = 0; j < values[i].length; j++) {
      if (String(values[i][j] || '').trim().toLowerCase().indexOf(t) === 0) return i;
    }
  }
  return -1;
}

function readFlotaPanel() {
  const ss = SpreadsheetApp.openById(SHEETS.flotaPanel);
  const sheet = ss.getSheets()[0];
  const values = sheet.getDataRange().getValues();
  const C = FLOTA_PANEL_COL_;

  // La tabla de vehículos puede venir seguida, en la misma hoja, de secciones
  // con columnas totalmente distintas ("Desglose Flota Total", "Clientes
  // Potenciales"). Si están en otra pestaña ya no aparecen acá y esto no
  // recorta nada; si siguen en esta misma hoja, hay que cortar antes de
  // llegar a ellas o se leen como vehículos falsos.
  const filaDesglose = buscarFilaMarcador_(values, 'desglose flota total');
  const filaPotenciales = buscarFilaMarcador_(values, 'clientes potenciales');
  const candidatos = [filaDesglose, filaPotenciales].filter(function(f){ return f >= 0; });
  const limiteFilas = candidatos.length ? Math.min.apply(null, candidatos) : values.length;

  const vehiculos = [];
  const clientesSet = {};
  let currentClient = '';

  for (let i = 0; i < limiteFilas; i++) {
    const row = values[i];
    const c0 = String(row[C.cliente] || '').trim();
    const patente = String(row[C.patente] || '').trim();

    if (patente.toLowerCase() === 'patente') continue; // fila de encabezado repetida
    if (!patente) continue; // fila de contrato/subtotales, separador, o vacía

    if (c0) currentClient = c0.replace(/^\d+\.?-?\s*/, '').trim() || c0;
    if (!currentClient) continue;

    const meses = {};
    FLOTA_PANEL_MESES_.forEach(function(m, idx) { meses[m] = String(row[C.mesInicio + idx] || '').trim(); });

    const oficina = String(row[C.oficina] || '').trim();
    const ubicacion = detectarUbicacionOficinaFlota_(oficina, currentClient);

    vehiculos.push({
      fila: i + 1,
      cliente: currentClient,
      om: row[C.om],
      oficina: oficina,
      marcaModelo: String(row[C.marcaModelo] || '').trim(),
      anio: row[C.anio],
      patente: patente,
      formato: String(row[C.formato] || '').trim(),
      kms: parseFlotaKms_(row[C.kms]),
      ubicacion: ubicacion,
      ordenNorteSur: ubicacion ? ubicacion.lat : null,
      meses: meses
    });
    clientesSet[currentClient] = true;
  }

  return {
    vehiculos: vehiculos,
    clientes: Object.keys(clientesSet).sort(),
    mesActual: FLOTA_PANEL_MESES_[new Date().getMonth()],
    lastUpdated: new Date().toISOString()
  };
}

// ── Escritura: cambiar el estado (OP/D/RT/etc.) de un vehículo en un mes ────
function actualizarFlotaMes(params) {
  const token = (params && params.token) || null;
  const usuario = verificarToken_(token);
  if (!usuario) return { error: 'token_invalido' };

  const fila = parseInt((params && params.fila) || '0', 10);
  const mes = String((params && params.mes) || '').trim().toUpperCase();
  const valor = String((params && params.valor) || '').trim().toUpperCase();
  const mesIdx = FLOTA_PANEL_MESES_.indexOf(mes);
  if (!fila || fila < 2 || mesIdx < 0) return { error: 'parametros_invalidos' };

  const ss = SpreadsheetApp.openById(SHEETS.flotaPanel);
  const sheet = ss.getSheets()[0];
  const col = FLOTA_PANEL_COL_.mesInicio + mesIdx + 1; // 1-based para getRange
  sheet.getRange(fila, col).setValue(valor);
  CacheService.getScriptCache().remove('os_v18_flota_panel');
  return { ok: true, fila: fila, mes: mes, valor: valor };
}

// ============================================================================
// LECTOR: CLIENTES POTENCIALES (tabla dentro del spreadsheet de Flota — en
// su propia pestaña o al pie de la principal, según cómo se haya organizado
// el sheet). Se busca en TODAS las pestañas y se mapean las columnas por el
// texto de la fila de encabezado, en vez de asumir índices fijos.
// ============================================================================
function encontrarHojaFlotaPotenciales_(ss) {
  const sheets = ss.getSheets();
  // Preferir la(s) pestaña(s) cuyo nombre incluya "potencial" (p.ej. "Potenciales"),
  // y si ninguna califica, revisar todas igual — por si el nombre de la pestaña cambia.
  const conNombre = sheets.filter(function(s){ return s.getName().toLowerCase().indexOf('potencial') >= 0; });
  const candidatas = conNombre.length ? conNombre : sheets;

  for (let s = 0; s < candidatas.length; s++) {
    const values = candidatas[s].getDataRange().getValues();
    for (let i = 0; i < Math.min(values.length, 10); i++) {
      const row = values[i];
      let col = -1;
      for (let j = 0; j < row.length; j++) {
        const v = String(row[j] || '').trim().toLowerCase();
        if (v === 'patente' || v.indexOf('clientes potenciales') === 0) { col = j; break; }
      }
      if (col < 0) continue;
      // La columna del nombre es la primera celda no vacía de esa misma fila
      // (el marcador "Clientes Potenciales..." o, si ya no está, el encabezado
      // del propio nombre del cliente potencial).
      let colNombre = 0;
      for (let k = 0; k < row.length; k++) { if (String(row[k] || '').trim()) { colNombre = k; break; } }
      return { sheet: candidatas[s], values: values, row: i, col: colNombre };
    }
  }
  return null;
}

function mapearColumnasFlotaPotenciales_(headerRow, colInicio) {
  const colMap = { nombre: colInicio };
  for (let j = colInicio + 1; j < headerRow.length; j++) {
    const label = normalizarOficinaFlota_(headerRow[j]);
    if (label === 'marca modelo') colMap.marcaModelo = j;
    else if (label === 'ano') colMap.anio = j;
    else if (label === 'formato') colMap.formato = j;
    else if (label === 'patente') colMap.patente = j;
    else if (label.indexOf('kms') === 0 || label.indexOf('km') === 0) colMap.kms = j;
    else if (label.indexOf('prob') === 0) colMap.prob = j;
    else if (label.indexOf('tipo negocio') === 0) colMap.tipoNegocio = j;
  }
  return colMap;
}

function readFlotaClientesPotenciales() {
  const ss = SpreadsheetApp.openById(SHEETS.flotaPanel);
  const header = encontrarHojaFlotaPotenciales_(ss);
  if (!header) return { items: [] };

  const values = header.values;
  const colMap = mapearColumnasFlotaPotenciales_(values[header.row], header.col);

  const items = [];
  for (let i = header.row + 1; i < values.length; i++) {
    const row = values[i];
    const nombre = String(row[colMap.nombre] || '').trim();
    if (!nombre) break; // fin de la tabla (fila vacía)
    if (nombre.toLowerCase() === 'total') break;
    items.push({
      fila: i + 1,
      nombre: nombre,
      marcaModelo: colMap.marcaModelo != null ? String(row[colMap.marcaModelo] || '').trim() : '',
      anio: colMap.anio != null ? String(row[colMap.anio] || '').trim() : '',
      formato: colMap.formato != null ? String(row[colMap.formato] || '').trim() : '',
      patente: colMap.patente != null ? String(row[colMap.patente] || '').trim() : '',
      kms: colMap.kms != null ? parseFlotaKms_(row[colMap.kms]) : 0,
      prob: colMap.prob != null ? String(row[colMap.prob] || '').trim() : '',
      tipoNegocio: colMap.tipoNegocio != null ? String(row[colMap.tipoNegocio] || '').trim() : ''
    });
  }

  return { items: items };
}

// ── Escritura: editar un campo de un cliente potencial ──────────────────────
var FLOTA_POTENCIAL_CAMPOS_ = ['nombre','marcaModelo','anio','formato','patente','kms','prob','tipoNegocio'];

function actualizarFlotaPotencial(params) {
  const token = (params && params.token) || null;
  const usuario = verificarToken_(token);
  if (!usuario) return { error: 'token_invalido' };

  const fila = parseInt((params && params.fila) || '0', 10);
  const campo = String((params && params.campo) || '').trim();
  const valor = (params && params.valor != null) ? String(params.valor) : '';
  if (!fila || fila < 1 || FLOTA_POTENCIAL_CAMPOS_.indexOf(campo) < 0) return { error: 'parametros_invalidos' };

  const ss = SpreadsheetApp.openById(SHEETS.flotaPanel);
  const header = encontrarHojaFlotaPotenciales_(ss);
  if (!header) return { error: 'tabla_no_encontrada' };

  const colMap = mapearColumnasFlotaPotenciales_(header.values[header.row], header.col);
  const colIdx = colMap[campo];
  if (colIdx == null) return { error: 'columna_no_encontrada' };

  header.sheet.getRange(fila, colIdx + 1).setValue(valor);
  CacheService.getScriptCache().remove('os_v18_flota_potenciales');
  return { ok: true, fila: fila, campo: campo, valor: valor };
}

// ── Escritura: agregar un nuevo cliente potencial (fila nueva) ──────────────
function agregarFlotaPotencial(params) {
  const token = (params && params.token) || null;
  const usuario = verificarToken_(token);
  if (!usuario) return { error: 'token_invalido' };

  const nombre = String((params && params.nombre) || '').trim();
  if (!nombre) return { error: 'nombre_requerido' };

  const ss = SpreadsheetApp.openById(SHEETS.flotaPanel);
  const header = encontrarHojaFlotaPotenciales_(ss);
  if (!header) return { error: 'tabla_no_encontrada' };

  const values = header.values;
  const colMap = mapearColumnasFlotaPotenciales_(values[header.row], header.col);

  // Busca la primera fila vacía o "Total" para insertar justo antes (empuja esa fila hacia abajo).
  let insertAt = values.length;
  let hayQuePushear = false;
  for (let i = header.row + 1; i < values.length; i++) {
    const v = String(values[i][colMap.nombre] || '').trim();
    if (!v || v.toLowerCase() === 'total') { insertAt = i; hayQuePushear = true; break; }
  }

  const filaSheet = insertAt + 1; // 1-based
  if (hayQuePushear) header.sheet.insertRowBefore(filaSheet);
  header.sheet.getRange(filaSheet, colMap.nombre + 1).setValue(nombre);

  CacheService.getScriptCache().remove('os_v18_flota_potenciales');
  return { ok: true, fila: filaSheet, nombre: nombre };
}

// ── Escritura: eliminar un cliente potencial ─────────────────────────────────
function eliminarFlotaPotencial(params) {
  const token = (params && params.token) || null;
  const usuario = verificarToken_(token);
  if (!usuario) return { error: 'token_invalido' };

  const fila = parseInt((params && params.fila) || '0', 10);
  const nombreEsperado = String((params && params.nombre) || '').trim();
  if (!fila || fila < 2) return { error: 'fila_invalida' };

  const ss = SpreadsheetApp.openById(SHEETS.flotaPanel);
  const header = encontrarHojaFlotaPotenciales_(ss);
  if (!header) return { error: 'tabla_no_encontrada' };
  if (fila - 1 >= header.values.length) return { error: 'fila_no_existe' };

  const colMap = mapearColumnasFlotaPotenciales_(header.values[header.row], header.col);
  const nombreCelda = String(header.values[fila - 1][colMap.nombre] || '').trim();
  if (nombreEsperado && nombreCelda !== nombreEsperado) return { error: 'fila_no_coincide' };

  header.sheet.deleteRow(fila);
  CacheService.getScriptCache().remove('os_v18_flota_potenciales');
  return { ok: true };
}

function getFlotaPanelData() {
  function safeRead(fn) { try { return fn(); } catch (e) { return { error: e.toString() }; } }
  return {
    flotaPanel: safeRead(function() { return getCached('flota_panel', readFlotaPanel, CACHE_DURATION_SECONDS); }),
    flotaPotenciales: safeRead(function() { return getCached('flota_potenciales', readFlotaClientesPotenciales, CACHE_DURATION_SECONDS); }),
    lastUpdated: new Date().toISOString()
  };
}

// ── Tab loaders — callable via google.script.run (carga progresiva por pestaña) ──

function getTabOperacion(params) {
  var token = (params && params.token) || null;
  var usuario = verificarToken_(token);
  if (!usuario) return { authError: 'token_invalido' };
  var fechaParam = (params && params.fecha) || null;
  var fechaSuffix = fechaParam || 'today';
  function safeRead(fn) { try { return fn(); } catch(e) { return null; } }
  var flotaInfo = safeRead(function() { return getCached('flota', readFlota, CACHE_DURATION_SECONDS); }) || { flota: [], jefePorMovil: {}, jefePorNombre: {}, kams: [] };
  return {
    unificador:  safeRead(function() { return getCached('unificador_'   + fechaSuffix, function() { return readUnificador(flotaInfo, fechaParam); }, CACHE_DURATION_SECONDS); }),
    historico:   safeRead(function() { return getCached('historico_'    + fechaSuffix, function() { return readFinalizados(fechaParam); },           CACHE_DURATION_SECONDS); }),
    segundaRuta: safeRead(function() { return getCached('segunda_ruta_' + fechaSuffix, function() { return readSegundaRuta(fechaParam); },           CACHE_DURATION_SECONDS); }),
    kams: flotaInfo.kams || [],
    usuario: usuario,
    fechaConsultada: fechaParam || formatDateISO(new Date()),
    lastUpdated: new Date().toISOString()
  };
}

function getTabGps(params) {
  var token = (params && params.token) || null;
  var usuario = verificarToken_(token);
  if (!usuario) return { authError: 'token_invalido' };
  function safeRead(fn) { try { return fn(); } catch(e) { return null; } }
  var flotaInfo = safeRead(function() { return getCached('flota', readFlota, CACHE_DURATION_SECONDS); }) || { flota: [], jefePorMovil: {}, jefePorNombre: {}, kams: [] };
  return {
    gps: safeRead(function() { return getCached('gps', function() { return readGPS(flotaInfo); }, CACHE_GPS_SECONDS); }),
    lastUpdated: new Date().toISOString()
  };
}

function getTabBitacora(params) {
  var token = (params && params.token) || null;
  var usuario = verificarToken_(token);
  if (!usuario) return { authError: 'token_invalido' };
  var fechaParam = (params && params.fecha) || null;
  var fechaSuffix = fechaParam || 'today';
  function safeRead(fn) { try { return fn(); } catch(e) { return null; } }
  return {
    bitacora: safeRead(function() { return getCached('bitacora_' + fechaSuffix, function() { return readBitacora(fechaParam); }, CACHE_DURATION_SECONDS); }),
    lastUpdated: new Date().toISOString()
  };
}

// ── MONDAY.COM API ─────────────────────────────────────────────────────────
// Token se guarda con: PropertiesService.getScriptProperties().setProperty('MONDAY_TOKEN','...')
// Ejecuta setupMondayToken() una vez desde el editor de GAS para guardarlo.
var MONDAY_API_URL_           = 'https://api.monday.com/v2';
var MONDAY_CACHE_KEY_         = 'monday_su_v8';    // byMovil (tableros Rápida+Integral — reservado)
var MONDAY_CACHE_SEC_         = 3600;
var MONDAY_BOARD_RAPIDA_      = '5678712035';
var MONDAY_BOARD_INTEGRAL_    = '5623247223';
var MONDAY_BOARD_CONSOLIDADO_ = '5859805996';      // tablero consolidado Supervisiones
var MONDAY_CONSOL_CACHE_KEY_  = 'monday_consol_v3';
var MONDAY_CONSOL_CACHE_SEC_  = 600;
var MONDAY_BOARD_PLANES_      = '8505742190';
var MONDAY_PLANES_CACHE_KEY_  = 'monday_planes_v5';
var MONDAY_PLANES_CACHE_SEC_  = 1800;
var MONDAY_RAPIDA_CACHE_KEY_  = 'monday_rapida_v2';
var MONDAY_INTEGRAL_CACHE_KEY_= 'monday_integral_v2';
var MONDAY_SUP_CACHE_SEC_     = 1800;
var MONDAY_PLAN_ESTADO_PFX_   = 'pe_';        // PropertiesService key prefix para estados locales

function setupMondayToken() {
  var token = 'PEGA_TU_TOKEN_AQUI';
  PropertiesService.getScriptProperties().setProperty('MONDAY_TOKEN', token);
  Logger.log('Token guardado.');
}

function readMondaySupervisions_() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get(MONDAY_CACHE_KEY_);
  if (cached) { try { return JSON.parse(cached); } catch(e) {} }

  var token = PropertiesService.getScriptProperties().getProperty('MONDAY_TOKEN');
  if (!token) return {};

  // query_params.order_by → 500 más recientes por fecha (tablero tiene >500 items)
  var ob = 'query_params: {order_by: [{column_id: "date", direction: desc}]}';
  var query = '{ rapida: boards(ids: [' + MONDAY_BOARD_RAPIDA_ + ']) { columns { id title } items_page(limit: 500, ' + ob + ') { items { column_values { id text } } } } integral: boards(ids: [' + MONDAY_BOARD_INTEGRAL_ + ']) { columns { id title } items_page(limit: 500, ' + ob + ') { items { column_values { id text } } } } }';

  var resp;
  try {
    resp = UrlFetchApp.fetch(MONDAY_API_URL_, {
      method: 'POST',
      headers: { Authorization: token, 'Content-Type': 'application/json', 'API-Version': '2024-01' },
      payload: JSON.stringify({ query: query }),
      muteHttpExceptions: true
    });
  } catch(e) { return {}; }

  if (resp.getResponseCode() !== 200) return {};
  var raw;
  try { raw = JSON.parse(resp.getContentText()); } catch(e) { return {}; }
  if (!raw.data) return {};

  var byMovil = {};

  ['rapida', 'integral'].forEach(function(tipo) {
    var boards = raw.data[tipo];
    if (!boards || !boards[0]) return;
    var board  = boards[0];
    var cols   = board.columns || [];

    function colId(title) {
      var c = cols.find(function(c){ return c.title === title; });
      return c ? c.id : null;
    }

    var idCliente   = colId('Cliente');
    var idFecha     = colId('Fecha');
    var idSuperv    = colId('Nombre Supervisor');
    var idComent    = tipo === 'rapida' ? colId('Comentario') : null;
    // Todas las columnas "Móviles X" (una por cliente)
    var movilColIds = cols
      .filter(function(c){ return c.title && c.title.indexOf('Móviles ') === 0; })
      .map(function(c){ return c.id; });

    var items = (board.items_page && board.items_page.items) || [];
    items.forEach(function(item) {
      var cv = {};
      (item.column_values || []).forEach(function(v){ cv[v.id] = v.text || ''; });

      var fecha   = idFecha   ? cv[idFecha]   : '';
      var cliente = idCliente ? cv[idCliente] : '';
      var superv  = idSuperv  ? cv[idSuperv]  : '';
      var coment  = idComent  ? cv[idComent]  : '';
      if (!cliente || !fecha) return;

      // Extraer móvil: primera columna "Móviles X" con valor
      var movil = '';
      for (var i = 0; i < movilColIds.length; i++) {
        if (cv[movilColIds[i]]) { movil = cv[movilColIds[i]]; break; }
      }

      // Clave = cliente|movil (minúsculas), igual que en el Dashboard
      var key = (cliente + '|' + movil).toLowerCase();
      if (!byMovil[key]) byMovil[key] = [];
      byMovil[key].push({
        tipo:       tipo === 'rapida' ? 'Rápida' : 'Integral',
        fecha:      fecha,
        supervisor: superv,
        comentario: coment,
        cliente:    cliente,
        movil:      movil
      });
    });
  });

  // Ordenar por fecha desc y quedarse con las 5 más recientes por móvil
  Object.keys(byMovil).forEach(function(k) {
    byMovil[k].sort(function(a, b){ return (b.fecha||'').localeCompare(a.fecha||''); });
    byMovil[k] = byMovil[k].slice(0, 5);
  });

  try { cache.put(MONDAY_CACHE_KEY_, JSON.stringify(byMovil), MONDAY_CACHE_SEC_); } catch(e) { /* objeto demasiado grande */ }
  return byMovil;
}

function debugMondayAPI() {
  var token = PropertiesService.getScriptProperties().getProperty('MONDAY_TOKEN');
  if (!token) { Logger.log('SIN TOKEN'); return; }
  // Buscar items del Integral que tengan "La Araucana" en cualquier col de móvil
  // Columnas clave Integral: Cliente=selecci_n_m_ltiple57__1, Fecha=date, Móviles La Araucana=selecci_n_m_ltiple_3__1
  var colIds = '["selecci_n_m_ltiple57__1","date","nombre_supervisor","selecci_n_m_ltiple_3__1"]';
  var query = '{ integral: boards(ids: [' + MONDAY_BOARD_INTEGRAL_ + ']) { items_page(limit: 500) { items { id name column_values(ids: ' + colIds + ') { id text } } } } }';
  var resp = UrlFetchApp.fetch(MONDAY_API_URL_, {
    method: 'POST',
    headers: { Authorization: token, 'Content-Type': 'application/json', 'API-Version': '2024-01' },
    payload: JSON.stringify({ query: query }),
    muteHttpExceptions: true
  });
  var raw = JSON.parse(resp.getContentText());
  var items = raw.data.integral[0].items_page.items;
  Logger.log('Total items Integral: ' + items.length);
  var count = 0;
  items.forEach(function(item) {
    var cv = {};
    item.column_values.forEach(function(v){ cv[v.id] = v.text || ''; });
    var cliente = cv['selecci_n_m_ltiple57__1'];
    var movil   = cv['selecci_n_m_ltiple_3__1'];
    var fecha   = cv['date'];
    var sup     = cv['nombre_supervisor'];
    if (cliente && cliente.indexOf('Araucana') >= 0) {
      Logger.log('cliente="' + cliente + '" movil="' + movil + '" fecha="' + fecha + '" sup="' + sup + '"');
      count++;
    }
  });
  Logger.log('Items La Araucana en Integral: ' + count);
}

function readMondayConsolidado_() {
  var cache  = CacheService.getScriptCache();
  var cached = cache.get(MONDAY_CONSOL_CACHE_KEY_);
  if (cached) { try { return JSON.parse(cached); } catch(e) {} }

  var token = PropertiesService.getScriptProperties().getProperty('MONDAY_TOKEN');
  if (!token) return {};

  var ob    = 'query_params: {order_by: [{column_id: "__last_updated__", direction: desc}]}';
  // name → para extraer tipo (Rápida/Integral) del nombre del item
  var query = '{ boards(ids: [' + MONDAY_BOARD_CONSOLIDADO_ + ']) { columns { id title } items_page(limit: 500, ' + ob + ') { items { name column_values { id text } } } } }';

  var resp;
  try {
    resp = UrlFetchApp.fetch(MONDAY_API_URL_, {
      method: 'POST',
      headers: { Authorization: token, 'Content-Type': 'application/json', 'API-Version': '2024-01' },
      payload: JSON.stringify({ query: query }),
      muteHttpExceptions: true
    });
  } catch(e) { return {}; }

  if (resp.getResponseCode() !== 200) return {};
  var raw; try { raw = JSON.parse(resp.getContentText()); } catch(e) { return {}; }
  if (!raw.data || !raw.data.boards || !raw.data.boards[0]) return {};

  var board = raw.data.boards[0];
  var cols  = board.columns || [];

  Logger.log('[Consolidado] Columnas: ' + cols.map(function(c){ return c.id + '=' + c.title; }).join(' | '));

  function colId(titles) {
    if (!Array.isArray(titles)) titles = [titles];
    for (var i = 0; i < titles.length; i++) {
      var t = titles[i];
      var c = cols.find(function(col){ return col.title && col.title.toLowerCase() === t.toLowerCase(); });
      if (c) return c.id;
    }
    return null;
  }

  var idCliente   = colId(['Cliente']);
  var idFecha     = colId(['Fecha','Fecha de Supervisión','Fecha Supervisión']);
  var idSuperv    = colId(['Nombre Supervisor','Supervisor','Nombre supervisor']);
  var idOtroSup   = colId(['Otro Supervisor','Otro supervisor']);
  var idComent    = colId(['Comentario','Observación','Observaciones','Notas']);
  var idMovilDir  = colId(['Móvil','Movil','Nombre Móvil']);
  var idOtroMovil = colId(['Otro Móvil','Otro Movil','Otro movil']);
  var idLugar     = colId(['Lugar de Atención','Lugar de atencion','Lugar']);
  var idConductor = colId(['Nombre Conductor','Conductor','Nombre conductor']);
  var movilColIds = cols.filter(function(c){ return c.title && c.title.indexOf('Móviles ') === 0; }).map(function(c){ return c.id; });

  var items  = (board.items_page && board.items_page.items) || [];
  var byMovil = {};

  items.forEach(function(item) {
    var cv = {};
    (item.column_values || []).forEach(function(v){ cv[v.id] = v.text || ''; });

    var cliente  = idCliente   ? cv[idCliente]   : '';
    var fecha    = idFecha     ? cv[idFecha]      : '';
    var superv   = idSuperv    ? cv[idSuperv]     : '';
    var otroSup  = idOtroSup   ? cv[idOtroSup]   : '';
    var coment   = idComent    ? cv[idComent]     : '';
    var lugar    = idLugar     ? cv[idLugar]      : '';
    var conductor= idConductor ? cv[idConductor]  : '';
    if (!cliente || !fecha) return;

    var movil = '';
    if (idMovilDir && cv[idMovilDir]) { movil = cv[idMovilDir]; }
    if (!movil || movil.toLowerCase() === 'otro') {
      var otroMovil = idOtroMovil ? cv[idOtroMovil] : '';
      if (otroMovil) movil = otroMovil;
    }
    if (!movil) {
      for (var i = 0; i < movilColIds.length; i++) { if (cv[movilColIds[i]]) { movil = cv[movilColIds[i]]; break; } }
    }

    // Supervisor: si dice "Otro" usar el campo libre
    if (superv && superv.indexOf('Otro') >= 0 && otroSup) {
      superv = superv.replace('Otro', otroSup).replace(/,\s*,/, ',').trim().replace(/,$/, '').trim();
    }

    // Tipo desde el nombre del item ("Supervisión rápida..." / "Supervisión integral...")
    var nombre   = (item.name || '').toLowerCase();
    var tipoNorm = nombre.indexOf('integral') >= 0 ? 'Integral'
                 : (nombre.indexOf('rápida') >= 0 || nombre.indexOf('rapida') >= 0) ? 'Rápida'
                 : 'Supervisión';

    var key = (cliente + '|' + movil).toLowerCase();
    if (!byMovil[key]) byMovil[key] = [];
    byMovil[key].push({
      tipo:       tipoNorm,
      fecha:      fecha,
      supervisor: superv,
      comentario: coment,
      cliente:    cliente,
      movil:      movil,
      lugar:      lugar,
      conductor:  conductor
    });
  });

  // Ordenar por fecha desc y mantener 5 más recientes por móvil
  Object.keys(byMovil).forEach(function(k) {
    byMovil[k].sort(function(a, b){ return (b.fecha||'').localeCompare(a.fecha||''); });
    byMovil[k] = byMovil[k].slice(0, 5);
  });

  try { cache.put(MONDAY_CONSOL_CACHE_KEY_, JSON.stringify(byMovil), MONDAY_CONSOL_CACHE_SEC_); } catch(e) {}
  return byMovil;
}

function debugPlanes() {
  var token = PropertiesService.getScriptProperties().getProperty('MONDAY_TOKEN');
  if (!token) { Logger.log('SIN TOKEN'); return; }
  var query = '{ boards(ids: [' + MONDAY_BOARD_PLANES_ + ']) { columns { id title type } items_page(limit: 3, query_params: {order_by: [{column_id: "__last_updated__", direction: desc}]}) { items { id name column_values { id text } } } } }';
  var resp = UrlFetchApp.fetch(MONDAY_API_URL_, {
    method: 'POST',
    headers: { Authorization: token, 'Content-Type': 'application/json', 'API-Version': '2024-01' },
    payload: JSON.stringify({ query: query }),
    muteHttpExceptions: true
  });
  var raw = JSON.parse(resp.getContentText());
  var board = raw.data.boards[0];
  Logger.log('=== COLUMNAS PLANES ===');
  board.columns.forEach(function(c){ Logger.log(c.id + ' | ' + c.type + ' | ' + c.title); });
  Logger.log('=== ITEMS DE MUESTRA ===');
  (board.items_page.items || []).forEach(function(item) {
    Logger.log('Item: ' + item.name);
    item.column_values.forEach(function(cv){
      if (cv.text) Logger.log('  ' + cv.id + ' → "' + cv.text + '"');
    });
  });
}

function debugConsolidado() {
  var token = PropertiesService.getScriptProperties().getProperty('MONDAY_TOKEN');
  if (!token) { Logger.log('SIN TOKEN'); return; }
  var query = '{ boards(ids: [' + MONDAY_BOARD_CONSOLIDADO_ + ']) { columns { id title type } items_page(limit: 3) { items { id name column_values { id text value } } } } }';
  var resp = UrlFetchApp.fetch(MONDAY_API_URL_, {
    method: 'POST',
    headers: { Authorization: token, 'Content-Type': 'application/json', 'API-Version': '2024-01' },
    payload: JSON.stringify({ query: query }),
    muteHttpExceptions: true
  });
  var raw = JSON.parse(resp.getContentText());
  var board = raw.data.boards[0];
  Logger.log('=== COLUMNAS ===');
  board.columns.forEach(function(c){ Logger.log(c.id + ' | ' + c.type + ' | ' + c.title); });
  Logger.log('=== ITEM DE MUESTRA ===');
  (board.items_page.items || []).forEach(function(item) {
    Logger.log('Item: ' + item.name);
    item.column_values.forEach(function(cv){
      if (cv.text) Logger.log('  ' + cv.id + ' → "' + cv.text + '" (value=' + cv.value + ')');
    });
  });
}

function debugSupervisionBoard_(boardId, label) {
  var token = PropertiesService.getScriptProperties().getProperty('MONDAY_TOKEN');
  if (!token) { Logger.log('SIN TOKEN'); return; }
  var ob = 'query_params: {order_by: [{column_id: "__last_updated__", direction: desc}]}';
  var query = '{ boards(ids: [' + boardId + ']) { columns { id title type } items_page(limit: 3, ' + ob + ') { items { id name column_values { id text value } subitems { id name column_values { id text } } } } } }';
  var resp = UrlFetchApp.fetch(MONDAY_API_URL_, {
    method: 'POST',
    headers: { Authorization: token, 'Content-Type': 'application/json', 'API-Version': '2024-01' },
    payload: JSON.stringify({ query: query }),
    muteHttpExceptions: true
  });
  var raw = JSON.parse(resp.getContentText());
  if (!raw.data || !raw.data.boards || !raw.data.boards[0]) { Logger.log('ERROR: ' + resp.getContentText()); return; }
  var board = raw.data.boards[0];
  Logger.log('=== COLUMNAS ' + label + ' (' + boardId + ') ===');
  board.columns.forEach(function(c){ Logger.log(c.id + ' | ' + c.type + ' | ' + c.title); });
  Logger.log('=== ITEMS DE MUESTRA ===');
  (board.items_page.items || []).forEach(function(item) {
    Logger.log('Item: ' + item.name);
    item.column_values.forEach(function(cv){
      if (cv.text) Logger.log('  ' + cv.id + ' → "' + cv.text + '"');
    });
    if (item.subitems && item.subitems.length) {
      Logger.log('  Subitems (' + item.subitems.length + '):');
      item.subitems.slice(0, 3).forEach(function(s) {
        Logger.log('    Subitem: ' + s.name);
        s.column_values.forEach(function(cv){ if (cv.text) Logger.log('      ' + cv.id + ' → "' + cv.text + '"'); });
      });
    }
  });
}

function debugIntegral() { debugSupervisionBoard_(MONDAY_BOARD_INTEGRAL_, 'INTEGRAL'); }
function debugRapida()    { debugSupervisionBoard_(MONDAY_BOARD_RAPIDA_,   'RAPIDA');   }

function readMondayPlanesAccion_() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get(MONDAY_PLANES_CACHE_KEY_);
  if (cached) { try { return JSON.parse(cached); } catch(e) {} }

  var token = PropertiesService.getScriptProperties().getProperty('MONDAY_TOKEN');
  if (!token) return { planes: [], colEstadoId: null };

  // __last_updated__ es una columna especial de Monday (siempre existe) → trae los 500 más recientes
  var ob = 'query_params: {order_by: [{column_id: "__last_updated__", direction: desc}]}';
  var query = '{ boards(ids: [' + MONDAY_BOARD_PLANES_ + ']) { columns { id title } items_page(limit: 500, ' + ob + ') { items { id name column_values { id text } } } } }';
  var resp;
  try {
    resp = UrlFetchApp.fetch(MONDAY_API_URL_, {
      method: 'POST',
      headers: { Authorization: token, 'Content-Type': 'application/json', 'API-Version': '2024-01' },
      payload: JSON.stringify({ query: query }),
      muteHttpExceptions: true
    });
  } catch(e) { return { planes: [], colEstadoId: null }; }

  if (resp.getResponseCode() !== 200) return { planes: [], colEstadoId: null };
  var raw; try { raw = JSON.parse(resp.getContentText()); } catch(e) { return { planes: [], colEstadoId: null }; }
  if (!raw.data || !raw.data.boards || !raw.data.boards[0]) return { planes: [], colEstadoId: null };

  var board = raw.data.boards[0];
  var cols  = board.columns || [];

  Logger.log('[Planes] Columnas: ' + cols.map(function(c){ return c.id + '=' + c.title; }).join(', '));

  function colId(titles) {
    if (!Array.isArray(titles)) titles = [titles];
    for (var i = 0; i < titles.length; i++) {
      var t = titles[i];
      var c = cols.find(function(col){ return col.title === t; });
      if (c) return c.id;
    }
    return null;
  }

  var idCliente      = colId(['Cliente']);
  var idFecha        = colId(['Fecha de Supervisión','Fecha Supervisión','Fecha']);
  var idFechaLim     = colId(['Fecha límite','Fecha Límite','Límite']);
  var idEstado       = colId(['Estado','Status','Estatus']);
  var idDescr        = colId(['¿Qué?','Qué','Detalle','Problema','Observación','Descripción']);
  var idAccion       = colId(['Checklist original','Checklist','Origen']);
  var idResponsable  = colId(['Responsable','Encargado','Supervisor Original','Supervisor']);
  var idMovilDir     = colId(['Móvil','Nombre Móvil','Movil']);
  var movilColIds  = cols.filter(function(c){ return c.title && c.title.indexOf('Móviles ') === 0; }).map(function(c){ return c.id; });

  Logger.log('[Planes] idCliente=' + idCliente + ' idFecha=' + idFecha + ' idEstado=' + idEstado + ' idMovilDir=' + idMovilDir + ' idAccion=' + idAccion);

  var items = (board.items_page && board.items_page.items) || [];
  var planes = [];

  items.forEach(function(item) {
    var cv = {};
    (item.column_values || []).forEach(function(v){ cv[v.id] = v.text || ''; });

    var movil = '';
    if (idMovilDir && cv[idMovilDir]) { movil = cv[idMovilDir]; }
    if (!movil) {
      for (var i = 0; i < movilColIds.length; i++) { if (cv[movilColIds[i]]) { movil = cv[movilColIds[i]]; break; } }
    }

    // Limpiar responsable: quitar punto y coma final (Monday concatena con ";")
    var respRaw = idResponsable ? (cv[idResponsable] || '') : '';
    var responsable = respRaw.replace(/\s*;\s*/g, ', ').replace(/,\s*$/, '').trim();

    planes.push({
      id:          item.id,
      name:        item.name || '',
      accion:      idAccion      ? cv[idAccion]      : '',
      cliente:     idCliente     ? cv[idCliente]     : '',
      movil:       movil,
      fecha:       idFecha       ? cv[idFecha]       : '',
      fechaLim:    idFechaLim    ? cv[idFechaLim]    : '',
      estado:      idEstado      ? cv[idEstado]      : '',
      descripcion: idDescr       ? cv[idDescr]       : '',
      responsable: responsable
    });
  });

  planes.sort(function(a,b){ return (b.fecha||'').localeCompare(a.fecha||''); });

  var result = { planes: planes, colEstadoId: idEstado };
  try { cache.put(MONDAY_PLANES_CACHE_KEY_, JSON.stringify(result), MONDAY_PLANES_CACHE_SEC_); } catch(e) {}
  return result;
}

// Wrapper público para google.script.run (sin underscore)
function updateMondayPlanEstadoGas(params) {
  var token   = (params && params.token)  || null;
  var usuario = verificarToken_(token);
  if (!usuario) return { error: 'token_invalido' };
  return updateMondayPlanEstado_(
    String((params && params.itemId) || ''),
    String((params && params.colId)  || ''),
    String((params && params.value)  || '')
  );
}

function updateMondayPlanEstado_(itemId, colEstadoId, value) {
  if (!itemId || !colEstadoId || !value) return { error: 'missing_params' };
  var token = PropertiesService.getScriptProperties().getProperty('MONDAY_TOKEN');
  if (!token) return { error: 'no_token' };

  var mutation = 'mutation { change_simple_column_value(board_id: ' + MONDAY_BOARD_PLANES_ + ', item_id: ' + itemId + ', column_id: "' + colEstadoId + '", value: ' + JSON.stringify(value) + ') { id } }';
  var resp;
  try {
    resp = UrlFetchApp.fetch(MONDAY_API_URL_, {
      method: 'POST',
      headers: { Authorization: token, 'Content-Type': 'application/json', 'API-Version': '2024-01' },
      payload: JSON.stringify({ query: mutation }),
      muteHttpExceptions: true
    });
  } catch(e) { return { error: e.toString() }; }

  if (resp.getResponseCode() !== 200) return { error: 'http_' + resp.getResponseCode() };
  try { CacheService.getScriptCache().remove(MONDAY_PLANES_CACHE_KEY_); } catch(e) {}
  var raw; try { raw = JSON.parse(resp.getContentText()); } catch(e) { return { error: 'json_parse' }; }
  if (raw.errors && raw.errors.length) return { error: JSON.stringify(raw.errors[0]) };
  return { ok: true };
}

// ── Estado local (PropertiesService) para planes de Rápida/Integral ─────────
function updatePlanEstadoLocalGas(params) {
  var token   = (params && params.token)   || null;
  var usuario = verificarToken_(token);
  if (!usuario) return { error: 'token_invalido' };
  var planKey = String((params && params.planKey) || '');
  var value   = String((params && params.value)   || '');
  if (!planKey || !value) return { error: 'missing_params' };
  PropertiesService.getScriptProperties().setProperty(MONDAY_PLAN_ESTADO_PFX_ + planKey, value);
  return { ok: true };
}

function getEstadoLocal_(planKey) {
  return PropertiesService.getScriptProperties().getProperty(MONDAY_PLAN_ESTADO_PFX_ + planKey) || '';
}

// ── Helper compartido: fetch Monday board ────────────────────────────────────
function fetchMondayBoard_(boardId, limit) {
  var token = PropertiesService.getScriptProperties().getProperty('MONDAY_TOKEN');
  if (!token) return null;
  var ob    = 'query_params: {order_by: [{column_id: "__last_updated__", direction: desc}]}';
  var query = '{ boards(ids: [' + boardId + ']) { columns { id title type } items_page(limit: ' + (limit||200) + ', ' + ob + ') { items { id name column_values { id text } } } } }';
  var resp;
  try {
    resp = UrlFetchApp.fetch(MONDAY_API_URL_, {
      method: 'POST',
      headers: { Authorization: token, 'Content-Type': 'application/json', 'API-Version': '2024-01' },
      payload: JSON.stringify({ query: query }),
      muteHttpExceptions: true
    });
  } catch(e) { return null; }
  if (resp.getResponseCode() !== 200) return null;
  var raw; try { raw = JSON.parse(resp.getContentText()); } catch(e) { return null; }
  if (!raw.data || !raw.data.boards || !raw.data.boards[0]) return null;
  return raw.data.boards[0];
}

// ── Helper: primer móvil no vacío de columnas "Móviles X" ───────────────────
function extractMovil_(cv, movilCols) {
  for (var i = 0; i < movilCols.length; i++) {
    if (cv[movilCols[i]]) return cv[movilCols[i]];
  }
  return '';
}

// ── Planes desde Supervisión Rápida ─────────────────────────────────────────
function readMondayRapida_() {
  var cache  = CacheService.getScriptCache();
  var cached = cache.get(MONDAY_RAPIDA_CACHE_KEY_);
  var planes;
  if (cached) { try { planes = JSON.parse(cached); } catch(e) { planes = null; } }
  if (!planes) {
    planes = fetchMondayRapidaPlanes_();
    try { cache.put(MONDAY_RAPIDA_CACHE_KEY_, JSON.stringify(planes), MONDAY_SUP_CACHE_SEC_); } catch(e) {}
  }
  // Merge estados locales (siempre frescos)
  planes.forEach(function(p) {
    var est = getEstadoLocal_(p.planKey);
    if (est) p.estado = est;
  });
  return planes;
}

function fetchMondayRapidaPlanes_() {
  var board = fetchMondayBoard_(MONDAY_BOARD_RAPIDA_, 500);
  if (!board) return [];
  var cols = board.columns || [];

  var idCliente    = null, idFecha = null, idSupervisor = null;
  var movilCols    = [];
  cols.forEach(function(c) {
    var t = c.title || '';
    if (t === 'Cliente')           idCliente    = c.id;
    if (t === 'Fecha')             idFecha      = c.id;
    if (t === 'Nombre Supervisor') idSupervisor = c.id;
    if (t.indexOf('Móviles ') === 0) movilCols.push(c.id);
  });

  // Detectar slots de Plan de Acción dinámicamente por patrón
  // Responsable N / ¿Qué? N°N / Fecha límite para solución N°N
  var slotMap = {};
  cols.forEach(function(c) {
    var t = c.title || '';
    var tl = t.toLowerCase();
    // Responsable N
    var mR = t.match(/^Responsable\s+(\d+)$/i);
    if (mR) { var n = mR[1]; slotMap[n] = slotMap[n] || {}; slotMap[n].num = parseInt(n,10); slotMap[n].respId = c.id; return; }
    // ¿Qué? con número (N°1, N.1, #1, etc.)
    var mQ = t.match(/qué\?.*?(\d+)/i);
    if (mQ) { var n = mQ[1]; slotMap[n] = slotMap[n] || {}; slotMap[n].num = parseInt(n,10); slotMap[n].queId = c.id; return; }
    // Fecha límite con número
    var mF = tl.indexOf('fecha') >= 0 && tl.indexOf('soluci') >= 0 ? t.match(/(\d+)/) : null;
    if (mF) { var n = mF[1]; slotMap[n] = slotMap[n] || {}; slotMap[n].num = parseInt(n,10); slotMap[n].fechaId = c.id; }
  });
  var slots = Object.keys(slotMap).sort().map(function(k){ return slotMap[k]; });

  var planes = [];
  (board.items_page.items || []).forEach(function(item) {
    var cv = {};
    (item.column_values || []).forEach(function(v){ cv[v.id] = v.text || ''; });
    var cliente = idCliente ? cv[idCliente] : '';
    var movil   = extractMovil_(cv, movilCols);
    var fecha   = idFecha   ? cv[idFecha]   : '';

    slots.forEach(function(s) {
      var qué  = s.queId  ? cv[s.queId]  : '';
      var resp = s.respId ? cv[s.respId] : '';
      if (!qué || !resp) return;          // Rápida: ambos requeridos
      var planKey = 'r_' + item.id + '_' + s.num;
      planes.push({
        id:          item.id + '_' + s.num,
        planKey:     planKey,
        source:      'rapida',
        name:        qué.split('\n')[0].substring(0, 120),
        accion:      'Supervisión Rápida',
        cliente:     cliente,
        movil:       movil,
        fecha:       fecha,
        fechaLim:    s.fechaId ? cv[s.fechaId] : '',
        estado:      'Pendiente',
        descripcion: qué,
        responsable: resp
      });
    });
  });

  planes.sort(function(a,b){ return (b.fecha||'').localeCompare(a.fecha||''); });
  return planes;
}

// ── Planes desde Supervisión Integral ───────────────────────────────────────
function readMondayIntegral_() {
  var cache  = CacheService.getScriptCache();
  var cached = cache.get(MONDAY_INTEGRAL_CACHE_KEY_);
  var planes;
  if (cached) { try { planes = JSON.parse(cached); } catch(e) { planes = null; } }
  if (!planes) {
    planes = fetchMondayIntegralPlanes_();
    try { cache.put(MONDAY_INTEGRAL_CACHE_KEY_, JSON.stringify(planes), MONDAY_SUP_CACHE_SEC_); } catch(e) {}
  }
  planes.forEach(function(p) {
    var est = getEstadoLocal_(p.planKey);
    if (est) p.estado = est;
  });
  return planes;
}

function fetchMondayIntegralPlanes_() {
  var board = fetchMondayBoard_(MONDAY_BOARD_INTEGRAL_, 100);
  if (!board) return [];
  var cols = board.columns || [];

  function extractSuffix(title) {
    var m = (title || '').match(/\(([^)]+)\)$/);
    return m ? m[1].toLowerCase().trim() : '';
  }

  // Construir triplets dinámicamente desde columnas ¿Qué? (NombreItem)
  var triplets = [];
  cols.forEach(function(queCol) {
    if (!queCol.title || queCol.title.indexOf('¿Qué?') !== 0) return;
    var suffix = extractSuffix(queCol.title);
    if (!suffix) return; // Saltar columnas genéricas ¿Qué? sin sufijo parentético
    var nombre = queCol.title.replace(/^¿Qué\?\s*/, '').replace(/^\(/, '').replace(/\)$/, '').trim() || queCol.title;
    var respId = null, fechaId = null;
    cols.forEach(function(c) {
      if (!c.title) return;
      var cs = extractSuffix(c.title);
      if (cs !== suffix) return;
      var ct = c.title.toLowerCase();
      if (ct.indexOf('responsable') >= 0 || ct.indexOf('resposable') >= 0) respId = c.id;
      // Solo usar columnas que sean fecha LÍMITE/SOLUCIÓN, no la fecha de supervisión
      if (c.type === 'date' && ct.indexOf('fecha') >= 0 && (ct.indexOf('límite') >= 0 || ct.indexOf('limite') >= 0 || ct.indexOf('soluci') >= 0)) fechaId = c.id;
    });
    triplets.push({ nombre: nombre, queId: queCol.id, respId: respId, fechaId: fechaId });
  });

  var idCliente    = null, idFecha = null, idSupervisor = null;
  var movilCols    = [];
  cols.forEach(function(c) {
    if (c.title === 'Cliente')           idCliente    = c.id;
    if (c.title === 'Fecha')             idFecha      = c.id;
    if (c.title === 'Nombre Supervisor') idSupervisor = c.id;
    if (c.title && c.title.indexOf('Móviles ') === 0) movilCols.push(c.id);
  });

  var planes = [];
  (board.items_page.items || []).forEach(function(item) {
    var cv = {};
    (item.column_values || []).forEach(function(v){ cv[v.id] = v.text || ''; });
    var cliente = idCliente ? cv[idCliente] : '';
    var movil   = extractMovil_(cv, movilCols);
    var fecha   = idFecha   ? cv[idFecha]   : '';

    triplets.forEach(function(t) {
      var qué  = cv[t.queId] || '';
      var resp = t.respId ? (cv[t.respId] || '') : '';
      if (!qué && !resp) return;          // Integral: al menos uno
      var planKey = 'i_' + item.id + '_' + t.queId;
      planes.push({
        id:          item.id + '_' + t.queId,
        planKey:     planKey,
        source:      'integral',
        name:        t.nombre,
        accion:      'Supervisión Integral',
        cliente:     cliente,
        movil:       movil,
        fecha:       fecha,
        fechaLim:    t.fechaId ? cv[t.fechaId] : '',
        estado:      'Pendiente',
        descripcion: qué,
        responsable: resp
      });
    });
  });

  planes.sort(function(a,b){ return (b.fecha||'').localeCompare(a.fecha||''); });
  return planes;
}

// ── Planes board filtrado: solo Inicio/Fin de Mes y Inicio/Término de Ruta ──
function readMondayChecklists_() {
  var cache  = CacheService.getScriptCache();
  var cached = cache.get(MONDAY_PLANES_CACHE_KEY_);
  var result;
  if (cached) { try { result = JSON.parse(cached); } catch(e) { result = null; } }
  if (!result) {
    result = fetchMondayChecklistsRaw_();
    try { cache.put(MONDAY_PLANES_CACHE_KEY_, JSON.stringify(result), MONDAY_PLANES_CACHE_SEC_); } catch(e) {}
  }
  // Merge estados locales: override Monday estado si el usuario guardó uno localmente
  (result.planes || []).forEach(function(p) {
    var est = getEstadoLocal_(p.planKey);
    if (est) p.estado = est;
  });
  return result;
}

function fetchMondayChecklistsRaw_() {
  var token = PropertiesService.getScriptProperties().getProperty('MONDAY_TOKEN');
  if (!token) return { planes: [], colEstadoId: null };
  var ob    = 'query_params: {order_by: [{column_id: "__last_updated__", direction: desc}]}';
  var query = '{ boards(ids: [' + MONDAY_BOARD_PLANES_ + ']) { columns { id title } items_page(limit: 500, ' + ob + ') { items { id name column_values { id text } } } } }';
  var resp;
  try {
    resp = UrlFetchApp.fetch(MONDAY_API_URL_, {
      method: 'POST',
      headers: { Authorization: token, 'Content-Type': 'application/json', 'API-Version': '2024-01' },
      payload: JSON.stringify({ query: query }),
      muteHttpExceptions: true
    });
  } catch(e) { return { planes: [], colEstadoId: null }; }
  if (resp.getResponseCode() !== 200) return { planes: [], colEstadoId: null };
  var raw; try { raw = JSON.parse(resp.getContentText()); } catch(e) { return { planes: [], colEstadoId: null }; }
  if (!raw.data || !raw.data.boards || !raw.data.boards[0]) return { planes: [], colEstadoId: null };

  var board = raw.data.boards[0];
  var cols  = board.columns || [];

  function colId(titles) {
    if (!Array.isArray(titles)) titles = [titles];
    for (var i = 0; i < titles.length; i++) {
      var c = cols.filter(function(x){ return x.title === titles[i]; })[0];
      if (c) return c.id;
    }
    return null;
  }

  var idCliente    = colId(['Cliente']);
  var idFecha      = colId(['Fecha de Supervisión','Fecha Supervisión','Fecha']);
  var idFechaLim   = colId(['Fecha límite','Fecha Límite','Límite']);
  var idEstado     = colId(['Estado','Status','Estatus']);
  var idDescr      = colId(['¿Qué?','Qué','Detalle']);
  var idAccion     = colId(['Checklist original','Checklist','Origen']);
  var idResponsable= colId(['Responsable','Encargado','Supervisor Original','Supervisor']);
  var idMovilDir   = colId(['Móvil','Nombre Móvil','Movil']);
  var movilCols    = cols.filter(function(c){ return c.title && c.title.indexOf('Móviles ') === 0; }).map(function(c){ return c.id; });

  // Palabras clave para filtrar solo checklists de Ruta/Mes
  var KEYWORDS = ['inicio de ruta','inicio ruta','término de ruta','termino de ruta','inicio de mes','fin de mes','checklist inicio','checklist fin'];

  var planes = [];
  (board.items_page.items || []).forEach(function(item) {
    var cv = {};
    (item.column_values || []).forEach(function(v){ cv[v.id] = v.text || ''; });
    var accionVal  = idAccion ? (cv[idAccion] || '') : '';
    var accionLC   = accionVal.toLowerCase();
    var nameLC     = (item.name || '').toLowerCase();
    // Filtrar: solo planes de checklists de ruta/mes — busca en accion Y en nombre del ítem
    var esChecklist = KEYWORDS.some(function(k){ return accionLC.indexOf(k) >= 0 || nameLC.indexOf(k) >= 0; });
    if (!esChecklist) return;

    var movil = '';
    if (idMovilDir && cv[idMovilDir]) { movil = cv[idMovilDir]; }
    if (!movil) { movil = extractMovil_(cv, movilCols); }

    var respRaw = idResponsable ? (cv[idResponsable] || '') : '';
    var responsable = respRaw.replace(/\s*;\s*/g, ', ').replace(/,\s*$/, '').trim();

    planes.push({
      id:          item.id,
      planKey:     'c_' + item.id,
      source:      'checklist',
      name:        item.name || '',
      accion:      accionVal || (nameLC.indexOf('inicio') >= 0 || nameLC.indexOf('fin') >= 0 || nameLC.indexOf('término') >= 0 ? item.name : ''),
      cliente:     idCliente ? cv[idCliente] : '',
      movil:       movil,
      fecha:       idFecha    ? cv[idFecha]    : '',
      fechaLim:    idFechaLim ? cv[idFechaLim] : '',
      estado:      idEstado   ? cv[idEstado]   : '',
      descripcion: idDescr    ? cv[idDescr]    : '',
      responsable: responsable
    });
  });

  planes.sort(function(a,b){ return (b.fecha||'').localeCompare(a.fecha||''); });
  return { planes: planes, colEstadoId: idEstado };
}

// ============================================================================
// NOTIFICACIONES: nuevo plan de acción asignado a un responsable
// ============================================================================
var NOTIF_RESPONSABLES_TAB   = 'Responsables';        // hoja: Nombre | Email
var NOTIF_NOTIFICADOS_TAB    = 'PlanesNotificados';    // hoja: PlanId | Notificado el
var NOTIF_SIN_EMAIL_TAB      = 'PlanesSinEmail';       // hoja: Notado el | PlanId | Responsable | Cliente | Móvil | Descripción
var NOTIF_DASHBOARD_URL      = 'https://dashboard-operaciones-on-street.vercel.app';

function getOrCreateSheet_(nombre, headers) {
  var ss = SpreadsheetApp.openById(SHEETS.dashboardApi);
  var sheet = ss.getSheetByName(nombre);
  if (!sheet) {
    sheet = ss.insertSheet(nombre);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }
  return sheet;
}

// Nombre de responsable (normalizado) → email, desde la hoja "Responsables"
function getResponsableEmailMap_() {
  var sheet = getOrCreateSheet_(NOTIF_RESPONSABLES_TAB, ['Nombre', 'Email']);
  var data  = sheet.getDataRange().getValues();
  var map = {};
  for (var i = 1; i < data.length; i++) {
    var nombre = String(data[i][0] || '').trim();
    var email  = String(data[i][1] || '').trim();
    if (nombre && email) map[normalize_(nombre)] = email;
  }
  return map;
}

function getPlanesYaNotificados_() {
  var sheet = getOrCreateSheet_(NOTIF_NOTIFICADOS_TAB, ['PlanId', 'Notificado el']);
  var data  = sheet.getDataRange().getValues();
  var set = {};
  for (var i = 1; i < data.length; i++) { if (data[i][0]) set[String(data[i][0])] = true; }
  return { sheet: sheet, set: set };
}

// Escribe muchas filas de una sola vez (evita cientos de appendRow() sueltos, que
// satura el servicio Sheets y termina en "Exception: Service Spreadsheets failed").
function appendRowsBatch_(sheet, rows) {
  if (!rows.length) return;
  var startRow = sheet.getLastRow() + 1;
  sheet.getRange(startRow, 1, rows.length, rows[0].length).setValues(rows);
}

// Todas las fuentes de Planes de Acción, en una sola lista (mismo criterio que getTabSupervisiones)
function obtenerTodosLosPlanes_() {
  function safeRead(fn) { try { return fn(); } catch(e) { return null; } }
  var chk      = safeRead(function() { return readMondayChecklists_(); }) || { planes: [] };
  var rapida   = safeRead(function() { return readMondayRapida_(); })    || [];
  var integral = safeRead(function() { return readMondayIntegral_(); })  || [];
  return rapida.concat(integral).concat(chk.planes || []);
}

// Divide "Álvaro Arancibia, Ramón Vera" / "Álvaro Arancibia y Ramón Vera" en nombres individuales
function splitResponsables_(responsable) {
  return String(responsable || '')
    .split(/,| y |&/i)
    .map(function(s){ return s.trim(); })
    .filter(Boolean);
}

function enviarEmailPlanNuevo_(email, nombreResp, plan) {
  var fechaLimFmt = plan.fechaLim ? plan.fechaLim.substring(0, 10).split('-').reverse().join('/') : 'sin definir';
  var meta = [plan.cliente, plan.movil].filter(Boolean).join(' · ');
  MailApp.sendEmail({
    to: email,
    name: 'Dashboard On Street',
    subject: 'Nuevo plan de acción asignado — ' + (plan.cliente || 'Dashboard On Street'),
    htmlBody:
      '<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px">' +
      '<h2 style="color:#E84717;margin:0 0 16px">Dashboard On Street</h2>' +
      '<p style="color:#333">Hola ' + nombreResp + ', te agregaron como responsable de un nuevo plan de acción:</p>' +
      '<div style="background:#f7f6f2;border-radius:10px;padding:16px 18px;margin:16px 0">' +
      (meta ? '<div style="font-size:12px;color:#888;margin-bottom:6px">' + meta + '</div>' : '') +
      '<div style="font-size:15px;color:#1a1a1a;font-weight:600;margin-bottom:6px">' + (plan.descripcion || plan.name || '—') + '</div>' +
      '<div style="font-size:13px;color:#5f5e5a">Fecha límite: <strong>' + fechaLimFmt + '</strong></div>' +
      '</div>' +
      '<p style="margin:24px 0"><a href="' + NOTIF_DASHBOARD_URL + '" style="background:#E84717;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">Ver en el Dashboard</a></p>' +
      '<p style="color:#999;font-size:12px">Dashboard On Street · notificación automática</p>' +
      '</div>'
  });
}

// Ejecutar manualmente desde el editor para ver cómo llega el email de "plan nuevo" a tu correo.
// Cambiá el email de destino en la línea de abajo si querés probar con otro.
function probarEmailPlanNuevo() {
  var destino = 'lsepulveda@onstreet.cl';
  var planEjemplo = {
    cliente:     'La Araucana Móvil',
    movil:       'Agencia Coronel',
    descripcion: '(PRUEBA) Reparar puerta mampara porque no cierra',
    name:        '(PRUEBA) Reparar puerta mampara porque no cierra',
    fechaLim:    formatDateISO(new Date(new Date().getTime() + 5 * 24 * 60 * 60 * 1000))
  };
  enviarEmailPlanNuevo_(destino, 'Luciana', planEjemplo);
  Logger.log('Email de prueba enviado a ' + destino);
}

// Detecta planes de acción nuevos (no notificados aún) y avisa por email al/los responsable/s.
// Pensada para correr con un trigger de tiempo (ver setupNotificacionesPlanesTrigger).
function revisarYNotificarPlanesNuevos() {
  var planes = obtenerTodosLosPlanes_();
  var notif  = getPlanesYaNotificados_();
  var nuevos = planes.filter(function(p) { return p.id && !notif.set[String(p.id)]; });
  if (!nuevos.length) return { ok: true, nuevos: 0 };

  var emailMap = getResponsableEmailMap_();
  var ahora = new Date();
  var enviados = 0;
  var filasNotificados = [];
  var filasSinEmail = [];

  nuevos.forEach(function(p) {
    var nombres = splitResponsables_(p.responsable);
    var algunoEncontrado = false;
    nombres.forEach(function(nombre) {
      var email = emailMap[normalize_(nombre)];
      if (email) {
        try { enviarEmailPlanNuevo_(email, nombre, p); enviados++; algunoEncontrado = true; }
        catch(e) { Logger.log('Error enviando email a ' + email + ': ' + e); }
      }
    });
    if (!algunoEncontrado && nombres.length) {
      filasSinEmail.push([ahora, p.id, p.responsable || '', p.cliente || '', p.movil || '', p.descripcion || p.name || '']);
    }
    filasNotificados.push([p.id, ahora]);
  });

  if (filasSinEmail.length) appendRowsBatch_(getOrCreateSheet_(NOTIF_SIN_EMAIL_TAB, ['Notado el', 'PlanId', 'Responsable', 'Cliente', 'Móvil', 'Descripción']), filasSinEmail);
  appendRowsBatch_(notif.sheet, filasNotificados);

  return { ok: true, nuevos: nuevos.length, emailsEnviados: enviados };
}

// Ejecutar UNA VEZ desde el editor de Apps Script ANTES de instalar el trigger.
// Marca todos los planes ya existentes como "ya notificados" (sin mandar mails)
// para que revisarYNotificarPlanesNuevos() solo avise de los que se creen de ahora en más.
function inicializarPlanesNotificados() {
  var planes = obtenerTodosLosPlanes_();
  var notif  = getPlanesYaNotificados_();
  var ahora  = new Date();
  var filas  = [];
  planes.forEach(function(p) {
    if (p.id && !notif.set[String(p.id)]) {
      filas.push([p.id, ahora]);
      notif.set[String(p.id)] = true; // evita duplicados si `planes` repite algún id
    }
  });
  appendRowsBatch_(notif.sheet, filas);
  Logger.log('Planes marcados como ya vistos (sin email): ' + filas.length);
  return { ok: true, marcados: filas.length };
}

// Ejecutar UNA VEZ desde el editor de Apps Script para instalar el trigger periódico.
function setupNotificacionesPlanesTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'revisarYNotificarPlanesNuevos') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('revisarYNotificarPlanesNuevos').timeBased().everyMinutes(15).create();
  Logger.log('Trigger instalado: revisarYNotificarPlanesNuevos cada 15 min');
}

function getTabSupervisiones(params) {
  var token = (params && params.token) || null;
  var usuario = verificarToken_(token);
  if (!usuario) return { authError: 'token_invalido' };
  function safeRead(fn) { try { return fn(); } catch(e) { return null; } }
  var flotaInfo = safeRead(function() { return getCached('flota', readFlota, CACHE_DURATION_SECONDS); }) || { flota: [], jefePorMovil: {}, jefePorNombre: {}, kams: [] };

  return {
    supervisiones:       safeRead(function() { return getCached('supervisiones', function() { return readSupervisiones(flotaInfo); }, CACHE_DURATION_SECONDS); }),
    mondaySupervisiones: safeRead(function() { return readMondayConsolidado_(); }),
    mondayPlanes: (function() {
      var chk      = safeRead(function() { return readMondayChecklists_(); }) || { planes: [], colEstadoId: null };
      var rapida   = safeRead(function() { return readMondayRapida_(); })    || [];
      var integral = safeRead(function() { return readMondayIntegral_(); })  || [];
      var all      = rapida.concat(integral).concat(chk.planes);
      all.sort(function(a,b){ return (b.fecha||'').localeCompare(a.fecha||''); });
      return { planes: all, colEstadoId: chk.colEstadoId };
    })(),
    lastUpdated: new Date().toISOString()
  };
}

// Callable desde google.script.run y desde doGet source=reporte_perdida_ruta
// fechaInicio / fechaFin: "YYYY-MM-DD"
function readPerdidaRutaData(cliente, fechaInicio, fechaFin) {
  if (!fechaInicio || !fechaFin) throw new Error('Rango de fechas inválido');
  const nc = normalize_(cliente || '');

  function enRango(fechaRaw) {
    var f = parseFlexibleDate(fechaRaw);
    if (!f) return false;
    var s = formatDateISO(f);
    return s >= fechaInicio && s <= fechaFin;
  }

  function findIdx(headers, name) {
    var n = name.toLowerCase();
    for (var j = 0; j < headers.length; j++) {
      if (headers[j].toLowerCase() === n) return j;
    }
    return -1;
  }

  var dbg = {};

  // ── Fase 1: CalendarioTransformado → calMap[normalize(movil)+"|"+fechaISO] = maxPermitidas
  var calMap = {}; // key → { maxPermitidas, movilRaw }
  var planificadas = 0;
  try {
    const ssGPS    = SpreadsheetApp.openById(SHEETS.informesGPS);
    const calSheet = ssGPS.getSheetByName('CalendarioTransformado');
    dbg.calExiste = !!calSheet;
    if (calSheet && calSheet.getLastRow() > 1) {
      const calVals    = calSheet.getRange(1, 1, calSheet.getLastRow(), calSheet.getLastColumn()).getValues();
      const calHeaders = calVals[0].map(function(h){ return String(h).trim(); });
      dbg.calHeaders   = calHeaders;
      dbg.calTotalRows = calVals.length - 1;
      const idxFecha   = findIdx(calHeaders, 'Fecha');
      const idxCliente = findIdx(calHeaders, 'Cliente');
      const idxMovil   = idxCliente >= 0 ? -1 : findIdx(calHeaders, 'Móvil');
      function findHorario(headers, candidates) {
        for (var c = 0; c < candidates.length; c++) { var ix = findIdx(headers, candidates[c]); if (ix >= 0) return ix; }
        return -1;
      }
      const idxIni1 = findHorario(calHeaders, ['Horario de Inicio 1','Horario de Inicio','Hora de Inicio 1','Hora de Inicio','Inicio 1','Inicio']);
      const idxFin1 = findHorario(calHeaders, ['Horario de Fin 1','Horario de Fin','Hora de Fin 1','Hora de Fin','Fin 1','Fin']);
      const idxIni2 = findIdx(calHeaders, 'Horario de Inicio 2');
      const idxFin2 = findIdx(calHeaders, 'Horario de Fin 2');
      dbg.calIdxFecha = idxFecha; dbg.calIdxMovil = idxMovil;
      dbg.calIdxIni1 = idxIni1; dbg.calIdxFin1 = idxFin1;
      dbg.calIdxIni2 = idxIni2; dbg.calIdxFin2 = idxFin2;

      for (var i = 1; i < calVals.length; i++) {
        var row = calVals[i];
        if (nc) {
          if (idxCliente >= 0) { if (normalize_(String(row[idxCliente]||'')) !== nc) continue; }
          else if (idxMovil >= 0) { if (normalize_(String(row[idxMovil]||'')).indexOf(nc) === -1) continue; }
        }
        var fechaRawCal = row[idxFecha >= 0 ? idxFecha : 0];
        if (!enRango(fechaRawCal)) continue;
        var fechaISOCal = formatDateISO(parseFlexibleDate(fechaRawCal));
        var movilRaw    = idxMovil >= 0 ? String(row[idxMovil]||'').trim() : (idxCliente >= 0 ? String(row[idxCliente]||'').trim() : '');
        var calKey      = normalize_(movilRaw) + '|' + fechaISOCal;
        var entry = calMap[calKey] || { maxPermitidas: 0, movilRaw: movilRaw };
        entry.maxPermitidas++;
        planificadas++;
        // Segunda ruta fuera del horario de la primera → una más
        var ini2 = idxIni2 >= 0 ? parseHHMM(row[idxIni2]) : null;
        var fin2 = idxFin2 >= 0 ? parseHHMM(row[idxFin2]) : null;
        if (ini2 !== null && fin2 !== null) {
          var ini1 = idxIni1 >= 0 ? parseHHMM(row[idxIni1]) : null;
          var fin1 = idxFin1 >= 0 ? parseHHMM(row[idxFin1]) : null;
          var dentro = ini1 !== null && fin1 !== null && ini2 >= ini1 && fin2 <= fin1;
          if (!dentro) { entry.maxPermitidas++; planificadas++; }
        }
        calMap[calKey] = entry;
      }
    }
  } catch(e) { Logger.log('readPerdidaRuta calMap: ' + e); dbg.calError = String(e); }

  // ── Fase 2: Finalizados → finMap[normalize(cliente+" "+notacion)+"|"+fechaISO] = { count, movilRaw, fechaISO }
  var finMap = {}; // key → { count, movilRaw, fechaISO }
  var ejecutadas = 0;
  try {
    const ssFin    = SpreadsheetApp.openById(SHEETS.finalizados);
    const finSheet = ssFin.getSheetByName('Finalizados') || ssFin.getSheets()[0];
    dbg.finExiste  = !!finSheet;
    if (finSheet && finSheet.getLastRow() > 1) {
      const finVals    = finSheet.getRange(1, 1, finSheet.getLastRow(), finSheet.getLastColumn()).getValues();
      const finHeaders = finVals[0].map(function(h){ return String(h).trim(); });
      dbg.finHeaders   = finHeaders;
      dbg.finTotalRows = finVals.length - 1;
      const idxFecha    = findIdx(finHeaders, 'Fecha');
      const idxCliente  = findIdx(finHeaders, 'Cliente');
      const idxNotacion = findIdx(finHeaders, 'Notacion');
      dbg.finIdxFecha = idxFecha; dbg.finIdxCliente = idxCliente; dbg.finIdxNotacion = idxNotacion;

      for (var i = 1; i < finVals.length; i++) {
        var row = finVals[i];
        if (nc && idxCliente >= 0 && normalize_(String(row[idxCliente]||'')) !== nc) continue;
        var fechaRawFin = row[idxFecha >= 0 ? idxFecha : 0];
        if (!enRango(fechaRawFin)) continue;
        var fechaISOFin  = formatDateISO(parseFlexibleDate(fechaRawFin));
        var clienteVal   = idxCliente  >= 0 ? String(row[idxCliente] ||'').trim() : '';
        var notacionVal  = idxNotacion >= 0 ? String(row[idxNotacion]||'').trim() : '';
        var movilFull    = (clienteVal + (notacionVal ? ' ' + notacionVal : '')).trim();
        var finKey       = normalize_(movilFull) + '|' + fechaISOFin;
        var fe = finMap[finKey] || { count: 0, movilRaw: movilFull, fechaISO: fechaISOFin };
        fe.count++;
        finMap[finKey] = fe;
        ejecutadas++;
      }
    }
  } catch(e) { Logger.log('readPerdidaRuta finMap: ' + e); dbg.finError = String(e); }

  // ── Fase 3: cruzar para encontrar rutas demás
  var rutasExtra = [];
  Object.keys(finMap).forEach(function(key) {
    var fin = finMap[key];
    var cal = calMap[key];
    var maxPermitidas = cal ? cal.maxPermitidas : 0;
    var extra = fin.count - maxPermitidas;
    if (extra > 0) {
      rutasExtra.push({ fecha: fin.fechaISO, movil: fin.movilRaw, planificadas: maxPermitidas, ejecutadas: fin.count, extra: extra });
    }
  });
  rutasExtra.sort(function(a, b) { return a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0; });

  const noEjecutadas = Math.max(0, planificadas - ejecutadas);
  const pct = planificadas > 0 ? (noEjecutadas / planificadas * 100).toFixed(1) : '0.0';
  return { ok: true, planificadas: planificadas, ejecutadas: ejecutadas, noEjecutadas: noEjecutadas, porcentajePerdida: pct, rutasExtra: rutasExtra, _dbg: dbg };
}

function respond(obj, callback) {
  const json = JSON.stringify(obj);
  if (callback && /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(callback)) {
    return ContentService.createTextOutput(callback + '(' + json + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function getCached(key, fn, durationSec) {
  const cache = CacheService.getScriptCache();
  const cacheKey = 'os_v18_' + key;
  const cached = cache.get(cacheKey);
  if (cached) { try { return JSON.parse(cached); } catch (e) {} }
  const data = fn();
  const json = JSON.stringify(data);
  if (json.length < CACHE_MAX_BYTES) {
    try { cache.put(cacheKey, json, durationSec || CACHE_DURATION_SECONDS); } catch (e) {}
  }
  return data;
}

// Normaliza un string: lowercase, sin tildes, sin paréntesis, espacios colapsados
function normalize_(s) {
  if (!s) return '';
  return String(s)
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[\(\)]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ============================================================================
// LECTOR: FLOTA
// ============================================================================
function readFlota() {
  const ss = SpreadsheetApp.openById(SHEETS.unificador);
  const sheet = ss.getSheetByName('Flota');
  if (!sheet) throw new Error('Pestaña "Flota" no encontrada');

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return { flota: [], jefePorMovil: {}, jefePorNombre: {} };

  // Lookup case-insensitive + sin tildes para mayor robustez
  const headers = values[0].map(h => String(h || '').trim());
  const headersN = headers.map(h => normalize_(h));
  function col(names) {
    for (let i = 0; i < names.length; i++) {
      const idx = headersN.indexOf(normalize_(names[i]));
      if (idx >= 0) return idx;
    }
    return -1;
  }
  const fIdx = {
    cliente:       col(['Cliente', 'CLIENTE']),
    movil:         col(['Móvil', 'MÓVIL', 'Movil', 'MOVIL']),
    conductor:     col(['Conductor', 'CONDUCTOR', 'Nombre Conductor']),
    kam:           col(['KAM', 'Kam', 'Jefe Operaciones']),
    sucursal:      col(['Sucursal', 'SUCURSAL']),
    movilCompleto: col(['Movil', 'Nombre Móvil', 'Nombre Movil'])
  };

  if (fIdx.cliente === -1 || fIdx.movil === -1) throw new Error('Columnas Cliente/Móvil no encontradas en Flota. Headers: ' + headers.slice(0, 10).join(', '));

  const flota = [];
  const flotaSet = {};
  const jefePorMovil = {};
  const jefePorNombre = {};

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const cliente = String(row[fIdx.cliente] || '').trim();
    const movil = String(row[fIdx.movil] || '').trim();
    if (!cliente || !movil) continue;

    const key = (cliente + '|' + movil).toLowerCase();
    if (flotaSet[key]) continue;
    flotaSet[key] = true;

    const nombre = fIdx.movilCompleto >= 0
      ? String(row[fIdx.movilCompleto] || (cliente + ' ' + movil)).trim()
      : (cliente + ' ' + movil);
    const kam = fIdx.kam >= 0 ? String(row[fIdx.kam] || '').trim() : '';

    flota.push({
      cliente: cliente, movil: movil, nombre: nombre,
      conductor: fIdx.conductor >= 0 ? String(row[fIdx.conductor] || '').trim() : '',
      kam: kam, jefeOperaciones: kam,
      sucursal: fIdx.sucursal >= 0 ? String(row[fIdx.sucursal] || '').trim() : ''
    });

    jefePorMovil[key] = kam;
    if (nombre) jefePorNombre[nombre.toLowerCase()] = kam;
  }

  // Lista única de KAMs (para el selector global del dashboard)
  const kamsSet = {};
  flota.forEach(function(f){ if(f.kam) kamsSet[f.kam] = true; });
  const kams = Object.keys(kamsSet).sort();

  return { flota: flota, jefePorMovil: jefePorMovil, jefePorNombre: jefePorNombre, kams: kams };
}

// ============================================================================
// LECTOR: UNIFICADOR
// ============================================================================
function readUnificador(flotaInfo, fechaParam) {
  const ss = SpreadsheetApp.openById(SHEETS.unificador);
  flotaInfo = flotaInfo || readFlota();
  const flota = flotaInfo.flota;

  const targetDate = fechaParam ? parseFlexibleDate(fechaParam) : new Date();
  if (!targetDate || isNaN(targetDate.getTime())) throw new Error('Fecha inválida: ' + fechaParam);
  targetDate.setHours(0, 0, 0, 0);
  const today = targetDate;

  const inicios = readRouteEvents(ss, 'Inicio de Ruta', today, {
    fecha: 'Fecha', cliente: 'Cliente', movil: 'Móvil',
    conductor: 'Nombre Conductor', hora: 'Hora', comuna: 'Comuna',
    comentario: 'Comentario', lugar: 'Lugar de Atención',
    idItem: 'Id Item', otroConductor: 'Otro Conductor', reemplazaACol: 'Reemplaza a'
  });

  // ↓ Ahora también leemos "Hora" en términos para detectar orden cronológico
  const terminos = readRouteEvents(ss, 'Termino de Ruta', today, {
    fecha: 'Fecha', cliente: 'Cliente', movil: 'Móvil',
    conductor: 'Nombre Conductor', hora: 'Hora', comentario: 'Comentario',
    indicadores: 'Indicadores', comuna: 'Comuna'
  });

  // Historial de inicios (para sugerir titular: un reemplazo con racha larga)
  let histInicios = {};
  try { histInicios = readHistorialInicios_(ss, today, 200); } catch (e) { histInicios = {}; }

  // Agrupar por móvil (un móvil puede tener varios inicios y términos en el mismo día)
  const iniciosPorMovil = {};
  const terminosPorMovil = {};
  inicios.forEach(function(e){
    const k = normalize_(e.cliente) + '|' + normalize_(e.movil);
    if (!iniciosPorMovil[k]) iniciosPorMovil[k] = [];
    iniciosPorMovil[k].push(e);
  });
  terminos.forEach(function(e){
    const k = normalize_(e.cliente) + '|' + normalize_(e.movil);
    if (!terminosPorMovil[k]) terminosPorMovil[k] = [];
    terminosPorMovil[k].push(e);
  });
  // Respaldo: para días ya cerrados, "Finalizados" se archiva 1 vez (trigger 1 AM) leyendo
  // directamente "Termino de Ruta". Si un móvil no tiene término en la lectura en vivo pero
  // sí quedó archivado ahí, se toma como confirmación de que la ruta sí se cerró.
  const esConsultaHoy = formatDateISO(today) === formatDateISO(new Date());
  if (!esConsultaHoy) {
    const finalizadosPorMovil = readFinalizadosPorDia_(today);
    Object.keys(finalizadosPorMovil).forEach(function(key){
      if (!terminosPorMovil[key] || terminosPorMovil[key].length === 0) {
        const fin = finalizadosPorMovil[key];
        terminosPorMovil[key] = [{
          cliente: fin.cliente, movil: fin.movil, conductor: fin.conductor,
          hora: fin.horaTermino, comuna: fin.comuna, comentario: '', indicadores: '', rowIdx: 0
        }];
      }
    });
  }

  // Ordenar cronológicamente por hora dentro de cada móvil
  function sortByHora(arr){ arr.sort(function(a, b){ return String(a.hora || '').localeCompare(String(b.hora || '')); }); }
  Object.keys(iniciosPorMovil).forEach(function(k){ sortByHora(iniciosPorMovil[k]); });
  Object.keys(terminosPorMovil).forEach(function(k){ sortByHora(terminosPorMovil[k]); });

  const moviles = flota.map(function(f) {
    const key = normalize_(f.cliente) + '|' + normalize_(f.movil);
    const inisArr = iniciosPorMovil[key] || [];
    const tersArr = terminosPorMovil[key] || [];
    const cantInicios = inisArr.length;
    const cantTerminos = tersArr.length;

    // ─── Detectar conductor distinto al titular ───
    const condTitular = normalize_(f.conductor || '');
    const alertasInicio = inisArr.map(function(ini){
      const cond = normalize_(ini.conductor || '');
      const esReemplazo = condTitular && cond && cond !== condTitular;
      // reemplazaA: usa "Reemplaza a" o "Otro Conductor" del sheet, sino infiere desde el titular
      const reemplazaA = ini.reemplazaACol || ini.otroConductor || (esReemplazo ? (f.conductor || '') : '');
      return {
        hora: ini.hora || '',
        conductor: ini.conductor || '',
        esReemplazo: esReemplazo,
        reemplazaA: reemplazaA,
        movilReemplazado: '',
        comuna: ini.comuna || '',
        lugar: ini.lugar || '',
        idItem: ini.idItem || '',
        rowIdx: ini.rowIdx || 0,
        _sheetRow: ini.rowIdx || 0
      };
    });
    const tieneReemplazo = alertasInicio.some(function(a){ return a.esReemplazo; });

    // ─── Detectar doble inicio sin término registrado ───
    // Hay doble inicio cuando hay más rutas iniciadas que (términos + 1).
    // Ejemplos: 2i/0t → sí | 2i/1t → no (una cerró, la otra activa) | 3i/1t → sí
    const dobleInicioSinTermino = cantInicios > cantTerminos + 1;

    // ─── Consolidar indicadores: sumar atenciones de TODOS los términos ───
    let totalAtenciones = 0;
    const breakdownAcc = {};
    tersArr.forEach(function(ter){
      const ind = parsearIndicadores_(ter.indicadores);
      totalAtenciones += ind.total;
      ind.breakdown.forEach(function(it){
        breakdownAcc[it.key] = (breakdownAcc[it.key] || 0) + it.value;
      });
    });
    const breakdown = Object.keys(breakdownAcc)
      .map(function(k){ return { key: k, value: breakdownAcc[k] }; })
      .sort(function(a, b){ return b.value - a.value; });

    // ─── Titular sugerido: racha de un conductor de reemplazo ───
    const rachaReemplazo = calcularRachaReemplazo_(histInicios[key] || [], f.conductor || '');
    const sugerenciaTitular = (rachaReemplazo && rachaReemplazo.sugerido)
      ? { conductor: rachaReemplazo.conductor, rutas: rachaReemplazo.rutas, desde: rachaReemplazo.desde }
      : null;

    const conductorActual = cantInicios > 0 ? inisArr[cantInicios - 1].conductor :
                            (cantTerminos > 0 ? tersArr[cantTerminos - 1].conductor : f.conductor);
    const horaPrimerInicio = cantInicios > 0 ? inisArr[0].hora : '';
    const comunaActual = cantInicios > 0 ? inisArr[cantInicios - 1].comuna :
                        (cantTerminos > 0 ? tersArr[cantTerminos - 1].comuna : '');
    const lugarActual = cantInicios > 0 ? inisArr[cantInicios - 1].lugar : '';

    return {
      cliente: f.cliente, movil: f.movil, nombre: f.nombre,
      conductor: conductorActual,
      conductorTitular: f.conductor || '',
      hora: horaPrimerInicio,
      comuna: comunaActual, lugar: lugarActual,
      kam: f.kam, jefeOperaciones: f.jefeOperaciones, sucursal: f.sucursal,

      // Backward compat (0/1)
      inicio: cantInicios > 0 ? 1 : 0,
      termino: cantTerminos > 0 ? 1 : 0,

      // Contadores reales
      cantInicios: cantInicios,
      cantTerminos: cantTerminos,
      rutasEnCurso: Math.max(0, cantInicios - cantTerminos),

      // Alertas
      alertasInicio: alertasInicio,
      tieneReemplazo: tieneReemplazo,
      rachaReemplazo: rachaReemplazo,
      sugerenciaTitular: sugerenciaTitular,
      dobleInicioSinTermino: dobleInicioSinTermino,
      multiplesRutas: cantInicios > 1,

      // Atenciones consolidadas
      actividadTotal: totalAtenciones,
      atenciones: totalAtenciones,
      breakdown: breakdown,

      indicadoresRaw: cantTerminos > 0 ? String(tersArr[cantTerminos - 1].indicadores || '').slice(0, 300) : '',
      comentarioInicio: cantInicios > 0 ? String(inisArr[0].comentario || '').slice(0, 150) : '',
      comentarioTermino: cantTerminos > 0 ? String(tersArr[cantTerminos - 1].comentario || '').slice(0, 150) : '',
      horaTermino: cantTerminos > 0 ? (tersArr[cantTerminos - 1].hora || '') : '',
      lastInicioRowIdx: cantInicios > 0 ? (inisArr[cantInicios - 1].rowIdx || 0) : 0,
      lastInicioIdItem: cantInicios > 0 ? (inisArr[cantInicios - 1].idItem || '') : '',
      esMovilDeReemplazo: false,
      _canEditFlota: !!(f.conductor)
    };
  });

  // Detectar móviles de reemplazo: entradas en Inicio de Ruta que no matchearon ningún vehículo de Flota
  const flotaKeys = new Set(moviles.map(function(m){ return (m.cliente + '|' + m.movil).toLowerCase(); }));
  const movilesDeReemplazo = [];
  Object.keys(iniciosPorMovil).forEach(function(k){
    if (flotaKeys.has(k)) return;
    const inisArr = iniciosPorMovil[k];
    const tersArr = terminosPorMovil[k] || [];
    const ini = inisArr[inisArr.length - 1];
    const cantI = inisArr.length, cantT = tersArr.length;
    movilesDeReemplazo.push({
      cliente: ini.cliente, movil: ini.movil,
      nombre: ini.cliente + ' ' + ini.movil,
      conductor: ini.conductor || '',
      conductorTitular: ini.otroConductor || '',
      hora: ini.hora || '', comuna: ini.comuna || '', lugar: ini.lugar || '',
      kam: '', sucursal: '', jefeOperaciones: '',
      inicio: 1, termino: cantT > 0 ? 1 : 0,
      cantInicios: cantI, cantTerminos: cantT,
      rutasEnCurso: Math.max(0, cantI - cantT),
      atenciones: 0, actividadTotal: 0, breakdown: [],
      tieneReemplazo: false, esMovilDeReemplazo: true,
      dobleInicioSinTermino: false, multiplesRutas: cantI > 1,
      alertasInicio: inisArr.map(function(i){ return { hora: i.hora, conductor: i.conductor, esReemplazo: false, reemplazaA: '', _sheetRow: i.rowIdx || 0, rowIdx: i.rowIdx || 0 }; }),
      lastInicioRowIdx: ini.rowIdx || 0, lastInicioIdItem: ini.idItem || '',
      _canEditFlota: false
    });
  });

  const totalInicios = inicios.length;
  const totalTerminos = terminos.length;
  // Ojo: NO usar Object.keys(iniciosPorMovil/terminosPorMovil).length acá —
  // esos mapas incluyen entradas de "Inicio de Ruta" que no matchean ningún
  // vehículo de Flota (los que terminan en movilesDeReemplazo), así que
  // inflan el conteo respecto al total real de la flota (moviles.length) y
  // desincronizan la tarjeta KPI del tooltip de detalle (que sí filtra sobre
  // `moviles`). Se cuenta directo sobre `moviles` para que ambos coincidan.
  const movilesConInicio = moviles.filter(function(m){ return m.inicio === 1; }).length;
  const movilesConTermino = moviles.filter(function(m){ return m.termino === 1; }).length;
  const movilesConDobles = moviles.filter(function(m){ return m.multiplesRutas; }).length;
  const movilesConReemplazo = moviles.filter(function(m){ return m.tieneReemplazo; }).length;
  const movilesConDobleInicioSinTermino = moviles.filter(function(m){ return m.dobleInicioSinTermino; }).length;
  const totalActividad = moviles.reduce(function(s, m){ return s + (m.actividadTotal || 0); }, 0);

  return {
    moviles: moviles,
    movilesDeReemplazo: movilesDeReemplazo,
    fecha: formatDateDDMMYYYY(today),
    stats: {
      flotaTotal: flota.length,
      iniciosHoy: totalInicios,
      terminosHoy: totalTerminos,
      movilesConInicio: movilesConInicio,
      movilesConTermino: movilesConTermino,
      movilesConDobles: movilesConDobles,
      movilesConReemplazo: movilesConReemplazo,
      movilesConDobleInicioSinTermino: movilesConDobleInicioSinTermino,
      rutasEnCurso: Math.max(0, totalInicios - totalTerminos),
      totalActividad: totalActividad,
      totalAtenciones: totalActividad
    }
  };
}

// Parsea el campo Indicadores y devuelve {total, breakdown}.
//
// Acepta cualquiera de estos formatos por celda:
//   - JSON estricto:                  {"Atenciones": 23, "Trámites": 5}
//   - JSON-like sin comillas en keys: {Atenciones: 23, Trámites: 5}
//   - JSON-like con keys vacías:      {"Total Afiliados Ejecutivo 1": 2, "Total Afiliados Ejecutivo 2": ,}
//   - Texto plano:                    "Atenciones: 23, Trámites: 5"
//   - Número directo
//
// Reglas:
//   1. Solo cuenta pares "clave: número entero positivo o cero" (ignora vacíos, null, strings).
//   2. Si existe un campo consolidador ("Total atenciones", "Total personas atendidas",
//      "Total Pacientes Atendidos", "Total Atenciones") cuyo valor coincide aproximadamente
//      con la suma del resto, usa ese como total y el resto como breakdown
//      (evita doble conteo).
//   3. Si no hay consolidador, suma todos los campos.
//   4. breakdown es array de {key, value} solo con valores > 0, ordenado desc.
function parsearIndicadores_(v) {
  if (v === null || v === undefined || v === '') return { total: 0, breakdown: [] };
  if (typeof v === 'number') return { total: Math.max(0, Math.floor(v)), breakdown: [] };
  const s = String(v).trim();
  if (!s) return { total: 0, breakdown: [] };
  if (/^\d+$/.test(s)) return { total: parseInt(s, 10), breakdown: [] };

  // Regex tolerante: captura "key": número  o  key: número
  // Permite letras, dígitos, espacios, paréntesis, guiones, puntos, %, <, >, /, & en el nombre.
  const re = /["']?([A-Za-z0-9ÁÉÍÓÚáéíóúÑñ\u00C0-\u017F\(\)\-\.\s<>%\/&]+?)["']?\s*:\s*([0-9]+)(?=\s*[,\}\n\r]|\s*$)/g;
  const items = [];
  let m;
  while ((m = re.exec(s)) !== null) {
    const key = m[1].trim().replace(/^["']|["']$/g, '');
    const val = parseInt(m[2], 10);
    if (!isNaN(val) && val > 0 && key) {
      items.push({ key: key, value: val });
    }
  }
  if (items.length === 0) return { total: 0, breakdown: [] };

  // Detectar consolidador
  const CONSOLIDATORS = [
    'total atenciones', 'total personas atendidas',
    'total pacientes atendidos', 'total pacientes con necesidad de derivacion a especialista'
  ];
  // Campos demográficos: son desgloses de las mismas personas, no atenciones adicionales
  const DEMO_EXACT = ['hombre', 'mujer', 'sexo masculino', 'sexo femenino'];
  const DEMO_PREFIX = ['rango'];
  function isDemografico_(key) {
    const n = normalize_(key);
    if (DEMO_EXACT.indexOf(n) >= 0) return true;
    for (var d = 0; d < DEMO_PREFIX.length; d++) { if (n.indexOf(DEMO_PREFIX[d]) === 0) return true; }
    return false;
  }

  let consolidadorIdx = -1;
  for (let i = 0; i < items.length; i++) {
    if (CONSOLIDATORS.indexOf(normalize_(items[i].key)) >= 0) {
      consolidadorIdx = i;
      break;
    }
  }

  let total, breakdown;
  if (consolidadorIdx >= 0) {
    const cons = items[consolidadorIdx];
    // Verificar que el consolidador no sea sospechoso: si la suma del resto es
    // 0 (no hay desglose), igual usar el consolidador como total.
    const otros = items.filter(function(_, i){ return i !== consolidadorIdx; });
    const sumaOtros = otros.reduce(function(a, b){ return a + b.value; }, 0);
    // Si la suma del resto es muy distinta al consolidador (>2x o <0.5x), preferir la suma.
    // Esto cubre casos raros donde "Total atenciones" no calza con el detalle.
    if (sumaOtros > 0 && (sumaOtros > cons.value * 2 || sumaOtros < cons.value * 0.5)) {
      total = sumaOtros;
      breakdown = otros.slice().sort(function(a, b){ return b.value - a.value; });
    } else {
      total = cons.value;
      breakdown = otros.sort(function(a, b){ return b.value - a.value; });
    }
  } else {
    // Sin consolidador: sumar solo campos de atenciones, excluir demográficos
    const atencItems = items.filter(function(it){ return !isDemografico_(it.key); });
    total = atencItems.reduce(function(a, b){ return a + b.value; }, 0);
    breakdown = atencItems.slice().sort(function(a, b){ return b.value - a.value; });
  }
  return { total: total, breakdown: breakdown };
}

function readRouteEvents(ss, sheetName, targetDate, colMap) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error('Pestaña "' + sheetName + '" no encontrada');
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const values = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();
  const headers = values[0].map(h => String(h || '').trim());
  const idx = {};
  Object.keys(colMap).forEach(field => { idx[field] = headers.indexOf(colMap[field]); });

  if (idx.fecha === -1) throw new Error('Columna "' + colMap.fecha + '" no encontrada en ' + sheetName);

  const targetDay = formatDateISO(targetDate);
  const eventos = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const fechaRaw = row[idx.fecha];
    if (!fechaRaw) continue;
    const fecha = parseFlexibleDate(fechaRaw);
    if (!fecha || isNaN(fecha.getTime())) continue;
    if (formatDateISO(fecha) !== targetDay) continue;

    const evt = { fecha: targetDay, rowIdx: i + 1 };
    Object.keys(idx).forEach(field => {
      if (field === 'fecha') return;
      if (idx[field] >= 0) {
        const v = row[idx[field]];
        if (field === 'hora') evt[field] = formatTime(v);
        else evt[field] = String(v || '').trim();
      }
    });
    // Si no hay columna Hora separada, extrae el tiempo del campo Fecha (datetime)
    if (!evt.hora && fechaRaw instanceof Date) evt.hora = formatTime(fechaRaw);
    eventos.push(evt);
  }
  return eventos;
}

// Nombres de conductor que no son una persona real (no pueden ser titular sugerido)
function esConductorValido_(c) {
  const n = normalize_(c);
  if (!n) return false;
  return ['otro', 'otros', 'n/a', 'na', 's/i', 'si', 'sin conductor', 'sin informacion',
          'conductor', 'reemplazo', 'pendiente', '-', '.', 'x'].indexOf(n) < 0;
}

// Historial de "quién manejó cada móvil cada día" en los últimos `dias` días.
// Fuente principal: archivo "Finalizados" (SHEETS.finalizados) — acumula histórico.
// Se completa con "Inicio de Ruta" en vivo para los días que aún no se archivaron.
// Devuelve, por móvil, [{ f: Date, c: conductor }] con UNA entrada por día,
// ordenada del más reciente al más viejo. Para sugerir titular.
function readHistorialInicios_(ss, hastaFecha, dias) {
  ss = ss || SpreadsheetApp.openById(SHEETS.unificador);
  const corte = new Date(hastaFecha ? hastaFecha.getTime() : Date.now());
  corte.setHours(0, 0, 0, 0);
  corte.setDate(corte.getDate() - (dias || 200));

  // porMovil[key][fechaISO] = conductor (primer registro del día gana)
  const porMovil = {};
  function add_(cliente, movil, fecha, cond) {
    if (!cliente || !movil || !cond) return;
    if (!fecha || isNaN(fecha.getTime()) || fecha < corte) return;
    const key = normalize_(cliente) + '|' + normalize_(movil);
    const fiso = formatDateISO(fecha);
    if (!porMovil[key]) porMovil[key] = {};
    if (!(fiso in porMovil[key])) porMovil[key][fiso] = String(cond).trim();
  }
  function scan_(sheet, cols) {
    if (!sheet) return;
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return;
    const values = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();
    const hN = values[0].map(function(h){ return normalize_(h); });
    function idx_(names){ for (var i = 0; i < names.length; i++){ var k = hN.indexOf(normalize_(names[i])); if (k >= 0) return k; } return -1; }
    const iF = idx_(cols.fecha), iC = idx_(cols.cliente), iM = idx_(cols.movil), iK = idx_(cols.conductor);
    if (iF < 0 || iC < 0 || iM < 0 || iK < 0) return;
    for (var i = 1; i < values.length; i++) {
      add_(String(values[i][iC] || '').trim(), String(values[i][iM] || '').trim(),
           parseFlexibleDate(values[i][iF]), String(values[i][iK] || '').trim());
    }
  }

  // 1) Archivo histórico
  try {
    const finSS = SpreadsheetApp.openById(SHEETS.finalizados);
    scan_(finSS.getSheetByName('Finalizados') || finSS.getSheets()[0],
          { fecha: ['Fecha'], cliente: ['Cliente'], movil: ['Notacion', 'Notación', 'Móvil', 'Movil'], conductor: ['Conductor', 'Nombre Conductor'] });
  } catch (e) { /* seguir con lo que haya */ }

  // 2) Días recientes aún no archivados
  scan_(ss.getSheetByName('Inicio de Ruta'),
        { fecha: ['Fecha'], cliente: ['Cliente'], movil: ['Móvil', 'Movil'], conductor: ['Nombre Conductor', 'Conductor'] });

  const hist = {};
  Object.keys(porMovil).forEach(function(key){
    hist[key] = Object.keys(porMovil[key])
      .map(function(fiso){ return { f: parseFlexibleDate(fiso), c: porMovil[key][fiso] }; })
      .sort(function(a, b){ return b.f - a.f; });
  });
  return hist;
}

// Dado el historial de inicios de un móvil y su titular, calcula la "racha" de
// reemplazo: inicios consecutivos (desde el más reciente) de conductores != titular,
// cortando en cuanto reaparece el titular. Devuelve null si no hay racha.
function calcularRachaReemplazo_(evs, titular) {
  const titN = normalize_(titular || '');
  if (!titN || !evs || evs.length === 0) return null;
  const racha = [];
  for (let x = 0; x < evs.length; x++) {
    if (normalize_(evs[x].c) === titN) break;   // titular manejó → corta (regla: 1 vez reinicia)
    racha.push(evs[x]);
  }
  if (racha.length === 0) return null;
  const porCond = {};
  racha.forEach(function(e){
    if (!esConductorValido_(e.c)) return;   // "Otro", "S/I", etc. no pueden ser titular
    const n = normalize_(e.c);
    if (!porCond[n]) porCond[n] = { nombre: e.c, k: 0 };
    porCond[n].k++;
  });
  let dom = null;
  Object.keys(porCond).forEach(function(n){ if (!dom || porCond[n].k > dom.k) dom = porCond[n]; });
  if (!dom) return null;   // la racha es solo de conductores sin identificar
  const dominante = dom.k >= racha.length * 0.8;
  return {
    conductor:  dom.nombre,
    rutas:      dom.k,
    rachaTotal: racha.length,
    desde:      formatDateISO(racha[racha.length - 1].f),
    dominante:  dominante,
    sugerido:   dominante && dom.k >= 22   // umbral: 22 rutas
  };
}

// ============================================================================
// LECTOR: GPS
// ============================================================================
// LECTOR: GPS — hoja Base de Informes GPS
// ============================================================================

// Fingerprint de palabras: normaliza, quita "movil", reemplaza separadores,
// ordena palabras → resultado comparable sin importar orden ni acentos.
// Ejemplos:
//   "Caja 18 Móvil Osorno"        → "18|caja|osorno"
//   "Caja 18 Osorno"              → "18|caja|osorno"   (mismo fp)
//   "Clínica Dental 1 - Lampa"    → "1|clinica|dental|lampa"
//   "Lampa Clínica Dental 1"      → "1|clinica|dental|lampa"   (mismo fp)
function fingerprintGPS_(s) {
  return normalize_(s)
    .replace(/\bmovil\b/g, '')
    .replace(/[\/\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(function(w) { return w.length > 1; })
    .sort()
    .join('|');
}

function readGPS(flotaInfo) {
  flotaInfo = flotaInfo || readFlota();

  // Doble índice de Flota:
  //   flotaByFP      → fingerprint(cliente + movil) → entrada de flota
  //   flotaByMovilFP → fingerprint(movil)            → entrada de flota (fallback)
  const flotaByFP = {}, flotaByMovilFP = {};
  (flotaInfo.flota || []).forEach(function(f) {
    const fp  = fingerprintGPS_(f.cliente + ' ' + f.movil);
    const fpM = fingerprintGPS_(f.movil);
    if (!flotaByFP[fp])      flotaByFP[fp]      = f;
    if (!flotaByMovilFP[fpM]) flotaByMovilFP[fpM] = f;
  });

  const ss = SpreadsheetApp.openById(SHEETS.informesGPS);
  const sheet = ss.getSheetByName('Base');
  if (!sheet) return { rutas: [], fecha: formatDateISO(new Date()), stats: { total: 0, conAtraso: 0, enHorario: 0, sinMovimiento: 0, alejandose: 0 } };

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { rutas: [], fecha: formatDateISO(new Date()), stats: { total: 0, conAtraso: 0, enHorario: 0, sinMovimiento: 0, alejandose: 0 } };

  const values = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();
  const headers = values[0].map(function(h) { return String(h || '').trim(); });

  const idx = {
    agrupacion: headers.indexOf('Agrupación'),
    comienzo:   headers.indexOf('Comienzo'),
    fin:        headers.indexOf('Fin'),
    posFinal:   headers.indexOf('Posición final'),
    coordInic:  headers.indexOf('Coordenadas iniciales'),
    coordFin:   headers.indexOf('Coordenadas finales')
  };
  if (idx.agrupacion === -1) throw new Error('Falta columna "Agrupación" en hoja Base de Informes GPS');

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = formatDateISO(today);

  // Recolectar TODOS los viajes de hoy por Agrupación (de abajo a arriba = más reciente primero)
  const todasPorAgr = {}; // agr → [row más reciente, row anterior, ...]
  for (var i = lastRow - 1; i >= 1; i--) {
    const row = values[i];
    const agr = String(row[idx.agrupacion] || '').trim();
    if (!agr) continue;
    // Usar Comienzo o Fin para verificar la fecha
    const fechaRef = row[idx.comienzo] || row[idx.fin];
    if (!fechaRef) continue;
    const fecha = parseFlexibleDate(fechaRef);
    if (!fecha || formatDateISO(fecha) !== todayStr) continue;
    if (!todasPorAgr[agr]) todasPorAgr[agr] = [];
    todasPorAgr[agr].push(row);
  }

  const rutas = [];
  for (var agr in todasPorAgr) {
    const entries = todasPorAgr[agr]; // índice 0 = más reciente
    const row = entries[0]; // usar el viaje más reciente para posición/hora

    // dobleInicioSinTermino se determina desde readUnificador (hojas "Inicio de Ruta" / "Termino de Ruta")
    // No se infiere desde la hoja Base del GPS.

    // Limpiar Agrupación: quitar patente final (" - AB-1234" o " - AB1234")
    // y reemplazar guiones internos por espacios para el fingerprint
    const agrSinPatente = agr.replace(/\s*-\s*[A-Z]{2,4}[-]?\d{2,4}\s*$/, '');
    const fp = fingerprintGPS_(agrSinPatente);

    // Buscar en Flota: primero por (cliente+movil), luego solo por movil
    const flotaEntry = flotaByFP[fp] || flotaByMovilFP[fp];

    const cliente = flotaEntry ? flotaEntry.cliente : '';
    const movil   = flotaEntry ? flotaEntry.movil   : agrSinPatente.replace(/-/g, ' ').trim();
    const nombre  = (cliente + ' ' + movil).trim() || agr;
    const kam     = flotaEntry ? (flotaEntry.kam || '') : '';

    const coordFin  = idx.coordFin  >= 0 ? parseLatLng(row[idx.coordFin])  : null;
    const coordInic = idx.coordInic >= 0 ? parseLatLng(row[idx.coordInic]) : null;
    const posicion  = coordFin || coordInic;
    const horaFin   = idx.fin >= 0 ? formatTime(row[idx.fin]) : '';
    const posDesc   = idx.posFinal >= 0 ? String(row[idx.posFinal] || '').trim() : '';

    rutas.push({
      nombre: nombre, cliente: cliente, movil: movil,
      jefeOperaciones: kam,
      posicionReal: posicion,
      puntoPlanificado: null,
      tipoAlerta: posicion ? 'Con GPS' : 'Sin datos',
      sinMovimiento: false, alejandose: false,
      distanciaMetros: null, atrasoMinutos: null,
      horaUltimo: horaFin,
      posicionDescripcion: posDesc
    });
  }

  // Fusionar alertas del spreadsheet Tiempo Real
  try {
    const alertMap = readGPSAlertas_();
    rutas.forEach(function(r) {
      const fp = fingerprintGPS_(r.nombre);
      const a = alertMap[fp];
      if (a) {
        r.tipoAlerta          = a.tipoAlerta;
        r.sinMovimiento       = a.sinMovimiento;
        r.alejandose          = a.alejandose;
        r.distanciaMetros     = a.distanciaMetros;
        r.puntoPlanificado    = a.puntoPlanificado;
        r.atrasoMinutos       = a.atrasoMinutos;
        r.tieneRutaCalendario = true;
      }
    });
  } catch (e) { /* alertas opcionales, no bloquear */ }

  return {
    rutas: rutas, fecha: todayStr,
    stats: {
      total:         rutas.length,
      conAtraso:     rutas.filter(function(r){ return r.tipoAlerta === 'Atraso'; }).length,
      enHorario:     rutas.filter(function(r){ return r.tipoAlerta === 'En horario'; }).length,
      sinMovimiento: rutas.filter(function(r){ return r.sinMovimiento; }).length,
      alejandose:    rutas.filter(function(r){ return r.alejandose; }).length
    }
  };
}

// Lee alertas del spreadsheet GPS Tiempo Real (Calendario diario)
function readGPSAlertas_() {
  const ss = SpreadsheetApp.openById(SHEETS.gpsRealTime);
  const sheet = ss.getSheetByName('Calendario diario') || ss.getSheets()[0];
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return {};

  const values = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();
  const headers = values[0].map(function(h){ return String(h||'').trim(); });

  const idx = {
    movil:      headers.indexOf('Movil'),
    fecha:      headers.indexOf('Fecha'),
    estadoRuta: headers.indexOf('Estado de Ruta'),
    punto1:     headers.indexOf('Punto de Atención'),
    sinMov:     headers.indexOf('Alerta no Movimiento'),
    dist1:      headers.indexOf('Distancia Punto de Atención 1'),
    alej1:      headers.indexOf('Alerta Alejándose punto 1'),
    dist2:      headers.indexOf('Distancia Punto de Atención 2'),
    alej2:      headers.indexOf('Alerta Alejándose Punto 2')
  };
  if (idx.movil === -1 || idx.fecha === -1) return {};

  const today = new Date(); today.setHours(0,0,0,0);
  const todayStr = formatDateISO(today);
  const alertMap = {};

  for (var i = 1; i < values.length; i++) {
    const row = values[i];
    const fechaRaw = row[idx.fecha];
    if (!fechaRaw) continue;
    const fecha = parseFlexibleDate(fechaRaw);
    if (!fecha || formatDateISO(fecha) !== todayStr) continue;

    const movilStr = String(row[idx.movil]||'').trim();
    if (!movilStr) continue;
    const fp = fingerprintGPS_(movilStr);
    if (alertMap[fp]) continue; // ya procesado

    const estado = idx.estadoRuta >= 0 ? String(row[idx.estadoRuta]||'').trim() : '';
    var tipoAlerta = 'Con GPS';
    if (estado.indexOf('Atraso')     >= 0) tipoAlerta = 'Atraso';
    else if (estado.indexOf('En horario') >= 0) tipoAlerta = 'En horario';

    const sinMov = idx.sinMov >= 0 && String(row[idx.sinMov]||'').indexOf('✓') >= 0;
    const alej1  = idx.alej1  >= 0 && String(row[idx.alej1] ||'').indexOf('✓') >= 0;
    const alej2  = idx.alej2  >= 0 && String(row[idx.alej2] ||'').indexOf('✓') >= 0;
    const dist1  = idx.dist1  >= 0 ? lastNumberGPS_(row[idx.dist1]) : null;
    const dist2  = idx.dist2  >= 0 ? lastNumberGPS_(row[idx.dist2]) : null;
    const punto  = idx.punto1 >= 0 ? parseLatLng(row[idx.punto1]) : null;
    const tGPS   = calcularTiempoGPS_(row, idx, estado, dist1, dist2, alej1, alej2);

    alertMap[fp] = {
      tipoAlerta:       tipoAlerta,
      sinMovimiento:    sinMov,
      alejandose:       alej1 || alej2,
      distanciaMetros:  dist1 !== null ? dist1 : dist2,
      puntoPlanificado: punto,
      atrasoMinutos:    tGPS.atrasoMinutos
    };
  }
  return alertMap;
}

function timeToMinutesGPS_(v) {
  const t = formatTime(v); if (!t) return null;
  const m = String(t).match(/^(\d{1,2}):(\d{2})/); if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}
function lastNumberGPS_(v) {
  if (v === null || v === undefined || v === '') return null;
  const nums = String(v).split(',').map(x => parseFloat(String(x).trim())).filter(n => !isNaN(n));
  return nums.length ? nums[nums.length - 1] : null;
}
function extractMinutesGPS_(texto) {
  if (!texto) return null;
  const s = String(texto);
  let m = s.match(/\((\d+)\s*min/i); if (m) return parseInt(m[1], 10);
  m = s.match(/(\d+)\s*minutos/i); if (m) return parseInt(m[1], 10);
  m = s.match(/(\d+)\s*min/i); if (m) return parseInt(m[1], 10);
  return null;
}
function extractPuntoGPS_(texto) {
  if (!texto) return null;
  const m = String(texto).match(/Punto\s*(1|2)/i);
  return m ? parseInt(m[1], 10) : null;
}
function calcularTiempoGPS_(row, idx, estado, dist1, dist2, alej1, alej2) {
  const ahora = new Date();
  const ahoraMin = ahora.getHours() * 60 + ahora.getMinutes();
  const ini1 = idx.horaInicio1 >= 0 ? timeToMinutesGPS_(row[idx.horaInicio1]) : null;
  const fin1 = idx.horaFin1 >= 0 ? timeToMinutesGPS_(row[idx.horaFin1]) : null;
  const ini2 = idx.horaInicio2 >= 0 ? timeToMinutesGPS_(row[idx.horaInicio2]) : null;
  const fin2 = idx.horaFin2 >= 0 ? timeToMinutesGPS_(row[idx.horaFin2]) : null;
  const estadoTxt = String(estado || '');
  const estadoLower = estadoTxt.toLowerCase();

  let puntoActivo = extractPuntoGPS_(estadoTxt) || 1;
  if (!extractPuntoGPS_(estadoTxt)) {
    if (ini2 !== null && (ahoraMin >= ini2 || (fin1 !== null && ahoraMin > fin1))) puntoActivo = 2;
  }
  const iniActivo = puntoActivo === 2 ? ini2 : ini1;
  const finActivo = puntoActivo === 2 ? fin2 : fin1;
  const distActivo = puntoActivo === 2 ? dist2 : dist1;
  const alejActivo = puntoActivo === 2 ? alej2 : alej1;

  let atrasoMinutos = null, salidaAnticipadaMinutos = null;
  if (estadoLower.indexOf('atraso') >= 0) {
    atrasoMinutos = extractMinutesGPS_(estadoTxt);
    if (atrasoMinutos === null && iniActivo !== null && ahoraMin > iniActivo) atrasoMinutos = ahoraMin - iniActivo;
  }
  if (estadoLower.indexOf('anticipado') >= 0 || estadoLower.indexOf('temprano') >= 0 || estadoLower.indexOf('salio antes') >= 0 || estadoLower.indexOf('salió antes') >= 0) {
    salidaAnticipadaMinutos = extractMinutesGPS_(estadoTxt);
  }
  if (salidaAnticipadaMinutos === null && alejActivo && finActivo !== null && ahoraMin < finActivo && distActivo !== null && distActivo > 200) {
    salidaAnticipadaMinutos = finActivo - ahoraMin;
  }
  return { puntoActivo: puntoActivo, atrasoMinutos: atrasoMinutos, salidaAnticipadaMinutos: salidaAnticipadaMinutos };
}

function parseLatLng(v) {
  if (!v) return null;
  const s = String(v).trim();
  const m = s.match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/);
  if (!m) return null;
  const lat = parseFloat(m[1]); const lng = parseFloat(m[2]);
  if (isNaN(lat) || isNaN(lng)) return null;
  return [lat, lng];
}

function detectClienteFromMovil(nombreCompleto) {
  const clientes = ['Habitat Móvil', 'La Araucana Móvil', 'Caja 18', 'CGE Móvil',
    'Punto Caja Los Andes', 'Punto Caja los Andes', 'Fundación Acrux', 'Mutual',
    'Minera Los Pelambres', 'Los Pelambres', 'Centinela', 'Lampa', 'Naranjo y Asociados'];
  for (let i = 0; i < clientes.length; i++) {
    if (nombreCompleto.indexOf(clientes[i]) === 0) return clientes[i];
  }
  return nombreCompleto.split(' ')[0];
}

// ============================================================================
// LECTOR: FINALIZADOS
// ============================================================================

// Lectura puntual de "Finalizados" para una sola fecha (usada como respaldo de
// confirmación de término en readUnificador). Devuelve un mapa
// normalize_(cliente)+'|'+normalize_(movil) -> { cliente, movil, conductor, comuna, horaInicio, horaTermino }
function readFinalizadosPorDia_(targetDate) {
  const targetDay = formatDateISO(targetDate);
  const result = {};
  const ss = SpreadsheetApp.openById(SHEETS.finalizados);
  const sheet = ss.getSheetByName('Finalizados') || ss.getSheets()[0];
  if (!sheet) return result;
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return result;

  const values = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();
  const headers = values[0].map(function(h){ return String(h || '').trim(); });
  const idx = {};
  headers.forEach(function(h, i){ idx[h] = i; });

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const fechaRaw = row[idx['Fecha']];
    if (!fechaRaw) continue;
    const fecha = parseFlexibleDate(fechaRaw);
    if (!fecha || isNaN(fecha.getTime())) continue;
    if (formatDateISO(fecha) !== targetDay) continue;

    const cliente = String(row[idx['Cliente']] || '').trim();
    const movil = String(row[idx['Notacion']] || '').trim();
    if (!cliente || !movil) continue;

    const key = normalize_(cliente) + '|' + normalize_(movil);
    result[key] = {
      cliente: cliente, movil: movil,
      conductor: String(row[idx['Conductor']] || '').trim(),
      comuna: String(row[idx['Comuna']] || '').trim(),
      horaInicio: formatTime(row[idx['Hora Inicio']]),
      horaTermino: formatTime(row[idx['Hora Termino']])
    };
  }
  return result;
}

function readFinalizados(fechaFinParam) {
  const ss = SpreadsheetApp.openById(SHEETS.finalizados);
  const sheet = ss.getSheetByName('Finalizados') || ss.getSheets()[0];
  if (!sheet) return { rutas: [], conteoPorDia: {}, conteoPorCliente: {}, totalRutas: 0, ventanaDias: FINALIZADOS_DAYS_BACK };
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2) return { rutas: [], conteoPorDia: {}, conteoPorCliente: {}, totalRutas: 0, ventanaDias: FINALIZADOS_DAYS_BACK };

  const values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  const headers = values[0];
  const idx = {};
  headers.forEach((h, i) => { idx[String(h).trim()] = i; });

  const fechaFin = fechaFinParam ? parseFlexibleDate(fechaFinParam) : new Date();
  if (!fechaFin || isNaN(fechaFin.getTime())) throw new Error('Fecha inválida en readFinalizados: ' + fechaFinParam);
  fechaFin.setHours(23, 59, 59, 999);

  // Ventana principal (30 días): para listado de rutas, Histórico y Tendencias actuales.
  const cutoff30 = new Date(fechaFin);
  cutoff30.setDate(cutoff30.getDate() - FINALIZADOS_DAYS_BACK);
  cutoff30.setHours(0, 0, 0, 0);

  // Ventana extendida (60 días): solo para conteos diarios, habilita comparación mensual en Tendencias.
  const cutoff60 = new Date(fechaFin);
  cutoff60.setDate(cutoff60.getDate() - TENDENCIAS_DAYS_BACK);
  cutoff60.setHours(0, 0, 0, 0);

  const rutas = [];
  const conteoPorDia = {};
  const conteoPorCliente = {};
  const conteoPorDia60 = {}; // conteos diarios para la ventana extendida de 60 días

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const fechaRaw = row[idx['Fecha']];
    if (!fechaRaw) continue;
    const fecha = parseFlexibleDate(fechaRaw);
    if (!fecha || isNaN(fecha.getTime())) continue;
    if (fecha < cutoff60 || fecha > fechaFin) continue;

    const fechaISO = formatDateISO(fecha);
    // Conteo extendido (60 días) — siempre si llegamos acá
    conteoPorDia60[fechaISO] = (conteoPorDia60[fechaISO] || 0) + 1;

    // Ventana principal (30 días): listado + agregados para Histórico
    if (fecha >= cutoff30) {
      const cliente = String(row[idx['Cliente']] || '').trim();
      const movil = String(row[idx['Notacion']] || '').trim();
      rutas.push({
        id: String(row[idx['ID']] || '').slice(0, 12),
        fecha: fechaISO, cliente: cliente, movil: movil,
        conductor: String(row[idx['Conductor']] || '').trim().slice(0, 60),
        region: String(row[idx['Region']] || '').trim(),
        comuna: String(row[idx['Comuna']] || '').trim(),
        lugar: String(row[idx['Lugar de Atencion']] || '').trim().slice(0, 80),
        horaInicio: formatTime(row[idx['Hora Inicio']]),
        horaTermino: formatTime(row[idx['Hora Termino']])
      });
      conteoPorDia[fechaISO] = (conteoPorDia[fechaISO] || 0) + 1;
      if (cliente) conteoPorCliente[cliente] = (conteoPorCliente[cliente] || 0) + 1;
    }
  }
  rutas.sort((a, b) => b.fecha.localeCompare(a.fecha));
  return {
    rutas: rutas.slice(0, 2000),
    conteoPorDia: conteoPorDia,
    conteoPorCliente: conteoPorCliente,
    conteoPorDia60: conteoPorDia60,
    totalRutas: rutas.length,
    ventanaDias: FINALIZADOS_DAYS_BACK,
    desde: formatDateISO(cutoff30),
    hasta: formatDateISO(fechaFin)
  };
}

// ============================================================================
// LECTOR: SEGUNDA RUTA
// ============================================================================
function readSegundaRuta(fechaParam) {
  const fechaTarget = fechaParam ? parseFlexibleDate(fechaParam) : new Date();
  if (!fechaTarget || isNaN(fechaTarget.getTime())) return { moviles: [], fecha: '' };
  const fechaISO = formatDateISO(fechaTarget);

  const ssGPS = SpreadsheetApp.openById(SHEETS.informesGPS);
  const calSheet = ssGPS.getSheetByName('CalendarioTransformado');
  if (!calSheet) return { moviles: [], fecha: fechaISO };

  const calVals = calSheet.getDataRange().getValues();
  if (calVals.length < 2) return { moviles: [], fecha: fechaISO };

  const calHeaders = calVals[0].map(function(h) { return String(h).trim(); });
  const calIdx = {};
  calHeaders.forEach(function(h, i) { calIdx[h] = i; });

  const conSegundaRuta = [];
  for (let i = 1; i < calVals.length; i++) {
    const row = calVals[i];
    const fechaRaw = row[calIdx['Fecha']];
    if (!fechaRaw) continue;
    const fecha = parseFlexibleDate(fechaRaw);
    if (!fecha || formatDateISO(fecha) !== fechaISO) continue;
    const horaInicio2 = String(row[calIdx['Horario de Inicio 2']] || '').trim();
    if (!horaInicio2) continue;
    const horaFin2 = String(row[calIdx['Horario de Fin 2']] || '').trim();
    // Verificar si la 2ª ruta está dentro del horario de la 1ª → si es así, no es segunda ruta real
    const ini1 = parseHHMM(row[calIdx['Horario de Inicio 1']]);
    const fin1 = parseHHMM(row[calIdx['Horario de Fin 1']]);
    const ini2 = parseHHMM(horaInicio2);
    const fin2 = parseHHMM(horaFin2);
    // Si faltan horarios de la 1ª ruta → tratar como 1ª ruta solamente (no agregar)
    if (ini1 === null || fin1 === null) continue;
    // Si la 2ª está completamente dentro de la 1ª → no es segunda ruta real
    if (ini2 !== null && fin2 !== null && ini2 >= ini1 && fin2 <= fin1) continue;
    conSegundaRuta.push({
      nombre: String(row[calIdx['Móvil']] || '').trim(),
      horaInicio2: horaInicio2,
      horaFin2: horaFin2
    });
  }

  if (conSegundaRuta.length === 0) return { moviles: [], fecha: fechaISO };

  // Contar eventos de inicio por móvil para detectar si la 2da ruta fue iniciada (≥2 inicos)
  const ssUni = SpreadsheetApp.openById(SHEETS.unificador);
  const iniEvents = readRouteEvents(ssUni, 'Inicio de Ruta', fechaTarget, {
    fecha: 'Fecha', cliente: 'Cliente', movil: 'Móvil'
  });

  const iniCount = {};
  iniEvents.forEach(function(ev) {
    const key = normalize_((ev.cliente || '') + ' ' + (ev.movil || ''));
    iniCount[key] = (iniCount[key] || 0) + 1;
  });

  const moviles = conSegundaRuta.map(function(m) {
    return {
      nombre: m.nombre,
      horaInicio2: m.horaInicio2,
      horaFin2: m.horaFin2,
      iniciada: (iniCount[normalize_(m.nombre)] || 0) >= 2
    };
  });

  return { moviles: moviles, fecha: fechaISO };
}

// ============================================================================
// LECTOR: SUPERVISIONES — v14
//   Match por columnas "Concat" y "Cliente" del Sheet (verdad explícita).
//   Fallback: estrategias antiguas (propagación de logos + normalización).
// ============================================================================
function readSupervisiones(flotaInfo) {
  const ss = SpreadsheetApp.openById(SHEETS.supervisiones);
  const sheet = ss.getSheetByName(SUPERVISIONES_TAB);
  if (!sheet) throw new Error('Pestaña "' + SUPERVISIONES_TAB + '" no encontrada');

  flotaInfo = flotaInfo || readFlota();
  const flota = flotaInfo.flota;

  // Índices de Flota para match
  const flotaPorClienteMovilExacto = {};
  const flotaPorClienteMovilNorm = {};
  const flotaPorNombre = {};
  const flotaPorNombreNorm = {};
  // Fingerprint de palabras para match parcial (ej. "Minera Los Pelambres" ↔ "Los Pelambres")
  const flotaFPWords = []; // [{words: Set, f}]
  function fpWords_(s) {
    return new Set(normalize_(s).replace(/\bmovil\b/g,'').replace(/[\/\-]/g,' ')
      .split(' ').filter(function(w){return w.length>1;}));
  }
  flota.forEach(f => {
    flotaPorClienteMovilExacto[(f.cliente + '|' + f.movil).toLowerCase()] = f;
    flotaPorClienteMovilNorm[normalize_(f.cliente + ' ' + f.movil)] = f;
    // Siempre indexar por cliente+movil para subset matching
    flotaFPWords.push({ words: fpWords_(f.cliente + ' ' + f.movil), f: f });
    if (f.nombre && normalize_(f.nombre) !== normalize_(f.cliente + ' ' + f.movil)) {
      flotaPorNombre[f.nombre.toLowerCase()] = f;
      flotaPorNombreNorm[normalize_(f.nombre)] = f;
      flotaFPWords.push({ words: fpWords_(f.nombre), f: f });
    } else if (f.nombre) {
      flotaPorNombre[f.nombre.toLowerCase()] = f;
      flotaPorNombreNorm[normalize_(f.nombre)] = f;
    }
  });
  // Subconjunto: todas las palabras de A están en B (o viceversa)
  function subsetMatch_(concatStr) {
    const cw = fpWords_(concatStr);
    if (cw.size === 0) return null;
    for (var i = 0; i < flotaFPWords.length; i++) {
      const fw = flotaFPWords[i].words;
      if (fw.size === 0) continue;
      // Verificar si fw ⊆ cw o cw ⊆ fw
      var fwInCw = true;
      fw.forEach(function(w){ if (!cw.has(w)) fwInCw = false; });
      if (fwInCw) return flotaFPWords[i].f;
      var cwInFw = true;
      cw.forEach(function(w){ if (!fw.has(w)) cwInFw = false; });
      if (cwInFw) return flotaFPWords[i].f;
    }
    return null;
  }

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    return { moviles: [], anio: '', stats: { flotaActiva: flota.length, cruzados: 0, sinCruce: flota.length } };
  }

  // ---- Detectar columnas por header ----
  // Las primeras filas pueden ser de título. Buscamos la fila que tenga
  // headers reconocibles ("Concat" o "Movil"/"Móvil" + "Cliente" + meses).
  const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const mesesNorm = meses.map(m => normalize_(m));

  let headerRow = -1;
  let idx = { concat: -1, cliente: -1, movil: -1, total: -1, mesesSup: -1, meta: -1, pctMovil: -1, meses: [] };

  for (let r = 0; r < Math.min(values.length, 10); r++) {
    const row = values[r].map(c => normalize_(c));
    const concatI = row.indexOf('concat');
    const clienteI = row.indexOf('cliente');
    // contar cuántos meses aparecen en esa fila
    let mesesFound = 0;
    mesesNorm.forEach(mn => { if (row.indexOf(mn) >= 0) mesesFound++; });
    if (concatI >= 0 && clienteI >= 0 && mesesFound >= 6) {
      headerRow = r;
      idx.concat = concatI;
      idx.cliente = clienteI;
      // Buscar índices de cada mes
      idx.meses = mesesNorm.map(mn => row.indexOf(mn));
      // móvil (columna del "código" o "nombre corto", opcional)
      idx.movil = row.indexOf('movil');
      if (idx.movil < 0) idx.movil = row.indexOf('móvil'.normalize('NFD').replace(/[\u0300-\u036f]/g,''));
      // total / meses sup / meta / pct — substring match (headers pueden ser "Total Supervisiones", "Meta Anual", etc.)
      const findSub_ = function(terms) {
        for (var t = 0; t < terms.length; t++) {
          var exact = row.indexOf(terms[t]);
          if (exact >= 0) return exact;
        }
        for (var t = 0; t < terms.length; t++) {
          for (var k = 0; k < row.length; k++) {
            if (row[k].indexOf(terms[t]) >= 0) return k;
          }
        }
        return -1;
      };
      idx.total    = findSub_(['total supervisiones', 'total']);
      idx.mesesSup = findSub_(['meses supervisados', 'meses sup']);
      idx.meta     = findSub_(['meta anual', 'meta']);
      idx.pctMovil = findSub_(['% cumplimiento visita anual movil', '% movil', 'cumplimiento', 'porcentaje']);
      break;
    }
  }

  // Fallback al esquema "v13" (sin headers) si no encontramos headers
  const usingHeaders = headerRow >= 0;
  if (!usingHeaders) {
    // Esquema legacy: col 0 = nombre completo, col 1 = cliente, col 3 = móvil,
    // meses col 5..16, total 17, mesesSup 18, meta 19, pctMovil 20.
    headerRow = 0;
    idx.concat = 0;
    idx.cliente = 1;
    idx.movil = 3;
    idx.meses = [];
    for (let j = 0; j < 12; j++) idx.meses.push(5 + j);
    idx.total = 17;
    idx.mesesSup = 18;
    idx.meta = 19;
    idx.pctMovil = 20;
  }

  // ---- Leer filas de datos ----
  const supPorFlotaKey = {};
  const filasSheet = [];      // 1 entrada por móvil presente en "Resumen Supervisiones" (en orden del sheet)
  const filasSheetSeen = {};  // dedupe por clave canónica
  const sinMatch = [];
  let lastCliente = '';

  // Filas de subtotal / total que a veces cuelgan al final de la hoja
  function esFilaTotal_(s) {
    const n = normalize_(s);
    return n === 'total' || n === 'totales' || n === 'suma' || n === 'suma total' ||
           n.indexOf('total general') >= 0 || n.indexOf('total flota') >= 0;
  }

  for (let i = headerRow + 1; i < values.length; i++) {
    const row = values[i];
    const concat = idx.concat >= 0 ? String(row[idx.concat] || '').trim() : '';
    let cliente = idx.cliente >= 0 ? String(row[idx.cliente] || '').trim() : '';
    const movil = idx.movil >= 0 ? String(row[idx.movil] || '').trim() : '';

    // Propagar cliente cuando viene vacío (caso logo)
    if (!cliente && (concat || movil) && lastCliente) cliente = lastCliente;
    else if (cliente) lastCliente = cliente;

    // Necesitamos al menos un identificador
    if (!concat && !movil) continue;
    if (!cliente && !concat) continue;
    // Saltar filas de subtotal/total
    if (esFilaTotal_(concat) || esFilaTotal_(cliente) || esFilaTotal_(movil)) continue;

    // Construir el objeto de datos (meses + agregados)
    const supMeses = {};
    for (let j = 0; j < 12; j++) {
      const col = idx.meses[j];
      const v = (col >= 0 && col < row.length) ? row[col] : '';
      supMeses[meses[j]] = (v === '' || v === null) ? 0 : (parseInt(v, 10) || 0);
    }

    const data = {
      meses: supMeses,
      total: idx.total >= 0 ? (parseInt(row[idx.total], 10) || 0) : 0,
      mesesSup: idx.mesesSup >= 0 ? (parseInt(row[idx.mesesSup], 10) || 0) : 0,
      meta: idx.meta >= 0 ? (parseFloat(row[idx.meta]) || 0) : 0,
      pctMovil: idx.pctMovil >= 0 ? (parseFloat(row[idx.pctMovil]) || 0) : 0
    };

    // ---- MATCH ----
    // Estrategia 1: por Concat → Flota.Movil (nombre completo)  ← match nuevo
    // Estrategia 2: por Cliente + Movil (exacto)
    // Estrategia 3: por Cliente + Movil (normalizado)
    // Estrategia 4: por nombre normalizado (Concat normalizado vs Flota.Movil normalizado)
    let f = null;

    if (concat) {
      f = flotaPorNombre[concat.toLowerCase()] || flotaPorNombreNorm[normalize_(concat)];
    }
    if (!f && cliente && movil) {
      const k1 = (cliente + '|' + movil).toLowerCase();
      f = flotaPorClienteMovilExacto[k1] || flotaPorClienteMovilNorm[normalize_(cliente + ' ' + movil)];
    }
    // Fallback: coincidencia por subconjunto de palabras (ej "Minera Los Pelambres Móvil" ↔ "Los Pelambres Móvil")
    if (!f && concat) {
      f = subsetMatch_(concat);
    }
    if (!f && cliente && movil) {
      f = subsetMatch_(cliente + ' ' + movil);
    }

    // Sólo se listan los móviles que están en la hoja de Supervisiones Y en la
    // Flota activa. Con esto quedan fuera:
    //  - filas que no son móviles (subtotales "Móviles Supervisados",
    //    "Supervisiones Totales", "Cumplimiento", etc.)
    //  - móviles marcados "Sin Funcionamiento" / dados de baja, que ya no están
    //    en la Flota
    //  - clientes/móviles recién agregados a Flota que todavía no están en la
    //    hoja de Supervisiones
    if (!f) {
      sinMatch.push({ concat: concat, cliente: cliente, movil: movil });
      continue;
    }
    supPorFlotaKey[(f.cliente + '|' + f.movil).toLowerCase()] = data;

    const outKey = (f.cliente + '|' + f.movil).toLowerCase();
    if (filasSheetSeen[outKey]) continue;   // el mismo móvil no se lista dos veces
    filasSheetSeen[outKey] = true;
    filasSheet.push({
      nombre: f.nombre, cliente: f.cliente, movil: f.movil,
      meses: data.meses, total: data.total, mesesSup: data.mesesSup,
      meta: data.meta, pctMovil: data.pctMovil
    });
  }

  // ── Recalcular los meses desde "BBDD Supervisiones" ─────────────────────────
  // Las columnas de meses de "Resumen Supervisiones 2026" son fórmulas
  // =SUMAPRODUCTO(...'BBDD Supervisiones'...). Google no las recalcula si nadie
  // tiene el archivo abierto, así que getValues() puede leer valores viejos.
  // Contamos los eventos crudos nosotros mismos → siempre coincide con la realidad.
  let bbddDiag = { ok: false };
  try {
    const bbdd = ss.getSheetByName('BBDD Supervisiones');
    if (bbdd) {
      const bv = bbdd.getDataRange().getValues();
      // Columnas C = "Concat" (Cliente + Móvil), D = Fecha — igual que las fórmulas
      // SUMAPRODUCTO de Panel/Resumen. Se detecta por header con fallback a C/D.
      let bIdxConcat = 2, bIdxFecha = 3, bHeaderRow = 0;
      for (let r = 0; r < Math.min(bv.length, 8); r++) {
        const hr = bv[r].map(c => normalize_(c));
        const ci = hr.indexOf('concat');
        let fi = hr.indexOf('fecha');
        if (fi < 0) fi = hr.indexOf('fecha supervision');
        if (fi < 0) fi = hr.indexOf('fecha de supervision');
        if (ci >= 0 && fi >= 0) { bHeaderRow = r; bIdxConcat = ci; bIdxFecha = fi; break; }
      }
      const anioNum = parseInt((SUPERVISIONES_TAB.match(/\d{4}/) || [])[0] || '0', 10);
      const countByKeyMonth = {};
      let contadas = 0;
      for (let i = bHeaderRow + 1; i < bv.length; i++) {
        const key = normalize_(bv[i][bIdxConcat]);
        if (!key) continue;
        const fecha = parseFlexibleDate(bv[i][bIdxFecha]);
        if (!fecha || isNaN(fecha.getTime())) continue;
        if (anioNum && fecha.getFullYear() !== anioNum) continue;
        if (!countByKeyMonth[key]) countByKeyMonth[key] = [0,0,0,0,0,0,0,0,0,0,0,0];
        countByKeyMonth[key][fecha.getMonth()]++;
        contadas++;
      }
      let aplicados = 0;
      if (Object.keys(countByKeyMonth).length > 0) {
        filasSheet.forEach(function(m) {
          // Clave = identidad real del móvil (Cliente + Móvil de la Flota), NUNCA
          // el "Concat" de la hoja resumen (puede venir de un cruce difuso errado).
          const c = countByKeyMonth[normalize_(m.cliente + ' ' + m.movil)] ||
                    countByKeyMonth[normalize_(m.nombre)];
          if (!c) return;   // sin registros en BBDD → se conserva lo de la hoja resumen
          const mm = {};
          let tot = 0, nMeses = 0;
          for (let j = 0; j < 12; j++) {
            mm[meses[j]] = c[j];
            tot += c[j];
            if (c[j] > 0) nMeses++;
          }
          m.meses = mm;
          m.total = tot;
          m.mesesSup = nMeses;
          m.pctMovil = m.meta > 0 ? nMeses / m.meta : 0;
          aplicados++;
        });
      }
      bbddDiag = { ok: true, contadas: contadas, claves: Object.keys(countByKeyMonth).length, aplicados: aplicados };
    } else {
      bbddDiag = { ok: false, motivo: 'tab BBDD Supervisiones no encontrada' };
    }
  } catch (e) {
    bbddDiag = { ok: false, error: String(e) };
    // "BBDD Supervisiones" no disponible → se usan los valores de "Resumen Supervisiones 2026"
  }

  // ---- Salida: móviles que están en "Resumen Supervisiones" Y en la Flota ----
  const moviles = filasSheet;

  return {
    moviles: moviles,
    anio: SUPERVISIONES_TAB.match(/\d{4}/) ? SUPERVISIONES_TAB.match(/\d{4}/)[0] : '',
    stats: {
      flotaActiva: flota.length,
      enSupervisiones: moviles.length,
      cruzados: moviles.filter(m => m.total > 0 || m.meta > 0).length,
      sinCruce: moviles.filter(m => m.total === 0 && m.meta === 0).length,
      filasSupervisionesSinMatch: sinMatch.length,
      modoHeaders: usingHeaders ? 'concat+cliente' : 'legacy-posicional',
      bbdd: bbddDiag
    }
  };
}

// ============================================================================
// LECTOR: BITÁCORA
// ============================================================================
function readBitacora(fechaFinParam) {
  const ss = SpreadsheetApp.openById(SHEETS.bitacora);
  const sheet = ss.getSheetByName('BBDD Bitácora') || ss.getSheets()[0];
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return { eventos: [], totalVentana: 0, desde: '', hasta: formatDateISO(new Date()), ventanaMeses: BITACORA_MONTHS_BACK };

  const headers = values[0];
  const idx = {};
  headers.forEach((h, i) => { idx[String(h).trim()] = i; });

  // Ventana: fija desde el 1 de enero de 2025 hasta fechaFinParam (o hoy)
  const fechaFin = fechaFinParam ? parseFlexibleDate(fechaFinParam) : new Date();
  if (!fechaFin || isNaN(fechaFin.getTime())) throw new Error('Fecha inválida en readBitacora: ' + fechaFinParam);
  fechaFin.setHours(23, 59, 59, 999);
  const cutoff = new Date(2025, 0, 1);
  cutoff.setHours(0, 0, 0, 0);

  // Ventana ampliada para Contingencias: desde el 1 de enero del año pasado hasta fechaFin
  const cutoffConting = new Date(fechaFin.getFullYear() - 1, 0, 1);

  const eventos = [];
  const contingenciasDetalle = [];
  // Conteo mensual de "Contingencia" sobre TODO el histórico (no acotado a la ventana de 12 meses)
  const contingPorMes = {}; // 'YYYY-MM' -> total

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const fechaRaw = row[idx['Fecha']];
    if (!fechaRaw) continue;
    const fecha = parseFlexibleDate(fechaRaw);
    if (!fecha || isNaN(fecha.getTime())) continue;

    // La columna "Tipo de Acontecimiento" puede traer varios tipos separados por coma
    // (ej. "Contingencia, Atraso") — se separan para que cada uno cuente donde corresponde.
    const tipoRaw = String(row[idx['Tipo de Acontecimiento']] || '').trim();
    const tipos = tipoRaw.split(',').map(function(t){ return t.trim(); }).filter(Boolean);
    const esContingencia = tipos.indexOf('Contingencia') >= 0;

    if (esContingencia) {
      const key = fecha.getFullYear() + '-' + String(fecha.getMonth() + 1).padStart(2, '0');
      contingPorMes[key] = (contingPorMes[key] || 0) + 1;

      if (fecha >= cutoffConting && fecha <= fechaFin) {
        contingenciasDetalle.push({
          fecha: formatDateISO(fecha),
          cliente: String(row[idx['Cliente']] || '').trim(),
          sucursal: String(row[idx['Sucursal']] || '').trim(),
          responsable: String(row[idx['Responsable']] || '').trim(),
          detalle: String(row[idx['Detalle Acontecimiento']] || '').trim().slice(0, 150),
          kam: String(row[idx['KAM']] || '').trim()
        });
      }
    }

    if (fecha < cutoff || fecha > fechaFin) continue;

    eventos.push({
      fecha: formatDateISO(fecha),
      mes: row[idx['Mes']] || (fecha.getMonth() + 1),
      anio: row[idx['Año']] || fecha.getFullYear(),
      cliente: String(row[idx['Cliente']] || '').trim(),
      sucursal: String(row[idx['Sucursal']] || '').trim(),
      conductor: String(row[idx['Conductor']] || '').trim().slice(0, 60),
      responsable: String(row[idx['Responsable']] || '').trim(),
      tipo: tipoRaw,
      tipos: tipos,
      detalle: String(row[idx['Detalle Acontecimiento']] || '').trim().slice(0, 150),
      kam: String(row[idx['KAM']] || '').trim()
    });
  }
  eventos.sort((a, b) => b.fecha.localeCompare(a.fecha));
  contingenciasDetalle.sort((a, b) => b.fecha.localeCompare(a.fecha));

  const contingenciasPorMes = Object.keys(contingPorMes).sort().map(function(key) {
    return { mes: key, total: contingPorMes[key] };
  });

  return {
    eventos: eventos.slice(0, 500),
    totalVentana: eventos.length,
    desde: formatDateISO(cutoff),
    hasta: formatDateISO(fechaFin),
    ventanaMeses: BITACORA_MONTHS_BACK,
    contingenciasPorMes: contingenciasPorMes,
    contingenciasDetalle: contingenciasDetalle.slice(0, 500)
  };
}

// ============================================================================
// PLANIFICACIÓN DE SUPERVISIONES (hoja "Planificación" en el spreadsheet de Supervisiones)
// ============================================================================
var PLANIFICACION_SHEET_GID_ = 2070853659;

function getPlanificacionSheet_() {
  var ss = SpreadsheetApp.openById(SHEETS.supervisiones);
  var sheet = ss.getSheets().filter(function(s){ return s.getSheetId() === PLANIFICACION_SHEET_GID_; })[0];
  if (!sheet) throw new Error('Hoja de Planificación no encontrada (gid ' + PLANIFICACION_SHEET_GID_ + ')');
  return sheet;
}

function planifIdx_(headers) {
  var idx = {};
  headers.forEach(function(h, i) { var k = String(h).trim(); if (!(k in idx)) idx[k] = i; });
  return idx;
}

function readPlanificacionSupervisiones_() {
  var sheet = getPlanificacionSheet_();
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  var idx = planifIdx_(values[0]);

  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var fechaRaw = row[idx['Fecha']];
    if (!fechaRaw) continue;
    var fecha = parseFlexibleDate(fechaRaw);
    if (!fecha || isNaN(fecha.getTime())) continue;

    var supervisores = [row[idx['Supervisor 1']], row[idx['Supervisor 2']], row[idx['Supervisor 3']]]
      .map(function(s) { return String(s || '').trim(); })
      .filter(Boolean);

    rows.push({
      rowIndex: i + 1,
      fecha: formatDateISO(fecha),
      movil: String(row[idx['Móvil']] || '').trim(),
      supervisores: supervisores,
      estado: String(row[idx['Estado']] || '').trim() || 'Programado'
    });
  }
  rows.sort(function(a, b) { return b.fecha.localeCompare(a.fecha); });
  return rows;
}

function getTabPlanificacion(params) {
  var token = (params && params.token) || null;
  var usuario = verificarToken_(token);
  if (!usuario) return { authError: 'token_invalido' };
  function safeRead(fn) { try { return fn(); } catch (e) { return { error: e.toString() }; } }
  return {
    planificacion: safeRead(function() { return getCached('planificacion', readPlanificacionSupervisiones_, CACHE_DURATION_SECONDS); }),
    lastUpdated: new Date().toISOString()
  };
}

// Agrega una fila a la hoja Planificación. Las columnas H:K (Concatenar, Mes, Lista
// Supervisores, Última Supervisión) están protegidas como solo-lectura y tienen fórmulas
// que se autocompletan solas — el script no las toca en absoluto, solo escribe en las
// columnas editables (Fecha, Móvil, Supervisor 1-3, Estado).
function agregarPlanificacionSupervision(params) {
  var token = (params && params.token) || null;
  var usuario = verificarToken_(token);
  if (!usuario) return { error: 'token_invalido' };

  var fecha = String((params && params.fecha) || '').trim();
  var cliente = String((params && params.cliente) || '').trim();
  var movilNombre = String((params && params.movil) || '').trim();
  var estado = String((params && params.estado) || 'Programado').trim();
  var supervisores = [];
  try { supervisores = JSON.parse((params && params.supervisores) || '[]'); } catch (e) {}
  supervisores = supervisores.map(function(s) { return String(s || '').trim(); }).filter(Boolean).slice(0, 3);

  if (!fecha || !cliente || !movilNombre || !supervisores.length) return { error: 'faltan_datos' };

  var movil = (cliente + ' ' + movilNombre).trim();

  var sheet = getPlanificacionSheet_();
  var lastCol = sheet.getLastColumn();
  var idx = planifIdx_(sheet.getRange(1, 1, 1, lastCol).getValues()[0]);

  // Última fila con Fecha real (más confiable que getLastRow(), que puede quedar inflado
  // por fórmulas o validaciones de datos precargadas en filas vacías).
  var colFecha = sheet.getRange(1, idx['Fecha'] + 1, sheet.getMaxRows(), 1).getValues();
  var lastDataRow = 1;
  for (var r = colFecha.length - 1; r >= 1; r--) { if (colFecha[r][0]) { lastDataRow = r + 1; break; } }
  var newRow = lastDataRow + 1;

  function setCell(headerName, value) {
    if (idx[headerName] == null) return;
    sheet.getRange(newRow, idx[headerName] + 1).setValue(value);
  }
  setCell('Fecha', new Date(fecha + 'T00:00:00'));
  setCell('Móvil', movil);
  setCell('Supervisor 1', supervisores[0] || '');
  setCell('Supervisor 2', supervisores[1] || '');
  setCell('Supervisor 3', supervisores[2] || '');
  setCell('Estado', estado);

  CacheService.getScriptCache().remove('os_v18_planificacion');
  return { ok: true, rowIndex: newRow };
}

// Elimina una fila de Planificación. Antes de borrar, verifica que la fila todavía
// corresponda a lo que el cliente cree que está borrando (fecha + móvil), por si la
// hoja cambió entre que se cargó la tabla y que se apretó eliminar.
function eliminarPlanificacionSupervision(params) {
  var token = (params && params.token) || null;
  var usuario = verificarToken_(token);
  if (!usuario) return { error: 'token_invalido' };

  var rowIndex = parseInt((params && params.rowIndex) || '0', 10);
  if (!rowIndex || rowIndex < 2) return { error: 'rowIndex_invalido' };

  var fechaEsperada = String((params && params.fecha) || '').trim();
  var movilEsperado = String((params && params.movil) || '').trim();

  var sheet = getPlanificacionSheet_();
  var lastCol = sheet.getLastColumn();
  var idx = planifIdx_(sheet.getRange(1, 1, 1, lastCol).getValues()[0]);

  if (rowIndex > sheet.getMaxRows()) return { error: 'fila_no_existe' };

  var rowVals = sheet.getRange(rowIndex, 1, 1, lastCol).getValues()[0];
  var fechaCell = rowVals[idx['Fecha']];
  var movilCell = String(rowVals[idx['Móvil']] || '').trim();
  var fechaCellISO = '';
  if (fechaCell) { var fParsed = parseFlexibleDate(fechaCell); if (fParsed && !isNaN(fParsed.getTime())) fechaCellISO = formatDateISO(fParsed); }

  if (fechaEsperada && fechaCellISO !== fechaEsperada) return { error: 'fila_no_coincide' };
  if (movilEsperado && movilCell !== movilEsperado) return { error: 'fila_no_coincide' };

  sheet.deleteRow(rowIndex);
  CacheService.getScriptCache().remove('os_v18_planificacion');
  return { ok: true };
}

// ============================================================================
// ESCRITURA: INICIO DE RUTA / FLOTA
// ============================================================================

// Llamada desde el cliente con google.script.run — actualiza campos de un inicio de ruta
function updateInicioRuta(rowIdx, conductor, comuna, lugar) {
  if (!rowIdx || rowIdx < 2) throw new Error('rowIdx inválido: ' + rowIdx);
  const ss = SpreadsheetApp.openById(SHEETS.unificador);
  const sheet = ss.getSheetByName('Inicio de Ruta');
  if (!sheet) throw new Error('Hoja "Inicio de Ruta" no encontrada');
  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h){ return String(h || '').trim(); });
  const updates = [];
  if (conductor != null) { const c = headers.indexOf('Nombre Conductor'); if (c >= 0) updates.push([c + 1, conductor]); }
  if (comuna   != null) { const c = headers.indexOf('Comuna');           if (c >= 0) updates.push([c + 1, comuna]); }
  if (lugar    != null) { const c = headers.indexOf('Lugar de Atención');if (c >= 0) updates.push([c + 1, lugar]); }
  updates.forEach(function(u){ sheet.getRange(rowIdx, u[0]).setValue(u[1]); });
  clearWriteCaches_();
  return { ok: true, rowIdx: rowIdx };
}

// Llamada desde el cliente — actualiza el conductor titular en la hoja Flota
function updateFlotaConductor(cliente, movil, newConductor) {
  const ss = SpreadsheetApp.openById(SHEETS.unificador);
  const sheet = ss.getSheetByName('Flota');
  if (!sheet) throw new Error('Hoja "Flota" no encontrada');
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(function(h){ return String(h || '').trim(); });
  const headersN = headers.map(function(h){ return normalize_(h); });
  function colIdx(names) {
    for (var i = 0; i < names.length; i++) {
      var idx = headersN.indexOf(normalize_(names[i]));
      if (idx >= 0) return idx;
    }
    return -1;
  }
  const idxC = colIdx(['Cliente', 'CLIENTE']);
  const idxM = colIdx(['Móvil', 'MÓVIL', 'Movil', 'MOVIL']);
  const idxK = colIdx(['Conductor', 'CONDUCTOR', 'Nombre Conductor']);
  if (idxC < 0) throw new Error('Columna "Cliente" no encontrada en Flota');
  if (idxM < 0) throw new Error('Columna "Móvil" no encontrada en Flota');
  if (idxK < 0) throw new Error('Columna "Conductor" no encontrada en Flota. Headers: ' + headers.slice(0,10).join(', '));
  const nc = normalize_(cliente), nm = normalize_(movil);
  for (var i = 1; i < values.length; i++) {
    if (normalize_(String(values[i][idxC] || '')) === nc && normalize_(String(values[i][idxM] || '')) === nm) {
      sheet.getRange(i + 1, idxK + 1).setValue(newConductor);
      clearWriteCaches_();
      return { ok: true };
    }
  }
  throw new Error('Móvil no encontrado en Flota: ' + cliente + ' / ' + movil);
}

// Confirma a un conductor de reemplazo como titular: reescribe la hoja Flota y
// deja registro en la hoja de auditoría "Cambios de Titular".
function confirmarTitularDeHecho(cliente, movil, conductor, rutas, desde, usuario) {
  if (!cliente || !movil || !conductor) throw new Error('Faltan datos (cliente / móvil / conductor)');
  const ss = SpreadsheetApp.openById(SHEETS.unificador);
  const flotaSheet = ss.getSheetByName('Flota');
  if (!flotaSheet) throw new Error('Hoja "Flota" no encontrada');

  // Titular anterior (para el registro)
  const fv = flotaSheet.getDataRange().getValues();
  const fh = fv[0].map(function(h){ return normalize_(h); });
  const ci = fh.indexOf('cliente');
  const mi = fh.indexOf('movil');
  let ki = fh.indexOf('conductor');
  if (ki < 0) ki = fh.indexOf('nombre conductor');
  let anterior = '';
  if (ci >= 0 && mi >= 0 && ki >= 0) {
    for (var i = 1; i < fv.length; i++) {
      if (normalize_(String(fv[i][ci] || '')) === normalize_(cliente) &&
          normalize_(String(fv[i][mi] || '')) === normalize_(movil)) {
        anterior = String(fv[i][ki] || '').trim();
        break;
      }
    }
  }

  updateFlotaConductor(cliente, movil, conductor);
  registrarCambioTitular_(cliente, movil, anterior, conductor, rutas, desde, usuario);
  return { ok: true, anterior: anterior };
}

function registrarCambioTitular_(cliente, movil, anterior, nuevo, rutas, desde, usuario) {
  try {
    const ss = SpreadsheetApp.openById(SHEETS.unificador);
    let sh = ss.getSheetByName('Cambios de Titular');
    if (!sh) {
      sh = ss.insertSheet('Cambios de Titular');
      sh.appendRow(['Fecha', 'Cliente', 'Móvil', 'Titular anterior', 'Titular nuevo', 'Rutas racha', 'Desde', 'Confirmado por']);
      sh.getRange(1, 1, 1, 8).setFontWeight('bold');
    }
    sh.appendRow([new Date(), cliente, movil, anterior, nuevo, rutas || '', desde || '', usuario || '']);
  } catch (err) {
    // El registro de auditoría no debe romper la confirmación
    Logger.log('registrarCambioTitular_ error: ' + err);
  }
}

function clearWriteCaches_() {
  const cache = CacheService.getScriptCache();
  const keys = [];
  const today = formatDateISO(new Date());
  ['v17', 'v18'].forEach(function(v){
    ['flota', 'unificador', 'unificador_today', 'unificador_' + today].forEach(function(k){
      keys.push('os_' + v + '_' + k);
    });
  });
  cache.removeAll(keys);
}

// ============================================================================
// LECTOR: KILÓMETROS (Informes GPS)
// ============================================================================
function readKilometros(flotaInfo) {
  flotaInfo = flotaInfo || readFlota();
  const flota = flotaInfo.flota;

  const flotaPorNombre = {}, flotaPorNombreNorm = {};
  flota.forEach(function(f) {
    if (f.nombre) {
      flotaPorNombre[f.nombre.toLowerCase()] = f;
      flotaPorNombreNorm[normalize_(f.nombre)] = f;
    }
  });
  const flotaSubstr = flota
    .filter(function(f) { return f.cliente && f.movil; })
    .map(function(f) { return { normCliente: normalize_(f.cliente), normMovil: normalize_(f.movil), item: f }; })
    .filter(function(f) { return f.normCliente.length > 2 && f.normMovil.length > 2; });

  const aliasMap = {
    'habitat movil v cordillera':               'Habitat Móvil Quillota',
    'habitat movil v costa':                    'Habitat Móvil 5ta Costa',
    'cge movil rancagua':                       "CGE Móvil O'Higgins",
    'la araucana movil agencia talca - curico': 'La Araucana Móvil Agencia Curicó',
    'movil de reemplazo - jrwl-21':             'CGE Móvil RM',
    'movil de reemplazo - jypx-20':             'CGE Móvil RM',
  };

  // Cargar aliases extras desde hoja "Alias Kilómetros" del Unificador (opcional)
  try {
    const ssUni = SpreadsheetApp.openById(SHEETS.unificador);
    const aliasSheet = ssUni.getSheetByName('Alias Kilómetros');
    if (aliasSheet) {
      const aliasVals = aliasSheet.getDataRange().getValues();
      for (let i = 1; i < aliasVals.length; i++) {
        const gpsNom   = String(aliasVals[i][0] || '').trim();
        const flotaNom = String(aliasVals[i][1] || '').trim();
        if (gpsNom && flotaNom) aliasMap[normalize_(gpsNom)] = flotaNom;
      }
    }
  } catch(e) { /* hoja no existe */ }

  const ssGPS = SpreadsheetApp.openById(SHEETS.informesGPS);
  const kmSheetData = findKmSheet_(ssGPS);
  if (!kmSheetData) return buildEmptyKm_(flota);

  const rawHeaders = kmSheetData.values[0];
  let idxAgr = -1, idxCom = -1, idxKm = -1;
  rawHeaders.forEach(function(h, i) {
    const n = normalize_(String(h || ''));
    if (n.indexOf('agrupacion') >= 0) idxAgr = i;
    if (n === 'comienzo') idxCom = i;
    if (n.indexOf('kilometr') >= 0) idxKm = i;
  });
  if (idxAgr < 0 || idxCom < 0 || idxKm < 0) return buildEmptyKm_(flota);

  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const todayISO = formatDateISO(todayStart);
  const semStart = new Date(todayStart); semStart.setDate(semStart.getDate() - 6);
  const mesStart = new Date(todayStart); mesStart.setDate(mesStart.getDate() - KM_DAYS_BACK);

  const byKey = {}, sinMatch = {};
  let filasProcesadas = 0, filasIgnoradas = 0;

  for (let r = 1; r < kmSheetData.values.length; r++) {
    const row = kmSheetData.values[r];
    const agrupacion = String(row[idxAgr] || '').trim();
    const comienzoRaw = row[idxCom];
    const kmRaw = row[idxKm];

    if (!agrupacion || !comienzoRaw || kmRaw === '' || kmRaw == null) { filasIgnoradas++; continue; }

    const fecha = parseGPSDate_(comienzoRaw);
    if (!fecha || isNaN(fecha.getTime()) || fecha < mesStart) { filasIgnoradas++; continue; }

    const km = parseGPSKm_(kmRaw);
    if (km === null || km < 0) { filasIgnoradas++; continue; }

    filasProcesadas++;
    const fechaISO = formatDateISO(fecha);
    const esHoy = fechaISO === todayISO;
    const esSem = fecha >= semStart;

    const nombreSinPlaca = stripPlate_(agrupacion);
    const nombreSinNum   = nombreSinPlaca.replace(/^\d+\s+/, '').trim();
    const normAgr        = normalize_(nombreSinNum);

    const aliasNombre = aliasMap[normAgr] || aliasMap[normalize_(nombreSinPlaca)] || aliasMap[normalize_(agrupacion)];

    let flotaItem = (aliasNombre
        ? (flotaPorNombre[aliasNombre.toLowerCase()] || flotaPorNombreNorm[normalize_(aliasNombre)])
        : null)
      || flotaPorNombre[nombreSinPlaca.toLowerCase()]
      || flotaPorNombreNorm[normalize_(nombreSinPlaca)]
      || flotaPorNombre[nombreSinNum.toLowerCase()]
      || flotaPorNombreNorm[normAgr]
      || flotaPorNombre[agrupacion.toLowerCase()]
      || flotaPorNombreNorm[normalize_(agrupacion)];

    if (!flotaItem) {
      let match = null;
      for (let fi = 0; fi < flotaSubstr.length; fi++) {
        if (normAgr.indexOf(flotaSubstr[fi].normCliente) >= 0 && normAgr.indexOf(flotaSubstr[fi].normMovil) >= 0) {
          match = flotaSubstr[fi]; break;
        }
      }
      flotaItem = match ? match.item : null;
    }

    if (!flotaItem) {
      flotaItem = flotaPorNombreNorm[normAgr + ' movil'] || null;
    }

    if (!flotaItem) {
      const k = agrupacion.toLowerCase();
      if (!sinMatch[k]) sinMatch[k] = { agrupacion: agrupacion, kmHoy: 0, kmMes: 0 };
      sinMatch[k].kmMes += km;
      if (esHoy) sinMatch[k].kmHoy += km;
      continue;
    }

    const key = (flotaItem.cliente + '|' + flotaItem.movil).toLowerCase();
    if (!byKey[key]) byKey[key] = { kmHoy: 0, kmSem: 0, kmMes: 0, dias: {} };
    byKey[key].kmMes += km;
    byKey[key].dias[fechaISO] = true;
    if (esSem) byKey[key].kmSem += km;
    if (esHoy) byKey[key].kmHoy += km;
  }

  let totHoy = 0, totSem = 0, totMes = 0, movsConKmHoy = 0;
  const moviles = flota.map(function(f) {
    const key = (f.cliente + '|' + f.movil).toLowerCase();
    const d = byKey[key];
    const kmHoy = d ? Math.round(d.kmHoy * 10) / 10 : 0;
    const kmSem = d ? Math.round(d.kmSem * 10) / 10 : 0;
    const kmMes = d ? Math.round(d.kmMes * 10) / 10 : 0;
    const diasActivos = d ? Object.keys(d.dias).length : 0;
    const promedioDiario = diasActivos > 0 ? Math.round(kmMes / diasActivos * 10) / 10 : 0;
    totHoy += kmHoy; totSem += kmSem; totMes += kmMes;
    if (kmHoy > 0) movsConKmHoy++;
    return { nombre: f.nombre, movil: f.movil, cliente: f.cliente, kam: f.kam,
             kmHoy: kmHoy, kmSem: kmSem, kmMes: kmMes,
             diasActivos: diasActivos, promedioDiario: promedioDiario };
  });

  const sinArr = Object.values(sinMatch).sort(function(a, b) { return b.kmMes - a.kmMes; });

  return {
    totales: { hoy: Math.round(totHoy), semana: Math.round(totSem), mes: Math.round(totMes), movilesConKmHoy: movsConKmHoy },
    moviles: moviles,
    sinAsignar: {
      hoy:  Math.round(sinArr.reduce(function(s, x) { return s + x.kmHoy; }, 0)),
      mes:  Math.round(sinArr.reduce(function(s, x) { return s + x.kmMes; }, 0)),
      cantidadAgrupaciones: sinArr.length,
      topAgrupaciones: sinArr.slice(0, 20).map(function(x) { return { agrupacion: x.agrupacion, km: Math.round(x.kmMes) }; }),
    },
    stats: { filasProcesadas: filasProcesadas, filasIgnoradas: filasIgnoradas, cantSinMatch: sinArr.length },
  };
}

function buildEmptyKm_(flota) {
  return {
    totales: { hoy: 0, semana: 0, mes: 0, movilesConKmHoy: 0 },
    moviles: flota.map(function(f) {
      return { nombre: f.nombre, movil: f.movil, cliente: f.cliente, kam: f.kam,
               kmHoy: 0, kmSem: 0, kmMes: 0, diasActivos: 0, promedioDiario: 0 };
    }),
    sinAsignar: { hoy: 0, mes: 0, cantidadAgrupaciones: 0, topAgrupaciones: [] },
    stats: { filasProcesadas: 0, filasIgnoradas: 0, cantSinMatch: 0 },
  };
}

// Busca la hoja de km en el spreadsheet: tiene columnas 'Agrupación' y 'Kilometraje'
function findKmSheet_(ss) {
  // Intentar nombres conocidos primero (solo lee headers, más rápido)
  const knownNames = ['Informes GPS', 'Kilómetros', 'KM', 'Km', 'GPS', 'Informe GPS'];
  for (let i = 0; i < knownNames.length; i++) {
    const sh = ss.getSheetByName(knownNames[i]);
    if (!sh || sh.getLastColumn() < 2) continue;
    const norm = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
      .map(function(h) { return normalize_(String(h || '')); });
    if (norm.some(function(h) { return h.indexOf('agrupacion') >= 0; }) &&
        norm.some(function(h) { return h.indexOf('kilometr') >= 0; })) {
      return { name: knownNames[i], values: sh.getDataRange().getValues() };
    }
  }
  // Fallback: escanear todas las hojas revisando solo sus headers
  const sheets = ss.getSheets();
  for (let i = 0; i < sheets.length; i++) {
    const sh = sheets[i];
    if (sh.getLastColumn() < 2 || sh.getLastRow() < 2) continue;
    const norm = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
      .map(function(h) { return normalize_(String(h || '')); });
    if (norm.some(function(h) { return h.indexOf('agrupacion') >= 0; }) &&
        norm.some(function(h) { return h.indexOf('kilometr') >= 0; })) {
      return { name: sh.getName(), values: sh.getDataRange().getValues() };
    }
  }
  return null;
}

// Parsea fechas con formato "DD.MM.YYYY HH:MM:SS" (formato GPS) y también formatos flexibles
function parseGPSDate_(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})/);
  if (m) return new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]),
                         parseInt(m[4]), parseInt(m[5]), parseInt(m[6]));
  return parseFlexibleDate(v);
}

// Parsea kilómetros: acepta "123.4 km", "123,4" o número directo
function parseGPSKm_(v) {
  if (v === null || v === undefined || v === '') return null;
  const s = String(v).trim();
  const m = s.match(/^([\d]+\.?[\d]*)\s*km/i);
  if (m) return parseFloat(m[1]);
  const n = parseFloat(s.replace(',', '.'));
  return isNaN(n) ? null : n;
}

// Elimina la placa patente del final del nombre GPS: "Habitat Móvil Quillota JTHB-59" → "Habitat Móvil Quillota"
function stripPlate_(agrupacion) {
  return String(agrupacion)
    .replace(/\s+-\s*[A-Z]{4}-\d{2,3}$/i, '')
    .replace(/\s+[A-Z]{4}-\d{2,3}$/i, '')
    .trim();
}

// ============================================================================
// HELPERS
// ============================================================================
function formatDateDDMMYYYY(d) {
  return String(d.getDate()).padStart(2, '0') + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + d.getFullYear();
}
// Convierte "HH:MM", "HH:MM:SS" o Date a minutos desde medianoche. null si no parseable.
function parseHHMM(v) {
  if (!v && v !== 0) return null;
  if (v instanceof Date) return v.getHours() * 60 + v.getMinutes();
  var s = String(v).trim();
  var m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}
function formatDateISO(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function formatTime(v) {
  if (!v) return '';
  if (v instanceof Date) return String(v.getHours()).padStart(2, '0') + ':' + String(v.getMinutes()).padStart(2, '0');
  const s = String(v);
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (m) return m[1].padStart(2, '0') + ':' + m[2];
  return s.slice(0, 5);
}
function parseFlexibleDate(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  const s = String(v).trim();
  // DD.MM.YYYY HH:MM:SS  (formato GPS europeo)
  let m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) return new Date(parseInt(m[3],10), parseInt(m[2],10)-1, parseInt(m[1],10), parseInt(m[4]||0,10), parseInt(m[5]||0,10), parseInt(m[6]||0,10));
  m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (m) return new Date(parseInt(m[3], 10), parseInt(m[2], 10) - 1, parseInt(m[1], 10));
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

// ============================================================================
// FUNCIONES DE PRUEBA
// ============================================================================
function testAuthorization() {
  Object.keys(SHEETS).forEach(k => {
    const ss = SpreadsheetApp.openById(SHEETS[k]);
    Logger.log('OK [' + k + ']: ' + ss.getName());
  });
}

function clearCache() {
  const cache = CacheService.getScriptCache();
  const keys = [];

  // Generar sufijos de fecha para los últimos 3 días + 'today'
  const dateSuffixes = ['today'];
  for (let d = 0; d <= 3; d++) {
    const dt = new Date();
    dt.setDate(dt.getDate() - d);
    dateSuffixes.push(formatDateISO(dt));
  }

  const versions = ['v8','v9','v10','v11','v12','v13','v14','v15','v16','v17','v18'];
  const baseKeys = ['gps','supervisiones','flota','jefes'];
  const dateKeys = ['unificador','historico','bitacora'];

  versions.forEach(v => {
    baseKeys.forEach(k => { keys.push('os_' + v + '_' + k); });
    dateKeys.forEach(k => {
      keys.push('os_' + v + '_' + k); // sin sufijo (por si acaso)
      dateSuffixes.forEach(s => { keys.push('os_' + v + '_' + k + '_' + s); });
    });
  });

  keys.push(MONDAY_CACHE_KEY_, MONDAY_CONSOL_CACHE_KEY_, MONDAY_PLANES_CACHE_KEY_, MONDAY_RAPIDA_CACHE_KEY_, MONDAY_INTEGRAL_CACHE_KEY_);

  cache.removeAll(keys);
  Logger.log('Cache limpiado: ' + keys.length + ' keys');
}

function debugTerminoRuta() {
  const ss = SpreadsheetApp.openById(SHEETS.unificador);
  const sheet = ss.getSheetByName('Termino de Ruta');
  if (!sheet) { Logger.log('ERROR: hoja Termino de Ruta no encontrada'); return; }
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  Logger.log('Headers Termino de Ruta: ' + JSON.stringify(headers));
  const sample = sheet.getRange(2, 1, Math.min(3, sheet.getLastRow()-1), sheet.getLastColumn()).getValues();
  sample.forEach(function(row, i){ Logger.log('Fila '+(i+2)+': '+JSON.stringify(row)); });
}

function debugCalendario() {
  const ss = SpreadsheetApp.openById(SHEETS.informesGPS);
  const sheet = ss.getSheetByName('CalendarioTransformado');
  if (!sheet) { Logger.log('ERROR: hoja CalendarioTransformado no encontrada en informesGPS'); return; }
  Logger.log('Hoja: ' + sheet.getName() + ' | Filas: ' + sheet.getLastRow() + ' | Cols: ' + sheet.getLastColumn());
  const vals = sheet.getRange(1, 1, Math.min(sheet.getLastRow(), 4), sheet.getLastColumn()).getValues();
  Logger.log('Headers: ' + JSON.stringify(vals[0]));
  if (vals.length > 1) Logger.log('Fila 2: ' + JSON.stringify(vals[1]));
  if (vals.length > 2) Logger.log('Fila 3: ' + JSON.stringify(vals[2]));
  if (vals.length > 3) Logger.log('Fila 4: ' + JSON.stringify(vals[3]));
}
function debugFinalizados() {
  const ss = SpreadsheetApp.openById(SHEETS.finalizados);
  const sheet = ss.getSheetByName('Finalizados') || ss.getSheets()[0];
  if (!sheet) { Logger.log('ERROR: no se encontró la hoja'); return; }
  Logger.log('Hoja encontrada: ' + sheet.getName());
  const lastRow = sheet.getLastRow();
  Logger.log('Filas totales: ' + lastRow);
  if (lastRow < 1) { Logger.log('Hoja vacía'); return; }
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  Logger.log('Headers: ' + JSON.stringify(headers));
  if (lastRow >= 2) {
    const row2 = sheet.getRange(2, 1, 1, sheet.getLastColumn()).getValues()[0];
    Logger.log('Fila 2 (primer dato): ' + JSON.stringify(row2));
  }
  if (lastRow >= 3) {
    const rowLast = sheet.getRange(lastRow, 1, 1, sheet.getLastColumn()).getValues()[0];
    Logger.log('Última fila: ' + JSON.stringify(rowLast));
  }
}

function debugSupervisiones() {
  const flotaInfo = readFlota();
  Logger.log('Flota: ' + flotaInfo.flota.length + ' móviles');

  const sup = readSupervisiones(flotaInfo);
  Logger.log('Stats: ' + JSON.stringify(sup.stats));

  const sinCruce = sup.moviles.filter(m => m.total === 0 && m.meta === 0);
  Logger.log('Sin cruce con Supervisiones (' + sinCruce.length + '):');
  sinCruce.forEach(m => Logger.log('  - ' + m.cliente + ' / ' + m.movil + '  (' + m.nombre + ')'));

  // Para diagnóstico: mostrar también filas del sheet que NO matchearon contra la flota
  // (esto vive dentro de readSupervisiones; lo replicamos aquí sin re-leer)
  const ss = SpreadsheetApp.openById(SHEETS.supervisiones);
  const sheet = ss.getSheetByName(SUPERVISIONES_TAB);
  const values = sheet.getDataRange().getValues();
  Logger.log('Filas totales del sheet: ' + values.length);
  Logger.log('Primera fila (headers): ' + JSON.stringify(values[0]));
  if (values.length > 1) Logger.log('Segunda fila (datos): ' + JSON.stringify(values[1]));
}

// ============================================================================
// ARCHIVO DIARIO DE FINALIZADOS
// Guarda los términos de ruta del día anterior en la hoja "Finalizados"
// para que el histórico de 30 días se mantenga actualizado.
//
// SETUP (una sola vez):
//   1. Abrí el editor de Apps Script
//   2. Seleccioná la función "crearTriggerArchivar"
//   3. Hacé click en ▶ Ejecutar
//   Eso activa el trigger diario automático a la 1 AM.
// ============================================================================

function archivarFinalizados() {
  const ss = SpreadsheetApp.openById(SHEETS.unificador);
  const finSS = SpreadsheetApp.openById(SHEETS.finalizados);
  var finSheet = finSS.getSheetByName('Finalizados') || finSS.getSheets()[0];
  if (!finSheet) {
    finSheet = finSS.insertSheet('Finalizados');
    finSheet.appendRow(['ID','Fecha','Cliente','Notacion','Conductor','Region','Comuna','Lugar de Atencion','Hora Inicio','Hora Termino']);
    finSheet.getRange(1, 1, 1, 10).setFontWeight('bold');
    Logger.log('archivarFinalizados: pestaña "' + FINALIZADOS_TAB + '" creada.');
  }

  // Día a archivar: ayer
  const ayer = new Date();
  ayer.setDate(ayer.getDate() - 1);
  ayer.setHours(0, 0, 0, 0);
  const fechaISO = formatDateISO(ayer);

  // Leer headers de Finalizados para saber el orden de columnas
  const finData = finSheet.getDataRange().getValues();
  if (finData.length === 0) { Logger.log('archivarFinalizados: hoja Finalizados sin headers'); return; }
  const finHeaders = finData[0].map(function(h){ return String(h || '').trim(); });

  // Evitar duplicados: salir si ya existe esa fecha
  const fechaColIdx = finHeaders.indexOf('Fecha');
  if (fechaColIdx >= 0) {
    for (var r = 1; r < finData.length; r++) {
      var fraw = finData[r][fechaColIdx];
      if (!fraw) continue;
      var fd = parseFlexibleDate(String(fraw));
      if (fd && formatDateISO(fd) === fechaISO) {
        Logger.log('archivarFinalizados: ' + fechaISO + ' ya existe, omitiendo.');
        return;
      }
    }
  }

  // Leer términos del día anterior
  const terminos = readRouteEvents(ss, 'Termino de Ruta', ayer, {
    fecha: 'Fecha', cliente: 'Cliente', movil: 'Móvil',
    conductor: 'Nombre Conductor', hora: 'Hora',
    comentario: 'Comentario', indicadores: 'Indicadores',
    comuna: 'Comuna', region: 'Región'
  });
  if (terminos.length === 0) {
    Logger.log('archivarFinalizados: sin términos para ' + fechaISO);
    return;
  }

  // Leer inicios del día anterior para hora inicio y lugar
  const inicios = readRouteEvents(ss, 'Inicio de Ruta', ayer, {
    fecha: 'Fecha', cliente: 'Cliente', movil: 'Móvil',
    conductor: 'Nombre Conductor', hora: 'Hora',
    comuna: 'Comuna', lugar: 'Lugar de Atención',
    idItem: 'Id Item', region: 'Región'
  });
  const iniMap = {};
  inicios.forEach(function(ini) {
    var k = normalize_(ini.cliente) + '|' + normalize_(ini.movil);
    if (!iniMap[k]) iniMap[k] = ini; // primer inicio del día
  });

  // Construir filas en el orden de columnas de Finalizados
  const newRows = terminos.map(function(ter) {
    var k = normalize_(ter.cliente) + '|' + normalize_(ter.movil);
    var ini = iniMap[k] || {};
    var data = {
      'ID':               ini.idItem || '',
      'Fecha':            fechaISO,
      'Cliente':          ter.cliente || '',
      'Notacion':         ter.movil || '',
      'Conductor':        ter.conductor || ini.conductor || '',
      'Region':           ter.region || ini.region || '',
      'Comuna':           ter.comuna || ini.comuna || '',
      'Lugar de Atencion': ini.lugar || '',
      'Hora Inicio':      ini.hora || '',
      'Hora Termino':     ter.hora || ''
    };
    return finHeaders.map(function(h) { return h in data ? data[h] : ''; });
  });

  finSheet.getRange(finSheet.getLastRow() + 1, 1, newRows.length, finHeaders.length).setValues(newRows);
  Logger.log('archivarFinalizados: guardadas ' + newRows.length + ' rutas para ' + fechaISO);
}

function crearTriggerArchivar() {
  // Eliminar triggers previos para evitar duplicados
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'archivarFinalizados') ScriptApp.deleteTrigger(t);
  });
  // Trigger diario a la 1 AM
  ScriptApp.newTrigger('archivarFinalizados')
    .timeBased()
    .everyDays(1)
    .atHour(1)
    .create();
  Logger.log('Trigger creado: archivarFinalizados correrá cada día a la 1 AM.');
}

// ============================================================
// AUTH — email + contraseña (SHA-256), tokens en CacheService
// ============================================================

function hashPassword_(password) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password, Utilities.Charset.UTF_8);
  return bytes.map(function(b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

function generarToken_() {
  var seed = Math.random().toString() + new Date().getTime().toString() + Math.random().toString();
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, seed);
  return bytes.map(function(b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

function getUsuariosSheet_() {
  return SpreadsheetApp.openById(SHEETS.dashboardApi).getSheetByName('Usuarios');
}

// Callable desde google.script.run
function registrarUsuario(nombre, email, password) {
  var sheet = getUsuariosSheet_();
  if (!sheet) return { ok: false, error: 'Hoja Usuarios no encontrada' };
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (normalize_(String(data[i][0])) === normalize_(email)) {
      return { ok: false, error: 'Este email ya está registrado' };
    }
  }
  sheet.appendRow([email, nombre, 'viewer', hashPassword_(password), 'pendiente']);
  return { ok: true };
}

// Callable desde google.script.run
function iniciarSesion(email, password) {
  var sheet = getUsuariosSheet_();
  if (!sheet) return { ok: false, error: 'Hoja Usuarios no encontrada' };
  var data = sheet.getDataRange().getValues();
  var hash = hashPassword_(password);
  for (var i = 1; i < data.length; i++) {
    var rowEmail  = String(data[i][0]);
    var rowNombre = String(data[i][1]);
    var rowRol    = String(data[i][2]);
    var rowHash   = String(data[i][3]);
    var rowEstado = String(data[i][4]);
    if (normalize_(rowEmail) !== normalize_(email)) continue;
    if (rowHash !== hash) return { ok: false, error: 'Contraseña incorrecta' };
    if (rowEstado === 'pendiente') return { ok: false, pendiente: true };
    if (rowEstado !== 'activo') return { ok: false, error: 'Cuenta inactiva o rechazada' };
    var token = generarToken_();
    CacheService.getScriptCache().put(
      'tok_' + token,
      JSON.stringify({ email: rowEmail, nombre: rowNombre, rol: rowRol }),
      28800 // 8 horas
    );
    return { ok: true, token: token, nombre: rowNombre, rol: rowRol };
  }
  return { ok: false, error: 'Email no encontrado' };
}

function verificarToken_(token) {
  if (!token) return null;
  var val = CacheService.getScriptCache().get('tok_' + token);
  if (!val) return null;
  try { return JSON.parse(val); } catch(e) { return null; }
}

// Callable desde google.script.run
function cerrarSesion(token) {
  if (token) CacheService.getScriptCache().remove('tok_' + token);
  return { ok: true };
}

function solicitarReset(email) {
  if (!email) return { ok: false, error: 'Email requerido' };
  var sheet = getUsuariosSheet_();
  if (!sheet) return { ok: false, error: 'Servicio no disponible' };
  var data = sheet.getDataRange().getValues();
  var found = false;
  for (var i = 1; i < data.length; i++) {
    if (normalize_(String(data[i][0])) === normalize_(email)) { found = true; break; }
  }
  // Siempre responder ok para no revelar si el email existe
  if (!found) return { ok: true };
  var token = generarToken_();
  CacheService.getScriptCache().put('reset_' + token, normalize_(email), 900); // 15 minutos
  var resetUrl = 'https://dashboard-operaciones-on-street.vercel.app/?reset=' + token;
  try {
    MailApp.sendEmail({
      to: email,
      subject: 'Recuperar contraseña — Dashboard On Street',
      htmlBody:
        '<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px">' +
        '<h2 style="color:#E84717;margin:0 0 16px">Dashboard On Street</h2>' +
        '<p style="color:#333">Recibimos una solicitud para restablecer la contraseña de tu cuenta.</p>' +
        '<p style="margin:24px 0">' +
        '<a href="' + resetUrl + '" style="background:#E84717;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">Restablecer contraseña</a>' +
        '</p>' +
        '<p style="font-size:13px;color:#666">Este enlace es válido por <strong>15 minutos</strong>.<br>Si no solicitaste esto, ignora este correo.</p>' +
        '<hr style="border:none;border-top:1px solid #eee;margin:24px 0">' +
        '<p style="font-size:12px;color:#aaa">On Street</p></div>',
      body: 'Para restablecer tu contraseña, copia este enlace en tu navegador:\n\n' + resetUrl + '\n\nVálido por 15 minutos. Si no solicitaste esto, ignora este correo.'
    });
  } catch(e) {
    Logger.log('Error al enviar email de reset: ' + e.toString());
  }
  return { ok: true };
}

function confirmarReset(token, newPassword) {
  if (!token || !newPassword) return { ok: false, error: 'Datos incompletos' };
  if (newPassword.length < 8) return { ok: false, error: 'La contraseña debe tener al menos 8 caracteres' };
  var cache = CacheService.getScriptCache();
  var email = cache.get('reset_' + token);
  if (!email) return { ok: false, error: 'El enlace expiró o ya fue utilizado' };
  var sheet = getUsuariosSheet_();
  if (!sheet) return { ok: false, error: 'Servicio no disponible' };
  var data = sheet.getDataRange().getValues();
  var newHash = hashPassword_(newPassword);
  for (var i = 1; i < data.length; i++) {
    if (normalize_(String(data[i][0])) === email) {
      sheet.getRange(i + 1, 4).setValue(newHash);
      cache.remove('reset_' + token);
      return { ok: true };
    }
  }
  return { ok: false, error: 'Usuario no encontrado' };
}

// Corre UNA VEZ desde el editor de Apps Script para crear la hoja Usuarios
function inicializarHojaUsuarios() {
  var ss = SpreadsheetApp.openById(SHEETS.dashboardApi);
  var sheet = ss.getSheetByName('Usuarios');
  if (!sheet) {
    sheet = ss.insertSheet('Usuarios');
    Logger.log('Hoja Usuarios creada.');
  } else {
    Logger.log('Hoja Usuarios ya existe.');
  }
  // Escribir cabeceras si la hoja está vacía
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Email', 'Nombre', 'Rol', 'PasswordHash', 'Estado']);
    sheet.getRange(1, 1, 1, 5).setFontWeight('bold');
    Logger.log('Cabeceras escritas.');
  }
  Logger.log('Listo. Agrega tu usuario admin directamente en la hoja con Estado = activo y Rol = admin.');
}
