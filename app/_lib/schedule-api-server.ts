import "server-only";

const scheduleDayPattern = /^\d{2}\.\d{2}\.\d{4}$/;

export function createScheduleApiUrl(path: string) {
  const baseUrl = process.env.SCHEDULE_API_BASE_URL;

  if (!baseUrl) {
    return null;
  }

  return new URL(path, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
}

export function isValidScheduleDay(day: string) {
  if (!scheduleDayPattern.test(day)) {
    return false;
  }

  const [dayPart, monthPart, yearPart] = day.split(".").map(Number);
  const date = new Date(yearPart, monthPart - 1, dayPart);

  return (
    date.getFullYear() === yearPart &&
    date.getMonth() === monthPart - 1 &&
    date.getDate() === dayPart
  );
}

export async function proxyScheduleRequest(url: URL) {
  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      return Response.json(
        { message: "Не удалось получить расписание." },
        { status: response.status },
      );
    }

    return Response.json(await response.json(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json(
      { message: "Сервис расписания временно недоступен." },
      { status: 502 },
    );
  }
}
