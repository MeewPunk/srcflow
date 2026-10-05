import { NextResponse } from "next/server";
import { assertDev } from "@/lib/routeFs";
import { writeElementClass } from "@/lib/elementFs";
import { apiFail } from "@/i18n/editor/server";

export async function PATCH(req: Request) {
  try {
    assertDev();
    const body = await req.json();
    const res = await writeElementClass(
      String(body.path ?? "/"),
      Number(body.sid ?? -1),
      String(body.origClass ?? ""),
      String(body.newClass ?? ""),
      String(body.tag ?? ""),
      String(body.kind ?? "page")
    );
    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    return apiFail(e);
  }
}
