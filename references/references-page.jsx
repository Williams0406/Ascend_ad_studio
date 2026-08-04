"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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
  DownloadIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
} from "@/components/catalog/CatalogIcons";
import {
  CatalogGrid,
  CatalogPreview,
  CatalogResultsHeader,
  CatalogWorkspace,
  PreviewMedia,
} from "@/components/catalog/CatalogLayout";
import { api, ensureWorkspace } from "@/lib/api";
import { useCatalogController } from "@/hooks/useCatalogController";

const emptyForm = {
  title: "",
  category: "reference_ad",
  source: "",
  author: "",
  url: "",
  notes: "",
  tags: "",
};

function formatDate(value) {
  if (!value) return "Sin fecha";

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

function normalize(value) {
  return String(value || "").toLocaleLowerCase("es");
}

function firstTag(reference) {
  return reference.tags?.[0] || "Referencia visual";
}

function referenceImage(reference) {
  return reference.image_url || reference.image || "";
}

function ReferenceField({
  label,
  required = false,
  count,
  wide = false,
  children,
}) {
  return (
    <label className={`field reference-editor-field${wide ? " wide" : ""}`}>
      <span>
        {label}
        {required && <b> *</b>}
        {typeof count === "number" && <small>{count}</small>}
      </span>
      {children}
    </label>
  );
}

function ReferencePreview({ form, preview, tagValues, libraryTab }) {
  const isBrandAsset = libraryTab === "brand-assets";

  return (
    <aside className="inspector reference-editor-preview">
      <header className="reference-editor-preview__header">
        <div>
          <span>{isBrandAsset ? "Vista del Asset" : "Vista curatorial"}</span>

          <h2>
            {isBrandAsset
              ? "Vista previa del Asset"
              : "Vista previa de la referencia"}
          </h2>

          <p>
            {isBrandAsset
              ? "Comprueba el recurso y sus metadatos antes de guardarlo."
              : "Comprueba la imagen, procedencia y criterios antes de guardarla."}
          </p>
        </div>

        <span aria-hidden="true" />
      </header>

      <section className="reference-editor-preview__visual">
        <div className="reference-editor-preview__visual-heading">
          <div>
            <span>Recurso visual</span>
            <strong>
              {form.title ||
                (isBrandAsset ? "Asset sin nombre" : "Referencia sin título")}
            </strong>
          </div>

          <b>{preview ? "Disponible" : "Pendiente"}</b>
        </div>

        <PreviewMedia
          className="reference-editor-preview__media"
          src={preview}
          alt={
            form.title ||
            (isBrandAsset
              ? "Vista previa del Asset"
              : "Vista previa de la referencia")
          }
          aspectRatio="4 / 5"
          fit="contain"
        >
          <div className="media-fallback">
            <span>＋</span>
            <strong>
              {isBrandAsset ? "Asset visual" : "Referencia visual"}
            </strong>
            <small>Selecciona una imagen para previsualizarla.</small>
          </div>
        </PreviewMedia>
      </section>

      <section className="reference-editor-preview__information">
        <header>
          <span>Información</span>
          <h3>Resumen del recurso</h3>
        </header>

        <dl className="reference-editor-preview__details">
          <div>
            <dt>{isBrandAsset ? "Nombre" : "Título"}</dt>
            <dd>{form.title || "—"}</dd>
          </div>

          <div>
            <dt>Categoría</dt>
            <dd>{form.category || "—"}</dd>
          </div>

          <div>
            <dt>Fuente</dt>
            <dd>{form.source || "—"}</dd>
          </div>

          <div>
            <dt>Autor</dt>
            <dd>{form.author || "—"}</dd>
          </div>

          <div>
            <dt>URL original</dt>
            <dd>{form.url || "—"}</dd>
          </div>

          <div>
            <dt>Notas</dt>
            <dd>{form.notes || "—"}</dd>
          </div>
        </dl>
      </section>

      <section className="reference-editor-preview__tags">
        <span>Etiquetas</span>

        <div>
          {tagValues.length ? (
            tagValues.map((tag) => <i key={tag}>{tag}</i>)
          ) : (
            <>
              <i>estilo</i>
              <i>iluminación</i>
              <i>composición</i>
            </>
          )}
        </div>
      </section>
    </aside>
  );
}

export default function ReferencesPage() {
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
  const [references, setReferences] = useState([]);
  const [assets, setAssets] = useState([]);
  const [libraryTab, setLibraryTab] = useState("creative-references");
  const [form, setForm] = useState(emptyForm);
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const fileInputRef = useRef(null);

  const update = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));

  async function load() {
    await ensureWorkspace();
    const [data, assetData] = await Promise.all([
      api("/studio/creative-references/"),
      api("/studio/brand-assets/"),
    ]);
    setReferences(data.results || data);
    setAssets(assetData.results || assetData);
  }

  useEffect(() => {
    load().catch((requestError) => setError(requestError.message));
  }, []);

  useEffect(
    () => () => {
      if (preview?.startsWith("blob:")) {
        URL.revokeObjectURL(preview);
      }
    },
    [preview],
  );

  const tagValues = useMemo(
    () =>
      form.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    [form.tags],
  );

  const sources = useMemo(
    () =>
      [...new Set(references.map((item) => item.source).filter(Boolean))].sort(
        (a, b) => a.localeCompare(b, "es"),
      ),
    [references],
  );

  const allTags = useMemo(
    () =>
      [...new Set(references.flatMap((item) => item.tags || []))].sort((a, b) =>
        a.localeCompare(b, "es"),
      ),
    [references],
  );

  const metrics = useMemo(
    () => ({
      total: references.length,
      withTags: references.filter((item) => item.tags?.length).length,
      withUrl: references.filter((item) => item.url).length,
      sources: sources.length,
    }),
    [references, sources],
  );

  const activeItems = libraryTab === "brand-assets" ? assets : references;
  const visible = useMemo(() => {
    const normalizedQuery = normalize(query);

    const filtered = activeItems.filter((item) => {
      const matchesQuery =
        !normalizedQuery ||
        [
          item.title,
          item.name,
          item.category,
          item.source,
          item.author,
          item.url,
          item.notes,
          ...(item.tags || []),
        ].some((value) => normalize(value).includes(normalizedQuery));

      const matchesSource =
        sourceFilter === "all" || item.source === sourceFilter;

      const matchesTag = tagFilter === "all" || item.tags?.includes(tagFilter);
      const matchesCategory =
        categoryFilter === "all" || item.category === categoryFilter;

      return matchesQuery && matchesSource && matchesTag && matchesCategory;
    });

    return [...filtered].sort((a, b) => {
      if (sort === "oldest") {
        return new Date(a.created_at || 0) - new Date(b.created_at || 0);
      }

      if (sort === "title") {
        return (a.title || "").localeCompare(b.title || "", "es");
      }

      if (sort === "source") {
        return (a.source || "").localeCompare(b.source || "", "es");
      }

      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });
  }, [activeItems, query, sourceFilter, tagFilter, categoryFilter, sort]);

  function chooseImage(file) {
    setPreview((currentPreview) => {
      if (currentPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(currentPreview);
      }

      return file ? URL.createObjectURL(file) : "";
    });

    setImage(file || null);
  }

  function resetForm() {
    setForm(emptyForm);
    chooseImage(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function openCreate() {
    setSelected(null);
    setError("");
    setMessage("");
    resetForm();
    setOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function openEdit(item) {
    const isBrandAsset = libraryTab === "brand-assets";
    const metadata =
      item.metadata && typeof item.metadata === "object" ? item.metadata : {};

    const existingImage = isBrandAsset
      ? item.file_url || ""
      : referenceImage(item);

    setSelected(item);
    setError("");
    setMessage("");

    setForm({
      title: isBrandAsset ? item.name || "" : item.title || "",

      category: item.category || metadata.category || "reference_ad",

      source: isBrandAsset ? metadata.source || "" : item.source || "",

      author: isBrandAsset ? metadata.author || "" : item.author || "",

      url: isBrandAsset ? metadata.url || "" : item.url || "",

      notes: isBrandAsset ? metadata.notes || "" : item.notes || "",

      tags: (isBrandAsset
        ? metadata.tags || item.tags || []
        : item.tags || []
      ).join(", "),
    });

    setImage(null);
    setPreview(existingImage);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    setOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeCreate() {
    resetForm();
    setOpen(false);
  }

  async function submit(event) {
    event.preventDefault();
    if (!image && !selected) return;

    setBusy(true);
    setError("");
    setMessage("");

    try {
      const payload = new FormData();

      if (libraryTab === "brand-assets") {
        payload.append("name", form.title);
        payload.append("category", form.category);
        payload.append(
          "metadata",
          JSON.stringify({
            notes: form.notes,
            tags: tagValues,
            source: form.source,
            author: form.author,
            url: form.url,
          }),
        );
      } else {
        Object.entries(form).forEach(([key, value]) =>
          payload.append(
            key,
            key === "tags" ? JSON.stringify(tagValues) : value,
          ),
        );
      }

      if (image)
        payload.append(libraryTab === "brand-assets" ? "file" : "image", image);

      const path =
        libraryTab === "brand-assets"
          ? "/studio/brand-assets/"
          : "/studio/creative-references/";
      await api(selected ? `${path}${selected.id}/` : path, {
        method: selected ? "PATCH" : "POST",
        body: payload,
      });

      closeCreate();
      await load();
      setMessage(
        libraryTab === "brand-assets"
          ? "BrandAsset guardado correctamente."
          : "Referencia guardada correctamente.",
      );
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(item) {
    if (!window.confirm(`¿Eliminar “${item.title}” de la biblioteca?`)) {
      return;
    }

    try {
      await api(`/studio/creative-references/${item.id}/`, {
        method: "DELETE",
      });

      if (selected?.id === item.id) setSelected(null);
      await load();
      setMessage("Referencia eliminada.");
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  function clearFilters() {
    setQuery("");
    setCategoryFilter("all");
    setSourceFilter("all");
    setTagFilter("all");
  }

  const selectedExistingImage = selected
    ? libraryTab === "brand-assets"
      ? selected.file_url || ""
      : referenceImage(selected)
    : "";

  return (
    <>
      <Nav privateNav />

      <main className="container ascend-view page page--catalog catalog-experience catalog-experience--references">
        {error && (
          <div className="notice error" role="alert">
            {error}
          </div>
        )}

        {message && (
          <div className="notice success" role="status">
            {message}
          </div>
        )}

        {open ? (
          <section className="editor reference-editor-experience">
            <PageTitle
              variant="catalog"
              className="page-header reference-editor-header"
              eyebrow={
                libraryTab === "brand-assets"
                  ? "Biblioteca de marca"
                  : "Memoria visual"
              }
              title={
                libraryTab === "brand-assets"
                  ? selected
                    ? "Editar Asset"
                    : "Nuevo Asset"
                  : selected
                    ? "Editar referencia"
                    : "Nueva referencia"
              }
              description={
                libraryTab === "brand-assets"
                  ? "Organiza un recurso visual reutilizable para mantener consistencia en productos, campañas y generaciones."
                  : "Documenta una dirección visual para conservar su estilo, composición, iluminación y contexto creativo."
              }
              meta={
                <button
                  type="button"
                  className="btn btn-secondary reference-editor-header__back"
                  onClick={closeCreate}
                >
                  ← Referencias
                </button>
              }
              actions={
                <div className="actions reference-editor-header__actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={closeCreate}
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    form="reference-create-form"
                    className="btn btn-primary"
                    disabled={busy || (!image && !selected)}
                  >
                    {busy
                      ? "Guardando…"
                      : selected
                        ? libraryTab === "brand-assets"
                          ? "Guardar cambios del Asset"
                          : "Guardar cambios"
                        : libraryTab === "brand-assets"
                          ? "Guardar Asset"
                          : "Guardar referencia"}
                  </button>
                </div>
              }
            />

            <div className="split-layout reference-editor-layout">
              <form
                id="reference-create-form"
                className="form reference-editor-form"
                onSubmit={submit}
              >
                <section className="panel reference-editor-section reference-editor-section--identity">
                  <header className="reference-editor-section__header">
                    <div className="reference-editor-section__number">01</div>
                    <div>
                      <span>Identidad visual</span>
                      <h2>Imagen e información de referencia</h2>
                      <p>
                        Selecciona una imagen que represente el estilo,
                        composición o elemento que quieres conservar.
                      </p>
                    </div>
                  </header>

                  <div className="upload-layout reference-editor-upload">
                    <button
                      type="button"
                      className="dropzone reference-editor-dropzone"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        required
                        onChange={(event) =>
                          chooseImage(event.target.files?.[0])
                        }
                      />

                      <span>⇧</span>
                      <strong>Arrastra tu imagen aquí</strong>
                      <small>o haz clic para seleccionarla</small>
                      <i>PNG, JPG o WebP</i>
                    </button>

                    <div className="upload-preview reference-editor-upload-preview">
                      {preview ? (
                        <img
                          src={preview}
                          alt="Imagen seleccionada"
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <div>
                          <strong>Vista de imagen</strong>
                          <small>La referencia aparecerá aquí.</small>
                        </div>
                      )}

                      <footer>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          {preview ? "Cambiar imagen" : "Seleccionar imagen"}
                        </button>

                        {preview && (
                          <button
                            type="button"
                            className="danger"
                            onClick={() => {
                              setImage(null);
                              setPreview(selectedExistingImage);

                              if (fileInputRef.current) {
                                fileInputRef.current.value = "";
                              }
                            }}
                            aria-label="Restaurar imagen original"
                          >
                            <TrashIcon />
                          </button>
                        )}
                      </footer>
                    </div>
                  </div>

                  <div className="form-grid reference-editor-fields">
                    <ReferenceField
                      label="Título"
                      required
                      count={form.title.length}
                    >
                      <input
                        className="input"
                        required
                        maxLength="120"
                        value={form.title}
                        onChange={(event) =>
                          update("title", event.target.value)
                        }
                        placeholder="Ej. Luz dorada sobre ámbar"
                      />
                    </ReferenceField>
                    <ReferenceField label="Category" required>
                      <select
                        className="input"
                        value={form.category}
                        onChange={(event) =>
                          update("category", event.target.value)
                        }
                      >
                        {[
                          "product",
                          "packaging",
                          "lifestyle",
                          "logo",
                          "persona",
                          "reference_ad",
                          "template",
                          "background",
                          "icon",
                        ].map((category) => (
                          <option value={category} key={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                    </ReferenceField>

                    <ReferenceField label="Fuente" count={form.source.length}>
                      <input
                        className="input"
                        maxLength="120"
                        value={form.source}
                        onChange={(event) =>
                          update("source", event.target.value)
                        }
                        placeholder="Behance, editorial, campaña…"
                      />
                    </ReferenceField>

                    <ReferenceField
                      label="Autor / Marca"
                      count={form.author.length}
                    >
                      <input
                        className="input"
                        maxLength="120"
                        value={form.author}
                        onChange={(event) =>
                          update("author", event.target.value)
                        }
                        placeholder="Nombre del autor o marca"
                      />
                    </ReferenceField>

                    <ReferenceField label="URL original">
                      <input
                        className="input"
                        type="url"
                        value={form.url}
                        onChange={(event) => update("url", event.target.value)}
                        placeholder="https://…"
                      />
                    </ReferenceField>
                  </div>
                </section>

                <section className="panel reference-editor-section reference-editor-section--curation">
                  <header className="reference-editor-section__header">
                    <div className="reference-editor-section__number">02</div>
                    <div>
                      <span>Criterio creativo</span>
                      <h2>Notas curatoriales y clasificación</h2>
                      <p>
                        Explica qué debe aprender el modelo de esta referencia.
                      </p>
                    </div>
                  </header>

                  <ReferenceField
                    label="Dirección visual"
                    count={form.notes.length}
                    wide
                  >
                    <textarea
                      className="input"
                      maxLength="1000"
                      value={form.notes}
                      onChange={(event) => update("notes", event.target.value)}
                      placeholder="Iluminación cálida lateral, sombras orgánicas, composición editorial, reflejos suaves…"
                    />
                  </ReferenceField>

                  <ReferenceField
                    label="Etiquetas"
                    count={tagValues.length}
                    wide
                  >
                    <input
                      className="input"
                      value={form.tags}
                      onChange={(event) => update("tags", event.target.value)}
                      placeholder="editorial, luz cálida, ámbar, lujo…"
                    />
                  </ReferenceField>

                  <div className="badges reference-editor-classification">
                    <span>Clasificación detectada</span>
                    <div>
                      {tagValues.length ? (
                        tagValues.map((tag) => <i key={tag}>{tag}</i>)
                      ) : (
                        <small>Separa cada etiqueta con una coma.</small>
                      )}
                    </div>
                  </div>

                  <div className="notice info reference-editor-context-note">
                    <span>i</span>
                    <p>
                      Ascend utilizará las notas y etiquetas para presentar esta
                      referencia como una opción de dirección visual dentro de
                      los proyectos.
                    </p>
                  </div>
                </section>

                <footer className="reference-editor-footer">
                  <div>
                    <span>Estado del formulario</span>
                    <strong>
                      {image || selected
                        ? libraryTab === "brand-assets"
                          ? "Asset listo para guardar"
                          : "Referencia lista para guardar"
                        : "Selecciona una imagen para continuar"}
                    </strong>
                  </div>

                  <div className="actions">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={closeCreate}
                    >
                      Cancelar
                    </button>

                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={busy || (!image && !selected)}
                    >
                      {busy
                        ? "Guardando…"
                        : selected
                          ? libraryTab === "brand-assets"
                            ? "Guardar cambios del Asset"
                            : "Guardar cambios"
                          : libraryTab === "brand-assets"
                            ? "Guardar Asset"
                            : "Guardar referencia"}
                    </button>
                  </div>
                </footer>
              </form>

              <ReferencePreview
                form={form}
                preview={preview}
                tagValues={tagValues}
                libraryTab={libraryTab}
              />
            </div>

            <aside className="notice info reference-editor-help">
              <div>
                <span>▣</span>
                <p>
                  <strong>¿Necesitas inspiración?</strong>
                  Explora tus proyectos y activos existentes para identificar
                  estilos que vale la pena conservar.
                </p>
              </div>

              <button type="button" onClick={closeCreate}>
                Explorar biblioteca ↗
              </button>
            </aside>
          </section>
        ) : (
          <>
            <PageTitle
              variant="catalog"
              className="page-header"
              eyebrow="Memoria visual"
              title="Referencias"
              description="Construye una biblioteca curada para orientar estilo, luz, composición y atmósfera en tus proyectos."
              actions={
                <div className="actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={openCreate}
                  >
                    <span>＋</span>
                    {libraryTab === "creative-references"
                      ? "Nueva referencia"
                      : "Nuevo asset"}
                  </button>
                </div>
              }
            />

            <CatalogSectionTabs
              value={libraryTab}
              ariaLabel="Tipo de biblioteca"
              onChange={(nextTab) => {
                setLibraryTab(nextTab);
                setSelected(null);
              }}
              items={[
                {
                  value: "creative-references",
                  label: "CreativeReference",
                  description: "Referencias visuales",
                  count: references.length,
                },
                {
                  value: "brand-assets",
                  label: "BrandAsset",
                  description: "Recursos de marca",
                  count: assets.length,
                },
              ]}
            />

            <CatalogToolbar onClear={clearFilters} clearLabel="Limpiar filtros">
              <CatalogSearch
                value={query}
                onChange={setQuery}
                placeholder="Buscar por título, autor, fuente o etiqueta…"
                className="catalog-toolbar__search"
              />

              <FilterSelect
                label="Categoría"
                value={categoryFilter}
                onChange={setCategoryFilter}
                options={[
                  ["all", "Todas"],
                  ["product", "Producto"],
                  ["packaging", "Packaging"],
                  ["lifestyle", "Lifestyle"],
                  ["logo", "Logo"],
                  ["persona", "Persona"],
                  ["reference_ad", "Referencia publicitaria"],
                  ["template", "Plantilla"],
                  ["background", "Fondo"],
                  ["icon", "Icono"],
                ]}
              />

              <FilterSelect
                label="Fuente"
                value={sourceFilter}
                onChange={setSourceFilter}
                options={[
                  ["all", "Todas"],
                  ...sources.map((source) => [source, source]),
                ]}
              />

              <FilterSelect
                label="Etiqueta"
                value={tagFilter}
                onChange={setTagFilter}
                options={[
                  ["all", "Todas"],
                  ...allTags.map((tag) => [tag, tag]),
                ]}
              />

              <SortSelector
                label="Ordenar"
                value={sort}
                onChange={setSort}
                options={[
                  ["recent", "Más recientes"],
                  ["oldest", "Más antiguas"],
                  ["name", "Título"],
                ]}
              />
            </CatalogToolbar>

            <CatalogResultsHeader
              eyebrow="Biblioteca visual"
              title={
                libraryTab === "creative-references"
                  ? "Referencias creativas"
                  : "Activos de marca"
              }
              count={visible.length}
              countLabel={
                libraryTab === "creative-references" ? "referencias" : "activos"
              }
              actions={
                <CatalogViewToggle value={viewMode} onChange={setViewMode} />
              }
            />

            <CatalogWorkspace
              className="catalog-shell"
              hasPreview={Boolean(selected)}
            >
              <CatalogGrid as="div" viewMode={viewMode}>
                {visible.map((item) => {
                  const isAsset = libraryTab === "brand-assets";
                  const image = isAsset ? item.file_url : referenceImage(item);
                  const title = isAsset ? item.name : item.title;
                  return (
                    <article
                      className={`catalog-card catalog-card--reference ${selected?.id === item.id ? "selected" : ""}`}
                      key={`${libraryTab}-${item.id}`}
                      role="button"
                      tabIndex="0"
                      onClick={() => setSelected(item)}
                      onKeyDown={(event) =>
                        event.key === "Enter" && setSelected(item)
                      }
                    >
                      <div className="thumb">
                        {image ? (
                          <img
                            src={image}
                            alt={title}
                            loading="lazy"
                            decoding="async"
                          />
                        ) : (
                          <div>Sin imagen</div>
                        )}

                        <span>{isAsset ? item.category : firstTag(item)}</span>
                      </div>

                      <section>
                        <div className="badges">
                          {(item.tags || []).slice(0, 2).map((tag) => (
                            <small key={tag}>{tag}</small>
                          ))}
                        </div>

                        <h2>{title}</h2>
                        <p>
                          {isAsset
                            ? item.category
                            : item.source || "Fuente no registrada"}
                        </p>
                        <p>
                          {isAsset
                            ? item.mime_type || "Archivo visual"
                            : item.author || "Autor no registrado"}
                        </p>

                        <footer>
                          <time>{formatDate(item.created_at)}</time>

                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelected(item);
                            }}
                            aria-label="Ver detalle"
                          >
                            •••
                          </button>
                        </footer>
                      </section>
                    </article>
                  );
                })}

                {!visible.length && (
                  <div className="empty-state">
                    <span>CreativeReference</span>
                    <h2>
                      {references.length
                        ? "No encontramos coincidencias"
                        : "Tu biblioteca está lista"}
                    </h2>
                    <p>
                      {references.length
                        ? "Prueba otra búsqueda o limpia los filtros."
                        : "Agrega la primera imagen que defina una dirección visual valiosa."}
                    </p>
                    {!references.length && (
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={openCreate}
                      >
                        {libraryTab === "creative-references"
                          ? "Crear referencia"
                          : "Crear Asset"}
                      </button>
                    )}
                  </div>
                )}
              </CatalogGrid>

              {selected && (
                <CatalogPreview
                  className="inspector catalog-detail catalog-detail--reference"
                  title="Vista previa de la referencia"
                  subtitle="Origen, propósito visual y metadatos del recurso"
                  eyebrow="Referencia seleccionada"
                  onClose={() => setSelected(null)}
                >
                  <header className="catalog-detail__identity">
                    <h2>
                      {libraryTab === "brand-assets"
                        ? selected.name
                        : selected.title}
                    </h2>
                    <span>Activa</span>
                  </header>

                  <PreviewMedia
                    src={
                      libraryTab === "brand-assets"
                        ? selected.file_url
                        : referenceImage(selected)
                    }
                    alt={
                      libraryTab === "brand-assets"
                        ? selected.name
                        : selected.title || "Referencia visual"
                    }
                    aspectRatio="4 / 5"
                    className="catalog-detail__media"
                  >
                    <div className="media-fallback">
                      <strong>Referencia visual</strong>
                      <small>
                        Este recurso no tiene una imagen disponible.
                      </small>
                    </div>
                  </PreviewMedia>

                  <div className="inspector-actions catalog-detail__actions">
                    {(libraryTab === "brand-assets"
                      ? selected.file_url
                      : referenceImage(selected)) && (
                      <a
                        href={
                          libraryTab === "brand-assets"
                            ? selected.file_url
                            : referenceImage(selected)
                        }
                        target="_blank"
                        rel="noreferrer"
                      >
                        <EyeIcon />
                        <span>Vista previa</span>
                      </a>
                    )}

                    {(libraryTab === "brand-assets"
                      ? selected.file_url
                      : referenceImage(selected)) && (
                      <a
                        href={
                          libraryTab === "brand-assets"
                            ? selected.file_url
                            : referenceImage(selected)
                        }
                        target="_blank"
                        rel="noreferrer"
                        download
                      >
                        <DownloadIcon />
                        <span>Descargar</span>
                      </a>
                    )}

                    <button type="button" onClick={() => openEdit(selected)}>
                      <PencilIcon />
                      <span>Editar</span>
                    </button>

                    <button
                      type="button"
                      className="danger"
                      onClick={() => remove(selected)}
                    >
                      <TrashIcon />
                      <span>Eliminar</span>
                    </button>
                  </div>

                  <section className="inspector-section">
                    <h3>Información general</h3>

                    <dl>
                      <div>
                        <dt>Fuente</dt>
                        <dd>
                          {libraryTab === "brand-assets"
                            ? selected.category
                            : selected.source || "—"}
                        </dd>
                      </div>
                      <div>
                        <dt>Autor</dt>
                        <dd>
                          {libraryTab === "brand-assets"
                            ? selected.mime_type || "—"
                            : selected.author || "—"}
                        </dd>
                      </div>
                      <div>
                        <dt>Fecha de creación</dt>
                        <dd>{formatDate(selected.created_at)}</dd>
                      </div>
                      <div>
                        <dt>URL original</dt>
                        <dd>{selected.url || "—"}</dd>
                      </div>
                      <div>
                        <dt>Notas</dt>
                        <dd>{selected.notes || "—"}</dd>
                      </div>
                    </dl>
                  </section>

                  <section className="inspector-section">
                    <h3>Etiquetas</h3>

                    <div className="badges">
                      {(selected.tags || []).length ? (
                        selected.tags.map((tag) => <span key={tag}>{tag}</span>)
                      ) : (
                        <small>Sin etiquetas curatoriales.</small>
                      )}
                    </div>
                  </section>

                  <section className="notice info">
                    <span>Disponible para</span>
                    <p>
                      Esta referencia puede asignarse a proyectos como guía de
                      estilo, composición, iluminación, color, tipografía, pose
                      o atmósfera.
                    </p>
                  </section>
                </CatalogPreview>
              )}
            </CatalogWorkspace>
          </>
        )}
      </main>
    </>
  );
}
