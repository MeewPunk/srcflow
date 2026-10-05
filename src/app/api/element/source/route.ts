import { NextResponse } from "next/server";
import { assertDev } from "@/lib/routeFs";
import { readElementSource } from "@/lib/elementFs";
import { apiFail } from "@/i18n/editor/server";

export async function GET(req: Request) {
  try {
    assertDev();
    const q = new URL(req.url).searchParams;
    const source = await readElementSource(
      q.get("path") ?? "/",
      Number(q.get("sid") ?? -1),
      q.get("tag") ?? "",
      q.get("kind") ?? "page"
    );
    return NextResponse.json({ ok: true, source });
  } catch (e) {
    return apiFail(e);
  }
}
