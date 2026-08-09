"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Nav from "@/components/Nav";
import { api, ensureWorkspace } from "@/lib/api";

const emptyProfile = {
  persona: "",
  pain_point: "",
  angle: "",
  visual_direction: "",
  emotion: "",
  copy_hook: "",
  is_active: true,
  metadata: {},
};

const Icon = ({ children }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
);

function ProfileCard({ profile, selected, onSelect, onEdit, onToggle }) {
  return (
    <article className={`bi-card ${selected ? "is-selected" : ""}`} onClick={() => onSelect(profile)}>
      <header>
        <span className="bi-card__avatar">{profile.persona.slice(0, 1).toUpperCase()}</span>
        <div><span className="bi-eyebrow">Audiencia</span><h3>{profile.persona}</h3></div>
        <span className={`bi-status ${profile.is_active ? "active" : ""}`}>{profile.is_active ? "Activo" : "Inactivo"}</span>
      </header>
      <p className="bi-card__pain">{profile.pain_point}</p>
      <div className="bi-card__angle"><span>Ángulo estratégico</span><strong>{profile.angle}</strong></div>
      <footer>
        <span>{profile.emotion || "Emoción por definir"}</span>
        <div>
          <button type="button" onClick={(event) => { event.stopPropagation(); onToggle(profile); }}>{profile.is_active ? "Pausar" : "Activar"}</button>
          <button type="button" className="primary" onClick={(event) => { event.stopPropagation(); onEdit(profile); }}>Editar</button>
        </div>
      </footer>
    </article>
  );
}

function ProfileForm({ initial, busy, onCancel, onSave }) {
  const [form, setForm] = useState(initial || emptyProfile);
  useEffect(() => setForm(initial || { ...emptyProfile }), [initial]);
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const completion = Math.round((["persona", "pain_point", "angle", "visual_direction", "emotion", "copy_hook"].filter((key) => form[key]?.trim()).length / 6) * 100);

  return (
    <form className="bi-editor" onSubmit={(event) => { event.preventDefault(); onSave(form); }}>
      <header className="bi-editor__header">
        <div><span className="bi-eyebrow">{initial?.id ? "Editar perfil" : "Nuevo perfil"}</span><h2>{initial?.id ? "Refina tu inteligencia" : "Define una audiencia accionable"}</h2><p>Convierte conocimiento de cliente en una dirección lista para crear campañas.</p></div>
        <div className="bi-progress"><strong>{completion}%</strong><span>Completado</span><i><b style={{ width: `${completion}%` }} /></i></div>
      </header>

      <div className="bi-editor__grid">
        <section>
          <div className="bi-section-title"><b>01</b><div><h3>Quién es y qué necesita</h3><p>Describe a una persona concreta, no a un segmento demográfico genérico.</p></div></div>
          <label className="bi-field bi-field--wide"><span>Persona <b>*</b></span><textarea value={form.persona} onChange={(e) => update("persona", e.target.value)} placeholder="Ej. Dueña de una tienda online que gestiona sola su marketing…" required maxLength={2000} /><small>{form.persona.length}/2000</small></label>
          <label className="bi-field bi-field--wide"><span>Dolor principal <b>*</b></span><textarea value={form.pain_point} onChange={(e) => update("pain_point", e.target.value)} placeholder="¿Qué problema urgente le impide avanzar?" required maxLength={2000} /><small>{form.pain_point.length}/2000</small></label>
        </section>

        <section>
          <div className="bi-section-title"><b>02</b><div><h3>Cómo conectar</h3><p>Define la promesa estratégica y el disparador emocional.</p></div></div>
          <label className="bi-field bi-field--wide"><span>Ángulo de comunicación <b>*</b></span><textarea value={form.angle} onChange={(e) => update("angle", e.target.value)} placeholder="Ej. Recupera horas de trabajo sin sacrificar calidad visual…" required maxLength={2000} /><small>{form.angle.length}/2000</small></label>
          <div className="bi-fields-row">
            <label className="bi-field"><span>Emoción objetivo</span><input value={form.emotion} onChange={(e) => update("emotion", e.target.value)} placeholder="Alivio, confianza…" maxLength={150} /></label>
            <label className="bi-field"><span>Hook de copy</span><input value={form.copy_hook} onChange={(e) => update("copy_hook", e.target.value)} placeholder="La frase que detiene el scroll" /></label>
          </div>
        </section>

        <section>
          <div className="bi-section-title"><b>03</b><div><h3>Dar forma a la idea</h3><p>Traduce la estrategia en decisiones visuales concretas.</p></div></div>
          <label className="bi-field bi-field--wide"><span>Dirección visual</span><textarea value={form.visual_direction} onChange={(e) => update("visual_direction", e.target.value)} placeholder="Composición, escena, iluminación, actitud, ritmo y referencias visuales…" maxLength={3000} /><small>{form.visual_direction.length}/3000</small></label>
          <label className="bi-switch"><input type="checkbox" checked={form.is_active} onChange={(e) => update("is_active", e.target.checked)} /><i /><span><strong>Perfil activo</strong><small>Disponible para orientar nuevas campañas.</small></span></label>
        </section>
      </div>

      <footer className="bi-editor__actions"><button type="button" onClick={onCancel}>Cancelar</button><button className="primary" disabled={busy}>{busy ? "Guardando…" : initial?.id ? "Guardar cambios" : "Crear perfil"}</button></footer>
    </form>
  );
}

