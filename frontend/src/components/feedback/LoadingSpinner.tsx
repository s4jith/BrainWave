import { cn } from "@utils/cn";

export function LoadingSpinner({ className }: { className?: string }) {
  return (
    <div className="flex items-center justify-center p-8">
      <div
        className={cn(
          "h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-slate-900",
          className,
        )}
        role="status"
        aria-label="Loading"
      />
    </div>
  );
}

export function PageLoadingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <LoadingSpinner />
    </div>
  );
}
