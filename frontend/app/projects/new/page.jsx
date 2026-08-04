"use client";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Nav from "@/components/Nav";
import {
  BottomWorkspace,
  CanvasPanel,
  ContextPanel,
  DirectionPanel,
} from "@/components/projects-new/WorkbenchPanels";
import { api, ensureWorkspace, tokens } from "@/lib/api";
const INPUT_ROLES = [
  ["product_image", "Imagen del producto"],
  ["background", "Fondo"],
  ["lifestyle_reference", "Lifestyle"],
  ["character_reference", "Referencia de personaje"],
  ["packaging", "Empaque"],
  ["icon", "Icono"],
  ["logo", "Logo"],
  ["template", "Plantilla"],
  ["reference_ad", "Referencia publicitaria"],
];
const PURPOSES_BY_ROLE = {
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

const MULTI_INPUT_ROLES = new Set([
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
  const base = PURPOSES_BY_ROLE[role] || [];
  return base;
};
const CATEGORY_BY_ROLE = {
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
const INITIAL_JOB_FORM = {
  project: "",

  // Copia editable de AdProject
  product: "",
  template: "",
  recipe: "",
  creative_angle: "",
  name: "",
  message_type: "",
  campaign_theme: "",
  headline: "",
  offer_text: "",
  call_to_action: "",
  target_audience: "",
  focus_tags: [],
  use_brand_kit: true,

  // Relaciones propias del job
  input_assets: [],
  references: [],
};
const PROVIDER_MODELS = {
  gemini: [
    ["gemini-3.1-flash-lite-image", "Gemini 3.1 Flash Lite"],
    ["gemini-3.1-flash-image", "Gemini 3.1 Flash"],
    ["gemini-3-pro-image", "Gemini 3 Pro"],
    ["gemini-2.5-flash-image", "Gemini 2.5 Flash"],
  ],
  fal: [
    ["flux-fast", "Flux Fast"],
    ["flux-quality", "Flux Quality"],
  ],
};
const FINAL_BATCH_STATES = new Set([
  "completed",
  "partial",
  "failed",
  "cancelled",
]);
const list = (data) => data?.results || data || [];
const idOf = (value) =>
  typeof value === "object" ? value?.id || "" : value || "";
const getWorkbenchSessionId = () => {
  if (typeof window === "undefined") return "";
  const key = "generation-workbench-session";
  const current = window.sessionStorage.getItem(key);
  if (current) return current;
  const next = crypto.randomUUID();
  window.sessionStorage.setItem(key, next);
  return next;
};
const jobToForm = (job) => ({
  ...INITIAL_JOB_FORM,
  project: idOf(job.project),
  product: idOf(job.product),
  template: idOf(job.template),
  recipe: idOf(job.recipe),
  creative_angle: idOf(job.creative_angle),
  name: job.name || "",
  message_type: job.message_type || "",
  campaign_theme: job.campaign_theme || "",
  headline: job.headline || "",
  offer_text: job.offer_text || "",
  call_to_action: job.call_to_action || "",
  target_audience: job.target_audience || "",
  focus_tags: job.focus_tags || [],
  use_brand_kit: job.use_brand_kit ?? true,
  input_assets: (job.input_assets || []).map((item, index) => ({
    id: item.id,
    brand_asset: idOf(item.brand_asset),
    input_role: item.input_role,
    purpose: item.purpose_codes || [],
    sort_order: item.sort_order ?? index,
  })),
  references: (job.references || []).map((item) => ({
    id: item.id,
    reference: idOf(item.reference),
    input_role: item.input_role || "reference_ad",
    purpose: item.purpose_codes || [],
    weight: item.weight,
  })),
});
const projectAssets = (project) =>
  project?.jobs?.flatMap((job) =>
    (job.assets || []).map((asset) => ({
      ...asset,
      job,
    })),
  ) || [];
function Tags({ value, onChange }) {
  const [draft, setDraft] = useState("");
  function add() {
    const next = draft.trim();
    if (next && !value.includes(next)) onChange([...value, next]);
    setDraft("");
  }
  return (
    <div className="badges">
      <div>
        {value.map((tag) => (
          <button
            type="button"
            key={tag}
            onClick={() => onChange(value.filter((item) => item !== tag))}
          >
            {tag}
            <b>×</b>
          </button>
        ))}
      </div>
      <input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            add();
          }
        }}
        onBlur={add}
        placeholder="Escribe y presiona Enter"
      />
    </div>
  );
}
function Control({ label, children, wide = false }) {
  return (
    <label className={`control-row ${wide ? "wide" : ""}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}
function StatusPill({ status }) {
  const labels = {
    draft: "Borrador",
    queued: "En cola",
    processing: "Generando",
    completed: "Completado",
    partial: "Parcial",
    failed: "Falló",
    cancelled: "Cancelado",
  };
  return <span className={`badge ${status}`}>{labels[status] || status}</span>;
}
function ResourceRoleWorkbench({
  form,
  options,
  update,
  activeProject,
  onResourceChange,
}) {
  const [activeRole, setActiveRole] = useState("product_image");
  const [sourceType, setSourceType] = useState("brand_asset");
  const [selectedItem, setSelectedItem] = useState(null);
  const roleLabel =
    INPUT_ROLES.find(([value]) => value === activeRole)?.[1] || activeRole;
  const category = CATEGORY_BY_ROLE[activeRole];
  const assetPool = useMemo(() => {
    if (activeRole === "product_image") {
      const product = options.products.find(
        (item) => String(item.id) === String(form.product),
      );
      const productAssetIds = new Set(
        [product?.main_image_asset, ...(product?.image_assets || [])]
          .filter(Boolean)
          .map(String),
      );
      if (productAssetIds.size)
        return options.assets.filter((asset) =>
          productAssetIds.has(String(asset.id)),
        );
    }
    return options.assets.filter((asset) => asset.category === category);
  }, [activeRole, category, form.product, options.assets, options.products]);
  const referencePool = useMemo(
    () =>
      activeRole === "product_image"
        ? []
        : options.references.filter(
            (reference) => reference.category === category,
          ),
    [activeRole, category, options.references],
  );
  const selectedPurposes = selectedItem?.purpose || [];
  const setPurposes = (next) => {
    if (!selectedItem) return;
    if (selectedItem.type === "brand_asset") {
      const inputAssets = form.input_assets.map((item) =>
        item.brand_asset === selectedItem.id
          ? { ...item, purpose: next }
          : item,
      );
      update("input_assets", inputAssets);
      onResourceChange?.(inputAssets, form.references);
      setSelectedItem({ ...selectedItem, purpose: next });
    } else {
      const references = form.references.map((item) =>
        item.reference === selectedItem.id ? { ...item, purpose: next } : item,
      );
      update("references", references);
      onResourceChange?.(form.input_assets, references);
      setSelectedItem({ ...selectedItem, purpose: next });
    }
  };
  const pickAsset = (asset) => {
    const found = form.input_assets.find(
      (item) => String(item.brand_asset) === String(asset.id),
    );
    const base = MULTI_INPUT_ROLES.has(activeRole)
      ? form.input_assets
      : form.input_assets.filter((item) => item.input_role !== activeRole);
    const next = found
      ? form.input_assets.filter(
          (item) => String(item.brand_asset) !== String(asset.id),
        )
      : [
          ...base,
          {
            brand_asset: asset.id,
            input_role: activeRole,
            purpose: defaultPurposes(activeRole),
            sort_order: base.length,
          },
        ];
    update("input_assets", next);
    let nextReferences = form.references;
    if (!MULTI_INPUT_ROLES.has(activeRole)) {
      nextReferences = form.references.filter(
        (item) => item.input_role !== activeRole,
      );
      update("references", nextReferences);
    }
    onResourceChange?.(next, nextReferences);
    setSelectedItem(
      found
        ? null
        : {
            type: "brand_asset",
            id: asset.id,
            title: asset.name,
            image: asset.file_url,
            purpose: defaultPurposes(activeRole),
          },
    );
  };
  const pickReference = (reference) => {
    const found = form.references.find(
      (item) => String(item.reference) === String(reference.id),
    );
    const defaultPurpose = defaultPurposes(activeRole);
    const base = MULTI_INPUT_ROLES.has(activeRole)
      ? form.references
      : form.references.filter((item) => item.input_role !== activeRole);
    const next = found
      ? form.references.filter(
          (item) => String(item.reference) !== String(reference.id),
        )
      : [
          ...base,
          {
            reference: reference.id,
            input_role: activeRole,
            purpose: defaultPurpose,
            weight: 100,
          },
        ];
    update("references", next);
    let nextAssets = form.input_assets;
    if (!MULTI_INPUT_ROLES.has(activeRole)) {
      nextAssets = form.input_assets.filter(
        (item) => item.input_role !== activeRole,
      );
      update("input_assets", nextAssets);
    }
    onResourceChange?.(nextAssets, next);
    setSelectedItem(
      found
        ? null
        : {
            type: "creative_reference",
            id: reference.id,
            title: reference.title,
            image: reference.image_url,
            purpose: defaultPurpose,
          },
    );
  };
  const visible = sourceType === "brand_asset" ? assetPool : referencePool;
  return (
    <section className="workbench-resource">
      <header>
        <span>Assets del proyecto</span>
        <strong>{roleLabel}</strong>
      </header>
      <div className="tabs">
        {INPUT_ROLES.map(([value, label]) => {
          if (value === "template" && form.template) return null;
          const count =
            form.input_assets.filter((item) => item.input_role === value)
              .length +
            form.references.filter((item) => item.input_role === value).length;
          return (
            <button
              type="button"
              key={value}
              className={activeRole === value ? "active" : ""}
              onClick={() => {
                setActiveRole(value);
                setSelectedItem(null);
              }}
            >
              {label}
              <b>{count}</b>
            </button>
          );
        })}
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
          onClick={() => setSourceType("creative_reference")}
          disabled={activeRole === "product_image"}
        >
          CreativeReference
        </button>
      </div>
      <div className="split-layout">
        <div className="asset-list">
          {visible.map((item) => {
            const active =
              sourceType === "brand_asset"
                ? form.input_assets.some(
                    (entry) => String(entry.brand_asset) === String(item.id),
                  )
                : form.references.some(
                    (entry) => String(entry.reference) === String(item.id),
                  );
            const image =
              sourceType === "brand_asset" ? item.file_url : item.image_url;
            const title = sourceType === "brand_asset" ? item.name : item.title;
            return (
              <button
                type="button"
                key={item.id}
                className={active ? "active" : ""}
                onClick={() =>
                  sourceType === "brand_asset"
                    ? pickAsset(item)
                    : pickReference(item)
                }
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
          {!visible.length && (
            <div className="empty-state">
              No hay imágenes con category={category}.
            </div>
          )}
        </div>
        <aside className="inspector">
          {selectedItem ? (
            <>
              {selectedItem.image && (
                <img src={selectedItem.image} alt={selectedItem.title} />
              )}
              <strong>{selectedItem.title}</strong>
              <span>{selectedItem.type}</span>
              <div className="badges">
                {purposesForRole(activeRole, form.use_brand_kit).map(
                  ([value, label]) => (
                    <button
                      type="button"
                      key={value}
                      className={
                        selectedPurposes.includes(value) ? "active" : ""
                      }
                      onClick={() =>
                        setPurposes(
                          selectedPurposes.includes(value)
                            ? selectedPurposes.filter((item) => item !== value)
                            : [...selectedPurposes, value],
                        )
                      }
                    >
                      {label}
                    </button>
                  ),
                )}
              </div>
            </>
          ) : (
            <p>Selecciona una imagen para asociar Purpose.</p>
          )}
        </aside>
      </div>
    </section>
  );
}
function NewProjectContent() {
  const searchParams = useSearchParams();
  const canvasRef = useRef(null);
  const sessionIdRef = useRef("");
  const syncTimerRef = useRef(null);
  const [form, setForm] = useState(INITIAL_JOB_FORM);
  const [options, setOptions] = useState({
    products: [],
    templates: [],
    recipes: [],
    angles: [],
    assets: [],
    references: [],
  });
  const [projects, setProjects] = useState([]);
  const [activeProject, setActiveProject] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [browserMode, setBrowserMode] = useState("results");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [generationQueue, setGenerationQueue] = useState([]);
  const [activeJob, setActiveJob] = useState(null);
  const [activeBatch, setActiveBatch] = useState(null);
  const [queueBusy, setQueueBusy] = useState(false);
  const [queuePanelOpen, setQueuePanelOpen] = useState(false);
  const update = (key, value) =>
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  const compatibleRecipes = useMemo(() => options.recipes, [options.recipes]);
  const compatibleTemplates = useMemo(
    () => options.templates,
    [options.templates],
  );
  const generated = useMemo(
    () => projectAssets(activeProject),
    [activeProject],
  );
  const selectedProduct = options.products.find(
    (item) => String(item.id) === String(form.product),
  );
  const selectedTemplate = options.templates.find(
    (item) => String(item.id) === String(form.template),
  );
  const selectedRecipe = options.recipes.find(
    (item) => String(item.id) === String(form.recipe),
  );
  const queueOutputs = generationQueue.reduce(
    (sum, item) => sum + Number(item.number_of_outputs || 0),
    0,
  );
  async function load() {
    setLoading(true);
    sessionIdRef.current = getWorkbenchSessionId();
    await ensureWorkspace();
    const [
      products,
      templates,
      recipes,
      angles,
      assets,
      references,
      projectData,
    ] = await Promise.all([
      api("/studio/products/"),
      api("/studio/ad-templates/"),
      api("/studio/recipes/"),
      api("/studio/creative-angles/"),
      api("/studio/brand-assets/"),
      api("/studio/creative-references/"),
      api("/studio/projects/"),
    ]);
    const next = {
      products: list(products),
      templates: list(templates),
      recipes: list(recipes),
      angles: list(angles),
      assets: list(assets),
      references: list(references),
    };
    setOptions(next);
    setProjects(list(projectData));
    const recipe = next.recipes.find(
      (item) => String(item.id) === String(searchParams.get("recipe")),
    );
    setForm((current) => ({
      ...current,
      ...(searchParams.get("product")
        ? {
            product: searchParams.get("product"),
          }
        : {}),
      ...(searchParams.get("format")
        ? {
            content_type: searchParams.get("format"),
          }
        : {}),
      ...(recipe
        ? {
            recipe: recipe.id,
            creative_angle: idOf(recipe.creative_angle),
            name: recipe.name,
          }
        : {}),
    }));
    setLoading(false);
  }
  useEffect(() => {
    load().catch((requestError) => {
      setError(requestError.message);
      setLoading(false);
    });
  }, [searchParams]);
  useEffect(() => {
    if (!activeJob?.id || activeJob.status !== "draft") return undefined;
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(async () => {
      try {
        const updated = await api(`/studio/generation-jobs/${activeJob.id}/`, {
          method: "PATCH",
          body: JSON.stringify({
            ...scalarPayload(),
            number_of_outputs: Number(activeJob.number_of_outputs || 1),
            negative_prompt: activeJob.negative_prompt || "",
            prompt_modifier: activeJob.prompt_modifier || "",
            priority: Number(activeJob.priority || 5),
            parameters: activeJob.parameters || {},
          }),
        });
        setActiveJob(updated);
        setGenerationQueue((current) =>
          current.map((item) => (item.id === updated.id ? updated : item)),
        );
      } catch (requestError) {
        setError(requestError.message);
      }
    }, 650);
    return () => clearTimeout(syncTimerRef.current);
  }, [
    activeJob?.id,
    activeJob?.status,
    form.product,
    form.template,
    form.recipe,
    form.creative_angle,
    form.name,
    form.message_type,
    form.campaign_theme,
    form.headline,
    form.offer_text,
    form.call_to_action,
    form.target_audience,
    form.focus_tags,
    form.use_brand_kit,
  ]);
  useEffect(() => {
    return () => {
      const sessionId = sessionIdRef.current;
      if (!sessionId) return;
      const auth = tokens();
      fetch(
        `${(process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api").replace(/\/$/, "")}/studio/generation-jobs/discard-session/`,
        {
          method: "POST",
          keepalive: true,
          headers: {
            "Content-Type": "application/json",
            ...(auth.access ? { Authorization: `Bearer ${auth.access}` } : {}),
            ...(auth.workspace ? { "X-Workspace-ID": auth.workspace } : {}),
          },
          body: JSON.stringify({ session_id: sessionId }),
        },
      ).catch(() => {});
    };
  }, []);
  useEffect(() => {
    if (!activeBatch || FINAL_BATCH_STATES.has(activeBatch.status)) return;
    const timer = setInterval(async () => {
      try {
        const batch = await api(
          `/studio/generation-batches/${activeBatch.id}/`,
        );
        setActiveBatch(batch);
        if (FINAL_BATCH_STATES.has(batch.status)) {
          const projectData = await api(`/studio/projects/${batch.project}/`);
          setActiveProject(projectData);
          setProjects((current) =>
            current.map((item) =>
              String(item.id) === String(projectData.id) ? projectData : item,
            ),
          );
          const images = projectAssets(projectData);
          setSelectedImage(images[0] || null);
        }
      } catch (requestError) {
        setError(requestError.message);
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [activeBatch?.id, activeBatch?.status]);
  function selectRecipe(value) {
    const recipe = options.recipes.find(
      (item) => String(item.id) === String(value),
    );
    setForm((current) => ({
      ...current,
      recipe: value,
      creative_angle: recipe ? idOf(recipe.creative_angle) : "",
    }));
  }
  function toggleAsset(asset) {
    const found = form.input_assets.find(
      (item) => String(item.brand_asset) === String(asset.id),
    );
    if (found) {
      update(
        "input_assets",
        form.input_assets.filter(
          (item) => String(item.brand_asset) !== String(asset.id),
        ),
      );
      return;
    }
    const role =
      asset.category === "logo"
        ? "logo"
        : asset.category === "background"
          ? "background"
          : asset.category === "packaging"
            ? "packaging"
            : asset.category === "product"
              ? "product_image"
              : asset.category === "lifestyle"
                ? "lifestyle_reference"
                : asset.category === "persona"
                  ? "character_reference"
                  : asset.category === "icon"
                    ? "icon"
                    : asset.category === "template"
                      ? "template"
                      : "reference_ad";
    update("input_assets", [
      ...form.input_assets,
      {
        brand_asset: asset.id,
        input_role: role,
        purpose: [],
        sort_order: form.input_assets.length,
      },
    ]);
  }
  function updateAsset(id, key, value) {
    update(
      "input_assets",
      form.input_assets.map((item) =>
        String(item.brand_asset) === String(id)
          ? {
              ...item,
              [key]: value,
            }
          : item,
      ),
    );
  }
  function toggleReference(reference) {
    const found = form.references.find(
      (item) => String(item.reference) === String(reference.id),
    );
    update(
      "references",
      found
        ? form.references.filter(
            (item) => String(item.reference) !== String(reference.id),
          )
        : [
            ...form.references,
            {
              reference: reference.id,
              input_role:
                reference.category === "lifestyle"
                  ? "lifestyle_reference"
                  : reference.category === "persona"
                    ? "character_reference"
                    : reference.category || "reference_ad",
              purpose: ["style"],
              weight: 100,
            },
          ],
    );
  }
  function updateReference(id, key, value) {
    update(
      "references",
      form.references.map((item) =>
        String(item.reference) === String(id)
          ? {
              ...item,
              [key]: value,
            }
          : item,
      ),
    );
  }
  function selectGeneratedImage(asset) {
    setSelectedImage(asset);
    requestAnimationFrame(() =>
      canvasRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      }),
    );
  }
  async function loadProject(projectSummary) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const project = await api(`/studio/projects/${projectSummary.id}/`);
      setActiveProject(project);
      const preparedJob = await api(
        `/studio/projects/${project.id}/prepare-generation-job/`,
        {
          method: "POST",
          body: JSON.stringify({
            provider: "auto",
            session_id: sessionIdRef.current || getWorkbenchSessionId(),
          }),
        },
      ).catch(() => null);
      setActiveJob(preparedJob);
      setGenerationQueue(preparedJob ? [preparedJob] : []);
      if (preparedJob) setForm(jobToForm(preparedJob));
      const batches = list(
        await api(`/studio/generation-batches/?project=${project.id}`),
      );
      setActiveBatch(batches[0] || null);
      const images = projectAssets(project);
      setSelectedImage(images[0] || null);
      setBrowserMode("results");
      setProjects((current) =>
        current.map((item) =>
          String(item.id) === String(project.id) ? project : item,
        ),
      );
      setNotice(
        preparedJob
          ? `Proyecto “${project.name}” cargado. Se creó un GenerationJob snapshot editable.`
          : `Proyecto “${project.name}” cargado. Todos sus campos fueron aplicados.`,
      );
      requestAnimationFrame(() =>
        canvasRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        }),
      );
    } catch (requestError) {
      setError(
        requestError.message || "No se pudo cargar el proyecto seleccionado.",
      );
    } finally {
      setBusy(false);
    }
  }
  function newProject() {
    setActiveProject(null);
    setActiveJob(null);
    setActiveBatch(null);
    setGenerationQueue([]);
    setQueuePanelOpen(false);
    setSelectedImage(null);
    setForm(INITIAL_JOB_FORM);
    setError("");
    setNotice(
      "Nuevo proyecto listo. Define una dirección y genera cuando quieras.",
    );
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }
  function scalarPayload() {
    const { input_assets, references, ...values } = form;
    return {
      ...values,
      product: form.product || null,
      template: form.template || null,
      recipe: form.recipe || null,
      creative_angle: form.creative_angle || null,
    };
  }
  function nestedPayload() {
    return {
      ...scalarPayload(),
      input_assets: form.input_assets.map((item, index) => ({
        brand_asset: item.brand_asset,
        input_role: item.input_role,
        purpose: item.purpose || [],
        sort_order: Number(item.sort_order ?? index),
      })),
      references: form.references.map((item) => ({
        reference: item.reference,
        input_role: item.input_role || "reference_ad",
        purpose: item.purpose,
        weight: Number(item.weight) || 100,
      })),
    };
  }
  async function syncRelations(project) {
    const oldAssets = project.input_assets || [];
    const oldRefs = project.references || [];
    const assetSignature = (items) =>
      JSON.stringify(
        items
          .map((item) => [
            String(idOf(item.brand_asset)),
            item.input_role,
            Number(item.sort_order || 0),
          ])
          .sort(),
      );
    const refSignature = (items) =>
      JSON.stringify(
        items
          .map((item) => [
            String(idOf(item.reference)),
            item.purpose,
            Number(item.weight || 100),
          ])
          .sort(),
      );
    if (assetSignature(oldAssets) !== assetSignature(form.input_assets)) {
      await Promise.all(
        oldAssets.map((item) =>
          api(`/studio/projects/${project.id}/input-assets/${item.id}/`, {
            method: "DELETE",
          }),
        ),
      );
      for (const item of form.input_assets)
        await api(`/studio/projects/${project.id}/input-assets/`, {
          method: "POST",
          body: JSON.stringify({
            brand_asset: item.brand_asset,
            input_role: item.input_role,
            purpose: item.purpose || [],
            sort_order: Number(item.sort_order || 0),
          }),
        });
    }
    if (refSignature(oldRefs) !== refSignature(form.references)) {
      await Promise.all(
        oldRefs.map((item) =>
          api(`/studio/projects/${project.id}/references/${item.id}/`, {
            method: "DELETE",
          }),
        ),
      );
      for (const item of form.references)
        await api(`/studio/projects/${project.id}/references/`, {
          method: "POST",
          body: JSON.stringify({
            reference: item.reference,
            input_role: item.input_role || "reference_ad",
            purpose: item.purpose,
            weight: Number(item.weight) || 100,
          }),
        });
    }
  }
  async function syncJobResources(inputAssets, references) {
    if (!activeJob?.id || activeJob.status !== "draft") return;
    try {
      await Promise.all(
        (activeJob.input_assets || []).map((item) =>
          api(
            `/studio/generation-jobs/${activeJob.id}/input-assets/${item.id}/`,
            {
              method: "DELETE",
            },
          ),
        ),
      );
      await Promise.all(
        (activeJob.references || []).map((item) =>
          api(
            `/studio/generation-jobs/${activeJob.id}/references/${item.id}/`,
            {
              method: "DELETE",
            },
          ),
        ),
      );
      for (const item of inputAssets) {
        await api(`/studio/generation-jobs/${activeJob.id}/input-assets/`, {
          method: "POST",
          body: JSON.stringify({
            brand_asset: item.brand_asset,
            input_role: item.input_role,
            purpose: item.purpose || [],
            sort_order: Number(item.sort_order || 0),
          }),
        });
      }
      for (const item of references) {
        await api(`/studio/generation-jobs/${activeJob.id}/references/`, {
          method: "POST",
          body: JSON.stringify({
            reference: item.reference,
            input_role: item.input_role || "reference_ad",
            purpose: item.purpose || [],
            weight: Number(item.weight) || 100,
          }),
        });
      }
      const updated = await api(`/studio/generation-jobs/${activeJob.id}/`);
      setActiveJob(updated);
      setGenerationQueue((current) =>
        current.map((item) =>
          item.id === updated.id
            ? { ...updated, expanded: item.expanded }
            : item,
        ),
      );
      setForm(jobToForm(updated));
    } catch (requestError) {
      setError(requestError.message);
    }
  }
  function jobPatchPayload(item) {
    return {
      name: item.name || "",
      number_of_outputs: Number(item.number_of_outputs || 1),
      priority: Number(item.priority || 5),
      negative_prompt: item.negative_prompt || "",
      prompt_modifier: item.prompt_modifier || "",
      parameters: item.parameters || {},
    };
  }
  async function addQueueItem() {
    if (!activeJob?.id) {
      setError(
        "Selecciona un AdProject para preparar la primera configuración.",
      );
      return;
    }
    setQueueBusy(true);
    try {
      const copy = await api(
        `/studio/generation-jobs/${activeJob.id}/duplicate/`,
        {
          method: "POST",
        },
      );
      setGenerationQueue((current) => [
        ...current.map((item) => ({ ...item, expanded: false })),
        { ...copy, expanded: true },
      ]);
      setActiveJob(copy);
      setForm(jobToForm(copy));
      setQueuePanelOpen(true);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setQueueBusy(false);
    }
  }
  async function duplicateQueueItem(id) {
    setQueueBusy(true);
    try {
      const copy = await api(`/studio/generation-jobs/${id}/duplicate/`, {
        method: "POST",
      });
      setGenerationQueue((current) => [
        ...current.map((item) => ({ ...item, expanded: false })),
        { ...copy, expanded: true },
      ]);
      setActiveJob(copy);
      setForm(jobToForm(copy));
      setQueuePanelOpen(true);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setQueueBusy(false);
    }
  }
  async function removeQueueItem(id) {
    setGenerationQueue((current) => current.filter((item) => item.id !== id));
    if (activeJob?.id === id) setActiveJob(null);
    await api(`/studio/generation-jobs/${id}/`, { method: "DELETE" }).catch(
      (requestError) => setError(requestError.message),
    );
  }
  function updateQueueItem(id, key, value) {
    setGenerationQueue((current) =>
      current.map((item) => {
        if (key === "expanded")
          return {
            ...item,
            expanded: item.id === id ? value : false,
          };
        return item.id === id
          ? {
              ...item,
              [key]: value,
            }
          : item;
      }),
    );
    const nextJob = generationQueue.find((item) => item.id === id);
    if (nextJob) {
      const updated = { ...nextJob, [key]: value };
      setActiveJob(updated);
      if (key !== "expanded") {
        api(`/studio/generation-jobs/${id}/`, {
          method: "PATCH",
          body: JSON.stringify(jobPatchPayload(updated)),
        })
          .then((serverJob) => {
            setActiveJob(serverJob);
            setGenerationQueue((current) =>
              current.map((item) =>
                item.id === serverJob.id
                  ? { ...serverJob, expanded: item.expanded }
                  : item,
              ),
            );
          })
          .catch((requestError) => setError(requestError.message));
      }
    }
  }
  function moveQueueItem(id, direction) {
    setGenerationQueue((current) => {
      const index = current.findIndex((item) => item.id === id),
        target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }
  function clearQueue() {
    setGenerationQueue([]);
    setActiveBatch(null);
    setQueuePanelOpen(false);
  }

  async function enqueueDraftJobs() {
    if (!form.name.trim()) {
      setError("Asigna un nombre al proyecto antes de encolar.");
      return;
    }
    if (!generationQueue.length) {
      setError("Agrega al menos una configuración.");
      return;
    }
    setQueueBusy(true);
    setError("");
    try {
      if (!activeProject?.id) {
        throw new Error(
          "Debes seleccionar un AdProject antes de crear la cola.",
        );
      }

      const project = activeProject;
      const batch = await api(
        `/studio/projects/${project.id}/enqueue-draft-jobs/`,
        {
          method: "POST",
          body: JSON.stringify({
            name: `${project.name} · cola`,
            session_id: sessionIdRef.current,
            job_ids: generationQueue.map((item) => item.id),
          }),
        },
      );
      setActiveProject(project);
      setActiveBatch(batch);
      setGenerationQueue(batch.jobs || []);
      setBrowserMode("results");
      setProjects(list(await api("/studio/projects/")));
      setNotice(
        "La cola fue creada y el worker la procesará en segundo plano.",
      );
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setQueueBusy(false);
    }
  }
  async function dispatchActiveBatch() {
    if (!activeBatch?.id) return;
    setQueueBusy(true);
    try {
      const batch = await api(
        `/studio/generation-batches/${activeBatch.id}/dispatch/`,
        { method: "POST" },
      );
      setActiveBatch(batch);
      setNotice("La generación fue enviada al worker.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setQueueBusy(false);
    }
  }
  async function cancelBatch() {
    if (!activeBatch) return;
    setQueueBusy(true);
    try {
      setActiveBatch(
        await api(`/studio/generation-batches/${activeBatch.id}/cancel/`, {
          method: "POST",
        }),
      );
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setQueueBusy(false);
    }
  }
  async function retryJob(job) {
    setQueueBusy(true);
    try {
      await api(`/studio/generation-jobs/${job.id}/retry/`, {
        method: "POST",
      });
      setActiveBatch(
        await api(`/studio/generation-batches/${activeBatch.id}/`),
      );
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setQueueBusy(false);
    }
  }
  if (loading)
    return (
      <>
        <Nav privateNav />
        <main className="container ascend-view studio-loading" aria-busy="true">
          <h1 className="sr-only">Crear contenido</h1>
          <div className="studio-loading__topbar" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          <div className="studio-loading__workspace" aria-hidden="true">
            <section><i /><i /><i /><i /></section>
            <section><div /><i /><i /></section>
            <section><i /><i /><i /></section>
          </div>
          <div className="studio-loading__status" role="status" aria-live="polite">
            <span className="studio-loading__mark" aria-hidden="true">✦</span>
            <div><strong>Preparando el estudio creativo</strong><span>Organizando recursos, brief y configuración de generación…</span></div>
          </div>
        </main>
      </>
    );
  return (
    <>
      <Nav privateNav />
      <main className="container ascend-view studio-page campaign-workspace-page">
        <h1 className="sr-only">{activeProject ? `Editar ${activeProject.name}` : "Crear contenido"}</h1>
        {" "}
        <header className="studio-topbar">
          <div>
            <span>Ascend Creative Intelligence</span>
            <strong>
              {activeProject ? "Proyecto activo" : "Nuevo proyecto"}
            </strong>
          </div>
          <div className="badge">
            <i />
            {activeProject?.name || form.name || "Sin nombre"}
          </div>
          <div>
            <span>Configuraciones</span>
            <strong>{generationQueue.length}</strong>
          </div>
          <Link href="/projects">Salir</Link>
        </header>{" "}
        {(error || notice) && (
          <div
            className={`notice ${error ? "error" : ""}`}
            role={error ? "alert" : "status"}
          >
            <span>{error || notice}</span>
            <button
              onClick={() => {
                setError("");
                setNotice("");
              }}
            >
              ×
            </button>
          </div>
        )}
        <section className="workbench campaign-workspace-shell">
          {" "}
          <ContextPanel>
            <header>
              <span>01 / Contexto</span>
              <h2>Fuentes</h2>
              <p>Define qué debe interpretar la IA.</p>
            </header>
            <div className="scroll-area">
              {" "}
              <Control label="Producto">
                <select
                  className="input"
                  value={form.product}
                  onChange={(event) => update("product", event.target.value)}
                >
                  <option value="">Campaña sin producto</option>
                  {options.products.map((item) => (
                    <option value={item.id} key={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </Control>{" "}
              {selectedProduct && (
                <div className="spec">
                  {selectedProduct.main_image_url && (
                    <img src={selectedProduct.main_image_url} alt="" />
                  )}
                  <div>
                    <span>Producto activo</span>
                    <strong>{selectedProduct.name}</strong>
                    <small>{selectedProduct.category || "Catálogo"}</small>
                  </div>
                </div>
              )}
              <Control label="Template">
                <select
                  className="input"
                  value={form.template}
                  onChange={(event) => update("template", event.target.value)}
                >
                  <option value="">Composición libre</option>
                  {compatibleTemplates.map((item) => (
                    <option value={item.id} key={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </Control>{" "}
              {selectedTemplate && (
                <div className="spec compact">
                  {selectedTemplate.source_asset_url && (
                    <img src={selectedTemplate.source_asset_url} alt="" />
                  )}
                  <div>
                    <span>Frame activo</span>
                    <strong>{selectedTemplate.name}</strong>
                  </div>
                </div>
              )}
              <label className="tabs">
                <div>
                  <span>Brand Kit</span>
                  <small>Aplicar colores, voz y restricciones.</small>
                </div>
                <input
                  type="checkbox"
                  checked={form.use_brand_kit}
                  onChange={(event) =>
                    update("use_brand_kit", event.target.checked)
                  }
                />
                <i />
              </label>{" "}
              <ResourceRoleWorkbench
                form={form}
                options={options}
                update={update}
                activeProject={activeProject}
                onResourceChange={syncJobResources}
              />
            </div>
          </ContextPanel>{" "}
          <CanvasPanel canvasRef={canvasRef}>
            <header>
              <div>
                <span>02 / Canvas</span>
                <strong>
                  {selectedImage
                    ? "Resultado seleccionado"
                    : "Dirección en construcción"}
                </strong>
              </div>
              <div>
                {activeJob?.parameters?.aspect_ratio || "4:5"}·{" "}
                {activeJob?.parameters?.resolution || "1K"}
              </div>
            </header>
            <div className="stage">
              {selectedImage?.file_url ? (
                <img
                  key={selectedImage.id}
                  src={selectedImage.file_url}
                  alt="Resultado generado seleccionado"
                />
              ) : (
                <div className="empty-state">
                  <i />
                  <span>Creative canvas</span>
                  <h2>{form.headline || "Tu próxima campaña empieza aquí."}</h2>
                  <p>
                    {form.offer_text ||
                      "Completa la dirección y genera para visualizar el primer resultado."}
                  </p>
                  <small>
                    {selectedProduct?.name || "Brand campaign"}·{" "}
                    {selectedRecipe?.name || "Dirección libre"}
                  </small>
                </div>
              )}
            </div>
            <BottomWorkspace>
              <header>
                <div>
                  <button
                    className={browserMode === "results" ? "active" : ""}
                    onClick={() => setBrowserMode("results")}
                  >
                    Resultados <b>{generated.length}</b>
                  </button>

                  <button
                    className={browserMode === "projects" ? "active" : ""}
                    onClick={() => setBrowserMode("projects")}
                  >
                    Proyectos <b>{projects.length}</b>
                  </button>
                </div>

                <span>
                  {browserMode === "results"
                    ? "Selecciona una imagen para llevarla al canvas."
                    : "Selecciona un proyecto para recuperar su contexto."}
                </span>
              </header>

              {browserMode === "results" && (
                <div className="asset-list">
                  {generated.map((asset) => (
                    <button
                      type="button"
                      key={asset.id}
                      className={selectedImage?.id === asset.id ? "active" : ""}
                      onClick={() => selectGeneratedImage(asset)}
                    >
                      {asset.file_url ? (
                        <img src={asset.file_url} alt="Resultado generado" />
                      ) : (
                        <span>Archivo</span>
                      )}

                      <small>{asset.job?.model_name || "Generado"}</small>
                    </button>
                  ))}

                  {!generated.length && (
                    <div className="empty-state">
                      Las imágenes generadas aparecerán aquí.
                    </div>
                  )}
                </div>
              )}

              {browserMode === "projects" && (
                <div className="asset-list">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={newProject}
                    aria-label="Crear un proyecto nuevo"
                  >
                    <span>+</span>
                    <strong>Nuevo proyecto</strong>
                    <i>Brief en blanco</i>
                  </button>

                  {projects.map((project) => (
                    <button
                      type="button"
                      key={project.id}
                      className={
                        activeProject?.id === project.id ? "active" : ""
                      }
                      onClick={() => loadProject(project)}
                      disabled={busy}
                    >
                      <div>
                        {projectAssets(project)[0]?.file_url ? (
                          <img
                            src={projectAssets(project)[0].file_url}
                            alt=""
                          />
                        ) : (
                          <span>{project.name?.slice(0, 2).toUpperCase()}</span>
                        )}
                      </div>

                      <small>{project.content_type}</small>
                      <strong>{project.name}</strong>
                      <i>{projectAssets(project).length} resultados</i>
                    </button>
                  ))}
                </div>
              )}
            </BottomWorkspace>
          </CanvasPanel>{" "}
          <DirectionPanel>
            <header>
              <span>03 / Dirección</span>
              <h2>Brief</h2>
              <p>Completa los campos en cualquier orden.</p>
            </header>
            <div className="scroll-area form">
              {" "}
              <Control label="Recipe">
                <select
                  className="input"
                  value={form.recipe}
                  onChange={(event) => selectRecipe(event.target.value)}
                >
                  <option value="">Dirección libre</option>
                  {compatibleRecipes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </Control>{" "}
              <Control label="Creative angle">
                <select
                  className="input"
                  value={form.creative_angle}
                  onChange={(event) =>
                    update("creative_angle", event.target.value)
                  }
                >
                  <option value="">Sin ángulo</option>
                  {options.angles
                    .filter((item) => item.is_active)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                </select>
              </Control>{" "}
              <Control label="Nombre">
                <input
                  className="input"
                  value={form.name}
                  onChange={(event) => update("name", event.target.value)}
                  placeholder="Nombre interno del proyecto"
                />
              </Control>{" "}
              <div className="form-grid two">
                <Control label="Message type">
                  <input
                    className="input"
                    value={form.message_type}
                    onChange={(event) =>
                      update("message_type", event.target.value)
                    }
                    placeholder="Lanzamiento"
                  />
                </Control>
              </div>{" "}
              <Control label="Campaign theme">
                <input
                  className="input"
                  value={form.campaign_theme}
                  onChange={(event) =>
                    update("campaign_theme", event.target.value)
                  }
                  placeholder="Concepto de campaña"
                />
              </Control>{" "}
              <Control label="Headline">
                <textarea
                  className="input display-title"
                  value={form.headline}
                  onChange={(event) => update("headline", event.target.value)}
                  placeholder="La idea que debe recordar tu audiencia"
                />
              </Control>{" "}
              <Control label="Offer text">
                <textarea
                  className="input"
                  value={form.offer_text}
                  onChange={(event) => update("offer_text", event.target.value)}
                  placeholder="Oferta o argumento comercial"
                />
              </Control>{" "}
              <Control label="Call to action">
                <input
                  className="input"
                  value={form.call_to_action}
                  onChange={(event) =>
                    update("call_to_action", event.target.value)
                  }
                />
              </Control>{" "}
              <Control label="Target audience">
                <textarea
                  className="input"
                  value={form.target_audience}
                  onChange={(event) =>
                    update("target_audience", event.target.value)
                  }
                  placeholder="Necesidad, comportamiento y contexto"
                />
              </Control>{" "}
              <Control label="Focus tags">
                <Tags
                  value={form.focus_tags}
                  onChange={(value) => update("focus_tags", value)}
                />
              </Control>{" "}
            </div>{" "}
            <footer className="btn btn-primary">
              {" "}
              <button
                type="button"
                onClick={addQueueItem}
                disabled={busy || queueBusy}
              >
                <span>Agregar configuración</span>
                <strong>＋</strong>
                <small>Sin consumo</small>
              </button>{" "}
              <p>
                Configura una o varias direcciones y envíalas juntas a la cola.
              </p>{" "}
            </footer>{" "}
            {(generationQueue.length > 0 || activeBatch) && (
              <section
                className={`right-queue-dock ${queuePanelOpen ? "open" : ""}`}
                aria-label="Cola de generación"
              >
                {" "}
                <button
                  type="button"
                  className="right-queue-toggle"
                  onClick={() => setQueuePanelOpen((current) => !current)}
                  aria-expanded={queuePanelOpen}
                  aria-controls="right-generation-queue"
                >
                  {" "}
                  <span>
                    {" "}
                    <b>Cola de generación</b>{" "}
                    <small>
                      {activeBatch
                        ? `${activeBatch.finished_jobs}/${activeBatch.total_jobs} jobs procesados`
                        : `${generationQueue.length} configuraciones · ${queueOutputs} imágenes`}
                    </small>{" "}
                  </span>{" "}
                  <em>
                    {activeBatch ? (
                      <StatusPill status={activeBatch.status} />
                    ) : (
                      <>{queueOutputs} imágenes</>
                    )}
                  </em>{" "}
                  <i>{queuePanelOpen ? "⌃" : "⌄"}</i>{" "}
                </button>{" "}
                {queuePanelOpen && (
                  <div
                    id="right-generation-queue"
                    className="right-queue-section"
                  >
                    {" "}
                    {!activeBatch ? (
                      <div className="right-queue-builder">
                        {" "}
                        <div className="right-queue-scroll">
                          {" "}
                          {generationQueue.map((item, index) => (
                            <article
                              key={item.id}
                              className={`right-queue-card ${item.expanded ? "expanded" : ""}`}
                            >
                              {" "}
                              <button
                                type="button"
                                className="right-queue-card__head"
                                onClick={() =>
                                  updateQueueItem(
                                    item.id,
                                    "expanded",
                                    !item.expanded,
                                  )
                                }
                              >
                                {" "}
                                <b>{String(index + 1).padStart(2, "0")}</b>{" "}
                                <span>
                                  {" "}
                                  <strong>
                                    {item.name || `Configuración ${index + 1}`}
                                  </strong>{" "}
                                  <small className="right-queue-card__meta">
                                    <span>{item.provider}</span>
                                    <span>{item.parameters?.aspect_ratio}</span>
                                    <span>{item.parameters?.resolution}</span>
                                    <span>
                                      {item.number_of_outputs} outputs
                                    </span>
                                    <span>Prioridad {item.priority}</span>
                                    <span>
                                      Seed{" "}
                                      {item.parameters?.seed === null ||
                                      item.parameters?.seed === "" ||
                                      item.parameters?.seed === undefined
                                        ? "aleatoria"
                                        : item.parameters?.seed}
                                    </span>
                                  </small>
                                </span>{" "}
                                <em>{item.number_of_outputs} imágenes</em>{" "}
                                <i>{item.expanded ? "−" : "+"}</i>{" "}
                              </button>{" "}
                              {item.expanded && (
                                <div className="right-queue-card__body">
                                  <section className="queue-field-group">
                                    <header className="queue-field-group__heading">
                                      <span>01</span>

                                      <div>
                                        <strong>Identidad</strong>
                                        <small>
                                          Proveedor y modelo de generación
                                        </small>
                                      </div>
                                    </header>

                                    <div className="queue-field-grid queue-field-grid--single">
                                      <Control label="Nombre">
                                        <input
                                          className="input"
                                          value={item.name}
                                          onChange={(event) =>
                                            updateQueueItem(
                                              item.id,
                                              "name",
                                              event.target.value,
                                            )
                                          }
                                        />
                                      </Control>
                                    </div>

                                    <div className="queue-field-grid queue-field-grid--two">
                                      <Control label="Proveedor">
                                        <select
                                          className="input"
                                          value={item.provider}
                                          disabled
                                        >
                                          <option value="auto">
                                            Automático
                                          </option>
                                          <option value="gemini">Gemini</option>
                                          <option value="fal">fal.ai</option>
                                        </select>
                                      </Control>

                                      <Control label="Modelo">
                                        <select
                                          className="input"
                                          value={
                                            item.parameters?.model_code || ""
                                          }
                                          onChange={(event) =>
                                            updateQueueItem(
                                              item.id,
                                              "parameters",
                                              {
                                                ...(item.parameters || {}),
                                                model_code: event.target.value,
                                              },
                                            )
                                          }
                                        >
                                          <option value="">Automático</option>

                                          {(
                                            PROVIDER_MODELS[item.provider] ||
                                            Object.values(
                                              PROVIDER_MODELS,
                                            ).flat()
                                          ).map(([value, label]) => (
                                            <option key={value} value={value}>
                                              {label}
                                            </option>
                                          ))}
                                        </select>
                                      </Control>
                                    </div>
                                  </section>

                                  <section className="queue-field-group">
                                    <header className="queue-field-group__heading">
                                      <span>02</span>

                                      <div>
                                        <strong>Salida</strong>
                                        <small>
                                          Dimensiones, formato y calidad
                                        </small>
                                      </div>
                                    </header>

                                    <div className="queue-field-grid queue-field-grid--two">
                                      <Control label="Outputs">
                                        <input
                                          className="input"
                                          type="number"
                                          min="1"
                                          max="6"
                                          value={item.number_of_outputs}
                                          onChange={(event) =>
                                            updateQueueItem(
                                              item.id,
                                              "number_of_outputs",
                                              event.target.value,
                                            )
                                          }
                                        />
                                      </Control>

                                      <Control label="Formato">
                                        <select
                                          className="input"
                                          value={
                                            item.parameters?.output_format ||
                                            "png"
                                          }
                                          onChange={(event) =>
                                            updateQueueItem(
                                              item.id,
                                              "parameters",
                                              {
                                                ...(item.parameters || {}),
                                                output_format:
                                                  event.target.value,
                                              },
                                            )
                                          }
                                        >
                                          <option value="png">PNG</option>
                                          <option value="jpeg">JPEG</option>
                                          <option value="webp">WebP</option>
                                        </select>
                                      </Control>

                                      <Control label="Aspect ratio">
                                        <select
                                          className="input"
                                          value={
                                            item.parameters?.aspect_ratio ||
                                            "4:5"
                                          }
                                          onChange={(event) =>
                                            updateQueueItem(
                                              item.id,
                                              "parameters",
                                              {
                                                ...(item.parameters || {}),
                                                aspect_ratio:
                                                  event.target.value,
                                              },
                                            )
                                          }
                                        >
                                          <option value="4:5">4:5</option>
                                          <option value="1:1">1:1</option>
                                          <option value="9:16">9:16</option>
                                          <option value="16:9">16:9</option>
                                        </select>
                                      </Control>

                                      <Control label="Resolución">
                                        <select
                                          className="input"
                                          value={
                                            item.parameters?.resolution || "1K"
                                          }
                                          onChange={(event) =>
                                            updateQueueItem(
                                              item.id,
                                              "parameters",
                                              {
                                                ...(item.parameters || {}),
                                                resolution: event.target.value,
                                              },
                                            )
                                          }
                                        >
                                          <option value="1K">1K</option>
                                          <option value="2K">2K</option>
                                          <option value="4K">4K</option>
                                        </select>
                                      </Control>
                                    </div>

                                    <div className="queue-field-grid queue-field-grid--single">
                                      <Control label="Calidad">
                                        <select
                                          className="input"
                                          value={
                                            item.parameters?.quality_mode ||
                                            "standard"
                                          }
                                          onChange={(event) =>
                                            updateQueueItem(
                                              item.id,
                                              "parameters",
                                              {
                                                ...(item.parameters || {}),
                                                quality_mode:
                                                  event.target.value,
                                              },
                                            )
                                          }
                                        >
                                          <option value="draft">
                                            Borrador
                                          </option>
                                          <option value="standard">
                                            Estándar
                                          </option>
                                          <option value="high">Alta</option>
                                          <option value="premium">
                                            Premium
                                          </option>
                                        </select>
                                      </Control>
                                    </div>
                                  </section>

                                  <section className="queue-field-group">
                                    <header className="queue-field-group__heading">
                                      <span>03</span>

                                      <div>
                                        <strong>Ejecución</strong>
                                        <small>Orden y reproducibilidad</small>
                                      </div>
                                    </header>

                                    <div className="queue-field-grid queue-field-grid--two">
                                      <Control label="Prioridad">
                                        <input
                                          className="input"
                                          type="number"
                                          min="1"
                                          max="10"
                                          value={item.priority}
                                          onChange={(event) =>
                                            updateQueueItem(
                                              item.id,
                                              "priority",
                                              event.target.value,
                                            )
                                          }
                                        />
                                      </Control>

                                      <Control label="Seed">
                                        <input
                                          className="input"
                                          type="number"
                                          min="0"
                                          value={item.parameters?.seed ?? ""}
                                          onChange={(event) =>
                                            updateQueueItem(
                                              item.id,
                                              "parameters",
                                              {
                                                ...(item.parameters || {}),
                                                seed:
                                                  event.target.value === ""
                                                    ? null
                                                    : Number(
                                                        event.target.value,
                                                      ),
                                              },
                                            )
                                          }
                                          placeholder="Aleatoria"
                                        />
                                      </Control>
                                    </div>

                                    <p className="queue-field-help">
                                      Una prioridad mayor adelanta la
                                      configuración dentro de la cola. Deja Seed
                                      vacío para usar un valor aleatorio.
                                    </p>
                                  </section>

                                  <section className="queue-field-group">
                                    <header className="queue-field-group__heading">
                                      <span>04</span>

                                      <div>
                                        <strong>Dirección específica</strong>
                                        <small>
                                          Instrucciones exclusivas de esta
                                          variante
                                        </small>
                                      </div>
                                    </header>

                                    <div className="queue-field-grid queue-field-grid--single">
                                      <Control label="Prompt adicional">
                                        <textarea
                                          className="input queue-prompt-textarea"
                                          value={item.prompt_modifier}
                                          onChange={(event) =>
                                            updateQueueItem(
                                              item.id,
                                              "prompt_modifier",
                                              event.target.value,
                                            )
                                          }
                                          placeholder="Dirección específica para esta configuración"
                                        />
                                      </Control>

                                      <Control label="Negative prompt">
                                        <textarea
                                          className="input queue-prompt-textarea"
                                          value={item.negative_prompt}
                                          onChange={(event) =>
                                            updateQueueItem(
                                              item.id,
                                              "negative_prompt",
                                              event.target.value,
                                            )
                                          }
                                          placeholder="Elementos que deben evitarse"
                                        />
                                      </Control>
                                    </div>
                                  </section>
                                </div>
                              )}
                              <footer className="right-queue-card__actions">
                                <div className="right-queue-order-actions">
                                  <button
                                    type="button"
                                    onClick={() => moveQueueItem(item.id, -1)}
                                    disabled={!index}
                                    aria-label="Subir configuración"
                                    title="Subir"
                                  >
                                    ↑
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => moveQueueItem(item.id, 1)}
                                    disabled={
                                      index === generationQueue.length - 1
                                    }
                                    aria-label="Bajar configuración"
                                    title="Bajar"
                                  >
                                    ↓
                                  </button>
                                </div>

                                <div className="right-queue-main-actions">
                                  <button
                                    type="button"
                                    onClick={() => duplicateQueueItem(item.id)}
                                  >
                                    Duplicar
                                  </button>

                                  <button
                                    type="button"
                                    className="danger"
                                    onClick={() => removeQueueItem(item.id)}
                                  >
                                    Eliminar
                                  </button>
                                </div>
                              </footer>
                            </article>
                          ))}
                          {!generationQueue.length && (
                            <div className="empty-state">
                              {" "}
                              <strong>Aún no hay configuraciones</strong>{" "}
                              <span>
                                Crea variantes con diferentes modelos, formatos
                                y prompts.
                              </span>{" "}
                              <button type="button" onClick={addQueueItem}>
                                Agregar primera configuración
                              </button>{" "}
                            </div>
                          )}
                        </div>{" "}
                        <footer className="right-queue-submit">
                          {" "}
                          <div>
                            <span>Producción estimada</span>
                            <strong>
                              {queueOutputs}
                              imágenes configuradas
                            </strong>
                          </div>{" "}
                          <button
                            type="button"
                            disabled={queueBusy || !generationQueue.length}
                            onClick={enqueueDraftJobs}
                          >
                            {queueBusy
                              ? "Creando cola…"
                              : "Encolar generaciones"}
                          </button>{" "}
                        </footer>{" "}
                      </div>
                    ) : (
                      <div className="right-queue-runtime">
                        {" "}
                        <header>
                          {" "}
                          <div>
                            <span>Batch activo</span>
                            <strong>
                              {activeBatch.name || "Cola de generación"}
                            </strong>
                            <small>
                              {activeBatch.finished_jobs}/
                              {activeBatch.total_jobs}
                              jobs · {activeBatch.total_outputs}
                              imágenes
                            </small>
                          </div>{" "}
                          <div>
                            <b>{activeBatch.progress_percentage}%</b>
                            <StatusPill status={activeBatch.status} />
                          </div>{" "}
                        </header>{" "}
                        <div className="progress">
                          <i
                            style={{
                              width: `${activeBatch.progress_percentage}%`,
                            }}
                          />
                        </div>{" "}
                        <div className="right-queue-scroll right-queue-runtime__list">
                          {" "}
                          {(activeBatch.jobs || []).map((job) => (
                            <article
                              key={job.id}
                              className={`right-queue-job badge-${job.status}`}
                            >
                              {" "}
                              <b>{job.queue_position}</b>{" "}
                              <div>
                                <strong>
                                  {job.parameters?.name || job.model_name}
                                </strong>
                                <span>
                                  {job.provider}· {job.parameters?.aspect_ratio}
                                  · {job.parameters?.resolution}·{" "}
                                  {job.number_of_outputs}
                                  outputs
                                </span>
                                {job.error_message && (
                                  <small>{job.error_message}</small>
                                )}
                              </div>{" "}
                              <StatusPill status={job.status} />{" "}
                              <em>{job.number_of_outputs} imágenes</em>{" "}
                              {job.status === "failed" && (
                                <button
                                  type="button"
                                  onClick={() => retryJob(job)}
                                  disabled={queueBusy}
                                >
                                  Reintentar
                                </button>
                              )}
                            </article>
                          ))}
                        </div>{" "}
                        <footer className="right-queue-runtime__actions">
                          {" "}
                          {!FINAL_BATCH_STATES.has(activeBatch.status) ? (
                            activeBatch.status === "draft" ? (
                              <button
                                type="button"
                                onClick={dispatchActiveBatch}
                                disabled={queueBusy}
                              >
                                {queueBusy ? "Enviando…" : "Generar"}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={cancelBatch}
                                disabled={queueBusy}
                              >
                                Cancelar batch
                              </button>
                            )
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveBatch(null);
                                setGenerationQueue([]);
                                setQueuePanelOpen(true);
                              }}
                            >
                              Crear otra cola
                            </button>
                          )}
                        </footer>{" "}
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}{" "}
          </DirectionPanel>{" "}
        </section>{" "}
      </main>
    </>
  );
}
function Fallback() {
  return (
    <>
      <Nav privateNav />
      <main className="container ascend-view studio-loading" aria-busy="true">
        <h1 className="sr-only">Crear contenido</h1>
        <div className="studio-loading__topbar" aria-hidden="true"><i /><i /><i /></div>
        <div className="studio-loading__workspace" aria-hidden="true">
          <section><i /><i /><i /><i /></section>
          <section><div /><i /><i /></section>
          <section><i /><i /><i /></section>
        </div>
        <div className="studio-loading__status" role="status" aria-live="polite">
          <span className="studio-loading__mark" aria-hidden="true">✦</span>
          <div><strong>Preparando el estudio creativo</strong><span>Organizando recursos, brief y configuración de generación…</span></div>
        </div>
      </main>
    </>
  );
}
export default function NewProject() {
  return (
    <Suspense fallback={<Fallback />}>
      <NewProjectContent />
    </Suspense>
  );
}
