"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import Nav from "@/components/Nav";
import {
  CompactIcon,
  EyeIcon,
  SearchIcon,
} from "@/components/catalog/CatalogIcons";
import {
  CatalogSearch,
  CatalogToolbar,
  CatalogViewToggle,
  FilterSelect,
  SortSelector,
} from "@/components/catalog/CatalogPrimitives";
import {
  CatalogGrid,
  CatalogPreview,
  CatalogResultsHeader,
  CatalogWorkspace,
  PreviewMedia,
} from "@/components/catalog/CatalogLayout";
import { api, ensureWorkspace } from "@/lib/api";
import { useCatalogController } from "@/hooks/useCatalogController";
import PageTitle from "@/components/PageTitle";

const STATUS_LABELS = {
  draft: "Borrador",
  ready: "Listo",
  generating: "Generando",
  completed: "Completado",
  archived: "Archivado",
  cancelled: "Cancelado",
};

const CONTENT_LABELS = {
  flyer: "Flyer",
  social_post: "Post social",
  story: "Story",
  banner: "Banner",
  carousel: "Carrusel",
  short_video: "Video corto",
  product_video: "Video de producto",
};

const CONTENT_FILTERS = [
  ["all", "Todos"],
  ["flyer", "Flyer"],
  ["social_post", "Post social"],
  ["story", "Story"],
  ["banner", "Banner"],
  ["carousel", "Carrusel"],
  ["short_video", "Video corto"],
  ["product_video", "Video de producto"],
];

const STATUS_OPTIONS = [
  ["all", "Todos los estados"],
  ["draft", "Borradores"],
  ["ready", "Listos"],
  ["generating", "Generando"],
  ["completed", "Completados"],
  ["archived", "Archivados"],
  ["cancelled", "Cancelados"],
];

function normalize(value) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("es");
}

function formatDate(value, includeTime = false) {
  if (!value) return "Sin fecha";

  try {
    return new Intl.DateTimeFormat("es-PE", {
      dateStyle: includeTime ? "medium" : "medium",
      ...(includeTime ? { timeStyle: "short" } : {}),
    }).format(new Date(value));
  } catch {
    return String(value);
  }
}

function Metric({ icon, value, label, tone = "copper" }) {
  return (
    <article className={`metric-card ${tone}`}>
      <i>{icon}</i>
      <div>
        <strong>{value}</strong>
        <span>{label}</span>
      </div>
    </article>
  );
}

function StatusBadge({ status }) {
  return (
    <span className={`badge ${status || "draft"}`}>
      {STATUS_LABELS[status] || status || "Sin estado"}
    </span>
  );
}

function ProjectPreview({ project }) {
  const preview =
    project?.input_assets?.find(
      (item) => item.input_role === "product_image",
    ) || project?.input_assets?.[0];

  if (preview?.brand_asset_url) {
    return (
      <img
        src={preview.brand_asset_url}
        alt=""
        loading="lazy"
        decoding="async"
      />
    );
  }

  if (project?.preview_url) {
    return (
      <img src={project.preview_url} alt="" loading="lazy" decoding="async" />
    );
  }

  return (
    <div className="media-fallback">
      <span>{CONTENT_LABELS[project?.content_type] || "Proyecto"}</span>
      <strong>{project?.name?.slice(0, 1)?.toUpperCase() || "A"}</strong>
    </div>
  );
}

function projectDisplayFormat(project) {
  const jobFormat = project?.jobs?.find((job) => job.parameters?.format)
    ?.parameters?.format;
  const jobRatio = project?.jobs?.find((job) => job.parameters?.aspect_ratio)
    ?.parameters?.aspect_ratio;
  return (
    project?.template_name ||
    (project?.content_type && CONTENT_LABELS[project.content_type]) ||
    jobFormat ||
    jobRatio ||
    "Brief creativo"
  );
}

function projectOutputCount(project) {
  return (
    project?.jobs?.reduce(
      (sum, job) => sum + Number(job.number_of_outputs || 0),
      0,
    ) ||
    project?.requested_variations ||
    project?.jobs?.length ||
    1
  );
}

