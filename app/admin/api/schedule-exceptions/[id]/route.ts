import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_ACCESS_COOKIE, getScheduleApiUrl } from "@/app/_lib/admin-session";

export const dynamic = "force-dynamic";

type ExceptionRouteContext = { params: Promise<{ id: string }> };

async function updateException(request: Request, { params }: ExceptionRouteContext) {
  const key = (await cookies()).get(ADMIN_ACCESS_COOKIE)?.value;
  if (!key) return NextResponse.json({ message: "Сессия истекла." }, { status: 401 });

  const { id } = await params;
  if (!/^\d+$/.test(id)) return NextResponse.json({ message: "Некорректный ID отмены." }, { status: 400 });

  const body: unknown = request.method === "PATCH"
    ? await request.json().catch(() => undefined)
    : undefined;
  if (request.method === "PATCH" && !body) return NextResponse.json({ message: "Некорректные данные." }, { status: 400 });

  const response = await fetch(getScheduleApiUrl(`/api/admin/schedule-exceptions/${id}`), {
    method: request.method,
    headers: { "Content-Type": "application/json", "X-Admin-Key": key },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  if (response.status === 204) return new NextResponse(null, { status: 204 });
  const result: unknown = await response.json().catch(() => ({}));
  return NextResponse.json(result, { status: response.status });
}

export const PATCH = updateException;
export const DELETE = updateException;
