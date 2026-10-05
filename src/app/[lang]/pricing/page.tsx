import { Button } from "@/app/ui/components/base/button/Button";

export default function Page() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-16 px-6 py-24">
      <header className="flex flex-col items-center gap-4 text-center">
        <span className="rounded-full border border-black/10 px-4 py-1 text-label-sm dark:border-white/15">Pricing</span>
        <h1 className="text-display-sm">Simple plans for every team</h1>
        <p className="max-w-xl text-body-lg opacity-70">Start free, upgrade when your pages grow. No credit card needed.</p>
      </header>

      <section className="grid gap-6 md:grid-cols-3">
        <article className="flex flex-col gap-6 rounded-2xl border border-black/10 p-8 transition duration-500 hover:-translate-y-1 hover:shadow-lg dark:border-white/10">
          <div className="flex flex-col gap-2">
            <h2 className="text-title-md">Starter</h2>
            <p className="text-body-sm opacity-70">For personal projects</p>
          </div>
          <p className="text-headline-md">Free</p>
          <ul className="flex flex-col gap-3 text-body-sm">
            <li>1 project</li>
            <li>Visual class editor</li>
            <li>Community support</li>
          </ul>
          <Button variant="outline" tone="neutral" fullWidth>Get started</Button>
        </article>

        <article className="flex flex-col gap-6 rounded-2xl border-2 border-accent bg-accent/5 p-8 shadow-lg transition duration-500 hover:-translate-y-1 hover:shadow-xl">
          <div className="flex flex-col gap-2">
            <h2 className="text-title-md">Pro</h2>
            <p className="text-body-sm opacity-70">For freelancers and makers</p>
          </div>
          <p className="text-headline-md">$12 / month</p>
          <ul className="flex flex-col gap-3 text-body-sm">
            <li>Unlimited projects</li>
            <li>Responsive and dark mode editing</li>
            <li>Theme and site settings</li>
          </ul>
          <Button fullWidth>Start Pro</Button>
        </article>

        <article className="flex flex-col gap-6 rounded-2xl border border-black/10 p-8 transition duration-500 hover:-translate-y-1 hover:shadow-lg dark:border-white/10">
          <div className="flex flex-col gap-2">
            <h2 className="text-title-md">Team</h2>
            <p className="text-body-sm opacity-70">For studios and companies</p>
          </div>
          <p className="text-headline-md">$39 / month</p>
          <ul className="flex flex-col gap-3 text-body-sm">
            <li>Everything in Pro</li>
            <li>Shared component library</li>
            <li>Priority support</li>
          </ul>
          <Button variant="outline" tone="neutral" fullWidth>Contact sales</Button>
        </article>
      </section>
    </main>
  );
}
