"use client";

import { useEffect, useMemo, useState } from "react";
import Nav from "@/components/Nav";
import PageTitle from "@/components/PageTitle";
import { api, ensureWorkspace } from "@/lib/api";
import {
  ChoiceCards,
  ObjectList,
  TagsInput,
} from "@/components/StructuredFields";

const kitBlank = {
  brand_name: "",
  brand_description: "",
  primary_color: "#1F3A5F",
  secondary_color: "#EEF2F7",
  accent_color: "#F2B84B",
  font_primary: "Inter",
  font_secondary: "Playfair Display",
  tone_of_voice: "",
  default_call_to_action: "",
  logo_url: "",
  logo_dark_url: "",
  logo_light_url: "",
};
const ruleBlank = {
  allowed_colors: [],
  forbidden_colors: [],
  allowed_fonts: [],
  required_elements: [],
  forbidden_elements: [],
  preferred_terms: [],
  forbidden_terms: [],
  logo_position_preferences: [],
};
const categories = [
  "product",
  "packaging",
  "lifestyle",
  "logo",
  "persona",
  "reference_ad",
  "template",
  "background",
  "icon",
  "other",
];
const blankAssetMetadata = {};
const brandColors = [
  "#171A20",
  "#242831",
  "#FBF8F2",
  "#F3EEE6",
  "#B67A45",
  "#D49A67",
  "#E3C59B",
  "#AEB9A5",
  "#D9B6A6",
  "#B9CBD5",
  "#C8C0D8",
  "#3D8F6C",
  "#C18B2D",
  "#C95A5A",
  "#FFFFFF",
  "#000000",
];
const metadataFields = [
  ["usage_rights", "Derechos de uso", "select", "owned"],
  ["orientation", "Orientación", "select", "auto"],
  ["tags", "Etiquetas", "tags", []],
  ["dominant_colors", "Colores dominantes", "colors", []],
  ["notes", "Notas curatoriales", "textarea", ""],
  ["has_transparency", "Transparencia", "boolean", false],
  ["source", "Fuente", "text", "user_upload"],
];
const preferenceBlank = {
  learned_preferences: {},
};
function normalizeRules(rule) {
  const convert = (key, item) => {
    if (typeof item !== "string") return item;
    if (key === "allowed_colors")
      return {
        name: item,
        hex: item.startsWith("#") ? item : "#203764",
        usage: "primary",
      };
    if (key === "forbidden_colors")
      return {
        name: item,
        hex: item.startsWith("#") ? item : "#FF0000",
        reason: "",
      };
    if (key === "allowed_fonts")
      return { family: item, usage: "body", fallback: "Arial" };
    if (key === "required_elements")
      return { type: "other", label: item, required: true };
    if (key === "preferred_terms") return { term: item, context: "" };
    if (key === "forbidden_terms") return { term: item, replacement: "" };
    if (key === "logo_position_preferences")
      return { position: item, priority: 1, minimum_margin: 30 };
    return item;
  };
  return Object.fromEntries(
    Object.keys(ruleBlank).map((key) => [
      key,
      (rule?.[key] || []).map((item) => convert(key, item)),
    ]),
  );
}

