import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { gzipSync } from 'node:zlib';
import test from 'node:test';
import express from 'express';
import { CLERK_PROXY_PATH, clerkProxyMiddleware, createClerkProxyHandler, getClerkProxyHost } from '../middlewares/clerkProxyMiddleware';

async function listen(server: Server) {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  assert(addr && typeof addr !== 'string');
  return `http://127.0.0.1:${addr.port}`;
}

async function close(server: Server) {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
}

test('Clerk proxy preserves paths, bodies, cookies, compressed bytes and content lengths', async () => {
  const compressed = gzipSync('{"environment":"synthetic"}');
  const upstream = createServer((req, res) => {
    assert.equal(req.headers['clerk-secret-key'], 'synthetic-test-key');
    assert.equal(req.headers['clerk-proxy-url'], `https://school.example.invalid${CLERK_PROXY_PATH}`);
    assert.equal(req.headers['x-forwarded-for'], '192.0.2.8');
    assert.equal(req.headers.host, new URL(target).host);
    if (req.url === '/gzip') {
      res.writeHead(200, { 'content-encoding': 'gzip', 'set-cookie': ['a=1; HttpOnly', 'b=2; Secure'] });
      res.write(compressed.subarray(0, 5));
      res.end(compressed.subarray(5));
    } else if (req.url === '/known') {
      res.writeHead(200, { 'content-length': '4', 'content-type': 'application/octet-stream' });
      res.end(Buffer.from([0, 1, 2, 255]));
    } else if (req.url === '/empty') {
      res.writeHead(204);
      res.end();
    } else if (req.url === '/not-modified') {
      res.writeHead(304, { etag: '"test"', 'content-length': '123' });
      res.end();
    } else if (req.method === 'HEAD') {
      res.writeHead(200, { 'content-length': '42' });
      res.end();
    } else {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        res.writeHead(201, { 'content-type': 'application/json', 'set-cookie': ['session=test; HttpOnly', 'client=test; Secure'] });
        res.write(JSON.stringify({ path: req.url, method: req.method, body: Buffer.concat(chunks).toString() }));
        res.end();
      });
    }
  });
  const target = await listen(upstream);
  const app = express();
  app.use(CLERK_PROXY_PATH, createClerkProxyHandler(target, 'synthetic-test-key'));
  const server = createServer(app);
  const base = await listen(server);
  const headers = { 'x-forwarded-proto': 'https', 'x-forwarded-host': 'school.example.invalid, edge.example.invalid', 'x-forwarded-for': '192.0.2.8, 192.0.2.9' };
  try {
    const response = await fetch(`${base}${CLERK_PROXY_PATH}/v1/client?x=a%2Fb`, {
      method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: '{"hello":"مدرسة"}',
    });
    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), { path: '/v1/client?x=a%2Fb', method: 'POST', body: '{"hello":"مدرسة"}' });
    assert(response.headers.get('content-length'));
    assert.equal(response.headers.get('transfer-encoding'), null);
    assert.deepEqual(response.headers.getSetCookie(), ['session=test; HttpOnly', 'client=test; Secure']);

    const gzip = await fetch(`${base}${CLERK_PROXY_PATH}/gzip`, { headers });
    assert.equal(gzip.headers.get('content-length'), String(compressed.length));
    assert.equal(gzip.headers.get('content-encoding'), 'gzip');
    assert.equal(await gzip.text(), '{"environment":"synthetic"}');
    assert.deepEqual(gzip.headers.getSetCookie(), ['a=1; HttpOnly', 'b=2; Secure']);
    const binary = await fetch(`${base}${CLERK_PROXY_PATH}/known`, { headers });
    assert.equal(binary.headers.get('content-length'), '4');
    assert.deepEqual(Buffer.from(await binary.arrayBuffer()), Buffer.from([0, 1, 2, 255]));
    const empty = await fetch(`${base}${CLERK_PROXY_PATH}/empty`, { headers });
    assert.equal(empty.status, 204);
    assert.equal(empty.headers.get('content-length'), null);
    assert.equal(await empty.text(), '');
    const unchanged = await fetch(`${base}${CLERK_PROXY_PATH}/not-modified`, { headers });
    assert.equal(unchanged.status, 304);
    assert.equal(unchanged.headers.get('content-length'), '123');
    assert.equal(await unchanged.text(), '');
    const head = await fetch(`${base}${CLERK_PROXY_PATH}/head`, { method: 'HEAD', headers });
    assert.equal(head.headers.get('content-length'), '42');
    assert.equal(await head.text(), '');
  } finally {
    await close(server);
    await close(upstream);
  }
});

test('failed upstream returns an empty, length-delimited 502 instead of crashing', async () => {
  const upstream = createServer();
  const target = await listen(upstream);
  await close(upstream);
  const app = express();
  app.use(CLERK_PROXY_PATH, createClerkProxyHandler(target, 'synthetic-test-key'));
  const server = createServer(app);
  const base = await listen(server);
  try {
    const response = await fetch(`${base}${CLERK_PROXY_PATH}/v1/client`);
    assert.equal(response.status, 502);
    assert.equal(response.headers.get('content-length'), '0');
    assert.equal(await response.text(), '');
  } finally {
    await close(server);
  }
});

test('development proxy is a no-op and forwarded host normalization remains compatible', () => {
  const old = process.env.NODE_ENV;
  process.env.NODE_ENV = 'development';
  try {
    let called = false;
    clerkProxyMiddleware()({} as never, {} as never, () => { called = true; });
    assert(called);
    assert.equal(getClerkProxyHost({ headers: { 'x-forwarded-host': [' school.example.invalid, edge.invalid'], host: 'fallback.invalid' } }), 'school.example.invalid');
    assert.equal(getClerkProxyHost({ headers: { host: ' fallback.invalid ' } }), 'fallback.invalid');
  } finally {
    if (old === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = old;
  }
});