export default function BrandIntelligencePage() {
  const router = useRouter();
  const [profiles, setProfiles] = useState([]);
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(undefined);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("active");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [researchOpen, setResearchOpen] = useState(false);
  const [research, setResearch] = useState("");
  const [numberOfProfiles, setNumberOfProfiles] = useState(6);
  const [replaceExisting, setReplaceExisting] = useState(false);

  async function load() {
    await ensureWorkspace();
    const data = await api("/studio/brand-intelligence/");
    setProfiles(data.results || data);
  }
  useEffect(() => { load().catch((e) => setMessage({ type: "error", text: e.message })).finally(() => setLoading(false)); }, []);
  const visible = useMemo(() => profiles.filter((profile) => {
    const term = search.toLowerCase().trim();
    const statusMatch = filter === "all" || (filter === "active" ? profile.is_active : !profile.is_active);
    return statusMatch && (!term || [profile.persona, profile.pain_point, profile.angle, profile.emotion].some((value) => value?.toLowerCase().includes(term)));
  }), [profiles, search, filter]);
  const flash = (type, text) => { setMessage({ type, text }); window.setTimeout(() => setMessage(null), 5000); };

  async function save(form) {
    setBusy(true);
    try {
      const data = await api(editing?.id ? `/studio/brand-intelligence/${editing.id}/` : "/studio/brand-intelligence/", { method: editing?.id ? "PATCH" : "POST", body: JSON.stringify(form) });
      await load(); setEditing(undefined); setSelected(data); flash("success", editing?.id ? "Perfil actualizado correctamente." : "Perfil creado y listo para usar.");
    } catch (e) { flash("error", e.message); } finally { setBusy(false); }
  }
  async function toggle(profile) {
    try { await api(`/studio/brand-intelligence/${profile.id}/`, { method: "PATCH", body: JSON.stringify({ is_active: !profile.is_active }) }); await load(); flash("success", profile.is_active ? "Perfil pausado." : "Perfil activado."); } catch (e) { flash("error", e.message); }
  }
  async function remove(profile) {
    if (!window.confirm(`¿Eliminar el perfil “${profile.persona}”? Esta acción no se puede deshacer.`)) return;
    try { await api(`/studio/brand-intelligence/${profile.id}/`, { method: "DELETE" }); setSelected(null); await load(); flash("success", "Perfil eliminado."); } catch (e) { flash("error", e.message); }
  }
  async function generate(event) {
    event.preventDefault(); setBusy(true);
    try { await api("/studio/brand-intelligence/generate/", { method: "POST", body: JSON.stringify({ research_notes: research, number_of_profiles: Number(numberOfProfiles), replace_existing: replaceExisting }) }); await load(); setResearchOpen(false); flash("success", `${numberOfProfiles} perfiles generados correctamente.`); }
    catch (e) { flash("info", e.message); } finally { setBusy(false); }
  }

  return <><Nav privateNav /><main className="page page--bi">
    <header className="bi-hero"><div><span className="bi-eyebrow">Estrategia de marca</span><h1>Inteligencia de marca</h1><p>Transforma lo que sabes de tus clientes en perfiles que guían mensajes, imágenes y campañas con intención.</p></div><div className="bi-hero__actions"><button onClick={() => setResearchOpen(true)}><Icon><path d="m12 3 1.4 4.6L18 9l-4.6 1.4L12 15l-1.4-4.6L6 9l4.6-1.4L12 3Z" /></Icon>Generar con investigación</button><button className="primary" onClick={() => setEditing(null)}>+ Nuevo perfil</button></div></header>
    {message && <div className={`bi-toast ${message.type}`}><span>{message.type === "success" ? "✓" : message.type === "error" ? "!" : "i"}</span>{message.text}<button onClick={() => setMessage(null)}>×</button></div>}
    <section className="bi-metrics"><article><span>Perfiles totales</span><strong>{profiles.length}</strong><small>Base estratégica</small></article><article><span>Activos</span><strong>{profiles.filter((p) => p.is_active).length}</strong><small>Listos para campañas</small></article><article><span>Emociones mapeadas</span><strong>{new Set(profiles.map((p) => p.emotion).filter(Boolean)).size}</strong><small>Disparadores distintos</small></article></section>

    {editing !== undefined ? <ProfileForm initial={editing} busy={busy} onCancel={() => setEditing(undefined)} onSave={save} /> : <>
      <div className="bi-toolbar"><label><Icon><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></Icon><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por audiencia, dolor o ángulo…" /></label><div>{[["active", "Activos"], ["inactive", "Inactivos"], ["all", "Todos"]].map(([value, label]) => <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{label}</button>)}</div></div>
      {loading ? <div className="bi-empty"><span className="bi-loader"/><h2>Cargando inteligencia…</h2></div> : visible.length ? <div className="bi-workspace"><div className="bi-grid">{visible.map((profile) => <ProfileCard key={profile.id} profile={profile} selected={selected?.id === profile.id} onSelect={setSelected} onEdit={(p) => setEditing(p)} onToggle={toggle} />)}</div>{selected && <aside className="bi-detail"><header><span className="bi-eyebrow">Vista estratégica</span><button onClick={() => setSelected(null)}>×</button></header><h2>{selected.persona}</h2><section><span>Problema central</span><p>{selected.pain_point}</p></section><section className="accent"><span>Ángulo creativo</span><p>{selected.angle}</p></section><section><span>Hook recomendado</span><blockquote>{selected.copy_hook || "Aún no definido"}</blockquote></section><section><span>Dirección visual</span><p>{selected.visual_direction || "Aún no definida"}</p></section><div className="bi-detail__emotion"><small>Emoción a provocar</small><strong>{selected.emotion || "Por definir"}</strong></div><footer><button onClick={() => remove(selected)}>Eliminar</button><button onClick={() => router.push(`/concept-planner?profile=${selected.id}`)}>Usar en Concept Planner</button><button className="primary" onClick={() => setEditing(selected)}>Editar perfil</button></footer></aside>}</div> : <div className="bi-empty"><span><Icon><circle cx="12" cy="12" r="8"/><path d="M12 8v8M8 12h8"/></Icon></span><h2>{profiles.length ? "No encontramos coincidencias" : "Tu estrategia empieza con una persona"}</h2><p>{profiles.length ? "Prueba otro término o cambia el filtro." : "Crea tu primer perfil para alinear mensajes, dirección visual y emociones."}</p>{!profiles.length && <button className="primary" onClick={() => setEditing(null)}>Crear primer perfil</button>}</div>}
    </>}
    {researchOpen && <div className="bi-modal" role="dialog" aria-modal="true"><button className="bi-modal__scrim" onClick={() => setResearchOpen(false)} aria-label="Cerrar"/><form onSubmit={generate}><header><div><span className="bi-eyebrow">Asistente estratégico</span><h2>Generar desde investigación</h2></div><button type="button" onClick={() => setResearchOpen(false)}>×</button></header><p>Pega entrevistas, reseñas o notas de mercado. El compositor analizará patrones para proponer perfiles accionables.</p><label className="bi-field"><span>Notas de investigación <b>*</b></span><textarea value={research} onChange={(e) => setResearch(e.target.value)} minLength={30} required placeholder="Incluye frases reales, objeciones, necesidades y contexto…" /><small>{research.length} caracteres · mínimo 30</small></label><div className="bi-research-options"><label className="bi-field"><span>Número de perfiles</span><input type="number" min="1" max="20" value={numberOfProfiles} onChange={(e) => setNumberOfProfiles(Math.max(1, Math.min(20, Number(e.target.value || 1))))}/></label><label className="bi-switch"><input type="checkbox" checked={replaceExisting} onChange={(e) => setReplaceExisting(e.target.checked)}/><i/><span><strong>Reemplazar perfiles existentes</strong><small>Desactiva los perfiles actuales del workspace antes de crear los nuevos.</small></span></label></div><div className="bi-modal__notice"><b>Generación estratégica</b><span>Gemini usará las notas y la identidad de marca del workspace. Reemplazar afecta al conjunto actual de perfiles, no solo a estas notas.</span></div><footer><button type="button" onClick={() => setResearchOpen(false)}>Cancelar</button><button className="primary" disabled={busy || research.trim().length < 30}>{busy ? "Analizando…" : `Generar ${numberOfProfiles} perfiles`}</button></footer></form></div>}
  </main></>;
}
