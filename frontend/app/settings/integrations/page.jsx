'use client';

import { useEffect, useMemo, useState } from 'react';

import Nav from '@/components/Nav';
import PageTitle from '@/components/PageTitle';
import { api, ensureWorkspace } from '@/lib/api';

const PROVIDERS = [
  {
    code: 'gemini',
    name: 'Gemini',
    shortName: 'G',
    description:
      'Generación y edición de imágenes con Google. Usa authorization keys nuevas de AI Studio.',
    recommendedModel: 'Imagen 2.0 Flash',
    capability: 'Imagen y edición',
    advice:
      'Ideal para imágenes publicitarias, edición visual y composiciones fotorrealistas.',
  },
  {
    code: 'fal',
    name: 'fal.ai',
    shortName: 'fal',
    description:
      'Modelos de imágenes y video con claves API de alcance mínimo.',
    recommendedModel: 'FLUX.1 Kontext',
    capability: 'Imagen y video',
    advice:
      'Ideal para modelos especializados, video y flujos creativos de alto control.',
  },
];

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="6.8" />
      <path d="m16.2 16.2 4 4" />
    </svg>
  );
}

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

function MoreIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 2.5 2.5L16 9" />
    </svg>
  );
}

function formatDate(value, includeTime = false) {
  if (!value) return 'Sin verificar';

  try {
    return new Intl.DateTimeFormat('es-PE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      ...(includeTime
        ? {
            hour: '2-digit',
            minute: '2-digit',
          }
        : {}),
    }).format(new Date(value));
  } catch {
    return String(value);
  }
}

