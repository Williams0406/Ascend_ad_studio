"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Nav from "@/components/Nav";
import PageTitle from "@/components/PageTitle";
import { api, ensureWorkspace } from "@/lib/api";
import { useCatalogController } from "@/hooks/useCatalogController";
import { ObjectList, TagsInput } from "@/components/StructuredFields";
import {
  CatalogSearch,
  CatalogToolbar,
  CatalogViewToggle,
  FilterSelect,
  SortSelector,
  CatalogSectionTabs,
} from "@/components/catalog/CatalogPrimitives";
import {
  CatalogGrid,
  CatalogPreview,
  CatalogResultsHeader,
  CatalogWorkspace,
  PreviewMedia,
} from "@/components/catalog/CatalogLayout";
import {
  EyeIcon,
  PencilIcon,
  SearchIcon,
  SparkIcon,
  TrashIcon,
} from "@/components/catalog/CatalogIcons";

const angleTypes = [
  ["problem_solution", "Problema y solución"],
  ["benefit", "Beneficio"],
  ["offer", "Oferta"],
  ["urgency", "Urgencia"],
  ["scarcity", "Escasez"],
  ["comparison", "Comparación"],
  ["testimonial", "Testimonio"],
  ["features", "Características"],
  ["lifestyle", "Estilo de vida"],
  ["premium", "Premium"],
  ["minimalist", "Minimalista"],
  ["educational", "Educativo"],
  ["emotional", "Emocional"],
];
const contentTypes = [
  ["image", "Imagen"],
  ["video", "Video"],
  ["carousel", "Carrusel"],
];
const formats = [
  ["square", "Cuadrado"],
  ["portrait", "Vertical"],
  ["landscape", "Horizontal"],
  ["widescreen", "Panorámico"],
  ["vertical_fullscreen", "Vertical pantalla completa"],
  ["instagram_post_square", "Instagram · Post cuadrado"],
  ["instagram_post_portrait", "Instagram · Post vertical"],
  ["instagram_post_landscape", "Instagram · Post horizontal"],
  ["instagram_story", "Instagram · Story"],
  ["instagram_reel", "Instagram · Reel"],
  ["instagram_carousel_square", "Instagram · Carrusel cuadrado"],
  ["instagram_carousel_portrait", "Instagram · Carrusel vertical"],
  ["facebook_post_square", "Facebook · Post cuadrado"],
  ["facebook_post_landscape", "Facebook · Post horizontal"],
  ["facebook_story", "Facebook · Story"],
  ["facebook_cover", "Facebook · Portada"],
  ["facebook_event_cover", "Facebook · Portada de evento"],
  ["facebook_ad_square", "Facebook Ads · Cuadrado"],
  ["facebook_ad_portrait", "Facebook Ads · Vertical"],
  ["facebook_ad_landscape", "Facebook Ads · Horizontal"],
  ["linkedin_post_square", "LinkedIn · Post cuadrado"],
  ["linkedin_post_portrait", "LinkedIn · Post vertical"],
  ["linkedin_post_landscape", "LinkedIn · Post horizontal"],
  ["linkedin_link_preview", "LinkedIn · Vista previa de enlace"],
  ["linkedin_profile_cover", "LinkedIn · Portada de perfil"],
  ["linkedin_company_cover", "LinkedIn · Portada de empresa"],
  ["linkedin_article_cover", "LinkedIn · Portada de artículo"],
  ["tiktok_video", "TikTok · Video vertical"],
  ["tiktok_image_post", "TikTok · Publicación de imagen"],
  ["tiktok_ad_vertical", "TikTok Ads · Vertical"],
  ["tiktok_ad_square", "TikTok Ads · Cuadrado"],
  ["tiktok_ad_landscape", "TikTok Ads · Horizontal"],
  ["youtube_thumbnail", "YouTube · Miniatura"],
  ["youtube_video", "YouTube · Video horizontal"],
  ["youtube_short", "YouTube · Short"],
  ["youtube_channel_banner", "YouTube · Banner de canal"],
  ["youtube_podcast_cover", "YouTube · Portada de pódcast"],
  ["x_post_square", "X · Post cuadrado"],
  ["x_post_landscape", "X · Post horizontal"],
  ["x_header", "X · Portada de perfil"],
  ["pinterest_pin", "Pinterest · Pin estándar"],
  ["pinterest_square", "Pinterest · Pin cuadrado"],
  ["pinterest_long_pin", "Pinterest · Pin largo"],
  ["display_banner_300x250", "Display · Rectángulo mediano"],
  ["display_banner_336x280", "Display · Rectángulo grande"],
  ["display_banner_728x90", "Display · Leaderboard"],
  ["display_banner_970x250", "Display · Billboard"],
  ["display_banner_160x600", "Display · Skyscraper"],
  ["display_banner_300x600", "Display · Media página"],
  ["display_banner_320x50", "Display · Banner móvil"],
  ["display_banner_320x100", "Display · Banner móvil grande"],
  ["flyer_a4_portrait", "Flyer A4 · Vertical"],
  ["flyer_a4_landscape", "Flyer A4 · Horizontal"],
  ["presentation_16_9", "Presentación · 16:9"],
  ["presentation_4_3", "Presentación · 4:3"],
  ["email_header", "Email · Cabecera"],
  ["website_hero", "Sitio web · Hero"],
];
const emptyAngle = {
  code: "benefit",
  name: "",
  description: "",
  example_headline: "",
  is_active: true,
};
const emptyRecipe = {
  name: "",
  description: "",
  content_type: "image",
  creative_angle: "",
  copy_rules: {
    tone: "professional",
    language: "es",
    headline: { max_words: 7, style: "direct", capitalize: false },
    body: { enabled: true, max_words: 25 },
    cta: { enabled: true, style: "direct", preferred_text: "" },
    pricing: {
      show_price: false,
      show_original_price: false,
      show_discount: false,
    },
    emoji_usage: "none",
    forbidden_terms: [],
  },
  visual_rules: {
    style: "editorial",
    mood: "premium",
    lighting: "soft",
    background: { type: "minimal", complexity: "low" },
    color_strategy: "brand_colors",
    product: {
      scale: "large",
      position_preference: "center",
      preserve_original_shape: true,
    },
    text_density: "low",
    people: { allowed: false, style: "none" },
    effects: { shadows: "soft", reflections: false, glow: false },
  },
  prompt_template: "",
  is_active: true,
};
const formatSpecs = {
  square: { width: 1080, height: 1080, aspect_ratio: "1:1" },
  portrait: { width: 1080, height: 1350, aspect_ratio: "4:5" },
  landscape: { width: 1200, height: 628, aspect_ratio: "1.91:1" },
  widescreen: { width: 1920, height: 1080, aspect_ratio: "16:9" },
  vertical_fullscreen: { width: 1080, height: 1920, aspect_ratio: "9:16" },
  instagram_post_square: { width: 1080, height: 1080, aspect_ratio: "1:1" },
  instagram_post_portrait: { width: 1080, height: 1350, aspect_ratio: "4:5" },
  instagram_post_landscape: {
    width: 1080,
    height: 566,
    aspect_ratio: "1.91:1",
  },
  instagram_story: { width: 1080, height: 1920, aspect_ratio: "9:16" },
  instagram_reel: { width: 1080, height: 1920, aspect_ratio: "9:16" },
  instagram_carousel_square: { width: 1080, height: 1080, aspect_ratio: "1:1" },
  instagram_carousel_portrait: {
    width: 1080,
    height: 1350,
    aspect_ratio: "4:5",
  },
  facebook_post_square: { width: 1080, height: 1080, aspect_ratio: "1:1" },
  facebook_post_landscape: { width: 1200, height: 630, aspect_ratio: "1.91:1" },
  facebook_story: { width: 1080, height: 1920, aspect_ratio: "9:16" },
  facebook_cover: { width: 1640, height: 624, aspect_ratio: "2.63:1" },
  facebook_event_cover: { width: 1920, height: 1005, aspect_ratio: "1.91:1" },
  facebook_ad_square: { width: 1080, height: 1080, aspect_ratio: "1:1" },
  facebook_ad_portrait: { width: 1080, height: 1350, aspect_ratio: "4:5" },
  facebook_ad_landscape: { width: 1200, height: 628, aspect_ratio: "1.91:1" },
  linkedin_post_square: { width: 1080, height: 1080, aspect_ratio: "1:1" },
  linkedin_post_portrait: { width: 1080, height: 1350, aspect_ratio: "4:5" },
  linkedin_post_landscape: { width: 1200, height: 627, aspect_ratio: "1.91:1" },
  linkedin_link_preview: { width: 1200, height: 627, aspect_ratio: "1.91:1" },
  linkedin_profile_cover: { width: 1584, height: 396, aspect_ratio: "4:1" },
  linkedin_company_cover: { width: 4200, height: 700, aspect_ratio: "6:1" },
  linkedin_article_cover: { width: 2000, height: 600, aspect_ratio: "10:3" },
  tiktok_video: { width: 1080, height: 1920, aspect_ratio: "9:16" },
  tiktok_image_post: { width: 1080, height: 1920, aspect_ratio: "9:16" },
  tiktok_ad_vertical: { width: 1080, height: 1920, aspect_ratio: "9:16" },
  tiktok_ad_square: { width: 1080, height: 1080, aspect_ratio: "1:1" },
  tiktok_ad_landscape: { width: 1920, height: 1080, aspect_ratio: "16:9" },
  youtube_thumbnail: { width: 3840, height: 2160, aspect_ratio: "16:9" },
  youtube_video: { width: 1920, height: 1080, aspect_ratio: "16:9" },
  youtube_short: { width: 1080, height: 1920, aspect_ratio: "9:16" },
  youtube_channel_banner: { width: 2560, height: 1440, aspect_ratio: "16:9" },
  youtube_podcast_cover: { width: 1400, height: 1400, aspect_ratio: "1:1" },
  x_post_square: { width: 1080, height: 1080, aspect_ratio: "1:1" },
  x_post_landscape: { width: 1600, height: 900, aspect_ratio: "16:9" },
  x_header: { width: 1500, height: 500, aspect_ratio: "3:1" },
  pinterest_pin: { width: 1000, height: 1500, aspect_ratio: "2:3" },
  pinterest_square: { width: 1000, height: 1000, aspect_ratio: "1:1" },
  pinterest_long_pin: { width: 1000, height: 2100, aspect_ratio: "10:21" },
  display_banner_300x250: { width: 300, height: 250, aspect_ratio: "6:5" },
  display_banner_336x280: { width: 336, height: 280, aspect_ratio: "6:5" },
  display_banner_728x90: { width: 728, height: 90, aspect_ratio: "364:45" },
  display_banner_970x250: { width: 970, height: 250, aspect_ratio: "97:25" },
  display_banner_160x600: { width: 160, height: 600, aspect_ratio: "4:15" },
  display_banner_300x600: { width: 300, height: 600, aspect_ratio: "1:2" },
  display_banner_320x50: { width: 320, height: 50, aspect_ratio: "32:5" },
  display_banner_320x100: { width: 320, height: 100, aspect_ratio: "16:5" },
  flyer_a4_portrait: { width: 2480, height: 3508, aspect_ratio: "1:1.414" },
  flyer_a4_landscape: { width: 3508, height: 2480, aspect_ratio: "1.414:1" },
  presentation_16_9: { width: 1920, height: 1080, aspect_ratio: "16:9" },
  presentation_4_3: { width: 1600, height: 1200, aspect_ratio: "4:3" },
  email_header: { width: 1200, height: 400, aspect_ratio: "3:1" },
  website_hero: { width: 1920, height: 800, aspect_ratio: "12:5" },
};
const emptyTemplate = {
  name: "",
  source_asset: "",
  creative_reference: "",
  source_mode: "source_asset",
  description: "",
  format: "portrait",
  layout_schema: {
    schema_version: 1,
    canvas: {
      width: 1080,
      height: 1350,
      aspect_ratio: "4:5",
      background_color: "#FFFFFF",
    },
    elements: [],
  },
  is_favorite: false,
  is_active: true,
};

