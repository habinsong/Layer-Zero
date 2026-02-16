import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.LZ_API_PORT || 8787);
const STORE_PATH = path.join(__dirname, 'data', 'store.json');

const DEFAULT_STORE = {
  meta: {
    revision: 1,
    updatedAt: null,
    resources: {}
  },
  settings: null,
  meshHistory: [],
  reports: [],
  maintenance: {
    state: {
      nozzleLastReset: 0,
      greaseLastReset: 0,
      mode: 'auto',
      manualTotalHours: 0,
      filamentName: '',
      filamentTotalLength: 1000,
      filamentUsedLength: 0,
      filamentMode: 'auto'
    },
    logs: [],
    checklist: []
  },
  chat: {
    messages: []
  }
};

function ensureStoreFile() {
  const dir = path.dirname(STORE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(STORE_PATH)) {
    fs.writeFileSync(STORE_PATH, JSON.stringify(DEFAULT_STORE, null, 2), 'utf8');
  }
}

function readStore() {
  ensureStoreFile();
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_STORE,
      ...parsed,
      meta: {
        ...DEFAULT_STORE.meta,
        ...(parsed.meta || {}),
        resources: {
          ...DEFAULT_STORE.meta.resources,
          ...(parsed.meta?.resources || {})
        }
      },
      maintenance: {
        ...DEFAULT_STORE.maintenance,
        ...(parsed.maintenance || {}),
        state: {
          ...DEFAULT_STORE.maintenance.state,
          ...(parsed.maintenance?.state || {})
        }
      },
      chat: {
        ...DEFAULT_STORE.chat,
        ...(parsed.chat || {})
      }
    };
  } catch {
    return structuredClone(DEFAULT_STORE);
  }
}

function writeStore(store) {
  store.meta = store.meta || { revision: 1, updatedAt: null, resources: {} };
  if (!Number.isFinite(Number(store.meta.revision)) || Number(store.meta.revision) < 1) {
    store.meta.revision = 1;
  }
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function deepMerge(base, patch) {
  if (!isPlainObject(base) || !isPlainObject(patch)) {
    return patch;
  }
  const merged = { ...base };
  Object.keys(patch).forEach((key) => {
    const baseValue = merged[key];
    const patchValue = patch[key];
    if (isPlainObject(baseValue) && isPlainObject(patchValue)) {
      merged[key] = deepMerge(baseValue, patchValue);
    } else {
      merged[key] = patchValue;
    }
  });
  return merged;
}

const eventClients = new Set();

function pushEvent(payload) {
  const message = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of eventClients) {
    try {
      res.write(message);
    } catch {
      // ignore write failures
    }
  }
}

function emitResourceEvent(type, touched, extra = {}) {
  pushEvent({
    type,
    revision: touched?.revision || null,
    at: touched?.updatedAt || new Date().toISOString(),
    ...extra
  });
}

function touchStore(store, resource) {
  const nextRevision = Number(store.meta?.revision || 0) + 1;
  const now = new Date().toISOString();
  store.meta = store.meta || { revision: 1, updatedAt: null, resources: {} };
  store.meta.revision = nextRevision;
  store.meta.updatedAt = now;
  store.meta.resources = store.meta.resources || {};
  if (resource) {
    store.meta.resources[resource] = {
      revision: nextRevision,
      updatedAt: now
    };
  }
  return { revision: nextRevision, updatedAt: now };
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.get('/lzapi/health', (_req, res) => {
  res.json({ ok: true, service: 'layer-zero-central-storage', time: new Date().toISOString() });
});

app.get('/lzapi/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const store = readStore();
  const hello = {
    type: 'connected',
    revision: Number(store.meta?.revision || 1),
    at: new Date().toISOString()
  };
  res.write(`data: ${JSON.stringify(hello)}\n\n`);
  eventClients.add(res);

  const heartbeat = setInterval(() => {
    res.write(`: keep-alive ${Date.now()}\n\n`);
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    eventClients.delete(res);
    res.end();
  });
});

app.get('/lzapi/settings', (_req, res) => {
  const store = readStore();
  res.json({ ok: true, data: store.settings, meta: store.meta || null });
});