function relativeLabel(value) {
  if (!value) return 'Pendiente';

  const date = new Date(value);
  const now = new Date();
  const difference = now.getTime() - date.getTime();
  const minutes = Math.max(0, Math.round(difference / 60000));

  if (minutes < 1) return 'Ahora';
  if (minutes < 60) return `Hace ${minutes} min`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;

  const days = Math.round(hours / 24);
  if (days === 1) return 'Ayer';

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
      {provider.code === 'gemini' ? (
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

function ProviderStatus({ connected, isDefault }) {
  return (
    <div className="badges">
      <span className={connected ? 'connected' : 'disconnected'}>
        {connected ? 'Conectado' : 'Sin conectar'}
      </span>

      {isDefault && <span className="default">Predeterminado</span>}
    </div>
  );
}

export default function IntegrationsPage() {
  const [connections, setConnections] = useState([]);
  const [selected, setSelected] = useState(null);
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [testingId, setTestingId] = useState(null);
  const [menuId, setMenuId] = useState(null);
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function load() {
    await ensureWorkspace();
    const data = await api('/integrations/providers/');
    setConnections(data.results || data);
  }

  useEffect(() => {
    load().catch((requestError) => setError(requestError.message));
  }, []);

  const connectionByProvider = useMemo(
    () =>
      new Map(
        connections.map((connection) => [
          connection.provider,
          connection,
        ]),
      ),
    [connections],
  );

  const visibleProviders = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('es');

    if (!normalized) return PROVIDERS;

    return PROVIDERS.filter((provider) =>
      [
        provider.name,
        provider.code,
        provider.description,
        provider.recommendedModel,
        provider.capability,
      ].some((value) =>
        String(value).toLocaleLowerCase('es').includes(normalized),
      ),
    );
  }, [query]);

  const connectedConnections = useMemo(
    () =>
      connections.filter(
        (connection) => connection.status !== 'revoked',
      ),
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

    return new Date(
      Math.max(...values.map((value) => value.getTime())),
    );
  }, [connectedConnections]);

  const recentActivity = useMemo(
    () =>
      [...connectedConnections]
        .sort(
          (a, b) =>
            new Date(connectionDate(b) || 0) -
            new Date(connectionDate(a) || 0),
        )
        .slice(0, 5),
    [connectedConnections],
  );

  function openConnection(providerCode) {
    setSelected(providerCode);
    setApiKey('');
    setMenuId(null);
    setError('');
  }

  function closeConnection() {
    setSelected(null);
    setApiKey('');
  }

  async function connect(event) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    try {
      await api('/integrations/providers/connect/', {
        method: 'POST',
        body: JSON.stringify({
          provider: selected,
          api_key: apiKey,
          is_default: true,
        }),
      });

      setMessage('Proveedor conectado correctamente.');
      closeConnection();
      await load();
    } catch (requestError) {
      setError(
        requestError.message || 'No se pudo validar la API key.',
      );
    } finally {
      setLoading(false);
    }
  }

  async function testConnection(connection) {
    setTestingId(connection.id);
    setMessage('');
    setError('');
    setMenuId(null);

    try {
      const result = await api(
        `/integrations/providers/${connection.id}/test/`,
        {
          method: 'POST',
        },
      );

      if (result.valid) {
        setMessage(
          `${providerInfo(connection.provider)?.name || 'Proveedor'} validado correctamente.`,
        );
      } else {
        setError(result.error || 'La conexión no pudo validarse.');
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
      providerInfo(connection.provider)?.name || 'este proveedor';

    if (
      !window.confirm(
        `¿Desconectar ${providerName}? Los proyectos dejarán de poder usar esta credencial.`,
      )
    ) {
      return;
    }

    setLoading(true);
    setMessage('');
    setError('');
    setMenuId(null);

    try {
      await api(`/integrations/providers/${connection.id}/`, {
        method: 'DELETE',
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

      <main className="container ascend-view page page--settings">
        {message && (
          <div className="notice success" role="status">
            {message}
          </div>
        )}

        {error && (
          <div className="notice error" role="alert">
            {error}
          </div>
        )}

        <PageTitle
          className="page-header"
          eyebrow="Inteligencia conectada"
          title="Integraciones de IA"
          description="Conecta proveedores de inteligencia artificial con claves cifradas por workspace. Ascend nunca devuelve tus credenciales al navegador."
          meta={(
            <span className="badge">
              Seguro
            </span>
          )}
          actions={(
            <div className="actions">
            <label className="search">
              <SearchIcon />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar proveedor…"
              />
            </label>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() =>
                document
                  .querySelector('.catalog-section')
                  ?.scrollIntoView({ behavior: 'smooth' })
              }
            >
              ☷ Búsqueda avanzada
            </button>

            <button
              type="button"
              className="btn btn-primary"
              onClick={() => openConnection('gemini')}
            >
              <span>＋</span>
              Conectar proveedor
            </button>
            </div>
          )}
        />

        <section
          className="grid metrics-grid"
          aria-label="Resumen de integraciones"
        >
          <article>
            <i>
              <PlugIcon />
            </i>
            <div>
              <strong>{connectedConnections.length}</strong>
              <span>Proveedores conectados</span>
            </div>
          </article>

          <article>
            <i>
              <ShieldIcon />
            </i>
            <div>
              <strong>{defaultConnection ? 1 : 0}</strong>
              <span>Proveedor predeterminado</span>
            </div>
          </article>

          <article>
            <i>
              <RefreshIcon />
            </i>
            <div>
              <small>Última verificación</small>
              <strong>
                {lastVerification
                  ? relativeLabel(lastVerification)
                  : 'Pendiente'}
              </strong>
            </div>
          </article>

          <article>
            <i>
              <KeyIcon />
            </i>
            <div>
              <small>Claves encriptadas</small>
              <strong>{connectedConnections.length}</strong>
            </div>
          </article>

          <article>
            <i>◷</i>
            <div>
              <small>Actualizado</small>
              <strong>
                {lastVerification
                  ? formatDate(lastVerification, true)
                  : 'Sin actividad'}
              </strong>
            </div>
          </article>
        </section>

        <section className="split-layout">
          <div className="panel">
            <div className="catalog-section">
              {visibleProviders.map((provider) => {
                const connection = connectionByProvider.get(
                  provider.code,
                );
                const connected = Boolean(
                    connection && connection.status !== 'revoked',
                );
                const lastChecked = connectionDate(connection);
                const isTesting = testingId === connection?.id;

                return (
                  <article
                    className={`list-card ${ connected ? 'connected' : 'available' }`}
                    key={provider.code}
                  >
                    <div className="list-card-main">
                      <ProviderLogo provider={provider} />

                      <div className="list-card-body">
                        <header>
                          <div>
                            <h2>{provider.name}</h2>
                            <ProviderStatus
                              connected={connected}
                              isDefault={connection?.is_default}
                            />
                          </div>

                          {connected && (
                            <div className="inspector-actions">
                              <button
                                type="button"
                                className="btn btn-secondary"
                                disabled={isTesting}
                                onClick={() =>
                                  testConnection(connection)
                                }
                              >
                                <RefreshIcon />
                                {isTesting
                                  ? 'Verificando…'
                                  : 'Verificar conexión'}
                              </button>

                              <div className="toolbar">
                                <button
                                  type="button"
                                  aria-label={`Acciones de ${provider.name}`}
                                  onClick={() =>
                                    setMenuId(
                                      menuId === connection.id
                                        ? null
                                        : connection.id,
                                    )
                                  }
                                >
                                  <MoreIcon />
                                </button>

                                {menuId === connection.id && (
                                  <div>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        openConnection(provider.code)
                                      }
                                    >
                                      Reemplazar credencial
                                    </button>

                                    <button
                                      type="button"
                                      className="danger"
                                      disabled={loading}
                                      onClick={() => revoke(connection)}
                                    >
                                      Desconectar
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </header>

                        <p>{provider.description}</p>

                        {connected ? (
                          <>
                            <div className="kv">
                              <div>
                                <span>Modelo sugerido</span>
                                <strong>
                                  {connection.model_name ||
                                    connection.default_model ||
                                    provider.recommendedModel}
                                </strong>
                              </div>

                              <div>
                                <span>Estado</span>
                                <strong className="active">
                                  Activa
                                </strong>
                              </div>

                              <div>
                                <span>Última verificación</span>
                                <strong>
                                  {lastChecked
                                    ? relativeLabel(lastChecked)
                                    : 'Pendiente'}
                                </strong>
                              </div>

                              <div>
                                <span>Uso en proyectos</span>
                                <strong>
                                  {connection.projects_count ??
                                    connection.usage_count ??
                                    '—'}
                                </strong>
                              </div>

                              <div>
                                <span>Credencial segura</span>
                                <strong>
                                  ••••{' '}
                                  {connection.api_key_last_four ||
                                    '••••'}
                                </strong>
                              </div>
                            </div>

                            <div
                              className={`notice ${ connection.last_error_message ? 'error' : 'success' }`}
                            >
                              <CheckIcon />

                              <div>
                                <strong>
                                  {connection.last_error_message
                                    ? 'La última validación reportó un problema.'
                                    : 'Conexión validada correctamente.'}
                                </strong>

                                <span>
                                  {connection.last_error_message ||
                                    (connection.response_time_ms
                                      ? `Responde en ${connection.response_time_ms} ms`
                                      : 'La credencial está disponible para el workspace.')}
                                </span>
                              </div>

                              <small>
                                {connection.created_at
                                  ? `Conectado el ${formatDate(
                                      connection.created_at,
                                      true,
                                    )}`
                                  : 'Credencial cifrada'}
                              </small>
                            </div>
                          </>
                        ) : (
                          <div className="list-card">
                            <div>
                              <span>{provider.capability}</span>
                              <strong>{provider.recommendedModel}</strong>
                            </div>

                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={() =>
                                openConnection(provider.code)
                              }
                            >
                              Conectar proveedor
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}

              {!visibleProviders.length && (
                <div className="empty-state">
                  <span>IA Provider</span>
                  <h2>No encontramos proveedores</h2>
                  <p>
                    Prueba otro término de búsqueda para localizar la
                    integración que necesitas.
                  </p>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setQuery('')}
                  >
                    Limpiar búsqueda
                  </button>
                </div>
              )}

              <article className="btn btn-secondary">
                <div>＋</div>

                <section>
                  <h2>Agregar nuevo proveedor</h2>
                  <p>
                    Conecta más modelos y amplía las capacidades de
                    generación de Ascend.
                  </p>
                </section>

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => openConnection('gemini')}
                >
                  Conectar proveedor
                </button>
              </article>
            </div>

            <aside className="panel">
              <span>
                <ShieldIcon />
              </span>

              <p>
                <strong>Mantén tus credenciales seguras</strong>
                Comparte tus API keys solo con personas de confianza y
                evita almacenarlas fuera de Ascend.
              </p>

              <button type="button">Saber más ↗</button>
            </aside>
          </div>

          <aside className="inspector">
            <section className="panel">
              <header>
                <h2>Información de seguridad</h2>
                <span className="safe">
                  <LockIcon />
                </span>
              </header>

              <div className="list-card">
                <ShieldIcon />
                <p>
                  <strong>Tus claves se almacenan cifradas</strong>
                  AES-256 en reposo y TLS durante la transmisión.
                </p>
              </div>

              <div className="list-card">
                <LockIcon />
                <p>
                  <strong>Alcance por workspace</strong>
                  Cada conexión pertenece únicamente a tu espacio
                  activo.
                </p>
              </div>

              <div className="list-card">
                <KeyIcon />
                <p>
                  <strong>Revocación inmediata</strong>
                  Puedes desconectar o reemplazar una credencial cuando
                  lo necesites.
                </p>
              </div>
            </section>

            <section className="panel">
              <header>
                <h2>Consejos Ascend</h2>
                <span className="advice">✦</span>
              </header>

              <ul className="stack">
                {PROVIDERS.map((provider) => (
                  <li key={provider.code}>
                    {provider.advice}
                  </li>
                ))}

                <li>
                  Establece un proveedor predeterminado para acelerar
                  tus nuevas generaciones.
                </li>
              </ul>
            </section>

            <section className="panel">
              <header>
                <h2>Actividad reciente</h2>
                <button type="button">Ver todo</button>
              </header>

              <div className="panel">
                {recentActivity.map((connection) => {
                  const provider =
                    providerInfo(connection.provider) || PROVIDERS[0];

                  return (
                    <article key={connection.id}>
                      <ProviderLogo provider={provider} />

                      <p>
                        <strong>{provider.name}</strong>
                        {connection.last_error_message
                          ? 'Validación con observaciones'
                          : 'Conexión verificada'}
                      </p>

                      <time>
                        {relativeLabel(connectionDate(connection))}
                      </time>
                    </article>
                  );
                })}

                {!recentActivity.length && (
                  <div className="empty-state">
                    Todavía no hay actividad de proveedores.
                  </div>
                )}
              </div>
            </section>
          </aside>
        </section>

        {selectedProvider && (
          <div
            className="modal-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                closeConnection();
              }
            }}
          >
            <section
              className="modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="connect-provider-title"
            >
              <button
                type="button"
                className="btn btn-secondary btn-icon"
                onClick={closeConnection}
                aria-label="Cerrar"
              >
                ×
              </button>

              <header>
                <ProviderLogo provider={selectedProvider} />

                <div>
                  <span>Conexión segura</span>
                  <h2 id="connect-provider-title">
                    Conectar {selectedProvider.name}
                  </h2>
                  <p>
                    Valida una credencial privada y actívala únicamente
                    para este workspace.
                  </p>
                </div>
              </header>

              <form onSubmit={connect}>
                <label className="field">
                  <span>API key</span>

                  <input
                    className="input"
                    type="password"
                    value={apiKey}
                    onChange={(event) =>
                      setApiKey(event.target.value)
                    }
                    autoComplete="new-password"
                    placeholder="Pega aquí la clave del proveedor"
                    required
                    autoFocus
                  />

                  <small>
                    Ascend no volverá a mostrar el valor completo después
                    de guardarlo.
                  </small>
                </label>

                <div className="notice info">
                  <LockIcon />

                  <p>
                    <strong>Cifrada antes de almacenarse</strong>
                    La credencial viaja directamente al backend y queda
                    asociada al workspace activo.
                  </p>
                </div>

                <section className="spec">
                  <div>
                    <span>Proveedor</span>
                    <strong>{selectedProvider.name}</strong>
                  </div>

                  <div>
                    <span>Capacidad</span>
                    <strong>{selectedProvider.capability}</strong>
                  </div>

                  <div>
                    <span>Modelo sugerido</span>
                    <strong>
                      {selectedProvider.recommendedModel}
                    </strong>
                  </div>
                </section>

                <footer>
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
                    {loading
                      ? 'Validando conexión…'
                      : 'Validar y conectar'}
                  </button>
                </footer>
              </form>
            </section>
          </div>
        )}
      </main>
    </>
  );
}
