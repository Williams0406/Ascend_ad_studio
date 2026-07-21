"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";

import Nav from "@/components/Nav";
import { api, ensureWorkspace } from "@/lib/api";

const projectLabels = {
  draft: "Borrador",
  ready: "Listo",
  generating: "Generando",
  completed: "Completado",
  archived: "Archivado",
  cancelled: "Cancelado",
};
const jobLabels = {
  queued: "En cola",
  processing: "Procesando",
  completed: "Completado",
  failed: "Fallido",
  cancelled: "Cancelado",
};
const contentTypes = [
  ["flyer", "Flyer"],
  ["social_post", "Post social"],
  ["story", "Story"],
  ["banner", "Banner"],
  ["carousel", "Carrusel"],
  ["short_video", "Video corto"],
  ["product_video", "Video de producto"],
];
const inputRoles = [
  ["product_image", "Imagen del producto"],
  ["logo", "Logo"],
  ["background", "Fondo"],
  ["style_reference", "Referencia de estilo"],
  ["character_reference", "Referencia de personaje"],
  ["packaging", "Empaque"],
  ["other", "Otro"],
];
const referencePurposes = [["style","Estilo"],["composition","Composición"],["lighting","Iluminación"],["color","Color"],["typography","Tipografía"],["pose","Pose"],["mood","Atmósfera"]];

const list = (response) => response?.results || response || [];
const nullable = (value) => value || null;

function DataItem({ label, value }) {
  return (
    <div className="project-data-item">
      <span>{label}</span>
      <p>{value || "—"}</p>
    </div>
  );
}