app.put('/lzapi/settings', (req, res) => {
  const store = readStore();
  store.settings = deepMerge(store.settings || {}, req.body || {});
  store.settings.updatedAt = new Date().toISOString();
  const touched = touchStore(store, 'settings');
  writeStore(store);
  emitResourceEvent('settings.updated', touched, { data: store.settings });
  res.json({ ok: true, data: store.settings, meta: store.meta || null });
});

app.get('/lzapi/mesh-history', (req, res) => {
  const store = readStore();
  const limit = Math.max(1, Math.min(200, Number(req.query.limit || 20)));
  res.json({ ok: true, items: asArray(store.meshHistory).slice(0, limit) });
});

app.post('/lzapi/mesh-history', (req, res) => {
  const payload = req.body || {};
  const item = {
    id: payload.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: payload.createdAt || new Date().toISOString(),
    filename: payload.filename || '',
    rows: Number(payload.rows || 0),
    cols: Number(payload.cols || 0),
    min: Number.isFinite(Number(payload.min)) ? Number(payload.min) : null,
    max: Number.isFinite(Number(payload.max)) ? Number(payload.max) : null,
    avg: Number.isFinite(Number(payload.avg)) ? Number(payload.avg) : null,
    matrix: asArray(payload.matrix)
  };

  const store = readStore();
  const next = [item, ...asArray(store.meshHistory)].slice(0, 100);
  store.meshHistory = next;
  const touched = touchStore(store, 'meshHistory');
  writeStore(store);
  emitResourceEvent('mesh.updated', touched, { action: 'upsert', item });
  res.status(201).json({ ok: true, item });
});

app.delete('/lzapi/mesh-history', (_req, res) => {
  const store = readStore();
  store.meshHistory = [];
  const touched = touchStore(store, 'meshHistory');
  writeStore(store);
  emitResourceEvent('mesh.updated', touched, { action: 'clear' });
  res.json({ ok: true });
});

app.get('/lzapi/reports', (req, res) => {
  const store = readStore();
  const limit = Math.max(1, Math.min(500, Number(req.query.limit || 200)));
  res.json({ ok: true, items: asArray(store.reports).slice(0, limit) });
});