function ProjectCard({ project, selected, onSelect, viewMode }) {
  const message =
    project.headline || project.offer_text || "Sin mensaje principal definido";

  return (
    <article
      className={`catalog-card catalog-card--project ${selected ? "selected" : ""} ${viewMode}`}
      role="button"
      tabIndex="0"
      onClick={() => onSelect(project)}
      onKeyDown={(event) => event.key === "Enter" && onSelect(project)}
    >
      <div className="thumb">
        <ProjectPreview project={project} />
        <StatusBadge status={project.status} />
        {project.is_featured && <b>Destacado</b>}
      </div>

      <div className="catalog-body">
        <h2>{project.name}</h2>
        <p>{project.product_name || "Sin producto vinculado"}</p>

        <div className="badges">
          <span>{projectDisplayFormat(project)}</span>
          <span>{project.jobs?.length || 0} jobs</span>
          <span>{projectOutputCount(project)} outputs</span>
        </div>

        <div className="muted">{message}</div>

        <footer>
          <time>{formatDate(project.created_at)}</time>
          <div className="avatar-row" aria-label="Equipo del proyecto">
            <i>AS</i>
            <i>AI</i>
          </div>
          <Link
            className="btn btn-secondary"
            href={`/projects/${project.id}`}
            onClick={(event) => event.stopPropagation()}
            aria-label={`Abrir proyecto ${project.name}`}
          >
            <EyeIcon />
          </Link>
        </footer>
      </div>
    </article>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="meta-row">
      <span>{label}</span>
      <strong>{value || "—"}</strong>
    </div>
  );
}

