import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_ACCESS_COOKIE, getScheduleApiUrl } from "@/app/_lib/admin-session";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: RouteContext<"/admin/api/homework/[id]">,
) {
  const key = (await cookies()).get(ADMIN_ACCESS_COOKIE)?.value;
  if (!key) return NextResponse.json({ message: "Сессия истекла." }, { status: 401 });

  const { id } = await params;
  if (!/^\d+$/.test(id)) return NextResponse.json({ message: "Некорректный ID ДЗ." }, { status: 400 });

  const response = await fetch(getScheduleApiUrl(`/api/homework/${id}`), {
    method: "DELETE",
    headers: { "X-Admin-Key": key },
    cache: "no-store",
  });

  if (response.status === 204) return new NextResponse(null, { status: 204 });
  const body: unknown = await response.json().catch(() => ({}));
  return NextResponse.json(body, { status: response.status });
}
