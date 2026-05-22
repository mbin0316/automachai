/**
 * tests/smoke.js
 * Quick smoke test — runs without any API keys (uses mock fallbacks).
 * Run with: node tests/smoke.js
 */

process.env.NODE_ENV = 'development';
require('dotenv').config();

const http = require('http');

const BASE = `http://localhost:${process.env.PORT || 4000}`;
let   pass = 0, fail = 0;

async function get(path) {
  return new Promise((resolve, reject) => {
    http.get(BASE + path, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, json: JSON.parse(body) }); }
        catch { resolve({ status: res.statusCode, raw: body }); }
      });
    }).on('error', reject);
  });
}

async function test(label, path, expect) {
  try {
    const res = await get(path);
    const ok  = res.status === expect;
    console.log(`${ok ? '✓' : '✗'} [${res.status}] ${path} — ${label}`);
    ok ? pass++ : fail++;
  } catch (e) {
    console.log(`✗ ERROR ${path} — ${e.message}`);
    fail++;
  }
}

async function run() {
  console.log('\n── FlowDesk Smoke Tests ─────────────────────────\n');

  await test('health check',                          '/health',                                          200);
  await test('list clients',                          '/api/clients',                                     200);
  await test('get client',                            '/api/clients/klinik-sejahtera',                    200);
  await test('client not found',                      '/api/clients/does-not-exist',                      404);
  await test('retell calls (mock)',                   '/api/retell/calls?clientId=klinik-sejahtera',      200);
  await test('retell analytics (mock)',               '/api/retell/analytics?clientId=klinik-sejahtera',  200);
  await test('retell agents (mock)',                  '/api/retell/agents',                               200);
  await test('n8n workflows (mock)',                  '/api/n8n/workflows?clientId=klinik-sejahtera',     200);
  await test('n8n executions (mock)',                 '/api/n8n/executions',                              200);
  await test('calendar appointments (mock)',          '/api/calendar/appointments?clientId=klinik-sejahtera', 200);
  await test('missing clientId → 400',               '/api/retell/calls',                                400);
  await test('404 for unknown route',                '/api/does-not-exist',                              404);

  console.log(`\n── Results: ${pass} passed, ${fail} failed ──────────────\n`);
  process.exit(fail > 0 ? 1 : 0);
}

// Start the server, run tests, then stop
const app    = require('../index');
const server = app.listen ? null : http.createServer(app);

setTimeout(run, 500);  // allow server to bind
