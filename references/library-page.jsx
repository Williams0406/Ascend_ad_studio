"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import Nav from "@/components/Nav";
import PageTitle from "@/components/PageTitle";
import {
  CatalogSearch,
  CatalogToolbar,
  CatalogViewToggle,
  FilterSelect,
  SortSelector,
  CatalogSectionTabs,
} from "@/components/catalog/CatalogPrimitives";
import {
  CompactIcon,
  DownloadIcon,
  EyeIcon,
  MoreIcon,
  ShareIcon,
} from "@/components/catalog/CatalogIcons";
import {
  CatalogGrid,
  CatalogPreview,
  CatalogResultsHeader,
  CatalogWorkspace,
  PreviewMedia,
} from "@/components/catalog/CatalogLayout";
import { useCatalogController } from "@/hooks/useCatalogController";
import { api, ensureWorkspace } from "@/lib/api";

const jobLabels = {
  queued: "En cola",
  processing: "Procesando",
  completed: "Completado",
  failed: "Fallido",
  cancelled: "Cancelado",
};

const assetTypeLabels = {
  image: "Imagen",
  video: "Video",
  audio: "Audio",
  thumbnail: "Miniatura",
  subtitle: "Subtítulo",
  background: "Fondo",
  composition: "Composición",
};

function formatDate(value, includeTime = false) {
  if (!value) return "—";

  try {
    return new Intl.DateTimeFormat("es-PE", {
      dateStyle: includeTime ? "medium" : "short",
      ...(includeTime ? { timeStyle: "short" } : {}),
    }).format(new Date(value));
  } catch {
    return String(value);
  }
}

function formatFileSize(value) {
  if (value === null || value === undefined || value === "") return "—";

  const bytes = Number(value);
  if (!Number.isFinite(bytes)) return String(value);

  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) {
    return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  }

  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

function getAssetTitle(asset) {
  return (
    asset.metadata?.headline ||
    asset.metadata?.title ||
    asset.metadata?.variation_name ||
    (asset.metadata?.variation
      ? `Variación ${asset.metadata.variation}`
      : null) ||
    asset.project_name ||
    "Archivo generado"
  );
}

function getAspectRatio(asset) {
  if (asset.metadata?.aspect_ratio) return asset.metadata.aspect_ratio;
  if (asset.width && asset.height) {
    const ratio = Number(asset.width) / Number(asset.height);

    if (Math.abs(ratio - 1) < 0.04) return "1:1";
    if (Math.abs(ratio - 0.8) < 0.04) return "4:5";
    if (Math.abs(ratio - 0.5625) < 0.04) return "9:16";
    if (Math.abs(ratio - 1.7778) < 0.06) return "16:9";
    if (Math.abs(ratio - 1.3333) < 0.06) return "4:3";
  }

  return "—";
}

function getAssetTags(asset, job) {
  const rawTags = [
    ...(Array.isArray(asset.metadata?.tags) ? asset.metadata.tags : []),
    asset.asset_type,
    job?.provider,
    job?.model_name,
    asset.metadata?.style,
    asset.metadata?.mood,
    asset.metadata?.campaign_theme,
  ];

  return [...new Set(rawTags.filter(Boolean).map(String))].slice(0, 7);
}

function Row({ label, value, code = false }) {
  const isEmpty = value === null || value === undefined || value === "";

  let output = value;

  if (!isEmpty && typeof value === "object") {
    output = JSON.stringify(value, null, 2);
  }

  return (
    <div className={`meta-row ${code ? "code" : ""}`}>
      <span>{label}</span>
      <p>{isEmpty ? "—" : String(output)}</p>
    </div>
  );
}

function AssetMedia({ asset, compact = false }) {
  if (asset.file_url && asset.asset_type === "image") {
    return (
      <img
        src={asset.file_url}
        alt={asset.project_name || getAssetTitle(asset)}
        loading="lazy"
        decoding="async"
      />
    );
  }

  if (asset.file_url && asset.asset_type === "video") {
    return <video src={asset.file_url} muted playsInline preload="metadata" />;
  }

  return (
    <div className="media-fallback">
      <span>{assetTypeLabels[asset.asset_type] || asset.asset_type}</span>
      {!compact && <small>{asset.mime_type || "Sin vista previa"}</small>}
    </div>
  );
}

