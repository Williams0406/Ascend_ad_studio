"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import Nav from "@/components/Nav";
import PageTitle from "@/components/PageTitle";
import { ObjectList } from "@/components/StructuredFields";
import { PencilIcon, SparkIcon } from "@/components/catalog/CatalogIcons";
import {
  CatalogSearch,
  CatalogToolbar,
  CatalogViewToggle,
  FilterSelect,
  SortSelector,
} from "@/components/catalog/CatalogPrimitives";
import {
  CatalogGrid,
  CatalogPreview,
  CatalogResultsHeader,
  CatalogWorkspace,
  PreviewMedia,
} from "@/components/catalog/CatalogLayout";
import { api, ensureWorkspace } from "@/lib/api";
import { useCatalogController } from "@/hooks/useCatalogController";

const emptyProduct = {
  name: "",
  short_description: "",
  description: "",
  brand_name: "",
  product_category: "",
  original_price: "",
  sale_price: "",
  discount_percentage: "",
  currency_code: "PEN",
  primary_benefit: "",
  target_customer: "",
  product_url: "",
  main_image_asset: "",
  image_assets: [],
  benefits: [],
  features: [],
  is_active: true,
};

function Field({ label, hint, required, className = "", children }) {
  return (
    <label className={`product-field ${className}`}>
      <span>
        {label}
        {required && <b> *</b>}
      </span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

function Money({ value, currency = "PEN" }) {
  if (value === null || value === undefined || value === "") {
    return "Sin precio";
  }

  try {
    return new Intl.NumberFormat("es-PE", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(Number(value));
  } catch {
    return `${currency} ${value}`;
  }
}

function ProductImage({ product, className = "" }) {
  if (product?.main_image_url) {
    return (
      <img
        className={className}
        src={product.main_image_url}
        alt={product.name}
        loading="lazy"
        decoding="async"
      />
    );
  }

  return (
    <div className={`media-fallback ${className}`}>
      <span>{product?.name?.slice(0, 2).toUpperCase() || "PR"}</span>
    </div>
  );
}

function StatusBadge({ active }) {
  return (
    <span className={`badge ${active ? "active" : "inactive"}`}>
      {active ? "Activo" : "Inactivo"}
    </span>
  );
}

function ProductSummary({ form, selectedAsset }) {
  const price = form.sale_price || form.original_price;

  return (
    <aside className="inspector product-editor-preview">
      <header className="product-editor-preview__header">
        <div>
          <span>Vista previa del producto</span>
          <p>Así se mostrará en tu catálogo creativo.</p>
        </div>
        <i aria-hidden="true" />
      </header>

      <div className="asset-list product-editor-preview__media">
        <PreviewMedia
          src={selectedAsset?.file_url}
          alt={selectedAsset?.name || form.name || "Producto"}
          aspectRatio="4 / 5"
        >
          <div className="media-fallback">
            <span>＋</span>
            <strong>Imagen principal</strong>
            <small>Selecciona un recurso del Brand Kit</small>
          </div>
        </PreviewMedia>

        <div className="asset-list compact">
          {[0, 1, 2, 3].map((index) => (
            <div key={index}>
              <span>＋</span>
              <small>Imagen</small>
            </div>
          ))}
        </div>
      </div>

      <section className="spec product-editor-preview__summary">
        <h3>Resumen de información</h3>

        <dl>
          <div>
            <dt>Nombre</dt>
            <dd>{form.name || "—"}</dd>
          </div>
          <div>
            <dt>Marca</dt>
            <dd>{form.brand_name || "—"}</dd>
          </div>
          <div>
            <dt>Categoría</dt>
            <dd>{form.product_category || "—"}</dd>
          </div>
          <div>
            <dt>Descripción corta</dt>
            <dd>{form.short_description || "—"}</dd>
          </div>
          <div>
            <dt>Beneficio principal</dt>
            <dd>{form.primary_benefit || "—"}</dd>
          </div>
          <div>
            <dt>Público objetivo</dt>
            <dd>{form.target_customer || "—"}</dd>
          </div>
          <div>
            <dt>Precio</dt>
            <dd>
              {price ? (
                <Money value={price} currency={form.currency_code} />
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div>
            <dt>Estado</dt>
            <dd>
              <StatusBadge active={form.is_active} />
            </dd>
          </div>
        </dl>
      </section>

      <section className="badges product-editor-preview__badges">
        <span>Atributos clave</span>
        <div>
          {[
            form.brand_name,
            form.product_category,
            form.primary_benefit,
            form.target_customer,
          ]
            .filter(Boolean)
            .slice(0, 6)
            .map((item) => (
              <i key={item}>{item}</i>
            ))}
          {![
            form.brand_name,
            form.product_category,
            form.primary_benefit,
            form.target_customer,
          ].some(Boolean) && (
            <>
              <i>Marca</i>
              <i>Categoría</i>
              <i>Beneficio principal</i>
              <i>Público objetivo</i>
            </>
          )}
        </div>
      </section>

      <div className="notice info product-editor-preview__notice">
        <span>i</span>
        Los campos marcados con * son obligatorios.
      </div>
    </aside>
  );
}

export default function ProductsPage() {
  const {
    query: search,
    setQuery: setSearch,
    sort,
    setSort,
    viewMode,
    setViewMode,
    selected,
    setSelected,
  } = useCatalogController();
  const [products, setProducts] = useState([]);
  const [assets, setAssets] = useState([]);
  const [form, setForm] = useState(emptyProduct);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  async function load() {
    await ensureWorkspace();

    const [productData, assetData] = await Promise.all([
      api("/studio/products/"),
      api("/studio/brand-assets/"),
    ]);

    setProducts(productData.results || productData);
    setAssets(
      (assetData.results || assetData).filter(
        (asset) => asset.mime_type?.startsWith("image/") || asset.file_url,
      ),
    );
  }

  useEffect(() => {
    load().catch((error) => setMessage({ type: "error", text: error.message }));
  }, []);

  const categories = useMemo(
    () =>
      [
        ...new Set(
          products.map((product) => product.product_category).filter(Boolean),
        ),
      ].sort((a, b) => a.localeCompare(b, "es")),
    [products],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    const result = products.filter((product) => {
      const matchesSearch =
        !term ||
        [
          product.name,
          product.brand_name,
          product.product_category,
          product.short_description,
          product.primary_benefit,
        ].some((value) => value?.toLowerCase().includes(term));

      const matchesStatus =
        status === "all" ||
        (status === "active" ? product.is_active : !product.is_active);

      const matchesCategory =
        category === "all" || product.product_category === category;

      return matchesSearch && matchesStatus && matchesCategory;
    });

    return [...result].sort((a, b) => {
      if (sort === "name") {
        return a.name.localeCompare(b.name, "es");
      }

      if (sort === "price_asc") {
        return (
          Number(a.sale_price || a.original_price || 0) -
          Number(b.sale_price || b.original_price || 0)
        );
      }

      if (sort === "price_desc") {
        return (
          Number(b.sale_price || b.original_price || 0) -
          Number(a.sale_price || a.original_price || 0)
        );
      }

      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });
  }, [products, search, status, category, sort]);

  const selectedAsset = assets.find(
    (asset) => String(asset.id) === String(form.main_image_asset),
  );

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function flash(type, text) {
    setMessage({ type, text });
    window.setTimeout(() => setMessage({ type: "", text: "" }), 4500);
  }

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyProduct });
    setSelected(null);
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openEdit(product, event) {
    event?.stopPropagation();

    const values = Object.fromEntries(
      Object.keys(emptyProduct).map((key) => [
        key,
        product[key] ?? emptyProduct[key],
      ]),
    );

    values.original_price = product.original_price ?? "";
    values.sale_price = product.sale_price ?? "";
    values.discount_percentage = product.discount_percentage ?? "";
    values.main_image_asset = product.main_image_asset || "";
    values.image_assets = (product.image_assets || []).map(String);

    if (
      values.main_image_asset &&
      !values.image_assets.includes(String(values.main_image_asset))
    ) {
      values.image_assets.unshift(String(values.main_image_asset));
    }

    setEditing(product);
    setForm(values);
    setSelected(null);
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeForm() {
    setEditing(null);
    setForm({ ...emptyProduct });
    setFormOpen(false);
  }

  function toggleImage(assetId) {
    const id = String(assetId);
    const selectedImages = form.image_assets.map(String);
    const exists = selectedImages.includes(id);
    const next = exists
      ? selectedImages.filter((value) => value !== id)
      : [...selectedImages, id];

    update("image_assets", next);

    if (!exists && !form.main_image_asset) {
      update("main_image_asset", id);
    }

    if (exists && String(form.main_image_asset) === id) {
      update("main_image_asset", next[0] || "");
    }
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);

    try {
      const nullableNumbers = [
        "original_price",
        "sale_price",
        "discount_percentage",
      ];
      const payload = { ...form };

      nullableNumbers.forEach((key) => {
        payload[key] = payload[key] === "" ? null : payload[key];
      });

      payload.main_image_asset = payload.main_image_asset || null;
      payload.image_assets = [...new Set(payload.image_assets.map(String))];

      if (
        payload.main_image_asset &&
        !payload.image_assets.includes(String(payload.main_image_asset))
      ) {
        payload.image_assets.unshift(String(payload.main_image_asset));
      }

      const saved = await api(
        editing ? `/studio/products/${editing.id}/` : "/studio/products/",
        {
          method: editing ? "PATCH" : "POST",
          body: JSON.stringify(payload),
        },
      );

      setProducts((current) =>
        editing
          ? current.map((product) =>
              product.id === saved.id ? saved : product,
            )
          : [saved, ...current],
      );

      closeForm();
      setSelected(saved);
      flash(
        "success",
        editing
          ? "Producto actualizado correctamente."
          : "Producto registrado correctamente.",
      );
    } catch (error) {
      flash("error", error.message);
    } finally {
      setBusy(false);
    }
  }

  const clearFilters = () => {
    setSearch("");
    setStatus("all");
    setCategory("all");
  };

  return (
    <>
      <Nav privateNav />

      <main className="container ascend-view page page--catalog catalog-experience catalog-experience--products">
        {message.text && (
          <div className={`notice ${message.type}`}>{message.text}</div>
        )}

        {formOpen ? (
          <section className="editor product-editor-experience">
            <PageTitle
              variant="catalog"
              className="page-header product-editor-header"
              eyebrow="Catálogo comercial"
              title={editing ? "Editar producto" : "Nuevo producto"}
              description="Completa la información que Ascend utilizará para crear campañas relevantes y coherentes con tu marca."
              meta={
                <button
                  type="button"
                  className="btn btn-secondary product-editor-header__back"
                  onClick={closeForm}
                >
                  ← Productos
                </button>
              }
              actions={
                <div className="actions product-editor-header__actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={closeForm}
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    form="product-editor-form"
                    className="btn btn-primary"
                    disabled={busy}
                  >
                    {busy
                      ? "Guardando…"
                      : editing
                        ? "Guardar cambios"
                        : "Guardar producto"}
                  </button>
                </div>
              }
            />

            <div className="split-layout product-editor-layout">
              <form
                id="product-editor-form"
                className="form product-editor-form"
                onSubmit={submit}
              >
                <section className="panel product-editor-section product-editor-section--identity">
                  <header className="product-editor-section__header">
                    <div>
                      <span>01</span>
                      <h2>Información básica</h2>
                      <p>Define los datos principales del producto.</p>
                    </div>
                  </header>

                  <div className="product-fields three">
                    <Field label="Nombre del producto" required>
                      <input
                        className="input"
                        required
                        value={form.name}
                        onChange={(event) => update("name", event.target.value)}
                        placeholder="Ej. Ascend Eau de Parfum"
                      />
                    </Field>

                    <Field label="Marca">
                      <input
                        className="input"
                        value={form.brand_name}
                        onChange={(event) =>
                          update("brand_name", event.target.value)
                        }
                        placeholder="Ej. Ascend"
                      />
                    </Field>

                    <Field label="Categoría de producto">
                      <input
                        className="input"
                        value={form.product_category}
                        onChange={(event) =>
                          update("product_category", event.target.value)
                        }
                        placeholder="Ej. Fragancias"
                      />
                    </Field>
                  </div>

                  <Field
                    label="Descripción corta"
                    required
                    hint={`${form.short_description.length}/500`}
                  >
                    <input
                      className="input"
                      maxLength="500"
                      required
                      value={form.short_description}
                      onChange={(event) =>
                        update("short_description", event.target.value)
                      }
                      placeholder="Resume el producto en una sola línea."
                    />
                  </Field>

                  <Field label="Descripción completa">
                    <textarea
                      className="input product-textarea textarea tall"
                      value={form.description}
                      onChange={(event) =>
                        update("description", event.target.value)
                      }
                      placeholder="Describe el producto, sus características, uso y diferenciadores."
                    />
                  </Field>

                  <div className="product-fields two">
                    <Field label="Beneficio principal" required>
                      <textarea
                        className="input textarea compact"
                        value={form.primary_benefit}
                        onChange={(event) =>
                          update("primary_benefit", event.target.value)
                        }
                        placeholder="Ej. Fragancia duradera y sofisticada."
                      />
                    </Field>

                    <Field label="Público objetivo" required>
                      <textarea
                        className="input textarea compact"
                        value={form.target_customer}
                        onChange={(event) =>
                          update("target_customer", event.target.value)
                        }
                        placeholder="Ej. Adultos de 25 a 45 años."
                      />
                    </Field>
                  </div>

                  <Field label="URL del producto">
                    <input
                      className="input"
                      type="url"
                      value={form.product_url}
                      onChange={(event) =>
                        update("product_url", event.target.value)
                      }
                      placeholder="https://…"
                    />
                  </Field>
                </section>

                <section className="panel product-editor-section product-editor-section--commerce">
                  <header className="product-editor-section__header">
                    <div>
                      <span>02</span>
                      <h2>Precio y oferta</h2>
                      <p>
                        Información comercial que podrá utilizarse en el copy.
                      </p>
                    </div>
                  </header>

                  <div className="product-fields four">
                    <Field label="Precio original">
                      <input
                        className="input"
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.original_price}
                        onChange={(event) =>
                          update("original_price", event.target.value)
                        }
                        placeholder="0.00"
                      />
                    </Field>

                    <Field label="Precio de venta">
                      <input
                        className="input"
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.sale_price}
                        onChange={(event) =>
                          update("sale_price", event.target.value)
                        }
                        placeholder="0.00"
                      />
                    </Field>

                    <Field label="Descuento %">
                      <input
                        className="input"
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={form.discount_percentage}
                        onChange={(event) =>
                          update("discount_percentage", event.target.value)
                        }
                        placeholder="0"
                      />
                    </Field>

                    <Field label="Moneda">
                      <select
                        className="input"
                        value={form.currency_code}
                        onChange={(event) =>
                          update("currency_code", event.target.value)
                        }
                      >
                        <option value="PEN">PEN · Sol</option>
                        <option value="USD">USD · Dólar</option>
                        <option value="EUR">EUR · Euro</option>
                        <option value="MXN">MXN · Peso mexicano</option>
                        <option value="COP">COP · Peso colombiano</option>
                        <option value="CLP">CLP · Peso chileno</option>
                      </select>
                    </Field>
                  </div>
                </section>

                <section className="panel product-editor-section product-editor-section--attributes">
                  <header className="product-editor-section__header">
                    <div>
                      <span>03</span>
                      <h2>Beneficios y características</h2>
                      <p>
                        Convierte el conocimiento del producto en datos
                        reutilizables para la IA.
                      </p>
                    </div>
                  </header>

                  <div className="form-grid">
                    <div className="structured-section">
                      <div className="structured-heading">
                        <div>
                          <span>Beneficios</span>
                          <p>Resultados que obtiene el cliente.</p>
                        </div>
                      </div>

                      <ObjectList
                        value={form.benefits}
                        onChange={(value) => update("benefits", value)}
                        addLabel="Agregar beneficio"
                        fields={[
                          {
                            key: "title",
                            label: "Beneficio",
                            placeholder: "Duración prolongada",
                          },
                          {
                            key: "priority",
                            label: "Prioridad",
                            type: "number",
                            default: form.benefits.length + 1,
                            min: 1,
                          },
                          {
                            key: "description",
                            label: "Descripción",
                            type: "textarea",
                            wide: true,
                            placeholder:
                              "Explica el resultado para el cliente…",
                          },
                        ]}
                      />
                    </div>

                    <div className="structured-section">
                      <div className="structured-heading">
                        <div>
                          <span>Características</span>
                          <p>Datos técnicos, físicos o funcionales.</p>
                        </div>
                      </div>

                      <ObjectList
                        value={form.features}
                        onChange={(value) => update("features", value)}
                        addLabel="Agregar característica"
                        fields={[
                          {
                            key: "name",
                            label: "Característica",
                            placeholder: "Contenido",
                          },
                          {
                            key: "value",
                            label: "Valor",
                            placeholder: "100 ml",
                          },
                          {
                            key: "category",
                            label: "Categoría",
                            type: "select",
                            default: "product",
                            options: [
                              ["technical", "Técnica"],
                              ["product", "Producto"],
                              ["packaging", "Empaque"],
                              ["other", "Otra"],
                            ],
                          },
                        ]}
                      />
                    </div>
                  </div>
                </section>

                <section className="panel product-editor-section product-editor-section--media">
                  <header className="product-editor-section__header">
                    <div>
                      <span>04</span>

                      <div>
                        <small>Biblioteca visual</small>
                        <h2>Imágenes y activos</h2>
                        <p>
                          Selecciona los recursos que representen al producto y
                          define cuál funcionará como portada principal.
                        </p>
                      </div>
                    </div>
                  </header>

                  <div className="product-media-workspace">
                    <aside className="product-media-primary">
                      <header>
                        <div>
                          <span>Portada principal</span>
                          <strong>
                            {selectedAsset
                              ? selectedAsset.name
                              : "Sin imagen seleccionada"}
                          </strong>
                        </div>

                        <b>
                          {form.image_assets.length} recurso
                          {form.image_assets.length === 1 ? "" : "s"}
                        </b>
                      </header>

                      <div className="chosen-product-image">
                        {selectedAsset ? (
                          <img
                            src={selectedAsset.file_url}
                            alt={selectedAsset.name}
                            loading="lazy"
                            decoding="async"
                          />
                        ) : (
                          <div>
                            <span>＋</span>
                            <strong>Selecciona una portada</strong>
                            <small>
                              Elige una imagen de la biblioteca de BrandAsset.
                            </small>
                          </div>
                        )}
                      </div>

                      <div className="product-image-count">
                        <span>
                          {selectedAsset
                            ? "Portada configurada"
                            : "Portada pendiente"}
                        </span>

                        <small>
                          {selectedAsset
                            ? selectedAsset.name
                            : "Selecciona al menos una imagen"}
                        </small>
                      </div>
                    </aside>

                    <section className="product-media-library">
                      <header>
                        <div>
                          <span>BrandAsset</span>
                          <h3>Biblioteca disponible</h3>
                          <p>
                            Puedes seleccionar varias imágenes y definir una
                            como principal.
                          </p>
                        </div>

                        <Link href="/brand-kit" className="btn btn-secondary">
                          Gestionar recursos
                        </Link>
                      </header>

                      {assets.length ? (
                        <div className="asset-choice-grid product-multi-assets">
                          {assets.map((asset) => {
                            const chosen = form.image_assets
                              .map(String)
                              .includes(String(asset.id));

                            const main =
                              String(form.main_image_asset) ===
                              String(asset.id);

                            return (
                              <article
                                className={[
                                  "product-media-asset",
                                  chosen ? "selected" : "",
                                  main ? "main" : "",
                                ]
                                  .filter(Boolean)
                                  .join(" ")}
                                key={asset.id}
                              >
                                <button
                                  type="button"
                                  className="product-media-asset__select"
                                  onClick={() => toggleImage(asset.id)}
                                  aria-pressed={chosen}
                                >
                                  <span className="product-media-asset__image">
                                    <img
                                      src={asset.file_url}
                                      alt={asset.name || "Recurso de producto"}
                                      loading="lazy"
                                      decoding="async"
                                    />

                                    <i aria-hidden="true">
                                      {chosen ? "✓" : "+"}
                                    </i>

                                    {main && <b>Principal</b>}
                                  </span>

                                  <span className="product-media-asset__name">
                                    {asset.name || "Recurso sin nombre"}
                                  </span>
                                </button>

                                {chosen && (
                                  <button
                                    type="button"
                                    className="set-main-image"
                                    disabled={main}
                                    onClick={() =>
                                      update(
                                        "main_image_asset",
                                        String(asset.id),
                                      )
                                    }
                                  >
                                    {main
                                      ? "Imagen principal"
                                      : "Usar como principal"}
                                  </button>
                                )}
                              </article>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="empty-state product-media-empty">
                          <span>◇</span>
                          <strong>No hay imágenes en BrandAsset</strong>
                          <p>
                            Sube recursos visuales para asociarlos a este
                            producto.
                          </p>

                          <Link href="/brand-kit" className="btn btn-primary">
                            Subir recursos
                          </Link>
                        </div>
                      )}
                    </section>
                  </div>
                </section>

                <section className="panel metric-card product-editor-status">
                  <label className="product-active">
                    <span>
                      <b>Producto activo</b>
                      <small>
                        Estará disponible para crear nuevos proyectos.
                      </small>
                    </span>
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(event) =>
                        update("is_active", event.target.checked)
                      }
                    />
                    <i />
                  </label>
                </section>

                <div className="actions product-editor-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={closeForm}
                  >
                    Cancelar
                  </button>

                  <button className="btn btn-primary" disabled={busy}>
                    {busy
                      ? "Guardando…"
                      : editing
                        ? "Guardar cambios"
                        : "Guardar producto"}
                    <span aria-hidden="true">→</span>
                  </button>
                </div>
              </form>

              <ProductSummary form={form} selectedAsset={selectedAsset} />
            </div>

            <aside className="notice info product-editor-help">
              <div>
                <span>▣</span>
                <p>
                  <strong>¿Necesitas ayuda?</strong>
                  Completa la información para que la IA entienda mejor tu
                  producto y genere campañas más efectivas.
                </p>
              </div>
              <Link href="/products/guide">Ver guía de productos ↗</Link>
            </aside>
          </section>
        ) : (
          <>
            <PageTitle
              variant="catalog"
              className="page-header"
              eyebrow="Catálogo comercial"
              title="Productos"
              description="Administra los productos que alimentan tus campañas, mensajes y generaciones."
              actions={
                <div className="actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={openCreate}
                  >
                    <span>＋</span>
                    Nuevo producto
                  </button>
                </div>
              }
            />

            <CatalogToolbar onClear={clearFilters} clearLabel="Limpiar filtros">
              <CatalogSearch
                value={search}
                onChange={setSearch}
                placeholder="Buscar por nombre, marca o categoría…"
                className="catalog-toolbar__search"
              />

              <FilterSelect
                label="Categoría"
                value={category}
                onChange={setCategory}
                options={[
                  ["all", "Todas"],
                  ...categories.map((item) => [item, item]),
                ]}
              />

              <FilterSelect
                label="Estado"
                value={status}
                onChange={setStatus}
                options={[
                  ["all", "Todos"],
                  ["active", "Activos"],
                  ["inactive", "Inactivos"],
                ]}
              />

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
              eyebrow="Catálogo comercial"
              title="Productos disponibles"
              count={filtered.length}
              countLabel="productos"
              actions={
                <CatalogViewToggle value={viewMode} onChange={setViewMode} />
              }
            />

            <CatalogWorkspace
              className="catalog-shell"
              hasPreview={Boolean(selected)}
            >
              <CatalogGrid viewMode={viewMode}>
                {filtered.map((product) => (
                  <article
                    className={`catalog-card catalog-card--product ${selected?.id === product.id ? "selected" : ""}`}
                    key={product.id}
                    tabIndex="0"
                    role="button"
                    onClick={() => setSelected(product)}
                    onKeyDown={(event) =>
                      event.key === "Enter" && setSelected(product)
                    }
                  >
                    <button
                      type="button"
                      className="btn btn-secondary btn-icon"
                      onClick={(event) => openEdit(product, event)}
                      aria-label={`Editar ${product.name}`}
                      title="Editar producto"
                    >
                      <PencilIcon />
                    </button>

                    <div className="thumb">
                      <ProductImage product={product} />
                      <StatusBadge active={product.is_active} />

                      {Number(product.discount_percentage) > 0 && (
                        <b>
                          -{Number(product.discount_percentage).toFixed(0)}%
                        </b>
                      )}
                    </div>

                    <div className="catalog-body">
                      <span>{product.product_category || "Sin categoría"}</span>
                      <h3>{product.name}</h3>
                      <p>
                        {product.short_description ||
                          product.primary_benefit ||
                          "Sin descripción disponible."}
                      </p>

                      <div className="inspector-actions product-card__footer">
                        <div className="product-card__price">
                          <strong>
                            <Money
                              value={
                                product.sale_price || product.original_price
                              }
                              currency={product.currency_code}
                            />
                          </strong>

                          <small>
                            {product.brand_name || "Marca no definida"}
                          </small>
                        </div>

                        <button
                          type="button"
                          className="product-card__more"
                          aria-label={`Ver ficha de ${product.name}`}
                          title="Ver ficha"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelected(product);
                          }}
                        >
                          <span aria-hidden="true">•••</span>
                        </button>
                      </div>
                    </div>
                  </article>
                ))}

                {!filtered.length && (
                  <div className="empty-state">
                    <span>Catálogo</span>
                    <h2>
                      {products.length
                        ? "No encontramos coincidencias"
                        : "Registra tu primer producto"}
                    </h2>
                    <p>
                      {products.length
                        ? "Prueba otra búsqueda o limpia los filtros."
                        : "Crea una ficha completa para generar campañas más relevantes."}
                    </p>
                    {!products.length && (
                      <button className="btn btn-primary" onClick={openCreate}>
                        Nuevo producto
                      </button>
                    )}
                  </div>
                )}
              </CatalogGrid>

              {selected && (
                <CatalogPreview
                  className="inspector catalog-detail catalog-detail--product"
                  title="Detalle de producto"
                  subtitle="Información comercial, imágenes y atributos clave"
                  eyebrow="Producto seleccionado"
                  onClose={() => setSelected(null)}
                >
                  <header className="section-header catalog-detail__identity">
                    <div>
                      <h2>{selected.name}</h2>
                      <StatusBadge active={selected.is_active} />
                      <span>
                        {selected.product_category || "Sin categoría"}
                      </span>
                    </div>
                  </header>

                  <PreviewMedia
                    src={selected.main_image_url}
                    alt={selected.name || "Vista previa del producto"}
                    aspectRatio="4 / 5"
                    className="catalog-detail__media"
                  >
                    <div className="media-fallback">
                      <span>Producto</span>
                      <strong>{selected.name?.slice(0, 1) || "P"}</strong>
                    </div>
                  </PreviewMedia>

                  <section className="stack">
                    <div>
                      <span>Descripción corta</span>
                      <p>
                        {selected.short_description || "Sin descripción corta."}
                      </p>
                    </div>

                    <div>
                      <span>Descripción completa</span>
                      <p>
                        {selected.description || "Sin descripción completa."}
                      </p>
                    </div>
                  </section>

                  <section className="grid metrics-grid">
                    <h3>Precios</h3>
                    <div>
                      <article>
                        <span>Precio original</span>
                        <strong>
                          <Money
                            value={selected.original_price}
                            currency={selected.currency_code}
                          />
                        </strong>
                      </article>
                      <article>
                        <span>Precio de oferta</span>
                        <strong>
                          <Money
                            value={selected.sale_price}
                            currency={selected.currency_code}
                          />
                        </strong>
                      </article>
                      <article>
                        <span>Descuento</span>
                        <strong>
                          {selected.discount_percentage
                            ? `${Number(selected.discount_percentage).toFixed(
                                0,
                              )}%`
                            : "—"}
                        </strong>
                      </article>
                    </div>
                    <small>Moneda · {selected.currency_code || "PEN"}</small>
                  </section>

                  <section className="badges">
                    <h3>Atributos clave</h3>
                    <div>
                      {[
                        selected.brand_name && `Marca: ${selected.brand_name}`,
                        selected.product_category &&
                          `Categoría: ${selected.product_category}`,
                        selected.primary_benefit &&
                          `Beneficio: ${selected.primary_benefit}`,
                        selected.target_customer &&
                          `Público: ${selected.target_customer}`,
                      ]
                        .filter(Boolean)
                        .map((item) => (
                          <span key={item}>{item}</span>
                        ))}
                    </div>
                  </section>

                  <section className="inspector-media">
                    <h3>
                      Imágenes del producto (
                      {selected.image_asset_urls?.length || 1})
                    </h3>

                    <div>
                      {selected.image_asset_urls?.length ? (
                        selected.image_asset_urls.map((image) => (
                          <img
                            src={image.url}
                            alt={image.name}
                            key={image.id}
                            loading="lazy"
                            decoding="async"
                          />
                        ))
                      ) : (
                        <ProductImage product={selected} />
                      )}

                      <button
                        type="button"
                        onClick={(event) => openEdit(selected, event)}
                        aria-label="Agregar imágenes"
                      >
                        ＋
                      </button>
                    </div>
                  </section>

                  <section className="kv">
                    <h3>Información del sistema</h3>
                    <div>
                      <p>
                        <span>Creado</span>
                        <strong>
                          {selected.created_at
                            ? new Intl.DateTimeFormat("es-PE", {
                                dateStyle: "medium",
                                timeStyle: "short",
                              }).format(new Date(selected.created_at))
                            : "—"}
                        </strong>
                      </p>
                      <p>
                        <span>Actualizado</span>
                        <strong>
                          {selected.updated_at
                            ? new Intl.DateTimeFormat("es-PE", {
                                dateStyle: "medium",
                                timeStyle: "short",
                              }).format(new Date(selected.updated_at))
                            : "—"}
                        </strong>
                      </p>
                    </div>
                  </section>

                  <div className="inspector-actions catalog-detail__actions">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={(event) => openEdit(selected, event)}
                    >
                      <PencilIcon />
                      Editar
                    </button>

                    <Link
                      className="btn btn-primary"
                      href={`/workspace?product=${selected.id}`}
                    >
                      <SparkIcon />
                      Crear publicidad
                    </Link>
                  </div>
                </CatalogPreview>
              )}
            </CatalogWorkspace>
          </>
        )}
      </main>
    </>
  );
}
