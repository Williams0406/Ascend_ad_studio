"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";

import Nav from "@/components/Nav";
import PageTitle from "@/components/PageTitle";
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
  ["background", "Fondo"],
  ["lifestyle_reference", "Lifestyle"],
  ["character_reference", "Personaje"],
  ["packaging", "Empaque"],
  ["icon", "Icono"],
  ["logo", "Logo"],
  ["template", "Plantilla"],
  ["reference_ad", "Referencia publicitaria"],
];
const purposeByRole = {
  background: [["background", "Background"]],
  lifestyle_reference: [["lifestyle", "Lifestyle"]],
  character_reference: [
    ["persona", "Persona"],
    ["mood", "Mood"],
    ["pose", "Pose"],
  ],
  packaging: [["packaging", "Packaging"]],
  template: [["template", "Template"]],
  reference_ad: [
    ["style", "Style"],
    ["composition", "Composition"],
    ["lighting", "Lighting"],
    ["color", "Color"],
    ["typography", "Typography"],
  ],
  logo: [["logo", "Logo"]],
  icon: [["icon", "Icon"]],
  product_image: [],
};
const multiInputRoles = new Set([
  "product_image",
  "character_reference",
  "reference_ad",
]);
const defaultPurposes = (role) =>
  ({
    background: ["background"],
    lifestyle_reference: ["lifestyle"],
    packaging: ["packaging"],
    icon: ["icon"],
    logo: ["logo"],
    template: ["template"],
  })[role] || [];
