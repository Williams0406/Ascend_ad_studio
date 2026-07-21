const API = (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api').replace(/\/$/, '');
const FALLBACK_API = 'http://127.0.0.1:8000/api';
let refreshPromise = null;

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

function clearSessionAndRedirect() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('access');
  localStorage.removeItem('refresh');
  localStorage.removeItem('workspace');
  if (window.location.pathname !== '/') window.location.replace('/');
}

async function requestFromAvailableApi(path, options) {
  const bases = API === FALLBACK_API ? [API] : [API, FALLBACK_API];
  let networkError = null;
  for (const base of bases) {
    try {
      return await fetch(`${base}${path}`, options);
    } catch (error) {
      networkError = error;
    }
  }
  throw networkError || new Error('No se pudo conectar con la API.');
}

async function renewAccessToken(refreshToken) {
  if (!refreshPromise) {
    refreshPromise = requestFromAvailableApi('/auth/refresh/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: refreshToken }),
    }).then(async response => {
      if (!response.ok) throw new Error('La sesión ya no se puede renovar.');
      const data = await response.json();
      localStorage.setItem('access', data.access);
      if (data.refresh) localStorage.setItem('refresh', data.refresh);
      return data.access;
    }).finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

export async function api(path, options = {}, retry = true) {
  const t = tokens();
  const headers = {
    ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers || {}),
  };
  if (t.access) headers.Authorization = `Bearer ${t.access}`;
  if (t.workspace) headers['X-Workspace-ID'] = t.workspace;

  let res;
  try {
    res = await requestFromAvailableApi(path, { ...options, headers });
  } catch {
    throw new Error('El navegador bloqueó la conexión con la API. Verifica que Django esté corriendo y que CORS permita Authorization y X-Workspace-ID.');
  }

  if (res.status === 401) {
    const isAuthenticationRequest = path.startsWith('/auth/login') || path.startsWith('/auth/refresh');
    if (retry && !isAuthenticationRequest && t.refresh) {
      try {
        await renewAccessToken(t.refresh);
        return api(path, options, false);
      } catch {
        clearSessionAndRedirect();
        throw new Error('Tu sesión expiró. Te estamos llevando al inicio.');
      }
    }
    if (!isAuthenticationRequest && (t.access || t.refresh)) clearSessionAndRedirect();
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
  localStorage.removeItem('access');
  localStorage.removeItem('refresh');
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
