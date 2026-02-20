import Icon from "./Icon";

export default function Button({ children, variant = "primary", size = "md", icon, onClick, disabled, className = "", ...props }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`btn btn-${variant} btn-${size} ${className}`}
      {...props}
    >
      {icon && <Icon name={icon} size={size === "sm" ? 14 : 16} />}
      {children}
    </button>
  );
}
