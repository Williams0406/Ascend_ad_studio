import Nav from "@/components/Nav";
import PageTitle, { PageHeader } from "@/components/PageTitle";

export function PageShell({
  privateNav = true,
  className = "",
  children,
  as: Element = "main",
}) {
  return (
    <>
      <Nav privateNav={privateNav} />
      <Element className={`container ascend-view page ${className}`.trim()}>
        {children}
      </Element>
    </>
  );
}

export { PageHeader };

export function SectionHeader({ eyebrow, title, description, actions, className = "" }) {
  return (
    <header className={`section-header ${className}`.trim()}>
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        {title && <h2>{title}</h2>}
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="actions">{actions}</div>}
    </header>
  );
}

export function AppSidebar(props) {
  return <Nav privateNav {...props} />;
}

export function AdminSidebar(props) {
  return <Nav privateNav {...props} />;
}

export default PageTitle;
