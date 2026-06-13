import { HTMLAttributes, forwardRef } from "react";
import { cn } from "@utils/cn";

export const ScrollArea = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function ScrollArea({ className, children, ...rest }, ref) {
    return (
      <div ref={ref} className={cn("relative overflow-auto", className)} {...rest}>
        {children}
      </div>
    );
  },
);