function StatusPill({ status }) {
  return (
    <span className={`badge ${status || ""}`}>
      {jobLabels[status] || status || "Sin estado"}
    </span>
  );
}

function getJobProgress(job) {
  if (job.status === "completed") return 100;
  if (job.status === "processing") return 62;
  if (job.status === "queued") return 18;
  if (job.status === "failed" || job.status === "cancelled") return 100;

  return 0;
}

function getJobOutputs(job) {
  if (Array.isArray(job.assets)) {
    return job.assets.length;
  }

  return Number(job.completed_outputs || 0);
}

function shortId(value) {
  if (!value) return "—";

  return String(value).slice(0, 8).toUpperCase();
}

function JobMetric({ label, value, tone = "" }) {
  return (
    <article className={`library-job-metric ${tone}`.trim()}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

export default function ContentLibrary() {
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
  const [jobs, setJobs] = useState([]);
  const [assets, setAssets] = useState([]);
  const [tab, setTab] = useState("assets");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modelFilter, setModelFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [error, setError] = useState("");

  useEffect(() => {
    if (viewMode === "table" || viewMode === "list") {
      setViewMode("grid");
    }
  }, [viewMode, setViewMode]);

  useEffect(() => {
    async function load() {
      await ensureWorkspace();

      const [jobResponse, assetResponse] = await Promise.all([
        api("/studio/generation-jobs/"),
        api("/studio/generated-assets/"),
      ]);

      setJobs(jobResponse.results || jobResponse);
      setAssets(assetResponse.results || assetResponse);
    }

    load().catch((loadError) => setError(loadError.message));
  }, []);

  const jobById = useMemo(
    () => new Map(jobs.map((job) => [String(job.id), job])),
    [jobs],
  );

  const projects = useMemo(
    () =>
      [
        ...new Set(
          [...assets, ...jobs].map((item) => item.project_name).filter(Boolean),
        ),
      ].sort((a, b) => a.localeCompare(b, "es")),
    [assets, jobs],
  );

  const models = useMemo(
    () =>
      [...new Set(jobs.map((job) => job.model_name).filter(Boolean))].sort(
        (a, b) => a.localeCompare(b, "es"),
      ),
    [jobs],
  );

  const typeCounts = useMemo(() => {
    const counts = { all: assets.length };
    assets.forEach((asset) => {
      counts[asset.asset_type] = (counts[asset.asset_type] || 0) + 1;
    });
    return counts;
  }, [assets]);

  const metrics = useMemo(
    () => ({
      jobs: jobs.length,
      assets: assets.length,
      completed: jobs.filter((job) => job.status === "completed").length,
      processing: jobs.filter((job) => job.status === "processing").length,
      failed: jobs.filter((job) => job.status === "failed").length,
      favorites: assets.filter((asset) => asset.is_favorite).length,
    }),
    [jobs, assets],
  );

  function matchesDate(createdAt) {
    if (dateFilter === "all" || !createdAt) return true;

    const date = new Date(createdAt);
    const now = new Date();
    const diffDays = (now - date) / 86_400_000;

    if (dateFilter === "7") return diffDays <= 7;
    if (dateFilter === "30") return diffDays <= 30;
    if (dateFilter === "90") return diffDays <= 90;

    return true;
  }

  const visibleAssets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    const result = assets.filter((asset) => {
      const job = jobById.get(String(asset.job));

      const searchable = [
        asset.project_name,
        asset.asset_type,
        asset.mime_type,
        asset.prompt_used,
        asset.metadata?.headline,
        asset.metadata?.title,
        asset.metadata?.variation_name,
        job?.provider,
        job?.model_name,
        job?.prompt,
      ];

      const matchesQuery =
        !normalizedQuery ||
        searchable.some((value) =>
          value?.toString().toLowerCase().includes(normalizedQuery),
        );

      const matchesType =
        typeFilter === "all" || asset.asset_type === typeFilter;

      const matchesStatus =
        statusFilter === "all" || job?.status === statusFilter;

      const matchesModel =
        modelFilter === "all" || job?.model_name === modelFilter;

      const matchesProject =
        projectFilter === "all" || asset.project_name === projectFilter;

      return (
        matchesQuery &&
        matchesType &&
        matchesStatus &&
        matchesModel &&
        matchesProject &&
        matchesDate(asset.created_at)
      );
    });

    return [...result].sort((a, b) => {
      if (sort === "oldest") {
        return new Date(a.created_at || 0) - new Date(b.created_at || 0);
      }

      if (sort === "name") {
        return getAssetTitle(a).localeCompare(getAssetTitle(b), "es");
      }

      if (sort === "favorite") {
        return Number(b.is_favorite) - Number(a.is_favorite);
      }

      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });
  }, [
    assets,
    jobById,
    query,
    typeFilter,
    statusFilter,
    modelFilter,
    projectFilter,
    dateFilter,
    sort,
  ]);

  const visibleJobs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    const result = jobs.filter((job) => {
      const matchesQuery =
        !normalizedQuery ||
        [
          job.project_name,
          job.provider,
          job.model_name,
          job.prompt,
          job.generation_purpose,
          job.provider_request_id,
        ].some((value) =>
          value?.toString().toLowerCase().includes(normalizedQuery),
        );

      const matchesStatus =
        statusFilter === "all" || job.status === statusFilter;

      const matchesModel =
        modelFilter === "all" || job.model_name === modelFilter;

      const matchesProject =
        projectFilter === "all" || job.project_name === projectFilter;

      return (
        matchesQuery &&
        matchesStatus &&
        matchesModel &&
        matchesProject &&
        matchesDate(job.created_at)
      );
    });

    return [...result].sort((a, b) => {
      if (sort === "oldest") {
        return new Date(a.created_at || 0) - new Date(b.created_at || 0);
      }

      if (sort === "name") {
        return (a.project_name || "").localeCompare(b.project_name || "", "es");
      }

      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });
  }, [jobs, query, statusFilter, modelFilter, projectFilter, dateFilter, sort]);

  const jobMetrics = useMemo(
    () => ({
      total: visibleJobs.length,
      queued: visibleJobs.filter((job) => job.status === "queued").length,
      processing: visibleJobs.filter((job) => job.status === "processing").length,
      completed: visibleJobs.filter((job) => job.status === "completed").length,
      failed: visibleJobs.filter((job) => job.status === "failed").length,
    }),
    [visibleJobs],
  );

  const selectedJob = useMemo(() => {
    if (!selected) return null;
    if (selected.__kind === "job") return selected;

    return jobById.get(String(selected.job)) || null;
  }, [selected, jobById]);

  const selectedAsset = selected && selected.__kind !== "job" ? selected : null;

  function switchTab(value) {
    setTab(value);
    setSelected(null);
    setTypeFilter("all");
  }

  function clearFilters() {
    setQuery("");
    setTypeFilter("all");
    setStatusFilter("all");
    setModelFilter("all");
    setProjectFilter("all");
    setDateFilter("all");
  }

  async function shareSelected() {
    const url = selectedAsset?.file_url;

    if (!url) return;

    try {
      if (navigator.share) {
        await navigator.share({
          title: getAssetTitle(selectedAsset),
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
      }
    } catch {
      // The user may cancel native sharing; no additional UI is required.
    }
  }

  return (
    <>
      <Nav privateNav />

      <main
        className={[
          "container ascend-view content-operations page page--catalog",
          "catalog-experience catalog-experience--library",
          tab === "jobs" ? "library-generation-experience" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <PageTitle
          variant="catalog"
          className="page-header"
          eyebrow="Biblioteca creativa"
          title="Contenido"
          description="Explora, filtra y reutiliza los activos generados por Ascend. Cada resultado conserva su proyecto, modelo, prompt y contexto de producción."
          actions={
            <div className="actions">
              <Link className="btn btn-primary" href="/projects/new">
                <span>✦</span>
                Nueva generación
              </Link>
            </div>
          }
        />

        {error && <div className="error">{error}</div>}

        <CatalogToolbar onClear={clearFilters} clearLabel="Limpiar filtros">
          <CatalogSearch
            value={query}
            onChange={setQuery}
            placeholder="Buscar por nombre, proyecto, modelo o prompt…"
            className="catalog-toolbar__search"
          />

          <FilterSelect
            label="Proyecto"
            value={projectFilter}
            onChange={setProjectFilter}
            options={[
              ["all", "Todos"],
              ...projects.map((project) => [project, project]),
            ]}
          />

          <FilterSelect
            label="Contenido"
            value={typeFilter}
            onChange={setTypeFilter}
            disabled={tab === "jobs"}
            options={[["all", "Todos"], ...Object.entries(assetTypeLabels)]}
          />

          <FilterSelect
            label="Estado"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[["all", "Todos"], ...Object.entries(jobLabels)]}
          />

          <FilterSelect
            label="Modelo"
            value={modelFilter}
            onChange={setModelFilter}
            options={[
              ["all", "Todos"],
              ...models.map((model) => [model, model]),
            ]}
          />

          <FilterSelect
            label="Fecha"
            value={dateFilter}
            onChange={setDateFilter}
            options={[
              ["all", "Cualquier fecha"],
              ["7", "Últimos 7 días"],
              ["30", "Últimos 30 días"],
              ["90", "Últimos 90 días"],
            ]}
          />
        </CatalogToolbar>

        <CatalogSectionTabs
          value={tab}
          onChange={switchTab}
          ariaLabel="Secciones de contenido"
          items={[
            {
              value: "assets",
              label: "Imágenes generadas",
              description: "Resultados creativos",
              count: assets.length,
            },
            {
              value: "jobs",
              label: "Trabajos de generación",
              description: "Historial de producción",
              count: jobs.length,
            },
          ]}
        />

        <CatalogResultsHeader
          eyebrow={
            tab === "assets" ? "Biblioteca visual" : "Historial de producción"
          }
          title={
            tab === "assets" ? "Archivos generados" : "Trabajos de generación"
          }
          count={tab === "assets" ? visibleAssets.length : visibleJobs.length}
          countLabel={tab === "assets" ? "archivos" : "trabajos"}
          actions={
            tab === "assets" ? (
              <CatalogViewToggle
                value={viewMode}
                onChange={setViewMode}
                allowList={false}
              >
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
            ) : (
              <SortSelector
                label="Ordenar"
                value={sort}
                onChange={setSort}
                options={[
                  ["recent", "Más recientes"],
                  ["oldest", "Más antiguos"],
                  ["name", "Proyecto"],
                ]}
              />
            )
          }
        />

        <CatalogWorkspace
          className={
            tab === "jobs"
              ? "catalog-shell library-jobs-workspace"
              : "catalog-shell"
          }
          hasPreview={Boolean(selected)}
        >
          {tab === "assets" ? (
            <>
              <CatalogGrid viewMode={viewMode}>
                {visibleAssets.map((asset) => {
                  const job = jobById.get(String(asset.job));
                  const title = getAssetTitle(asset);

                  return (
                    <article
                      className={`catalog-card catalog-card--asset ${selectedAsset?.id === asset.id ? "selected" : ""}`}
                      key={asset.id}
                      role="button"
                      tabIndex="0"
                      onClick={() => setSelected({ ...asset, __kind: "asset" })}
                      onKeyDown={(event) =>
                        event.key === "Enter" &&
                        setSelected({
                          ...asset,
                          __kind: "asset",
                        })
                      }
                    >
                      <div className="thumb">
                        <AssetMedia
                          asset={asset}
                          compact={viewMode !== "grid"}
                        />

                        {asset.is_favorite && (
                          <b className="btn btn-secondary btn-icon">★</b>
                        )}

                        {selectedAsset?.id === asset.id && (
                          <i className="badge">✓</i>
                        )}
                      </div>

                      <div className="catalog-body">
                        <h2>{title}</h2>
                        <p>{asset.project_name || "Proyecto sin nombre"}</p>

                        <div className="kv">
                          <span>{getAspectRatio(asset)}</span>
                          <span>
                            {assetTypeLabels[asset.asset_type] ||
                              asset.asset_type}
                          </span>
                          <StatusPill status={job?.status} />
                        </div>

                        <footer>
                          <span>
                            {job?.model_name || "Modelo no registrado"}
                          </span>
                          <time>{formatDate(asset.created_at)}</time>
                          <button type="button">•••</button>
                        </footer>
                      </div>
                    </article>
                  );
                })}

                {!visibleAssets.length && (
                  <div className="empty-state">
                    <span>GeneratedAsset</span>
                    <h2>No hay archivos para mostrar</h2>
                    <p>Ajusta los filtros o crea una nueva generación.</p>
                    <Link className="btn btn-primary" href="/projects/new">
                      Nueva generación
                    </Link>
                  </div>
                )}
              </CatalogGrid>
            </>
          ) : (
            <>
              <section
                className="library-jobs-summary"
                aria-label="Resumen de trabajos"
              >
                <JobMetric
                  label="Trabajos visibles"
                  value={jobMetrics.total}
                />

                <JobMetric
                  label="En cola"
                  value={jobMetrics.queued}
                  tone="queued"
                />

                <JobMetric
                  label="Procesando"
                  value={jobMetrics.processing}
                  tone="processing"
                />

                <JobMetric
                  label="Completados"
                  value={jobMetrics.completed}
                  tone="completed"
                />

                <JobMetric
                  label="Con incidencias"
                  value={jobMetrics.failed}
                  tone="failed"
                />
              </section>

              <section
                className="library-jobs-list"
                aria-label="Trabajos de generación"
              >
                {visibleJobs.map((job, index) => {
                  const selectedJobCard =
                    selected?.__kind === "job" &&
                    String(selected.id) === String(job.id);

                  const progress = getJobProgress(job);
                  const generatedOutputs = getJobOutputs(job);
                  const requestedOutputs = Number(job.number_of_outputs || 0);

                  return (
                    <article
                      className={[
                        "library-job-card",
                        selectedJobCard ? "selected" : "",
                        `status-${job.status || "unknown"}`,
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      key={job.id}
                    >
                      <button
                        type="button"
                        className="library-job-card__button"
                        onClick={() =>
                          setSelected({
                            ...job,
                            __kind: "job",
                          })
                        }
                        aria-pressed={selectedJobCard}
                      >
                        <div className="library-job-card__rail">
                          <span>{String(index + 1).padStart(2, "0")}</span>
                          <i aria-hidden="true" />
                        </div>

                        <div className="library-job-card__content">
                          <header className="library-job-card__header">
                            <div className="library-job-card__identity">
                              <span className="library-job-card__eyebrow">
                                GenerationJob · {shortId(job.id)}
                              </span>

                              <h3>
                                {job.project_name || "Proyecto sin nombre"}
                              </h3>

                              <p>
                                {job.name ||
                                  job.campaign_theme ||
                                  "Configuración de generación"}
                              </p>
                            </div>

                            <StatusPill status={job.status} />
                          </header>

                          <div className="library-job-card__model">
                            <span className="library-job-card__provider">
                              {(job.provider || "AI").slice(0, 2).toUpperCase()}
                            </span>

                            <div>
                              <strong>
                                {job.model_name || "Modelo no registrado"}
                              </strong>
                              <small>
                                {job.provider || "Proveedor no registrado"}
                              </small>
                            </div>
                          </div>

                          <div className="library-job-card__progress">
                            <div>
                              <span>Progreso</span>
                              <strong>{progress}%</strong>
                            </div>

                            <div
                              className="library-job-card__progress-track"
                              aria-label={`Progreso ${progress}%`}
                            >
                              <span style={{ width: `${progress}%` }} />
                            </div>
                          </div>

                          <dl className="library-job-card__metadata">
                            <div>
                              <dt>Propósito</dt>
                              <dd>{job.generation_purpose || "Imagen publicitaria"}</dd>
                            </div>

                            <div>
                              <dt>Outputs</dt>
                              <dd>
                                {generatedOutputs}/{requestedOutputs || "—"}
                              </dd>
                            </div>

                            <div>
                              <dt>Prioridad</dt>
                              <dd>{job.priority ?? 5}</dd>
                            </div>

                            <div>
                              <dt>Creado</dt>
                              <dd>{formatDate(job.created_at)}</dd>
                            </div>
                          </dl>

                          {job.error_message && (
                            <div className="library-job-card__error">
                              <strong>Incidencia</strong>
                              <span>{job.error_message}</span>
                            </div>
                          )}

                          <footer className="library-job-card__footer">
                            <div>
                              {job.batch_name && (
                                <span className="library-job-card__chip">
                                  Batch · {job.batch_name}
                                </span>
                              )}

                              {job.parameters?.format && (
                                <span className="library-job-card__chip">
                                  {job.parameters.format}
                                </span>
                              )}

                              {job.parameters?.resolution && (
                                <span className="library-job-card__chip">
                                  {job.parameters.resolution}
                                </span>
                              )}
                            </div>

                            <span className="library-job-card__open">
                              Ver detalle
                              <strong>→</strong>
                            </span>
                          </footer>
                        </div>
                      </button>
                    </article>
                  );
                })}

                {!visibleJobs.length && (
                  <div className="empty-state library-jobs-empty">
                    <span>GenerationJob</span>
                    <h2>No hay trabajos para mostrar</h2>
                    <p>
                      Prueba con otros filtros o inicia una nueva generación.
                    </p>

                    <Link className="btn btn-primary" href="/projects/new">
                      Nueva generación
                    </Link>
                  </div>
                )}
              </section>
            </>
          )}
          {selected && (
            <CatalogPreview
              className={[
                "inspector catalog-detail catalog-detail--content",
                selected?.__kind === "job"
                  ? "library-job-inspector"
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
              title={
                selected?.__kind === "job"
                  ? selectedJob?.project_name || "Trabajo de generación"
                  : "Vista previa del contenido"
              }
              subtitle={
                selected?.__kind === "job"
                  ? "Trazabilidad, configuración y estado de producción"
                  : "Archivo generado, trazabilidad y datos de producción"
              }
              eyebrow={
                selected?.__kind === "job"
                  ? `GenerationJob · ${shortId(selectedJob?.id)}`
                  : "Contenido seleccionado"
              }
              onClose={() => setSelected(null)}
            >
              {selectedAsset ? (
                <>
                  <header className="catalog-detail__identity">
                    <h2>{getAssetTitle(selectedAsset)}</h2>
                    <StatusPill status={selectedJob?.status} />
                  </header>

                  <PreviewMedia
                    aspectRatio="4 / 5"
                    className="catalog-detail__media"
                  >
                    <AssetMedia asset={selectedAsset} />
                  </PreviewMedia>

                  <div className="inspector-actions catalog-detail__actions">
                    {selectedAsset.file_url && (
                      <a
                        href={selectedAsset.file_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <EyeIcon />
                        <span>Vista previa</span>
                      </a>
                    )}

                    {selectedAsset.file_url && (
                      <a
                        href={selectedAsset.file_url}
                        download
                        target="_blank"
                        rel="noreferrer"
                      >
                        <DownloadIcon />
                        <span>Descargar</span>
                      </a>
                    )}

                    <button type="button" onClick={shareSelected}>
                      <ShareIcon />
                      <span>Compartir</span>
                    </button>

                    <button type="button">
                      <MoreIcon />
                      <span>Más</span>
                    </button>
                  </div>

                  <section className="inspector-section">
                    <h3>Información general</h3>

                    <Row label="Proyecto" value={selectedAsset.project_name} />
                    <Row
                      label="Tipo de contenido"
                      value={
                        assetTypeLabels[selectedAsset.asset_type] ||
                        selectedAsset.asset_type
                      }
                    />
                    <Row
                      label="Formato"
                      value={getAspectRatio(selectedAsset)}
                    />
                    <Row label="Modelo" value={selectedJob?.model_name} />
                    <Row label="Proveedor" value={selectedJob?.provider} />
                    <Row
                      label="Creado"
                      value={formatDate(selectedAsset.created_at, true)}
                    />
                    <Row
                      label="Variación"
                      value={
                        selectedAsset.metadata?.variation ||
                        selectedAsset.metadata?.variation_name
                      }
                    />
                  </section>

                  <section className="inspector-section">
                    <h3>Archivo</h3>

                    <Row label="MIME" value={selectedAsset.mime_type} />
                    <Row
                      label="Dimensiones"
                      value={
                        selectedAsset.width && selectedAsset.height
                          ? `${selectedAsset.width} × ${selectedAsset.height}`
                          : null
                      }
                    />
                    <Row
                      label="Tamaño"
                      value={formatFileSize(selectedAsset.file_size)}
                    />
                    <Row
                      label="Miniatura"
                      value={selectedAsset.thumbnail_url}
                    />
                  </section>

                  <section className="inspector-section">
                    <h3>Atributos clave</h3>

                    <div className="badges">
                      {getAssetTags(selectedAsset, selectedJob).map((tag) => (
                        <span key={tag}>{tag}</span>
                      ))}

                      {!getAssetTags(selectedAsset, selectedJob).length && (
                        <small>Sin etiquetas disponibles.</small>
                      )}
                    </div>
                  </section>

                  <section className="inspector-section">
                    <h3>Prompt utilizado</h3>

                    <div className="code-block">
                      {selectedAsset.prompt_used ||
                        selectedJob?.prompt ||
                        "No se registró un prompt para este activo."}
                    </div>
                  </section>

                  <section className="inspector-section">
                    <h3>Metadata</h3>
                    <Row label="Datos" value={selectedAsset.metadata} code />
                  </section>

                  {selectedAsset.project && (
                    <section className="notice info">
                      <span>Uso en</span>
                      <Link href={`/projects/${selectedAsset.project}`}>
                        Campaña:{" "}
                        {selectedAsset.project_name || "Abrir proyecto"} ↗
                      </Link>
                    </section>
                  )}
                </>
              ) : (
                <>
                  <section className="library-job-inspector__hero">
                    <div className="library-job-inspector__mark">
                      {(selectedJob?.provider || "AI").slice(0, 2).toUpperCase()}
                    </div>

                    <div>
                      <span>Configuración activa</span>
                      <strong>
                        {selectedJob?.model_name || "Modelo no registrado"}
                      </strong>
                      <small>
                        {selectedJob?.provider || "Proveedor no registrado"}
                      </small>
                    </div>

                    <StatusPill status={selectedJob?.status} />
                  </section>

                  <section className="library-job-inspector__progress">
                    <header>
                      <div>
                        <span>Progreso estimado</span>
                        <strong>{getJobProgress(selectedJob)}%</strong>
                      </div>

                      <small>
                        {getJobOutputs(selectedJob)} de{" "}
                        {selectedJob?.number_of_outputs || 0} outputs
                      </small>
                    </header>

                    <div className="library-job-inspector__progress-track">
                      <span
                        style={{
                          width: `${getJobProgress(selectedJob)}%`,
                        }}
                      />
                    </div>
                  </section>

                  <section className="library-job-inspector__metrics">
                    <article>
                      <span>Outputs</span>
                      <strong>{selectedJob?.number_of_outputs ?? "—"}</strong>
                    </article>

                    <article>
                      <span>Prioridad</span>
                      <strong>{selectedJob?.priority ?? 5}</strong>
                    </article>

                    <article>
                      <span>Reintentos</span>
                      <strong>{selectedJob?.retry_count ?? 0}</strong>
                    </article>
                  </section>

                  <section className="inspector-section library-job-inspector__section">
                    <h3>Producción</h3>

                    <Row
                      label="Estado"
                      value={jobLabels[selectedJob?.status]}
                    />
                    <Row
                      label="Propósito"
                      value={selectedJob?.generation_purpose}
                    />
                    <Row label="Proveedor" value={selectedJob?.provider} />
                    <Row label="Modelo" value={selectedJob?.model_name} />
                    <Row label="Batch" value={selectedJob?.batch_name} />
                    <Row
                      label="Provider request ID"
                      value={selectedJob?.provider_request_id}
                    />
                  </section>

                  <section className="inspector-section library-job-inspector__section">
                    <h3>Dirección creativa</h3>

                    <Row label="Nombre" value={selectedJob?.name} />
                    <Row
                      label="Tema de campaña"
                      value={selectedJob?.campaign_theme}
                    />
                    <Row label="Headline" value={selectedJob?.headline} />
                    <Row label="Oferta" value={selectedJob?.offer_text} />
                    <Row
                      label="Call to action"
                      value={selectedJob?.call_to_action}
                    />
                    <Row
                      label="Audiencia"
                      value={selectedJob?.target_audience}
                    />
                    <Row
                      label="Focus tags"
                      value={selectedJob?.focus_tags}
                      code
                    />
                  </section>

                  <section className="inspector-section library-job-inspector__section">
                    <h3>Prompt</h3>

                    <div className="library-job-inspector__prompt">
                      {selectedJob?.prompt || "Sin prompt registrado."}
                    </div>

                    {selectedJob?.negative_prompt && (
                      <div className="library-job-inspector__prompt negative">
                        <span>Prompt negativo</span>
                        {selectedJob.negative_prompt}
                      </div>
                    )}
                  </section>

                  <section className="inspector-section library-job-inspector__section">
                    <h3>Parámetros técnicos</h3>

                    <div className="library-job-inspector__parameter-grid">
                      <Row
                        label="Formato"
                        value={selectedJob?.parameters?.format}
                      />
                      <Row
                        label="Aspect ratio"
                        value={selectedJob?.parameters?.aspect_ratio}
                      />
                      <Row
                        label="Resolución"
                        value={selectedJob?.parameters?.resolution}
                      />
                      <Row
                        label="Calidad"
                        value={selectedJob?.parameters?.quality_mode}
                      />
                      <Row
                        label="Formato de salida"
                        value={selectedJob?.parameters?.output_format}
                      />
                      <Row
                        label="Seed"
                        value={selectedJob?.parameters?.seed}
                      />
                    </div>

                    <details className="library-job-inspector__raw">
                      <summary>Ver parámetros completos</summary>
                      <Row label="Datos" value={selectedJob?.parameters} code />
                    </details>
                  </section>

                  <section className="inspector-section library-job-inspector__section">
                    <h3>Tiempos y seguimiento</h3>

                    <Row
                      label="Creado"
                      value={formatDate(selectedJob?.created_at, true)}
                    />
                    <Row
                      label="Iniciado"
                      value={formatDate(selectedJob?.started_at, true)}
                    />
                    <Row
                      label="Completado"
                      value={formatDate(selectedJob?.completed_at, true)}
                    />
                    <Row
                      label="Actualizado"
                      value={formatDate(selectedJob?.updated_at, true)}
                    />

                    {selectedJob?.error_message && (
                      <div className="library-job-inspector__error">
                        <strong>Error registrado</strong>
                        <p>{selectedJob.error_message}</p>
                      </div>
                    )}
                  </section>

                  {selectedJob?.project && (
                    <section className="notice info library-job-inspector__project">
                      <div>
                        <span>Proyecto relacionado</span>
                        <strong>
                          {selectedJob.project_name || "Campaña"}
                        </strong>
                      </div>

                      <Link href={`/projects/${selectedJob.project}`}>
                        Abrir proyecto ↗
                      </Link>
                    </section>
                  )}
                </>
              )}
            </CatalogPreview>
          )}
        </CatalogWorkspace>
      </main>
    </>
  );
}
