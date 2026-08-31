import {
  createScheduleApiUrl,
  proxyScheduleRequest,
} from "@/app/_lib/schedule-api-server";

export const dynamic = "force-dynamic";

export async function GET() {
  let groupsUrl: URL | null;

  try {
    groupsUrl = createScheduleApiUrl("api/schedule/groups");
  } catch {
    return Response.json(
      { message: "Некорректно задан адрес API расписания." },
      { status: 503 },
    );
  }

  if (!groupsUrl) {
    return Response.json(
      { message: "Адрес API расписания не настроен." },
      { status: 503 },
    );
  }

  return proxyScheduleRequest(groupsUrl);
}
