import Link from "next/link";
import { Button } from "@/app/ui/components/base/button/Button";

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
  gap: 16,
} as const;

const card = {
  display: "flex",
  flexDirection: "column",
  gap: 16,
  padding: 16,
  borderRadius: "var(--radius-lg, 12px)",
  border: "1px solid color-mix(in srgb, var(--foreground) 12%, transparent)",
  background: "var(--surface)",
} as const;

const preview = { display: "flex", flexWrap: "wrap", gap: 8 } as const;

export default async function ComponentsPage({ params }: PageProps<"/[lang]/ui/components">) {
  const { lang } = await params;
  return (
    <main style={{ width: "100%", maxWidth: 960, margin: "0 auto", padding: 24, display: "flex", flexDirection: "column", gap: 24 }}>
      <h1 className="text-headline-md">UI Components</h1>

      <div style={grid}>
        <div style={card}>
          <Link href={`/${lang}/ui/components/base/button`} className="text-title-sm">
            Button
          </Link>
          <div style={preview}>
            <Button size="sm">Solid</Button>
            <Button size="sm" variant="outline">Outline</Button>
            <Button size="sm" variant="soft" tone="danger">Danger</Button>
          </div>
        </div>
      </div>
    </main>
  );
}
