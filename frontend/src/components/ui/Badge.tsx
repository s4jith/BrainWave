import { HTMLAttributes, forwardRef } from "react";
import { cn } from "@utils/cn";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline" | "note" | "ai";

interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
  variant?: BadgeVariant;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-slate-900 text-white hover:bg-slate-800",
  secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200",
  destructive: "bg-red-600 text-white hover:bg-red-700",
  outline: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
  note: "bg-emerald-500/10 text-emerald-700 border border-emerald-500/20",
  ai: "bg-orange-500/10 text-orange-600 border border-orange-500/20",
};

export const Badge = forwardRef<HTMLDivElement, BadgeProps>(function Badge(
  { className, variant = "default", ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors",
        variantStyles[variant],
        className,
      )}
      {...rest}
    />
  );
});
