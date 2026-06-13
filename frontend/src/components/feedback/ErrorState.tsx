import { cn } from "@utils/cn";

interface ErrorStateProps {
  title?: string;
  message?: string;
  className?: string;
}

export function ErrorState({
  title = "Something went wrong",
  message = "Please try again in a moment.",
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-red-200 bg-red-50 p-8 text-center",
        className,
      )}
    >
      <h3 className="mb-1 text-lg font-semibold text-red-700">{title}</h3>
      <p className="text-sm text-red-600">{message}</p>
    </div>
  );
}
