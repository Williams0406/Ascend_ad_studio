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
import {
  CatalogPreview,
  PreviewMedia,
} from "@/components/catalog/CatalogLayout";

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

function LogoUploader({
  label,
  value,
  busy,
  onUpload,
  onClear,
  surface = "neutral",
}) {
  const [dragging, setDragging] = useState(false);
  const inputId = useMemo(
    () =>
      `logo-upload-${label
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")}`,
    [label],
  );

  function validateAndUpload(file) {
    if (!file || busy) return;

    const acceptedTypes = [
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/svg+xml",
    ];

    if (!acceptedTypes.includes(file.type)) {
      window.alert("Selecciona un archivo PNG, JPG, WebP o SVG.");
      return;
    }

    onUpload(file);
  }

  function handleDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    setDragging(false);

    const file = event.dataTransfer.files?.[0];
    validateAndUpload(file);
  }

  function handleDragOver(event) {
    event.preventDefault();
    event.stopPropagation();

    if (!busy) {
      event.dataTransfer.dropEffect = "copy";
      setDragging(true);
    }
  }

  function handleDragLeave(event) {
    event.preventDefault();
    event.stopPropagation();

    if (event.currentTarget.contains(event.relatedTarget)) {
      return;
    }

    setDragging(false);
  }

  return (
    <div
      className={[
        "logo-slot",
        "logo-dropzone",
        `logo-dropzone--${surface}`,
        dragging ? "is-dragging" : "",
        busy ? "is-busy" : "",
        value ? "has-image" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onDragEnter={handleDragOver}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        id={inputId}
        className="logo-dropzone__input"
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        disabled={busy}
        onChange={(event) => {
          const file = event.target.files?.[0];
          validateAndUpload(file);

          /*
           * Permite volver a seleccionar el mismo archivo
           * después de quitarlo o reemplazarlo.
           */
          event.target.value = "";
        }}
      />

      <label
        className="logo-dropzone__surface"
        htmlFor={inputId}
        aria-label={`${value ? "Reemplazar" : "Cargar"} ${label}`}
      >
        <span className="logo-dropzone__safe-area" aria-hidden="true" />

        {value ? (
          <img src={value} alt={label} className="logo-dropzone__image" />
        ) : (
          <div className="logo-dropzone__empty">
            <span className="logo-dropzone__icon">{busy ? "…" : "＋"}</span>

            <strong>
              {busy
                ? "Subiendo imagen…"
                : dragging
                  ? "Suelta la imagen aquí"
                  : "Haz clic o arrastra tu logo"}
            </strong>

            <small>PNG, JPG, WebP o SVG · fondo transparente recomendado</small>
          </div>
        )}

        {value && (
          <span className="logo-dropzone__replace">
            {busy
              ? "Subiendo…"
              : dragging
                ? "Suelta para reemplazar"
                : "Haz clic o arrastra para reemplazar"}
          </span>
        )}
      </label>

      <div className="logo-dropzone__information">
        <div>
          <strong>{label}</strong>

          <small>{value ? "Archivo configurado" : "Archivo pendiente"}</small>
        </div>

        {value && (
          <button
            type="button"
            className="logo-dropzone__remove"
            onClick={onClear}
            disabled={busy}
          >
            Quitar
          </button>
        )}
      </div>
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

function RuleEmptyText({ text }) {
  return <p className="brand-rule-empty">{text}</p>;
}

function RuleOverviewCard({
  number,
  title,
  description,
  count,
  tone = "copper",
  children,
}) {
  return (
    <section className={`brand-rule-card brand-rule-card--${tone}`}>
      <header>
        <span>{number}</span>

        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>

        <b>{count}</b>
      </header>

      <div className="brand-rule-card__content">{children}</div>
    </section>
  );
}

function RuleTagCollection({
  items = [],
  field,
  empty = "Sin datos configurados.",
}) {
  if (!items.length) {
    return <RuleEmptyText text={empty} />;
  }

  return (
    <div className="brand-rule-tags">
      {items.map((item, index) => {
        const value =
          typeof item === "string"
            ? item
            : item?.[field] || item?.label || item?.value || "Sin nombre";

        return <span key={`${value}-${index}`}>{value}</span>;
      })}
    </div>
  );
}

function humanizePreferenceKey(value = "") {
  return String(value)
    .replaceAll("_", " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim()
    .replace(/^./, (character) => character.toUpperCase());
}

function preferenceValueType(value) {
  if (Array.isArray(value)) return "Colección";
  if (typeof value === "boolean") return "Booleano";
  if (typeof value === "number") return "Número";
  if (value && typeof value === "object") return "Grupo";
  return "Valor";
}

function PreferenceValue({ value }) {
  if (Array.isArray(value)) {
    if (!value.length) {
      return <span className="brand-preference-empty-value">Sin valores</span>;
    }

    return (
      <div className="brand-preference-tags">
        {value.map((item, index) => (
          <span key={`${String(item)}-${index}`}>
            {typeof item === "object" ? JSON.stringify(item) : String(item)}
          </span>
        ))}
      </div>
    );
  }

  if (typeof value === "boolean") {
    return (
      <span
        className={`brand-preference-boolean ${
          value ? "is-positive" : "is-negative"
        }`}
      >
        <i aria-hidden="true" />
        {value ? "Activo" : "Inactivo"}
      </span>
    );
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value);

    if (!entries.length) {
      return <span className="brand-preference-empty-value">Sin datos</span>;
    }

    return (
      <div className="brand-preference-nested">
        {entries.map(([key, nestedValue]) => (
          <div key={key}>
            <span>{humanizePreferenceKey(key)}</span>
            <strong>
              {Array.isArray(nestedValue)
                ? nestedValue.join(" · ")
                : typeof nestedValue === "object"
                  ? JSON.stringify(nestedValue)
                  : String(nestedValue)}
            </strong>
          </div>
        ))}
      </div>
    );
  }

  if (value === null || value === undefined || value === "") {
    return <span className="brand-preference-empty-value">Sin valor</span>;
  }

  return (
    <strong className="brand-preference-text-value">{String(value)}</strong>
  );
}

function BrandAssetMedia({ asset }) {
  const isImage =
    asset?.mime_type?.startsWith("image/") ||
    asset?.file_url?.match(/\.(png|jpe?g|webp|gif|svg)$/i);

  const isVideo =
    asset?.mime_type?.startsWith("video/") ||
    asset?.file_url?.match(/\.(mp4|webm|mov)$/i);

  if (isImage && asset.file_url) {
    return (
      <img
        src={asset.file_url}
        alt={asset.name || "Recurso de marca"}
        loading="lazy"
        decoding="async"
      />
    );
  }

  if (isVideo && asset.file_url) {
    return <video src={asset.file_url} muted playsInline preload="metadata" />;
  }

  return (
    <div className="brand-resource-fallback">
      <span>{(asset?.name || "AR").trim().slice(0, 2).toUpperCase()}</span>
      <small>{asset?.mime_type || "Archivo"}</small>
    </div>
  );
}

function getVisibleAssetMetadata(asset) {
  return Object.entries(asset?.metadata || {})
    .filter(([key, value]) => {
      if (key === "schema_version") return false;
      if (value === null || value === undefined || value === "") return false;
      if (Array.isArray(value) && !value.length) return false;
      return true;
    })
    .slice(0, 4);
}

function formatAssetMetadataValue(value) {
  if (Array.isArray(value)) return value.join(" · ");
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (value && typeof value === "object") return JSON.stringify(value);
  return String(value);
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
  if (tab === "assets") {
    const favoriteAssets = assets.filter((asset) => asset.is_favorite).length;

    const imageAssets = assets.filter(
      (asset) =>
        asset.mime_type?.startsWith("image/") ||
        asset.file_url?.match(/\.(png|jpe?g|webp|gif|svg)$/i),
    ).length;

    const categoryCount = new Set(
      assets.map((asset) => asset.category).filter(Boolean),
    ).size;

    return (
      <div className="brand-resources-overview">
        <section className="brand-resources-overview__hero">
          <div>
            <span className="brand-section-eyebrow">Biblioteca visual</span>

            <h2>Recursos de marca</h2>

            <p>
              Centraliza imágenes, productos, fondos, referencias y activos que
              pueden utilizarse en proyectos y generaciones.
            </p>
          </div>

          <button type="button" className="btn btn-primary" onClick={onEdit}>
            <span aria-hidden="true">＋</span>
            Añadir recurso
          </button>
        </section>

        <section className="brand-resources-overview__metrics">
          <article>
            <span>Recursos totales</span>
            <strong>{assets.length}</strong>
            <small>archivos disponibles</small>
          </article>

          <article>
            <span>Imágenes</span>
            <strong>{imageAssets}</strong>
            <small>recursos visuales</small>
          </article>

          <article>
            <span>Favoritos</span>
            <strong>{favoriteAssets}</strong>
            <small>activos prioritarios</small>
          </article>

          <article>
            <span>Categorías</span>
            <strong>{categoryCount}</strong>
            <small>grupos registrados</small>
          </article>
        </section>

        {assets.length ? (
          <section className="brand-resource-collection">
            <header className="brand-resource-collection__header">
              <div>
                <span>Catálogo activo</span>
                <h3>Biblioteca configurada</h3>
              </div>

              <strong>
                {assets.length} {assets.length === 1 ? "recurso" : "recursos"}
              </strong>
            </header>

            <div className="brand-resource-grid">
              {assets.map((asset, index) => {
                const visibleMetadata = getVisibleAssetMetadata(asset);

                return (
                  <article className="brand-resource-card" key={asset.id}>
                    <div className="brand-resource-card__media">
                      <BrandAssetMedia asset={asset} />

                      <span className="brand-resource-card__index">
                        {String(index + 1).padStart(2, "0")}
                      </span>

                      {asset.is_favorite && (
                        <span className="brand-resource-card__favorite">
                          ★ Favorito
                        </span>
                      )}

                      <span className="brand-resource-card__category">
                        {asset.category?.replaceAll("_", " ") ||
                          "Sin categoría"}
                      </span>
                    </div>

                    <div className="brand-resource-card__body">
                      <header>
                        <div>
                          <span>Recurso de marca</span>
                          <h3>{asset.name || "Recurso sin nombre"}</h3>
                        </div>

                        <i aria-hidden="true" />
                      </header>

                      <p>
                        {asset.width && asset.height
                          ? `${asset.width} × ${asset.height} px`
                          : asset.mime_type || "Archivo de marca"}
                      </p>

                      {visibleMetadata.length > 0 && (
                        <dl className="brand-resource-card__metadata">
                          {visibleMetadata.map(([key, value]) => (
                            <div key={key}>
                              <dt>
                                {metadataFields.find(
                                  (item) => item[0] === key,
                                )?.[1] || humanizePreferenceKey(key)}
                              </dt>

                              <dd>{formatAssetMetadataValue(value)}</dd>
                            </div>
                          ))}
                        </dl>
                      )}

                      {asset.metadata?.tags?.length > 0 && (
                        <div className="brand-resource-card__tags">
                          {asset.metadata.tags.slice(0, 4).map((tag) => (
                            <span key={tag}>{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>

                    <footer className="brand-resource-card__footer">
                      <span>
                        {asset.metadata?.source || "Carga del usuario"}
                      </span>

                      <button
                        type="button"
                        className="brand-resource-card__delete"
                        onClick={() => onRemoveAsset(asset)}
                      >
                        Eliminar
                      </button>
                    </footer>
                  </article>
                );
              })}
            </div>
          </section>
        ) : (
          <section className="brand-resources-empty">
            <div className="brand-resources-empty__visual">
              <span>＋</span>
              <i />
              <i />
              <i />
            </div>

            <div>
              <span className="brand-section-eyebrow">Biblioteca vacía</span>

              <h3>Añade tu primer recurso de marca</h3>

              <p>
                Incorpora productos, fotografías, fondos, iconos o referencias
                para que Ascend disponga de contexto visual al crear contenidos.
              </p>

              <button
                type="button"
                className="btn btn-primary"
                onClick={onEdit}
              >
                Añadir recurso
              </button>
            </div>
          </section>
        )}
      </div>
    );
  }
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
        <div className="brand-identity-overview">
          <section className="brand-identity-overview__hero">
            <div className="brand-identity-overview__copy">
              <span className="brand-section-eyebrow">Identidad central</span>

              <h3>{form.brand_name || "Tu marca todavía no tiene nombre"}</h3>

              <p>
                {form.brand_description ||
                  "Añade una descripción para definir qué representa tu marca, a quién se dirige y cómo debe diferenciarse."}
              </p>

              <div className="brand-identity-overview__cta">
                <span>CTA predeterminado</span>

                <strong>
                  {form.default_call_to_action || "Sin configurar"}
                </strong>
              </div>
            </div>

            <div
              className="brand-identity-overview__monogram"
              style={{
                "--brand-primary": form.primary_color || "#171A20",
                "--brand-secondary": form.secondary_color || "#F3EEE6",
                "--brand-accent": form.accent_color || "#B67A45",
              }}
              aria-hidden="true"
            >
              <span>
                {(form.brand_name || "B").trim().slice(0, 2).toUpperCase()}
              </span>
            </div>
          </section>

          <div className="brand-identity-overview__grid">
            <section className="brand-identity-card brand-identity-card--voice">
              <header className="brand-identity-card__header">
                <div>
                  <span className="brand-section-eyebrow">Comunicación</span>
                  <h3>Voz de marca</h3>
                </div>

                <span className="brand-identity-card__index">01</span>
              </header>

              <blockquote>
                {form.tone_of_voice ||
                  "Define la personalidad, el ritmo y el lenguaje que debe utilizar tu marca."}
              </blockquote>

              <footer>
                Esta dirección será utilizada para redactar títulos, mensajes,
                llamados a la acción y contenido de campaña.
              </footer>
            </section>

            <section className="brand-identity-card brand-identity-card--palette">
              <header className="brand-identity-card__header">
                <div>
                  <span className="brand-section-eyebrow">Sistema visual</span>
                  <h3>Paleta principal</h3>
                </div>

                <span className="brand-identity-card__index">02</span>
              </header>

              <div className="brand-identity-palette">
                {[
                  ["Principal", form.primary_color, "Base de identidad"],
                  ["Secundario", form.secondary_color, "Superficies y fondos"],
                  ["Acento", form.accent_color, "Acciones y énfasis"],
                ].map(([label, color, use]) => (
                  <article className="brand-identity-color" key={label}>
                    <div
                      className="brand-identity-color__sample"
                      style={{
                        background: color || "rgba(32, 36, 43, 0.08)",
                      }}
                    >
                      <span>{label.slice(0, 1)}</span>
                    </div>

                    <div className="brand-identity-color__information">
                      <span>{label}</span>
                      <strong>{color || "Sin configurar"}</strong>
                      <small>{use}</small>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>

          <section className="brand-identity-overview__summary">
            <article>
              <span>Nombre comercial</span>
              <strong>{form.brand_name || "Pendiente"}</strong>
            </article>

            <article>
              <span>Descripción</span>
              <strong>
                {form.brand_description
                  ? `${form.brand_description.length} caracteres`
                  : "Pendiente"}
              </strong>
            </article>

            <article>
              <span>Voz definida</span>
              <strong>{form.tone_of_voice ? "Sí" : "Pendiente"}</strong>
            </article>

            <article>
              <span>Paleta configurada</span>
              <strong>
                {
                  [
                    form.primary_color,
                    form.secondary_color,
                    form.accent_color,
                  ].filter(Boolean).length
                }
                /3
              </strong>
            </article>
          </section>
        </div>
      )}
      {tab === "typography" && (
        <div className="brand-type-overview">
          <section className="brand-type-overview__hero">
            <header>
              <div>
                <span className="brand-section-eyebrow">
                  Sistema tipográfico
                </span>

                <h3>Una jerarquía clara para cada mensaje</h3>

                <p>
                  La combinación tipográfica define la personalidad visual, la
                  legibilidad y el ritmo de comunicación de tu marca.
                </p>
              </div>

              <span className="brand-type-overview__badge">Aa</span>
            </header>

            <div className="brand-type-overview__specimen">
              <span
                className="brand-type-overview__kicker"
                style={{
                  fontFamily: `'${form.font_secondary || "Inter"}', sans-serif`,
                }}
              >
                BRAND SYSTEM · IDENTIDAD TIPOGRÁFICA
              </span>

              <h4
                style={{
                  fontFamily: `'${form.font_primary || "Manrope"}', sans-serif`,
                }}
              >
                Diseñamos una marca que deja huella.
              </h4>

              <p
                style={{
                  fontFamily: `'${form.font_secondary || "Inter"}', sans-serif`,
                }}
              >
                Una identidad consistente transforma cada palabra en una
                experiencia reconocible, clara y memorable.
              </p>

              <div className="brand-type-overview__alphabet">
                <span
                  style={{
                    fontFamily: `'${form.font_primary || "Manrope"}', sans-serif`,
                  }}
                >
                  Aa Bb Cc Dd Ee
                </span>

                <small
                  style={{
                    fontFamily: `'${form.font_secondary || "Inter"}', sans-serif`,
                  }}
                >
                  0123456789 · !?&%
                </small>
              </div>
            </div>
          </section>

          <div className="brand-type-overview__families">
            <article className="brand-type-family-card brand-type-family-card--primary">
              <header>
                <div>
                  <span>01 · Principal</span>
                  <h3>{form.font_primary || "Sin configurar"}</h3>
                </div>

                <strong
                  style={{
                    fontFamily: `'${form.font_primary || "Manrope"}', sans-serif`,
                  }}
                >
                  Ag
                </strong>
              </header>

              <p
                style={{
                  fontFamily: `'${form.font_primary || "Manrope"}', sans-serif`,
                }}
              >
                Títulos que comunican dirección.
              </p>

              <footer>
                <span>Uso recomendado</span>
                <strong>Títulos, cifras y mensajes protagonistas</strong>
              </footer>
            </article>

            <article className="brand-type-family-card brand-type-family-card--secondary">
              <header>
                <div>
                  <span>02 · Secundaria</span>
                  <h3>{form.font_secondary || "Sin configurar"}</h3>
                </div>

                <strong
                  style={{
                    fontFamily: `'${form.font_secondary || "Inter"}', sans-serif`,
                  }}
                >
                  Ag
                </strong>
              </header>

              <p
                style={{
                  fontFamily: `'${form.font_secondary || "Inter"}', sans-serif`,
                }}
              >
                Textos claros para una lectura natural y consistente.
              </p>

              <footer>
                <span>Uso recomendado</span>
                <strong>Párrafos, etiquetas, formularios y soporte</strong>
              </footer>
            </article>
          </div>

          <section className="brand-type-overview__scale">
            {[
              ["Display", "48–72 px", form.font_primary],
              ["Título", "28–40 px", form.font_primary],
              ["Subtítulo", "18–24 px", form.font_primary],
              ["Cuerpo", "14–16 px", form.font_secondary],
              ["Etiqueta", "10–12 px", form.font_secondary],
            ].map(([name, size, family], index) => (
              <article key={name}>
                <span>{String(index + 1).padStart(2, "0")}</span>

                <div>
                  <strong
                    style={{
                      fontFamily: `'${family || "Inter"}', sans-serif`,
                    }}
                  >
                    {name}
                  </strong>
                  <small>{size}</small>
                </div>
              </article>
            ))}
          </section>
        </div>
      )}
      {tab === "logos" && (
        <div className="brand-logo-overview">
          <section className="brand-logo-overview__intro">
            <div>
              <span className="brand-section-eyebrow">Sistema de firmas</span>

              <h3>Una versión correcta para cada contexto</h3>

              <p>
                Mantén la legibilidad y el reconocimiento de tu identidad
                utilizando la variante adecuada según el fondo y la composición.
              </p>
            </div>

            <div className="brand-logo-overview__status">
              <strong>
                {
                  [
                    form.logo_url,
                    form.logo_dark_url,
                    form.logo_light_url,
                  ].filter(Boolean).length
                }
                /3
              </strong>
              <span>variantes configuradas</span>
            </div>
          </section>

          <div className="brand-logo-overview__grid">
            {[
              {
                key: "main",
                number: "01",
                label: "Logo principal",
                description:
                  "Versión de uso general para composiciones neutras.",
                url: form.logo_url,
                surface: "neutral",
                recommendation: "Fondos neutros o de marca",
              },
              {
                key: "dark",
                number: "02",
                label: "Versión clara",
                description:
                  "Variante optimizada para conservar contraste sobre fondos oscuros.",
                url: form.logo_dark_url,
                surface: "dark",
                recommendation: "Fondos oscuros",
              },
              {
                key: "light",
                number: "03",
                label: "Versión oscura",
                description:
                  "Variante con mayor presencia sobre fondos claros.",
                url: form.logo_light_url,
                surface: "light",
                recommendation: "Fondos claros",
              },
            ].map((logo) => (
              <article
                className={`brand-logo-card brand-logo-card--${logo.surface}`}
                key={logo.key}
              >
                <header>
                  <span>{logo.number}</span>

                  <div>
                    <h3>{logo.label}</h3>
                    <p>{logo.description}</p>
                  </div>

                  <b className={logo.url ? "configured" : ""}>
                    {logo.url ? "Configurado" : "Pendiente"}
                  </b>
                </header>

                <div className="brand-logo-card__canvas">
                  <span
                    className="brand-logo-card__safe-area"
                    aria-hidden="true"
                  />

                  {logo.url ? (
                    <img src={logo.url} alt={logo.label} loading="lazy" />
                  ) : (
                    <div className="brand-logo-card__empty">
                      <strong>
                        {(form.brand_name || "B")
                          .trim()
                          .slice(0, 2)
                          .toUpperCase()}
                      </strong>
                      <span>Logo no configurado</span>
                    </div>
                  )}
                </div>

                <footer>
                  <span>Uso recomendado</span>
                  <strong>{logo.recommendation}</strong>
                </footer>
              </article>
            ))}
          </div>

          <section className="brand-logo-overview__guidance">
            <article>
              <span>01</span>
              <div>
                <strong>Área de seguridad</strong>
                <p>
                  Mantén espacio libre alrededor del logo para evitar
                  interferencias visuales.
                </p>
              </div>
            </article>

            <article>
              <span>02</span>
              <div>
                <strong>Contraste suficiente</strong>
                <p>
                  Utiliza la variante que mantenga mejor legibilidad sobre el
                  fondo elegido.
                </p>
              </div>
            </article>

            <article>
              <span>03</span>
              <div>
                <strong>Proporción original</strong>
                <p>
                  No estires, comprimas, inclines ni reconstruyas el archivo de
                  marca.
                </p>
              </div>
            </article>
          </section>
        </div>
      )}
      {tab === "rules" && (
        <div className="brand-rules-overview">
          <section className="brand-rules-overview__hero">
            <div>
              <span className="brand-section-eyebrow">Gobernanza de marca</span>

              <h3>Decisiones creativas dentro de límites claros</h3>

              <p>
                Estas reglas indican a Ascend qué elementos debe utilizar,
                priorizar o evitar al generar contenido para tu marca.
              </p>
            </div>

            <div className="brand-rules-overview__score">
              <strong>
                {Object.values(rule).reduce(
                  (total, items) =>
                    total + (Array.isArray(items) ? items.length : 0),
                  0,
                )}
              </strong>

              <span>reglas configuradas</span>
            </div>
          </section>

          <div className="brand-rules-overview__grid">
            <RuleOverviewCard
              number="01"
              title="Paleta aprobada"
              description="Colores que pueden formar parte de las composiciones."
              count={rule.allowed_colors?.length || 0}
              tone="success"
            >
              <div className="brand-rule-color-list">
                {(rule.allowed_colors || []).length ? (
                  rule.allowed_colors.map((item, index) => {
                    const color = typeof item === "string" ? item : item.hex;

                    return (
                      <span key={`${color}-${index}`}>
                        <i style={{ background: color }} />
                        <strong>
                          {typeof item === "string"
                            ? item
                            : item.name || item.hex}
                        </strong>
                        <small>
                          {typeof item === "object"
                            ? item.usage || "permitido"
                            : "permitido"}
                        </small>
                      </span>
                    );
                  })
                ) : (
                  <RuleEmptyText text="Sin colores permitidos registrados." />
                )}
              </div>
            </RuleOverviewCard>

            <RuleOverviewCard
              number="02"
              title="Restricciones cromáticas"
              description="Colores que deben evitarse en la comunicación."
              count={rule.forbidden_colors?.length || 0}
              tone="danger"
            >
              <div className="brand-rule-color-list">
                {(rule.forbidden_colors || []).length ? (
                  rule.forbidden_colors.map((item, index) => {
                    const color = typeof item === "string" ? item : item.hex;

                    return (
                      <span key={`${color}-${index}`}>
                        <i style={{ background: color }} />
                        <strong>
                          {typeof item === "string"
                            ? item
                            : item.name || item.hex}
                        </strong>
                        <small>
                          {typeof item === "object"
                            ? item.reason || "Evitar"
                            : "Evitar"}
                        </small>
                      </span>
                    );
                  })
                ) : (
                  <RuleEmptyText text="Sin restricciones cromáticas." />
                )}
              </div>
            </RuleOverviewCard>

            <RuleOverviewCard
              number="03"
              title="Tipografías autorizadas"
              description="Familias disponibles para construir la jerarquía visual."
              count={rule.allowed_fonts?.length || 0}
              tone="copper"
            >
              <div className="brand-rule-font-list">
                {(rule.allowed_fonts || []).length ? (
                  rule.allowed_fonts.map((item, index) => {
                    const family =
                      typeof item === "string" ? item : item.family;

                    return (
                      <article key={`${family}-${index}`}>
                        <strong
                          style={{
                            fontFamily: `'${family}', sans-serif`,
                          }}
                        >
                          Aa
                        </strong>

                        <div>
                          <span>{family || "Sin familia"}</span>
                          <small>
                            {typeof item === "object"
                              ? item.usage || "Uso general"
                              : "Uso general"}
                          </small>
                        </div>
                      </article>
                    );
                  })
                ) : (
                  <RuleEmptyText text="Sin tipografías autorizadas." />
                )}
              </div>
            </RuleOverviewCard>

            <RuleOverviewCard
              number="04"
              title="Elementos obligatorios"
              description="Componentes que deben formar parte de determinadas piezas."
              count={rule.required_elements?.length || 0}
              tone="info"
            >
              <RuleTagCollection
                items={rule.required_elements}
                field="label"
                empty="Sin elementos obligatorios."
              />
            </RuleOverviewCard>

            <RuleOverviewCard
              number="05"
              title="Elementos a evitar"
              description="Objetos, recursos o estilos incompatibles con la marca."
              count={rule.forbidden_elements?.length || 0}
              tone="danger"
            >
              <RuleTagCollection
                items={rule.forbidden_elements}
                field="label"
                empty="Sin elementos prohibidos."
              />
            </RuleOverviewCard>

            <RuleOverviewCard
              number="06"
              title="Lenguaje preferido"
              description="Términos que refuerzan la voz y el posicionamiento."
              count={rule.preferred_terms?.length || 0}
              tone="success"
            >
              <RuleTagCollection
                items={rule.preferred_terms}
                field="term"
                empty="Sin términos preferidos."
              />
            </RuleOverviewCard>

            <RuleOverviewCard
              number="07"
              title="Lenguaje restringido"
              description="Términos que no deben utilizarse en las piezas."
              count={rule.forbidden_terms?.length || 0}
              tone="danger"
            >
              <RuleTagCollection
                items={rule.forbidden_terms}
                field="term"
                empty="Sin términos restringidos."
              />
            </RuleOverviewCard>

            <RuleOverviewCard
              number="08"
              title="Posición del logo"
              description="Ubicaciones aprobadas para la firma visual."
              count={rule.logo_position_preferences?.length || 0}
              tone="copper"
            >
              <RuleTagCollection
                items={rule.logo_position_preferences}
                field="position"
                empty="Sin posiciones preferidas."
              />
            </RuleOverviewCard>
          </div>
        </div>
      )}
      {tab === "preferences" && (
        <div className="brand-preferences-overview">
          <section className="brand-preferences-overview__hero">
            <div>
              <span className="brand-section-eyebrow">
                Inteligencia creativa
              </span>

              <h3>Un sistema que aprende de tus decisiones</h3>

              <p>
                Ascend identifica patrones en tu actividad creativa para
                comprender estilos, criterios y elecciones recurrentes de tu
                workspace.
              </p>
            </div>

            <div className="brand-preferences-overview__score">
              <strong>
                {Object.keys(preference?.learned_preferences || {}).length}
              </strong>
              <span>preferencias detectadas</span>
            </div>
          </section>

          {Object.keys(preference?.learned_preferences || {}).length ? (
            <>
              <section className="brand-preferences-overview__summary">
                <article>
                  <span>Fuente</span>
                  <strong>Actividad del workspace</strong>
                </article>

                <article>
                  <span>Actualización</span>
                  <strong>Automática</strong>
                </article>

                <article>
                  <span>Modo</span>
                  <strong>Solo lectura</strong>
                </article>

                <article>
                  <span>Estado</span>
                  <strong className="is-active">Aprendizaje activo</strong>
                </article>
              </section>

              <div className="brand-preferences-overview__grid">
                {Object.entries(preference.learned_preferences).map(
                  ([key, value], index) => (
                    <article className="brand-preference-card" key={key}>
                      <header>
                        <span>{String(index + 1).padStart(2, "0")}</span>

                        <div>
                          <small>{preferenceValueType(value)}</small>

                          <h3>{humanizePreferenceKey(key)}</h3>
                        </div>

                        <i aria-hidden="true" />
                      </header>

                      <div className="brand-preference-card__content">
                        <PreferenceValue value={value} />
                      </div>
                    </article>
                  ),
                )}
              </div>

              <section className="brand-preferences-overview__explanation">
                <div className="brand-preferences-overview__explanation-icon">
                  ✦
                </div>

                <div>
                  <span>Cómo se utiliza</span>
                  <h3>Dirección creativa adaptativa</h3>

                  <p>
                    Estas señales pueden ayudar a priorizar estilos,
                    composiciones, términos, formatos y decisiones que coincidan
                    mejor con el historial del workspace.
                  </p>
                </div>

                <div className="brand-preferences-overview__steps">
                  <article>
                    <strong>01</strong>
                    <span>Observa decisiones</span>
                  </article>

                  <article>
                    <strong>02</strong>
                    <span>Detecta patrones</span>
                  </article>

                  <article>
                    <strong>03</strong>
                    <span>Refina resultados</span>
                  </article>
                </div>
              </section>
            </>
          ) : (
            <section className="brand-preferences-empty">
              <div className="brand-preferences-empty__visual">
                <span>✦</span>
                <i />
                <i />
                <i />
              </div>

              <div>
                <span className="brand-section-eyebrow">
                  Aprendizaje pendiente
                </span>

                <h3>Aún no hay patrones suficientes</h3>

                <p>
                  A medida que crees proyectos, selecciones resultados y
                  utilices recursos, Ascend podrá identificar preferencias
                  creativas recurrentes.
                </p>

                <div className="brand-preferences-empty__signals">
                  <span>Estilos utilizados</span>
                  <span>Formatos elegidos</span>
                  <span>Resultados preferidos</span>
                </div>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function getBrandPreviewLogo(form) {
  return form.logo_light_url || form.logo_url || form.logo_dark_url || "";
}

function getBrandPreviewInitials(name = "") {
  const words = String(name).trim().split(/\s+/).filter(Boolean);

  if (!words.length) return "BR";

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

function getBrandRuleCount(rule = {}) {
  return Object.values(rule).reduce(
    (total, values) => total + (Array.isArray(values) ? values.length : 0),
    0,
  );
}

function BrandLivePreview({ form, assets, rule, completion }) {
  const heroAsset =
    assets.find(
      (asset) =>
        ["product", "lifestyle", "reference_ad", "background"].includes(
          asset.category,
        ) && asset.file_url,
    ) || assets.find((asset) => asset.file_url);

  const logo = getBrandPreviewLogo(form);
  const initials = getBrandPreviewInitials(form.brand_name);

  const allowedColors = [
    ...(rule?.allowed_colors || []).map((item) =>
      typeof item === "string" ? item : item.hex,
    ),
  ].filter(Boolean);

  const palette = [
    form.primary_color || "#171A20",
    form.secondary_color || "#F3EEE6",
    form.accent_color || "#B67A45",
    ...allowedColors,
  ]
    .filter(
      (color, index, collection) =>
        color && collection.indexOf(color) === index,
    )
    .slice(0, 6);

  const configuredLogos = [
    form.logo_url,
    form.logo_dark_url,
    form.logo_light_url,
  ].filter(Boolean).length;

  const ruleCount = getBrandRuleCount(rule);

  const configuredItems = [
    form.brand_name,
    form.brand_description,
    form.primary_color,
    form.secondary_color,
    form.accent_color,
    form.font_primary,
    form.font_secondary,
    form.tone_of_voice,
    form.default_call_to_action,
    form.logo_url,
  ].filter(Boolean).length;

  return (
    <CatalogPreview
      className="brand-preview-panel"
      eyebrow="Inspector creativo"
      title="Vista previa de marca"
      subtitle="Así se aplicará tu identidad en contenidos creados con Ascend."
      sticky
      actions={
        <div
          className="brand-preview-panel__completion"
          aria-label={`${completion}% configurado`}
        >
          <div
            className="brand-preview-panel__completion-ring"
            style={{
              "--brand-preview-progress": `${completion * 3.6}deg`,
            }}
          >
            <span>{completion}</span>
            <small>%</small>
          </div>
        </div>
      }
    >
      <section
        className="brand-preview-campaign"
        style={{
          "--preview-primary": form.primary_color || "#171A20",
          "--preview-secondary": form.secondary_color || "#F3EEE6",
          "--preview-accent": form.accent_color || "#B67A45",
          "--preview-primary-font": `'${
            form.font_primary || "Manrope"
          }', sans-serif`,
          "--preview-secondary-font": `'${
            form.font_secondary || "Inter"
          }', sans-serif`,
        }}
      >
        <span className="brand-preview-campaign__grid" aria-hidden="true" />

        <span className="brand-preview-campaign__glow" aria-hidden="true" />

        <header className="brand-preview-campaign__header">
          <div className="brand-preview-campaign__brand">
            {logo ? (
              <img src={logo} alt={form.brand_name || "Logo de marca"} />
            ) : (
              <span>{initials}</span>
            )}
          </div>

          <small>BRAND SYSTEM</small>
        </header>

        <div className="brand-preview-campaign__content">
          <div className="brand-preview-campaign__copy">
            <span className="brand-preview-campaign__eyebrow">
              Identidad aplicada
            </span>

            <h3>{form.brand_name || "Construye una marca reconocible"}</h3>

            <p>
              {form.brand_description ||
                "Una identidad consistente transforma cada contenido en una expresión clara, memorable y propia."}
            </p>

            <button type="button" tabIndex={-1}>
              {form.default_call_to_action || "Descubrir la marca"}
            </button>
          </div>

          <div className="brand-preview-campaign__media">
            <PreviewMedia
              src={heroAsset?.file_url}
              alt={heroAsset?.name || "Recurso principal de marca"}
              aspectRatio="4 / 5"
              fit="cover"
              className="brand-preview-campaign__asset"
            >
              <div className="brand-preview-campaign__fallback">
                <span>{initials}</span>
                <small>Recurso visual</small>
              </div>
            </PreviewMedia>
          </div>
        </div>

        <footer className="brand-preview-campaign__footer">
          <span>
            {form.tone_of_voice ? "Voz de marca activa" : "Voz pendiente"}
          </span>

          <i aria-hidden="true" />

          <span>{heroAsset ? "Recurso aplicado" : "Sin recurso visual"}</span>
        </footer>
      </section>

      <section className="brand-preview-section brand-preview-identity">
        <header className="brand-preview-section__header">
          <div>
            <span>Identidad activa</span>
            <h3>Dirección de marca</h3>
          </div>

          <i aria-hidden="true" />
        </header>

        <dl className="brand-preview-identity__list">
          <div>
            <dt>Marca</dt>
            <dd>{form.brand_name || "Sin configurar"}</dd>
          </div>

          <div>
            <dt>CTA principal</dt>
            <dd>{form.default_call_to_action || "Sin configurar"}</dd>
          </div>

          <div>
            <dt>Tono</dt>
            <dd>{form.tone_of_voice || "Sin dirección verbal"}</dd>
          </div>
        </dl>
      </section>

      <section className="brand-preview-section brand-preview-typography">
        <header className="brand-preview-section__header">
          <div>
            <span>Sistema tipográfico</span>
            <h3>Jerarquía aplicada</h3>
          </div>

          <b>Aa</b>
        </header>

        <div className="brand-preview-typography__samples">
          <article>
            <span>Principal</span>

            <strong
              style={{
                fontFamily: `'${form.font_primary || "Manrope"}', sans-serif`,
              }}
            >
              Ideas con dirección.
            </strong>

            <small>{form.font_primary || "Manrope"}</small>
          </article>

          <article>
            <span>Secundaria</span>

            <p
              style={{
                fontFamily: `'${form.font_secondary || "Inter"}', sans-serif`,
              }}
            >
              Una voz clara y consistente en cada punto de contacto.
            </p>

            <small>{form.font_secondary || "Inter"}</small>
          </article>
        </div>
      </section>

      <section className="brand-preview-section brand-preview-palette">
        <header className="brand-preview-section__header">
          <div>
            <span>Sistema visual</span>
            <h3>Paleta activa</h3>
          </div>

          <strong>{palette.length}</strong>
        </header>

        <div className="brand-preview-palette__colors">
          {palette.map((color, index) => (
            <article key={`${color}-${index}`}>
              <i style={{ background: color }} />

              <div>
                <span>
                  {index === 0
                    ? "Principal"
                    : index === 1
                      ? "Secundario"
                      : index === 2
                        ? "Acento"
                        : "Permitido"}
                </span>

                <strong>{color}</strong>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="brand-preview-metrics">
        <article>
          <span>Configuración</span>
          <strong>{configuredItems}/10</strong>
          <small>campos esenciales</small>
        </article>

        <article>
          <span>Logos</span>
          <strong>{configuredLogos}/3</strong>
          <small>variantes cargadas</small>
        </article>

        <article>
          <span>Reglas</span>
          <strong>{ruleCount}</strong>
          <small>criterios activos</small>
        </article>
      </section>

      <div className="notice info brand-preview-notice">
        <span>i</span>

        <p>
          <strong>Validación visual</strong>
          Comprueba el contraste de logos, tipografías y botones sobre
          superficies claras y oscuras.
        </p>
      </div>
    </CatalogPreview>
  );
}

function getRuleEditorSummary(rule = {}) {
  const allowed =
    (rule.allowed_colors?.length || 0) +
    (rule.allowed_fonts?.length || 0) +
    (rule.required_elements?.length || 0) +
    (rule.preferred_terms?.length || 0) +
    (rule.logo_position_preferences?.length || 0);

  const restricted =
    (rule.forbidden_colors?.length || 0) +
    (rule.forbidden_elements?.length || 0) +
    (rule.forbidden_terms?.length || 0);

  const visual =
    (rule.allowed_colors?.length || 0) +
    (rule.forbidden_colors?.length || 0) +
    (rule.allowed_fonts?.length || 0) +
    (rule.required_elements?.length || 0) +
    (rule.forbidden_elements?.length || 0) +
    (rule.logo_position_preferences?.length || 0);

  const verbal =
    (rule.preferred_terms?.length || 0) + (rule.forbidden_terms?.length || 0);

  return {
    total: allowed + restricted,
    allowed,
    restricted,
    visual,
    verbal,
  };
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

  const ruleEditorSummary = useMemo(
    () => getRuleEditorSummary(ruleForm),
    [ruleForm],
  );

  const configuredLogoCount = useMemo(
    () =>
      [form.logo_url, form.logo_dark_url, form.logo_light_url].filter(Boolean)
        .length,
    [form.logo_url, form.logo_dark_url, form.logo_light_url],
  );

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
      <main className="container ascend-view page page--brand brand-kit-page">
        <PageTitle
          variant="catalog"
          className="page-header brand-kit-page-header"
          eyebrow="BRAND SYSTEM"
          title={editing ? "Editar Brand Kit" : "Brand Kit"}
          description="Define la identidad, la voz y los criterios visuales que Ascend utilizará para representar tu marca de forma consistente."
          meta={
            <div className="brand-kit-page-header__meta">
              <span className="brand-kit-status">
                <i aria-hidden="true" />
                Sistema activo
              </span>

              <span className="brand-kit-completion">
                {completion}% configurado
              </span>
            </div>
          }
          actions={
            <div className="actions brand-kit-page-header__actions">
              {!editing ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setEditing(true)}
                >
                  <span aria-hidden="true">✎</span>
                  Editar Brand Kit
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
          }
        />

        {!editing && (
          <section className="grid metrics-grid brand-kit-metrics">
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
        <nav className="tabs brand-kit-tabs" aria-label="Secciones del kit">
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

        <div className="split-layout brand-kit-workspace">
          <section className="catalog-section brand-kit-content">
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

            {editing && tab === "identity" && (
              <div className="brand-identity-editor">
                <header className="brand-identity-editor__header">
                  <div>
                    <span className="brand-section-eyebrow">
                      Fundamentos de marca
                    </span>

                    <h2>Identidad esencial</h2>

                    <p>
                      Define la información que Ascend utilizará para entender,
                      representar y comunicar correctamente tu negocio.
                    </p>
                  </div>

                  <div className="brand-identity-editor__progress">
                    <span>Configuración</span>
                    <strong>{completion}%</strong>

                    <div aria-hidden="true">
                      <i style={{ width: `${completion}%` }} />
                    </div>
                  </div>
                </header>

                <div className="brand-identity-editor__layout">
                  <div className="brand-identity-editor__fields">
                    <section className="brand-editor-section">
                      <header className="brand-editor-section__header">
                        <span className="brand-editor-section__number">01</span>

                        <div>
                          <h3>Información principal</h3>
                          <p>
                            Identifica la marca y su acción comercial
                            predeterminada.
                          </p>
                        </div>
                      </header>

                      <div className="field-grid brand-identity-field-grid">
                        <Field
                          label="Nombre de marca"
                          hint="Nombre comercial visible en piezas, proyectos y campañas."
                        >
                          <input
                            className="input"
                            value={form.brand_name}
                            onChange={(event) =>
                              update("brand_name", event.target.value)
                            }
                            placeholder="Ej. Norte Studio"
                          />
                        </Field>

                        <Field
                          label="CTA predeterminado"
                          hint="Acción principal que deseas provocar en el público."
                        >
                          <input
                            className="input"
                            value={form.default_call_to_action}
                            onChange={(event) =>
                              update(
                                "default_call_to_action",
                                event.target.value,
                              )
                            }
                            placeholder="Ej. Descubre la colección"
                          />
                        </Field>
                      </div>
                    </section>

                    <section className="brand-editor-section">
                      <header className="brand-editor-section__header">
                        <span className="brand-editor-section__number">02</span>

                        <div>
                          <h3>Propósito y posicionamiento</h3>
                          <p>
                            Explica qué hace la marca, para quién trabaja y qué
                            la hace diferente.
                          </p>
                        </div>
                      </header>

                      <Field
                        label="Descripción de marca"
                        hint="Incluye propuesta de valor, público y diferenciación."
                      >
                        <div className="brand-textarea-control">
                          <textarea
                            className="input textarea brand-identity-description"
                            value={form.brand_description}
                            onChange={(event) =>
                              update("brand_description", event.target.value)
                            }
                            placeholder="Somos una marca que ayuda a..."
                            maxLength={1200}
                          />

                          <span className="char-count">
                            {form.brand_description.length}/1200
                          </span>
                        </div>
                      </Field>
                    </section>

                    <section className="brand-editor-section">
                      <header className="brand-editor-section__header">
                        <span className="brand-editor-section__number">03</span>

                        <div>
                          <h3>Personalidad verbal</h3>
                          <p>
                            Determina cómo debe expresarse la marca en todos sus
                            puntos de contacto.
                          </p>
                        </div>
                      </header>

                      <Field
                        label="Tono de voz"
                        hint="Describe personalidad, ritmo, nivel de formalidad y términos que deben evitarse."
                      >
                        <div className="brand-textarea-control">
                          <textarea
                            className="input textarea brand-identity-tone"
                            value={form.tone_of_voice}
                            onChange={(event) =>
                              update("tone_of_voice", event.target.value)
                            }
                            placeholder="Profesional, cercano y claro. Utiliza frases directas, evita tecnicismos innecesarios..."
                            maxLength={800}
                          />

                          <span className="char-count">
                            {form.tone_of_voice.length}/800
                          </span>
                        </div>
                      </Field>
                    </section>

                    <section className="brand-editor-section brand-editor-section--palette">
                      <header className="brand-editor-section__header">
                        <span className="brand-editor-section__number">04</span>

                        <div>
                          <h3>Paleta principal</h3>
                          <p>
                            Define los tres colores base que dirigirán las
                            composiciones visuales.
                          </p>
                        </div>
                      </header>

                      <div className="brand-identity-color-grid">
                        {[
                          [
                            "primary_color",
                            "Principal",
                            "Identidad, titulares y fondos de alto contraste.",
                          ],
                          [
                            "secondary_color",
                            "Secundario",
                            "Superficies, fondos suaves y áreas de descanso.",
                          ],
                          [
                            "accent_color",
                            "Acento",
                            "Botones, énfasis y elementos de atención.",
                          ],
                        ].map(([key, label, description]) => (
                          <div
                            className="brand-identity-color-editor"
                            key={key}
                          >
                            <div className="brand-identity-color-editor__heading">
                              <span>{label}</span>
                              <small>{description}</small>
                            </div>

                            <BrandColorField
                              label={label}
                              value={form[key]}
                              onChange={(value) => update(key, value)}
                            />
                          </div>
                        ))}
                      </div>
                    </section>
                  </div>

                  <aside
                    className="brand-identity-editor__preview"
                    style={{
                      "--preview-primary": form.primary_color || "#171A20",
                      "--preview-secondary": form.secondary_color || "#F3EEE6",
                      "--preview-accent": form.accent_color || "#B67A45",
                    }}
                  >
                    <header>
                      <div>
                        <span>Vista previa</span>
                        <h3>Expresión de marca</h3>
                      </div>

                      <i aria-hidden="true" />
                    </header>

                    <div className="brand-identity-mini-preview">
                      <div className="brand-identity-mini-preview__top">
                        <span>
                          {(form.brand_name || "B")
                            .trim()
                            .slice(0, 2)
                            .toUpperCase()}
                        </span>

                        <small>BRAND SYSTEM</small>
                      </div>

                      <div className="brand-identity-mini-preview__content">
                        <span>Identidad esencial</span>

                        <h4>{form.brand_name || "Nombre de tu marca"}</h4>

                        <p>
                          {form.brand_description ||
                            "La descripción de tu marca aparecerá aquí como parte de su presentación visual."}
                        </p>

                        <button type="button" tabIndex={-1}>
                          {form.default_call_to_action || "Llamado a la acción"}
                        </button>
                      </div>

                      <div className="brand-identity-mini-preview__colors">
                        <i />
                        <i />
                        <i />
                      </div>
                    </div>

                    <section className="brand-identity-mini-preview__voice">
                      <span>Personalidad verbal</span>

                      <p>
                        {form.tone_of_voice ||
                          "El tono de voz configurado se mostrará en este espacio."}
                      </p>
                    </section>

                    <footer>
                      Esta vista se actualiza automáticamente mientras editas
                      los campos.
                    </footer>
                  </aside>
                </div>
              </div>
            )}

            {editing && tab === "typography" && (
              <div className="brand-type-editor">
                <header className="brand-editor-header">
                  <div>
                    <span className="brand-section-eyebrow">
                      Jerarquía visual
                    </span>

                    <h2>Sistema tipográfico</h2>

                    <p>
                      Selecciona una familia de alto impacto para títulos y otra
                      optimizada para lectura continua.
                    </p>
                  </div>

                  <div className="brand-editor-header__indicator">
                    <span>Aa</span>
                  </div>
                </header>

                {fontNotice && (
                  <div className="inline-notice brand-editor-notice">
                    {fontNotice}
                  </div>
                )}

                <div className="brand-type-editor__layout">
                  <div className="brand-type-editor__controls">
                    <section className="brand-editor-section">
                      <header className="brand-editor-section__header">
                        <span className="brand-editor-section__number">01</span>

                        <div>
                          <h3>Tipografía principal</h3>
                          <p>
                            Utilízala para títulos, campañas, cifras y mensajes
                            de alto impacto.
                          </p>
                        </div>
                      </header>

                      <FontPicker
                        id="primary-fonts"
                        label="Familia para títulos"
                        value={form.font_primary}
                        fonts={fonts}
                        onChange={(value) => update("font_primary", value)}
                      />
                    </section>

                    <section className="brand-editor-section">
                      <header className="brand-editor-section__header">
                        <span className="brand-editor-section__number">02</span>

                        <div>
                          <h3>Tipografía secundaria</h3>
                          <p>
                            Utilízala para párrafos, etiquetas, campos y
                            contenido informativo.
                          </p>
                        </div>
                      </header>

                      <FontPicker
                        id="secondary-fonts"
                        label="Familia para textos"
                        value={form.font_secondary}
                        fonts={fonts}
                        onChange={(value) => update("font_secondary", value)}
                      />
                    </section>
                  </div>

                  <aside className="brand-type-editor__preview">
                    <header>
                      <div>
                        <span>Vista previa</span>
                        <h3>Jerarquía aplicada</h3>
                      </div>

                      <i aria-hidden="true" />
                    </header>

                    <div className="brand-type-editor__canvas">
                      <span
                        style={{
                          fontFamily: `'${form.font_secondary || "Inter"}', sans-serif`,
                        }}
                      >
                        BRAND SYSTEM · NUEVA COLECCIÓN
                      </span>

                      <h4
                        style={{
                          fontFamily: `'${form.font_primary || "Manrope"}', sans-serif`,
                        }}
                      >
                        Una marca que deja huella.
                      </h4>

                      <p
                        style={{
                          fontFamily: `'${form.font_secondary || "Inter"}', sans-serif`,
                        }}
                      >
                        Diseñamos experiencias claras, memorables y consistentes
                        en cada punto de contacto.
                      </p>

                      <button
                        type="button"
                        tabIndex={-1}
                        style={{
                          fontFamily: `'${form.font_secondary || "Inter"}', sans-serif`,
                        }}
                      >
                        Descubrir más
                      </button>
                    </div>

                    <div className="brand-type-editor__details">
                      <article>
                        <span>Principal</span>
                        <strong>{form.font_primary || "Sin definir"}</strong>
                      </article>

                      <article>
                        <span>Secundaria</span>
                        <strong>{form.font_secondary || "Sin definir"}</strong>
                      </article>
                    </div>

                    <footer>
                      La muestra se actualiza automáticamente al cambiar
                      cualquiera de las familias.
                    </footer>
                  </aside>
                </div>
              </div>
            )}

            {editing && tab === "logos" && (
              <div className="brand-logo-editor brand-logo-editor--horizontal">
                <header className="brand-logo-editor__header">
                  <div className="brand-logo-editor__header-copy">
                    <span className="brand-section-eyebrow">
                      Activos esenciales
                    </span>

                    <h2>Sistema de logos</h2>

                    <p>
                      Configura las tres variantes principales de tu firma
                      visual para mantener reconocimiento, legibilidad y
                      contraste en cualquier aplicación.
                    </p>
                  </div>

                  <div className="brand-logo-editor__completion">
                    <div
                      className="brand-logo-editor__completion-ring"
                      style={{
                        "--logo-progress": `${(configuredLogoCount / 3) * 360}deg`,
                      }}
                    >
                      <span>{configuredLogoCount}</span>
                      <small>/3</small>
                    </div>

                    <div>
                      <strong>
                        {configuredLogoCount === 3
                          ? "Sistema completo"
                          : "Configuración pendiente"}
                      </strong>

                      <span>
                        {configuredLogoCount} de 3 variantes disponibles
                      </span>
                    </div>
                  </div>
                </header>

                <section className="brand-logo-editor__principles">
                  <article>
                    <span>01</span>

                    <div>
                      <strong>Consistencia</strong>
                      <p>Conserva la proporción y construcción original.</p>
                    </div>
                  </article>

                  <article>
                    <span>02</span>

                    <div>
                      <strong>Contraste</strong>
                      <p>Utiliza la variante apropiada para cada superficie.</p>
                    </div>
                  </article>

                  <article>
                    <span>03</span>

                    <div>
                      <strong>Legibilidad</strong>
                      <p>Prioriza archivos claros y con buena resolución.</p>
                    </div>
                  </article>
                </section>

                <section className="brand-logo-editor__signature">
                  <header className="brand-logo-editor__signature-header">
                    <div>
                      <span>Firma principal</span>
                      <h3>Variantes del sistema de logos</h3>

                      <p>
                        Carga una versión diferente para cada tipo de fondo.
                        Cada archivo se guardará en su campo correspondiente.
                      </p>
                    </div>

                    <strong>{configuredLogoCount} de 3 configuradas</strong>
                  </header>

                  <div className="brand-logo-editor__grid">
                    <article className="brand-logo-editor__card brand-logo-editor__card--primary">
                      <header className="brand-logo-editor__card-header">
                        <span className="brand-logo-editor__card-number">
                          01
                        </span>

                        <div>
                          <span>Firma principal</span>
                          <h3>Logo principal</h3>
                        </div>

                        <b
                          className={
                            form.logo_url
                              ? "brand-logo-editor__status is-ready"
                              : "brand-logo-editor__status"
                          }
                        >
                          <i aria-hidden="true" />
                          {form.logo_url ? "Configurado" : "Pendiente"}
                        </b>
                      </header>

                      <p className="brand-logo-editor__card-description">
                        Versión de uso general para fondos neutros, documentos,
                        presentaciones y aplicaciones corporativas.
                      </p>

                      <LogoUploader
                        label="Logo principal"
                        value={form.logo_url}
                        busy={uploading === "logo_url"}
                        surface="neutral"
                        onUpload={(file) => uploadLogo("logo_url", file)}
                        onClear={() => update("logo_url", "")}
                      />

                      <footer className="brand-logo-editor__card-footer">
                        <span>Uso recomendado</span>
                        <strong>Fondos neutros y aplicaciones generales</strong>
                      </footer>
                    </article>

                    <article className="brand-logo-editor__card brand-logo-editor__card--dark">
                      <header className="brand-logo-editor__card-header">
                        <span className="brand-logo-editor__card-number">
                          02
                        </span>

                        <div>
                          <span>Versión invertida</span>
                          <h3>Fondos oscuros</h3>
                        </div>

                        <b
                          className={
                            form.logo_dark_url
                              ? "brand-logo-editor__status is-ready"
                              : "brand-logo-editor__status"
                          }
                        >
                          <i aria-hidden="true" />
                          {form.logo_dark_url ? "Configurado" : "Pendiente"}
                        </b>
                      </header>

                      <p className="brand-logo-editor__card-description">
                        Versión clara o invertida para superficies oscuras,
                        fotografías y composiciones de alto contraste.
                      </p>

                      <LogoUploader
                        label="Logo para fondos oscuros"
                        value={form.logo_dark_url}
                        busy={uploading === "logo_dark_url"}
                        surface="dark"
                        onUpload={(file) => uploadLogo("logo_dark_url", file)}
                        onClear={() => update("logo_dark_url", "")}
                      />

                      <footer className="brand-logo-editor__card-footer">
                        <span>Uso recomendado</span>
                        <strong>Fondos oscuros y piezas premium</strong>
                      </footer>
                    </article>

                    <article className="brand-logo-editor__card brand-logo-editor__card--light">
                      <header className="brand-logo-editor__card-header">
                        <span className="brand-logo-editor__card-number">
                          03
                        </span>

                        <div>
                          <span>Versión de contraste</span>
                          <h3>Fondos claros</h3>
                        </div>

                        <b
                          className={
                            form.logo_light_url
                              ? "brand-logo-editor__status is-ready"
                              : "brand-logo-editor__status"
                          }
                        >
                          <i aria-hidden="true" />
                          {form.logo_light_url ? "Configurado" : "Pendiente"}
                        </b>
                      </header>

                      <p className="brand-logo-editor__card-description">
                        Versión oscura para fondos blancos, marfil, interfaces
                        claras y aplicaciones impresas.
                      </p>

                      <LogoUploader
                        label="Logo para fondos claros"
                        value={form.logo_light_url}
                        busy={uploading === "logo_light_url"}
                        surface="light"
                        onUpload={(file) => uploadLogo("logo_light_url", file)}
                        onClear={() => update("logo_light_url", "")}
                      />

                      <footer className="brand-logo-editor__card-footer">
                        <span>Uso recomendado</span>
                        <strong>Fondos claros, interfaces y papelería</strong>
                      </footer>
                    </article>
                  </div>
                </section>

                <section className="brand-logo-editor__recommendation">
                  <span>Recomendación técnica</span>

                  <p>
                    Utiliza archivos PNG, WebP o SVG con transparencia. Conserva
                    la proporción original, evita márgenes internos excesivos y
                    comprueba que el logo siga siendo legible en tamaños
                    pequeños.
                  </p>
                </section>
              </div>
            )}

            {editing && tab === "rules" && (
              <div className="brand-rules-edit-overview">
                <section className="brand-rules-overview__hero brand-rules-edit-overview__hero">
                  <div>
                    <span className="brand-section-eyebrow">
                      Gobernanza de marca
                    </span>

                    <h3>Define y edita los límites creativos</h3>

                    <p>
                      Completa los valores permitidos, restringidos y
                      recomendados. Cada tarjeta corresponde a una categoría
                      visible en la vista normal de Reglas.
                    </p>
                  </div>

                  <div className="brand-rules-overview__score">
                    <strong>{ruleEditorSummary.total}</strong>
                    <span>reglas configuradas</span>
                  </div>
                </section>

                <section className="brand-rules-edit-overview__status">
                  <article>
                    <span>Paleta</span>
                    <strong>
                      {(ruleForm.allowed_colors?.length || 0) +
                        (ruleForm.forbidden_colors?.length || 0)}
                    </strong>
                    <small>reglas cromáticas</small>
                  </article>

                  <article>
                    <span>Tipografía</span>
                    <strong>{ruleForm.allowed_fonts?.length || 0}</strong>
                    <small>familias autorizadas</small>
                  </article>

                  <article>
                    <span>Elementos</span>
                    <strong>
                      {(ruleForm.required_elements?.length || 0) +
                        (ruleForm.forbidden_elements?.length || 0)}
                    </strong>
                    <small>criterios visuales</small>
                  </article>

                  <article>
                    <span>Lenguaje</span>
                    <strong>
                      {(ruleForm.preferred_terms?.length || 0) +
                        (ruleForm.forbidden_terms?.length || 0)}
                    </strong>
                    <small>criterios verbales</small>
                  </article>
                </section>

                <div className="brand-rules-edit-overview__grid">
                  <section className="brand-rule-edit-card brand-rule-edit-card--success">
                    <header className="brand-rule-edit-card__header">
                      <span>01</span>

                      <div>
                        <small>Paleta aprobada</small>
                        <h3>Colores permitidos</h3>

                        <p>
                          Registra los colores que pueden formar parte de las
                          composiciones y define su función.
                        </p>
                      </div>

                      <b>{ruleForm.allowed_colors?.length || 0}</b>
                    </header>

                    <div className="brand-rule-edit-card__content">
                      <ObjectList
                        value={ruleForm.allowed_colors}
                        onChange={(next) =>
                          setRuleForm({
                            ...ruleForm,
                            allowed_colors: next,
                          })
                        }
                        addLabel="Agregar color permitido"
                        fields={[
                          {
                            key: "name",
                            label: "Nombre",
                            placeholder: "Cobre principal",
                          },
                          {
                            key: "hex",
                            label: "Color",
                            type: "color",
                            default: "#B67A45",
                          },
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
                  </section>

                  <section className="brand-rule-edit-card brand-rule-edit-card--danger">
                    <header className="brand-rule-edit-card__header">
                      <span>02</span>

                      <div>
                        <small>Restricciones cromáticas</small>
                        <h3>Colores prohibidos</h3>

                        <p>
                          Indica qué colores deben evitarse y explica por qué no
                          corresponden a la identidad.
                        </p>
                      </div>

                      <b>{ruleForm.forbidden_colors?.length || 0}</b>
                    </header>

                    <div className="brand-rule-edit-card__content">
                      <ObjectList
                        value={ruleForm.forbidden_colors}
                        onChange={(next) =>
                          setRuleForm({
                            ...ruleForm,
                            forbidden_colors: next,
                          })
                        }
                        addLabel="Agregar color prohibido"
                        fields={[
                          {
                            key: "name",
                            label: "Nombre",
                            placeholder: "Rojo brillante",
                          },
                          {
                            key: "hex",
                            label: "Color",
                            type: "color",
                            default: "#FF0000",
                          },
                          {
                            key: "reason",
                            label: "Motivo",
                            wide: true,
                            placeholder:
                              "No coincide con la identidad de marca",
                          },
                        ]}
                      />
                    </div>
                  </section>

                  <section className="brand-rule-edit-card brand-rule-edit-card--copper">
                    <header className="brand-rule-edit-card__header">
                      <span>03</span>

                      <div>
                        <small>Sistema tipográfico</small>
                        <h3>Tipografías autorizadas</h3>

                        <p>
                          Define las familias disponibles, su uso y una
                          alternativa segura.
                        </p>
                      </div>

                      <b>{ruleForm.allowed_fonts?.length || 0}</b>
                    </header>

                    <div className="brand-rule-edit-card__content">
                      <ObjectList
                        value={ruleForm.allowed_fonts}
                        onChange={(next) =>
                          setRuleForm({
                            ...ruleForm,
                            allowed_fonts: next,
                          })
                        }
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
                          {
                            key: "fallback",
                            label: "Alternativa",
                            placeholder: "Arial",
                          },
                        ]}
                      />
                    </div>
                  </section>

                  <section className="brand-rule-edit-card brand-rule-edit-card--info">
                    <header className="brand-rule-edit-card__header">
                      <span>04</span>

                      <div>
                        <small>Composición</small>
                        <h3>Elementos obligatorios</h3>

                        <p>
                          Define los componentes que deben aparecer y las
                          condiciones en las que son necesarios.
                        </p>
                      </div>

                      <b>{ruleForm.required_elements?.length || 0}</b>
                    </header>

                    <div className="brand-rule-edit-card__content">
                      <ObjectList
                        value={ruleForm.required_elements}
                        onChange={(next) =>
                          setRuleForm({
                            ...ruleForm,
                            required_elements: next,
                          })
                        }
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
                          {
                            key: "label",
                            label: "Etiqueta",
                            placeholder: "Logo principal",
                          },
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
                  </section>

                  <section className="brand-rule-edit-card brand-rule-edit-card--danger">
                    <header className="brand-rule-edit-card__header">
                      <span>05</span>

                      <div>
                        <small>Restricciones visuales</small>
                        <h3>Elementos a evitar</h3>

                        <p>
                          Añade objetos, símbolos, efectos o estilos que no
                          deben aparecer.
                        </p>
                      </div>

                      <b>{ruleForm.forbidden_elements?.length || 0}</b>
                    </header>

                    <div className="brand-rule-edit-card__content">
                      <Field
                        label="Elementos prohibidos"
                        hint="Escribe un elemento y presiona Enter."
                      >
                        <TagsInput
                          value={(ruleForm.forbidden_elements || []).map(
                            (item) =>
                              typeof item === "string"
                                ? item
                                : item.label || item.value,
                          )}
                          onChange={(items) =>
                            setRuleForm({
                              ...ruleForm,
                              forbidden_elements: items.map((label) => ({
                                type: "visual_element",
                                value: label.toLowerCase().replace(/\s+/g, "_"),
                                label,
                              })),
                            })
                          }
                          placeholder="Ej. degradados saturados"
                        />
                      </Field>
                    </div>
                  </section>

                  <section className="brand-rule-edit-card brand-rule-edit-card--success">
                    <header className="brand-rule-edit-card__header">
                      <span>06</span>

                      <div>
                        <small>Lenguaje preferido</small>
                        <h3>Términos recomendados</h3>

                        <p>
                          Registra palabras y expresiones que representan la voz
                          de la marca.
                        </p>
                      </div>

                      <b>{ruleForm.preferred_terms?.length || 0}</b>
                    </header>

                    <div className="brand-rule-edit-card__content">
                      <ObjectList
                        value={ruleForm.preferred_terms}
                        onChange={(next) =>
                          setRuleForm({
                            ...ruleForm,
                            preferred_terms: next,
                          })
                        }
                        addLabel="Agregar término preferido"
                        fields={[
                          {
                            key: "term",
                            label: "Término",
                            placeholder: "Calidad premium",
                          },
                          {
                            key: "context",
                            label: "Contexto",
                            placeholder: "Descripción del producto",
                          },
                        ]}
                      />
                    </div>
                  </section>

                  <section className="brand-rule-edit-card brand-rule-edit-card--danger">
                    <header className="brand-rule-edit-card__header">
                      <span>07</span>

                      <div>
                        <small>Lenguaje restringido</small>
                        <h3>Términos prohibidos</h3>

                        <p>
                          Añade términos que deben evitarse e indica una
                          alternativa apropiada.
                        </p>
                      </div>

                      <b>{ruleForm.forbidden_terms?.length || 0}</b>
                    </header>

                    <div className="brand-rule-edit-card__content">
                      <ObjectList
                        value={ruleForm.forbidden_terms}
                        onChange={(next) =>
                          setRuleForm({
                            ...ruleForm,
                            forbidden_terms: next,
                          })
                        }
                        addLabel="Agregar término prohibido"
                        fields={[
                          {
                            key: "term",
                            label: "Término",
                            placeholder: "Barato",
                          },
                          {
                            key: "replacement",
                            label: "Alternativa",
                            placeholder: "Accesible",
                          },
                        ]}
                      />
                    </div>
                  </section>

                  <section className="brand-rule-edit-card brand-rule-edit-card--copper">
                    <header className="brand-rule-edit-card__header">
                      <span>08</span>

                      <div>
                        <small>Firma visual</small>
                        <h3>Posición del logo</h3>

                        <p>
                          Define ubicaciones aprobadas, prioridad y margen
                          mínimo.
                        </p>
                      </div>

                      <b>{ruleForm.logo_position_preferences?.length || 0}</b>
                    </header>

                    <div className="brand-rule-edit-card__content">
                      <ObjectList
                        value={ruleForm.logo_position_preferences}
                        onChange={(next) =>
                          setRuleForm({
                            ...ruleForm,
                            logo_position_preferences: next,
                          })
                        }
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
                              ["center", "Centro"],
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
                          },
                          {
                            key: "minimum_margin",
                            label: "Margen mínimo",
                            type: "number",
                            default: 30,
                          },
                        ]}
                      />
                    </div>
                  </section>
                </div>

                <footer className="brand-rules-edit-overview__savebar">
                  <div>
                    <span>Estado de edición</span>

                    <strong>
                      {ruleEditorSummary.total
                        ? `${ruleEditorSummary.total} reglas listas para guardar`
                        : "Añade valores a las categorías de reglas"}
                    </strong>
                  </div>

                  <div>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setEditing(false)}
                    >
                      Cancelar
                    </button>

                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={saveRules}
                      disabled={busy}
                    >
                      {busy ? "Guardando…" : "Guardar reglas"}
                    </button>
                  </div>
                </footer>
              </div>
            )}

            {editing && tab === "preferences" && (
              <div className="brand-preferences-editor">
                <header className="brand-editor-header">
                  <div>
                    <span className="brand-section-eyebrow">
                      Dirección creativa
                    </span>

                    <h2>Preferencias del workspace</h2>

                    <p>
                      Estas preferencias se aprenden automáticamente a partir de
                      la actividad creativa. Actualmente son datos técnicos de
                      solo lectura.
                    </p>
                  </div>

                  <div className="brand-preferences-editor__status">
                    <i aria-hidden="true" />

                    <div>
                      <strong>Aprendizaje automático</strong>
                      <span>Solo lectura</span>
                    </div>
                  </div>
                </header>

                <section className="brand-preferences-editor__explanation">
                  <article>
                    <span>01</span>
                    <div>
                      <strong>Actividad</strong>
                      <p>Ascend observa selecciones y resultados utilizados.</p>
                    </div>
                  </article>

                  <article>
                    <span>02</span>
                    <div>
                      <strong>Patrones</strong>
                      <p>El sistema identifica decisiones recurrentes.</p>
                    </div>
                  </article>

                  <article>
                    <span>03</span>
                    <div>
                      <strong>Adaptación</strong>
                      <p>
                        Las preferencias pueden orientar futuras generaciones.
                      </p>
                    </div>
                  </article>
                </section>

                {Object.keys(preferenceForm.learned_preferences || {}).length >
                0 ? (
                  <div className="brand-preferences-editor__layout">
                    <section className="brand-preferences-editor__visual">
                      <header>
                        <div>
                          <span>Lectura interpretada</span>
                          <h3>Preferencias detectadas</h3>
                        </div>

                        <strong>
                          {
                            Object.keys(preferenceForm.learned_preferences)
                              .length
                          }
                        </strong>
                      </header>

                      <div className="brand-preferences-editor__cards">
                        {Object.entries(preferenceForm.learned_preferences).map(
                          ([key, value], index) => (
                            <article key={key}>
                              <span>{String(index + 1).padStart(2, "0")}</span>

                              <div>
                                <small>{preferenceValueType(value)}</small>
                                <h4>{humanizePreferenceKey(key)}</h4>

                                <PreferenceValue value={value} />
                              </div>
                            </article>
                          ),
                        )}
                      </div>
                    </section>

                    <aside className="brand-preferences-editor__technical">
                      <header>
                        <div>
                          <span>Datos técnicos</span>
                          <h3>learned_preferences</h3>
                        </div>

                        <b>JSON</b>
                      </header>

                      <pre>
                        {JSON.stringify(
                          preferenceForm.learned_preferences,
                          null,
                          2,
                        )}
                      </pre>

                      <footer>
                        Esta información no puede editarse manualmente desde
                        esta vista.
                      </footer>
                    </aside>
                  </div>
                ) : (
                  <section className="brand-preferences-editor__empty">
                    <span>✦</span>

                    <div>
                      <h3>Sin preferencias aprendidas</h3>

                      <p>
                        El workspace todavía no dispone de actividad suficiente
                        para identificar patrones creativos confiables.
                      </p>
                    </div>
                  </section>
                )}
              </div>
            )}

            {editing && tab === "assets" && (
              <div className="brand-resources-editor">
                <header className="brand-editor-header">
                  <div>
                    <span className="brand-section-eyebrow">
                      Biblioteca visual
                    </span>

                    <h2>Gestionar recursos</h2>

                    <p>
                      Añade activos visuales y contexto descriptivo para que
                      Ascend pueda utilizarlos correctamente en proyectos y
                      generaciones.
                    </p>
                  </div>

                  <div className="brand-resources-editor__total">
                    <strong>{assets.length}</strong>
                    <span>recursos activos</span>
                  </div>
                </header>

                <div className="brand-resources-editor__layout">
                  <form className="brand-resource-upload" onSubmit={addAsset}>
                    <header className="brand-resource-upload__header">
                      <span>Nuevo recurso</span>
                      <h3>Cargar activo de marca</h3>

                      <p>
                        Los datos técnicos se detectan automáticamente. Añade un
                        nombre, una categoría y contexto útil.
                      </p>
                    </header>

                    <section className="brand-resource-upload__file">
                      <input
                        id="brand-resource-file"
                        type="file"
                        required
                        onChange={(event) =>
                          setAssetFile(event.target.files[0] || null)
                        }
                      />

                      <label htmlFor="brand-resource-file">
                        <span className="brand-resource-upload__file-icon">
                          ＋
                        </span>

                        <div>
                          <strong>
                            {assetFile
                              ? assetFile.name
                              : "Selecciona un archivo"}
                          </strong>

                          <small>
                            Imágenes, vídeos y otros activos compatibles
                          </small>
                        </div>

                        <b>{assetFile ? "Cambiar" : "Explorar"}</b>
                      </label>

                      {assetFile && (
                        <div className="brand-resource-upload__file-data">
                          <span>{assetFile.type || "Tipo desconocido"}</span>
                          <strong>
                            {(assetFile.size / 1024 / 1024).toFixed(2)} MB
                          </strong>
                        </div>
                      )}
                    </section>

                    <section className="brand-resource-upload__section">
                      <header>
                        <span>01</span>

                        <div>
                          <h4>Información principal</h4>
                          <p>Identifica y clasifica el recurso.</p>
                        </div>
                      </header>

                      <div className="brand-resource-upload__fields">
                        <Field
                          label="Nombre"
                          hint="Utiliza un nombre descriptivo y fácil de buscar."
                        >
                          <input
                            className="input"
                            value={assetDraft.name}
                            onChange={(event) =>
                              setAssetDraft({
                                ...assetDraft,
                                name: event.target.value,
                              })
                            }
                            placeholder="Ej. Producto principal frontal"
                          />
                        </Field>

                        <Field
                          label="Categoría"
                          hint="Define cómo podrá utilizarse el recurso."
                        >
                          <select
                            className="input"
                            value={assetDraft.category}
                            onChange={(event) =>
                              setAssetDraft({
                                ...assetDraft,
                                category: event.target.value,
                              })
                            }
                          >
                            {categories.map((item) => (
                              <option key={item} value={item}>
                                {item.replaceAll("_", " ")}
                              </option>
                            ))}
                          </select>
                        </Field>
                      </div>
                    </section>

                    <section className="brand-resource-upload__section">
                      <header>
                        <span>02</span>

                        <div>
                          <h4>Contexto y metadatos</h4>
                          <p>
                            Añade información que ayude a interpretar el activo.
                          </p>
                        </div>
                      </header>

                      <div className="brand-resource-upload__metadata">
                        <MetadataBuilder
                          value={assetDraft.metadata}
                          onChange={(metadata) =>
                            setAssetDraft({
                              ...assetDraft,
                              metadata,
                            })
                          }
                        />
                      </div>
                    </section>

                    <label className="brand-resource-favorite">
                      <input
                        type="checkbox"
                        checked={assetDraft.is_favorite}
                        onChange={(event) =>
                          setAssetDraft({
                            ...assetDraft,
                            is_favorite: event.target.checked,
                          })
                        }
                      />

                      <span aria-hidden="true">★</span>

                      <div>
                        <strong>Marcar como favorito</strong>
                        <small>
                          Prioriza este recurso dentro de la biblioteca.
                        </small>
                      </div>
                    </label>

                    <footer className="brand-resource-upload__actions">
                      <div>
                        <span>Estado</span>
                        <strong>
                          {assetFile
                            ? "Archivo listo para subir"
                            : "Selecciona un archivo"}
                        </strong>
                      </div>

                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={busy}
                      >
                        {busy ? "Subiendo…" : "Añadir recurso"}
                      </button>
                    </footer>
                  </form>

                  <aside className="brand-resources-editor__library">
                    <header>
                      <div>
                        <span>Biblioteca actual</span>
                        <h3>Recursos disponibles</h3>
                      </div>

                      <strong>{assets.length}</strong>
                    </header>

                    {assets.length ? (
                      <div className="brand-resource-editor-list">
                        {assets.map((asset) => (
                          <article key={asset.id}>
                            <div className="brand-resource-editor-list__media">
                              <BrandAssetMedia asset={asset} />

                              {asset.is_favorite && (
                                <span title="Favorito">★</span>
                              )}
                            </div>

                            <div className="brand-resource-editor-list__copy">
                              <span>
                                {asset.category?.replaceAll("_", " ") ||
                                  "Sin categoría"}
                              </span>

                              <strong>
                                {asset.name || "Recurso sin nombre"}
                              </strong>

                              <small>
                                {asset.width && asset.height
                                  ? `${asset.width} × ${asset.height} px`
                                  : asset.mime_type || "Archivo"}
                              </small>

                              {asset.metadata?.tags?.length > 0 && (
                                <div>
                                  {asset.metadata.tags
                                    .slice(0, 3)
                                    .map((tag) => (
                                      <i key={tag}>{tag}</i>
                                    ))}
                                </div>
                              )}
                            </div>

                            <button
                              type="button"
                              className="brand-resource-editor-list__delete"
                              onClick={() => removeAsset(asset)}
                              aria-label={`Eliminar ${asset.name}`}
                              title="Eliminar recurso"
                            >
                              ×
                            </button>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <div className="brand-resources-editor__empty">
                        <span>＋</span>
                        <strong>Biblioteca vacía</strong>
                        <small>
                          Los recursos añadidos aparecerán en este espacio.
                        </small>
                      </div>
                    )}
                  </aside>
                </div>
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
