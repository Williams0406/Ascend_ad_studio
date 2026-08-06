function Button({
  as: Element = "button",
  className = "",
  children,
  type = "button",
  ...props
}) {
  const elementProps = Element === "button" ? { type, ...props } : props;

  return (
    <Element className={`btn ${className}`.trim()} {...elementProps}>
      {children}
    </Element>
  );
}

export function PrimaryButton(props) {
  return (
    <Button className={`btn-primary ${props.className || ""}`} {...props} />
  );
}

export function SecondaryButton(props) {
  return (
    <Button className={`btn-secondary ${props.className || ""}`} {...props} />
  );
}

export function GhostButton(props) {
  return <Button className={`btn-ghost ${props.className || ""}`} {...props} />;
}

export function DangerButton(props) {
  return (
    <Button className={`btn-danger ${props.className || ""}`} {...props} />
  );
}

export function IconButton({ label, children, className = "", ...props }) {
  return (
    <Button
      className={`btn-secondary btn-icon ${className}`.trim()}
      aria-label={label}
      {...props}
    >
      {children}
    </Button>
  );
}

export default Button;
