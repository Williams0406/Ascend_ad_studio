"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import Nav from "@/components/Nav";

import {
  CheckIcon,
  MoreIcon,
  SearchIcon,
  XIcon,
} from "@/components/catalog/CatalogIcons";

import {
  CatalogPageHeader,
  CatalogPreview,
  CatalogWorkspace,
} from "@/components/catalog/CatalogLayout";

import { api } from "@/lib/api";

const EMPTY_POLICY = {
  access_mode: "inherit",
  status: "active",
  expires_at: "",
  reason: "",
  seat_limit_override: "",
};

const dateInput = (value) =>
  value ? new Date(value).toISOString().slice(0, 16) : "";

const policyLabel = (mode) =>
  ({
    inherit: "Según suscripción",
    free: "Acceso libre",
    blocked: "Bloqueado",
  })[mode] || mode;

const statusLabel = (value) =>
  ({
    active: "Activo",
    suspended: "Suspendido",
    cancelled: "Cancelado",
    deleted: "Eliminado",
    free: "Libre",
    blocked: "Bloqueado",
    inherit: "Suscripción",
  })[value] || value;

function initials(value = "") {
  const words = String(value).trim().split(/\s+/).filter(Boolean);

  if (!words.length) return "AC";

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

function Status({ value }) {
  return (
    <span
      className={["access-status", `access-status--${value || "inherit"}`].join(
        " ",
      )}
    >
      <i aria-hidden="true" />
      {statusLabel(value)}
    </span>
  );
}

function AccessMetric({ eyebrow, value, description, tone = "copper", icon }) {
  return (
    <article className={`access-metric access-metric--${tone}`}>
      <div className="access-metric__icon">{icon}</div>

      <div>
        <span>{eyebrow}</span>
        <strong>{value}</strong>
        <small>{description}</small>
      </div>
    </article>
  );
}

function UsersIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <circle cx="17" cy="9" r="2.4" />
      <path d="M15.5 14.5A4.5 4.5 0 0 1 21 19" />
    </svg>
  );
}

function CompanyIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 21V5h10v16M14 9h6v12M8 9h2M8 13h2M8 17h2M17 13h1M17 17h1" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3 5 6v5c0 4.7 2.8 8.1 7 10 4.2-1.9 7-5.3 7-10V6l-7-3Z" />
      <path d="m9.2 12 1.8 1.8 3.8-4" />
    </svg>
  );
}

function SeatIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 4v7a5 5 0 0 0 10 0V4" />
      <path d="M5 21h14M12 16v5" />
    </svg>
  );
}

function AccessRecordCard({ item, tab, selected, onSelect }) {
  const isWorkspace = tab === "workspaces";

  const title = item.name || item.email || "Sin nombre";
  const subtitle = isWorkspace ? item.owner?.email : item.email;

  const accessMode = item.access_policy?.mode || "inherit";

  return (
    <button
      type="button"
      className={["access-record-card", selected ? "is-selected" : ""]
        .filter(Boolean)
        .join(" ")}
      onClick={onSelect}
    >
      <div className="access-record-card__identity">
        <span className="access-record-card__avatar">{initials(title)}</span>

        <div>
          <small>
            {isWorkspace
              ? item.workspace_type === "company"
                ? "Workspace empresarial"
                : "Workspace individual"
              : "Cuenta de usuario"}
          </small>

          <strong>{title}</strong>
          <span>{subtitle || "Sin correo asociado"}</span>
        </div>
      </div>

      <div className="access-record-card__access">
        <span>Acceso configurado</span>
        <strong>{policyLabel(accessMode)}</strong>

        {isWorkspace && (
          <small>{item.subscription?.plan_name || "Sin plan"}</small>
        )}
      </div>

      <div className="access-record-card__usage">
        <span>{isWorkspace ? "Asientos" : "Workspaces"}</span>

        <strong>
          {isWorkspace
            ? `${item.seats?.used ?? 0} / ${item.seats?.limit ?? 0}`
            : (item.workspace_count ?? 0)}
        </strong>

        <small>
          {isWorkspace
            ? `${item.seats?.available ?? 0} disponibles`
            : "cuentas asociadas"}
        </small>
      </div>

      <div className="access-record-card__status">
        <Status value={item.status} />

        <span className="access-record-card__arrow">→</span>
      </div>
    </button>
  );
}