function Field({ label, hint, required, children }) {
  return (
    <label className="field recipe-editor-field">
      <span>
        {label}
        {required && <b> *</b>}
      </span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

function Toggle({ label, hint, checked, onChange }) {
  return (
    <label className="creative-toggle recipe-editor-toggle">
      <span>
        <b>{label}</b>
        <small>{hint}</small>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <i />
    </label>
  );
}

const toneChoices = [
  ["elegant", "Elegante"],
  ["friendly", "Cercano"],
  ["professional", "Profesional"],
  ["direct", "Directo"],
  ["emotional", "Emocional"],
];
const scalarChoice = (value, fallback) =>
  Array.isArray(value)
    ? value[0] || fallback
    : typeof value === "string"
      ? value
      : fallback;
const choiceList = (value) =>
  Array.isArray(value) ? value : value ? [value] : [];

function RecipeRules({ form, update }) {
  const copy = form.copy_rules || emptyRecipe.copy_rules,
    visual = form.visual_rules || emptyRecipe.visual_rules;
  const copySet = (key, value) =>
    update("copy_rules", { ...copy, [key]: value });
  const visualSet = (key, value) =>
    update("visual_rules", { ...visual, [key]: value });
  const tones = choiceList(copy.tone);
  const toggleTone = (value) =>
    copySet(
      "tone",
      tones.includes(value)
        ? tones.filter((item) => item !== value)
        : [...tones, value],
    );
  return (
    <div className="rule-configurator recipe-rules-workspace">
      <div className="rule-config-block recipe-rule-card recipe-rule-card--copy">
        <div className="structured-heading">
          <div>
            <span>Reglas de copy</span>
            <p>Cómo debe escribir la IA.</p>
          </div>
        </div>
        <Field label="Tonos de comunicación">
          <div className="recipe-choice-chips">
            {toneChoices.map(([value, label]) => (
              <button
                type="button"
                key={value}
                className={tones.includes(value) ? "active" : ""}
                onClick={() => toggleTone(value)}
                aria-pressed={tones.includes(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </Field>
        <div className="editor-fields-two">
          <Field label="Idioma">
            <select
              className="input"
              value={scalarChoice(copy.language, "es")}
              onChange={(e) => copySet("language", e.target.value)}
            >
              <option value="es">Español</option>
              <option value="en">Inglés</option>
              <option value="pt">Portugués</option>
            </select>
          </Field>
          <Field label="Máximo de palabras del título">
            <input
              className="input"
              type="number"
              min="1"
              max="30"
              value={copy.headline?.max_words || 7}
              onChange={(e) =>
                copySet("headline", {
                  ...copy.headline,
                  max_words: Number(e.target.value),
                })
              }
            />
          </Field>
          <Field label="Estilo del título">
            <select
              className="input"
              value={scalarChoice(copy.headline?.style, "direct")}
              onChange={(e) =>
                copySet("headline", { ...copy.headline, style: e.target.value })
              }
            >
              <option value="direct">Directo</option>
              <option value="emotional">Emocional</option>
              <option value="informative">Informativo</option>
              <option value="question">Pregunta</option>
            </select>
          </Field>
          <Field label="Uso de emojis">
            <select
              className="input"
              value={scalarChoice(copy.emoji_usage, "none")}
              onChange={(e) => copySet("emoji_usage", e.target.value)}
            >
              <option value="none">No utilizar</option>
              <option value="minimal">Mínimo</option>
              <option value="moderate">Moderado</option>
            </select>
          </Field>
        </div>
        <div className="structured-toggle-row">
          {[
            ["body", "Incluir texto secundario"],
            ["cta", "Incluir CTA"],
          ].map(([key, label]) => (
            <label key={key}>
              <input
                type="checkbox"
                checked={copy[key]?.enabled ?? true}
                onChange={(e) =>
                  copySet(key, { ...copy[key], enabled: e.target.checked })
                }
              />
              {label}
            </label>
          ))}
          {[
            ["show_price", "Mostrar precio"],
            ["show_original_price", "Precio original"],
            ["show_discount", "Mostrar descuento"],
          ].map(([key, label]) => (
            <label key={key}>
              <input
                type="checkbox"
                checked={Boolean(copy.pricing?.[key])}
                onChange={(e) =>
                  copySet("pricing", {
                    ...copy.pricing,
                    [key]: e.target.checked,
                  })
                }
              />
              {label}
            </label>
          ))}
        </div>
        <Field label="Términos que no debe usar">
          <TagsInput
            value={
              Array.isArray(copy.forbidden_terms) ? copy.forbidden_terms : []
            }
            onChange={(value) => copySet("forbidden_terms", value)}
            placeholder="Ej. barato"
          />
        </Field>
      </div>
      <div className="rule-config-block recipe-rule-card recipe-rule-card--visual">
        <div className="structured-heading">
          <div>
            <span>Reglas visuales</span>
            <p>La apariencia general de la pieza.</p>
          </div>
        </div>
        <div className="editor-fields-two">
          {[
            [
              "style",
              "Estilo",
              [
                ["editorial", "Editorial"],
                ["minimalist", "Minimalista"],
                ["dynamic", "Dinámico"],
                ["photographic", "Fotográfico"],
              ],
            ],
            [
              "mood",
              "Sensación",
              [
                ["premium", "Premium"],
                ["friendly", "Cercana"],
                ["energetic", "Energética"],
                ["calm", "Serena"],
              ],
            ],
            [
              "lighting",
              "Iluminación",
              [
                ["soft", "Suave"],
                ["dramatic", "Dramática"],
                ["natural", "Natural"],
                ["studio", "Estudio"],
              ],
            ],
            [
              "text_density",
              "Densidad de texto",
              [
                ["low", "Baja"],
                ["medium", "Media"],
                ["high", "Alta"],
              ],
            ],
          ].map(([key, label, options]) => (
            <Field label={label} key={key}>
              <select
                className="input"
                value={scalarChoice(visual[key], options[0][0])}
                onChange={(e) => visualSet(key, e.target.value)}
              >
                {options.map(([v, l]) => (
                  <option value={v} key={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
          ))}
        </div>
        <div className="structured-toggle-row">
          <label>
            <input
              type="checkbox"
              checked={Boolean(visual.people?.allowed)}
              onChange={(e) =>
                visualSet("people", {
                  ...visual.people,
                  allowed: e.target.checked,
                })
              }
            />
            Incluir personas
          </label>
          <label>
            <input
              type="checkbox"
              checked={visual.product?.preserve_original_shape ?? true}
              onChange={(e) =>
                visualSet("product", {
                  ...visual.product,
                  preserve_original_shape: e.target.checked,
                })
              }
            />
            Mantener forma del producto
          </label>
          <label>
            <input
              type="checkbox"
              checked={Boolean(visual.effects?.reflections)}
              onChange={(e) =>
                visualSet("effects", {
                  ...visual.effects,
                  reflections: e.target.checked,
                })
              }
            />
            Reflejos
          </label>
          <label>
            <input
              type="checkbox"
              checked={Boolean(visual.effects?.glow)}
              onChange={(e) =>
                visualSet("effects", {
                  ...visual.effects,
                  glow: e.target.checked,
                })
              }
            />
            Resplandor
          </label>
        </div>
      </div>
    </div>
  );
}
function LayoutBuilder({ value, onChange, format }) {
  const spec = formatSpecs[format] || formatSpecs.portrait;
  const schema = value || emptyTemplate.layout_schema;
  const canvas = {
    ...schema.canvas,
    width: spec.width,
    height: spec.height,
    aspect_ratio: spec.aspect_ratio,
  };
  const elements = schema.elements || [];
  const updateElements = (next) =>
    onChange({ ...schema, canvas, elements: next });
  const names = [
    "Logo",
    "Título",
    "Producto",
    "CTA",
    "Forma",
    "Precio",
    "Texto",
  ];
  const addRect = () =>
    updateElements([
      ...elements,
      {
        id: `rect_${elements.length + 1}`,
        name: names[elements.length % names.length],
        role: "shape",
        type: "shape",
        x: 0.1,
        y: 0.1,
        width: 0.32,
        height: 0.18,
        z_index: elements.length + 1,
        editable: true,
        required: false,
        locked: false,
        properties: {},
      },
    ]);
  const setElement = (id, patch) =>
    updateElements(
      elements.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  const drag = (event, element) => {
    const rect = event.currentTarget.parentElement.getBoundingClientRect();
    const move = (moveEvent) => {
      const x = Math.max(
        0,
        Math.min(0.95, (moveEvent.clientX - rect.left) / rect.width),
      );
      const y = Math.max(
        0,
        Math.min(0.95, (moveEvent.clientY - rect.top) / rect.height),
      );
      setElement(element.id, { x, y });
    };
    const stop = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", stop);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", stop);
  };
  return (
    <div className="layout-builder recipe-layout-builder">
      <div className="layout-canvas-settings recipe-layout-canvas-settings">
        <div className="structured-heading">
          <div>
            <span>
              Lienzo {canvas.width} × {canvas.height}
            </span>
            <p>Arrastra rectángulos y edita su nombre dentro del lienzo.</p>
          </div>
          <button type="button" className="btn btn-secondary" onClick={addRect}>
            + Agregar rectángulo
          </button>
        </div>
      </div>
      <div
        className="layout-canvas draggable recipe-layout-canvas"
        style={{
          aspectRatio: `${canvas.width}/${canvas.height}`,
          background: canvas.background_color,
        }}
      >
        {elements.map((element) => (
          <div
            className="layout-region"
            key={element.id}
            onMouseDown={(event) => drag(event, element)}
            style={{
              left: `${element.x * 100}%`,
              top: `${element.y * 100}%`,
              width: `${element.width * 100}%`,
              height: `${element.height * 100}%`,
              zIndex: element.z_index,
            }}
          >
            <select
              value={element.name || "Forma"}
              onMouseDown={(event) => event.stopPropagation()}
              onChange={(e) =>
                setElement(element.id, {
                  name: e.target.value,
                  role: e.target.value
                    .toLowerCase()
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, ""),
                })
              }
            >
              {names.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-secondary btn-icon"
              onMouseDown={(event) => event.stopPropagation()}
              onClick={() =>
                updateElements(
                  elements.filter((item) => item.id !== element.id),
                )
              }
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function titleCase(value) {
  return String(value || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("es-PE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return String(value);
  }
}

function recipeTone(recipe) {
  const tone = recipe.copy_rules?.tone;
  const values = Array.isArray(tone) ? tone : tone ? [tone] : [];
  return values.map(titleCase).join(", ") || "Profesional";
}

function recipeStyle(recipe) {
  return titleCase(recipe.visual_rules?.style || "editorial");
}

function recipeAspect(recipe) {
  return recipe.target_format || recipe.aspect_ratio || "4:5";
}

function recipeImage(recipe, templates, assets) {
  if (recipe.preview_url) return recipe.preview_url;
  if (recipe.cover_url) return recipe.cover_url;

  const matchingTemplate = templates.find(
    (template) =>
      template.content_type === recipe.content_type &&
      template.source_asset_url,
  );

  if (matchingTemplate?.source_asset_url)
    return matchingTemplate.source_asset_url;

  return assets.find((asset) => asset.file_url)?.file_url || "";
}

function StatusBadge({ active }) {
  return (
    <span className={`badge ${active ? "active" : "inactive"}`}>
      {active ? "Activa" : "Inactiva"}
    </span>
  );
}

function RecipePreview({ form, angles, templates, assets }) {
  const image = recipeImage(form, templates, assets);
  const angle = angles.find(
    (item) => String(item.id) === String(form.creative_angle),
  );

  return (
    <aside className="inspector recipe-editor-preview">
      <header className="recipe-editor-preview__header">
        <div>
          <span>Vista creativa</span>
          <h2>Vista previa de la receta</h2>
          <p>Así se presentará y aplicará esta dirección creativa.</p>
        </div>
        <i />
      </header>

      <div className="inspector-media recipe-editor-preview__media">
        {image ? (
          <img
            src={image}
            alt="Vista previa de la receta"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div>
            <span>✦</span>
            <strong>Dirección creativa</strong>
            <small>La vista usará un activo compatible de tu Brand Kit.</small>
          </div>
        )}
        <b>{recipeAspect(form)}</b>
      </div>

      <dl className="recipe-editor-preview__summary">
        <div>
          <dt>Nombre</dt>
          <dd>{form.name || "—"}</dd>
        </div>
        <div>
          <dt>Ángulo</dt>
          <dd>{angle?.name || "Sin ángulo"}</dd>
        </div>
        <div>
          <dt>Tipo</dt>
          <dd>
            {contentTypes.find((item) => item[0] === form.content_type)?.[1] ||
              "—"}
          </dd>
        </div>
        <div>
          <dt>Estilo</dt>
          <dd>{recipeStyle(form)}</dd>
        </div>
        <div>
          <dt>Tonos</dt>
          <dd>{recipeTone(form)}</dd>
        </div>
        <div>
          <dt>Idioma</dt>
          <dd>
            {form.copy_rules?.language === "en"
              ? "Inglés"
              : form.copy_rules?.language === "pt"
                ? "Portugués"
                : "Español"}
          </dd>
        </div>
        <div>
          <dt>Estado</dt>
          <dd>
            <StatusBadge active={form.is_active} />
          </dd>
        </div>
      </dl>

      <section className="recipe-editor-preview__checklist">
        <span>Checklist de configuración</span>
        {[
          ["Información básica", Boolean(form.name && form.content_type)],
          ["Reglas de copy", Boolean(form.copy_rules)],
          ["Reglas visuales", Boolean(form.visual_rules)],
          ["Plantilla de prompt", Boolean(form.prompt_template)],
          ["Revisión", Boolean(form.name && form.prompt_template)],
        ].map(([label, complete]) => (
          <div key={label} className={complete ? "complete" : ""}>
            <i>{complete ? "✓" : ""}</i>
            <p>{label}</p>
          </div>
        ))}
      </section>
    </aside>
  );
}

export default function CreativeLibrary() {
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
  const [angles, setAngles] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [assets, setAssets] = useState([]);
  const [references, setReferences] = useState([]);
  const [tab, setTab] = useState("recipes");
  const [angleFilter, setAngleFilter] = useState("all");
  const [contentFilter, setContentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [styleFilter, setStyleFilter] = useState("all");

  const [angleTypeFilter, setAngleTypeFilter] = useState("all");
  const [formatFilter, setFormatFilter] = useState("all");
  const [editor, setEditor] = useState(null);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  async function load() {
    await ensureWorkspace();
    const [angleData, recipeData, templateData, assetData, referenceData] =
      await Promise.all([
        api("/studio/creative-angles/"),
        api("/studio/recipes/"),
        api("/studio/ad-templates/"),
        api("/studio/brand-assets/"),
        api("/studio/creative-references/"),
      ]);
    setAngles(angleData.results || angleData);
    setRecipes(recipeData.results || recipeData);
    setTemplates(templateData.results || templateData);
    setAssets(assetData.results || assetData);
    setReferences(referenceData.results || referenceData);
  }

  useEffect(() => {
    load().catch((error) => setMessage({ type: "error", text: error.message }));
  }, []);

  const config = {
    angles: {
      label: "Ángulo",
      plural: "Ángulos",
      path: "creative-angles",
      blank: emptyAngle,
      items: angles,
      setItems: setAngles,
    },
    recipes: {
      label: "Receta",
      plural: "Recetas",
      path: "recipes",
      blank: emptyRecipe,
      items: recipes,
      setItems: setRecipes,
    },
    templates: {
      label: "Plantilla",
      plural: "Plantillas",
      path: "ad-templates",
      blank: emptyTemplate,
      items: templates,
      setItems: setTemplates,
    },
  };

  const current = config[tab];

  const styles = useMemo(
    () => [
      ...new Set(
        recipes.map((item) => item.visual_rules?.style).filter(Boolean),
      ),
    ],
    [recipes],
  );

  const filteredRecipes = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    const result = recipes.filter((item) => {
      const matchesQuery =
        !normalized ||
        [
          item.name,
          item.description,
          item.prompt_template,
          item.creative_angle_name,
          item.content_type,
          item.visual_rules?.style,
          item.visual_rules?.mood,
          ...(Array.isArray(item.copy_rules?.tone)
            ? item.copy_rules.tone
            : [item.copy_rules?.tone]),
        ].some((value) => value?.toString().toLowerCase().includes(normalized));

      const matchesAngle =
        angleFilter === "all" || String(item.creative_angle) === angleFilter;
      const matchesContent =
        contentFilter === "all" || item.content_type === contentFilter;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" ? item.is_active : !item.is_active);
      const matchesStyle =
        styleFilter === "all" || item.visual_rules?.style === styleFilter;

      return (
        matchesQuery &&
        matchesAngle &&
        matchesContent &&
        matchesStatus &&
        matchesStyle
      );
    });

    return [...result].sort((a, b) => {
      if (sort === "name")
        return (a.name || "").localeCompare(b.name || "", "es");
      if (sort === "oldest")
        return new Date(a.created_at || 0) - new Date(b.created_at || 0);
      if (sort === "active") return Number(b.is_active) - Number(a.is_active);
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });
  }, [
    recipes,
    query,
    angleFilter,
    contentFilter,
    statusFilter,
    styleFilter,
    sort,
  ]);

  const genericVisible = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    const result = current.items.filter((item) => {
      const matchesQuery =
        !normalized ||
        [
          item.name,
          item.code,
          item.description,
          item.content_type,
          item.format,
        ].some((value) =>
          String(value || "")
            .toLowerCase()
            .includes(normalized),
        );

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" ? item.is_active : !item.is_active);

      const matchesAngleType =
        tab !== "angles" ||
        angleTypeFilter === "all" ||
        item.code === angleTypeFilter;

      const matchesFormat =
        tab !== "templates" ||
        formatFilter === "all" ||
        item.format === formatFilter;

      return matchesQuery && matchesStatus && matchesAngleType && matchesFormat;
    });

    return [...result].sort((a, b) => {
      if (sort === "name") {
        return (a.name || "").localeCompare(b.name || "", "es");
      }

      if (sort === "oldest") {
        return new Date(a.created_at || 0) - new Date(b.created_at || 0);
      }

      if (sort === "active") {
        return Number(b.is_active) - Number(a.is_active);
      }

      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });
  }, [current, query, statusFilter, angleTypeFilter, formatFilter, tab, sort]);

  const visible = tab === "recipes" ? filteredRecipes : genericVisible;
  const activeCount = current.items.filter((item) => item.is_active).length;

  const metrics = useMemo(
    () => ({
      total: recipes.length,
      active: recipes.filter((item) => item.is_active).length,
      byAngle: new Set(
        recipes.map((item) => item.creative_angle).filter(Boolean),
      ).size,
      withPrompt: recipes.filter((item) => item.prompt_template).length,
      system: recipes.filter((item) => item.is_system_recipe).length,
    }),
    [recipes],
  );

  function flash(type, text) {
    setMessage({ type, text });
    window.setTimeout(() => setMessage({ type: "", text: "" }), 4500);
  }

  function openCreate() {
    setSelected(null);
    setEditor({ type: tab, item: null });
    setForm(structuredClone(current.blank));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openEdit(item) {
    if (tab === "recipes" && item.is_system_recipe) {
      flash("error", "Las recetas del sistema son de solo lectura.");
      return;
    }

    const normalized = { ...item };

    if (tab === "recipes") {
      normalized.copy_rules = {
        ...emptyRecipe.copy_rules,
        ...(item.copy_rules || {}),
      };
      normalized.visual_rules = {
        ...emptyRecipe.visual_rules,
        ...(item.visual_rules || {}),
      };
    }

    if (tab === "templates") {
      normalized.layout_schema = {
        ...emptyTemplate.layout_schema,
        ...(item.layout_schema || {}),
      };
      normalized.source_mode = item.source_asset
        ? "source_asset"
        : item.creative_reference
          ? "creative_reference"
          : "layout_schema";
    }

    setEditor({ type: tab, item });
    setForm(normalized);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeEditor() {
    setEditor(null);
    setForm(null);
  }

  function update(key, value) {
    setForm((currentForm) => ({ ...currentForm, [key]: value }));
  }

  async function save(event) {
    event.preventDefault();
    setBusy(true);

    try {
      const section = config[editor.type];
      const payload = { ...form };
      if (editor.type === "templates") {
        delete payload.source_mode;
        if (form.source_mode === "source_asset") {
          payload.creative_reference = null;
          payload.layout_schema = {};
        } else if (form.source_mode === "creative_reference") {
          payload.source_asset = null;
          payload.layout_schema = {};
        } else {
          payload.source_asset = null;
          payload.creative_reference = null;
        }
      }

      if (editor.type === "recipes")
        payload.creative_angle = payload.creative_angle || null;

      const path = editor.item
        ? `/studio/${section.path}/${editor.item.id}/`
        : `/studio/${section.path}/`;

      const saved = await api(path, {
        method: editor.item ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });

      section.setItems((items) =>
        editor.item
          ? items.map((item) => (item.id === saved.id ? saved : item))
          : [saved, ...items],
      );

      setSelected(saved);
      flash(
        "success",
        `${section.label} ${editor.item ? "actualizada" : "creada"} correctamente.`,
      );
      closeEditor();
    } catch (error) {
      flash("error", error.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(item) {
    if (tab === "recipes" && item.is_system_recipe) {
      flash("error", "Las recetas del sistema no se pueden eliminar.");
      return;
    }

    if (
      !window.confirm(
        `¿Eliminar “${item.name}”? Esta acción no se puede deshacer.`,
      )
    )
      return;

    try {
      await api(`/studio/${current.path}/${item.id}/`, { method: "DELETE" });
      current.setItems((items) =>
        items.filter((value) => value.id !== item.id),
      );
      if (selected?.id === item.id) setSelected(null);
      flash("success", `${current.label} eliminada.`);
    } catch (error) {
      flash("error", error.message);
    }
  }

  function clearFilters() {
    setQuery("");
    setAngleFilter("all");
    setContentFilter("all");
    setStatusFilter("all");
    setStyleFilter("all");
    setAngleTypeFilter("all");
    setFormatFilter("all");
  }

  if (editor && form) {
    return (
      <>
        <Nav privateNav />
        <main className="container ascend-view page page--catalog catalog-experience catalog-experience--recipes recipes-visual-theme">
          {message.text && (
            <div className={`notice ${message.type}`}>{message.text}</div>
          )}

          <section
            className={`editor recipe-editor-experience recipe-editor-experience--${editor.type}`}
          >
            <PageTitle
              variant="catalog"
              className={`page-header recipe-editor-header recipe-editor-header--${editor.type}`}
              eyebrow={
                editor.type === "recipes"
                  ? "Sistema creativo"
                  : editor.type === "angles"
                    ? "Dirección persuasiva"
                    : "Sistema de plantillas"
              }
              title={
                editor.item
                  ? `Editar ${config[editor.type].label.toLowerCase()}`
                  : `${editor.type === "angles" ? "Nuevo" : "Nueva"} ${config[
                      editor.type
                    ].label.toLowerCase()}`
              }
              description={
                editor.type === "recipes"
                  ? "Define una dirección creativa repetible mediante reglas de copy, criterios visuales y una plantilla de prompt."
                  : editor.type === "angles"
                    ? "Configura un enfoque persuasivo que pueda reutilizarse en recetas, campañas y mensajes."
                    : "Construye una estructura visual reutilizable para mantener consistencia entre formatos y generaciones."
              }
              meta={
                <button
                  type="button"
                  className="btn btn-secondary recipe-editor-header__back"
                  onClick={closeEditor}
                >
                  ← {config[editor.type].plural}
                </button>
              }
              actions={
                <div className="actions recipe-editor-header__actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={closeEditor}
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    form="recipe-editor-form"
                    className="btn btn-primary"
                    disabled={busy}
                  >
                    {busy
                      ? "Guardando…"
                      : editor.item
                        ? "Guardar cambios"
                        : editor.type === "recipes"
                          ? "Guardar receta"
                          : editor.type === "angles"
                            ? "Guardar ángulo"
                            : "Guardar plantilla"}
                  </button>
                </div>
              }
            />

            {editor.type === "recipes" && (
              <nav
                className="tabs recipe-editor-steps"
                aria-label="Pasos del editor"
              >
                {[
                  ["01", "Información básica"],
                  ["02", "Reglas de copy"],
                  ["03", "Reglas visuales"],
                  ["04", "Plantilla de prompt"],
                  ["05", "Revisión"],
                ].map(([number, label], index) => (
                  <div key={number} className={index === 0 ? "active" : ""}>
                    <span>{number}</span>
                    <strong>{label}</strong>
                  </div>
                ))}
              </nav>
            )}

            <div
              className={`split-layout recipe-editor-layout ${editor.type !== "recipes" ? "single" : ""}`}
            >
              <form
                id="recipe-editor-form"
                className="form recipe-editor-form"
                onSubmit={save}
              >
                {editor.type === "recipes" && (
                  <>
                    <section className="panel recipe-editor-section recipe-editor-section--basic">
                      <header className="recipe-editor-section__header">
                        <span>01</span>
                        <div>
                          <h2>Información básica</h2>
                          <p>
                            Define el propósito, formato y enfoque de esta
                            receta.
                          </p>
                        </div>
                      </header>
                      <div className="form-grid three">
                        <Field label="Nombre de la receta" required>
                          <input
                            className="input"
                            required
                            value={form.name}
                            onChange={(e) => update("name", e.target.value)}
                            placeholder="Ej. Ritual de lanzamiento editorial"
                          />
                        </Field>
                        <Field label="Ángulo creativo">
                          <select
                            className="input"
                            value={form.creative_angle || ""}
                            onChange={(e) =>
                              update("creative_angle", e.target.value)
                            }
                          >
                            <option value="">Sin ángulo</option>
                            {angles
                              .filter((angle) => angle.is_active)
                              .map((angle) => (
                                <option value={angle.id} key={angle.id}>
                                  {angle.name}
                                </option>
                              ))}
                          </select>
                        </Field>
                        <Field label="Tipo de contenido" required>
                          <select
                            className="input"
                            value={form.content_type}
                            onChange={(e) =>
                              update("content_type", e.target.value)
                            }
                          >
                            {contentTypes.map(([value, label]) => (
                              <option value={value} key={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </Field>
                      </div>
                      <Field label="Descripción">
                        <textarea
                          className="input textarea"
                          value={form.description}
                          onChange={(e) =>
                            update("description", e.target.value)
                          }
                          placeholder="Describe cuándo y cómo usar esta receta."
                        />
                      </Field>
                    </section>

                    <section className="panel recipe-editor-section recipe-editor-section--rules">
                      <header className="recipe-editor-section__header">
                        <span>02–03</span>
                        <div>
                          <h2>Reglas guiadas</h2>
                          <p>
                            Controla la voz, estructura y apariencia de cada
                            generación.
                          </p>
                        </div>
                      </header>
                      <RecipeRules form={form} update={update} />
                    </section>

                    <section className="panel recipe-editor-section recipe-editor-section--prompt">
                      <header className="recipe-editor-section__header">
                        <span>04</span>
                        <div>
                          <h2>Plantilla de prompt</h2>
                          <p>
                            Instrucción central que recibirá el modelo de IA.
                          </p>
                        </div>
                      </header>
                      <Field
                        label="Prompt base"
                        required
                        hint="Puedes incluir contexto de marca, producto, audiencia, objetivo y restricciones."
                      >
                        <textarea
                          className="input textarea tall"
                          required
                          value={form.prompt_template}
                          onChange={(e) =>
                            update("prompt_template", e.target.value)
                          }
                          placeholder="Crea una pieza publicitaria que…"
                        />
                      </Field>
                    </section>

                    <section className="panel panel-highlight">
                      <Toggle
                        label="Receta activa"
                        hint="Visible al crear nuevos proyectos"
                        checked={form.is_active}
                        onChange={(value) => update("is_active", value)}
                      />
                    </section>
                  </>
                )}

                {editor.type === "angles" && (
                  <section className="panel recipe-editor-section recipe-editor-section--angle">
                    <header className="recipe-editor-section__header">
                      <span>01</span>
                      <div>
                        <h2>Identidad del ángulo</h2>
                        <p>
                          Define el enfoque persuasivo que alimentará tus
                          recetas.
                        </p>
                      </div>
                    </header>
                    <div className="form-grid two">
                      <Field label="Tipo de ángulo" required>
                        <select
                          className="input"
                          value={form.code}
                          onChange={(e) => update("code", e.target.value)}
                        >
                          {angleTypes.map(([value, label]) => (
                            <option value={value} key={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Nombre" required>
                        <input
                          className="input"
                          required
                          value={form.name}
                          onChange={(e) => update("name", e.target.value)}
                        />
                      </Field>
                    </div>
                    <Field label="Descripción">
                      <textarea
                        className="input textarea"
                        value={form.description}
                        onChange={(e) => update("description", e.target.value)}
                      />
                    </Field>
                    <Field label="Titular de ejemplo">
                      <textarea
                        className="input"
                        value={form.example_headline}
                        onChange={(e) =>
                          update("example_headline", e.target.value)
                        }
                      />
                    </Field>
                    <Toggle
                      label="Ángulo activo"
                      hint="Disponible para nuevas recetas"
                      checked={form.is_active}
                      onChange={(value) => update("is_active", value)}
                    />
                  </section>
                )}

                {editor.type === "templates" && (
                  <section className="panel recipe-editor-section recipe-editor-section--template">
                    <header className="recipe-editor-section__header">
                      <span>01</span>
                      <div>
                        <h2>Configuración de plantilla</h2>
                        <p>
                          Define el lienzo, recurso fuente y elementos
                          editables.
                        </p>
                      </div>
                    </header>
                    <div className="form-grid three">
                      <Field label="Nombre" required>
                        <input
                          className="input"
                          required
                          value={form.name}
                          onChange={(e) => update("name", e.target.value)}
                        />
                      </Field>
                      <Field label="Formato">
                        <select
                          className="input"
                          value={form.format}
                          onChange={(e) => update("format", e.target.value)}
                        >
                          {formats.map(([value, label]) => (
                            <option value={value} key={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>
                    <Field label="Descripción">
                      <textarea
                        className="input"
                        value={form.description}
                        onChange={(e) => update("description", e.target.value)}
                      />
                    </Field>
                    <div className="recipe-choice-chips recipe-source-mode">
                      {[
                        ["source_asset", "BrandAsset"],
                        ["creative_reference", "CreativeReference"],
                        ["layout_schema", "Layout manual"],
                      ].map(([value, label]) => (
                        <button
                          type="button"
                          key={value}
                          className={form.source_mode === value ? "active" : ""}
                          onClick={() => update("source_mode", value)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    {form.source_mode === "source_asset" && (
                      <div className="template-asset-picker recipe-template-picker">
                        {assets
                          .filter((asset) => asset.category === "template")
                          .map((asset) => (
                            <button
                              type="button"
                              key={asset.id}
                              className={
                                String(form.source_asset) === String(asset.id)
                                  ? "selected"
                                  : ""
                              }
                              onClick={() => update("source_asset", asset.id)}
                            >
                              {asset.file_url ? (
                                <img
                                  src={asset.file_url}
                                  alt=""
                                  loading="lazy"
                                  decoding="async"
                                />
                              ) : (
                                <div>Archivo</div>
                              )}
                              <span>{asset.name}</span>
                            </button>
                          ))}
                      </div>
                    )}
                    {form.source_mode === "creative_reference" && (
                      <div className="template-asset-picker recipe-template-picker">
                        {references
                          .filter(
                            (reference) => reference.category === "template",
                          )
                          .map((reference) => (
                            <button
                              type="button"
                              key={reference.id}
                              className={
                                String(form.creative_reference) ===
                                String(reference.id)
                                  ? "selected"
                                  : ""
                              }
                              onClick={() =>
                                update("creative_reference", reference.id)
                              }
                            >
                              {reference.image_url ? (
                                <img
                                  src={reference.image_url}
                                  alt=""
                                  loading="lazy"
                                  decoding="async"
                                />
                              ) : (
                                <div>Referencia</div>
                              )}
                              <span>{reference.title}</span>
                            </button>
                          ))}
                      </div>
                    )}
                    {form.source_mode === "layout_schema" && (
                      <LayoutBuilder
                        value={form.layout_schema}
                        format={form.format}
                        onChange={(value) => update("layout_schema", value)}
                      />
                    )}
                    <div className="form-grid two">
                      <Toggle
                        label="Plantilla activa"
                        hint="Disponible para proyectos"
                        checked={form.is_active}
                        onChange={(value) => update("is_active", value)}
                      />
                      <Toggle
                        label="Favorita"
                        hint="Destacar en la biblioteca"
                        checked={form.is_favorite}
                        onChange={(value) => update("is_favorite", value)}
                      />
                    </div>
                  </section>
                )}
                <footer className="recipe-editor-footer">
                  <div>
                    <span>Estado del formulario</span>
                    <strong>
                      {form?.name?.trim()
                        ? "Listo para guardar"
                        : "Completa el nombre para continuar"}
                    </strong>
                  </div>
                  <div className="actions">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={closeEditor}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={busy}
                    >
                      {busy
                        ? "Guardando…"
                        : editor.item
                          ? "Guardar cambios"
                          : "Guardar"}
                    </button>
                  </div>
                </footer>
              </form>

              {editor.type === "recipes" && (
                <RecipePreview
                  form={form}
                  angles={angles}
                  templates={templates}
                  assets={assets}
                />
              )}
            </div>

            <aside className="notice info recipe-editor-help">
              <div>
                <span>▣</span>
                <p>
                  <strong>¿Necesitas inspiración?</strong> Explora ángulos
                  creativos y recetas existentes para acelerar tu próxima
                  campaña.
                </p>
              </div>
              <button type="button" onClick={closeEditor}>
                Explorar recetas ↗
              </button>
            </aside>
          </section>
        </main>
      </>
    );
  }

  return (
    <>
      <Nav privateNav />
      <main className="container ascend-view page page--catalog catalog-unified-page catalog-unified-page--recipes recipes-visual-theme">
        {message.text && (
          <div className={`notice ${message.type}`}>{message.text}</div>
        )}

        <PageTitle
          variant="catalog"
          className="page-header recipes-page-header"
          eyebrow="Sistema creativo"
          title={current.plural}
          description={
            tab === "recipes"
              ? "Define direcciones creativas repetibles combinando ángulos, reglas de copy, reglas visuales y prompts."
              : tab === "angles"
                ? "Organiza los enfoques persuasivos que alimentan tus recetas."
                : "Administra estructuras visuales reutilizables para tus proyectos."
          }
          actions={
            <div className="actions">
              <button
                type="button"
                className="btn btn-primary recipes-page-header__cta"
                onClick={openCreate}
              >
                <span>＋</span>
                Nueva {current.label.toLowerCase()}
              </button>
            </div>
          }
        />

        <CatalogSectionTabs
          value={tab}
          ariaLabel="Secciones de dirección creativa"
          onChange={(nextTab) => {
            setTab(nextTab);
            setQuery("");
            setSelected(null);
          }}
          items={[
            {
              value: "recipes",
              label: "Recetas",
              description: "Instrucciones para IA",
              count: recipes.length,
            },
            {
              value: "angles",
              label: "Ángulos",
              description: "Enfoques persuasivos",
              count: angles.length,
            },
            {
              value: "templates",
              label: "Plantillas",
              description: "Estructuras visuales",
              count: templates.length,
            },
          ]}
        />

        <CatalogToolbar
          className="recipes-catalog-filters"
          onClear={clearFilters}
          clearLabel="Limpiar filtros"
        >
          <CatalogSearch
            value={query}
            onChange={setQuery}
            placeholder={`Buscar ${current.label.toLowerCase()}, ángulo o estilo…`}
            className="catalog-toolbar__search"
          />

          {tab === "recipes" && (
            <>
              <FilterSelect
                label="Ángulo"
                value={angleFilter}
                onChange={setAngleFilter}
                options={[
                  ["all", "Todos"],
                  ...angles.map((angle) => [String(angle.id), angle.name]),
                ]}
              />

              <FilterSelect
                label="Contenido"
                value={contentFilter}
                onChange={setContentFilter}
                options={[["all", "Todos"], ...contentTypes]}
              />

              <FilterSelect
                label="Estado"
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  ["all", "Todos"],
                  ["active", "Activas"],
                  ["inactive", "Inactivas"],
                ]}
              />
            </>
          )}

          {tab === "angles" && (
            <>
              <FilterSelect
                label="Tipo"
                value={angleTypeFilter}
                onChange={setAngleTypeFilter}
                options={[["all", "Todos"], ...angleTypes]}
              />

              <FilterSelect
                label="Estado"
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  ["all", "Todos"],
                  ["active", "Activos"],
                  ["inactive", "Inactivos"],
                ]}
              />
            </>
          )}

          {tab === "templates" && (
            <>
              <FilterSelect
                label="Formato"
                value={formatFilter}
                onChange={setFormatFilter}
                options={[["all", "Todos"], ...formats]}
              />

              <FilterSelect
                label="Estado"
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  ["all", "Todos"],
                  ["active", "Activas"],
                  ["inactive", "Inactivas"],
                ]}
              />
            </>
          )}

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
          eyebrow="Sistema creativo"
          title={current.label}
          count={visible.length}
          countLabel={current.label.toLowerCase()}
          actions={
            <CatalogViewToggle value={viewMode} onChange={setViewMode} />
          }
        />

        <CatalogWorkspace
          className="catalog-shell"
          hasPreview={Boolean(selected)}
        >
          <CatalogGrid as="div" viewMode={viewMode}>
            {tab === "recipes" &&
              visible.map((item) => {
                const image = recipeImage(item, templates, assets);
                return (
                  <article
                    key={item.id}
                    className={`catalog-card catalog-card--recipe ${selected?.id === item.id ? "selected" : ""}`}
                    role="button"
                    tabIndex="0"
                    onClick={() => setSelected(item)}
                    onKeyDown={(e) => e.key === "Enter" && setSelected(item)}
                  >
                    <div className="thumb">
                      {image ? (
                        <img
                          src={image}
                          alt={item.name}
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <div>
                          <span>✦</span>
                          <small>Sin portada</small>
                        </div>
                      )}
                      <button
                        type="button"
                        className="btn btn-secondary btn-icon"
                        onClick={(e) => e.stopPropagation()}
                        aria-label="Destacar receta"
                      >
                        {item.is_favorite ? "★" : "☆"}
                      </button>
                      {item.is_system_recipe && <b>Sistema</b>}
                    </div>
                    <section>
                      <div className="catalog-meta">
                        <span>{item.creative_angle_name || "Sin ángulo"}</span>
                        <StatusBadge active={item.is_active} />
                      </div>
                      <h2>{item.name}</h2>
                      <p>
                        {item.description ||
                          item.prompt_template ||
                          "Sin descripción."}
                      </p>
                      <div className="badges">
                        <small>
                          {contentTypes.find(
                            (type) => type[0] === item.content_type,
                          )?.[1] || item.content_type}
                        </small>
                        <small>{recipeAspect(item)}</small>
                        <small>{recipeStyle(item)}</small>
                      </div>
                      <footer>
                        <span>
                          {item.projects_count
                            ? `Usada en ${item.projects_count} proyectos`
                            : "Lista para proyectos"}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelected(item);
                          }}
                        >
                          •••
                        </button>
                      </footer>
                    </section>
                  </article>
                );
              })}

            {tab === "angles" &&
              visible.map((item) => (
                <article
                  className="catalog-card catalog-card--angle"
                  key={item.id}
                >
                  <div className="avatar angle-card__avatar">
                    {item.name.slice(0, 1).toUpperCase()}
                  </div>

                  <span className="angle-card__type">
                    {angleTypes.find((type) => type[0] === item.code)?.[1] ||
                      item.code}
                  </span>

                  <h2 className="angle-card__title">{item.name}</h2>

                  <p className="angle-card__description">
                    {item.description || "Sin descripción."}
                  </p>

                  {item.example_headline && (
                    <blockquote className="angle-card__example">
                      “{item.example_headline}”
                    </blockquote>
                  )}

                  <footer className="angle-card__footer">
                    <StatusBadge active={item.is_active} />

                    <div>
                      <button
                        type="button"
                        aria-label={`Editar ${item.name}`}
                        onClick={() => openEdit(item)}
                      >
                        <PencilIcon size={16} />
                      </button>

                      <button
                        type="button"
                        className="danger"
                        aria-label={`Eliminar ${item.name}`}
                        onClick={() => remove(item)}
                      >
                        <TrashIcon size={16} />
                      </button>
                    </div>
                  </footer>
                </article>
              ))}

            {tab === "templates" &&
              visible.map((item) => (
                <article
                  className="catalog-card catalog-card--template template"
                  key={item.id}
                >
                  <div className="thumb template-card__media">
                    {item.source_asset_url ? (
                      <img
                        src={item.source_asset_url}
                        alt={item.name}
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div>{item.format}</div>
                    )}
                  </div>

                  <span className="template-card__type">
                    {contentTypes.find(
                      (type) => type[0] === item.content_type,
                    )?.[1] || "Contenido"}
                  </span>

                  <h2 className="template-card__title">{item.name}</h2>

                  <p className="template-card__description">
                    {item.description || `Formato ${item.format}`}
                  </p>

                  <div className="template-card__meta">
                    <span>{item.format || "Sin formato"}</span>
                    {item.aspect_ratio && <span>{item.aspect_ratio}</span>}
                  </div>

                  <footer className="template-card__footer">
                    <StatusBadge active={item.is_active} />

                    <div>
                      <button
                        type="button"
                        aria-label={`Editar ${item.name}`}
                        onClick={() => openEdit(item)}
                      >
                        <PencilIcon size={16} />
                      </button>

                      <button
                        type="button"
                        className="danger"
                        aria-label={`Eliminar ${item.name}`}
                        onClick={() => remove(item)}
                      >
                        <TrashIcon size={16} />
                      </button>
                    </div>
                  </footer>
                </article>
              ))}

            {!visible.length && (
              <div className="empty-state">
                <span>
                  {tab === "recipes" ? "✦" : tab === "angles" ? "◎" : "▦"}
                </span>
                <h2>
                  {query
                    ? "No hay coincidencias"
                    : `Crea tu primera ${current.label.toLowerCase()}`}
                </h2>
                <p>
                  {query
                    ? "Prueba con otra búsqueda o limpia los filtros."
                    : "Empieza a construir una dirección creativa reutilizable."}
                </p>
                {!query && (
                  <button className="btn btn-primary" onClick={openCreate}>
                    Crear {current.label.toLowerCase()}
                  </button>
                )}
              </div>
            )}
          </CatalogGrid>

          {selected && tab === "recipes" && (
            <CatalogPreview
              className="inspector catalog-detail catalog-detail--recipe"
              title="Vista previa de la receta"
              subtitle="Dirección creativa, formato y reglas reutilizables"
              eyebrow="Receta seleccionada"
              onClose={() => setSelected(null)}
            >
              <header className="catalog-detail__identity">
                <h2>{selected.name}</h2>
                <StatusBadge active={selected.is_active} />
              </header>

              <PreviewMedia
                src={recipeImage(selected, templates, assets)}
                alt={selected?.name || "Vista previa de la receta"}
                aspectRatio="4 / 5"
                className="catalog-detail__media"
              >
                <div className="media-fallback">
                  <span>{current.label}</span>
                  <strong>{selected?.name?.slice(0, 1) || "R"}</strong>
                </div>
              </PreviewMedia>

              <div className="inspector-actions catalog-detail__actions recipe-preview-actions">
                {!selected.is_system_recipe && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => openEdit(selected)}
                  >
                    <PencilIcon size={16} />
                    <span>Editar</span>
                  </button>
                )}

                <Link
                  className="btn btn-primary"
                  href={`/projects/new?recipe=${selected.id}`}
                >
                  <SparkIcon size={16} />
                  <span>Usar receta</span>
                </Link>

                {!selected.is_system_recipe && (
                  <button
                    type="button"
                    className="btn btn-danger recipe-preview-actions__delete"
                    onClick={() => remove(selected)}
                  >
                    <TrashIcon size={16} />
                    <span>Eliminar</span>
                  </button>
                )}
              </div>

              <section className="inspector-section">
                <h3>Resumen de la receta</h3>
                <dl>
                  <div>
                    <dt>Ángulo creativo</dt>
                    <dd>{selected.creative_angle_name || "Sin ángulo"}</dd>
                  </div>
                  <div>
                    <dt>Tipo de contenido</dt>
                    <dd>
                      {contentTypes.find(
                        (type) => type[0] === selected.content_type,
                      )?.[1] || selected.content_type}
                    </dd>
                  </div>
                  <div>
                    <dt>Formato objetivo</dt>
                    <dd>{recipeAspect(selected)}</dd>
                  </div>
                  <div>
                    <dt>Estilo visual</dt>
                    <dd>{recipeStyle(selected)}</dd>
                  </div>
                  <div>
                    <dt>Tonos</dt>
                    <dd>{recipeTone(selected)}</dd>
                  </div>
                  <div>
                    <dt>Idioma</dt>
                    <dd>{selected.copy_rules?.language || "es"}</dd>
                  </div>
                  <div>
                    <dt>Estado</dt>
                    <dd>
                      <StatusBadge active={selected.is_active} />
                    </dd>
                  </div>
                  <div>
                    <dt>Actualizada</dt>
                    <dd>
                      {formatDate(selected.updated_at || selected.created_at)}
                    </dd>
                  </div>
                </dl>
              </section>

              <section className="inspector-section">
                <h3>Reglas de copy</h3>
                <dl>
                  <div>
                    <dt>Título máx.</dt>
                    <dd>
                      {selected.copy_rules?.headline?.max_words || 7} palabras
                    </dd>
                  </div>
                  <div>
                    <dt>Estilo</dt>
                    <dd>
                      {titleCase(
                        selected.copy_rules?.headline?.style || "direct",
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>CTA</dt>
                    <dd>
                      {selected.copy_rules?.cta?.enabled === false
                        ? "No"
                        : "Sí"}
                    </dd>
                  </div>
                  <div>
                    <dt>Mostrar precio</dt>
                    <dd>
                      {selected.copy_rules?.pricing?.show_price ? "Sí" : "No"}
                    </dd>
                  </div>
                </dl>
              </section>

              <section className="inspector-section">
                <h3>Prompt base</h3>
                <p className="code-block">
                  {selected.prompt_template || "Sin plantilla de prompt."}
                </p>
              </section>

              <Link
                className="btn btn-primary"
                href={`/projects/new?recipe=${selected.id}`}
              >
                Usar receta en un proyecto →
              </Link>
            </CatalogPreview>
          )}
        </CatalogWorkspace>
      </main>
    </>
  );
}
