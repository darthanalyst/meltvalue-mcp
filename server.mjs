#!/usr/bin/env node
// Runs the MeltValue MCP server outside Cloudflare.
//   node server.mjs          -> stdio transport (for local MCP clients)
//   node server.mjs --http   -> Streamable HTTP on http://localhost:$PORT/mcp (default 8787)
import http from 'node:http';
import readline from 'node:readline';
import worker from './src/worker.js';

const ENDPOINT = 'http://localhost/mcp';

async function runStdio() {
  let version = null;
  const rl = readline.createInterface({ input: process.stdin, terminal: false });
  for await (const line of rl) {
    const text = line.trim();
    if (!text) continue;
    let msg;
    try { msg = JSON.parse(text); } catch { continue; }
    const headers = { 'content-type': 'application/json', accept: 'application/json, text/event-stream' };
    if (version && msg.method !== 'initialize') headers['mcp-protocol-version'] = version;
    let body = '';
    try {
      const res = await worker.fetch(new Request(ENDPOINT, { method: 'POST', headers, body: text }));
      body = (await res.text()).trim();
    } catch (err) {
      if (msg.id !== undefined) {
        body = JSON.stringify({ jsonrpc: '2.0', id: msg.id, error: { code: -32603, message: String(err && err.message || err) } });
      }
    }
    if (!body) continue;
    if (msg.method === 'initialize') {
      try { version = JSON.parse(body).result.protocolVersion || version; } catch {}
    }
    process.stdout.write(body.replace(/\r?\n/g, '') + '\n');
  }
}

function runHttp() {
  const port = Number(process.env.PORT || 8787);
  http.createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
    const request = new Request('http://' + (req.headers.host || 'localhost') + req.url, {
      method: req.method,
      headers: req.headers,
      body: hasBody ? Buffer.concat(chunks) : undefined,
    });
    const out = await worker.fetch(request);
    res.writeHead(out.status, Object.fromEntries(out.headers));
    res.end(Buffer.from(await out.arrayBuffer()));
  }).listen(port, () => console.error('MeltValue MCP listening on http://localhost:' + port + '/mcp'));
}

if (process.argv.includes('--http')) runHttp(); else runStdio();
