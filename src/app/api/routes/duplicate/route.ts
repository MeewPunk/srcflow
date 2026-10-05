import { NextResponse } from "next/server";
import { assertDev, duplicateRoute } from "@/lib/routeFs";
import { apiFail } from "@/i18n/editor/server";

export async function POST(req: Request) {
  try {
    assertDev();
    const body = await req.json();
    const res = await duplicateRoute(String(body.path ?? ""));
    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    return apiFail(e);
  }
}
