import type { ComponentProps } from "react";

type Props = ComponentProps<"button"> & { variant?: "primary" | "quiet" | "danger"; size?: "sm" | "lg" };

export function Button({ variant, size, className, type = "button", ...props }: Props) {
  const classes = ["btn", variant && `btn-${variant}`, size && `btn-${size}`, className].filter(Boolean).join(" ");
  return <button type={type} className={classes} {...props} />;
}
