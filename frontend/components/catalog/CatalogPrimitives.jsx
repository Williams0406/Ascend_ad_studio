import {
  ChevronDownIcon,
  FilterIcon,
  GridIcon,
  ListIcon,
  SearchIcon,
  XIcon,
} from "./CatalogIcons";
import { CatalogEmptyState } from "@/components/feedback/States";

export function SearchInput({
  value,
  onChange,
  placeholder = "Buscar…",
  className = "",
  id,
  name,
  onClear,
  autoComplete = "off",
  ariaLabel = "Buscar",
}) {
  const hasValue = Boolean(value);

  const clearSearch = () => {
    onChange("");
    onClear?.();
  };

  return (
    <label
      className={`catalog-control catalog-control--search ${className}`.trim()}
    >
      <span className="catalog-control__label">{ariaLabel}</span>

      <span className="catalog-control__surface">
        <SearchIcon
          size={17}
          className="catalog-control__leading-icon"
          aria-hidden="true"
        />

        <input
          id={id}
          name={name}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          type="search"
          autoComplete={autoComplete}
          aria-label={ariaLabel}
          className="catalog-control__input"
        />

        {hasValue && (
          <button
            type="button"
            onClick={clearSearch}
            className="catalog-control__clear"
            aria-label="Limpiar búsqueda"
            title="Limpiar búsqueda"
          >
            <XIcon size={14} />
          </button>
        )}
      </span>
    </label>
  );
}

export const CatalogSearch = SearchInput;

export function FilterChip({
  active = false,
  children,
  className = "",
  count,
  ...props
}) {
  return (
    <button
      type="button"
      className={`filter-chip inline-flex min-h-9 items-center gap-2 rounded-full border px-3.5 text-xs font-extrabold transition duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#B67A45]/15 ${active ? "active border-[#B67A45]/35 bg-[#B67A45]/15 text-[#7D4B26]" : "border-black/10 bg-white/55 text-[#6E7279] hover:-translate-y-px hover:border-[#B67A45]/25 hover:bg-white/75 hover:text-[#20242B]"} ${className}`.trim()}
      aria-pressed={active}
      {...props}
    >
      {children}
      {typeof count === "number" && (
        <span className="grid min-w-5 place-items-center rounded-full bg-black/[0.06] px-1.5 py-0.5 text-[10px] tabular-nums">
          {count}
        </span>
      )}
    </button>
  );
}

export function FilterBar({ className = "", children, label = "Filtros" }) {
  return (
    <div
      className={`catalog-filter-bar toolbar-group flex min-w-0 flex-wrap items-center gap-2 ${className}`.trim()}
      aria-label={label}
    >
      <span className="catalog-filter-bar__label inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#8A8178]">
        <FilterIcon size={14} />
        {label}
      </span>
      {children}
    </div>
  );
}

