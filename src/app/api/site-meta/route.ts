import { NextResponse } from "next/server";
import { assertDev } from "@/lib/routeFs";
import { readSiteMeta, writeSiteMeta, type SiteMetaByLocale } from "@/lib/siteMetaFs";
import { apiFail } from "@/i18n/editor/server";

export async function GET() {
  try {
    assertDev();
    return NextResponse.json({ ok: true, meta: await readSiteMeta() });
  } catch (e) {
    return apiFail(e);
  }
}

export async function PATCH(req: Request) {
  try {
    assertDev();
    const body = (await req.json()) as SiteMetaByLocale;
    return NextResponse.json({ ok: true, meta: await writeSiteMeta(body) });
  } catch (e) {
    return apiFail(e);
  }
}
