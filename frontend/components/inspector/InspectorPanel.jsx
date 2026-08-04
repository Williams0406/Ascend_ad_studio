export default function InspectorPanel({
  title,
  eyebrow,
  actions,
  onClose,
  children,
  className = "",
}) {
  return (
    <aside className={`inspector ${className}`.trim()} aria-label={title}>
      {(title || eyebrow || actions || onClose) && (
        <div className="inspector-head">
          <div>
            {eyebrow && <span className="eyebrow">{eyebrow}</span>}
            {title && <h3>{title}</h3>}
          </div>
          <div className="actions">
            {actions}
            {onClose && (
              <button
                type="button"
                className="btn btn-secondary btn-icon"
                onClick={onClose}
                aria-label="Cerrar inspector"
              >
                ×
              </button>
            )}
          </div>
        </div>
      )}
      {children}
    </aside>
  );
}
