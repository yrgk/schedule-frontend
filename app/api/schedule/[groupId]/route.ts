import {
  createScheduleApiUrl,
  isValidScheduleDay,
  proxyScheduleRequest,
} from "@/app/_lib/schedule-api-server";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: RouteContext<"/api/schedule/[groupId]">,
) {
  const { groupId } = await context.params;
  const day = new URL(request.url).searchParams.get("day");

  if (!/^\d+$/.test(groupId)) {
    return Response.json({ message: "Некорректная группа." }, { status: 400 });
  }

  if (!day || !isValidScheduleDay(day)) {
    return Response.json(
      { message: "Параметр day должен иметь формат ДД.ММ.ГГГГ." },
      { status: 400 },
    );
  }

  let scheduleUrl: URL | null;

  try {
    scheduleUrl = createScheduleApiUrl(`schedule/${groupId}`);
  } catch {
    return Response.json(
      { message: "Некорректно задан адрес API расписания." },
      { status: 503 },
    );
  }

  if (!scheduleUrl) {
    return Response.json(
      { message: "Адрес API расписания не настроен." },
      { status: 503 },
    );
  }

  scheduleUrl.searchParams.set("day", day);

  return proxyScheduleRequest(scheduleUrl);
}
