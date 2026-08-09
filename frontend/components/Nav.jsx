"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { api, ensureWorkspace, logout, tokens } from "@/lib/api";

const primaryNavigation = [
  {
    href: "/dashboard",
    label: "Inicio",
    description: "Resumen del estudio",
    icon: "home",
  },
  {
    href: "/workspace",
    label: "Espacio de trabajo",
    description: "Campaign Workspace",
    icon: "spark",
  },
  {
    href: "/concept-planner",
    label: "Concept Planner",
    description: "Planificar campañas con IA",
    icon: "concept",
  },
];

const libraryNavigation = [
  {
    href: "/projects",
    label: "Proyectos",
    description: "Campañas y entregables",
    icon: "grid",
  },
  {
    href: "/products",
    label: "Productos",
    description: "Catálogo comercial",
    icon: "cube",
  },
  {
    href: "/library",
    label: "Contenido",
    description: "Assets y resultados",
    icon: "image",
  },
  {
    href: "/references",
    label: "Referencias",
    description: "Inspiración creativa",
    icon: "bookmark",
  },
  {
    href: "/recipes",
    label: "Dirección creativa",
    description: "Recetas y criterios",
    icon: "aperture",
  },
];

const settingsNavigation = [
  {
    href: "/brand-kit",
    label: "Sistema de marca",
    description: "Identidad y reglas",
    icon: "brand",
  },
  {
    href: "/brand-intelligence",
    label: "Inteligencia de marca",
    description: "Audiencias y ángulos",
    icon: "activity",
  },
  {
    href: "/settings/integrations",
    label: "Integraciones IA",
    description: "Modelos y proveedores",
    icon: "nodes",
  },
];

