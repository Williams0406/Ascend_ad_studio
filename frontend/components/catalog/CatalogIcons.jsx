function Icon({
  children,
  className = "",
  size = 20,
  strokeWidth = 1.8,
  title,
  ...props
}) {
  const labelled = Boolean(title);
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`catalog-icon catalog-icon--refined catalog-icon--ui ${className}`.trim()}
      aria-hidden={labelled ? undefined : "true"}
      role={labelled ? "img" : undefined}
      {...props}
    >
      {labelled && <title>{title}</title>}
      {children}
    </svg>
  );
}

export function SearchIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="11" cy="11" r="6.75" />
      <path d="m16.1 16.1 4.15 4.15" />
    </Icon>
  );
}
export function GridIcon(props) {
  return (
    <Icon {...props}>
      <rect x="3.75" y="3.75" width="6.5" height="6.5" rx="1.4" />
      <rect x="13.75" y="3.75" width="6.5" height="6.5" rx="1.4" />
      <rect x="3.75" y="13.75" width="6.5" height="6.5" rx="1.4" />
      <rect x="13.75" y="13.75" width="6.5" height="6.5" rx="1.4" />
    </Icon>
  );
}
export function CompactIcon(props) {
  return (
    <Icon {...props}>
      <rect x="3.75" y="5" width="16.5" height="5.25" rx="1.5" />
      <rect x="3.75" y="13.75" width="16.5" height="5.25" rx="1.5" />
    </Icon>
  );
}
export function ListIcon(props) {
  return (
    <Icon {...props}>
      <path d="M8.25 6h12M8.25 12h12M8.25 18h12" />
      <circle cx="4.25" cy="6" r=".9" fill="currentColor" stroke="none" />
      <circle cx="4.25" cy="12" r=".9" fill="currentColor" stroke="none" />
      <circle cx="4.25" cy="18" r=".9" fill="currentColor" stroke="none" />
    </Icon>
  );
}
export function TableIcon(props) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="4" width="17" height="16" rx="1.5" />
      <path d="M3.5 9h17M9 4v16M15 4v16" />
    </Icon>
  );
}
export function EyeIcon(props) {
  return (
    <Icon {...props}>
      <path d="M2.4 12s3.6-6.15 9.6-6.15S21.6 12 21.6 12 18 18.15 12 18.15 2.4 12 2.4 12Z" />
      <circle cx="12" cy="12" r="2.65" />
    </Icon>
  );
}
export function PencilIcon(props) {
  return (
    <Icon {...props}>
      <path d="m14.65 5.35 4 4" />
      <path d="M4.15 19.85 5 16.1 16.05 5.05a2.12 2.12 0 0 1 3 3L8 19.1l-3.85.75Z" />
      <path d="m5 16.1 3 3" />
    </Icon>
  );
}
export function CopyIcon(props) {
  return (
    <Icon {...props}>
      <rect x="8" y="8" width="11.25" height="11.25" rx="2" />
      <path d="M16 8V6.25a2 2 0 0 0-2-2H6.25a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2H8" />
    </Icon>
  );
}
export function ArchiveIcon(props) {
  return (
    <Icon {...props}>
      <path d="M4.25 7.25h15.5M6.25 7.25v12h11.5v-12M9.25 11.25h5.5M5.25 4.25h13.5l1 3H4.25l1-3Z" />
    </Icon>
  );
}
export function DownloadIcon(props) {
  return (
    <Icon {...props}>
      <path d="M12 4v10m-4-4 4 4 4-4M5 19h14" />
    </Icon>
  );
}
export function ShareIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="18" cy="5" r="2" />
      <circle cx="6" cy="12" r="2" />
      <circle cx="18" cy="19" r="2" />
      <path d="m7.8 11 8.4-4.8M7.8 13l8.4 4.8" />
    </Icon>
  );
}
export function LinkIcon(props) {
  return (
    <Icon {...props}>
      <path d="M9.5 14.5 14.5 9.5M7.2 17.8 5.7 19.3a3.5 3.5 0 0 1-5-5l3.7-3.7a3.5 3.5 0 0 1 5 0m7.4-4.4 1.5-1.5a3.5 3.5 0 0 1 5 5l-3.7 3.7a3.5 3.5 0 0 1-5 0" />
    </Icon>
  );
}
export function TrashIcon(props) {
  return (
    <Icon {...props}>
      <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13" />
    </Icon>
  );
}
export function ChevronDownIcon(props) {
  return (
    <Icon {...props}>
      <path d="m7 9.5 5 5 5-5" />
    </Icon>
  );
}
export function XIcon(props) {
  return (
    <Icon {...props}>
      <path d="m6.5 6.5 11 11m0-11-11 11" />
    </Icon>
  );
}
export function FilterIcon(props) {
  return (
    <Icon {...props}>
      <path d="M4 6h16M7 12h10M10 18h4" />
    </Icon>
  );
}
export function MoreIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" />
    </Icon>
  );
}
export function CheckIcon(props) {
  return (
    <Icon {...props}>
      <path d="m5 12.5 4.2 4.2L19 7" />
    </Icon>
  );
}

export function SparkIcon(props) {
  return (
    <Icon {...props}>
      <path d="m12 3 1.35 4.65L18 9l-4.65 1.35L12 15l-1.35-4.65L6 9l4.65-1.35L12 3Z" />
      <path d="m19 15 .65 2.35L22 18l-2.35.65L19 21l-.65-2.35L16 18l2.35-.65L19 15Z" />
    </Icon>
  );
}
