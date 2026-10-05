import { NextResponse } from "next/server";
import {
  assertDev,
  createRoute,
  deleteRoute,
  renameRoute,
  scanRoutes,
  updateMeta,
  type MetaFields,
} from "@/lib/routeFs";
import { apiFail } from "@/i18n/editor/server";

export async function GET() {
  try {
    assertDev();
    return NextResponse.json({ ok: true, routes: await scanRoutes() });
  } catch (e) {
    return apiFail(e);
  }
}

export async function POST(req: Request) {
  try {
    assertDev();
    const body = await req.json();
    const meta: MetaFields = body.meta ?? {};
    const res = await createRoute(String(body.path ?? ""), meta);
    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    return apiFail(e);
  }
}

export async function PATCH(req: Request) {
  try {
    assertDev();
    const body = await req.json();
    const path = String(body.path ?? "");
    let current = path;
    if (body.newPath && body.newPath !== path) {
      const r = await renameRoute(path, String(body.newPath));
      current = String(body.newPath);
      if (!body.meta) return NextResponse.json({ ok: true, ...r });
    }
    if (body.meta) {
      const r = await updateMeta(current, body.meta as MetaFields);
      return NextResponse.json({ ok: true, ...r });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiFail(e);
  }
}

export async function DELETE(req: Request) {
  try {
    assertDev();
    const { searchParams } = new URL(req.url);
    const path = searchParams.get("path") ?? "";
    const res = await deleteRoute(path);
    return NextResponse.json({ ...res, ok: true });
  } catch (e) {
    return apiFail(e);
  }
}
