import { NextResponse } from "next/server";
import {
  ADMIN_ACCESS_COOKIE,
  ADMIN_GROUP_COOKIE,
  ADMIN_SESSION_MAX_AGE,
  getScheduleApiUrl,
} from "@/app/_lib/admin-session";

const cookieOptions = {
  httpOnly: true,
  maxAge: ADMIN_SESSION_MAX_AGE,
  path: "/admin",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};

export async function GET(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const groupMatch = cookieHeader.match(/(?:^|;\s*)schedule_admin_group=(\d+)/);

  if (!groupMatch) {
    return NextResponse.json({ authenticated: false });
  }

  return NextResponse.json({
    authenticated: true,
    groupId: Number(groupMatch[1]),
  });
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => undefined);
  const payload = body as { groupId?: unknown; key?: unknown } | undefined;
  const groupId = payload?.groupId;
  const key = payload?.key;

  if (!Number.isInteger(groupId) || typeof key !== "string" || !key.trim()) {
    return NextResponse.json({ message: "Укажите группу и ключ." }, { status: 400 });
  }

  const upstream = await fetch(getScheduleApiUrl("/api/admin/schedule"), {
    headers: { "X-Admin-Key": key.trim() },
    cache: "no-store",
  });
  if (!upstream.ok) {
    return NextResponse.json({ message: "Не удалось войти. Проверьте ключ группы." }, { status: upstream.status });
  }
  const schedule = await upstream.json() as { group_id?: number };
  if (schedule.group_id !== groupId) {
    return NextResponse.json({ message: "Ключ принадлежит другой группе." }, { status: 403 });
  }

  const response = NextResponse.json({ authenticated: true, groupId });
  response.cookies.set(ADMIN_ACCESS_COOKIE, key.trim(), cookieOptions);
  response.cookies.set(ADMIN_GROUP_COOKIE, String(groupId), cookieOptions);
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ authenticated: false });
  response.cookies.set(ADMIN_ACCESS_COOKIE, "", { ...cookieOptions, maxAge: 0 });
  response.cookies.set(ADMIN_GROUP_COOKIE, "", { ...cookieOptions, maxAge: 0 });
  return response;
}