function AccessInspector({
  selected,
  tab,
  form,
  setForm,
  busy,
  onSave,
  onClose,
  onUpdateMember,
}) {
  const isWorkspace = tab === "workspaces";

  if (!selected) {
    return (
      <CatalogPreview
        className="access-inspector"
        eyebrow="Inspector administrativo"
        title="Control de acceso"
        subtitle="Selecciona un workspace o usuario para revisar su política."
        sticky
      >
        <section className="access-inspector-empty">
          <span>⌁</span>

          <div>
            <small>Sin selección</small>
            <h3>Selecciona un registro</h3>

            <p>
              Podrás inspeccionar políticas, suscripciones, límites y miembros
              sin abandonar la página.
            </p>
          </div>
        </section>

        <section className="access-inspector-guide">
          <header>
            <span>Acciones disponibles</span>
            <h3>Gestión centralizada</h3>
          </header>

          <ul>
            <li>
              <CheckIcon size={13} />
              Revisar acceso efectivo
            </li>

            <li>
              <CheckIcon size={13} />
              Crear excepciones administrativas
            </li>

            <li>
              <CheckIcon size={13} />
              Administrar miembros y asientos
            </li>
          </ul>
        </section>
      </CatalogPreview>
    );
  }

  return (
    <CatalogPreview
      className="access-inspector"
      eyebrow="Inspector de acceso"
      title={selected.name || selected.email}
      subtitle={
        selected.email || selected.owner?.email || "Sin correo asociado"
      }
      sticky
      onClose={onClose}
      closeLabel="Cerrar inspector"
      actions={<Status value={selected.status} />}
    >
      <section className="access-inspector-summary">
        <header>
          <div>
            <span>Registro seleccionado</span>
            <h3>Resumen administrativo</h3>
          </div>

          <span className="access-inspector-summary__avatar">
            {initials(selected.name || selected.email)}
          </span>
        </header>

        <dl>
          <div>
            <dt>Tipo</dt>
            <dd>
              {isWorkspace
                ? selected.workspace_type === "company"
                  ? "Empresa"
                  : "Individual"
                : "Usuario"}
            </dd>
          </div>

          <div>
            <dt>Acceso actual</dt>
            <dd>{policyLabel(selected.access_policy?.mode || "inherit")}</dd>
          </div>

          {isWorkspace && (
            <>
              <div>
                <dt>Plan</dt>
                <dd>{selected.subscription?.plan_name || "Sin plan"}</dd>
              </div>

              <div>
                <dt>Asientos</dt>
                <dd>
                  {selected.seats?.used ?? 0} / {selected.seats?.limit ?? 0}
                </dd>
              </div>
            </>
          )}
        </dl>
      </section>

      <section className="access-policy-editor">
        <header>
          <div>
            <span>Configuración</span>
            <h3>Política de acceso</h3>

            <p>
              Los cambios reemplazarán temporalmente la configuración heredada
              de la suscripción.
            </p>
          </div>

          <ShieldIcon />
        </header>

        <div className="access-policy-editor__fields">
          <label className="access-field">
            <span>Modo de acceso</span>

            <select
              value={form.access_mode}
              onChange={(event) =>
                setForm({
                  ...form,
                  access_mode: event.target.value,
                })
              }
            >
              <option value="inherit">Según suscripción</option>
              <option value="free">Acceso libre</option>
              <option value="blocked">Bloqueado</option>
            </select>

            <small>Define si hereda el plan o utiliza una excepción.</small>
          </label>

          <label className="access-field">
            <span>Estado</span>

            <select
              value={form.status}
              onChange={(event) =>
                setForm({
                  ...form,
                  status: event.target.value,
                })
              }
            >
              <option value="active">Activo</option>
              <option value="suspended">Suspendido</option>

              {isWorkspace && <option value="cancelled">Cancelado</option>}

              {!isWorkspace && <option value="deleted">Eliminado</option>}
            </select>

            <small>Estado operativo de la cuenta seleccionada.</small>
          </label>

          {isWorkspace && (
            <label className="access-field">
              <span>Límite manual de asientos</span>

              <input
                type="number"
                min="1"
                value={form.seat_limit_override}
                onChange={(event) =>
                  setForm({
                    ...form,
                    seat_limit_override: event.target.value,
                  })
                }
                placeholder="Usar límite del plan"
              />

              <small>Déjalo vacío para conservar el límite original.</small>
            </label>
          )}

          <label className="access-field">
            <span>Vencimiento</span>

            <input
              type="datetime-local"
              value={form.expires_at}
              onChange={(event) =>
                setForm({
                  ...form,
                  expires_at: event.target.value,
                })
              }
            />

            <small>La excepción se desactivará después de esta fecha.</small>
          </label>

          <label className="access-field access-field--wide">
            <span>Motivo administrativo</span>

            <textarea
              rows="4"
              value={form.reason}
              onChange={(event) =>
                setForm({
                  ...form,
                  reason: event.target.value,
                })
              }
              placeholder="Añade contexto para la auditoría"
            />

            <small>Este texto permite comprender el motivo del cambio.</small>
          </label>
        </div>

        <footer className="access-policy-editor__footer">
          <div>
            <span>Estado de edición</span>
            <strong>
              {form.reason
                ? "Política lista para guardar"
                : "Añade contexto antes de guardar"}
            </strong>
          </div>

          <button
            type="button"
            className="btn btn-primary access-policy-editor__save"
            disabled={busy}
            onClick={onSave}
          >
            {busy ? "Guardando…" : "Guardar política"}
          </button>
        </footer>
      </section>

      {isWorkspace && (
        <>
          <section className="access-inspector-metrics">
            <article>
              <span>Plan</span>
              <strong>{selected.subscription?.plan_name || "Sin plan"}</strong>
            </article>

            <article>
              <span>Suscripción</span>
              <strong>
                {selected.subscription?.status || "No disponible"}
              </strong>
            </article>

            <article>
              <span>Asientos</span>
              <strong>
                {selected.seats?.used ?? 0} / {selected.seats?.limit ?? 0}
              </strong>
            </article>

            <article>
              <span>Acceso efectivo</span>
              <strong>
                {selected.effective_access?.allowed ? "Permitido" : "Denegado"}
              </strong>
            </article>
          </section>

          <section className="access-members">
            <header>
              <div>
                <span>Equipo</span>
                <h3>Miembros del workspace</h3>
              </div>

              <strong>{selected.members?.length || 0}</strong>
            </header>

            <div className="access-members__list">
              {(selected.members || []).map((member) => (
                <article key={member.id}>
                  <span className="access-members__avatar">
                    {initials(member.name || member.email)}
                  </span>

                  <div className="access-members__identity">
                    <strong>{member.name || "Sin nombre"}</strong>
                    <small>{member.email}</small>
                  </div>

                  <select
                    value={member.role}
                    disabled={busy}
                    onChange={(event) =>
                      onUpdateMember(member, {
                        role: event.target.value,
                      })
                    }
                  >
                    <option value="owner">Owner</option>
                    <option value="admin">Admin</option>
                    <option value="editor">Editor</option>
                    <option value="viewer">Viewer</option>
                  </select>

                  <button
                    type="button"
                    disabled={busy}
                    className={
                      member.is_active
                        ? "access-members__action is-danger"
                        : "access-members__action is-success"
                    }
                    onClick={() =>
                      onUpdateMember(member, {
                        is_active: !member.is_active,
                      })
                    }
                  >
                    {member.is_active ? "Suspender" : "Activar"}
                  </button>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </CatalogPreview>
  );
}

export default function AccessControlPage() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("workspaces");
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [mode, setMode] = useState("all");
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(EMPTY_POLICY);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  async function load() {
    try {
      const me = await api("/auth/me/");
      if (!me.is_superuser && !me.platform_admin?.is_active)
        return router.replace("/dashboard");
      const response = await api("/admin/access-control/overview/");
      setData(response);
    } catch (error) {
      setNotice(error.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const rows = useMemo(() => {
    const source = data?.[tab] || [];
    return source.filter((item) => {
      const text =
        `${item.name} ${item.email || ""} ${item.owner?.email || ""}`.toLowerCase();
      const policy = item.access_policy?.mode || "inherit";
      return (
        text.includes(query.toLowerCase()) &&
        (tab !== "workspaces" ||
          type === "all" ||
          item.workspace_type === type) &&
        (mode === "all" || policy === mode)
      );
    });
  }, [data, tab, query, type, mode]);

  function inspect(item) {
    setSelected(item);
    setForm({
      access_mode: item.access_policy?.mode || "inherit",
      status: item.status,
      expires_at: dateInput(item.access_policy?.expires_at),
      reason: item.access_policy?.reason || "",
      seat_limit_override: item.access_policy?.seat_limit_override ?? "",
    });
  }

  async function savePolicy() {
    if (!selected) return;
    setBusy(true);
    setNotice("");
    const isWorkspace = tab === "workspaces";
    const payload = {
      status: form.status,
      access_mode: form.access_mode,
      expires_at: form.expires_at
        ? new Date(form.expires_at).toISOString()
        : null,
      reason: form.reason,
      ...(isWorkspace
        ? {
            seat_limit_override:
              form.seat_limit_override === ""
                ? null
                : Number(form.seat_limit_override),
          }
        : {}),
    };
    try {
      await api(
        `/admin/access-control/${isWorkspace ? "workspaces" : "users"}/${selected.id}/`,
        { method: "PATCH", body: JSON.stringify(payload) },
      );
      await load();
      setSelected(null);
      setNotice("La política se guardó correctamente.");
    } catch (error) {
      setNotice(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function updateMember(member, patch) {
    setBusy(true);
    setNotice("");
    try {
      const workspace = await api(
        `/admin/access-control/workspaces/${selected.id}/members/${member.id}/`,
        { method: "PATCH", body: JSON.stringify(patch) },
      );
      setSelected(workspace);
      setData((current) => ({
        ...current,
        workspaces: current.workspaces.map((item) =>
          item.id === workspace.id ? workspace : item,
        ),
      }));
    } catch (error) {
      setNotice(error.message);
    } finally {
      setBusy(false);
    }
  }

  const summary = data?.summary || {};

  const freeAccessCount = summary.free_user_overrides ?? 0;

  const blockedCount = summary.blocked_workspaces ?? 0;

  const seatUsage =
    summary.seats_limit > 0
      ? Math.round(((summary.seats_used || 0) / summary.seats_limit) * 100)
      : 0;

  return (
    <>
      <Nav privateNav />

      <main className="container ascend-view page page--settings page--access-control">
        <CatalogPageHeader
          className="access-page-header"
          eyebrow="Administración de plataforma"
          title="Acceso y licencias"
          description="Gestiona suscripciones, excepciones, estados y asientos desde una vista operacional centralizada."
          actions={
            <div className="access-page-header__status">
              <span>
                <ShieldIcon />
              </span>

              <div>
                <strong>Control administrativo</strong>
                <small>Políticas y licencias centralizadas</small>
              </div>
            </div>
          }
        />

        {notice && (
          <div className="notice access-page-notice" role="status">
            <CheckIcon size={16} />
            {notice}
          </div>
        )}

        <section className="access-metrics" aria-label="Resumen de acceso">
          <AccessMetric
            icon={<UsersIcon />}
            eyebrow="Usuarios"
            value={summary.users_total ?? "—"}
            description="registrados"
            tone="copper"
          />

          <AccessMetric
            icon={<CompanyIcon />}
            eyebrow="Empresas"
            value={summary.companies ?? "—"}
            description="workspaces corporativos"
            tone="sky"
          />

          <AccessMetric
            icon={<ShieldIcon />}
            eyebrow="Accesos libres"
            value={freeAccessCount}
            description="excepciones activas"
            tone="sage"
          />

          <AccessMetric
            icon={<XIcon size={18} />}
            eyebrow="Bloqueados"
            value={blockedCount}
            description="workspaces restringidos"
            tone="rose"
          />

          <AccessMetric
            icon={<SeatIcon />}
            eyebrow="Asientos"
            value={`${summary.seats_used ?? 0} / ${summary.seats_limit ?? 0}`}
            description={`${seatUsage}% utilizado`}
            tone="lavender"
          />
        </section>

        <section className="access-directory-header">
          <div>
            <span>Directorio administrativo</span>
            <h2>Registros y políticas</h2>

            <p>
              Busca, filtra y selecciona una cuenta para modificar su acceso sin
              perder el contexto.
            </p>
          </div>

          <nav className="access-directory-tabs" aria-label="Tipo de registro">
            <button
              type="button"
              className={tab === "workspaces" ? "is-active" : ""}
              onClick={() => {
                setTab("workspaces");
                setSelected(null);
              }}
            >
              Workspaces
              <span>{data?.workspaces?.length || 0}</span>
            </button>

            <button
              type="button"
              className={tab === "users" ? "is-active" : ""}
              onClick={() => {
                setTab("users");
                setSelected(null);
              }}
            >
              Usuarios
              <span>{data?.users?.length || 0}</span>
            </button>
          </nav>
        </section>

        <CatalogWorkspace hasPreview className="access-workspace">
          <section className="access-directory">
            <header className="access-directory__toolbar">
              <label className="access-search">
                <SearchIcon size={17} />

                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar nombre, correo o propietario…"
                  aria-label="Buscar registros"
                />

                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    aria-label="Limpiar búsqueda"
                  >
                    <XIcon size={14} />
                  </button>
                )}
              </label>

              <div className="access-directory__filters">
                {tab === "workspaces" && (
                  <label>
                    <span>Tipo</span>

                    <select
                      value={type}
                      onChange={(event) => setType(event.target.value)}
                    >
                      <option value="all">Todos los tipos</option>
                      <option value="individual">Individual</option>
                      <option value="company">Empresa</option>
                    </select>
                  </label>
                )}

                <label>
                  <span>Acceso</span>

                  <select
                    value={mode}
                    onChange={(event) => setMode(event.target.value)}
                  >
                    <option value="all">Todos los accesos</option>
                    <option value="inherit">Suscripción</option>
                    <option value="free">Libre</option>
                    <option value="blocked">Bloqueado</option>
                  </select>
                </label>
              </div>
            </header>

            <div className="access-directory__results">
              <header>
                <div>
                  <span>Resultados</span>

                  <h2>{tab === "workspaces" ? "Workspaces" : "Usuarios"}</h2>
                </div>

                <strong>
                  {rows.length} {rows.length === 1 ? "registro" : "registros"}
                </strong>
              </header>

              <div className="access-record-list">
                {rows.map((item) => (
                  <AccessRecordCard
                    key={item.id}
                    item={item}
                    tab={tab}
                    selected={selected?.id === item.id}
                    onSelect={() => inspect(item)}
                  />
                ))}
              </div>

              {!rows.length && (
                <section className="access-empty-state">
                  <span>
                    <SearchIcon size={23} />
                  </span>

                  <div>
                    <small>Sin resultados</small>
                    <h2>No encontramos registros</h2>

                    <p>
                      Modifica la búsqueda o elimina alguno de los filtros
                      seleccionados.
                    </p>

                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        setQuery("");
                        setType("all");
                        setMode("all");
                      }}
                    >
                      Limpiar filtros
                    </button>
                  </div>
                </section>
              )}
            </div>
          </section>

          <AccessInspector
            selected={selected}
            tab={tab}
            form={form}
            setForm={setForm}
            busy={busy}
            onSave={savePolicy}
            onClose={() => setSelected(null)}
            onUpdateMember={updateMember}
          />
        </CatalogWorkspace>
      </main>
    </>
  );
}