export function SortSelector({
  value,
  onChange,
  options,
  label = "Ordenar",
  className = "",
  hideLabel = false,
  disabled = false,
}) {
  return (
    <label
      className={[
        "catalog-control catalog-control--select",
        disabled ? "is-disabled" : "",
        hideLabel ? "catalog-control--label-hidden" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {!hideLabel && <span className="catalog-control__label">{label}</span>}

      <span className="catalog-control__surface">
        <select
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          aria-label={label}
          className="catalog-control__select"
        >
          {options.map(([optionValue, optionLabel]) => (
            <option value={optionValue} key={optionValue}>
              {optionLabel}
            </option>
          ))}
        </select>

        <ChevronDownIcon
          size={16}
          className="catalog-control__chevron"
          aria-hidden="true"
        />
      </span>
    </label>
  );
}

export function FilterSelect({
  label,
  value,
  onChange,
  options,
  className = "",
  disabled = false,
}) {
  return (
    <SortSelector
      label={label}
      value={value}
      onChange={onChange}
      options={options}
      className={className}
      disabled={disabled}
    />
  );
}

export function CatalogToolbar({
  className = "",
  children,
  sticky = false,
  title = "Filtros y visualización",
  onClear,
  clearLabel = "Limpiar filtros",
  clearDisabled = false,
}) {
  return (
    <section
      className={[
        "catalog-toolbar catalog-toolbar--aligned",
        sticky ? "catalog-toolbar--sticky" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={title}
    >
      <header className="catalog-toolbar__heading">
        <span className="catalog-toolbar__title">
          <FilterIcon size={15} />
          Filtros
        </span>

        {onClear && (
          <button
            type="button"
            className="catalog-toolbar__clear"
            onClick={onClear}
            disabled={clearDisabled}
          >
            <XIcon size={14} />
            <span>{clearLabel}</span>
          </button>
        )}
      </header>

      <div className="catalog-toolbar__fields">{children}</div>
    </section>
  );
}

export function CatalogSectionTabs({
  items,
  value,
  onChange,
  className = "",
  ariaLabel = "Secciones",
}) {
  return (
    <nav
      className={`catalog-section-tabs ${className}`.trim()}
      aria-label={ariaLabel}
    >
      <div className="catalog-section-tabs__track">
        {items.map((item) => {
          const active = value === item.value;

          return (
            <button
              key={item.value}
              type="button"
              className={active ? "active" : ""}
              onClick={() => onChange(item.value)}
              aria-pressed={active}
            >
              <span className="catalog-section-tabs__copy">
                <strong>{item.label}</strong>
                {item.description ? <small>{item.description}</small> : null}
              </span>

              {typeof item.count === "number" ? <b>{item.count}</b> : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export function CatalogViewToggle({
  value,
  onChange,
  className = "",
  allowList = true,
  children,
}) {
  const buttonClass = (active) =>
    `catalog-view-toggle__button ${active ? "active" : ""}`;
  return (
    <div
      className={`catalog-view-toggle catalog-view-toggle--editorial catalog-view-toggle--refined ${className}`.trim()}
      role="group"
      aria-label="Modo de visualización"
    >
      <button
        type="button"
        className={buttonClass(value === "grid")}
        onClick={() => onChange("grid")}
        aria-label="Vista de cuadrícula"
        aria-pressed={value === "grid"}
        title="Cuadrícula"
      >
        <GridIcon size={18} />
      </button>
      {children}
      {allowList && (
        <button
          type="button"
          className={buttonClass(value === "list")}
          onClick={() => onChange("list")}
          aria-label="Vista de lista"
          aria-pressed={value === "list"}
          title="Lista"
        >
          <ListIcon size={18} />
        </button>
      )}
    </div>
  );
}

export function CatalogCard({
  as: Element = "article",
  className = "",
  selected = false,
  interactive = false,
  children,
  ...props
}) {
  return (
    <Element
      className={`catalog-card catalog-card--editorial group relative grid min-w-0 content-start gap-4 overflow-hidden rounded-[20px] border border-white/70 bg-white/55 p-4 shadow-[0_10px_30px_rgba(74,59,43,.08)] backdrop-blur-2xl transition duration-200 ${selected ? "selected -translate-y-0.5 border-[#B67A45]/40 bg-white/72 shadow-[0_24px_60px_rgba(74,59,43,.12)] ring-4 ring-[#B67A45]/8" : "hover:-translate-y-0.5 hover:border-[#B67A45]/25 hover:bg-white/68 hover:shadow-[0_24px_60px_rgba(74,59,43,.12)]"} ${interactive ? "cursor-pointer" : ""} ${className}`.trim()}
      {...props}
    >
      {children}
    </Element>
  );
}

export { CatalogEmptyState };

export function CatalogInspector({
  className = "",
  children,
  onClose,
  title,
  subtitle,
}) {
  return (
    <aside
      className={`inspector catalog-inspector catalog-inspector--editorial relative grid min-w-0 content-start gap-5 rounded-[20px] border border-white/70 bg-[rgba(251,248,242,.76)] p-5 shadow-[0_24px_60px_rgba(74,59,43,.12)] backdrop-blur-2xl ${className}`.trim()}
      aria-label={title || "Vista previa"}
    >
      {(title || subtitle || onClose) && (
        <header className="catalog-inspector__header flex items-start justify-between gap-4 border-b border-black/[0.07] pb-4">
          <div className="min-w-0">
            {title && (
              <h2 className="text-lg font-extrabold text-[#171A20]">{title}</h2>
            )}
            {subtitle && (
              <p className="mt-1 text-sm text-[#6E7279]">{subtitle}</p>
            )}
          </div>
          {onClose && (
            <button
              type="button"
              className="inspector__close grid size-9 shrink-0 place-items-center rounded-[10px] border border-black/10 bg-white/65 p-0 text-[#6E7279]"
              onClick={onClose}
              aria-label="Cerrar vista previa"
            >
              <XIcon size={17} />
            </button>
          )}
        </header>
      )}
      {children}
    </aside>
  );
}
