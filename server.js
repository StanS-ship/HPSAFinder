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
  const pathname = new URL(reqPath, 'http://localhost').pathname;
  const relative = pathname === '/' ? '/index.html' : pathname;
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

// Only these exact messages come from input validation and are safe to show
// the caller. Every other error (upstream HTTP failures, missing environment
// configuration, unexpected exceptions) carries internal detail and must be
// replaced with a generic message before it leaves the server.
const SAFE_VALIDATION_MESSAGES = new Set([
  'address is required.',
  'specialty must be one of: physician, psychiatrist.',
  'annualPaidAmount must be a non-negative number.',
  'paidToAllowedRatio must be a positive number.',
]);

const GENERIC_ERROR_MESSAGE =
  'We could not complete that lookup right now. Please try again in a moment.';

function sendError(res, err, logLabel) {
  console.error(logLabel, err);
  const message = err && SAFE_VALIDATION_MESSAGES.has(err.message) ? err.message : null;
  const status = message ? 400 : 500;
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: message ?? GENERIC_ERROR_MESSAGE }));
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
    sendError(res, err, '[hpsa-calculator]');
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
    sendError(res, err, '[j1-checker]');
  }
}

const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (req.method === 'POST' && pathname === '/api/calculate') {
    handleApiCalculate(req, res);
    return;
  }
  if (req.method === 'POST' && pathname === '/api/j1-check') {
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
