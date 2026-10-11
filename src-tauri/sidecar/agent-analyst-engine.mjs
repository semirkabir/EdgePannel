// --- Analyst query engine --------------------------------------------------
//
// Backs the `query_live_map` agent tool: count / filter / group / rank the
// records that are on the analyst's map RIGHT NOW ("how many military flights
// over the Black Sea", "biggest fire near LA", "ships faster than 20 kt").
//
// The browser attaches a compact `mapSnapshot` to each chat request (see
// buildAgentMapSnapshot in src/services/map-agent-snapshot.ts); this module is
// the pure, dependency-free query side, so it is trivially unit-testable.

/** Queryable layers and their canonical fields. Field type drives validation. */
export const ANALYST_LAYERS = {
  flights: {
    label: 'tracked aircraft',
    fields: {
      id: 'string', callsign: 'string', country: 'string', freshness: 'string',
      lat: 'number', lon: 'number', altitude_ft: 'number', speed_kts: 'number', heading: 'number',
      on_ground: 'boolean',
    },
    defaultSort: 'altitude_ft',
  },
  military_flights: {
    label: 'military aircraft',
    fields: {
      id: 'string', callsign: 'string', type: 'string', model: 'string', operator: 'string',
      country: 'string', origin: 'string', destination: 'string',
      lat: 'number', lon: 'number', altitude_ft: 'number', speed_kts: 'number', heading: 'number',
      on_ground: 'boolean',
    },
    defaultSort: 'altitude_ft',
  },
  ships: {
    label: 'AIS vessels',
    fields: {
      id: 'string', name: 'string',
      lat: 'number', lon: 'number', speed_kts: 'number', heading: 'number', ship_type: 'number',
    },
    defaultSort: 'speed_kts',
  },
  military_vessels: {
    label: 'military vessels',
    fields: {
      id: 'string', name: 'string', type: 'string', operator: 'string', country: 'string', destination: 'string',
      lat: 'number', lon: 'number', speed_kts: 'number', heading: 'number', ais_gap_min: 'number',
    },
    defaultSort: 'speed_kts',
  },
  earthquakes: {
    label: 'earthquakes',
    fields: {
      id: 'string', place: 'string',
      lat: 'number', lon: 'number', magnitude: 'number', depth_km: 'number', age_hours: 'number',
    },
    defaultSort: 'magnitude',
  },
  natural_events: {
    label: 'natural events',
    fields: {
      id: 'string', title: 'string', category: 'string',
      lat: 'number', lon: 'number', magnitude: 'number', age_hours: 'number', closed: 'boolean',
    },
    defaultSort: 'magnitude',
  },
  fires: {
    label: 'fire detections',
    fields: {
      region: 'string', daynight: 'string',
      lat: 'number', lon: 'number', frp: 'number', brightness: 'number', confidence: 'number',
    },
    defaultSort: 'frp',
  },
};

export const ANALYST_LAYER_KEYS = Object.keys(ANALYST_LAYERS);
export const ANALYST_OPS = ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'contains', 'in'];
export const ANALYST_MAX_LIMIT = 25;
export const ANALYST_DEFAULT_LIMIT = 10;
/** Group_by answers list at most this many buckets. */
const MAX_GROUPS = 25;
const DEFAULT_REGION_RADIUS_KM = 600;
const EARTH_KM = 6371.0088;

function fail(error) {
  return { ok: false, error };
}