function Icon({ name }) {
  const paths = {
    home: (
      <>
        <path d="M3 11.5 12 4l9 7.5" />
        <path d="M5.5 10v10h13V10M9 20v-6h6v6" />
      </>
    ),
    spark: (
      <>
        <path d="m12 3 1.4 4.6L18 9l-4.6 1.4L12 15l-1.4-4.6L6 9l4.6-1.4L12 3Z" />
        <path d="m19 15 .7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7L19 15Z" />
      </>
    ),
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.4" />
        <rect x="14" y="3" width="7" height="7" rx="1.4" />
        <rect x="3" y="14" width="7" height="7" rx="1.4" />
        <rect x="14" y="14" width="7" height="7" rx="1.4" />
      </>
    ),
    cube: (
      <>
        <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
        <path d="m4.5 7.8 7.5 4.3 7.5-4.3M12 12v9" />
      </>
    ),
    image: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2.5" />
        <circle cx="8.5" cy="9" r="1.5" />
        <path d="m4 17 5-5 3.5 3 2.5-2 5 4" />
      </>
    ),
    bookmark: (
      <>
        <path d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-3.8L6 21V4.5Z" />
      </>
    ),
    aperture: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m8 4.9 4 7.1M20.5 9h-8M16 19.1 12 12M3.5 15h8M8 4.9h8M16 19.1H8" />
      </>
    ),
    brand: (
      <>
        <path d="M12 3 4 7v5c0 4.5 3.4 7.7 8 9 4.6-1.3 8-4.5 8-9V7l-8-4Z" />
        <path d="m8.5 12 2.2 2.2 4.8-5" />
      </>
    ),
    nodes: (
      <>
        <circle cx="6" cy="6" r="2.5" />
        <circle cx="18" cy="7" r="2.5" />
        <circle cx="12" cy="18" r="2.5" />
        <path d="m8.3 7 7.2-.1M7.5 8l3.2 7.7M16.7 9.2l-3.4 6.5" />
      </>
    ),
    key: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="3" />
        <path d="M8 10h8M8 14h5" />
      </>
    ),
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    exit: (
      <>
        <path d="M10 5H5v14h5M14 8l4 4-4 4M18 12H9" />
      </>
    ),
    collapse: <path d="m14.5 6-6 6 6 6" />,
    chevron: <path d="m9 18 6-6-6-6" />,
    activity: (
      <>
        <path d="M3 12h4l2-6 4 12 2-6h6" />
      </>
    ),
    concept: (
      <>
        <circle cx="7" cy="7" r="3" />
        <circle cx="17" cy="7" r="3" />
        <circle cx="12" cy="17" r="3" />
        <path d="m9.6 8.8 1.5 5.3M14.4 8.8l-1.5 5.3M10 7h4" />
      </>
    ),
  };

  return (
    <svg
      className="ascend-icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

function BrandLogo({ compact = false }) {
  return (
    <span
      className={[
        "ascend-brand-logo",
        compact ? "ascend-brand-logo--compact" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <img
        src={compact ? "/icon.png" : "/sidebar_logo.png"}
        alt={compact ? "Ascend" : "Ascend Creative Studio"}
      />
    </span>
  );
}

function NavGroup({ label, items, pathname, onNavigate, collapsed }) {
  return (
    <section className="app-nav-group" aria-label={label}>
      <h2>
        <span>{label}</span>
      </h2>

      <div className="app-nav-group-links">
        {items.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/dashboard" &&
              pathname.startsWith(`${item.href}/`));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`${active ? "active" : ""} ${
                item.accent ? "accent" : ""
              }`}
              aria-current={active ? "page" : undefined}
              aria-label={collapsed ? item.label : undefined}
              data-tooltip={collapsed ? item.label : undefined}
              onClick={onNavigate}
            >
              <span className="nav-item-icon">
                <Icon name={item.icon} />
              </span>

              <span className="nav-item-copy">
                <strong>{item.label}</strong>
                <small>{item.description}</small>
              </span>

              {item.shortcut ? <kbd>{item.shortcut}</kbd> : null}
              {active ? <span className="nav-active-dot" /> : null}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export default function Nav({ privateNav = false }) {
  const pathname = usePathname();
  const [workspace, setWorkspace] = useState(null);
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [ready, setReady] = useState(false);
  const [canManageAccess, setCanManageAccess] = useState(false);
  const [hasSession, setHasSession] = useState(null);

  useEffect(() => {
    const storedCollapsed =
      window.localStorage.getItem("ascend-sidebar-collapsed") === "true";

    setCollapsed(storedCollapsed);
    setReady(true);

    const session = tokens();
    setHasSession(Boolean(session.access || session.refresh));
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!privateNav || !ready) return;

    document.body.dataset.sidebar = collapsed ? "collapsed" : "expanded";

    return () => {
      delete document.body.dataset.sidebar;
    };
  }, [collapsed, privateNav, ready]);

  useEffect(() => {
    if (!open) return;

    const handleEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("keydown", handleEscape);
    document.body.classList.add("nav-drawer-open");

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.classList.remove("nav-drawer-open");
    };
  }, [open]);

  useEffect(() => {
    if (!privateNav) return;

    async function loadWorkspace() {
      try {
        await ensureWorkspace();
        const [data, me] = await Promise.all([
          api("/auth/workspaces/"),
          api("/auth/me/"),
        ]);

        setWorkspace((data.results || data)[0] || null);
        setCanManageAccess(
          Boolean(me.is_superuser || me.platform_admin?.is_active),
        );
      } catch {
        setWorkspace(null);
      }
    }

    loadWorkspace();
  }, [privateNav]);

  const visibleSettings = useMemo(
    () =>
      canManageAccess
        ? [
            ...settingsNavigation,
            {
              href: "/settings/access-control",
              label: "Acceso y licencias",
              description: "Usuarios y permisos",
              icon: "key",
            },
          ]
        : settingsNavigation,
    [canManageAccess],
  );

  if (!privateNav) {
    return (
      <header className="public-nav">
        <div className="public-nav-inner">
          <Link
            className="ascend-wordmark ascend-wordmark--image ascend-wordmark--public"
            href="/"
            aria-label="Ascend — Inicio"
          >
            <BrandLogo />
          </Link>

          <nav aria-label="Navegación pública">
            <Link href="/">Producto</Link>
            {hasSession === true ? (
              <Link className="btn btn-primary" href="/dashboard">
                Ir al estudio
              </Link>
            ) : hasSession === false ? (
              <>
                <Link href="/login">Ingresar</Link>
                <Link className="btn btn-primary" href="/register">
                  Crear cuenta
                </Link>
              </>
            ) : null}
          </nav>
        </div>
      </header>
    );
  }

  const closeNavigation = () => setOpen(false);

  const toggleCollapsed = () => {
    setCollapsed((value) => {
      const next = !value;
      window.localStorage.setItem("ascend-sidebar-collapsed", String(next));
      return next;
    });
  };

  const workspaceName = workspace?.name || "Ascend Studio";
  const workspaceInitial = workspaceName.slice(0, 1).toUpperCase();

  return (
    <>
      <button
        type="button"
        className="mobile-nav-trigger"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? "Cerrar navegación" : "Abrir navegación"}
        aria-expanded={open}
        aria-controls="ascend-app-navigation"
      >
        <Icon name={open ? "close" : "menu"} />
        <span>{open ? "Cerrar" : "Menú"}</span>
      </button>

      {open ? (
        <button
          type="button"
          className="mobile-nav-scrim"
          aria-label="Cerrar navegación"
          onClick={closeNavigation}
        />
      ) : null}

      <aside
        id="ascend-app-navigation"
        className={`app-nav ${open ? "open" : ""} ${
          collapsed ? "collapsed" : ""
        } ${ready ? "is-ready" : ""}`}
        aria-label="Navegación principal"
      >
        <div className="app-nav-surface">
          <header className="app-nav-header">
            <Link
              className="ascend-wordmark ascend-wordmark--image"
              href="/dashboard"
              onClick={closeNavigation}
              aria-label="Ir al inicio de Ascend"
              data-tooltip={collapsed ? "Ascend" : undefined}
            >
              <BrandLogo compact={collapsed} />
            </Link>

            <button
              className="app-nav-collapse"
              type="button"
              onClick={toggleCollapsed}
              aria-label={
                collapsed ? "Expandir navegación" : "Plegar navegación"
              }
              aria-expanded={!collapsed}
              data-tooltip={collapsed ? "Expandir menú" : "Plegar menú"}
            >
              <Icon name={collapsed ? "chevron" : "collapse"} />
            </button>
          </header>

          <Link
            href="/workspace"
            className="workspace-card"
            data-tooltip={collapsed ? workspaceName : undefined}
            onClick={closeNavigation}
          >
            <span className="workspace-avatar">{workspaceInitial}</span>

            <span className="workspace-copy">
              <small>Espacio de trabajo</small>
              <strong>{workspaceName}</strong>
            </span>

            <span className="workspace-card__chevron" aria-hidden="true">
              ›
            </span>
          </Link>

          <nav
            className="app-nav-scroll"
            aria-label="Secciones de la plataforma"
          >
            <NavGroup
              label="Estudio"
              items={primaryNavigation}
              pathname={pathname}
              onNavigate={closeNavigation}
              collapsed={collapsed}
            />

            <NavGroup
              label="Biblioteca"
              items={libraryNavigation}
              pathname={pathname}
              onNavigate={closeNavigation}
              collapsed={collapsed}
            />

            <NavGroup
              label="Configuración"
              items={visibleSettings}
              pathname={pathname}
              onNavigate={closeNavigation}
              collapsed={collapsed}
            />
          </nav>

          <footer className="app-nav-footer">
            <button
              type="button"
              className="app-nav-logout"
              onClick={logout}
              aria-label="Salir de Ascend"
              data-tooltip={collapsed ? "Salir" : undefined}
            >
              <span className="app-nav-logout__icon" aria-hidden="true">
                <Icon name="exit" />
              </span>

              <span className="app-nav-logout__copy">
                <strong>Salir</strong>
                <small>Cerrar sesión de forma segura</small>
              </span>

              <span className="app-nav-logout__arrow" aria-hidden="true">
                →
              </span>
            </button>
          </footer>
        </div>
      </aside>
    </>
  );
}
