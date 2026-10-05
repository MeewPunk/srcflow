import { NextResponse } from "next/server";
import { assertDev } from "@/lib/routeFs";
import { writeElementText } from "@/lib/elementFs";
import { apiFail } from "@/i18n/editor/server";

export async function PATCH(req: Request) {
  try {
    assertDev();
    const body = await req.json();
    const res = await writeElementText(
      String(body.path ?? "/"),
      Number(body.sid ?? -1),
      String(body.newText ?? ""),
      String(body.tag ?? ""),
      String(body.origText ?? ""),
      String(body.kind ?? "page"),
      String(body.lang ?? "")
    );
    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    return apiFail(e);
  }
}
