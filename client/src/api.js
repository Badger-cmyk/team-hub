const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const TOKEN_KEY = 'hub_token';

// An error that carries the status and per-field messages from the server.
export class ApiError extends Error {
  constructor(message, status, fields = {}) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

// App.jsx will register a function here that signs the user out on an expired token.
let onUnauthorized = () => {};
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage can be blocked (private windows). The app still works until refresh.
  }
}
export const hasToken = () => Boolean(getToken());

async function request(path, { method = 'GET', body, signal } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(`${API_URL}/api${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err; // a newer request replaced this one
    throw new ApiError('Could not reach the server. Check your connection and try again.', 0);
  }

  if (res.status === 204) return null;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token) onUnauthorized();
    throw new ApiError(data.error || 'Something went wrong. Try again.', res.status, data.fields);
  }
  return data;
}

export const api = {
  health: () => request('/health'),
  register: (body) => request('/auth/register', { method: 'POST', body }),
  login: (body) => request('/auth/login', { method: 'POST', body }),
  me: () => request('/auth/me'),
  categories: () => request('/categories'),
  list: (params = {}, signal) => {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value) qs.set(key, value);
    const suffix = qs.toString() ? `?${qs}` : '';
    return request(`/resources${suffix}`, { signal });
  },
  create: (body) => request('/resources', { method: 'POST', body }),
  update: (id, body) => request(`/resources/${id}`, { method: 'PUT', body }),
  remove: (id) => request(`/resources/${id}`, { method: 'DELETE' }),
  vote: (id) => request(`/resources/${id}/vote`, { method: 'POST' }),
  onboarding: (signal) => request(`/onboarding`, { signal }),   
  setOnboardingDone: (id, done) => request(`/onboarding/${id}`, { method: 'PUT', body: { done } }),
};