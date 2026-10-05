import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { assertDev } from "@/lib/routeFs";
import { apiFail } from "@/i18n/editor/server";

// the component library's source lives outside [lang] (only its gallery pages are routes)
const FILE = path.join(
  process.cwd(),
  "src",
  "app",
  "ui",
  "components",
  "base",
  "button",
  "button.classes.ts"
);

function assertShape(c: unknown): asserts c is {
  base: string;
  size: Record<string, string>;
  styles: Record<string, Record<string, string>>;
} {
  const o = c as Record<string, unknown> | null;
  const strMap = (v: unknown) =>
    !!v &&
    typeof v === "object" &&
    Object.values(v as object).every((x) => typeof x === "string");
  if (!o || typeof o !== "object") throw new Error("invalid classes");
  if (typeof o.base !== "string") throw new Error("base must be a string");
  if (!strMap(o.size)) throw new Error("invalid size");
  if (!o.styles || typeof o.styles !== "object")
    throw new Error("invalid styles");
  for (const grp of Object.values(o.styles as object))
    if (!strMap(grp)) throw new Error("invalid styles");
}

export async function POST(req: Request) {
  try {
    assertDev();
    const body = await req.json();
    assertShape(body.classes);
    const content =
      "// class data for Button — edited by the component editor; Tailwind scans this file\n" +
      "export const buttonClasses = " +
      JSON.stringify(body.classes, null, 2) +
      " as const;\n";
    await fs.writeFile(FILE, content, "utf8");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiFail(e);
  }
}
