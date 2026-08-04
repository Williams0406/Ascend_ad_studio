export function PageHeader({
  as: Element = "header",
  className = "",
  eyebrow,
  title,
  description,
  actions,
  meta,
  kicker,
  children,
  size = "default",
  variant = "default",
}) {
  const resolvedEyebrow = eyebrow || kicker;

  const variantClass =
    variant === "catalog"
      ? "catalog-page-header catalog-page-header--editorial catalog-page-header--unified"
      : "";

  return (
    <Element
      className={["page-title", `page-title--${size}`, variantClass, className]
        .filter(Boolean)
        .join(" ")}
    >
      {children || (
        <>
          <div className="page-title__copy">
            {resolvedEyebrow && (
              <span className="page-title__eyebrow">{resolvedEyebrow}</span>
            )}

            <h1>{title}</h1>

            {description && <p>{description}</p>}

            {meta && <div className="page-title__meta">{meta}</div>}
          </div>

          {actions && <div className="page-title__actions">{actions}</div>}
        </>
      )}
    </Element>
  );
}

export default PageHeader;
