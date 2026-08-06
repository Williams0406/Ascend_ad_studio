export function Notice({ tone = "info", className = "", children, ...props }) {
  return (
    <div className={`notice ${tone} ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}

export function CatalogEmptyState({
  icon = "＋",
  title,
  description,
  action,
  className = "",
}) {
  return (
    <div className={`empty-state ${className}`.trim()}>
      <div>
        <div className="empty-icon">{icon}</div>
        {title && <h3>{title}</h3>}
        {description && <p>{description}</p>}
        {action && <div className="actions">{action}</div>}
      </div>
    </div>
  );
}

export function LoadingState({ label = "Cargando…" }) {
  return (
    <div className="loading-state" role="status">
      <div />
      <span>{label}</span>
    </div>
  );
}
