import { NextResponse } from "next/server";
import {
  assertDev,
  createSpecialFile,
  deleteSpecialFile,
} from "@/lib/routeFs";
import type { SpecialFileId } from "@/lib/nextFileConventions";
import { apiFail } from "@/i18n/editor/server";

export async function POST(req: Request) {
  try {
    assertDev();
    const body = await req.json();
    const res = await createSpecialFile(
      String(body.path ?? ""),
      body.kind as SpecialFileId
    );
    return NextResponse.json({ ...res, ok: true });
  } catch (e) {
    return apiFail(e);
  }
}

export async function DELETE(req: Request) {
  try {
    assertDev();
    const { searchParams } = new URL(req.url);
    const path = searchParams.get("path") ?? "";
    const kind = searchParams.get("kind") as SpecialFileId;
    const res = await deleteSpecialFile(path, kind);
    return NextResponse.json({ ...res, ok: true });
  } catch (e) {
    return apiFail(e);
  }
}