/** Haversine great-circle distance in km. */
export function haversineKm(lat1, lon1, lat2, lon2) {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

function inBbox(lat, lon, [west, south, east, north]) {
  if (lat < south || lat > north) return false;
  // west > east means the box crosses the antimeridian.
  return west <= east ? lon >= west && lon <= east : lon >= west || lon <= east;
}

/** Finite number or null. null/''/booleans are NOT 0: unknown must stay unknown. */
function finite(value) {
  if (value == null || value === '' || typeof value === 'boolean') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Turn the model's `scope` argument into a predicate on (lat, lon), plus a
 * human-readable description. Exactly one of bbox | center | region | viewport.
 */
export function resolveScope(scope, mapViewport, regionAnchors = {}) {
  if (scope == null || (typeof scope === 'object' && Object.keys(scope).length === 0)) {
    return { ok: true, test: null, description: 'worldwide' };
  }
  if (typeof scope !== 'object') return fail('scope must be an object.');

  const given = ['bbox', 'lat', 'region', 'viewport'].filter(key => scope[key] != null && scope[key] !== false);
  if (given.length !== 1) {
    return fail('scope needs exactly one of: bbox [west,south,east,north], lat+lon(+radius_km), region, viewport:true.');
  }

  if (scope.bbox != null) {
    const box = Array.isArray(scope.bbox) ? scope.bbox.map(finite) : [];
    if (box.length !== 4 || box.some(v => v === null)) return fail('bbox must be [west, south, east, north] numbers.');
    const [west, south, east, north] = box;
    if (south < -90 || north > 90 || south > north) return fail('bbox latitudes must satisfy -90 <= south <= north <= 90.');
    if (west < -180 || west > 180 || east < -180 || east > 180) return fail('bbox longitudes must be within -180..180.');
    return { ok: true, test: (lat, lon) => inBbox(lat, lon, box), description: `bbox [${box.join(', ')}]` };
  }

  if (scope.lat != null) {
    const lat = finite(scope.lat);
    const lon = finite(scope.lon);
    if (lat === null || lon === null || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return fail('scope lat/lon must be valid WGS84 degrees.');
    }
    const radius = scope.radius_km == null ? 100 : finite(scope.radius_km);
    if (radius === null || radius <= 0 || radius > 20000) return fail('radius_km must be between 0 and 20000.');
    return {
      ok: true,
      test: (la, lo) => haversineKm(lat, lon, la, lo) <= radius,
      description: `within ${radius} km of ${lat.toFixed(2)}, ${lon.toFixed(2)}`,
    };
  }

  if (scope.region != null) {
    const key = String(scope.region).trim().toLowerCase().replace(/[\s-]+/g, '_');
    const anchor = regionAnchors[key];
    if (!anchor) return fail(`Unknown region '${scope.region}'. Known: ${Object.keys(regionAnchors).join(', ')}.`);
    const radius = scope.radius_km == null ? DEFAULT_REGION_RADIUS_KM : finite(scope.radius_km);
    if (radius === null || radius <= 0 || radius > 20000) return fail('radius_km must be between 0 and 20000.');
    return {
      ok: true,
      test: (la, lo) => haversineKm(anchor.lat, anchor.lon, la, lo) <= radius,
      description: `within ${radius} km of ${key}`,
    };
  }

  // viewport
  const b = mapViewport?.bounds;
  if (!b) return fail('No viewport bounds available from the dashboard (globe/SVG mode). Use bbox, lat+lon, or region instead.');
  const box = [b.west, b.south, b.east, b.north].map(finite);
  if (box.some(v => v === null)) return fail('Viewport bounds were malformed.');
  return { ok: true, test: (lat, lon) => inBbox(lat, lon, box), description: 'current viewport' };
}

function validateWhere(where, fields) {
  if (where == null) return { ok: true, clauses: [] };
  if (!Array.isArray(where)) return fail('where must be an array of {field, op, value}.');
  if (where.length > 8) return fail('where allows at most 8 clauses.');
  const clauses = [];
  for (const raw of where) {
    if (!raw || typeof raw !== 'object') return fail('Each where clause must be an object.');
    const field = String(raw.field ?? '');
    const op = String(raw.op ?? 'eq');
    const type = fields[field];
    if (!type) return fail(`Unknown field '${field}'. Fields: ${Object.keys(fields).join(', ')}.`);
    if (!ANALYST_OPS.includes(op)) return fail(`Unknown op '${op}'. Ops: ${ANALYST_OPS.join(', ')}.`);
    if (op === 'in') {
      if (!Array.isArray(raw.value) || raw.value.length === 0) return fail(`op 'in' needs a non-empty array value.`);
      const values = type === 'number' ? raw.value.map(finite) : raw.value.map(v => (type === 'boolean' ? Boolean(v) : String(v).toLowerCase()));
      if (values.some(v => v === null)) return fail(`Field '${field}' is numeric; 'in' values must be numbers.`);
      clauses.push({ field, op, type, value: values });
      continue;
    }
    if (type === 'number') {
      const n = finite(raw.value);
      if (n === null) return fail(`Field '${field}' is numeric; value must be a number.`);
      if (op === 'contains') return fail(`op 'contains' only works on string fields.`);
      clauses.push({ field, op, type, value: n });
    } else if (type === 'boolean') {
      if (!['eq', 'ne'].includes(op)) return fail(`Boolean field '${field}' only supports eq/ne.`);
      clauses.push({ field, op, type, value: raw.value === true || String(raw.value).toLowerCase() === 'true' });
    } else {
      if (['gt', 'gte', 'lt', 'lte'].includes(op)) return fail(`String field '${field}' does not support ${op}.`);
      clauses.push({ field, op, type, value: String(raw.value ?? '').toLowerCase() });
    }
  }
  return { ok: true, clauses };
}

function matches(record, clauses) {
  for (const { field, op, type, value } of clauses) {
    const actual = record[field];
    // A record missing the field never satisfies a constraint on it (unknown != 0).
    if (actual == null || (type === 'number' && !Number.isFinite(actual))) return false;
    if (op === 'in') {
      const probe = type === 'string' ? String(actual).toLowerCase() : actual;
      if (!value.includes(probe)) return false;
      continue;
    }
    if (type === 'number') {
      if (op === 'eq' && actual !== value) return false;
      if (op === 'ne' && actual === value) return false;
      if (op === 'gt' && !(actual > value)) return false;
      if (op === 'gte' && !(actual >= value)) return false;
      if (op === 'lt' && !(actual < value)) return false;
      if (op === 'lte' && !(actual <= value)) return false;
    } else if (type === 'boolean') {
      if (op === 'eq' && Boolean(actual) !== value) return false;
      if (op === 'ne' && Boolean(actual) === value) return false;
    } else {
      const text = String(actual).toLowerCase();
      if (op === 'eq' && text !== value) return false;
      if (op === 'ne' && text === value) return false;
      if (op === 'contains' && !text.includes(value)) return false;
    }
  }
  return true;
}

/** Compact record for the model: drop null/undefined, round floats. */
function compact(record) {
  const out = {};
  for (const [key, value] of Object.entries(record)) {
    if (value == null) continue;
    out[key] = typeof value === 'number' && !Number.isInteger(value) ? Math.round(value * 1000) / 1000 : value;
  }
  return out;
}

/**
 * Validate and normalise a query_live_map call.
 * Returns { ok:true, args } or { ok:false, error } with a model-readable error.
 */
export function validateAnalystArgs(raw) {
  const args = raw && typeof raw === 'object' ? raw : {};
  const layerKey = String(args.layer ?? '').trim().toLowerCase();
  const layer = ANALYST_LAYERS[layerKey];
  if (!layer) return fail(`Unknown layer '${args.layer ?? ''}'. Layers: ${ANALYST_LAYER_KEYS.join(', ')}.`);

  const where = validateWhere(args.where, layer.fields);
  if (!where.ok) return where;

  const groupBy = args.group_by == null || args.group_by === '' ? null : String(args.group_by);
  if (groupBy && !layer.fields[groupBy]) return fail(`Unknown group_by field '${groupBy}'. Fields: ${Object.keys(layer.fields).join(', ')}.`);
  if (groupBy && ['lat', 'lon'].includes(groupBy)) return fail(`Grouping by '${groupBy}' is not useful; pick a categorical field.`);

  const sortBy = args.sort_by == null || args.sort_by === '' ? layer.defaultSort : String(args.sort_by);
  if (!layer.fields[sortBy]) return fail(`Unknown sort_by field '${sortBy}'. Fields: ${Object.keys(layer.fields).join(', ')}.`);
  const order = String(args.order ?? 'desc').toLowerCase();
  if (order !== 'asc' && order !== 'desc') return fail(`order must be 'asc' or 'desc'.`);

  let limit = args.limit == null ? ANALYST_DEFAULT_LIMIT : finite(args.limit);
  if (limit === null || limit < 0) return fail('limit must be a non-negative number.');
  limit = Math.min(ANALYST_MAX_LIMIT, Math.floor(limit));

  return {
    ok: true,
    args: {
      layerKey, layer, clauses: where.clauses, groupBy, sortBy, order, limit,
      countOnly: args.count_only === true || String(args.count_only).toLowerCase() === 'true',
      scope: args.scope ?? null,
    },
  };
}

/**
 * Run a validated query over the dashboard's snapshot.
 * @param {object} rawArgs   model tool arguments
 * @param {object|null} snapshot  { capturedAt, layers: { [key]: { records, total, source?, newestMs? } } }
 * @param {{mapViewport?: object|null, regionAnchors?: object, nowMs?: number}} [context]
 */
export function runAnalystQuery(rawArgs, snapshot, { mapViewport = null, regionAnchors = {}, nowMs = Date.now() } = {}) {
  const parsed = validateAnalystArgs(rawArgs);
  if (!parsed.ok) return parsed;
  const { layerKey, layer, clauses, groupBy, sortBy, order, limit, countOnly, scope } = parsed.args;

  const scopeResolved = resolveScope(scope, mapViewport, regionAnchors);
  if (!scopeResolved.ok) return scopeResolved;

  if (!snapshot || typeof snapshot !== 'object' || !snapshot.layers) {
    return fail('No live map snapshot was provided by the dashboard. Open the map view and retry.');
  }
  const entry = snapshot.layers[layerKey];
  if (!entry || !Array.isArray(entry.records)) {
    const loaded = Object.keys(snapshot.layers).filter(key => ANALYST_LAYERS[key]);
    return fail(
      `Layer '${layerKey}' has no data on the map right now (it is off or still loading). ` +
      `Loaded: ${loaded.length ? loaded.join(', ') : 'none'}. Use toggle_map_layers to enable it, then retry.`,
    );
  }

  const notes = [];
  const total = Number.isFinite(entry.total) ? entry.total : entry.records.length;
  if (entry.records.length < total) {
    notes.push(
      `Snapshot holds ${entry.records.length} of ${total} ${layer.label}; counts are lower bounds` +
      `${snapshot.viewportFirst ? ' (records inside the current view were kept first)' : ''}.`,
    );
  }
  if (Number.isFinite(entry.newestMs)) {
    const ageMin = Math.max(0, Math.round((nowMs - entry.newestMs) / 60000));
    if (ageMin >= 10) notes.push(`Newest ${layerKey} update is ${ageMin} min old; the feed may be stale.`);
  }
  if (entry.source) notes.push(`Source: ${entry.source}.`);
  if (Number.isFinite(entry.staleCount) && entry.staleCount > 0) {
    notes.push(`${entry.staleCount} ${layer.label} in the snapshot are flagged stale by the feed.`);
  }
  if (Number.isFinite(snapshot.capturedAt)) {
    const ageSec = Math.max(0, Math.round((nowMs - snapshot.capturedAt) / 1000));
    if (ageSec > 120) notes.push(`Snapshot was taken ${ageSec}s ago.`);
  }

  const rows = [];
  for (const record of entry.records) {
    if (!record || typeof record !== 'object') continue;
    if (scopeResolved.test) {
      const lat = finite(record.lat);
      const lon = finite(record.lon);
      if (lat === null || lon === null || !scopeResolved.test(lat, lon)) continue;
    }
    if (clauses.length && !matches(record, clauses)) continue;
    rows.push(record);
  }

  const result = {
    layer: layerKey,
    scope: scopeResolved.description,
    filters: clauses.length ? clauses.map(c => `${c.field} ${c.op} ${JSON.stringify(c.value)}`) : [],
    matched: rows.length,
    loaded: entry.records.length,
    ...(total !== entry.records.length ? { total_on_map: total } : {}),
  };

  if (groupBy) {
    const buckets = new Map();
    for (const row of rows) {
      const raw = row[groupBy];
      const key = raw == null || raw === '' ? '(unknown)' : String(raw);
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
    const sorted = [...buckets.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    result.group_by = groupBy;
    result.groups = sorted.slice(0, MAX_GROUPS).map(([key, count]) => ({ [groupBy]: key, count }));
    if (sorted.length > MAX_GROUPS) {
      result.groups_omitted = sorted.length - MAX_GROUPS;
      notes.push(`Showing the top ${MAX_GROUPS} of ${sorted.length} groups.`);
    }
  }

  if (!countOnly && limit > 0 && !groupBy) {
    const dir = order === 'asc' ? 1 : -1;
    const type = layer.fields[sortBy];
    const sorted = [...rows].sort((a, b) => {
      const av = a[sortBy];
      const bv = b[sortBy];
      // Missing values always sort last, regardless of direction.
      const aMissing = av == null || (type === 'number' && !Number.isFinite(av));
      const bMissing = bv == null || (type === 'number' && !Number.isFinite(bv));
      if (aMissing || bMissing) return aMissing === bMissing ? 0 : aMissing ? 1 : -1;
      if (type === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
    result.sorted_by = `${sortBy} ${order}`;
    result.records = sorted.slice(0, limit).map(compact);
    if (rows.length > limit) result.records_omitted = rows.length - limit;
  }

  if (notes.length) result.notes = notes;
  return { ok: true, result };
}

/** Tool definition for the registry (server-answered, needs the browser snapshot). */
export const ANALYST_QUERY_TOOL = {
  name: 'query_live_map',
  description:
    'Count, filter, group and rank the records on the analyst\'s map RIGHT NOW (not historical or news data). ' +
    `Layers: ${ANALYST_LAYER_KEYS.join(', ')}. Use for questions like "how many military flights are over the Black Sea", ` +
    '"which ships are faster than 20 kt", "biggest fire near Los Angeles", "M5+ quakes by region". ' +
    'Scope with ONE of bbox [west,south,east,north], lat+lon(+radius_km), region (named theater), or viewport:true. ' +
    'Filter with where: [{field, op, value}] (ops: eq, ne, gt, gte, lt, lte, contains, in). ' +
    'Use group_by for breakdowns, sort_by/order/limit (max 25) for rankings, count_only for bare counts. ' +
    'Always relay the result\'s notes: they say when the snapshot is partial or a feed is stale. ' +
    'If the layer is not on the map, the error says so; enable it with toggle_map_layers and retry.',
  scopes: ['intelligence'],
  risk: 'map-context',
  inputSchema: {
    type: 'object',
    properties: {
      layer: { type: 'string', description: `One of: ${ANALYST_LAYER_KEYS.join(', ')}.`, required: true },
      scope: {
        type: 'object',
        description: 'Optional geographic filter. Exactly one of: {bbox:[w,s,e,n]}, {lat,lon,radius_km?}, {region,radius_km?}, {viewport:true}.',
      },
      where: {
        type: 'array',
        description: 'Optional filters: [{field, op, value}]. Fields depend on the layer.',
        items: { type: 'object' },
      },
      group_by: { type: 'string', description: 'Count matches per distinct value of this field.' },
      sort_by: { type: 'string', description: 'Field to rank by (default depends on layer).' },
      order: { type: 'string', description: "'desc' (default) or 'asc'." },
      limit: { type: 'number', description: `Records to return, 0-${ANALYST_MAX_LIMIT} (default ${ANALYST_DEFAULT_LIMIT}).` },
      count_only: { type: 'boolean', description: 'Return only counts, no records.' },
    },
    required: ['layer'],
  },
};
