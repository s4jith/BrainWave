"use client";

import { HTMLAttributes, ReactNode, forwardRef } from "react";
import { X } from "lucide-react";
import { cn } from "@utils/cn";

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}

export function Sheet({ open, onOpenChange, children }: SheetProps) {
  if (!open) return null;
  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
        aria-hidden
      />
      {children}
    </>
  );
}

interface SheetContentProps extends HTMLAttributes<HTMLDivElement> {
  side?: "left" | "right";
  onClose?: () => void;
}

export const SheetContent = forwardRef<HTMLDivElement, SheetContentProps>(function SheetContent(
  { className, children, side = "right", onClose, ...rest },
  ref,
) {
  const sideClass = side === "right" ? "right-0 border-l" : "left-0 border-r";
  return (
    <div
      ref={ref}
      role="dialog"
      className={cn(
        "fixed top-0 z-50 h-full w-[400px] max-w-[90vw] gap-4 bg-white p-6 shadow-lg",
        sideClass,
        className,
      )}
      {...rest}
    >
      {onClose ? (
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
      {children}
    </div>
  );
});

export function SheetHeader({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col space-y-2 text-left", className)} {...rest} />;
}

export const SheetTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  function SheetTitle({ className, ...rest }, ref) {
    return <h2 ref={ref} className={cn("text-lg font-semibold text-slate-900", className)} {...rest} />;
  },
);

export const SheetDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  function SheetDescription({ className, ...rest }, ref) {
    return <p ref={ref} className={cn("text-sm text-slate-500", className)} {...rest} />;
  },
);
