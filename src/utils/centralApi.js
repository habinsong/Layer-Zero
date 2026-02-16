import { APP_ENV } from '../config/env';

const API_BASE = (APP_ENV.appApiBase || '/lzapi').replace(/\/$/, '');

async function request(path, options = {}) {
  const url = `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export async function getServerSettings() {
  const data = await request('/settings');
  return data?.data || null;
}

export async function putServerSettings(settings) {
  const data = await request('/settings', { method: 'PUT', body: JSON.stringify(settings || {}) });
  return data?.data || null;
}

export async function getMeshHistory(limit = 20) {
  const data = await request(`/mesh-history?limit=${encodeURIComponent(limit)}`);
  return Array.isArray(data?.items) ? data.items : [];
}

export async function createMeshHistory(payload) {
  const data = await request('/mesh-history', { method: 'POST', body: JSON.stringify(payload || {}) });
  return data?.item || null;
}

export async function clearMeshHistoryRemote() {
  await request('/mesh-history', { method: 'DELETE' });
}

export async function getReportsRemote(limit = 200) {
  const data = await request(`/reports?limit=${encodeURIComponent(limit)}`);
  return Array.isArray(data?.items) ? data.items : [];
}

export async function saveReportRemote(report) {
  const data = await request('/reports', { method: 'POST', body: JSON.stringify(report || {}) });
  return data?.item || null;
}

export async function removeReportRemote(id) {
  await request(`/reports/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function clearReportsRemote() {
  await request('/reports', { method: 'DELETE' });
}

export async function getMaintenanceState() {
  const data = await request('/maintenance/state');
  return data?.data || null;
}

export async function putMaintenanceState(payload) {
  const data = await request('/maintenance/state', { method: 'PUT', body: JSON.stringify(payload || {}) });
  return data?.data || null;
}

export async function getMaintenanceLogs(limit = 100) {
  const data = await request(`/maintenance/logs?limit=${encodeURIComponent(limit)}`);
  return Array.isArray(data?.items) ? data.items : [];
}

export async function addMaintenanceLog(payload) {
  const data = await request('/maintenance/logs', { method: 'POST', body: JSON.stringify(payload || {}) });
  return data?.item || null;
}

export async function clearMaintenanceLogsRemote() {
  await request('/maintenance/logs', { method: 'DELETE' });
}

export async function getMaintenanceChecklist() {
  const data = await request('/maintenance/checklist');
  return Array.isArray(data?.items) ? data.items : [];
}

export async function putMaintenanceChecklist(items) {
  const data = await request('/maintenance/checklist', { method: 'PUT', body: JSON.stringify({ items: Array.isArray(items) ? items : [] }) });
  return Array.isArray(data?.items) ? data.items : [];
}

export async function getChatMessagesRemote() {
  const data = await request('/chat/messages');
  return Array.isArray(data?.items) ? data.items : [];
}

export async function saveChatMessagesRemote(items) {
  await request('/chat/messages', { method: 'PUT', body: JSON.stringify({ items: Array.isArray(items) ? items : [] }) });
}

export async function clearChatMessagesRemote() {
  await request('/chat/messages', { method: 'DELETE' });
}

export function subscribeServerEvents(onEvent) {
  if (typeof window === 'undefined' || typeof window.EventSource === 'undefined') {
    return () => {};
  }
  const source = new EventSource(`${API_BASE}/events`);
  source.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data);
      onEvent?.(payload);
    } catch {
      // ignore malformed event
    }
  };
  source.onerror = () => {
    // Browser EventSource will auto-reconnect by default.
  };
  return () => {
    try {
      source.close();
    } catch {
      // ignore close failure
    }
  };
}

export { API_BASE };
