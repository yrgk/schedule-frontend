import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_ACCESS_COOKIE, getScheduleApiUrl } from "@/app/_lib/admin-session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const key = (await cookies()).get(ADMIN_ACCESS_COOKIE)?.value;
  if (!key) return NextResponse.json({ message: "Сессия истекла." }, { status: 401 });

  const day = new URL(request.url).searchParams.get("day");
  const params = new URLSearchParams();
  if (day) params.set("day", day);
  const response = await fetch(getScheduleApiUrl(`/api/admin/schedule?${params}`), {
    headers: { "X-Admin-Key": key },
    cache: "no-store",
  });
  const body: unknown = await response.json().catch(() => ({}));
  return NextResponse.json(body, { status: response.status });
}
