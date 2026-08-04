import PageTitle from "@/components/PageTitle";

export function CatalogPageHeader({
  className = "",
  children,
  actions,
  eyebrow,
  title,
  description,
  ...props
}) {
  return (
    <PageTitle
      className={`page-header catalog-page-header catalog-page-header--editorial catalog-page-header--unified ${className}`.trim()}
      eyebrow={eyebrow}
      title={title}
      description={description}
      actions={actions}
      {...props}
    >
      {children}
    </PageTitle>
  );
}

export function CatalogWorkspace({
  as: Element = "section",
  className = "",
  hasPreview = false,
  children,
}) {
  return (
    <Element
      className={[
        "catalog-shell",
        "catalog-workspace",
        hasPreview
          ? "has-detail catalog-shell--with-preview catalog-workspace--split"
          : "catalog-shell--single catalog-workspace--single",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </Element>
  );
}

export function CatalogGrid({
  as: Element = "section",
  className = "",
  children,
  viewMode,
  ariaLabel = "Catálogo",
}) {
  return (
    <Element
      className={`catalog-grid catalog-collection catalog-collection--refined catalog-card-system ${viewMode || ""} ${className}`.trim()}
      aria-label={ariaLabel}
      data-view={viewMode || "grid"}
    >
      {children}
    </Element>
  );
}

export function CatalogResultsHeader({
  eyebrow = "Catálogo",
  title,
  count,
  countLabel = "elementos",
  actions,
  className = "",
}) {
  return (
    <header className={`catalog-results-header ${className}`.trim()}>
      <div className="catalog-results-header__copy">
        <span className="eyebrow">{eyebrow}</span>

        <div className="catalog-results-header__title">
          {title && <h2>{title}</h2>}

          {typeof count === "number" && (
            <span className="catalog-results-header__count" aria-live="polite">
              <strong>{count}</strong>
              <span>{countLabel}</span>
            </span>
          )}
        </div>
      </div>

      {actions && (
        <div className="catalog-results-header__controls">{actions}</div>
      )}
    </header>
  );
}

export function CatalogPreview({
  className = "",
  title,
  subtitle,
  children,
  actions,
  sticky = true,
  eyebrow = "Inspector creativo",
  onClose,
  closeLabel = "Cerrar detalle",
}) {
  return (
    <aside
      className={[
        "catalog-preview-panel",
        "catalog-preview-panel--editorial",
        "catalog-detail-panel",
        sticky ? "catalog-preview-panel--sticky" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={title || "Vista previa"}
    >
      <header className="catalog-detail-panel__header">
        <div className="catalog-detail-panel__heading">
          <span className="catalog-detail-panel__eyebrow">{eyebrow}</span>
          {title && <h2>{title}</h2>}
          {subtitle && <p>{subtitle}</p>}
        </div>

        <div className="catalog-detail-panel__header-actions">
          {actions && (
            <div className="catalog-preview-panel__actions">{actions}</div>
          )}
          {onClose && (
            <button
              type="button"
              className="catalog-detail__close"
              onClick={onClose}
              aria-label={closeLabel}
              title={closeLabel}
            >
              <XIcon size={17} />
            </button>
          )}
        </div>
      </header>

      <div className="catalog-preview-panel__content catalog-detail-panel__content">
        {children}
      </div>
    </aside>
  );
}

export function PreviewMedia({
  src,
  alt = "Vista previa",
  children,
  className = "",
  aspectRatio = "4 / 5",
  fit = "contain",
}) {
  return (
    <div
      className={`preview-panel__media catalog-preview-media ${className}`.trim()}
      style={{ "--preview-aspect-ratio": aspectRatio }}
    >
      <span className="catalog-preview-media__shine" aria-hidden="true" />

      {src ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className={
            fit === "cover"
              ? "catalog-preview-media__asset object-cover"
              : "catalog-preview-media__asset object-contain"
          }
        />
      ) : (
        children
      )}
    </div>
  );
}
import { XIcon } from "@/components/catalog/CatalogIcons";
