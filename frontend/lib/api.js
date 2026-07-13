const API = (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api').replace(/\/$/, '');
const FALLBACK_API = 'http://127.0.0.1:8000/api';

export function tokens() {
  if (typeof window === 'undefined') return {};
  return {
    access: localStorage.getItem('access'),
    refresh: localStorage.getItem('refresh'),
    workspace: localStorage.getItem('workspace'),
  };
}

function apiMessage(data) {
  if (!data) return 'Error de API';
  if (typeof data === 'string') return data;
  if (data.detail) return data.detail;
  const firstKey = Object.keys(data)[0];
  const firstValue = firstKey ? data[firstKey] : null;
  if (Array.isArray(firstValue)) return `${firstKey}: ${firstValue.join(', ')}`;
  if (typeof firstValue === 'string') return `${firstKey}: ${firstValue}`;
  return JSON.stringify(data);
}

export async function api(path, options = {}) {
  const t = tokens();
  const headers = {
    ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers || {}),
  };
  if (t.access) headers.Authorization = `Bearer ${t.access}`;
  if (t.workspace) headers['X-Workspace-ID'] = t.workspace;

  let res;
  const bases = API === FALLBACK_API ? [API] : [API, FALLBACK_API];
  let networkError = null;
  for (const base of bases) {
    try {
      res = await fetch(`${base}${path}`, { ...options, headers });
      break;
    } catch (err) {
      networkError = err;
    }
  }
  if (!res) {
    throw new Error('El navegador bloqueó la conexión con la API. Verifica que Django esté corriendo y que CORS permita Authorization y X-Workspace-ID.');
  }

  if (res.status === 401) {
    if (typeof window !== 'undefined') localStorage.removeItem('access');
    throw new Error('Tu sesión expiró. Ingresa nuevamente.');
  }

  if (!res.ok) {
    let data = null;
    try {
      data = await res.json();
    } catch {
      try {
        data = await res.text();
      } catch {}
    }
    throw new Error(apiMessage(data));
  }

  return res.status === 204 ? null : res.json();
}

export async function login(email, password) {
  localStorage.removeItem('workspace');
  const d = await api('/auth/login/', { method: 'POST', body: JSON.stringify({ email, password }) });
  localStorage.setItem('access', d.access);
  localStorage.setItem('refresh', d.refresh);
  return d;
}

export async function ensureWorkspace() {
  const current = tokens().workspace;
  if (current) return current;
  const data = await api('/auth/workspaces/');
  const first = data.results?.[0] || data[0];
  if (!first) throw new Error('Tu usuario no tiene un workspace activo.');
  localStorage.setItem('workspace', first.id);
  return first.id;
}

export function logout() {
  localStorage.clear();
  location.href = '/login';
}
