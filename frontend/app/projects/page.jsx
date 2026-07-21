'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

import Nav from '@/components/Nav';
import { api, ensureWorkspace } from '@/lib/api';

const STATUS_LABELS = {
  draft: 'Borrador',
  ready: 'Listo',
  generating: 'Generando',
  completed: 'Completado',
  archived: 'Archivado',
  cancelled: 'Cancelado',
};

const STATUS_FILTERS = [
  ['all', 'Todos'],
  ['draft', 'Borradores'],
  ['generating', 'Generando'],
  ['completed', 'Completados'],
  ['archived', 'Archivados'],
];

const CONTENT_LABELS = {
  flyer: 'Flyer',
  social_post: 'Post social',
  story: 'Story',
  banner: 'Banner',
  carousel: 'Carrusel',
  short_video: 'Video corto',
  product_video: 'Video de producto',
};

function normalize(value) {
  return String(value || '').toLocaleLowerCase('es');
}

function formatDate(value) {
  if (!value) return 'Sin fecha';

  return new Intl.DateTimeFormat('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function Metric({ index, label, value, description }) {
  return (
    <article className="portfolio-metric">
      <span className="portfolio-metric__index">{index}</span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
        <p>{description}</p>
      </div>
    </article>
  );
}

function ProjectCard({ project }) {
  const preview =
    project.input_assets?.find(
      (item) => item.input_role === 'product_image',
    ) || project.input_assets?.[0];

  const message =
    project.headline || project.offer_text || 'Sin mensaje definido';

  return (
    <Link
      className="portfolio-project-card"
      href={`/projects/${project.id}`}
      aria-label={`Abrir proyecto ${project.name}`}
    >
      <div className="portfolio-project-card__visual">
        {preview?.brand_asset_url ? (
          <img src={preview.brand_asset_url} alt="" />
        ) : (
          <div className="portfolio-project-card__placeholder">
            <span>{CONTENT_LABELS[project.content_type] || project.content_type}</span>
            <b>{project.name?.slice(0, 1)?.toUpperCase() || 'A'}</b>
          </div>
        )}

        <span className={`portfolio-status portfolio-status--${project.status}`}>
          {STATUS_LABELS[project.status] || project.status}
        </span>

        <span className="portfolio-variations">
          {project.requested_variations || 1} variación
          {(project.requested_variations || 1) === 1 ? '' : 'es'}
        </span>
      </div>

      <div className="portfolio-project-card__body">
        <div className="portfolio-project-card__meta">
          <span>
            {project.campaign_theme ||
              project.message_type ||
              'Proyecto creativo'}
          </span>
          <time>{formatDate(project.created_at)}</time>
        </div>

        <h2>{project.name}</h2>
        <p>{message}</p>

        <dl>
          <div>
            <dt>Producto</dt>
            <dd>{project.product_name || 'Sin producto'}</dd>
          </div>
          <div>
            <dt>Dirección</dt>
            <dd>{project.recipe_name || 'Libre'}</dd>
          </div>
          <div>
            <dt>Recursos</dt>
            <dd>{project.input_assets?.length || 0}</dd>
          </div>
        </dl>

        <div className="portfolio-project-card__footer">
          <span>{CONTENT_LABELS[project.content_type] || project.content_type}</span>
          <b>Entrar al proyecto <i aria-hidden="true">↗</i></b>
        </div>
      </div>
    </Link>
  );
}

export default function Projects() {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('all');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      await ensureWorkspace();
      const data = await api('/studio/projects/');
      setItems(data.results || data);
    }

    load()
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(() => {
    const normalizedQuery = normalize(query);

    return items.filter((item) => {
      const matchesStatus = status === 'all' || item.status === status;
      const searchFields = [
        item.name,
        item.headline,
        item.campaign_theme,
        item.product_name,
        item.recipe_name,
      ];
      const matchesQuery =
        !normalizedQuery ||
        searchFields.some((value) =>
          normalize(value).includes(normalizedQuery),
        );

      return matchesStatus && matchesQuery;
    });
  }, [items, status, query]);

  const metrics = useMemo(
    () => ({
      total: items.length,
      generating: items.filter((item) => item.status === 'generating').length,
      completed: items.filter((item) => item.status === 'completed').length,
      assets: items.reduce(
        (sum, item) => sum + (item.input_assets?.length || 0),
        0,
      ),
    }),
    [items],
  );

  return (
    <>
      <Nav privateNav />

      <main className="container project-index project-index--mesh">
        <div className="project-index__orb project-index__orb--one" />
        <div className="project-index__orb project-index__orb--two" />

        <header className="project-index-head portfolio-hero">
          <div className="portfolio-hero__copy">
            <span className="eyebrow">Creative operations portfolio</span>
            <h1>Proyectos</h1>
            <p>
              Supervisa cada proyecto desde la dirección inicial hasta sus
              resultados generados, sin perder el contexto de marca.
            </p>
          </div>

          <div className="portfolio-hero__actions">
            <span className="portfolio-hero__caption">
              {items.length} proyecto{items.length === 1 ? '' : 's'} en el workspace
            </span>
            <Link className="btn" href="/projects/new">
              <span aria-hidden="true">＋</span>
              Nuevo proyecto
            </Link>
          </div>
        </header>

        {error && (
          <div className="portfolio-alert" role="alert">
            <strong>No se pudo cargar el portafolio</strong>
            <span>{error}</span>
          </div>
        )}

        <section className="project-index-metrics portfolio-metrics">
          <Metric
            index="01"
            label="Total"
            value={metrics.total}
            description="Briefs registrados"
          />
          <Metric
            index="02"
            label="En producción"
            value={metrics.generating}
            description="Generaciones activas"
          />
          <Metric
            index="03"
            label="Completados"
            value={metrics.completed}
            description="Proyectos con resultados"
          />
          <Metric
            index="04"
            label="Referencias"
            value={metrics.assets}
            description="Assets vinculados"
          />
        </section>

        <section className="portfolio-browser">
          <div className="project-index-toolbar portfolio-toolbar">
            <label className="project-index-search portfolio-search">
              <span aria-hidden="true">⌕</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por proyecto, campaña, producto o receta…"
                aria-label="Buscar proyectos"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="Limpiar búsqueda"
                >
                  ×
                </button>
              )}
            </label>

            <div
              className="project-status-tabs portfolio-filters"
              role="tablist"
              aria-label="Filtrar proyectos por estado"
            >
              {STATUS_FILTERS.map(([key, label]) => (
                <button
                  type="button"
                  role="tab"
                  aria-selected={status === key}
                  key={key}
                  className={status === key ? 'active' : ''}
                  onClick={() => setStatus(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="portfolio-results-heading">
            <div>
              <span>Portafolio</span>
              <h2>
                {status === 'all'
                  ? 'Todos los proyectos'
                  : STATUS_FILTERS.find(([key]) => key === status)?.[1]}
              </h2>
            </div>
            <small>
              {visible.length} resultado{visible.length === 1 ? '' : 's'}
            </small>
          </div>

          {loading ? (
            <div className="portfolio-loading" role="status">
              <div className="portfolio-loading__lens" />
              <span>Organizando el portafolio…</span>
            </div>
          ) : (
            <section className="project-index-grid portfolio-grid">
              {visible.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}

              {!visible.length && (
                <div className="projects-index-empty portfolio-empty">
                  <span>Creative portfolio</span>
                  <h2>
                    {items.length
                      ? 'No encontramos coincidencias'
                      : 'Tu portafolio está listo para empezar'}
                  </h2>
                  <p>
                    {items.length
                      ? 'Prueba con otra búsqueda o cambia el estado seleccionado.'
                      : 'Crea el primer brief, conecta sus referencias y produce sus primeras variantes.'}
                  </p>
                  {!items.length && (
                    <Link className="btn" href="/projects/new">
                      Crear primer proyecto
                    </Link>
                  )}
                </div>
              )}
            </section>
          )}
        </section>
      </main>
    </>
  );
}