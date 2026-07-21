'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { api, ensureWorkspace, logout } from '@/lib/api';

const primaryNavigation = [
  { href: '/dashboard', label: 'Inicio', icon: 'home' },
  { href: '/projects/new', label: 'Crear contenido', icon: 'spark', accent: true },
];

const libraryNavigation = [
  { href: '/projects', label: 'Proyectos', icon: 'grid' },
  { href: '/products', label: 'Productos', icon: 'cube' },
  { href: '/library', label: 'Contenido', icon: 'image' },
  { href: '/references', label: 'Referencias', icon: 'image' },
  { href: '/recipes', label: 'Dirección creativa', icon: 'aperture' },
];

const settingsNavigation = [
  { href: '/brand-kit', label: 'Sistema de marca', icon: 'brand' },
  { href: '/settings/integrations', label: 'Integraciones IA', icon: 'nodes' },
];

function Icon({ name }) {
  const paths = {
    home: <><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h13V10M9 20v-6h6v6"/></>,
    spark: <><path d="m12 3 1.4 4.6L18 9l-4.6 1.4L12 15l-1.4-4.6L6 9l4.6-1.4L12 3Z"/><path d="m19 15 .7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7L19 15Z"/></>,
    grid: <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></>,
    cube: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m4.5 7.8 7.5 4.3 7.5-4.3M12 12v9"/></>,
    image: <><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m4 17 5-5 3.5 3 2.5-2 5 4"/></>,
    aperture: <><circle cx="12" cy="12" r="9"/><path d="m8 4.9 4 7.1M20.5 9h-8M16 19.1 12 12M3.5 15h8M8 4.9h8M16 19.1H8"/></>,
    brand: <><path d="M12 3 4 7v5c0 4.5 3.4 7.7 8 9 4.6-1.3 8-4.5 8-9V7l-8-4Z"/><path d="m8.5 12 2.2 2.2 4.8-5"/></>,
    nodes: <><circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="7" r="2.5"/><circle cx="12" cy="18" r="2.5"/><path d="m8.3 7 7.2-.1M7.5 8l3.2 7.7M16.7 9.2l-3.4 6.5"/></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16"/></>,
    close: <><path d="m6 6 12 12M18 6 6 18"/></>,
    exit: <><path d="M10 5H5v14h5M14 8l4 4-4 4M18 12H9"/></>,
    collapse: <><path d="m14 6-6 6 6 6"/></>,
  };
  return <svg className="ascend-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function BrandLogo() {
  return <span className="ascend-brand-logo" aria-hidden="true"><img src="/sidebar_logo.png" alt="" /></span>;
}

function NavGroup({ label, items, pathname, onNavigate }) {
  return <section className="app-nav-group"><h2>{label}</h2>{items.map(item => {
    const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(`${item.href}/`));
    return <Link key={item.href} href={item.href} className={`${active ? 'active' : ''} ${item.accent ? 'accent' : ''}`} aria-current={active ? 'page' : undefined} onClick={onNavigate}><Icon name={item.icon}/><span>{item.label}</span>{item.accent && <kbd>N</kbd>}</Link>;
  })}</section>;
}

export default function Nav({ privateNav = false }) {
  const pathname = usePathname();
  const [workspace, setWorkspace] = useState(null);
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(window.localStorage.getItem('ascend-sidebar-collapsed') === 'true');
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!privateNav) return;
    async function loadWorkspace() {
      try {
        await ensureWorkspace();
        const data = await api('/auth/workspaces/');
        setWorkspace((data.results || data)[0] || null);
      } catch {
        setWorkspace(null);
      }
    }
    loadWorkspace();
  }, [privateNav]);

  if (!privateNav) {
    return <header className="public-nav"><div className="public-nav-inner"><Link className="ascend-wordmark" href="/" aria-label="Ascend AI Ad Creator — Inicio"><BrandLogo/></Link><nav aria-label="Navegación pública"><Link href="/">Producto</Link><Link href="/login">Ingresar</Link><Link className="btn primary" href="/register">Crear cuenta</Link></nav></div></header>;
  }

  const closeNavigation = () => setOpen(false);
  const toggleCollapsed = () => setCollapsed(value => {
    const next = !value;
    window.localStorage.setItem('ascend-sidebar-collapsed', String(next));
    return next;
  });
  return <>
    <button className="mobile-nav-trigger" onClick={() => setOpen(value => !value)} aria-label={open ? 'Cerrar navegación' : 'Abrir navegación'} aria-expanded={open}><Icon name={open ? 'close' : 'menu'}/></button>
    {open && <button className="mobile-nav-scrim" aria-label="Cerrar navegación" onClick={closeNavigation}/>}
    <aside className={`app-nav ${open ? 'open' : ''} ${collapsed ? 'collapsed' : ''}`} aria-label="Navegación principal"><button className="app-nav-collapse" type="button" onClick={toggleCollapsed} aria-label={collapsed ? 'Expandir navegación' : 'Plegar navegación'} aria-expanded={!collapsed}><Icon name="collapse"/></button><div className="app-nav-inner">
      <Link className="ascend-wordmark" href="/dashboard" onClick={closeNavigation} aria-label="Ascend AI Ad Creator — Dashboard"><BrandLogo/></Link>
      <div className="workspace-card"><span className="workspace-avatar">{(workspace?.name || 'A').slice(0, 1).toUpperCase()}</span><div><small>Workspace activo</small><strong>{workspace?.name || 'Ascend Studio'}</strong></div><span className="workspace-status" title="Workspace activo"/></div>
      <nav><NavGroup label="Estudio" items={primaryNavigation} pathname={pathname} onNavigate={closeNavigation}/><NavGroup label="Biblioteca" items={libraryNavigation} pathname={pathname} onNavigate={closeNavigation}/><NavGroup label="Configuración" items={settingsNavigation} pathname={pathname} onNavigate={closeNavigation}/></nav>
      <footer className="app-nav-footer"><div><span className="ai-status"><i/>IA conectada</span><small>Ascend Studio · v1.0</small></div><button onClick={logout} aria-label="Cerrar sesión"><Icon name="exit"/></button></footer>
    </div></aside>
  </>;
}
