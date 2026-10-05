import { Button } from "@/app/ui/components/base/button/Button";

export default async function Home({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-24 px-6 py-24">
      <section className="flex flex-col items-center gap-6 text-center">
        <span className="rounded-full border border-black/10 px-4 py-1 text-label-sm dark:border-white/15">Visual editor for Next.js</span>
        <h1 className="text-display-md md:text-display-lg">Build beautiful Next.js pages, visually</h1>
        <p className="max-w-2xl text-body-lg opacity-70">Pick any element, tweak its Tailwind classes, drag things around and save straight to your source files.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button size="lg" href={`/${lang}/pricing`}>Get started</Button>
          <Button size="lg" variant="outline" tone="neutral" href={`/${lang}/ui/components`}>
            See components
          </Button>
        </div>
      </section>
      <section className="grid gap-6 md:grid-cols-3">
        <article className="flex flex-col gap-3 rounded-2xl border border-black/10 p-6 transition duration-500 hover:-translate-y-1 hover:shadow-lg dark:border-white/10">
          <span className="text-label-lg opacity-50">01</span>
          <h2 className="text-title-md">Edit in place</h2>
          <p className="text-body-sm opacity-70">Select an element and change its classes or text without leaving the page.</p>
        </article>
        <article className="flex flex-col gap-3 rounded-2xl border border-black/10 p-6 transition duration-500 hover:-translate-y-1 hover:shadow-lg dark:border-white/10">
          <span className="text-label-lg opacity-50">02</span>
          <h2 className="text-title-md">Every screen size</h2>
          <p className="text-body-sm opacity-70">Preview mobile, tablet and desktop, and style each breakpoint on its own.</p>
        </article>
        <article className="flex flex-col gap-3 rounded-2xl border border-black/10 p-6 transition duration-500 hover:-translate-y-1 hover:shadow-lg dark:border-white/10">
          <span className="text-label-lg opacity-50">03</span>
          <h2 className="text-title-md">Real source code</h2>
          <p className="text-body-sm opacity-70">Changes are written back to your page files — no lock-in, just Next.js.</p>
        </article>
      </section>
      <section className="flex flex-col items-center gap-4 rounded-3xl bg-accent/10 px-6 py-16 text-center">
        <h2 className="text-headline-md">Ready to build faster?</h2>
        <p className="max-w-xl text-body-md opacity-70">Start with a page, shape it visually, and keep the code you own.</p>
        <Button size="lg" href={`/${lang}/pricing`}>View pricing</Button>
      </section>
    </main>
  );
}
