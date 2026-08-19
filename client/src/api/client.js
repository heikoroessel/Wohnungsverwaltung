const BASE = '/api';

async function handleResponse(res) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Fehler ${res.status}`);
  }
  return res.json();
}

export const api = {
  get: (path) => fetch(`${BASE}${path}`).then(handleResponse),
  post: (path, body) =>
    fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(handleResponse),
  put: (path, body) =>
    fetch(`${BASE}${path}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(handleResponse),
  delete: (path, body) =>
    fetch(`${BASE}${path}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    }).then(handleResponse),
  upload: (path, file, extraFields = {}) => {
    const form = new FormData();
    form.append('datei', file);
    Object.entries(extraFields).forEach(([k, v]) => form.append(k, v));
    return fetch(`${BASE}${path}`, { method: 'POST', body: form }).then(handleResponse);
  },
};
