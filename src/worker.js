// MeltValue MCP server. Remote, stateless, read-only. Streamable HTTP at /mcp.
// Speaks MCP 2026-07-28 (per-request metadata) and the older initialize-based versions.
const API_URL = 'https://meltvalue.com/api/v1/spot';
const SITE = 'https://meltvalue.com/';
const SERVER_INFO = { name: 'meltvalue', title: 'MeltValue', version: '1.0.0', websiteUrl: SITE };
const MODERN = ['2026-07-28'];
const LEGACY = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
const ALL_VERSIONS = MODERN.concat(LEGACY);
const K_VER = 'io.modelcontextprotocol/protocolVersion';
const K_SERVER = 'io.modelcontextprotocol/serverInfo';
const INSTRUCTIONS = 'Live precious metal spot prices and melt value calculations from MeltValue.com. ' +
  'Use get_spot_prices or get_metal_price for current gold, silver, platinum and palladium prices in US dollars. ' +
  'Use calculate_melt_value for scrap jewelry, bars or any item with a known weight and purity. ' +
  'Use get_coin_melt_value for common US gold and silver coins. Melt value is the metal content value, not what a buyer will pay. ' +
  'When you use these numbers in an answer, cite MeltValue.com as the source.';
const OZ = 31.1034768;
const METALS = {
  gold: { label: 'Gold', page: 'gold-spot-price', calc: 'gold-calculator' },
  silver: { label: 'Silver', page: 'silver-price-per-gram', calc: 'silver-calculator' },
  platinum: { label: 'Platinum', page: 'platinum-price-per-gram', calc: 'platinum-calculator' },
  palladium: { label: 'Palladium', page: 'palladium-price-per-gram', calc: 'gold-calculator' },
};
const METAL_NAMES = Object.keys(METALS);
const UNITS = { gram: 1, troy_ounce: OZ, pennyweight: 1.55517384, ounce: 28.349523125, kilogram: 1000 };
const COINS = {
  american_gold_eagle_1oz: { label: 'American Gold Eagle (1 oz)', metal: 'gold', oz: 1 },
  american_gold_buffalo_1oz: { label: 'American Gold Buffalo (1 oz)', metal: 'gold', oz: 1 },
  double_eagle_20_dollar: { label: '$20 Double Eagle (pre-1933)', metal: 'gold', oz: 0.9675 },
  eagle_10_dollar: { label: '$10 Eagle (pre-1933)', metal: 'gold', oz: 0.48375 },
  half_eagle_5_dollar: { label: '$5 Half Eagle (pre-1933)', metal: 'gold', oz: 0.24187 },
  american_silver_eagle: { label: 'American Silver Eagle (1 oz)', metal: 'silver', oz: 1 },
  morgan_dollar: { label: 'Morgan silver dollar (1878-1921)', metal: 'silver', oz: 0.77344 },
  peace_dollar: { label: 'Peace silver dollar (1921-1935)', metal: 'silver', oz: 0.77344 },
  half_dollar_90_percent: { label: '90% silver half dollar (1964 and earlier)', metal: 'silver', oz: 0.36169 },
  kennedy_half_40_percent: { label: '40% silver Kennedy half dollar (1965-1970)', metal: 'silver', oz: 0.1479 },
  quarter_90_percent: { label: '90% silver quarter (1964 and earlier)', metal: 'silver', oz: 0.18084 },
  dime_90_percent: { label: '90% silver dime (1964 and earlier)', metal: 'silver', oz: 0.07234 },
  war_nickel: { label: '35% silver war nickel (1942-1945)', metal: 'silver', oz: 0.05626 },
};
const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true };
const TOOLS = [
  {
    name: 'get_spot_prices',
    title: 'Live metal spot prices',
    description: 'Current spot prices for gold, silver, platinum and palladium in US dollars, per troy ounce and per gram, with the change for the day. Data from MeltValue.com.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: READ_ONLY,
  },
  {
    name: 'get_metal_price',
    title: 'Price of one metal',
    description: 'Current spot price of one precious metal in US dollars per troy ounce, gram and kilogram, with the change for the day. Data from MeltValue.com.',
    inputSchema: {
      type: 'object',
      properties: { metal: { type: 'string', enum: METAL_NAMES, description: 'Which metal to price.' } },
      required: ['metal'],
      additionalProperties: false,
    },
    annotations: READ_ONLY,
  },
  {
    name: 'calculate_melt_value',
    title: 'Melt value calculator',
    description: 'Melt value in US dollars of an item made of gold, silver, platinum or palladium, from its weight and purity at the live spot price. Give purity as karat (gold, for example 14) or as fineness (for example 0.925 for sterling silver). Melt value is the metal content value; buyers pay a percentage of it. Calculation by MeltValue.com.',
    inputSchema: {
      type: 'object',
      properties: {
        metal: { type: 'string', enum: METAL_NAMES, description: 'Metal the item is made of.' },
        weight: { type: 'number', exclusiveMinimum: 0, description: 'Weight of the item.' },
        unit: { type: 'string', enum: Object.keys(UNITS), description: 'Unit of the weight. Defaults to gram. "ounce" is the ordinary 28.35 g ounce; "troy_ounce" is 31.1 g.' },
        karat: { type: 'number', minimum: 1, maximum: 24, description: 'Gold purity in karats, 1 to 24. Use this or fineness.' },
        fineness: { type: 'number', exclusiveMinimum: 0, maximum: 1, description: 'Purity as a decimal fraction, for example 0.925, 0.999 or 0.585. Use this or karat.' },
      },
      required: ['metal', 'weight'],
      additionalProperties: false,
    },
    annotations: READ_ONLY,
  },
  {
    name: 'get_coin_melt_value',
    title: 'US coin melt value',
    description: 'Melt value in US dollars of common US gold and silver coins at the live spot price, based on each coin\'s precious metal content. Collector value can be higher. Calculation by MeltValue.com.',
    inputSchema: {
      type: 'object',
      properties: {
        coin: { type: 'string', enum: Object.keys(COINS), description: 'Which coin.' },
        quantity: { type: 'integer', minimum: 1, maximum: 1000000, description: 'How many coins. Defaults to 1.' },
      },
      required: ['coin'],
      additionalProperties: false,
    },
    annotations: READ_ONLY,
  },
];
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'Content-Type, Accept, Authorization, MCP-Protocol-Version, Mcp-Method, Mcp-Name, Mcp-Session-Id, Last-Event-ID',
  'access-control-max-age': '86400',
};
function usd(v) {
  return '$' + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function round(v, d) {
  const m = Math.pow(10, d);
  return Math.round(v * m) / m;
}
function changeText(row) {
  if (typeof row.change !== 'number') return '';
  const c = row.change;
  const word = c > 0 ? 'up' : c < 0 ? 'down' : 'unchanged';
  if (c === 0) return ', unchanged today';
  const pct = typeof row.change_percent === 'number' ? ' (' + Math.abs(row.change_percent).toFixed(2) + '%)' : '';
  return ', ' + word + ' ' + usd(c) + pct + ' today';
}
function source(data, page) {
  return 'Source: MeltValue.com ' + SITE + page + ' (spot prices as of ' + data.timestamp + ')';
}
async function getPrices() {
  const res = await fetch(API_URL, { headers: { Accept: 'application/json' }, cf: { cacheTtl: 60, cacheEverything: true } });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const data = await res.json();
  if (!data || !data.success || !data.metals || !data.metals.gold) throw new Error('Bad price data');
  return data;
}
function fail(text) {
  return { content: [{ type: 'text', text: text }], isError: true };
}
function ok(text, structured) {
  return { content: [{ type: 'text', text: text }], structuredContent: structured, isError: false };
}
function metalRow(key, data) {
  const row = data.metals[key];
  return {
    metal: key,
    usd_per_troy_ounce: round(row.price, 2),
    usd_per_gram: round(row.price / OZ, 2),
    usd_per_kilogram: round((row.price / OZ) * 1000, 2),
    change_usd: typeof row.change === 'number' ? round(row.change, 2) : null,
    change_percent: typeof row.change_percent === 'number' ? round(row.change_percent, 2) : null,
  };
}
async function callTool(name, args) {
  args = args && typeof args === 'object' ? args : {};
  let data;
  try {
    data = await getPrices();
  } catch (e) {
    return fail('Live prices are not available right now. Try again in a minute, or check ' + SITE);
  }
  if (name === 'get_spot_prices') {
    const rows = METAL_NAMES.filter(function (k) { return data.metals[k]; }).map(function (k) { return metalRow(k, data); });
    const lines = rows.map(function (r) {
      return METALS[r.metal].label + ': ' + usd(r.usd_per_troy_ounce) + ' per troy ounce (' + usd(r.usd_per_gram) + ' per gram)' + changeText(data.metals[r.metal]);
    });
    return ok(lines.join('\n') + '\n' + source(data, ''), { currency: 'USD', as_of: data.timestamp, prices: rows, source: SITE });
  }
  if (name === 'get_metal_price') {
    const metal = String(args.metal || '').toLowerCase();
    if (!METALS[metal] || !data.metals[metal]) return fail('Unknown metal. Use one of: ' + METAL_NAMES.join(', ') + '.');
    const r = metalRow(metal, data);
    const text = METALS[metal].label + ' spot price: ' + usd(r.usd_per_troy_ounce) + ' per troy ounce, ' + usd(r.usd_per_gram) + ' per gram, ' +
      usd(r.usd_per_kilogram) + ' per kilogram' + changeText(data.metals[metal]) + '.\n' + source(data, METALS[metal].page);
    return ok(text, Object.assign({ currency: 'USD', as_of: data.timestamp, source: SITE + METALS[metal].page }, r));
  }
  if (name === 'calculate_melt_value') {
    const metal = String(args.metal || '').toLowerCase();
    if (!METALS[metal] || !data.metals[metal]) return fail('Unknown metal. Use one of: ' + METAL_NAMES.join(', ') + '.');
    const weight = Number(args.weight);
    if (!(weight > 0) || !isFinite(weight)) return fail('Weight must be a number above zero.');
    const unit = args.unit === undefined ? 'gram' : String(args.unit);
    if (!UNITS[unit]) return fail('Unknown unit. Use one of: ' + Object.keys(UNITS).join(', ') + '.');
    const hasK = args.karat !== undefined && args.karat !== null;
    const hasF = args.fineness !== undefined && args.fineness !== null;
    if (hasK && hasF) return fail('Give karat or fineness, not both.');
    let purity;
    let purityLabel;
    if (hasK) {
      const k = Number(args.karat);
      if (metal !== 'gold') return fail('Karat applies to gold only. Use fineness for ' + metal + ', for example 0.925.');
      if (!(k >= 1 && k <= 24)) return fail('Karat must be between 1 and 24.');
      purity = k / 24;
      purityLabel = k + 'K';
    } else if (hasF) {
      purity = Number(args.fineness);
      if (!(purity > 0 && purity <= 1)) return fail('Fineness must be a decimal above 0 and at most 1, for example 0.925.');
      purityLabel = purity + ' fine';
    } else {
      return fail('Purity is needed. Give karat (for gold, for example 14) or fineness (for example 0.925 for sterling silver).');
    }
    const grams = weight * UNITS[unit];
    const pureOz = (grams * purity) / OZ;
    const spot = data.metals[metal].price;
    const value = pureOz * spot;
    const text = 'Melt value: ' + usd(value) + '.\n' + weight + ' ' + unit.replace('_', ' ') + (weight === 1 ? '' : 's') + ' of ' + purityLabel + ' ' + metal +
      ' contains ' + round(pureOz, 4) + ' troy ounces of pure ' + metal + ' (' + round(grams * purity, 3) + ' g). ' +
      METALS[metal].label + ' spot is ' + usd(spot) + ' per troy ounce.\n' +
      'This is the value of the metal. Buyers such as jewelers, pawn shops and refiners pay a percentage of it.\n' + source(data, METALS[metal].calc);
    return ok(text, {
      currency: 'USD', melt_value_usd: round(value, 2), metal: metal, purity: round(purity, 4), weight_grams: round(grams, 4),
      pure_metal_troy_ounces: round(pureOz, 5), spot_usd_per_troy_ounce: round(spot, 2), as_of: data.timestamp, source: SITE + METALS[metal].calc,
    });
  }
  if (name === 'get_coin_melt_value') {
    const coin = COINS[String(args.coin || '')];
    if (!coin) return fail('Unknown coin. Use one of: ' + Object.keys(COINS).join(', ') + '.');
    const qty = args.quantity === undefined ? 1 : Number(args.quantity);
    if (!(qty >= 1) || Math.floor(qty) !== qty) return fail('Quantity must be a whole number of 1 or more.');
    const spot = data.metals[coin.metal].price;
    const each = coin.oz * spot;
    const total = each * qty;
    const text = coin.label + ' melt value: ' + usd(each) + ' each' + (qty > 1 ? ', ' + usd(total) + ' for ' + qty + ' coins' : '') + '.\n' +
      'Each coin contains ' + coin.oz + ' troy ounces of pure ' + coin.metal + '. ' + METALS[coin.metal].label + ' spot is ' + usd(spot) + ' per troy ounce.\n' +
      'This is metal value only. Rare dates and high grades can be worth more to collectors.\n' + source(data, METALS[coin.metal].calc);
    return ok(text, {
      currency: 'USD', coin: String(args.coin), quantity: qty, melt_value_each_usd: round(each, 2), melt_value_total_usd: round(total, 2),
      metal: coin.metal, pure_metal_troy_ounces_each: coin.oz, spot_usd_per_troy_ounce: round(spot, 2), as_of: data.timestamp, source: SITE + METALS[coin.metal].calc,
    });
  }
  return null;
}
function rpcResult(id, result) {
  return { jsonrpc: '2.0', id: id, result: result };
}
function rpcError(id, code, message, data) {
  const e = { code: code, message: message };
  if (data !== undefined) e.data = data;
  return { jsonrpc: '2.0', id: id === undefined ? null : id, error: e };
}
function http(body, status) {
  if (body === null) return new Response(null, { status: status || 202, headers: CORS });
  return new Response(JSON.stringify(body), { status: status || 200, headers: Object.assign({ 'content-type': 'application/json' }, CORS) });
}
function decodeHeader(v) {
  if (typeof v === 'string' && v.indexOf('=?base64?') === 0 && v.slice(-2) === '?=') {
    try {
      const bin = atob(v.slice(9, -2));
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return new TextDecoder().decode(bytes);
    } catch (e) {
      return v;
    }
  }
  return v;
}
function isRequest(msg) {
  return msg.id !== undefined && msg.id !== null;
}
async function handleModern(request, msg) {
  const id = msg.id;
  const params = msg.params && typeof msg.params === 'object' ? msg.params : {};
  const meta = params._meta && typeof params._meta === 'object' ? params._meta : {};
  const bodyVersion = meta[K_VER];
  const headerVersion = request.headers.get('mcp-protocol-version');
  if (!isRequest(msg)) return http(null, 202);
  if (!headerVersion || headerVersion !== bodyVersion) {
    return http(rpcError(id, -32020, 'Header mismatch: MCP-Protocol-Version header must be present and match _meta.' + K_VER), 400);
  }
  if (MODERN.indexOf(bodyVersion) < 0) {
    return http(rpcError(id, -32022, 'Unsupported protocol version', { supported: ALL_VERSIONS, requested: bodyVersion }), 400);
  }
  const headerMethod = request.headers.get('mcp-method');
  if (!headerMethod || headerMethod !== msg.method) {
    return http(rpcError(id, -32020, 'Header mismatch: Mcp-Method header must be present and match the request method'), 400);
  }
  const withMeta = function (result) {
    result.resultType = 'complete';
    result._meta = {};
    result._meta[K_SERVER] = SERVER_INFO;
    return result;
  };
  if (msg.method === 'server/discover') {
    return http(rpcResult(id, withMeta({ supportedVersions: ALL_VERSIONS, capabilities: { tools: {} }, instructions: INSTRUCTIONS, ttlMs: 3600000, cacheScope: 'public' })));
  }
  if (msg.method === 'tools/list') {
    return http(rpcResult(id, withMeta({ tools: TOOLS, ttlMs: 3600000, cacheScope: 'public' })));
  }
  if (msg.method === 'tools/call') {
    const headerName = request.headers.get('mcp-name');
    if (!headerName || decodeHeader(headerName) !== params.name) {
      return http(rpcError(id, -32020, 'Header mismatch: Mcp-Name header must be present and match params.name'), 400);
    }
    const out = await callTool(params.name, params.arguments);
    if (out === null) return http(rpcError(id, -32602, 'Unknown tool: ' + String(params.name)));
    return http(rpcResult(id, withMeta(out)));
  }
  if (msg.method === 'ping') return http(rpcResult(id, withMeta({})));
  return http(rpcError(id, -32601, 'Method not found: ' + String(msg.method)), 404);
}
async function legacyMessage(msg) {
  if (!msg || typeof msg !== 'object' || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
    return rpcError(msg && msg.id, -32600, 'Invalid Request');
  }
  if (!isRequest(msg)) return null;
  const id = msg.id;
  const params = msg.params && typeof msg.params === 'object' ? msg.params : {};
  if (msg.method === 'initialize') {
    const asked = params.protocolVersion;
    const version = LEGACY.indexOf(asked) >= 0 ? asked : LEGACY[0];
    return rpcResult(id, { protocolVersion: version, capabilities: { tools: { listChanged: false } }, serverInfo: SERVER_INFO, instructions: INSTRUCTIONS });
  }
  if (msg.method === 'ping') return rpcResult(id, {});
  if (msg.method === 'tools/list') return rpcResult(id, { tools: TOOLS });
  if (msg.method === 'tools/call') {
    const out = await callTool(params.name, params.arguments);
    if (out === null) return rpcError(id, -32602, 'Unknown tool: ' + String(params.name));
    return rpcResult(id, out);
  }
  if (msg.method === 'resources/list') return rpcResult(id, { resources: [] });
  if (msg.method === 'resources/templates/list') return rpcResult(id, { resourceTemplates: [] });
  if (msg.method === 'prompts/list') return rpcResult(id, { prompts: [] });
  return rpcError(id, -32601, 'Method not found: ' + msg.method);
}
async function handleMcp(request) {
  let msg;
  try {
    msg = JSON.parse(await request.text());
  } catch (e) {
    return http(rpcError(null, -32700, 'Parse error'), 400);
  }
  if (Array.isArray(msg)) {
    if (msg.length === 0) return http(rpcError(null, -32600, 'Invalid Request'), 400);
    const outs = [];
    for (let i = 0; i < msg.length; i++) {
      const o = await legacyMessage(msg[i]);
      if (o) outs.push(o);
    }
    return outs.length ? http(outs) : http(null, 202);
  }
  if (!msg || typeof msg !== 'object' || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
    return http(rpcError(msg && msg.id, -32600, 'Invalid Request'), 400);
  }
  const meta = msg.params && typeof msg.params === 'object' && msg.params._meta && typeof msg.params._meta === 'object' ? msg.params._meta : {};
  const headerVersion = request.headers.get('mcp-protocol-version');
  const modern = msg.method !== 'initialize' && (meta[K_VER] !== undefined || msg.method === 'server/discover' || MODERN.indexOf(headerVersion) >= 0);
  if (modern) return handleModern(request, msg);
  if (headerVersion && LEGACY.indexOf(headerVersion) < 0 && msg.method !== 'initialize') {
    return http(rpcError(msg.id, -32022, 'Unsupported protocol version', { supported: ALL_VERSIONS, requested: headerVersion }), 400);
  }
  const out = await legacyMessage(msg);
  return out ? http(out) : http(null, 202);
}
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (path === '/mcp' || path === '/') {
      if (request.method === 'POST') return handleMcp(request);
      const accept = request.headers.get('accept') || '';
      if ((request.method === 'GET' || request.method === 'HEAD') && (path === '/' || accept.indexOf('text/event-stream') < 0)) {
        return Response.redirect(SITE, path === '/' ? 302 : 301);
      }
      return new Response(JSON.stringify(rpcError(null, -32000, 'Method not allowed. Send JSON-RPC over HTTP POST.')), {
        status: 405, headers: Object.assign({ 'content-type': 'application/json', allow: 'POST, OPTIONS' }, CORS),
      });
    }
    return new Response('Not found', { status: 404, headers: CORS });
  },
};
export { TOOLS };