app.post('/lzapi/reports', (req, res) => {
  const report = req.body || {};
  if (!report || typeof report !== 'object') {
    return res.status(400).json({ ok: false, error: 'invalid_report' });
  }

  const store = readStore();
  const reports = asArray(store.reports);
  const duplicate = reports.find((item) => {
    const sameFilename = item.filename === report.filename;
    const durationGap = Math.abs((item.durationSec || 0) - (report.durationSec || 0));
    const createdGap = Math.abs(new Date(item.createdAt || 0).getTime() - new Date(report.createdAt || 0).getTime());
    const costGap = Math.abs((item.cost?.total || 0) - (report.cost?.total || 0));
    const bothCompleted = (item.progress || 0) >= 99 && (report.progress || 0) >= 99;
    return sameFilename && bothCompleted && durationGap <= 8 && costGap <= 10 && createdGap <= 2 * 60 * 1000;
  });

  if (duplicate) {
    return res.json({ ok: true, duplicate: true, item: duplicate });
  }

  const item = {
    ...report,
    id: report.id || `report-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: report.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  store.reports = [item, ...reports].slice(0, 300);
  const touched = touchStore(store, 'reports');
  writeStore(store);
  emitResourceEvent('reports.updated', touched, { action: 'upsert', item });
  res.status(201).json({ ok: true, item });
});

app.delete('/lzapi/reports/:id', (req, res) => {
  const { id } = req.params;
  const store = readStore();
  store.reports = asArray(store.reports).filter((r) => String(r.id) !== String(id));
  const touched = touchStore(store, 'reports');
  writeStore(store);
  emitResourceEvent('reports.updated', touched, { action: 'delete', id: String(id) });
  res.json({ ok: true });
});

app.delete('/lzapi/reports', (_req, res) => {
  const store = readStore();
  store.reports = [];
  const touched = touchStore(store, 'reports');
  writeStore(store);
  emitResourceEvent('reports.updated', touched, { action: 'clear' });
  res.json({ ok: true });
});

app.get('/lzapi/maintenance/state', (_req, res) => {
  const store = readStore();
  res.json({ ok: true, data: store.maintenance?.state || DEFAULT_STORE.maintenance.state });
});

app.put('/lzapi/maintenance/state', (req, res) => {
  const store = readStore();
  store.maintenance = store.maintenance || structuredClone(DEFAULT_STORE.maintenance);
  store.maintenance.state = {
    ...store.maintenance.state,
    ...(req.body || {}),
    updatedAt: new Date().toISOString()
  };
  const touched = touchStore(store, 'maintenance.state');
  writeStore(store);
  emitResourceEvent('maintenance.state.updated', touched, { data: store.maintenance.state });
  res.json({ ok: true, data: store.maintenance.state });
});

app.get('/lzapi/maintenance/logs', (req, res) => {
  const store = readStore();
  const limit = Math.max(1, Math.min(500, Number(req.query.limit || 100)));
  res.json({ ok: true, items: asArray(store.maintenance?.logs).slice(0, limit) });
});

app.post('/lzapi/maintenance/logs', (req, res) => {
  const payload = req.body || {};
  const item = {
    id: payload.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    time: payload.time || new Date().toLocaleString('ko-KR', { hour12: false }),
    action: payload.action || '알 수 없음',
    detail: payload.detail || '',
    createdAt: payload.createdAt || new Date().toISOString()
  };
  const store = readStore();
  store.maintenance = store.maintenance || structuredClone(DEFAULT_STORE.maintenance);
  store.maintenance.logs = [item, ...asArray(store.maintenance.logs)].slice(0, 200);
  const touched = touchStore(store, 'maintenance.logs');
  writeStore(store);
  emitResourceEvent('maintenance.logs.updated', touched, { action: 'add', item });
  res.status(201).json({ ok: true, item });
});

app.delete('/lzapi/maintenance/logs', (_req, res) => {
  const store = readStore();
  store.maintenance = store.maintenance || structuredClone(DEFAULT_STORE.maintenance);
  store.maintenance.logs = [];
  const touched = touchStore(store, 'maintenance.logs');
  writeStore(store);
  emitResourceEvent('maintenance.logs.updated', touched, { action: 'clear' });
  res.json({ ok: true });
});

app.get('/lzapi/maintenance/checklist', (_req, res) => {
  const store = readStore();
  res.json({ ok: true, items: asArray(store.maintenance?.checklist) });
});

app.put('/lzapi/maintenance/checklist', (req, res) => {
  const payload = req.body || {};
  const items = asArray(payload.items);
  const store = readStore();
  store.maintenance = store.maintenance || structuredClone(DEFAULT_STORE.maintenance);
  store.maintenance.checklist = items;
  const touched = touchStore(store, 'maintenance.checklist');
  writeStore(store);
  emitResourceEvent('maintenance.checklist.updated', touched, { items });
  res.json({ ok: true, items });
});

app.get('/lzapi/chat/messages', (_req, res) => {
  const store = readStore();
  res.json({ ok: true, items: asArray(store.chat?.messages) });
});

app.put('/lzapi/chat/messages', (req, res) => {
  const payload = req.body || {};
  const items = asArray(payload.items).slice(-500);
  const store = readStore();
  store.chat = store.chat || structuredClone(DEFAULT_STORE.chat);
  store.chat.messages = items;
  const touched = touchStore(store, 'chat.messages');
  writeStore(store);
  emitResourceEvent('chat.messages.updated', touched, { items });
  res.json({ ok: true, count: items.length });
});

app.delete('/lzapi/chat/messages', (_req, res) => {
  const store = readStore();
  store.chat = store.chat || structuredClone(DEFAULT_STORE.chat);
  store.chat.messages = [];
  const touched = touchStore(store, 'chat.messages');
  writeStore(store);
  emitResourceEvent('chat.messages.updated', touched, { items: [] });
  res.json({ ok: true });
});

app.listen(PORT, '0.0.0.0', () => {
  ensureStoreFile();
  console.log(`[layer-zero-api] listening on http://0.0.0.0:${PORT}`);
  console.log(`[layer-zero-api] store: ${STORE_PATH}`);
});
