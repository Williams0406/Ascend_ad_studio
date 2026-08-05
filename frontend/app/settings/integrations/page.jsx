"use client";

import { useEffect, useMemo, useState } from "react";

import Nav from "@/components/Nav";
import PageTitle from "@/components/PageTitle";

import {
  CheckIcon,
  MoreIcon,
  SearchIcon,
  SparkIcon,
  XIcon,
} from "@/components/catalog/CatalogIcons";

import {
  CatalogPageHeader,
  CatalogPreview,
  CatalogWorkspace,
} from "@/components/catalog/CatalogLayout";

import { api, ensureWorkspace } from "@/lib/api";

const PROVIDERS = [
  {
    code: "gemini",
    name: "Gemini",
    shortName: "G",
    description:
      "Generación y edición de imágenes con Google. Usa authorization keys nuevas de AI Studio.",
    recommendedModel: "Imagen 2.0 Flash",
    capability: "Imagen y edición",
    advice:
      "Ideal para imágenes publicitarias, edición visual y composiciones fotorrealistas.",
  },
  {
    code: "fal",
    name: "fal.ai",
    shortName: "fal",
    description:
      "Modelos de imágenes y video con claves API de alcance mínimo.",
    recommendedModel: "FLUX.1 Kontext",
    capability: "Imagen y video",
    advice:
      "Ideal para modelos especializados, video y flujos creativos de alto control.",
  },
];

function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 7v5h-5" />
      <path d="M4 17v-5h5" />
      <path d="M6.2 8.5A7 7 0 0 1 18.5 7L20 12" />
      <path d="M4 12l1.5 5A7 7 0 0 0 17.8 15.5" />
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

function KeyIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="8" cy="15" r="4" />
      <path d="m11 12 8-8M16 7l2 2M14 9l2 2" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="5" y="10" width="14" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function PlugIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 3v5M16 3v5M6 8h12v3a6 6 0 0 1-12 0V8ZM12 17v4" />
    </svg>
  );
}

function formatDate(value, includeTime = false) {
  if (!value) return "Sin verificar";

  try {
    return new Intl.DateTimeFormat("es-PE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      ...(includeTime
        ? {
            hour: "2-digit",
            minute: "2-digit",
          }
        : {}),
    }).format(new Date(value));
  } catch {
    return String(value);
  }
}

function relativeLabel(value) {
  if (!value) return "Pendiente";

  const date = new Date(value);
  const now = new Date();
  const difference = now.getTime() - date.getTime();
  const minutes = Math.max(0, Math.round(difference / 60000));

  if (minutes < 1) return "Ahora";
  if (minutes < 60) return `Hace ${minutes} min`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;

  const days = Math.round(hours / 24);
  if (days === 1) return "Ayer";

  return `Hace ${days} días`;
}

function providerInfo(code) {
  return PROVIDERS.find((provider) => provider.code === code);
}

function connectionDate(connection) {
  if (!connection) return null;

  return (
    connection.last_verified_at ||
    connection.last_tested_at ||
    connection.updated_at ||
    connection.created_at ||
    null
  );
}

function ProviderLogo({ provider }) {
  return (
    <div className={`avatar ${provider.code}`}>
      {provider.code === "gemini" ? (
        <span>G</span>
      ) : (
        <span>
          <small>✣</small>
          fal
        </span>
      )}
    </div>
  );
}

