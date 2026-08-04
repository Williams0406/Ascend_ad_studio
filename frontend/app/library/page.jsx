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
  SearchIcon,
  ShareIcon,
} from "@/components/catalog/CatalogIcons";
import {
  CatalogGrid,
  CatalogPageHeader,
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

      <main className="container ascend-view content-operations page page--catalog catalog-experience catalog-experience--library">
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
          className="catalog-shell"
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
              <section className="stack">
                <header>
                  <span>Estado</span>
                  <span>Proyecto / modelo</span>
                  <span>Propósito</span>
                  <span>Outputs</span>
                  <span>Fecha</span>
                  <span />
                </header>

                {visibleJobs.map((job) => (
                  <button
                    type="button"
                    className={
                      selected?.__kind === "job" && selected.id === job.id
                        ? "selected"
                        : ""
                    }
                    key={job.id}
                    onClick={() => setSelected({ ...job, __kind: "job" })}
                  >
                    <StatusPill status={job.status} />

                    <div>
                      <b>{job.project_name || "Proyecto sin nombre"}</b>
                      <small>
                        {job.provider || "Proveedor no registrado"} ·{" "}
                        {job.model_name || "Modelo no registrado"}
                      </small>
                    </div>

                    <span>{job.generation_purpose || "—"}</span>
                    <span>{job.number_of_outputs ?? "—"}</span>
                    <time>{formatDate(job.created_at)}</time>
                    <strong>→</strong>
                  </button>
                ))}

                {!visibleJobs.length && (
                  <div className="empty-state">
                    <span>GenerationJob</span>
                    <h2>No hay trabajos para mostrar</h2>
                    <p>Prueba con otros filtros o inicia una generación.</p>
                  </div>
                )}
              </section>
            </>
          )}
          {selected && (
            <CatalogPreview
              className="inspector catalog-detail catalog-detail--content"
              title="Vista previa del contenido"
              subtitle="Archivo generado, trazabilidad y datos de producción"
              eyebrow="Contenido seleccionado"
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
                  <header>
                    <h2>
                      {selectedJob?.project_name || "Trabajo de generación"}
                    </h2>
                    <StatusPill status={selectedJob?.status} />
                  </header>

                  <section className="panel">
                    <span>GenerationJob</span>
                    <strong>
                      {selectedJob?.model_name || "Modelo no registrado"}
                    </strong>
                    <small>
                      {selectedJob?.provider || "Proveedor no registrado"}
                    </small>
                  </section>

                  <section className="inspector-section">
                    <h3>Producción</h3>

                    <Row
                      label="Estado"
                      value={jobLabels[selectedJob?.status]}
                    />
                    <Row
                      label="Propósito"
                      value={selectedJob?.generation_purpose}
                    />
                    <Row
                      label="Outputs solicitados"
                      value={selectedJob?.number_of_outputs}
                    />
                    <Row label="Reintentos" value={selectedJob?.retry_count} />
                    <Row
                      label="Provider request ID"
                      value={selectedJob?.provider_request_id}
                    />
                  </section>

                  <section className="inspector-section">
                    <h3>Costos</h3>
                    <Row
                      label="Estimado USD"
                      value={selectedJob?.estimated_cost_usd}
                    />
                    <Row
                      label="Real USD"
                      value={selectedJob?.actual_cost_usd}
                    />
                  </section>

                  <section className="inspector-section">
                    <h3>Prompt</h3>

                    <div className="code-block">
                      {selectedJob?.prompt || "Sin prompt registrado."}
                    </div>

                    {selectedJob?.negative_prompt && (
                      <>
                        <h3 className="muted">Prompt negativo</h3>
                        <div className="code-block negative">
                          {selectedJob.negative_prompt}
                        </div>
                      </>
                    )}
                  </section>

                  <section className="inspector-section">
                    <h3>Parámetros</h3>
                    <Row label="Datos" value={selectedJob?.parameters} code />
                  </section>

                  <section className="inspector-section">
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
                    <Row label="Error" value={selectedJob?.error_message} />
                  </section>

                  {selectedJob?.project && (
                    <section className="notice info">
                      <span>Proyecto relacionado</span>
                      <Link href={`/projects/${selectedJob.project}`}>
                        Abrir campaña ↗
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
