"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import Nav from "@/components/Nav";
import PageTitle from "@/components/PageTitle";
import { api, ensureWorkspace } from "@/lib/api";

const list = (value) => value?.results || value || [];
const idOf = (value) => (typeof value === "object" ? value?.id : value) || "";
const previewUrl = (template) =>
  template?.example_images
    ?.slice()
    .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0))[0]
    ?.image_url || "";

function SelectCard({ active, onClick, children, label }) {
  return (
    <button
      type="button"
      className={`cp-select-card ${active ? "is-selected" : ""}`}
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
    >
      {children}
      <span className="cp-select-card__check">{active ? "✓" : "+"}</span>
    </button>
  );
}

function ConceptPlannerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [projects, setProjects] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedProfileIds, setSelectedProfileIds] = useState([]);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState([]);
  const [totalAdsRequested, setTotalAdsRequested] = useState(6);
  const [conceptPlan, setConceptPlan] = useState(null);
  const [expandedBatch, setExpandedBatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    async function load() {
      await ensureWorkspace();
      const [projectData, profileData, templateData] = await Promise.all([
        api("/studio/projects/"),
        api("/studio/brand-intelligence/?is_active=true"),
        api("/studio/ad-templates/"),
      ]);
      const nextProjects = list(projectData);
      const nextProfiles = list(profileData).filter((item) => item.is_active);
      const nextTemplates = list(templateData).filter((item) => item.is_active);
      setProjects(nextProjects);
      setProfiles(nextProfiles);
      setTemplates(nextTemplates);
      const projectId = searchParams.get("project");
      const profileId = searchParams.get("profile");
      if (nextProjects.some((item) => String(item.id) === String(projectId))) {
        setSelectedProjectId(projectId);
      }
      if (nextProfiles.some((item) => String(item.id) === String(profileId))) {
        setSelectedProfileIds([profileId]);
      }
    }
    load()
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, [searchParams]);

  const selectedProject = projects.find(
    (item) => String(item.id) === String(selectedProjectId),
  );
  const selectedProfiles = profiles.filter((item) =>
    selectedProfileIds.includes(String(item.id)),
  );
  const selectedTemplates = templates.filter((item) =>
    selectedTemplateIds.includes(String(item.id)),
  );
  const concepts = conceptPlan?.concepts || [];
  const assignedJobs = useMemo(
    () => concepts.reduce((sum, item) => sum + Number(item.ads_count || 0), 0),
    [concepts],
  );

  const toggle = (setter, values, id) =>
    setter(
      values.includes(String(id))
        ? values.filter((value) => value !== String(id))
        : [...values, String(id)],
    );

  async function createPlan(event) {
    event.preventDefault();
    if (!selectedProjectId || !selectedProfileIds.length || !selectedTemplateIds.length) {
      setError("Selecciona un proyecto, al menos un perfil y una plantilla.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await api("/studio/concept-plans/", {
        method: "POST",
        body: JSON.stringify({
          project_id: selectedProjectId,
          total_ads_requested: Number(totalAdsRequested),
          profile_ids: selectedProfileIds,
          template_ids: selectedTemplateIds,
        }),
      });
      setConceptPlan(response);
      setExpandedBatch(null);
      setNotice("Concept Plan generado. Revísalo antes de crear configuraciones.");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function expandPlan() {
    if (!conceptPlan?.concept_plan_id) return;
    setBusy(true);
    setError("");
    try {
      const response = await api(
        `/studio/concept-plans/${conceptPlan.concept_plan_id}/generate/`,
        { method: "POST" },
      );
      setExpandedBatch(response.batch);
      setNotice("Configuraciones creadas como borrador. Aún no se enviaron al worker.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <><Nav privateNav /><main className="page"><div className="loading">Cargando Concept Planner…</div></main></>;
  }

  return (
    <><Nav privateNav /><main className="page page--concept-planner">
      <PageTitle
        className="catalog-page-header--unified"
        eyebrow="Planificación asistida"
        title="Concept Planner"
        description="Combina proyecto, inteligencia de audiencia y plantillas para diseñar conceptos antes de generar imágenes."
      />
      {error && <div className="error" role="alert">{error}</div>}
      {notice && <div className="notice success" role="status">{notice}</div>}

      <nav className="cp-journey" aria-label="Progreso del Concept Planner">
        <div className={!conceptPlan ? "is-current" : "is-complete"}>
          <span>01</span><div><strong>Configurar</strong><small>Contexto y estrategia</small></div>
        </div>
        <i aria-hidden="true" />
        <div className={conceptPlan && !expandedBatch ? "is-current" : conceptPlan ? "is-complete" : ""}>
          <span>02</span><div><strong>Revisar</strong><small>Conceptos y asignación</small></div>
        </div>
        <i aria-hidden="true" />
        <div className={expandedBatch ? "is-current" : ""}>
          <span>03</span><div><strong>Producir</strong><small>Configuraciones listas</small></div>
        </div>
      </nav>

      {!conceptPlan ? (
        <form className="cp-config" onSubmit={createPlan}>
          <section className="panel cp-step">
            <header><b>01</b><div><h2>Proyecto base</h2><p>El brief y sus recursos serán el contexto de producción.</p></div></header>
            <select className="input" value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)} required>
              <option value="">Selecciona un proyecto…</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
            {selectedProject && <div className="cp-project-context"><div><span>Proyecto</span><strong>{selectedProject.name}</strong></div><div><span>Producto</span><strong>{selectedProject.product_name || "Sin producto"}</strong></div><div><span>Tema</span><strong>{selectedProject.campaign_theme || "Sin tema"}</strong></div><div><span>Titular</span><strong>{selectedProject.headline || "Sin titular"}</strong></div><div><span>Oferta</span><strong>{selectedProject.offer_text || "Sin oferta"}</strong></div><div><span>CTA</span><strong>{selectedProject.call_to_action || "Sin CTA"}</strong></div><div><span>Contexto visual</span><strong>{(selectedProject.input_assets?.length || 0) + (selectedProject.references?.length || 0)} recursos</strong></div></div>}
          </section>

          <section className="panel cp-step">
            <header><b>02</b><div><h2>Perfiles estratégicos</h2><p>Selecciona una o varias perspectivas de audiencia.</p></div><span>{selectedProfileIds.length} seleccionados</span></header>
            <div className="cp-card-grid">{profiles.map((profile) => <SelectCard key={profile.id} label={profile.persona} active={selectedProfileIds.includes(String(profile.id))} onClick={() => toggle(setSelectedProfileIds, selectedProfileIds, profile.id)}><span className="badge active">{profile.emotion || "Estrategia"}</span><h3>{profile.persona}</h3><p>{profile.pain_point}</p><strong>{profile.angle}</strong></SelectCard>)}</div>
            {!profiles.length && <div className="notice info">No hay perfiles activos. Crea uno en Inteligencia de marca.</div>}
          </section>

          <section className="panel cp-step">
            <header><b>03</b><div><h2>Plantillas creativas</h2><p>Define las familias visuales disponibles para el planner.</p></div><span>{selectedTemplateIds.length} seleccionadas</span></header>
            <div className="cp-card-grid cp-template-grid">{templates.map((template) => <SelectCard key={template.id} label={template.name} active={selectedTemplateIds.includes(String(template.id))} onClick={() => toggle(setSelectedTemplateIds, selectedTemplateIds, template.id)}>{previewUrl(template) ? <img src={previewUrl(template)} alt="" /> : <div className="cp-template-placeholder">Sin ejemplo</div>}<span className="badge">{template.format_specs?.aspect_ratio || template.format}</span><h3>{template.name}</h3><p>{template.visual_structure || template.description || "Dirección por definir"}</p><small>{template.example_images?.length || 0} ejemplos</small></SelectCard>)}</div>
            {!templates.length && <div className="notice info">No hay plantillas activas disponibles.</div>}
          </section>

          <section className="panel cp-step cp-total"><header><b>04</b><div><h2>Volumen de campaña</h2><p>El planner distribuirá exactamente esta cantidad entre los conceptos.</p></div></header><label><span>Total de anuncios</span><input className="input" type="number" min="1" max="50" value={totalAdsRequested} onChange={(e) => setTotalAdsRequested(Math.max(1, Math.min(50, Number(e.target.value || 1))))}/></label><button className="btn btn-primary" disabled={busy}>{busy ? "Planificando…" : "Generar Concept Plan"}</button></section>
        </form>
      ) : (
        <section className="cp-review">
          <header className="panel cp-review__summary"><div><span className="eyebrow">Plan listo para revisión</span><h2>{selectedProject?.name || "Concept Plan"}</h2><p>{concepts.length} conceptos · {conceptPlan.total_ads_requested} anuncios solicitados</p></div><div className={`cp-allocation ${assignedJobs === Number(conceptPlan.total_ads_requested) ? "ok" : "warning"}`}><strong>{assignedJobs} / {conceptPlan.total_ads_requested}</strong><span>jobs asignados</span></div></header>
          {assignedJobs !== Number(conceptPlan.total_ads_requested) && <div className="notice warning">La distribución no coincide con el total solicitado. Revisa el plan antes de expandir.</div>}
          <div className="cp-concepts">{concepts.map((concept, index) => { const profile = profiles.find((item) => String(item.id) === String(concept.profile_id)); const template = templates.find((item) => String(item.id) === String(concept.ad_template_id)); return <article className="panel cp-concept" key={concept.concept_index || index}><header><b>{String(concept.concept_index || index + 1).padStart(2, "0")}</b><div><span>{profile?.persona || concept.persona || "Perfil estratégico"}</span><h3>{concept.hook_variants?.[0] || concept.angle || "Concepto creativo"}</h3></div><em>{concept.ads_count || 0} jobs</em></header><dl><div><dt>Plantilla</dt><dd>{template?.name || "Plantilla seleccionada"}</dd></div><div><dt>Ángulo</dt><dd>{concept.angle || profile?.angle || "—"}</dd></div><div><dt>Copy principal</dt><dd>{concept.body_copy_primary || "—"}</dd></div><div><dt>Variante</dt><dd>{concept.body_copy_variant_a || "—"}</dd></div><div><dt>CTA</dt><dd>{concept.cta || "—"}</dd></div><div><dt>Dirección visual</dt><dd>{concept.visual_direction || "—"}</dd></div></dl>{concept.hook_variants?.length > 0 && <div className="cp-hooks">{concept.hook_variants.map((hook) => <span key={hook}>{hook}</span>)}</div>}<footer><span>Rationale</span><p>{concept.rationale || "Sin rationale"}</p></footer></article>; })}</div>
          <footer className="panel cp-review__actions"><button className="btn btn-secondary" onClick={() => { setConceptPlan(null); setExpandedBatch(null); }}>Crear otro plan</button>{!expandedBatch ? <button className="btn btn-primary" onClick={expandPlan} disabled={busy}>{busy ? "Creando…" : "Crear configuraciones"}</button> : <div><span className="badge active">Batch draft · {expandedBatch.jobs?.length || 0} jobs</span><button className="btn btn-primary" onClick={() => router.push(`/workspace?batch=${expandedBatch.id}`)}>Abrir configuraciones</button></div>}</footer>
        </section>
      )}
    </main></>
  );
}

export default function ConceptPlannerPage() {
  return <Suspense fallback={<main className="page"><div className="loading">Cargando planner…</div></main>}><ConceptPlannerContent /></Suspense>;
}
