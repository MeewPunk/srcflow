import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-headline-md">404</h1>
      <p className="text-body-sm opacity-60">This page could not be found.</p>
      <Link
        href="/"
        className="rounded-full border border-black/10 px-5 py-2 transition-colors hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
      >
        Back to home
      </Link>
    </main>
  );
}