function Field({ label, hint, wide = false, children }) {
  return (
    <label className={`project-edit-field${wide ? " wide" : ""}`}>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

function PromptCard({ prompt, copied, onCopy }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <section className={`generation-prompt-card${expanded ? " expanded" : ""}`}>
      <header>
        <div>
          <span className="eyebrow">Prompt de producción</span>
          <h2>Instrucción enviada a la API</h2>
          <p>
            Integra el brief, producto, identidad, reglas y referencias del
            proyecto.
          </p>
        </div>
        <button type="button" className="btn secondary" onClick={onCopy}>
          {copied ? "Copiado ✓" : "Copiar prompt"}
        </button>
      </header>
      <div className="generation-prompt-content">
        <pre>{prompt}</pre>
      </div>
      <footer>
        <button
          type="button"
          className="prompt-expand"
          onClick={() => setExpanded((current) => !current)}
          aria-expanded={expanded}
        >
          {expanded ? "Mostrar menos ↑" : "Mostrar más ↓"}
        </button>
      </footer>
    </section>
  );
}

function ResourceManager({ project, assets, busy, onAdd, onRemove }) {
  const [open, setOpen] = useState(false);
  const [assetId, setAssetId] = useState("");
  const [role, setRole] = useState("other");
  const selected = assets.find((asset) => asset.id === assetId);

  function submit(event) {
    event.preventDefault();
    if (!assetId) return;
    onAdd({
      brand_asset: assetId,
      input_role: role,
      sort_order: project.input_assets?.length || 0,
    })
      .then(() => {
        setAssetId("");
        setRole("other");
        setOpen(false);
      })
      .catch(() => {});
  }

  return (
    <section className="project-resources-manager">
      <header>
        <div>
          <span className="eyebrow">Mesa de referencias</span>
          <h2>Recursos del proyecto</h2>
          <p>
            Define qué imágenes debe interpretar el modelo y la función de cada
            una.
          </p>
        </div>
        <button
          type="button"
          className="btn"
          onClick={() => setOpen((current) => !current)}
        >
          {open ? "Cerrar" : "+ Agregar recurso"}
        </button>
      </header>
      {open && (
        <form className="resource-add-panel" onSubmit={submit}>
          <label>
            <span>Recurso de Brand Kit</span>
            <select
              className="input"
              required
              value={assetId}
              onChange={(event) => setAssetId(event.target.value)}
            >
              <option value="">Selecciona una imagen</option>
              {assets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.name} · {asset.category}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Función en el prompt</span>
            <select
              className="input"
              value={role}
              onChange={(event) => setRole(event.target.value)}
            >
              {inputRoles.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <div className="resource-add-preview">
            {selected?.file_url ? (
              <img src={selected.file_url} alt="" />
            ) : (
              <span>Vista previa</span>
            )}
            <small>
              {selected?.name || "Elige un recurso de tu biblioteca"}
            </small>
          </div>
          <button className="btn" disabled={busy || !assetId}>
            {busy ? "Agregando…" : "Agregar al proyecto"}
          </button>
        </form>
      )}
      <div className="project-input-gallery">
        {(project.input_assets || []).map((item) => (
          <article key={item.id}>
            <div className="project-input-visual">
              {item.brand_asset_url ? (
                <img src={item.brand_asset_url} alt={item.brand_asset_name} />
              ) : (
                <div />
              )}
              <button
                type="button"
                className="project-input-remove"
                onClick={() => onRemove(item)}
                disabled={busy}
                aria-label={`Eliminar ${item.brand_asset_name}`}
                title="Eliminar recurso"
              >
                ×
              </button>
            </div>
            <div>
              <span>{item.input_role.replaceAll("_", " ")}</span>
              <h3>{item.brand_asset_name}</h3>
              <p>
                {item.brand_asset_category} · Orden {item.sort_order}
              </p>
            </div>
          </article>
        ))}
        {!project.input_assets?.length && (
          <div className="empty">
            <h3>Aún no hay recursos</h3>
            <p>
              Agrega logos, producto o referencias para enriquecer el prompt.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function ImageLightbox({ asset, onClose }) {
  const [zoom, setZoom] = useState(100);

  useEffect(() => {
    const closeOnEscape = (event) => event.key === "Escape" && onClose();
    document.body.classList.add("lightbox-open");
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.classList.remove("lightbox-open");
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  async function download() {
    const url = asset.file_url || asset.file;
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("download");
      const blobUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `ascend-${asset.id}.${asset.mime_type?.split("/")[1] || "png"}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }

  return createPortal(
    <div
      className="image-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="Vista ampliada del resultado"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="image-lightbox-stage">
        <img
          className={`zoom-${zoom}`}
          src={asset.file_url || asset.file}
          alt="Resultado generado ampliado"
        />
      </div>
      <div className="image-lightbox-controls">
        <button type="button" onClick={() => setZoom((value) => Math.max(100, value - 10))} disabled={zoom === 100} aria-label="Alejar 10%">−</button>
        <button type="button" onClick={() => setZoom(100)} aria-label="Restablecer zoom">{zoom}%</button>
        <button type="button" onClick={() => setZoom((value) => Math.min(300, value + 10))} disabled={zoom === 300} aria-label="Acercar 10%">+</button>
        <button type="button" onClick={download} aria-label="Descargar imagen">↓</button>
        <button type="button" onClick={onClose} aria-label="Cerrar visor">×</button>
      </div>
    </div>,
    document.body,
  );
}

function ReferencesManager({ project, references, busy, onAdd, onRemove }) {
  const [open,setOpen]=useState(false),[referenceId,setReferenceId]=useState(""),[purpose,setPurpose]=useState("style"),[weight,setWeight]=useState(100);
  const selected=references.find(item=>String(item.id)===String(referenceId));
  function submit(event){event.preventDefault();if(!referenceId)return;onAdd({reference:referenceId,purpose,weight:Number(weight)}).then(()=>{setOpen(false);setReferenceId("");setPurpose("style");setWeight(100)}).catch(()=>{})}
  return <section className="project-resources-manager project-references-manager"><header><div><span className="eyebrow">Dirección visual</span><h2>Referencias creativas</h2><p>Controla qué debe aprender el modelo de cada imagen y con qué intensidad.</p></div><button className="btn" onClick={()=>setOpen(value=>!value)}>{open?'Cerrar':'+ Agregar referencia'}</button></header>{open&&<form className="reference-assignment-panel" onSubmit={submit}><label><span>Referencia</span><select className="input" required value={referenceId} onChange={e=>setReferenceId(e.target.value)}><option value="">Selecciona una imagen</option>{references.map(item=><option key={item.id} value={item.id}>{item.title}</option>)}</select></label><label><span>Propósito</span><select className="input" value={purpose} onChange={e=>setPurpose(e.target.value)}>{referencePurposes.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label><span>Peso · {weight}%</span><input type="range" min="1" max="100" value={weight} onChange={e=>setWeight(e.target.value)}/></label><div className="resource-add-preview">{selected?.image_url?<img src={selected.image_url} alt=""/>:<span>Vista previa</span>}<small>{selected?.title||'Referencia seleccionada'}</small></div><button className="btn" disabled={busy||!referenceId}>{busy?'Agregando…':'Agregar al proyecto'}</button></form>}<div className="project-reference-grid">{(project.references||[]).map(item=><article key={item.id}><div><img src={item.reference_image_url} alt={item.reference_title}/><button onClick={()=>onRemove(item)} disabled={busy} aria-label={`Eliminar ${item.reference_title}`}>×</button><b>{item.weight}%</b></div><section><span>{referencePurposes.find(([value])=>value===item.purpose)?.[1]||item.purpose}</span><h3>{item.reference_title}</h3><p>{item.reference_source||'Referencia curada'}</p></section></article>)}{!project.references?.length&&<div className="empty"><h3>Sin referencias asignadas</h3><p>Agrega imágenes para dirigir estilo, luz, color o composición.</p></div>}</div></section>;
}

function ProjectEditor({ project, options, saving, onCancel, onSave }) {
  const [form, setForm] = useState(() => ({
    name: project.name || "",
    content_type: project.content_type || "social_post",
    product: project.product || "",
    template: project.template || "",
    recipe: project.recipe || "",
    creative_angle: project.creative_angle || "",
    message_type: project.message_type || "",
    campaign_theme: project.campaign_theme || "",
    headline: project.headline || "",
    offer_text: project.offer_text || "",
    call_to_action: project.call_to_action || "",
    target_audience: project.target_audience || "",
    focus_tags: (project.focus_tags || []).join(", "),
    aspect_ratio: project.aspect_ratio || "4:5",
    resolution: project.resolution || "1K",
    quality_mode: project.quality_mode || "standard",
    requested_variations: project.requested_variations || 1,
    use_brand_kit: project.use_brand_kit,
  }));
  const update = (field, value) =>
    setForm((current) => ({ ...current, [field]: value }));

  function submit(event) {
    event.preventDefault();
    onSave({
      ...form,
      product: nullable(form.product),
      template: nullable(form.template),
      recipe: nullable(form.recipe),
      creative_angle: nullable(form.creative_angle),
      requested_variations: Number(form.requested_variations),
      focus_tags: form.focus_tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    });
  }

  return (
    <form className="project-edit-panel" onSubmit={submit}>
      <header>
        <div>
          <span className="eyebrow">Edición del brief</span>
          <h2>Ajusta la dirección del proyecto</h2>
        </div>
        <p>
          Los cambios actualizan el prompt antes de la siguiente generación. El
          historial anterior permanece intacto.
        </p>
      </header>
      <div className="project-edit-grid">
        <Field label="Nombre del proyecto" wide>
          <input
            className="input"
            required
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
          />
        </Field>
        <Field label="Tipo de contenido">
          <select
            className="input"
            value={form.content_type}
            onChange={(e) => update("content_type", e.target.value)}
          >
            {contentTypes.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Producto">
          <select
            className="input"
            value={form.product}
            onChange={(e) => update("product", e.target.value)}
          >
            <option value="">Sin producto</option>
            {options.products.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Receta creativa">
          <select
            className="input"
            value={form.recipe}
            onChange={(e) => update("recipe", e.target.value)}
          >
            <option value="">Dirección libre</option>
            {options.recipes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Plantilla">
          <select
            className="input"
            value={form.template}
            onChange={(e) => update("template", e.target.value)}
          >
            <option value="">Composición libre</option>
            {options.templates.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Ángulo creativo">
          <select
            className="input"
            value={form.creative_angle}
            onChange={(e) => update("creative_angle", e.target.value)}
          >
            <option value="">Sin ángulo</option>
            {options.angles.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tipo de mensaje">
          <input
            className="input"
            value={form.message_type}
            onChange={(e) => update("message_type", e.target.value)}
          />
        </Field>
        <Field label="Tema de campaña" wide>
          <input
            className="input"
            value={form.campaign_theme}
            onChange={(e) => update("campaign_theme", e.target.value)}
          />
        </Field>
        <Field label="Titular" wide>
          <textarea
            className="input"
            value={form.headline}
            onChange={(e) => update("headline", e.target.value)}
          />
        </Field>
        <Field label="Oferta o mensaje" wide>
          <textarea
            className="input"
            value={form.offer_text}
            onChange={(e) => update("offer_text", e.target.value)}
          />
        </Field>
        <Field label="Llamada a la acción">
          <input
            className="input"
            value={form.call_to_action}
            onChange={(e) => update("call_to_action", e.target.value)}
          />
        </Field>
        <Field label="Audiencia" wide>
          <textarea
            className="input"
            value={form.target_audience}
            onChange={(e) => update("target_audience", e.target.value)}
          />
        </Field>
        <Field label="Etiquetas" hint="Sepáralas con comas" wide>
          <input
            className="input"
            value={form.focus_tags}
            onChange={(e) => update("focus_tags", e.target.value)}
          />
        </Field>
        <Field label="Proporción">
          <select
            className="input"
            value={form.aspect_ratio}
            onChange={(e) => update("aspect_ratio", e.target.value)}
          >
            {["1:1", "4:5", "9:16", "16:9"].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </Field>
        <Field label="Resolución">
          <select
            className="input"
            value={form.resolution}
            onChange={(e) => update("resolution", e.target.value)}
          >
            {["1K", "2K", "4K"].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </Field>
        <Field label="Calidad">
          <select
            className="input"
            value={form.quality_mode}
            onChange={(e) => update("quality_mode", e.target.value)}
          >
            {[
              ["draft", "Borrador"],
              ["standard", "Estándar"],
              ["high", "Alta"],
              ["premium", "Premium"],
            ].map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Variaciones">
          <input
            className="input"
            type="number"
            min="1"
            max="6"
            value={form.requested_variations}
            onChange={(e) => update("requested_variations", e.target.value)}
          />
        </Field>
        <label className="project-edit-toggle">
          <span>
            <b>Aplicar Brand Kit</b>
            <small>Usar identidad y reglas de marca.</small>
          </span>
          <input
            type="checkbox"
            checked={form.use_brand_kit}
            onChange={(e) => update("use_brand_kit", e.target.checked)}
          />
        </label>
      </div>
      <footer>
        <button
          type="button"
          className="btn secondary"
          onClick={onCancel}
          disabled={saving}
        >
          Cancelar
        </button>
        <button className="btn" disabled={saving}>
          {saving ? "Guardando…" : "Guardar cambios"}
        </button>
      </footer>
    </form>
  );
}

export default function ProjectDetail({ params }) {
  const { id } = use(params);
  const [project, setProject] = useState(null);
  const [credits, setCredits] = useState(null);
  const [connections, setConnections] = useState([]);
  const [options, setOptions] = useState({
    products: [],
    recipes: [],
    templates: [],
    angles: [],
    assets: [],
    references: [],
  });
  const [provider, setProvider] = useState("auto");
  const [modelCode, setModelCode] = useState("");
  const [availableModels, setAvailableModels] = useState([]);
  const [tab, setTab] = useState("brief");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resourceBusy, setResourceBusy] = useState(false);
  const [referenceBusy, setReferenceBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedResult, setSelectedResult] = useState(null);

  async function load() {
    await ensureWorkspace();
    const [
      projectData,
      balance,
      providers,
      products,
      recipes,
      templates,
      angles,
      assets,
      creativeReferences,
    ] = await Promise.all([
      api(`/studio/projects/${id}/`),
      api("/billing/credits/"),
      api("/integrations/providers/").catch(() => []),
      api("/studio/products/"),
      api("/studio/recipes/"),
      api("/studio/ad-templates/"),
      api("/studio/creative-angles/"),
      api("/studio/brand-assets/"),
      api("/studio/creative-references/"),
    ]);
    setProject(projectData);
    setCredits(balance);
    setOptions({
      products: list(products),
      recipes: list(recipes),
      templates: list(templates),
      angles: list(angles),
      assets: list(assets),
      references: list(creativeReferences),
    });
    const active = list(providers).filter((item) => item.status === "active");
    setConnections(active);
    const preferred = active.find((item) => item.is_default) || active[0];
    if (preferred) {
      setProvider(preferred.provider);
      const response = await api(
        `/integrations/providers/${preferred.id}/models/`,
      );
      const providerModels = response.items || [];
      setAvailableModels(providerModels);
      setModelCode((current) =>
        providerModels.some((item) => item.code === current)
          ? current
          : providerModels[0]?.code || "",
      );
    }
  }

  useEffect(() => {
    load().catch((requestError) => setError(requestError.message));
  }, [id]);

  const generated = useMemo(
    () =>
      project?.jobs?.flatMap((job) =>
        (job.assets || []).map((asset) => ({ ...asset, job })),
      ) || [],
    [project],
  );
  const cost = (project?.requested_variations || 1) * 10;

  async function saveProject(payload) {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const updated = await api(`/studio/projects/${id}/`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      setProject(updated);
      setTab("brief");
      setNotice("Proyecto actualizado. El prompt ya refleja los cambios.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function generate() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api(`/studio/projects/${id}/generate/`, {
        method: "POST",
        body: JSON.stringify({
          number_of_outputs: project.requested_variations || 1,
          provider,
          model_code: modelCode,
        }),
      });
      await load();
      setTab("results");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function copyPrompt() {
    await navigator.clipboard.writeText(project.generation_prompt || "");
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function addResource(payload) {
    setResourceBusy(true);
    setError("");
    setNotice("");
    try {
      await api(`/studio/projects/${id}/input-assets/`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      await load();
      setNotice("Recurso agregado. El prompt ya incorpora esta referencia.");
    } catch (requestError) {
      setError(requestError.message);
      throw requestError;
    } finally {
      setResourceBusy(false);
    }
  }

  async function removeResource(item) {
    if (
      !window.confirm(`¿Eliminar “${item.brand_asset_name}” de este proyecto?`)
    )
      return;
    setResourceBusy(true);
    setError("");
    setNotice("");
    try {
      await api(`/studio/projects/${id}/input-assets/${item.id}/`, {
        method: "DELETE",
      });
      await load();
      setNotice("Recurso eliminado del proyecto.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setResourceBusy(false);
    }
  }

  async function addReference(payload){setReferenceBusy(true);setError("");setNotice("");try{await api(`/studio/projects/${id}/references/`,{method:"POST",body:JSON.stringify(payload)});await load();setNotice("Referencia agregada. El prompt y el contexto visual ya fueron actualizados.")}catch(requestError){setError(requestError.message);throw requestError}finally{setReferenceBusy(false)}}
  async function removeReference(item){if(!window.confirm(`¿Quitar “${item.reference_title}” de este proyecto?`))return;setReferenceBusy(true);setError("");try{await api(`/studio/projects/${id}/references/${item.id}/`,{method:"DELETE"});await load();setNotice("Referencia eliminada del proyecto.")}catch(requestError){setError(requestError.message)}finally{setReferenceBusy(false)}}

  async function selectProvider(nextProvider) {
    setProvider(nextProvider);
    setError("");
    const connection = connections.find(
      (item) => item.provider === nextProvider,
    );
    if (!connection) {
      setAvailableModels([]);
      setModelCode("");
      return;
    }
    try {
      const response = await api(
        `/integrations/providers/${connection.id}/models/`,
      );
      const providerModels = response.items || [];
      setAvailableModels(providerModels);
      setModelCode(providerModels[0]?.code || "");
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  if (!project)
    return (
      <>
        <Nav privateNav />
        <main className="container">
          {error ? <div className="error">{error}</div> : "Cargando proyecto…"}
        </main>
      </>
    );

  return (
    <>
      <Nav privateNav />
      <main className="container project-detail-page">
        <header className="project-detail-head">
          <div>
            <Link href="/projects">← Proyectos</Link>
            <div>
              <span className={`project-state ${project.status}`}>
                {projectLabels[project.status]}
              </span>
              <small>
                {project.content_type} · {project.aspect_ratio} ·{" "}
                {project.resolution}
              </small>
            </div>
            <h1>{project.name}</h1>
            <p>
              {project.campaign_theme || project.headline || "Brief creativo"}
            </p>
          </div>
          <div className="project-detail-actions">
            <button className="btn secondary" onClick={() => setTab("edit")}>
              Editar proyecto
            </button>
            <button
              className="btn"
              disabled={
                busy ||
                !connections.length ||
                (credits?.available_credits ?? 0) < cost
              }
              onClick={generate}
            >
              {busy
                ? "Generando…"
                : `Generar ${project.requested_variations} variantes`}
            </button>
            <small>{cost} créditos estimados</small>
          </div>
        </header>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        {notice && (
          <div className="project-success" role="status">
            {notice}
          </div>
        )}
        <section className="project-detail-summary">
          <div>
            <span>Producto</span>
            <strong>{project.product_name || "Sin producto"}</strong>
          </div>
          <div>
            <span>Receta</span>
            <strong>{project.recipe_name || "Dirección libre"}</strong>
          </div>
          <div>
            <span>Recursos</span>
            <strong>{project.input_assets?.length || 0}</strong>
          </div>
          <div>
            <span>Generaciones</span>
            <strong>{project.jobs?.length || 0}</strong>
          </div>
          <div>
            <span>Resultados</span>
            <strong>{generated.length}</strong>
          </div>
        </section>
        {connections.length > 0 && (
          <section className="generation-control">
            <div>
              <span>Proveedor de generación</span>
              <p>Solo aparecen modelos de imagen accesibles con tu API key.</p>
            </div>
            <select
              value={provider}
              onChange={(e) => selectProvider(e.target.value)}
            >
              {connections.map((item) => (
                <option key={item.id} value={item.provider}>
                  {item.provider === "gemini" ? "Gemini" : "fal.ai"} · ••••
                  {item.api_key_last_four}
                </option>
              ))}
            </select>
            <select
              value={modelCode}
              onChange={(e) => setModelCode(e.target.value)}
              disabled={!availableModels.length}
            >
              {availableModels.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.label}
                </option>
              ))}
            </select>
          </section>
        )}
        <nav className="project-detail-tabs">
          {[
            ["brief", "Brief"],
            ["edit", "Editar"],
            ["inputs", `Recursos (${project.input_assets?.length || 0})`],
            ["references", `Referencias (${project.references?.length || 0})`],
            ["results", `Resultados (${generated.length})`],
            ["jobs", `Generaciones (${project.jobs?.length || 0})`],
          ].map(([key, label]) => (
            <button
              key={key}
              className={tab === key ? "active" : ""}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </nav>
        {tab === "edit" && (
          <ProjectEditor
            key={project.updated_at}
            project={project}
            options={options}
            saving={saving}
            onCancel={() => setTab("brief")}
            onSave={saveProject}
          />
        )}
        {tab === "brief" && (
          <section className="project-brief-grid">
            <div className="project-brief-main">
              <div className="project-detail-card wide">
                <span>Mensaje de campaña</span>
                <h2>{project.headline || "Sin titular"}</h2>
                <p className="offer-line">
                  {project.offer_text || "Sin oferta definida"}
                </p>
                <div className="brief-data-grid">
                  <DataItem label="CTA" value={project.call_to_action} />
                  <DataItem label="Audiencia" value={project.target_audience} />
                  <DataItem
                    label="Tipo de mensaje"
                    value={project.message_type}
                  />
                  <DataItem label="Tema" value={project.campaign_theme} />
                </div>
                {project.focus_tags?.length > 0 && (
                  <div className="focus-tag-list">
                    {project.focus_tags.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                )}
              </div>
              <PromptCard
                prompt={project.generation_prompt}
                copied={copied}
                onCopy={copyPrompt}
              />
            </div>
            <div className="project-detail-card project-config-card">
              <span>Configuración</span>
              <DataItem
                label="Tipo de contenido"
                value={project.content_type}
              />
              <DataItem label="Plantilla" value={project.template_name} />
              <DataItem label="Ángulo" value={project.creative_angle_name} />
              <DataItem label="Aspect ratio" value={project.aspect_ratio} />
              <DataItem label="Resolución" value={project.resolution} />
              <DataItem label="Calidad" value={project.quality_mode} />
              <DataItem
                label="Variaciones"
                value={project.requested_variations}
              />
              <DataItem
                label="Usa Brand Kit"
                value={project.use_brand_kit ? "Sí" : "No"}
              />
            </div>
          </section>
        )}
        {tab === "inputs" && (
          <ResourceManager
            project={project}
            assets={options.assets}
            busy={resourceBusy}
            onAdd={addResource}
            onRemove={removeResource}
          />
        )}
        {tab === "references" && (
          <ReferencesManager project={project} references={options.references} busy={referenceBusy} onAdd={addReference} onRemove={removeReference}/>
        )}
        {tab === "results" && (
          <section className="project-results-grid">
            {generated.map((item) => (
              <article key={item.id}>
                <button
                  type="button"
                  className="result-preview-button"
                  onClick={() => setSelectedResult(item)}
                  aria-label="Ampliar resultado"
                >
                  {item.file_url ? (
                    <img src={item.file_url} alt="Resultado generado" />
                  ) : (
                    <div />
                  )}
                </button>
                <div>
                  <span>{item.asset_type}</span>
                  <h3>
                    {item.metadata?.variation
                      ? `Variación ${item.metadata.variation}`
                      : "Resultado generado"}
                  </h3>
                  <p>
                    {item.width && item.height
                      ? `${item.width} × ${item.height}`
                      : "Dimensiones no registradas"}{" "}
                    · {new Date(item.created_at).toLocaleDateString()}
                  </p>
                  <div className="result-model">
                    <small>Modelo utilizado</small>
                    <strong>
                      {item.job?.model_name ||
                        item.metadata?.model ||
                        "No registrado"}
                    </strong>
                  </div>
                </div>
              </article>
            ))}
            {!generated.length && (
              <div className="empty">
                <h3>Aún no hay resultados</h3>
                <p>Selecciona un proveedor y genera las primeras variantes.</p>
              </div>
            )}
          </section>
        )}
        {tab === "jobs" && (
          <section className="project-job-list">
            {(project.jobs || []).map((job) => (
              <article key={job.id}>
                <div className="job-timeline-mark" />
                <div>
                  <div className="job-head">
                    <span className={job.status}>{jobLabels[job.status]}</span>
                    <time>{new Date(job.created_at).toLocaleString()}</time>
                  </div>
                  <h3>
                    {job.provider} · {job.model_name}
                  </h3>
                  <p>{job.prompt}</p>
                  <dl>
                    <div>
                      <dt>Outputs</dt>
                      <dd>{job.number_of_outputs}</dd>
                    </div>
                    <div>
                      <dt>Reintentos</dt>
                      <dd>{job.retry_count}</dd>
                    </div>
                    <div>
                      <dt>Créditos</dt>
                      <dd>{job.credits_consumed}</dd>
                    </div>
                    <div>
                      <dt>Propósito</dt>
                      <dd>{job.generation_purpose || "—"}</dd>
                    </div>
                  </dl>
                  {job.error_message && (
                    <div className="error">{job.error_message}</div>
                  )}
                </div>
              </article>
            ))}
            {!project.jobs?.length && (
              <div className="empty">
                Todavía no existe historial de GenerationJob.
              </div>
            )}
          </section>
        )}
        {selectedResult && (
          <ImageLightbox
            asset={selectedResult}
            onClose={() => setSelectedResult(null)}
          />
        )}
      </main>
    </>
  );
}
