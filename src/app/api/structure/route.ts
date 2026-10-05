import { NextResponse } from "next/server";
import { assertDev } from "@/lib/routeFs";
import { writeStructure, type SNode, type NewImport } from "@/lib/structureFs";
import { apiFail } from "@/i18n/editor/server";

export async function PATCH(req: Request) {
  try {
    assertDev();
    const body = await req.json();
    const res = await writeStructure(
      String(body.path ?? "/"),
      (body.children ?? []) as SNode[],
      (body.imports ?? []) as NewImport[],
      String(body.kind ?? "page")
    );
    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    return apiFail(e);
  }
}
