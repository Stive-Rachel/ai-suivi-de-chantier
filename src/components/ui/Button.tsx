import { memo } from "react";
import Icon from "./Icon";

export default memo(function Button({ children, variant = "primary", size = "md", icon, onClick, disabled, className = "", ...props }: any) {
  const ariaLabel = !children && icon ? icon : undefined;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`btn btn-${variant} btn-${size} ${className}`}
      aria-label={ariaLabel}
      {...props}
    >
      {icon && <Icon name={icon} size={size === "sm" ? 14 : 16} />}
      {children}
    </button>
  );
});
