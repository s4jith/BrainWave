import { InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@utils/cn";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, error, ...rest },
  ref,
) {
  return (
    <div className="flex w-full flex-col gap-1">
      <input
        ref={ref}
        className={cn(
          "h-14 w-full rounded-2xl bg-slate-100 px-5 text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-slate-200",
          error && "ring-2 ring-red-400",
          className,
        )}
        {...rest}
      />
      {error ? <p className="text-sm text-red-500">{error}</p> : null}
    </div>
  );
});
