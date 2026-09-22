/**
 * Optional local reference server. This is a thin adapter around
 * src/api/handler.js so you can run and test the pipeline locally with
 * `npm start`. It is NOT required to import this project into Bolt.new —
 * Bolt.new (or any other host) can call calculateHpsaBonus() directly from
 * src/api/handler.js inside its own routing layer.
 *
 * Uses only Node's built-in http/fs modules — no framework dependency —
 * to keep the reference server itself portable too.
 */
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { calculateHpsaBonus, checkJ1Eligibility } from './src/api/handler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, 'public');
const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};

async function serveStatic(reqPath, res) {
  const relative = reqPath === '/' ? '/index.html' : reqPath;
  const filePath = path.join(PUBLIC_DIR, relative);

  // Prevent path traversal outside of public/
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  try {
    const contents = await fs.readFile(filePath);
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(contents);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}

async function handleApiCalculate(req, res) {
  let body = '';
  for await (const chunk of req) body += chunk;

  let input;
  try {
    input = JSON.parse(body || '{}');
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid JSON body.' }));
    return;
  }

  try {
    const result = await calculateHpsaBonus(
      { ...input, googleApiKey: process.env.GOOGLE_GEOCODING_API_KEY },
      { onLog: (entry) => console.log('[hpsa-calculator]', JSON.stringify(entry)) }
    );
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  } catch (err) {
    console.error(err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
}

async function handleApiJ1Check(req, res) {
  let body = '';
  for await (const chunk of req) body += chunk;

  let input;
  try {
    input = JSON.parse(body || '{}');
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid JSON body.' }));
    return;
  }

  try {
    const result = await checkJ1Eligibility(
      { ...input, googleApiKey: process.env.GOOGLE_GEOCODING_API_KEY },
      { onLog: (entry) => console.log('[j1-checker]', JSON.stringify(entry)) }
    );
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  } catch (err) {
    console.error(err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
}

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/api/calculate') {
    handleApiCalculate(req, res);
    return;
  }
  if (req.method === 'POST' && req.url === '/api/j1-check') {
    handleApiJ1Check(req, res);
    return;
  }
  if (req.method === 'GET') {
    serveStatic(req.url, res);
    return;
  }
  res.writeHead(405);
  res.end('Method not allowed');
});

server.listen(PORT, () => {
  console.log(`HPSA bonus calculator (reference server) listening on http://localhost:${PORT}`);
});