export default function ProjectsPage() {
  const [items, setItems] = useState([]);
  const {
    query,
    setQuery,
    sort,
    setSort,
    viewMode,
    setViewMode,
    selected,
    setSelected,
  } = useCatalogController();
  const [statusFilter, setStatusFilter] = useState("all");
  const [contentFilter, setContentFilter] = useState("all");
  const [productFilter, setProductFilter] = useState("all");
  const [recipeFilter, setRecipeFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      await ensureWorkspace();
      const data = await api("/studio/projects/");
      setItems(data.results || data);
    }

    load()
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, []);

  const products = useMemo(
    () =>
      [...new Set(items.map((item) => item.product_name).filter(Boolean))].sort(
        (a, b) => a.localeCompare(b, "es"),
      ),
    [items],
  );

  const recipes = useMemo(
    () =>
      [...new Set(items.map((item) => item.recipe_name).filter(Boolean))].sort(
        (a, b) => a.localeCompare(b, "es"),
      ),
    [items],
  );

  const metrics = useMemo(
    () => ({
      total: items.length,
      draft: items.filter((item) => item.status === "draft").length,
      generating: items.filter((item) => item.status === "generating").length,
      completed: items.filter((item) => item.status === "completed").length,
      archived: items.filter((item) => item.status === "archived").length,
      resources: items.reduce(
        (sum, item) => sum + (item.input_assets?.length || 0),
        0,
      ),
    }),
    [items],
  );

  const contentCounts = useMemo(() => {
    const counts = { all: items.length };
    items.forEach((item) => {
      const key = item.content_type || "brief";
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [items]);

  const visible = useMemo(() => {
    const term = normalize(query);

    const result = items.filter((item) => {
      const matchesQuery =
        !term ||
        [
          item.name,
          item.headline,
          item.offer_text,
          item.campaign_theme,
          item.message_type,
          item.product_name,
          item.recipe_name,
          item.creative_angle_name,
        ].some((value) => normalize(value).includes(term));

      const matchesStatus =
        statusFilter === "all" || item.status === statusFilter;
      const matchesContent =
        contentFilter === "all" ||
        (item.content_type || "brief") === contentFilter;
      const matchesProduct =
        productFilter === "all" || item.product_name === productFilter;
      const matchesRecipe =
        recipeFilter === "all" || item.recipe_name === recipeFilter;

      return (
        matchesQuery &&
        matchesStatus &&
        matchesContent &&
        matchesProduct &&
        matchesRecipe
      );
    });

    return [...result].sort((a, b) => {
      if (sort === "oldest") {
        return new Date(a.created_at || 0) - new Date(b.created_at || 0);
      }

      if (sort === "name") {
        return String(a.name || "").localeCompare(String(b.name || ""), "es");
      }

      if (sort === "updated") {
        return new Date(b.updated_at || 0) - new Date(a.updated_at || 0);
      }

      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });
  }, [
    items,
    query,
    statusFilter,
    contentFilter,
    productFilter,
    recipeFilter,
    sort,
  ]);

  function clearFilters() {
    setQuery("");
    setStatusFilter("all");
    setContentFilter("all");
    setProductFilter("all");
    setRecipeFilter("all");
  }

  return (
    <>
      <Nav privateNav />

      <main className="container ascend-view page page--catalog catalog-experience catalog-experience--projects">
        <PageTitle
          variant="catalog"
          className="page-header"
          eyebrow="Biblioteca creativa"
          title="Proyectos"
          description="Gestiona todos tus proyectos creativos. Cada proyecto agrupa producto, dirección, recursos, configuración y resultados generados."
          actions={
            <div className="actions">
              <Link className="btn btn-primary" href="/projects/new">
                <span>＋</span>
                Nuevo proyecto
              </Link>
            </div>
          }
        />

        {error && (
          <div className="notice" role="alert">
            <strong>No se pudieron cargar los proyectos.</strong>
            <span>{error}</span>
          </div>
        )}

        <section className="catalog-section">
          <CatalogToolbar onClear={clearFilters} clearLabel="Limpiar filtros">
            <CatalogSearch
              value={query}
              onChange={setQuery}
              placeholder="Buscar por nombre, producto, campaña o receta…"
              className="catalog-toolbar__search"
            />

            <FilterSelect
              label="Estado"
              value={statusFilter}
              onChange={setStatusFilter}
              options={STATUS_OPTIONS}
            />

            <FilterSelect
              label="Contenido"
              value={contentFilter}
              onChange={setContentFilter}
              options={[["all", "Todos"], ...Object.entries(CONTENT_LABELS)]}
            />

            <FilterSelect
              label="Producto"
              value={productFilter}
              onChange={setProductFilter}
              options={[
                ["all", "Todos"],
                ...products.map((product) => [product, product]),
              ]}
            />

            <FilterSelect
              label="Receta"
              value={recipeFilter}
              onChange={setRecipeFilter}
              options={[
                ["all", "Todas"],
                ...recipes.map((recipe) => [recipe, recipe]),
              ]}
            />

            <SortSelector
              label="Ordenar"
              value={sort}
              onChange={setSort}
              options={[
                ["recent", "Más recientes"],
                ["oldest", "Más antiguos"],
                ["name", "Nombre"],
              ]}
            />
          </CatalogToolbar>

          <CatalogResultsHeader
            eyebrow="Biblioteca creativa"
            title="Proyectos"
            count={visible.length}
            countLabel="proyectos"
            actions={
              <CatalogViewToggle value={viewMode} onChange={setViewMode}>
                <button
                  type="button"
                  className={`catalog-view-toggle__button ${
                    viewMode === "compact" ? "active" : ""
                  }`}
                  onClick={() => setViewMode("compact")}
                  aria-label="Vista compacta"
                  aria-pressed={viewMode === "compact"}
                  title="Compacta"
                >
                  <CompactIcon size={18} />
                </button>
              </CatalogViewToggle>
            }
          />

          <CatalogWorkspace
            className="catalog-shell"
            hasPreview={Boolean(selected)}
            as="div"
          >
            <CatalogGrid viewMode={viewMode}>
              {loading ? (
                <div className="loading-state" role="status">
                  <div />
                  <span>Organizando tus proyectos…</span>
                </div>
              ) : (
                visible.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    selected={selected?.id === project.id}
                    onSelect={setSelected}
                    viewMode={viewMode}
                  />
                ))
              )}

              {!loading && !visible.length && (
                <div className="empty-state">
                  <span>Portfolio creativo</span>
                  <h2>
                    {items.length
                      ? "No encontramos coincidencias"
                      : "Tu portafolio está listo para empezar"}
                  </h2>
                  <p>
                    {items.length
                      ? "Prueba otra búsqueda o limpia los filtros aplicados."
                      : "Crea tu primer proyecto para conectar producto, receta, activos y dirección creativa."}
                  </p>
                  {!items.length && (
                    <Link className="btn btn-primary" href="/projects/new">
                      Crear primer proyecto
                    </Link>
                  )}
                </div>
              )}
            </CatalogGrid>

            {selected && (
              <CatalogPreview
                className="inspector catalog-detail catalog-detail--project"
                title="Vista previa del proyecto"
                subtitle="Resumen creativo, recursos y estado de producción"
                eyebrow="Proyecto seleccionado"
                onClose={() => setSelected(null)}
              >
                <PreviewMedia
                  className="catalog-detail__media"
                  src={
                    selected?.input_assets?.find(
                      (item) => item.input_role === "product_image",
                    )?.brand_asset_url ||
                    selected?.input_assets?.[0]?.brand_asset_url ||
                    selected?.preview_url
                  }
                  alt={selected?.name || "Vista previa del proyecto"}
                  aspectRatio="4 / 5"
                >
                  <div className="media-fallback">
                    <span>Proyecto</span>
                    <strong>{selected?.name?.slice(0, 1) || "A"}</strong>
                  </div>
                </PreviewMedia>

                <header className="catalog-detail__identity">
                  <span>Identidad del proyecto</span>
                  <div className="section-header">
                    <h2>{selected.name}</h2>
                    <StatusBadge status={selected.status} />
                  </div>
                </header>

                <div className="inspector-actions catalog-detail__actions">
                  <Link
                    className="btn btn-primary"
                    href={`/projects/${selected.id}`}
                    aria-label={`Abrir proyecto ${selected.name}`}
                  >
                    <EyeIcon />
                    <span>Abrir proyecto</span>
                  </Link>
                </div>

                <section className="inspector-section">
                  <h3>Información general</h3>
                  <DetailRow
                    label="Tipo de contenido"
                    value={projectDisplayFormat(selected)}
                  />
                  <DetailRow label="Producto" value={selected.product_name} />
                  <DetailRow
                    label="Receta de IA"
                    value={selected.recipe_name}
                  />
                  <DetailRow
                    label="Ángulo creativo"
                    value={selected.creative_angle_name}
                  />
                  <DetailRow
                    label="Campaña / Tema"
                    value={selected.campaign_theme}
                  />
                  <DetailRow
                    label="Mensaje principal"
                    value={selected.headline || selected.offer_text}
                  />
                  <DetailRow
                    label="Formato objetivo"
                    value={
                      selected.aspect_ratio || projectDisplayFormat(selected)
                    }
                  />
                  <DetailRow
                    label="Outputs configurados"
                    value={projectOutputCount(selected)}
                  />
                  <DetailRow
                    label="Usar Brand Kit"
                    value={selected.use_brand_kit ? "Sí" : "No"}
                  />
                  <DetailRow
                    label="Creado"
                    value={formatDate(selected.created_at, true)}
                  />
                  <DetailRow
                    label="Actualizado"
                    value={formatDate(selected.updated_at, true)}
                  />
                </section>

                <section className="inspector-section">
                  <h3>
                    Recursos utilizados ({selected.input_assets?.length || 0})
                  </h3>
                  <div className="asset-list">
                    {(selected.input_assets || []).slice(0, 5).map((asset) => (
                      <div
                        key={
                          asset.id || `${asset.brand_asset}-${asset.input_role}`
                        }
                      >
                        {asset.brand_asset_url ? (
                          <img
                            src={asset.brand_asset_url}
                            alt=""
                            loading="lazy"
                            decoding="async"
                          />
                        ) : (
                          <span>
                            {asset.input_role?.slice(0, 2)?.toUpperCase()}
                          </span>
                        )}
                      </div>
                    ))}
                    <Link href={`/projects/${selected.id}?mode=edit`}>＋</Link>
                  </div>
                </section>

                <section className="inspector-section">
                  <h3>Estadísticas</h3>
                  <div className="grid metrics-grid">
                    <article>
                      <span>Generaciones</span>
                      <strong>
                        {selected.jobs_count ??
                          selected.generation_count ??
                          "—"}
                      </strong>
                    </article>
                    <article>
                      <span>Recursos usados</span>
                      <strong>{selected.input_assets?.length || 0}</strong>
                    </article>
                    <article>
                      <span>Versiones</span>
                      <strong>{selected.version_count ?? 1}</strong>
                    </article>
                    <article>
                      <span>Calidad</span>
                      <strong>{selected.quality_mode || "standard"}</strong>
                    </article>
                  </div>
                </section>
              </CatalogPreview>
            )}
          </CatalogWorkspace>
        </section>
      </main>
    </>
  );
}
