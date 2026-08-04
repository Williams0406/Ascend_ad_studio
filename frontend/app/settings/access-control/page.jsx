'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import Nav from '@/components/Nav';
import PageTitle from '@/components/PageTitle';
import { api } from '@/lib/api';

const EMPTY_POLICY = { access_mode: 'inherit', status: 'active', expires_at: '', reason: '', seat_limit_override: '' };
const dateInput = value => value ? new Date(value).toISOString().slice(0, 16) : '';
const policyLabel = mode => ({ inherit: 'Según suscripción', free: 'Acceso libre', blocked: 'Bloqueado' }[mode] || mode);

function Status({ value }) {
  return <span className={`badge ${value}`}>{value === 'active' ? 'Activo' : value === 'free' ? 'Libre' : value === 'blocked' ? 'Bloqueado' : value}</span>;
}

export default function AccessControlPage() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('workspaces');
  const [query, setQuery] = useState('');
  const [type, setType] = useState('all');
  const [mode, setMode] = useState('all');
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(EMPTY_POLICY);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  async function load() {
    try {
      const me = await api('/auth/me/');
      if (!me.is_superuser && !me.platform_admin?.is_active) return router.replace('/dashboard');
      const response = await api('/admin/access-control/overview/');
      setData(response);
    } catch (error) {
      setNotice(error.message);
    }
  }

  useEffect(() => { load(); }, []);

  const rows = useMemo(() => {
    const source = data?.[tab] || [];
    return source.filter(item => {
      const text = `${item.name} ${item.email || ''} ${item.owner?.email || ''}`.toLowerCase();
      const policy = item.access_policy?.mode || 'inherit';
      return text.includes(query.toLowerCase()) &&
        (tab !== 'workspaces' || type === 'all' || item.workspace_type === type) &&
        (mode === 'all' || policy === mode);
    });
  }, [data, tab, query, type, mode]);

  function inspect(item) {
    setSelected(item);
    setForm({
      access_mode: item.access_policy?.mode || 'inherit',
      status: item.status,
      expires_at: dateInput(item.access_policy?.expires_at),
      reason: item.access_policy?.reason || '',
      seat_limit_override: item.access_policy?.seat_limit_override ?? '',
    });
  }

  async function savePolicy() {
    if (!selected) return;
    setBusy(true); setNotice('');
    const isWorkspace = tab === 'workspaces';
    const payload = {
      status: form.status, access_mode: form.access_mode,
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
      reason: form.reason,
      ...(isWorkspace ? { seat_limit_override: form.seat_limit_override === '' ? null : Number(form.seat_limit_override) } : {}),
    };
    try {
      await api(`/admin/access-control/${isWorkspace ? 'workspaces' : 'users'}/${selected.id}/`, { method: 'PATCH', body: JSON.stringify(payload) });
      await load(); setSelected(null); setNotice('La política se guardó correctamente.');
    } catch (error) { setNotice(error.message); }
    finally { setBusy(false); }
  }

  async function updateMember(member, patch) {
    setBusy(true); setNotice('');
    try {
      const workspace = await api(`/admin/access-control/workspaces/${selected.id}/members/${member.id}/`, { method: 'PATCH', body: JSON.stringify(patch) });
      setSelected(workspace);
      setData(current => ({ ...current, workspaces: current.workspaces.map(item => item.id === workspace.id ? workspace : item) }));
    } catch (error) { setNotice(error.message); }
    finally { setBusy(false); }
  }

  const summary = data?.summary || {};
  return <>
    <Nav privateNav />
    <main className="container ascend-view page page--settings">
      <PageTitle
        className="page-header page-header"
        eyebrow="Administración de plataforma"
        title="Acceso y licencias"
        description="Gestiona suscripciones, excepciones y asientos desde una vista operacional precisa."
      />

      {notice && <div className="notice" role="status">{notice}</div>}

      <section className="grid metrics-grid">
        <article><strong>{summary.users_total ?? '—'}</strong><span>Usuarios registrados</span></article>
        <article><strong>{summary.companies ?? '—'}</strong><span>Empresas</span></article>
        <article><strong>{summary.free_user_overrides ?? '—'}</strong><span>Accesos libres</span></article>
        <article><strong>{summary.blocked_workspaces ?? '—'}</strong><span>Workspaces bloqueados</span></article>
        <article><strong>{summary.seats_used ?? 0} / {summary.seats_limit ?? 0}</strong><span>Asientos usados</span></article>
      </section>

      <section className="split-layout">
        <div className="catalog-section">
          <nav className="tabs"><button className={tab === 'workspaces' ? 'active' : ''} onClick={() => { setTab('workspaces'); setSelected(null); }}>Workspaces</button><button className={tab === 'users' ? 'active' : ''} onClick={() => { setTab('users'); setSelected(null); }}>Usuarios</button></nav>
          <div className="toolbar">
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Filtrar resultados" />
            {tab === 'workspaces' && <select value={type} onChange={event => setType(event.target.value)}><option value="all">Todos los tipos</option><option value="individual">Individual</option><option value="company">Empresa</option></select>}
            <select value={mode} onChange={event => setMode(event.target.value)}><option value="all">Todo acceso</option><option value="inherit">Suscripción</option><option value="free">Libre</option><option value="blocked">Bloqueado</option></select>
          </div>
          <div className="table">
            <div className="list-card heading">{tab === 'workspaces' ? <><span>Cuenta</span><span>Plan y acceso</span><span>Usuarios</span><span>Estado</span></> : <><span>Usuario</span><span>Acceso personal</span><span>Workspaces</span><span>Estado</span></>}</div>
            {rows.map(item => <button key={item.id} className={`list-card ${selected?.id === item.id ? 'selected' : ''}`} onClick={() => inspect(item)}>
              {tab === 'workspaces' ? <><span><strong>{item.name}</strong><small>{item.owner?.email} · {item.workspace_type}</small></span><span><strong>{item.subscription?.plan_name || 'Sin plan'}</strong><small>{policyLabel(item.access_policy?.mode)}</small></span><span><strong>{item.seats.used} / {item.seats.limit}</strong><small>{item.seats.available} disponibles</small></span><span><Status value={item.status} /></span></> : <><span><strong>{item.name}</strong><small>{item.email}</small></span><span><Status value={item.access_policy?.mode || 'inherit'} /></span><span><strong>{item.workspace_count}</strong><small>cuentas asociadas</small></span><span><Status value={item.status} /></span></>}
            </button>)}
            {!rows.length && <div className="empty-state">No hay resultados para los filtros seleccionados.</div>}
          </div>
        </div>

        <aside className={`inspector ${selected ? 'open' : ''}`}>
          {selected ? <><header><div><span>Inspector de acceso</span><h2>{selected.name}</h2><p>{selected.email || selected.owner?.email}</p></div><button onClick={() => setSelected(null)} aria-label="Cerrar">×</button></header>
            <div className="form">
              <label><span>Modo de acceso</span><select value={form.access_mode} onChange={event => setForm({ ...form, access_mode: event.target.value })}><option value="inherit">Según suscripción</option><option value="free">Acceso libre</option><option value="blocked">Bloqueado</option></select></label>
              <label><span>Estado</span><select value={form.status} onChange={event => setForm({ ...form, status: event.target.value })}><option value="active">Activo</option><option value="suspended">Suspendido</option>{tab === 'workspaces' && <option value="cancelled">Cancelado</option>}{tab === 'users' && <option value="deleted">Eliminado</option>}</select></label>
              {tab === 'workspaces' && <label><span>Límite manual</span><input type="number" min="1" value={form.seat_limit_override} onChange={event => setForm({ ...form, seat_limit_override: event.target.value })} placeholder="Usar límite del plan" /></label>}
              <label><span>Vencimiento</span><input type="datetime-local" value={form.expires_at} onChange={event => setForm({ ...form, expires_at: event.target.value })} /></label>
              <label className="wide"><span>Motivo administrativo</span><textarea rows="3" value={form.reason} onChange={event => setForm({ ...form, reason: event.target.value })} placeholder="Contexto para la auditoría" /></label>
              <button className="btn-primary" disabled={busy} onClick={savePolicy}>{busy ? 'Guardando…' : 'Guardar política'}</button>
            </div>
            {tab === 'workspaces' && <><section className="grid metrics-grid"><div><span>Plan</span><strong>{selected.subscription?.plan_name || 'Sin plan'}</strong></div><div><span>Suscripción</span><strong>{selected.subscription?.status || 'No disponible'}</strong></div><div><span>Asientos</span><strong>{selected.seats.used} / {selected.seats.limit}</strong></div><div><span>Acceso efectivo</span><strong>{selected.effective_access.allowed ? 'Permitido' : 'Denegado'}</strong></div></section>
              <section className="table-wrap"><h3>Miembros</h3>{selected.members.map(member => <article key={member.id}><div><strong>{member.name}</strong><small>{member.email}</small></div><select value={member.role} disabled={busy} onChange={event => updateMember(member, { role: event.target.value })}><option value="owner">Owner</option><option value="admin">Admin</option><option value="editor">Editor</option><option value="viewer">Viewer</option></select><button disabled={busy} className={member.is_active ? 'danger' : ''} onClick={() => updateMember(member, { is_active: !member.is_active })}>{member.is_active ? 'Suspender' : 'Activar'}</button></article>)}</section></>}
          </> : <div className="empty-state"><span>⌁</span><h2>Selecciona un registro</h2><p>Inspecciona políticas, suscripciones y miembros sin abandonar el contexto.</p></div>}
        </aside>
      </section>
    </main>
  </>;
}
