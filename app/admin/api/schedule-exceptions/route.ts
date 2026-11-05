import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_ACCESS_COOKIE, getScheduleApiUrl } from "@/app/_lib/admin-session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const key = (await cookies()).get(ADMIN_ACCESS_COOKIE)?.value;
  if (!key) return NextResponse.json({ message: "Сессия истекла." }, { status: 401 });

  const body: unknown = await request.json().catch(() => undefined);
  if (!body) return NextResponse.json({ message: "Некорректные данные." }, { status: 400 });

  const response = await fetch(getScheduleApiUrl("/api/admin/schedule-exceptions"), {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Admin-Key": key },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const result: unknown = await response.json().catch(() => ({}));
  return NextResponse.json(result, { status: response.status });
}
