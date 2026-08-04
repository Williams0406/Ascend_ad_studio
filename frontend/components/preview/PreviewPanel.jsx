export default function PreviewPanel({
  title,
  subtitle,
  actions,
  className = "",
  mediaClassName = "",
  children,
  eyebrow = "Vista creativa",
}) {
  return (
    <section
      className={`panel strong preview-panel preview-panel--editorial preview-panel--unified ${className}`.trim()}
    >
      {(title || subtitle || actions) && (
        <header className="preview-panel__header">
          <div className="preview-panel__heading">
            <span className="preview-panel__eyebrow">{eyebrow}</span>
            {title && <h3>{title}</h3>}
            {subtitle && <p>{subtitle}</p>}
          </div>

          {actions && <div className="preview-panel__actions">{actions}</div>}
        </header>
      )}

      <div
        className={`preview-panel__media preview-panel__media--editorial ${mediaClassName}`.trim()}
      >
        <span className="preview-panel__grid" aria-hidden="true" />
        <span className="preview-panel__shine" aria-hidden="true" />
        {children}
      </div>
    </section>
  );
}