const purposesForRole = (role, useBrandKit = true) => {
  const base = purposeByRole[role] || [];
  if (role === "reference_ad" && !useBrandKit) {
    return [...base, ["color", "Color"], ["typography", "Typography"]];
  }
  return base;
};
const roleCategory = {
  product_image: "product",
  background: "background",
  lifestyle_reference: "lifestyle",
  character_reference: "persona",
  packaging: "packaging",
  icon: "icon",
  logo: "logo",
  template: "template",
  reference_ad: "reference_ad",
};

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
    <section
      className={`panel prompt-panel project-prompt-panel${expanded ? " expanded" : ""}`}
    >
      <header>
        <div>
          <span className="eyebrow">Prompt de producción</span>
          <h2>Instrucción enviada a la API</h2>
          <p>
            Integra el brief, producto, identidad, reglas y referencias del
            proyecto.
          </p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={onCopy}>
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
  const [role, setRole] = useState("reference_ad");
  const [purpose, setPurpose] = useState([]);
  const selected = assets.find((asset) => asset.id === assetId);
  const filteredAssets = assets.filter(
    (asset) => asset.category === roleCategory[role],
  );

  function submit(event) {
    event.preventDefault();
    if (!assetId) return;
    onAdd({
      brand_asset: assetId,
      input_role: role,
      purpose,
      sort_order: project.input_assets?.length || 0,
    })
      .then(() => {
        setAssetId("");
        setRole("reference_ad");
        setPurpose([]);
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
        <form className="form panel" onSubmit={submit}>
          <label>
            <span>Recurso de Brand Kit</span>
            <select
              className="input"
              required
              value={assetId}
              onChange={(event) => setAssetId(event.target.value)}
            >
              <option value="">Selecciona una imagen</option>
              {filteredAssets.map((asset) => (
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
          <div className="badges">
            {(purposeByRole[role] || []).map(([value, label]) => (
              <button
                type="button"
                key={value}
                className={purpose.includes(value) ? "active" : ""}
                onClick={() =>
                  setPurpose((current) =>
                    current.includes(value)
                      ? current.filter((item) => item !== value)
                      : [...current, value],
                  )
                }
              >
                {label}
              </button>
            ))}
          </div>
          <div className="inspector-media">
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
      {inputRoles.map(([roleKey, roleLabel]) => {
        if (roleKey === "template" && project.template) return null;
        const roleItems = (project.input_assets || []).filter(
          (item) => item.input_role === roleKey,
        );
        return (
          <section className="panel resource-section" key={roleKey}>
            <header>
              <h3>{roleLabel}</h3>
              <span>{roleItems.length}</span>
            </header>
            <div className="asset-list">
              {roleItems.map((item) => (
                <article key={item.id}>
                  <div className="thumb">
                    {item.brand_asset_url ? (
                      <img
                        src={item.brand_asset_url}
                        alt={item.brand_asset_name}
                      />
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
                    <div className="badges compact">
                      {(purposeByRole[item.input_role] || []).map(
                        ([value, label]) => (
                          <small
                            key={value}
                            className={
                              (item.purpose_codes || []).includes(value)
                                ? "active"
                                : ""
                            }
                          >
                            {label}
                          </small>
                        ),
                      )}
                    </div>
                  </div>
                </article>
              ))}
              {!roleItems.length && (
                <div className="empty-state">
                  <h3>Sin recursos</h3>
                  <p>Agrega imágenes compatibles para este rol.</p>
                </div>
              )}
            </div>
          </section>
        );
      })}
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
        <button
          type="button"
          onClick={() => setZoom((value) => Math.max(100, value - 10))}
          disabled={zoom === 100}
          aria-label="Alejar 10%"
        >
          −
        </button>
        <button
          type="button"
          onClick={() => setZoom(100)}
          aria-label="Restablecer zoom"
        >
          {zoom}%
        </button>
        <button
          type="button"
          onClick={() => setZoom((value) => Math.min(300, value + 10))}
          disabled={zoom === 300}
          aria-label="Acercar 10%"
        >
          +
        </button>
        <button type="button" onClick={download} aria-label="Descargar imagen">
          ↓
        </button>
        <button type="button" onClick={onClose} aria-label="Cerrar visor">
          ×
        </button>
      </div>
    </div>,
    document.body,
  );
}

function ReferencesManager({ project, references, busy, onAdd, onRemove }) {
  const [open, setOpen] = useState(false),
    [referenceId, setReferenceId] = useState(""),
    [inputRole, setInputRole] = useState("reference_ad"),
    [purpose, setPurpose] = useState(["style"]),
    [weight, setWeight] = useState(100);
  const selected = references.find(
    (item) => String(item.id) === String(referenceId),
  );
  const filteredReferences = references.filter(
    (item) => item.category === roleCategory[inputRole],
  );
  function submit(event) {
    event.preventDefault();
    if (!referenceId) return;
    onAdd({
      reference: referenceId,
      input_role: inputRole,
      purpose,
      weight: Number(weight),
    })
      .then(() => {
        setOpen(false);
        setReferenceId("");
        setPurpose(["style"]);
        setWeight(100);
      })
      .catch(() => {});
  }
  return (
    <section className="project-resources-manager workbench-resource">
      <header>
        <div>
          <span className="eyebrow">CreativeReference</span>
          <h2>Referencias dentro de Recursos</h2>
          <p>Asigna CreativeReference al mismo mapa de roles y purposes.</p>
        </div>
        <button className="btn" onClick={() => setOpen((value) => !value)}>
          {open ? "Cerrar" : "+ Agregar CreativeReference"}
        </button>
      </header>
      {open && (
        <form className="reference-assignment-panel" onSubmit={submit}>
          <label>
            <span>Rol</span>
            <select
              className="input"
              value={inputRole}
              onChange={(e) => {
                setInputRole(e.target.value);
                setReferenceId("");
                setPurpose([]);
              }}
            >
              {inputRoles
                .filter(
                  ([value]) =>
                    value !== "product_image" &&
                    !(value === "template" && project.template),
                )
                .map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
            </select>
          </label>
          <label>
            <span>Referencia</span>
            <select
              className="input"
              required
              value={referenceId}
              onChange={(e) => setReferenceId(e.target.value)}
            >
              <option value="">Selecciona una imagen</option>
              {filteredReferences.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </label>
          <div className="badges">
            {(purposeByRole[inputRole] || []).map(([value, label]) => (
              <button
                type="button"
                key={value}
                className={purpose.includes(value) ? "active" : ""}
                onClick={() =>
                  setPurpose((current) =>
                    current.includes(value)
                      ? current.filter((item) => item !== value)
                      : [...current, value],
                  )
                }
              >
                {label}
              </button>
            ))}
          </div>
          <label>
            <span>Peso · {weight}%</span>
            <input
              type="range"
              min="1"
              max="100"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
            />
          </label>
          <div className="inspector-media">
            {selected?.image_url ? (
              <img src={selected.image_url} alt="" />
            ) : (
              <span>Vista previa</span>
            )}
            <small>{selected?.title || "Referencia seleccionada"}</small>
          </div>
          <button className="btn" disabled={busy || !referenceId}>
            {busy ? "Agregando…" : "Agregar referencia"}
          </button>
        </form>
      )}
      {inputRoles.map(([roleKey, roleLabel]) => {
        if (
          roleKey === "product_image" ||
          (roleKey === "template" && project.template)
        )
          return null;
        const items = (project.references || []).filter(
          (item) => item.input_role === roleKey,
        );
        return (
          <section className="panel resource-section" key={roleKey}>
            <header>
              <h3>{roleLabel}</h3>
              <span>{items.length}</span>
            </header>
            <div className="asset-list">
              {items.map((item) => (
                <article key={item.id}>
                  <div>
                    <img
                      src={item.reference_image_url}
                      alt={item.reference_title}
                    />
                    <button
                      onClick={() => onRemove(item)}
                      disabled={busy}
                      aria-label={`Eliminar ${item.reference_title}`}
                    >
                      ×
                    </button>
                    <b>{item.weight}%</b>
                  </div>
                  <section>
                    <span>{roleLabel}</span>
                    <h3>{item.reference_title}</h3>
                    <p>{item.reference_source || "Referencia curada"}</p>
                    <div className="badges compact">
                      {(purposeByRole[item.input_role] || []).map(
                        ([value, label]) => (
                          <small
                            key={value}
                            className={
                              (item.purpose_codes || []).includes(value)
                                ? "active"
                                : ""
                            }
                          >
                            {label}
                          </small>
                        ),
                      )}
                    </div>
                  </section>
                </article>
              ))}
              {!items.length && (
                <div className="empty-state">
                  <h3>Sin referencias</h3>
                  <p>Agrega CreativeReference compatibles para este rol.</p>
                </div>
              )}
            </div>
          </section>
        );
      })}
    </section>
  );
}

function UnifiedResourceSection({
  project,
  roleKey,
  roleLabel,
  assets,
  references,
  products,
  busy,
  onAddAsset,
  onRemoveAsset,
  onAddReference,
  onRemoveReference,
}) {
  const [sourceType, setSourceType] = useState("brand_asset");
  const [selected, setSelected] = useState(null);
  const category = roleCategory[roleKey];
  const assetItems = (project.input_assets || []).filter(
    (item) => item.input_role === roleKey,
  );
  const referenceItems = (project.references || []).filter(
    (item) => item.input_role === roleKey,
  );
  const assetPool = useMemo(() => {
    if (roleKey === "product_image") {
      const product = products.find(
        (item) => String(item.id) === String(project.product),
      );
      const productAssetIds = new Set(
        [product?.main_image_asset, ...(product?.image_assets || [])]
          .filter(Boolean)
          .map(String),
      );
      if (productAssetIds.size)
        return assets.filter((asset) => productAssetIds.has(String(asset.id)));
    }
    return assets.filter((asset) => asset.category === category);
  }, [assets, category, products, project.product, roleKey]);
  const referencePool = useMemo(
    () =>
      roleKey === "product_image"
        ? []
        : references.filter((reference) => reference.category === category),
    [category, references, roleKey],
  );
  const visiblePool = sourceType === "brand_asset" ? assetPool : referencePool;
  const purposes = selected?.purpose || [];
  const togglePurpose = (value) => {
    if (!selected) return;
    const next = purposes.includes(value)
      ? purposes.filter((item) => item !== value)
      : [...purposes, value];
    setSelected({ ...selected, purpose: next });
  };
  async function pick(item) {
    if (sourceType === "brand_asset") {
      const existing = assetItems.find(
        (entry) => String(entry.brand_asset) === String(item.id),
      );
      if (existing) {
        await onRemoveAsset(existing);
        setSelected(null);
        return;
      }
      await onAddAsset({
        brand_asset: item.id,
        input_role: roleKey,
        purpose: defaultPurposes(roleKey),
        sort_order: multiInputRoles.has(roleKey) ? assetItems.length : 0,
      });
      setSelected({
        title: item.name,
        image: item.file_url,
        type: "BrandAsset",
        purpose: defaultPurposes(roleKey),
      });
    } else {
      const existing = referenceItems.find(
        (entry) => String(entry.reference) === String(item.id),
      );
      if (existing) {
        await onRemoveReference(existing);
        setSelected(null);
        return;
      }
      await onAddReference({
        reference: item.id,
        input_role: roleKey,
        purpose: defaultPurposes(roleKey),
        weight: 100,
      });
      setSelected({
        title: item.title,
        image: item.image_url,
        type: "CreativeReference",
        purpose: defaultPurposes(roleKey),
      });
    }
  }
  return (
    <section className="panel resource-section unified">
      <header>
        <div>
          <h3>{roleLabel}</h3>
          <p>{assetItems.length + referenceItems.length} imágenes asociadas</p>
        </div>
        <div className="tabs">
          <button
            type="button"
            className={sourceType === "brand_asset" ? "active" : ""}
            onClick={() => setSourceType("brand_asset")}
          >
            BrandAsset
          </button>
          <button
            type="button"
            className={sourceType === "creative_reference" ? "active" : ""}
            disabled={roleKey === "product_image"}
            onClick={() => setSourceType("creative_reference")}
          >
            CreativeReference
          </button>
        </div>
      </header>
      <div className="split-layout">
        <div>
          <div className="asset-list compact">
            {visiblePool.map((item) => {
              const image =
                sourceType === "brand_asset" ? item.file_url : item.image_url;
              const title =
                sourceType === "brand_asset" ? item.name : item.title;
              const active =
                sourceType === "brand_asset"
                  ? assetItems.some(
                      (entry) => String(entry.brand_asset) === String(item.id),
                    )
                  : referenceItems.some(
                      (entry) => String(entry.reference) === String(item.id),
                    );
              return (
                <button
                  type="button"
                  key={item.id}
                  className={active ? "active" : ""}
                  onClick={() => pick(item)}
                  disabled={busy}
                >
                  {image ? (
                    <img src={image} alt={title} />
                  ) : (
                    <span>{title?.[0]}</span>
                  )}
                  <small>{title}</small>
                </button>
              );
            })}
            {!visiblePool.length && (
              <div className="empty-state">
                Sin imágenes category={category}
              </div>
            )}
          </div>
          <div className="asset-list">
            {assetItems.map((item) => (
              <article key={item.id}>
                <div className="thumb">
                  {item.brand_asset_url && (
                    <img
                      src={item.brand_asset_url}
                      alt={item.brand_asset_name}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => onRemoveAsset(item)}
                    disabled={busy}
                  >
                    ×
                  </button>
                </div>
                <div>
                  <span>BrandAsset</span>
                  <h3>{item.brand_asset_name}</h3>
                  <div className="badges compact">
                    {(purposeByRole[roleKey] || []).map(([value, label]) => (
                      <small
                        key={value}
                        className={
                          (item.purpose_codes || []).includes(value)
                            ? "active"
                            : ""
                        }
                      >
                        {label}
                      </small>
                    ))}
                  </div>
                </div>
              </article>
            ))}
            {referenceItems.map((item) => (
              <article key={item.id}>
                <div className="thumb">
                  {item.reference_image_url && (
                    <img
                      src={item.reference_image_url}
                      alt={item.reference_title}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => onRemoveReference(item)}
                    disabled={busy}
                  >
                    ×
                  </button>
                </div>
                <div>
                  <span>CreativeReference</span>
                  <h3>{item.reference_title}</h3>
                  <div className="badges compact">
                    {(purposeByRole[roleKey] || []).map(([value, label]) => (
                      <small
                        key={value}
                        className={
                          (item.purpose_codes || []).includes(value)
                            ? "active"
                            : ""
                        }
                      >
                        {label}
                      </small>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
        <aside className="inspector">
          {selected ? (
            <>
              {selected.image && (
                <img src={selected.image} alt={selected.title} />
              )}
              <strong>{selected.title}</strong>
              <span>{selected.type}</span>
              <div className="badges">
                {purposesForRole(roleKey, project.use_brand_kit).map(
                  ([value, label]) => (
                    <button
                      type="button"
                      key={value}
                      className={purposes.includes(value) ? "active" : ""}
                      onClick={() => togglePurpose(value)}
                    >
                      {label}
                    </button>
                  ),
                )}
              </div>
            </>
          ) : (
            <p>Selecciona una imagen para revisar o asociar Purpose.</p>
          )}
        </aside>
      </div>
    </section>
  );
}

function UnifiedResourcesManager({
  project,
  options,
  busy,
  onAddAsset,
  onRemoveAsset,
  onAddReference,
  onRemoveReference,
}) {
  return (
    <section className="project-resources-manager unified-resources project-resources-workspace">
      <header>
        <div>
          <span className="eyebrow">Mesa de dirección</span>
          <h2>Recursos</h2>
          <p>
            Gestiona BrandAsset y CreativeReference por rol, con Purpose
            visibles en el inspector.
          </p>
        </div>
      </header>
      {inputRoles.map(([roleKey, roleLabel]) => {
        if (roleKey === "template" && project.template) return null;
        return (
          <UnifiedResourceSection
            key={roleKey}
            project={project}
            roleKey={roleKey}
            roleLabel={roleLabel}
            assets={options.assets}
            references={options.references}
            products={options.products}
            busy={busy}
            onAddAsset={onAddAsset}
            onRemoveAsset={onRemoveAsset}
            onAddReference={onAddReference}
            onRemoveReference={onRemoveReference}
          />
        );
      })}
    </section>
  );
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
    <form
      className="project-edit-panel project-editor-workspace"
      onSubmit={submit}
    >
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
          className="btn btn-secondary"
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
      providers,
      products,
      recipes,
      templates,
      angles,
      assets,
      creativeReferences,
    ] = await Promise.all([
      api(`/studio/projects/${id}/`),
      api("/integrations/providers/").catch(() => []),
      api("/studio/products/"),
      api("/studio/recipes/"),
      api("/studio/ad-templates/"),
      api("/studio/creative-angles/"),
      api("/studio/brand-assets/"),
      api("/studio/creative-references/"),
    ]);
    setProject(projectData);
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
  const projectTemplate = options.templates.find(
    (item) => String(item.id) === String(project?.template),
  );
  const projectAspectRatio = projectTemplate?.format_specs?.aspect_ratio || "—";

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

  async function addReference(payload) {
    setReferenceBusy(true);
    setError("");
    setNotice("");
    try {
      await api(`/studio/projects/${id}/references/`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      await load();
      setNotice(
        "Referencia agregada. El prompt y el contexto visual ya fueron actualizados.",
      );
    } catch (requestError) {
      setError(requestError.message);
      throw requestError;
    } finally {
      setReferenceBusy(false);
    }
  }
  async function removeReference(item) {
    if (!window.confirm(`¿Quitar “${item.reference_title}” de este proyecto?`))
      return;
    setReferenceBusy(true);
    setError("");
    try {
      await api(`/studio/projects/${id}/references/${item.id}/`, {
        method: "DELETE",
      });
      await load();
      setNotice("Referencia eliminada del proyecto.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setReferenceBusy(false);
    }
  }

  async function addGeneratedToBrandAsset(asset) {
    const name = window.prompt(
      "Nombre para guardar en BrandAsset",
      `Generada · ${project.name}`,
    );
    if (!name) return;
    const category =
      window.prompt(
        "Categoría: product, packaging, lifestyle, logo, persona, reference_ad, template, background o icon",
        "reference_ad",
      ) || "reference_ad";
    setError("");
    setNotice("");
    try {
      await api(`/studio/generated-assets/${asset.id}/add-to-brand-assets/`, {
        method: "POST",
        body: JSON.stringify({ name, category }),
      });
      await load();
      setNotice("Imagen agregada a BrandAsset.");
    } catch (requestError) {
      setError(requestError.message);
    }
  }

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
        <main className="container ascend-view project-detail-loading">
          {error ? <div className="error">{error}</div> : "Cargando proyecto…"}
        </main>
      </>
    );

  return (
    <>
      <Nav privateNav />
      <main className="container ascend-view page page--detail project-detail-page catalog-experience catalog-experience--projects">
        <PageTitle
          className="page-header project-detail-header catalog-page-header--unified"
          eyebrow={<Link href="/projects">← Proyectos</Link>}
          title={project.name}
          description={
            project.campaign_theme || project.headline || "Brief creativo"
          }
          meta={
            <>
              <span className={`badge ${project.status}`}>
                {projectLabels[project.status]}
              </span>
              <small>
                {projectTemplate?.format || "Formato libre"} ·{" "}
                {projectAspectRatio}
              </small>
            </>
          }
          actions={
            <div className="actions project-detail-header__actions">
              <Link
                className="btn btn-secondary project-detail-header__secondary"
                href={`/concept-planner?project=${project.id}`}
              >
                Planificar con IA
              </Link>
              <button
                className="btn btn-secondary project-detail-header__secondary"
                onClick={() => setTab("edit")}
              >
                Editar proyecto
              </button>
              <button
                className="btn btn-primary project-detail-header__primary"
                disabled={busy || !connections.length}
                onClick={generate}
              >
                {busy
                  ? "Generando…"
                  : `Generar ${project.requested_variations} variantes`}
              </button>
              <small>La generación se procesa en segundo plano</small>
            </div>
          }
        />
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        {notice && (
          <div className="notice success" role="status">
            {notice}
          </div>
        )}
        <section className="grid metrics-grid project-detail-metrics">
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
          <section className="panel strong generation-panel project-generation-panel">
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
        <nav
          className="tabs project-detail-tabs"
          aria-label="Secciones del proyecto"
        >
          {[
            ["brief", "Resumen"],
            ["edit", "Editar proyecto"],
            [
              "inputs",
              `Recursos (${(project.input_assets?.length || 0) + (project.references?.length || 0)})`,
            ],
            ["results", `Generaciones (${generated.length})`],
            ["jobs", `Historial (${project.jobs?.length || 0})`],
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
          <section className="grid g2 project-detail-overview">
            <div className="stack project-detail-overview__main">
              <div className="panel wide project-message-panel">
                <span>Mensaje de campaña</span>
                <h2>{project.headline || "Sin titular"}</h2>
                <p className="offer-line">
                  {project.offer_text || "Sin oferta definida"}
                </p>
                <div className="brief-data-grid">
                  <DataItem label="CTA" value={project.call_to_action} />
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
            <div className="panel panel soft project-settings-panel">
              <span>Configuración</span>
              <DataItem
                label="Tipo de contenido"
                value={project.content_type}
              />
              <DataItem label="Plantilla" value={project.template_name} />
              <DataItem label="Ángulo" value={project.creative_angle_name} />
              <DataItem label="Aspect ratio" value={projectAspectRatio} />
              <DataItem
                label="Usa Brand Kit"
                value={project.use_brand_kit ? "Sí" : "No"}
              />
            </div>
          </section>
        )}
        {tab === "inputs" && (
          <UnifiedResourcesManager
            project={project}
            options={options}
            busy={resourceBusy || referenceBusy}
            onAddAsset={addResource}
            onRemoveAsset={removeResource}
            onAddReference={addReference}
            onRemoveReference={removeReference}
          />
        )}
        {tab === "results" && (
          <section className="catalog-grid results-grid project-results-grid">
            {generated.map((item) => (
              <article key={item.id}>
                <button
                  type="button"
                  className="result-preview-button"
                  onClick={() => setSelectedResult(item)}
                  aria-label="Ampliar resultado"
                >
                  {item.file_url ? (
                    <img
                      src={item.file_url}
                      alt="Resultado generado"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div />
                  )}
                </button>
                <div>
                  <span>image</span>
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
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => addGeneratedToBrandAsset(item)}
                  >
                    Agregar a BrandAsset
                  </button>
                </div>
              </article>
            ))}
            {!generated.length && (
              <div className="empty-state">
                <h3>Aún no hay resultados</h3>
                <p>Selecciona un proveedor y genera las primeras variantes.</p>
              </div>
            )}
          </section>
        )}
        {tab === "jobs" && (
          <section className="panel job-list project-history-panel">
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
              <div className="empty-state">
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