function ProviderStatus({ connected, isDefault, hasError = false }) {
  return (
    <div className="integration-provider-status">
      <span
        className={[
          "integration-provider-status__connection",
          connected ? "is-connected" : "is-disconnected",
          hasError ? "has-error" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <i aria-hidden="true" />

        {hasError
          ? "Requiere revisión"
          : connected
            ? "Conectado"
            : "Sin conectar"}
      </span>

      {isDefault && (
        <span className="integration-provider-status__default">
          Predeterminado
        </span>
      )}
    </div>
  );
}

function IntegrationMetric({
  icon,
  eyebrow,
  value,
  description,
  tone = "copper",
}) {
  return (
    <article className={`integration-metric integration-metric--${tone}`}>
      <div className="integration-metric__icon">{icon}</div>

      <div className="integration-metric__copy">
        <span>{eyebrow}</span>
        <strong>{value}</strong>
        <small>{description}</small>
      </div>
    </article>
  );
}

function IntegrationProviderCard({
  provider,
  connection,
  connected,
  isTesting,
  menuOpen,
  loading,
  onConnect,
  onTest,
  onToggleMenu,
  onReplace,
  onRevoke,
}) {
  const lastChecked = connectionDate(connection);
  const hasError = Boolean(connection?.last_error_message);

  return (
    <article
      className={[
        "integration-provider-card",
        connected ? "is-connected" : "is-available",
        hasError ? "has-error" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <header className="integration-provider-card__header">
        <div className="integration-provider-card__identity">
          <ProviderLogo provider={provider} />

          <div>
            <span>Proveedor de IA</span>
            <h2>{provider.name}</h2>

            <ProviderStatus
              connected={connected}
              isDefault={connection?.is_default}
              hasError={hasError}
            />
          </div>
        </div>

        {connected ? (
          <div className="integration-provider-card__actions">
            <button
              type="button"
              className="btn btn-secondary integration-provider-card__test"
              disabled={isTesting}
              onClick={() => onTest(connection)}
            >
              <RefreshIcon />

              {isTesting ? "Verificando…" : "Verificar"}
            </button>

            <div className="integration-provider-menu">
              <button
                type="button"
                className="integration-provider-menu__trigger"
                aria-label={`Acciones de ${provider.name}`}
                aria-expanded={menuOpen}
                onClick={onToggleMenu}
              >
                <MoreIcon size={18} />
              </button>

              {menuOpen && (
                <div className="integration-provider-menu__content">
                  <button type="button" onClick={onReplace}>
                    Reemplazar credencial
                  </button>

                  <button
                    type="button"
                    className="danger"
                    disabled={loading}
                    onClick={() => onRevoke(connection)}
                  >
                    Desconectar proveedor
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="btn btn-primary integration-provider-card__connect"
            onClick={onConnect}
            aria-label={`Conectar ${provider.name}`}
          >
            <span
              className="integration-provider-card__connect-icon"
              aria-hidden="true"
            >
              <PlugIcon />
            </span>

            <span className="integration-provider-card__connect-copy">
              <strong>Conectar</strong>
              <small>{provider.name}</small>
            </span>

            <span
              className="integration-provider-card__connect-arrow"
              aria-hidden="true"
            >
              →
            </span>
          </button>
        )}
      </header>

      <p className="integration-provider-card__description">
        {provider.description}
      </p>

      <section className="integration-provider-card__capability">
        <div>
          <span>Capacidad</span>
          <strong>{provider.capability}</strong>
        </div>

        <div>
          <span>Modelo recomendado</span>
          <strong>
            {connection?.model_name ||
              connection?.default_model ||
              provider.recommendedModel}
          </strong>
        </div>
      </section>

      {connected ? (
        <>
          <dl className="integration-provider-card__details">
            <div>
              <dt>Última verificación</dt>
              <dd>{lastChecked ? relativeLabel(lastChecked) : "Pendiente"}</dd>
            </div>

            <div>
              <dt>Uso en proyectos</dt>
              <dd>
                {connection.projects_count ?? connection.usage_count ?? "—"}
              </dd>
            </div>

            <div>
              <dt>Credencial segura</dt>
              <dd>•••• {connection.api_key_last_four || "••••"}</dd>
            </div>

            <div>
              <dt>Conectado</dt>
              <dd>
                {connection.created_at
                  ? formatDate(connection.created_at)
                  : "Sin fecha"}
              </dd>
            </div>
          </dl>

          <div
            className={[
              "integration-provider-card__validation",
              hasError ? "has-error" : "is-valid",
            ].join(" ")}
          >
            <span>{hasError ? "!" : <CheckIcon size={16} />}</span>

            <div>
              <strong>
                {hasError
                  ? "La última validación reportó un problema"
                  : "Conexión validada correctamente"}
              </strong>

              <p>
                {connection.last_error_message ||
                  (connection.response_time_ms
                    ? `Respuesta del proveedor: ${connection.response_time_ms} ms`
                    : "La credencial está disponible para el workspace.")}
              </p>
            </div>
          </div>
        </>
      ) : (
        <footer className="integration-provider-card__available">
          <span>
            <SparkIcon size={15} />
            Recomendación Ascend
          </span>

          <p>{provider.advice}</p>
        </footer>
      )}
    </article>
  );
}

function IntegrationsInspector({
  connectedConnections,
  defaultConnection,
  lastVerification,
  recentActivity,
}) {
  return (
    <CatalogPreview
      className="integrations-inspector"
      eyebrow="Estado del sistema"
      title="Seguridad y actividad"
      subtitle="Supervisa las credenciales vinculadas al workspace."
      sticky
      actions={
        <span
          className={[
            "integrations-inspector__health",
            connectedConnections.length ? "is-ready" : "is-pending",
          ].join(" ")}
        >
          <i aria-hidden="true" />

          {connectedConnections.length ? "Protegido" : "Pendiente"}
        </span>
      }
    >
      <section className="integrations-inspector__summary">
        <header>
          <span>Workspace activo</span>
          <h3>Estado de las conexiones</h3>
        </header>

        <div className="integrations-inspector__summary-grid">
          <article>
            <span>Conectadas</span>
            <strong>{connectedConnections.length}</strong>
          </article>

          <article>
            <span>Principal</span>
            <strong>
              {defaultConnection
                ? providerInfo(defaultConnection.provider)?.name
                : "—"}
            </strong>
          </article>

          <article>
            <span>Verificación</span>
            <strong>
              {lastVerification ? relativeLabel(lastVerification) : "Pendiente"}
            </strong>
          </article>
        </div>
      </section>

      <section className="integrations-inspector__security">
        <header>
          <div>
            <span>Protección</span>
            <h3>Seguridad de credenciales</h3>
          </div>

          <LockIcon />
        </header>

        <div className="integrations-inspector__security-list">
          <article>
            <i>
              <ShieldIcon />
            </i>

            <div>
              <strong>Cifrado en reposo</strong>
              <p>
                Las claves se almacenan protegidas y no vuelven a mostrarse
                completas.
              </p>
            </div>
          </article>

          <article>
            <i>
              <LockIcon />
            </i>

            <div>
              <strong>Alcance por workspace</strong>
              <p>
                Cada credencial pertenece únicamente al espacio de trabajo
                activo.
              </p>
            </div>
          </article>

          <article>
            <i>
              <KeyIcon />
            </i>

            <div>
              <strong>Control inmediato</strong>
              <p>
                Puedes verificar, reemplazar o revocar una clave en cualquier
                momento.
              </p>
            </div>
          </article>
        </div>
      </section>

      <section className="integrations-inspector__activity">
        <header>
          <div>
            <span>Registro reciente</span>
            <h3>Actividad de proveedores</h3>
          </div>

          <strong>{recentActivity.length}</strong>
        </header>

        {recentActivity.length ? (
          <div className="integrations-inspector__activity-list">
            {recentActivity.map((connection) => {
              const provider =
                providerInfo(connection.provider) || PROVIDERS[0];

              return (
                <article key={connection.id}>
                  <ProviderLogo provider={provider} />

                  <div>
                    <strong>{provider.name}</strong>
                    <span>
                      {connection.last_error_message
                        ? "Validación con observaciones"
                        : "Conexión verificada"}
                    </span>
                  </div>

                  <time>{relativeLabel(connectionDate(connection))}</time>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="integrations-inspector__empty">
            <span>⌁</span>

            <div>
              <strong>Sin actividad reciente</strong>
              <p>Las verificaciones aparecerán en este espacio.</p>
            </div>
          </div>
        )}
      </section>

      <section className="integrations-best-practices">
        <header className="integrations-best-practices__header">
          <span className="integrations-best-practices__icon">
            <ShieldIcon />
          </span>

          <div>
            <span>Recomendación de seguridad</span>
            <h3>Buenas prácticas</h3>
          </div>
        </header>

        <p className="integrations-best-practices__description">
          Protege tus proveedores utilizando credenciales limitadas,
          independientes y fáciles de revocar.
        </p>

        <ul className="integrations-best-practices__list">
          <li>
            <i aria-hidden="true">
              <CheckIcon size={12} />
            </i>

            <span>Utiliza claves con el menor alcance posible.</span>
          </li>

          <li>
            <i aria-hidden="true">
              <CheckIcon size={12} />
            </i>

            <span>No reutilices una misma clave en varios entornos.</span>
          </li>

          <li>
            <i aria-hidden="true">
              <CheckIcon size={12} />
            </i>

            <span>Reemplaza periódicamente las credenciales activas.</span>
          </li>
        </ul>

        <footer className="integrations-best-practices__footer">
          <LockIcon />

          <span>
            Las claves se almacenan cifradas y vinculadas al workspace.
          </span>
        </footer>
      </section>
    </CatalogPreview>
  );
}

export default function IntegrationsPage() {
  const [connections, setConnections] = useState([]);
  const [selected, setSelected] = useState(null);
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [testingId, setTestingId] = useState(null);
  const [menuId, setMenuId] = useState(null);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    await ensureWorkspace();
    const data = await api("/integrations/providers/");
    setConnections(data.results || data);
  }

  useEffect(() => {
    load().catch((requestError) => setError(requestError.message));
  }, []);

  const connectionByProvider = useMemo(
    () =>
      new Map(
        connections.map((connection) => [connection.provider, connection]),
      ),
    [connections],
  );

  const visibleProviders = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("es");

    if (!normalized) return PROVIDERS;

    return PROVIDERS.filter((provider) =>
      [
        provider.name,
        provider.code,
        provider.description,
        provider.recommendedModel,
        provider.capability,
      ].some((value) =>
        String(value).toLocaleLowerCase("es").includes(normalized),
      ),
    );
  }, [query]);

  const connectedConnections = useMemo(
    () => connections.filter((connection) => connection.status !== "revoked"),
    [connections],
  );

  const defaultConnection = connectedConnections.find(
    (connection) => connection.is_default,
  );

  const lastVerification = useMemo(() => {
    const values = connectedConnections
      .map(connectionDate)
      .filter(Boolean)
      .map((value) => new Date(value))
      .filter((value) => !Number.isNaN(value.getTime()));

    if (!values.length) return null;

    return new Date(Math.max(...values.map((value) => value.getTime())));
  }, [connectedConnections]);

  const recentActivity = useMemo(
    () =>
      [...connectedConnections]
        .sort(
          (a, b) =>
            new Date(connectionDate(b) || 0) - new Date(connectionDate(a) || 0),
        )
        .slice(0, 5),
    [connectedConnections],
  );

  function openConnection(providerCode) {
    setSelected(providerCode);
    setApiKey("");
    setMenuId(null);
    setError("");
  }

  function closeConnection() {
    setSelected(null);
    setApiKey("");
  }

  async function connect(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      await api("/integrations/providers/connect/", {
        method: "POST",
        body: JSON.stringify({
          provider: selected,
          api_key: apiKey,
          is_default: true,
        }),
      });

      setMessage("Proveedor conectado correctamente.");
      closeConnection();
      await load();
    } catch (requestError) {
      setError(requestError.message || "No se pudo validar la API key.");
    } finally {
      setLoading(false);
    }
  }

  async function testConnection(connection) {
    setTestingId(connection.id);
    setMessage("");
    setError("");
    setMenuId(null);

    try {
      const result = await api(
        `/integrations/providers/${connection.id}/test/`,
        {
          method: "POST",
        },
      );

      if (result.valid) {
        setMessage(
          `${providerInfo(connection.provider)?.name || "Proveedor"} validado correctamente.`,
        );
      } else {
        setError(result.error || "La conexión no pudo validarse.");
      }

      await load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setTestingId(null);
    }
  }

  async function revoke(connection) {
    const providerName =
      providerInfo(connection.provider)?.name || "este proveedor";

    if (
      !window.confirm(
        `¿Desconectar ${providerName}? Los proyectos dejarán de poder usar esta credencial.`,
      )
    ) {
      return;
    }

    setLoading(true);
    setMessage("");
    setError("");
    setMenuId(null);

    try {
      await api(`/integrations/providers/${connection.id}/`, {
        method: "DELETE",
      });

      setMessage(`${providerName} fue desconectado.`);
      await load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  const selectedProvider = providerInfo(selected);

  return (
    <>
      <Nav privateNav />

      <main className="container ascend-view page page--settings page--integrations">
        {message && (
          <div
            className="notice success integrations-page-message"
            role="status"
          >
            <CheckIcon size={17} />
            {message}
          </div>
        )}

        {error && (
          <div className="notice error integrations-page-message" role="alert">
            <span>!</span>
            {error}
          </div>
        )}

        <CatalogPageHeader
          className="integrations-page-header"
          eyebrow="Inteligencia conectada"
          title="Integraciones de IA"
          description="Conecta proveedores de inteligencia artificial mediante credenciales privadas y administra su disponibilidad dentro del workspace."
          actions={
            <div className="integrations-page-header__status">
              <span>
                <ShieldIcon />
              </span>

              <div>
                <strong>Credenciales protegidas</strong>
                <small>Alcance limitado al workspace</small>
              </div>
            </div>
          }
        />

        <section
          className="integrations-metrics"
          aria-label="Resumen de integraciones"
        >
          <IntegrationMetric
            icon={<PlugIcon />}
            eyebrow="Proveedores"
            value={connectedConnections.length}
            description="conexiones activas"
            tone="copper"
          />

          <IntegrationMetric
            icon={<ShieldIcon />}
            eyebrow="Predeterminado"
            value={
              defaultConnection
                ? providerInfo(defaultConnection.provider)?.name
                : "—"
            }
            description="proveedor principal"
            tone="sage"
          />

          <IntegrationMetric
            icon={<RefreshIcon />}
            eyebrow="Verificación"
            value={
              lastVerification ? relativeLabel(lastVerification) : "Pendiente"
            }
            description="último control"
            tone="sky"
          />

          <IntegrationMetric
            icon={<KeyIcon />}
            eyebrow="Credenciales"
            value={connectedConnections.length}
            description="claves protegidas"
            tone="lavender"
          />
        </section>

        <section className="integrations-toolbar">
          <div className="integrations-toolbar__copy">
            <span>Directorio de proveedores</span>
            <h2>Conexiones disponibles</h2>

            <p>
              Configura los motores que Ascend puede utilizar para generar,
              editar y procesar contenido.
            </p>
          </div>

          <label className="integrations-search">
            <SearchIcon size={18} />

            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar proveedor, modelo o capacidad…"
              aria-label="Buscar proveedores"
            />

            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Limpiar búsqueda"
              >
                <XIcon size={15} />
              </button>
            )}
          </label>
        </section>

        <CatalogWorkspace hasPreview className="integrations-workspace">
          <div className="integrations-directory">
            <header className="integrations-directory__header">
              <div>
                <span>Catálogo activo</span>
                <h2>Proveedores de inteligencia artificial</h2>
              </div>

              <strong>
                {visibleProviders.length}{" "}
                {visibleProviders.length === 1 ? "proveedor" : "proveedores"}
              </strong>
            </header>

            <div className="integrations-provider-grid">
              {visibleProviders.map((provider) => {
                const connection = connectionByProvider.get(provider.code);

                const connected = Boolean(
                  connection && connection.status !== "revoked",
                );

                return (
                  <IntegrationProviderCard
                    key={provider.code}
                    provider={provider}
                    connection={connection}
                    connected={connected}
                    isTesting={testingId === connection?.id}
                    menuOpen={menuId === connection?.id}
                    loading={loading}
                    onConnect={() => openConnection(provider.code)}
                    onTest={testConnection}
                    onToggleMenu={() =>
                      setMenuId(
                        menuId === connection?.id ? null : connection?.id,
                      )
                    }
                    onReplace={() => openConnection(provider.code)}
                    onRevoke={revoke}
                  />
                );
              })}
            </div>

            {!visibleProviders.length && (
              <section className="integrations-empty">
                <span>
                  <SearchIcon size={23} />
                </span>

                <div>
                  <small>Sin resultados</small>
                  <h2>No encontramos proveedores</h2>

                  <p>Prueba otro nombre, capacidad o modelo.</p>

                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setQuery("")}
                  >
                    Limpiar búsqueda
                  </button>
                </div>
              </section>
            )}

            <section className="integrations-request-card">
              <div className="integrations-request-card__icon">＋</div>

              <div>
                <span>Próximamente</span>
                <h3>Amplía tu ecosistema creativo</h3>

                <p>
                  Nuevos proveedores podrán añadirse a este directorio sin
                  modificar el flujo de tus proyectos.
                </p>
              </div>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => openConnection("gemini")}
              >
                Configurar proveedor
              </button>
            </section>
          </div>

          <IntegrationsInspector
            connectedConnections={connectedConnections}
            defaultConnection={defaultConnection}
            lastVerification={lastVerification}
            recentActivity={recentActivity}
          />
        </CatalogWorkspace>

        {selectedProvider && (
          <div
            className="modal-backdrop integrations-modal-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                closeConnection();
              }
            }}
          >
            <section
              className="modal integrations-connect-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="connect-provider-title"
            >
              <button
                type="button"
                className="integrations-connect-modal__close"
                onClick={closeConnection}
                aria-label="Cerrar"
              >
                <XIcon size={18} />
              </button>

              <header className="integrations-connect-modal__header">
                <ProviderLogo provider={selectedProvider} />

                <div>
                  <span>Conexión segura</span>

                  <h2 id="connect-provider-title">
                    Conectar {selectedProvider.name}
                  </h2>

                  <p>
                    Valida una credencial privada y actívala solamente para este
                    workspace.
                  </p>
                </div>
              </header>

              <form
                className="integrations-connect-modal__form"
                onSubmit={connect}
              >
                <label className="integrations-connect-modal__field">
                  <span>API key</span>

                  <div className="integrations-connect-modal__input">
                    <KeyIcon />

                    <input
                      type="password"
                      value={apiKey}
                      onChange={(event) => setApiKey(event.target.value)}
                      autoComplete="new-password"
                      placeholder="Pega la clave privada del proveedor"
                      required
                      autoFocus
                    />
                  </div>

                  <small>
                    Ascend no volverá a mostrar el valor completo después de
                    guardarlo.
                  </small>
                </label>

                <div className="integrations-connect-modal__security">
                  <LockIcon />

                  <div>
                    <strong>Cifrada antes de almacenarse</strong>

                    <p>
                      La credencial viaja directamente al backend y queda
                      vinculada al workspace activo.
                    </p>
                  </div>
                </div>

                <section className="integrations-connect-modal__provider">
                  <article>
                    <span>Proveedor</span>
                    <strong>{selectedProvider.name}</strong>
                  </article>

                  <article>
                    <span>Capacidad</span>
                    <strong>{selectedProvider.capability}</strong>
                  </article>

                  <article>
                    <span>Modelo sugerido</span>
                    <strong>{selectedProvider.recommendedModel}</strong>
                  </article>
                </section>

                <footer className="integrations-connect-modal__footer">
                  <div>
                    <span>Estado</span>
                    <strong>
                      {apiKey.trim()
                        ? "Credencial lista para validar"
                        : "Introduce una credencial"}
                    </strong>
                  </div>

                  <div>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={closeConnection}
                    >
                      Cancelar
                    </button>

                    <button
                      className="btn btn-primary"
                      disabled={loading || !apiKey.trim()}
                    >
                      {loading ? "Validando conexión…" : "Validar y conectar"}
                    </button>
                  </div>
                </footer>
              </form>
            </section>
          </div>
        )}
      </main>
    </>
  );
}
