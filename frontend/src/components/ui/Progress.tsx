import { HTMLAttributes, forwardRef } from "react";
import { cn } from "@utils/cn";

interface ProgressProps extends HTMLAttributes<HTMLDivElement> {
  value?: number;
}

export const Progress = forwardRef<HTMLDivElement, ProgressProps>(function Progress(
  { className, value = 0, ...rest },
  ref,
) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      ref={ref}
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-slate-200",
        className,
      )}
      {...rest}
    >
      <div
        className="h-full w-full flex-1 bg-slate-900 transition-all duration-300 ease-in-out"
        style={{ transform: `translateX(-${100 - clamped}%)` }}
      />
    </div>
  );
});