function Field({ label, hint, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

function BrandColorField({ label, value, onChange }) {
  const safeValue = /^#[0-9a-f]{6}$/i.test(value || "") ? value : "#000000";
  return (
    <div className="panel">
      <div className="section-header">
        <span>
          <i style={{ background: safeValue }} />
          <b>{label}</b>
        </span>
        <label>
          <input
            type="color"
            value={safeValue}
            onChange={(event) => onChange(event.target.value.toUpperCase())}
          />
          <span>Selector</span>
        </label>
      </div>
      <div
        className="swatch-row"
        aria-label={`Colores sugeridos para ${label}`}
      >
        {brandColors.map((color) => (
          <button
            type="button"
            key={color}
            className={safeValue.toUpperCase() === color ? "active" : ""}
            style={{ background: color }}
            onClick={() => onChange(color)}
            aria-label={`Usar color ${color}`}
            title={color}
          />
        ))}
      </div>
      <label className="field">
        <span>HEX</span>
        <input
          className="input"
          value={value}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          placeholder="#171A20"
          maxLength={7}
        />
      </label>
    </div>
  );
}

function ColorListPicker({ value = [], onChange }) {
  const [draft, setDraft] = useState("");
  function add(color) {
    const next = color.toUpperCase();
    if (/^#[0-9A-F]{6}$/.test(next) && !value.includes(next))
      onChange([...value, next]);
    setDraft("");
  }
  return (
    <div className="metadata-color-picker">
      <div className="swatch-row">
        {brandColors.map((color) => (
          <button
            type="button"
            key={color}
            className={value.includes(color) ? "active" : ""}
            style={{ background: color }}
            onClick={() =>
              value.includes(color)
                ? onChange(value.filter((item) => item !== color))
                : onChange([...value, color])
            }
            aria-label={`${value.includes(color) ? "Quitar" : "Agregar"} ${color}`}
            title={color}
          />
        ))}
      </div>
      <div className="metadata-color-picker__input">
        <input
          className="input"
          value={draft}
          onChange={(event) => setDraft(event.target.value.toUpperCase())}
          placeholder="#B67A45"
          maxLength={7}
        />
        <button
          type="button"
          onClick={() => add(draft)}
          disabled={!/^#[0-9A-F]{6}$/.test(draft)}
        >
          Agregar HEX
        </button>
      </div>
      {value.length > 0 && (
        <div className="metadata-color-values">
          {value.map((color) => (
            <button
              type="button"
              key={color}
              onClick={() => onChange(value.filter((item) => item !== color))}
            >
              <i style={{ background: color }} />
              {color}
              <b>×</b>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MetadataBuilder({ value, onChange }) {
  const [field, setField] = useState("");
  const available = metadataFields.filter(([key]) => !(key in value));
  function addField() {
    const definition = metadataFields.find(([key]) => key === field);
    if (!definition) return;
    onChange({ ...value, [definition[0]]: definition[3] });
    setField("");
  }
  function update(key, next) {
    onChange({ ...value, [key]: next });
  }
  function remove(key) {
    const next = { ...value };
    delete next[key];
    onChange(next);
  }
  return (
    <section className="metadata-builder">
      <header>
        <div>
          <span>Metadatos opcionales</span>
          <p>Agrega únicamente el contexto que aporte valor a este recurso.</p>
        </div>
        <div>
          <select
            className="input"
            value={field}
            onChange={(event) => setField(event.target.value)}
          >
            <option value="">Elegir campo…</option>
            {available.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <button type="button" onClick={addField} disabled={!field}>
            + Añadir
          </button>
        </div>
      </header>
      <div className="metadata-builder__fields">
        {Object.entries(value).map(([key, current]) => {
          const definition = metadataFields.find((item) => item[0] === key);
          if (!definition) return null;
          const [, label, type] = definition;
          return (
            <article key={key}>
              <header>
                <span>{label}</span>
                <button
                  type="button"
                  onClick={() => remove(key)}
                  aria-label={`Quitar ${label}`}
                >
                  ×
                </button>
              </header>
              {key === "usage_rights" ? (
                <select
                  className="input"
                  value={current}
                  onChange={(event) => update(key, event.target.value)}
                >
                  <option value="owned">Propio</option>
                  <option value="licensed">Con licencia</option>
                  <option value="restricted">Uso restringido</option>
                  <option value="unknown">Por confirmar</option>
                </select>
              ) : key === "orientation" ? (
                <select
                  className="input"
                  value={current}
                  onChange={(event) => update(key, event.target.value)}
                >
                  <option value="auto">Detección automática</option>
                  <option value="portrait">Vertical</option>
                  <option value="landscape">Horizontal</option>
                  <option value="square">Cuadrada</option>
                </select>
              ) : type === "tags" ? (
                <TagsInput
                  value={current}
                  onChange={(next) => update(key, next)}
                  placeholder="Escribe y presiona Enter"
                />
              ) : type === "colors" ? (
                <ColorListPicker
                  value={current}
                  onChange={(next) => update(key, next)}
                />
              ) : type === "textarea" ? (
                <textarea
                  className="input"
                  value={current}
                  onChange={(event) => update(key, event.target.value)}
                  placeholder="Añade contexto útil…"
                />
              ) : type === "boolean" ? (
                <label className="metadata-boolean">
                  <input
                    type="checkbox"
                    checked={Boolean(current)}
                    onChange={(event) => update(key, event.target.checked)}
                  />
                  <span>El archivo contiene transparencia</span>
                </label>
              ) : (
                <input
                  className="input"
                  value={current}
                  onChange={(event) => update(key, event.target.value)}
                />
              )}
            </article>
          );
        })}
        {!Object.keys(value).length && (
          <div className="metadata-builder__empty">
            Sin metadatos adicionales. Puedes guardar el recurso así o añadir
            contexto.
          </div>
        )}
      </div>
    </section>
  );
}

function FontPicker({ id, label, value, fonts, onChange }) {
  return (
    <Field
      label={label}
      hint="Busca por nombre o escribe una familia de Google Fonts."
    >
      <input
        className="input"
        list={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Buscar tipografía…"
      />
      <datalist id={id}>
        {fonts.map((font) => (
          <option value={font} key={font} />
        ))}
      </datalist>
      <div
        className="font-sample"
        style={{ fontFamily: `'${value}', sans-serif` }}
      >
        Aa — La identidad empieza con una buena voz.
      </div>
    </Field>
  );
}

function LogoUploader({ label, value, busy, onUpload, onClear }) {
  return (
    <div className="logo-slot">
      <div className="logo-frame">
        {value ? <img src={value} alt={label} /> : <span>Sin imagen</span>}
      </div>
      <div>
        <strong>{label}</strong>
        <small>PNG, JPG o WebP · recomendado fondo transparente</small>
      </div>
      <label className="btn btn-secondary file-button">
        {busy ? "Subiendo…" : value ? "Reemplazar" : "Cargar imagen"}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          disabled={busy}
          onChange={(e) => e.target.files[0] && onUpload(e.target.files[0])}
        />
      </label>
      {value && (
        <button type="button" className="text-button danger" onClick={onClear}>
          Quitar
        </button>
      )}
    </div>
  );
}

function RulesEditor({ value, onChange, fonts }) {
  const set = (key, next) => onChange({ ...value, [key]: next });
  return (
    <div className="rules-builder">
      <div className="structured-section">
        <div className="structured-heading">
          <div>
            <span>Paleta permitida</span>
            <p>Colores aprobados y su función en las piezas.</p>
          </div>
        </div>
        <ObjectList
          value={value.allowed_colors}
          onChange={(v) => set("allowed_colors", v)}
          addLabel="Agregar color permitido"
          fields={[
            { key: "name", label: "Nombre", placeholder: "Azul corporativo" },
            { key: "hex", label: "Color", type: "color", default: "#203764" },
            {
              key: "usage",
              label: "Uso",
              type: "select",
              default: "primary",
              options: [
                ["primary", "Principal"],
                ["secondary", "Secundario"],
                ["accent", "Acento"],
                ["background", "Fondo"],
                ["text", "Texto"],
              ],
            },
          ]}
        />
      </div>
      <div className="structured-section">
        <div className="structured-heading">
          <div>
            <span>Colores prohibidos</span>
            <p>Indica qué debe evitar la IA y por qué.</p>
          </div>
        </div>
        <ObjectList
          value={value.forbidden_colors}
          onChange={(v) => set("forbidden_colors", v)}
          addLabel="Agregar color prohibido"
          fields={[
            { key: "name", label: "Nombre", placeholder: "Rojo brillante" },
            { key: "hex", label: "Color", type: "color", default: "#FF0000" },
            {
              key: "reason",
              label: "Motivo",
              wide: true,
              placeholder: "No coincide con la identidad…",
            },
          ]}
        />
      </div>
      <div className="structured-section">
        <div className="structured-heading">
          <div>
            <span>Tipografías autorizadas</span>
            <p>Familia, uso y alternativa segura.</p>
          </div>
        </div>
        <ObjectList
          value={value.allowed_fonts}
          onChange={(v) => set("allowed_fonts", v)}
          addLabel="Agregar tipografía"
          fields={[
            {
              key: "family",
              label: "Familia",
              placeholder: fonts[0] || "Inter",
            },
            {
              key: "usage",
              label: "Uso",
              type: "select",
              default: "body",
              options: [
                ["headline", "Títulos"],
                ["body", "Texto general"],
                ["accent", "Acentos"],
              ],
            },
            { key: "fallback", label: "Alternativa", placeholder: "Arial" },
          ]}
        />
      </div>
      <div className="structured-section">
        <div className="structured-heading">
          <div>
            <span>Elementos obligatorios</span>
            <p>Marca lo que debe aparecer y cuándo.</p>
          </div>
        </div>
        <ObjectList
          value={value.required_elements}
          onChange={(v) => set("required_elements", v)}
          addLabel="Agregar requisito"
          fields={[
            {
              key: "type",
              label: "Tipo",
              type: "select",
              default: "logo",
              options: [
                ["logo", "Logo"],
                ["cta", "Llamado a la acción"],
                ["price", "Precio"],
                ["url", "URL"],
                ["qr", "Código QR"],
              ],
            },
            { key: "label", label: "Etiqueta", placeholder: "Logo principal" },
            {
              key: "required",
              label: "Siempre obligatorio",
              type: "checkbox",
              default: true,
            },
            {
              key: "condition",
              label: "Condición",
              placeholder: "Ej. solo si hay oferta",
            },
          ]}
        />
      </div>
      <div className="rule-grid">
        <Field
          label="Elementos a evitar"
          hint="Objetos, símbolos o estilos que no deben aparecer."
        >
          <TagsInput
            value={(value.forbidden_elements || []).map((item) =>
              typeof item === "string" ? item : item.label || item.value,
            )}
            onChange={(items) =>
              set(
                "forbidden_elements",
                items.map((label) => ({
                  type: "visual_element",
                  value: label.toLowerCase().replace(/\s+/g, "_"),
                  label,
                })),
              )
            }
          />
        </Field>
        <Field
          label="Términos preferidos"
          hint="Palabras o frases que representan la voz de tu marca."
        >
          <ObjectList
            value={value.preferred_terms}
            onChange={(v) => set("preferred_terms", v)}
            addLabel="Agregar término"
            fields={[
              { key: "term", label: "Término", placeholder: "calidad premium" },
              {
                key: "context",
                label: "Contexto",
                placeholder: "Descripción del producto",
              },
            ]}
          />
        </Field>
        <Field
          label="Términos prohibidos"
          hint="Incluye una alternativa segura cuando exista."
        >
          <ObjectList
            value={value.forbidden_terms}
            onChange={(v) => set("forbidden_terms", v)}
            addLabel="Agregar término"
            fields={[
              { key: "term", label: "Evitar", placeholder: "barato" },
              {
                key: "replacement",
                label: "Usar en su lugar",
                placeholder: "precio accesible",
              },
            ]}
          />
        </Field>
        <Field
          label="Posiciones preferidas del logo"
          hint="Ordénalas según prioridad."
        >
          <ObjectList
            value={value.logo_position_preferences}
            onChange={(v) => set("logo_position_preferences", v)}
            addLabel="Agregar posición"
            fields={[
              {
                key: "position",
                label: "Posición",
                type: "select",
                default: "top_left",
                options: [
                  ["top_left", "Superior izquierda"],
                  ["top_center", "Superior centro"],
                  ["top_right", "Superior derecha"],
                  ["bottom_left", "Inferior izquierda"],
                  ["bottom_center", "Inferior centro"],
                  ["bottom_right", "Inferior derecha"],
                ],
              },
              {
                key: "priority",
                label: "Prioridad",
                type: "number",
                default: 1,
                min: 1,
              },
              {
                key: "minimum_margin",
                label: "Margen mínimo (px)",
                type: "number",
                default: 30,
                min: 0,
              },
            ]}
          />
        </Field>
      </div>
    </div>
  );
}

function SummaryItem({ label, value, children }) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      {children || <strong>{value || "Sin configurar"}</strong>}
    </div>
  );
}

function BrandConfiguredView({
  tab,
  form,
  rule,
  preference,
  assets,
  onEdit,
  onRemoveAsset,
}) {
  const list = (items, key) =>
    items?.length ? (
      items.map((item, index) => (
        <span key={index}>
          {typeof item === "string"
            ? item
            : item[key] || item.name || item.label || "Configurado"}
        </span>
      ))
    ) : (
      <em>Sin configurar</em>
    );
  if (tab === "assets")
    return (
      <div className="stack">
        <header className="section-header">
          <div>
            <span>Biblioteca visual</span>
            <h2>Recursos de marca</h2>
            <p>
              {assets.length} archivos disponibles para proyectos y
              generaciones.
            </p>
          </div>
          <button className="btn" onClick={onEdit}>
            + Añadir recurso
          </button>
        </header>
        <div className="catalog-grid">
          {assets.map((asset) => (
            <article key={asset.id}>
              <div className="thumb">
                {asset.file_url ? (
                  <img src={asset.file_url} alt={asset.name} />
                ) : (
                  <span>Archivo</span>
                )}{" "}
                {asset.is_favorite && <b>Favorito</b>}
              </div>
              <div className="catalog-body">
                <span>{asset.category?.replaceAll("_", " ")}</span>
                <h3>{asset.name}</h3>
                <p>
                  {asset.width
                    ? `${asset.width} × ${asset.height}px`
                    : asset.mime_type || "Recurso"}
                </p>
                {asset.metadata &&
                  Object.keys(asset.metadata).filter(
                    (key) => key !== "schema_version",
                  ).length > 0 && (
                    <dl>
                      {Object.entries(asset.metadata)
                        .filter(([key]) => key !== "schema_version")
                        .map(([key, value]) => (
                          <div key={key}>
                            <dt>
                              {metadataFields.find(
                                (item) => item[0] === key,
                              )?.[1] || key.replaceAll("_", " ")}
                            </dt>
                            <dd>
                              {Array.isArray(value)
                                ? value.join(" · ")
                                : typeof value === "boolean"
                                  ? value
                                    ? "Sí"
                                    : "No"
                                  : String(value)}
                            </dd>
                          </div>
                        ))}
                    </dl>
                  )}
              </div>
              <button
                className="text-button danger"
                onClick={() => onRemoveAsset(asset)}
              >
                Eliminar
              </button>
            </article>
          ))}
          {!assets.length && (
            <div className="empty-state">
              Tu biblioteca está lista para recibir el primer recurso.
            </div>
          )}
        </div>
      </div>
    );
  return (
    <div className="stack">
      <header className="section-header">
        <div>
          <span>Sistema configurado</span>
          <h2>
            {tab === "identity"
              ? "Identidad esencial"
              : tab === "typography"
                ? "Tipografía"
                : tab === "logos"
                  ? "Sistema de logos"
                  : tab === "rules"
                    ? "Reglas de marca"
                    : "Preferencias creativas"}
          </h2>
          <p>
            Consulta la configuración activa. Entra en edición únicamente cuando
            necesites cambiarla.
          </p>
        </div>
        <button className="btn btn-secondary" onClick={onEdit}>
          Editar configuración
        </button>
      </header>
      {tab === "identity" && (
        <>
          <div className="grid metrics-grid">
            <SummaryItem label="Marca" value={form.brand_name} />
            <SummaryItem
              label="CTA predeterminado"
              value={form.default_call_to_action}
            />
            <SummaryItem label="Descripción" value={form.brand_description} />
            <SummaryItem label="Tono de voz" value={form.tone_of_voice} />
          </div>
          <div className="swatch-row">
            {[
              ["Principal", form.primary_color],
              ["Secundario", form.secondary_color],
              ["Acento", form.accent_color],
            ].map(([label, color]) => (
              <div key={label}>
                <i style={{ background: color }} />
                <span>{label}</span>
                <strong>{color}</strong>
              </div>
            ))}
          </div>
        </>
      )}
      {tab === "typography" && (
        <div className="panel">
          <SummaryItem label="Títulos">
            <strong
              style={{ fontFamily: `'${form.font_primary}', sans-serif` }}
            >
              {form.font_primary || "Sin configurar"}
              <small>Ideas con dirección.</small>
            </strong>
          </SummaryItem>
          <SummaryItem label="Textos">
            <strong
              style={{ fontFamily: `'${form.font_secondary}', sans-serif` }}
            >
              {form.font_secondary || "Sin configurar"}
              <small>Una voz consistente en cada punto de contacto.</small>
            </strong>
          </SummaryItem>
        </div>
      )}
      {tab === "logos" && (
        <div className="panel">
          {[
            ["Principal", form.logo_url],
            ["Fondos oscuros", form.logo_dark_url],
            ["Fondos claros", form.logo_light_url],
          ].map(([label, url]) => (
            <article key={label}>
              <div>
                {url ? (
                  <img src={url} alt={`Logo ${label}`} />
                ) : (
                  <span>Sin imagen</span>
                )}
              </div>
              <strong>{label}</strong>
            </article>
          ))}
        </div>
      )}
      {tab === "rules" && (
        <div className="panel">
          <SummaryItem label="Colores permitidos">
            <div>{list(rule.allowed_colors, "hex")}</div>
          </SummaryItem>
          <SummaryItem label="Colores prohibidos">
            <div>{list(rule.forbidden_colors, "hex")}</div>
          </SummaryItem>
          <SummaryItem label="Tipografías permitidas">
            <div>{list(rule.allowed_fonts, "family")}</div>
          </SummaryItem>
          <SummaryItem label="Elementos obligatorios">
            <div>{list(rule.required_elements, "label")}</div>
          </SummaryItem>
          <SummaryItem label="Elementos prohibidos">
            <div>{list(rule.forbidden_elements)}</div>
          </SummaryItem>
          <SummaryItem label="Términos preferidos">
            <div>{list(rule.preferred_terms, "term")}</div>
          </SummaryItem>
          <SummaryItem label="Términos prohibidos">
            <div>{list(rule.forbidden_terms, "term")}</div>
          </SummaryItem>
          <SummaryItem label="Posición del logo">
            <div>{list(rule.logo_position_preferences, "position")}</div>
          </SummaryItem>
        </div>
      )}
      {tab === "preferences" && (
        <div className="panel">
          <SummaryItem label="Preferencias aprendidas">
            <div>
              {Object.keys(preference.learned_preferences || {}).length
                ? JSON.stringify(preference.learned_preferences, null, 2)
                : "Aún no hay preferencias aprendidas."}
            </div>
          </SummaryItem>
        </div>
      )}
    </div>
  );
}

function BrandLivePreview({ form, assets, rule, completion }) {
  const heroAsset =
    assets.find(
      (asset) =>
        ["product", "lifestyle", "reference_ad"].includes(asset.category) &&
        asset.file_url,
    ) || assets.find((asset) => asset.file_url);

  const secondaryColors = [
    ...(rule?.allowed_colors || []).map((item) =>
      typeof item === "string" ? item : item.hex,
    ),
  ]
    .filter(Boolean)
    .slice(0, 6);

  return (
    <aside className="inspector">
      <header>
        <div>
          <h2>Vista previa de marca</h2>
          <p>Así se verá tu identidad aplicada a contenidos de Ascend.</p>
        </div>
        <span>{completion}%</span>
      </header>

      <div
        className="creative-preview"
        style={{
          "--brand-primary": form.primary_color || "#1F3A5F",
          "--brand-secondary": form.secondary_color || "#EEF2F7",
          "--brand-accent": form.accent_color || "#F2B84B",
        }}
      >
        <div className="preview-copy">
          {form.logo_light_url || form.logo_url ? (
            <img
              src={form.logo_light_url || form.logo_url}
              alt={form.brand_name || "Logo"}
            />
          ) : (
            <strong>{form.brand_name || "Tu marca"}</strong>
          )}

          <h3>{form.default_call_to_action || "Crea sin límites."}</h3>
          <p>
            {form.brand_description ||
              "Una identidad consistente convierte cada generación en una expresión reconocible de tu marca."}
          </p>

          <button type="button">
            {form.default_call_to_action || "Comenzar ahora"}
          </button>
        </div>

        <div className="preview-art">
          {heroAsset?.file_url ? (
            <img
              src={heroAsset.file_url}
              alt={heroAsset.name || "Activo de marca"}
            />
          ) : (
            <span>{(form.brand_name || "A").slice(0, 1)}</span>
          )}
        </div>
      </div>

      <section className="panel">
        <span>Muestra tipográfica</span>

        <small>{form.font_primary || "Inter"} · Principal</small>
        <h3
          style={{
            fontFamily: `'${form.font_primary || "Inter"}', sans-serif`,
          }}
        >
          Título principal
        </h3>
        <p
          style={{
            fontFamily: `'${form.font_primary || "Inter"}', sans-serif`,
          }}
        >
          Una frase clara que expresa la promesa central.
        </p>

        <small>{form.font_secondary || "Playfair Display"} · Secundaria</small>
        <h4
          style={{
            fontFamily: `'${form.font_secondary || "Playfair Display"}', serif`,
          }}
        >
          Título secundario
        </h4>
        <p
          style={{
            fontFamily: `'${form.font_secondary || "Playfair Display"}', serif`,
          }}
        >
          Apoyo visual y emocional para complementar el mensaje.
        </p>
      </section>

      <section className="panel">
        <span>Paleta de colores</span>

        <div className="swatch-row">
          {[
            ["Primario", form.primary_color],
            ["Secundario", form.secondary_color],
            ["Acento", form.accent_color],
          ].map(([label, color]) => (
            <div key={label}>
              <small>{label}</small>
              <i style={{ background: color }} />
              <b>{color || "—"}</b>
            </div>
          ))}
        </div>

        <div className="swatch-row">
          {(secondaryColors.length
            ? secondaryColors
            : ["#171A20", "#AEB9A5", "#D9B6A6", "#B9CBD5", "#C8C0D8"]
          ).map((color) => (
            <i key={color} style={{ background: color }} title={color} />
          ))}
        </div>
      </section>

      <div className="notice info">
        <span>✦</span>
        <p>
          <strong>Consejo</strong>
          Verifica que logos, tipografías y colores mantengan contraste en
          fondos claros y oscuros.
        </p>
      </div>
    </aside>
  );
}

export default function BrandKitPage() {
  const [kit, setKit] = useState(null);
  const [form, setForm] = useState(kitBlank);
  const [rule, setRule] = useState(null);
  const [ruleForm, setRuleForm] = useState(ruleBlank);
  const [assets, setAssets] = useState([]);
  const [preference, setPreference] = useState(null);
  const [preferenceForm, setPreferenceForm] = useState(preferenceBlank);
  const [fonts, setFonts] = useState([
    "Inter",
    "Roboto",
    "Montserrat",
    "Playfair Display",
  ]);
  const [fontNotice, setFontNotice] = useState("");
  const [tab, setTab] = useState("identity");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState("");
  const [message, setMessage] = useState({ type: "", text: "" });
  const [assetDraft, setAssetDraft] = useState({
    name: "",
    category: "product",
    is_favorite: false,
    metadata: blankAssetMetadata,
  });
  const [assetFile, setAssetFile] = useState(null);

  useEffect(() => {
    async function load() {
      await ensureWorkspace();
      const [kitsData, rulesData, assetsData, fontData, preferenceData] =
        await Promise.all([
          api("/studio/brand-kits/"),
          api("/studio/brand-rules/"),
          api("/studio/brand-assets/"),
          api("/studio/brand-kits/google-fonts/"),
          api("/studio/workspace-preferences/"),
        ]);
      const currentKit = (kitsData.results || kitsData)[0];
      const currentRule = (rulesData.results || rulesData)[0];
      if (currentKit) {
        setKit(currentKit);
        setForm({ ...kitBlank, ...currentKit });
      }
      if (currentRule) {
        setRule(currentRule);
        setRuleForm(normalizeRules(currentRule));
      }
      setAssets(assetsData.results || assetsData);
      const currentPreference = (preferenceData.results || preferenceData)[0];
      if (currentPreference) {
        setPreference(currentPreference);
        setPreferenceForm({ ...preferenceBlank, ...currentPreference });
      }
      setFonts(fontData.items || []);
      if (!fontData.catalog_complete)
        setFontNotice(fontData.detail || "Catálogo reducido disponible.");
    }
    load().catch((error) => setMessage({ type: "error", text: error.message }));
  }, []);

  useEffect(() => {
    const selected = [
      ...new Set([form.font_primary, form.font_secondary].filter(Boolean)),
    ];
    if (!selected.length) return;
    const href = `https://fonts.googleapis.com/css2?${selected.map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@400;600;700`).join("&")}&display=swap`;
    let link = document.getElementById("brand-font-preview");
    if (!link) {
      link = document.createElement("link");
      link.id = "brand-font-preview";
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    link.href = href;
  }, [form.font_primary, form.font_secondary]);

  const completion = useMemo(() => {
    const keys = [
      "brand_name",
      "brand_description",
      "primary_color",
      "secondary_color",
      "accent_color",
      "font_primary",
      "font_secondary",
      "tone_of_voice",
      "default_call_to_action",
      "logo_url",
    ];
    return Math.round(
      (keys.filter((key) => Boolean(form[key])).length / keys.length) * 100,
    );
  }, [form]);

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }
  function flash(type, text) {
    setMessage({ type, text });
    window.setTimeout(() => setMessage({ type: "", text: "" }), 4500);
  }

  async function saveKit() {
    setBusy(true);
    try {
      const path = kit
        ? `/studio/brand-kits/${kit.id}/`
        : "/studio/brand-kits/";
      const data = await api(path, {
        method: kit ? "PATCH" : "POST",
        body: JSON.stringify(form),
      });
      setKit(data);
      setForm({ ...kitBlank, ...data });
      setEditing(false);
      flash("success", "Identidad de marca guardada.");
    } catch (error) {
      flash("error", error.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveRules() {
    if (!kit) {
      flash("error", "Guarda primero la identidad de marca.");
      return;
    }
    setBusy(true);
    try {
      const path = rule
        ? `/studio/brand-rules/${rule.id}/`
        : "/studio/brand-rules/";
      const data = await api(path, {
        method: rule ? "PATCH" : "POST",
        body: JSON.stringify(ruleForm),
      });
      setRule(data);
      setRuleForm({ ...ruleBlank, ...data });
      setEditing(false);
      flash("success", "Reglas de marca guardadas.");
    } catch (error) {
      flash("error", error.message);
    } finally {
      setBusy(false);
    }
  }
  async function uploadLogo(field, file) {
    setUploading(field);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("name", `${form.brand_name || "Marca"} — ${field}`);
      body.append("category", "logo");
      body.append("metadata", JSON.stringify({ purpose: field }));
      const asset = await api("/studio/brand-assets/", {
        method: "POST",
        body,
      });
      setAssets((current) => [asset, ...current]);
      update(field, asset.file_url);
      flash("success", "Logo cargado. Guarda los cambios para confirmarlo.");
    } catch (error) {
      flash("error", error.message);
    } finally {
      setUploading("");
    }
  }

  async function addAsset(event) {
    event.preventDefault();
    if (!assetFile) {
      flash("error", "Selecciona un archivo.");
      return;
    }
    setBusy(true);
    try {
      const body = new FormData();
      body.append("file", assetFile);
      body.append("name", assetDraft.name || assetFile.name);
      body.append("category", assetDraft.category);
      body.append("is_favorite", assetDraft.is_favorite);
      body.append(
        "metadata",
        JSON.stringify({ ...assetDraft.metadata, schema_version: 1 }),
      );
      const asset = await api("/studio/brand-assets/", {
        method: "POST",
        body,
      });
      setAssets((current) => [asset, ...current]);
      setAssetDraft({
        name: "",
        category: "product",
        is_favorite: false,
        metadata: blankAssetMetadata,
      });
      setAssetFile(null);
      setEditing(false);
      event.target.reset();
      flash("success", "Recurso añadido a la biblioteca.");
    } catch (error) {
      flash("error", error.message);
    } finally {
      setBusy(false);
    }
  }

  async function removeAsset(asset) {
    if (!window.confirm(`¿Eliminar “${asset.name}”?`)) return;
    try {
      await api(`/studio/brand-assets/${asset.id}/`, { method: "DELETE" });
      setAssets((current) => current.filter((item) => item.id !== asset.id));
    } catch (error) {
      flash("error", error.message);
    }
  }

  const tabs = [
    ["identity", "01", "Identidad"],
    ["typography", "02", "Tipografía"],
    ["logos", "03", "Logos"],
    ["rules", "04", "Reglas"],
    ["preferences", "05", "Preferencias"],
    ["assets", "06", "Recursos"],
  ];

  return (
    <>
      <Nav privateNav />
      <main className="container ascend-view page page--brand">
        <PageTitle
          className="page-header brand-header page-header"
          eyebrow="Sistema de marca"
          title={editing ? "Editar Brand Kit" : "Brand Kit"}
          description="Centraliza identidad, colores, tipografías, tono, activos y reglas para asegurar consistencia en cada generación."
          meta={<span className="badge">Activo</span>}
          actions={(
            <div className="actions">
            <label className="search">
              <span>⌕</span>
              <input placeholder="Buscar en el Brand Kit…" />
            </label>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() =>
                document
                  .querySelector(".brand-tabs")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
            >
              ☷ Búsqueda avanzada
            </button>

            {!editing ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setEditing(true)}
              >
                ✎ Editar Brand Kit
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditing(false)}
                >
                  Cancelar
                </button>
                {!["rules", "preferences", "assets"].includes(tab) && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={saveKit}
                    disabled={busy}
                  >
                    {busy ? "Guardando…" : "Guardar cambios"}
                  </button>
                )}
              </>
            )}
            </div>
          )}
        />

        {!editing && (
          <section className="grid metrics-grid">
            <article>
              <i>▦</i>
              <div>
                <strong>{form.brand_name || "Sin nombre"}</strong>
                <span>Nombre de marca</span>
              </div>
            </article>
            <article>
              <i>Aa</i>
              <div>
                <strong>{form.font_primary || "Sin definir"}</strong>
                <span>Tipografía principal</span>
              </div>
            </article>
            <article>
              <i>◇</i>
              <div>
                <strong>{assets.length}</strong>
                <span>Activos de marca</span>
              </div>
            </article>
            <article>
              <i>⬡</i>
              <div>
                <strong>
                  {Object.values(ruleForm).reduce(
                    (sum, items) => sum + (items?.length || 0),
                    0,
                  )}
                </strong>
                <span>Reglas activas</span>
              </div>
            </article>
            <article>
              <i>◷</i>
              <div>
                <strong>{completion}%</strong>
                <span>Configuración completa</span>
              </div>
            </article>
          </section>
        )}
        {message.text && (
          <div className={`notice ${message.type}`} role="status">
            {message.text}
          </div>
        )}
        <nav className="tabs" aria-label="Secciones del kit">
          {tabs.map(([key, number, label]) => (
            <button
              key={key}
              className={tab === key ? "active" : ""}
              onClick={() => {
                setTab(key);
                setEditing(false);
              }}
            >
              <small>{number}</small>
              {label}
            </button>
          ))}
        </nav>

        <div className="split-layout">
          <section className="catalog-section">
            {!editing && (
              <BrandConfiguredView
                tab={tab}
                form={form}
                rule={ruleForm}
                preference={preferenceForm}
                assets={assets}
                onEdit={() => setEditing(true)}
                onRemoveAsset={removeAsset}
              />
            )}
            {editing && (
              <div className="tabs">
                <div>
                  <i />
                  <span>Modo edición</span>
                  <small>Los cambios se aplicarán cuando guardes.</small>
                </div>
                <button type="button" onClick={() => setEditing(false)}>
                  Cancelar
                </button>
              </div>
            )}
            {editing && tab === "identity" && (
              <div className="panel">
                <div className="panel-heading">
                  <div>
                    <span>Fundamentos</span>
                    <h2>Identidad esencial</h2>
                  </div>
                  <p>
                    La información que la IA usará para entender y representar
                    tu negocio.
                  </p>
                </div>
                <div className="field-grid">
                  <Field
                    label="Nombre de marca"
                    hint="Nombre comercial visible en tus piezas."
                  >
                    <input
                      className="input"
                      value={form.brand_name}
                      onChange={(e) => update("brand_name", e.target.value)}
                      placeholder="Ej. Norte Studio"
                    />
                  </Field>
                  <Field
                    label="CTA predeterminado"
                    hint="La acción que quieres provocar."
                  >
                    <input
                      className="input"
                      value={form.default_call_to_action}
                      onChange={(e) =>
                        update("default_call_to_action", e.target.value)
                      }
                      placeholder="Ej. Descubre la colección"
                    />
                  </Field>
                </div>
                <Field
                  label="Descripción de marca"
                  hint="Resume qué haces, para quién y qué te hace diferente."
                >
                  <textarea
                    className="input textarea"
                    value={form.brand_description}
                    onChange={(e) =>
                      update("brand_description", e.target.value)
                    }
                    placeholder="Somos una marca que…"
                    maxLength="1200"
                  />
                  <span className="char-count">
                    {form.brand_description.length}/1200
                  </span>
                </Field>
                <Field
                  label="Tono de voz"
                  hint="Describe personalidad, ritmo y palabras que debe usar tu comunicación."
                >
                  <textarea
                    className="input textarea compact"
                    value={form.tone_of_voice}
                    onChange={(e) => update("tone_of_voice", e.target.value)}
                    placeholder="Cercano, claro y optimista; evita tecnicismos…"
                  />
                </Field>
                <div className="section-label">
                  <span>Paleta principal</span>
                  <small>Usa colores con buen contraste</small>
                </div>
                <div className="form-grid">
                  {[
                    ["primary_color", "Principal"],
                    ["secondary_color", "Secundario"],
                    ["accent_color", "Acento"],
                  ].map(([key, label]) => (
                    <BrandColorField
                      key={key}
                      label={label}
                      value={form[key]}
                      onChange={(value) => update(key, value)}
                    />
                  ))}
                </div>
              </div>
            )}

            {editing && tab === "typography" && (
              <div className="panel">
                <div className="panel-heading">
                  <div>
                    <span>Jerarquía visual</span>
                    <h2>Tipografía</h2>
                  </div>
                  <p>Elige una voz para títulos y otra para textos extensos.</p>
                </div>
                {fontNotice && (
                  <div className="inline-notice">{fontNotice}</div>
                )}
                <FontPicker
                  id="primary-fonts"
                  label="Tipografía principal · títulos"
                  value={form.font_primary}
                  fonts={fonts}
                  onChange={(value) => update("font_primary", value)}
                />
                <FontPicker
                  id="secondary-fonts"
                  label="Tipografía secundaria · cuerpo"
                  value={form.font_secondary}
                  fonts={fonts}
                  onChange={(value) => update("font_secondary", value)}
                />
                <div className="type-specimen">
                  <span
                    style={{ fontFamily: `'${form.font_primary}',sans-serif` }}
                  >
                    Una marca que deja huella.
                  </span>
                  <p
                    style={{
                      fontFamily: `'${form.font_secondary}',sans-serif`,
                    }}
                  >
                    Diseñamos experiencias claras, memorables y consistentes en
                    cada punto de contacto.
                  </p>
                </div>
              </div>
            )}

            {editing && tab === "logos" && (
              <div className="panel">
                <div className="panel-heading">
                  <div>
                    <span>Activos esenciales</span>
                    <h2>Sistema de logos</h2>
                  </div>
                  <p>
                    Tres versiones aseguran legibilidad sobre cualquier fondo.
                  </p>
                </div>
                <div className="logo-list">
                  <LogoUploader
                    label="Logo principal"
                    value={form.logo_url}
                    busy={uploading === "logo_url"}
                    onUpload={(file) => uploadLogo("logo_url", file)}
                    onClear={() => update("logo_url", "")}
                  />
                  <LogoUploader
                    label="Logo para fondos oscuros"
                    value={form.logo_dark_url}
                    busy={uploading === "logo_dark_url"}
                    onUpload={(file) => uploadLogo("logo_dark_url", file)}
                    onClear={() => update("logo_dark_url", "")}
                  />
                  <LogoUploader
                    label="Logo para fondos claros"
                    value={form.logo_light_url}
                    busy={uploading === "logo_light_url"}
                    onUpload={(file) => uploadLogo("logo_light_url", file)}
                    onClear={() => update("logo_light_url", "")}
                  />
                </div>
              </div>
            )}

            {editing && tab === "rules" && (
              <div className="panel">
                <div className="panel-heading">
                  <div>
                    <span>Gobernanza</span>
                    <h2>Reglas de marca</h2>
                  </div>
                  <p>
                    Completa controles guiados; la estructura técnica se genera
                    automáticamente.
                  </p>
                </div>
                <RulesEditor
                  value={ruleForm}
                  onChange={setRuleForm}
                  fonts={fonts}
                />
                <button className="btn" onClick={saveRules} disabled={busy}>
                  {busy ? "Guardando…" : "Guardar reglas"}
                </button>
              </div>
            )}

            {editing && tab === "preferences" && (
              <div className="panel">
                <div className="panel-heading">
                  <div>
                    <span>Dirección creativa</span>
                    <h2>Preferencias del workspace</h2>
                  </div>
                  <p>
                    Las preferencias del workspace se aprenden automáticamente
                    desde la actividad creativa. Este modelo solo expone
                    learned_preferences como dato técnico de solo lectura.
                  </p>
                </div>
                {Object.keys(preferenceForm.learned_preferences || {}).length >
                0 ? (
                  <pre className="code-block">
                    {JSON.stringify(preferenceForm.learned_preferences, null, 2)}
                  </pre>
                ) : (
                  <div className="inline-notice">
                    Aún no hay preferencias aprendidas para este workspace.
                  </div>
                )}
              </div>
            )}

            {editing && tab === "assets" && (
              <div className="panel">
                <div className="panel-heading">
                  <div>
                    <span>Biblioteca visual</span>
                    <h2>Recursos de marca</h2>
                  </div>
                  <p>
                    Los datos técnicos se detectan automáticamente; tú solo
                    agregas contexto útil.
                  </p>
                </div>
                <form
                  className="asset-form structured-asset-form"
                  onSubmit={addAsset}
                >
                  <Field label="Archivo">
                    <input
                      className="input"
                      type="file"
                      required
                      onChange={(e) => setAssetFile(e.target.files[0] || null)}
                    />
                  </Field>
                  <Field label="Nombre">
                    <input
                      className="input"
                      value={assetDraft.name}
                      onChange={(e) =>
                        setAssetDraft({ ...assetDraft, name: e.target.value })
                      }
                      placeholder="Nombre descriptivo"
                    />
                  </Field>
                  <Field label="Categoría">
                    <select
                      className="input"
                      value={assetDraft.category}
                      onChange={(e) =>
                        setAssetDraft({
                          ...assetDraft,
                          category: e.target.value,
                        })
                      }
                    >
                      {categories.map((item) => (
                        <option key={item} value={item}>
                          {item.replace("_", " ")}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <MetadataBuilder
                    value={assetDraft.metadata}
                    onChange={(metadata) =>
                      setAssetDraft({ ...assetDraft, metadata })
                    }
                  />
                  <label className="check-field">
                    <input
                      type="checkbox"
                      checked={assetDraft.is_favorite}
                      onChange={(e) =>
                        setAssetDraft({
                          ...assetDraft,
                          is_favorite: e.target.checked,
                        })
                      }
                    />{" "}
                    Marcar como favorito
                  </label>
                  <button className="btn" disabled={busy}>
                    {busy ? "Subiendo…" : "Añadir recurso"}
                  </button>
                </form>
                <div className="asset-library">
                  {assets.map((asset) => (
                    <article key={asset.id}>
                      <div className="asset-thumb">
                        {asset.mime_type?.startsWith("image/") ||
                        asset.file_url?.match(
                          /\.(png|jpe?g|webp|gif|svg)$/i,
                        ) ? (
                          <img src={asset.file_url} alt={asset.name} />
                        ) : (
                          <span>Archivo</span>
                        )}
                      </div>
                      <div>
                        <span>{asset.category.replace("_", " ")}</span>
                        <strong>{asset.name}</strong>
                        <small>
                          {asset.width
                            ? `${asset.width} × ${asset.height}px`
                            : asset.mime_type || "Recurso"}
                        </small>
                        {asset.metadata?.tags?.length > 0 && (
                          <small>
                            {asset.metadata.tags.slice(0, 3).join(" · ")}
                          </small>
                        )}
                      </div>
                      <button
                        className="text-button danger"
                        onClick={() => removeAsset(asset)}
                      >
                        Eliminar
                      </button>
                    </article>
                  ))}
                </div>
                {!assets.length && (
                  <div className="empty-state">
                    Tu biblioteca está lista para recibir el primer recurso.
                  </div>
                )}
              </div>
            )}

            {editing && !["rules", "preferences", "assets"].includes(tab) && (
              <div className="sticky-actions">
                <span>Los cambios no se guardan automáticamente.</span>
                <button className="btn" onClick={saveKit} disabled={busy}>
                  {busy ? "Guardando…" : "Guardar cambios"}
                </button>
              </div>
            )}
          </section>

          <BrandLivePreview
            form={form}
            assets={assets}
            rule={ruleForm}
            completion={completion}
          />
        </div>
      </main>
    </>
  );
}
