import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-white p-6 text-center">
      <h1 className="mb-3 text-4xl font-bold tracking-tight text-slate-900 md:text-6xl">
        <span className="text-red-500">BRAINWAVE</span>
      </h1>
      <p className="mb-8 max-w-xl text-slate-600">
        Synchronizing minds with smarter learning. Built for focus, clarity, and growth.
      </p>
      <Link
        href="/login"
        className="rounded-2xl bg-slate-900 px-8 py-3 font-medium text-white hover:bg-slate-800"
      >
        Sign in
      </Link>
    </div>
  );
}
