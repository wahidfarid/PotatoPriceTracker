import { timingSafeEqual } from "crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const provided = request.headers.get("x-revalidate-secret") ?? "";
  const expected = process.env.REVALIDATION_SECRET ?? "";

  if (
    !expected ||
    provided.length !== expected.length ||
    !timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
  ) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
  }

  revalidateTag("dashboard-data", "default");
  revalidatePath("/");
  return NextResponse.json({ revalidated: true });
}
