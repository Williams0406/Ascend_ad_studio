function FieldShell({ label, hint, error, className = "", children }) {
  return (
    <label className={`field ${className}`.trim()}>
      {label && <span>{label}</span>}
      {children}
      {hint && <small className="help">{hint}</small>}
      {error && <small className="field-error">{error}</small>}
    </label>
  );
}

export function InputField({ label, hint, error, className = "", inputClassName = "input", ...props }) {
  return (
    <FieldShell label={label} hint={hint} error={error} className={className}>
      <input className={inputClassName} {...props} />
    </FieldShell>
  );
}

export function SelectField({ label, hint, error, className = "", inputClassName = "select", children, ...props }) {
  return (
    <FieldShell label={label} hint={hint} error={error} className={className}>
      <select className={inputClassName} {...props}>
        {children}
      </select>
    </FieldShell>
  );
}

export function TextareaField({ label, hint, error, className = "", inputClassName = "textarea", ...props }) {
  return (
    <FieldShell label={label} hint={hint} error={error} className={className}>
      <textarea className={inputClassName} {...props} />
    </FieldShell>
  );
}

export function CheckboxField({ label, hint, error, className = "", children, ...props }) {
  return (
    <FieldShell hint={hint} error={error} className={`check-field ${className}`.trim()}>
      <input type="checkbox" {...props} />
      <span>{children || label}</span>
    </FieldShell>
  );
}

export function FormSection({ title, description, actions, className = "", children }) {
  return (
    <section className={`panel strong form-section ${className}`.trim()}>
      {(title || description || actions) && (
        <header>
          <div>
            {title && <h3>{title}</h3>}
            {description && <p>{description}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className="panel-body">{children}</div>
    </section>
  );
}
