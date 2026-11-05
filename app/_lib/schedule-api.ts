import { withAppBasePath } from "@/app/_config/app";
import type { Group, Homework, Lesson } from "@/app/_data/schedule";
import { isScheduleBanner, type ScheduleBanner } from "@/app/_lib/schedule-banners";

export type DaySchedule = Readonly<{
  lessons: readonly Lesson[];
  dayCancellation: Readonly<{ reason: string }> | null;
  banners: readonly ScheduleBanner[];
  time: Readonly<{
    past: readonly Lesson[];
    current: Lesson | null;
    upcoming: readonly Lesson[];
  }> | null;
}>;

const SCHEDULE_API_BASE_PATH = withAppBasePath("/api/schedule");

type ScheduleLesson = Readonly<{
  id: number;
  lesson_id: number;
  end_time: string;
  homework?: Homework[];
  lesson_type?: string | null;
  location: string;
  location_short: string | null;
  start_time: string;
  teacher_name: string | null;
  title: string;
}>;

function isGroup(value: unknown): value is Group {
  if (!value || typeof value !== "object") {
    return false;
  }

  const group = value as Record<string, unknown>;

  return typeof group.id === "number" && typeof group.name === "string";
}

async function readJson(response: Response): Promise<unknown> {
  const body = await response.text();

  if (!body) {
    throw new Error("Сервис вернул пустой ответ.");
  }

  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new Error("Сервис вернул ответ в неизвестном формате.");
  }
}

function isScheduleLesson(value: unknown): value is ScheduleLesson {
  if (!value || typeof value !== "object") {
    return false;
  }

  const lesson = value as Record<string, unknown>;

  return (
    typeof lesson.id === "number" &&
    typeof lesson.lesson_id === "number" &&
    typeof lesson.start_time === "string" &&
    typeof lesson.end_time === "string" &&
    typeof lesson.title === "string" &&
    (lesson.teacher_name === null || typeof lesson.teacher_name === "string") &&
    (lesson.location_short === null || typeof lesson.location_short === "string") &&
    typeof lesson.location === "string" &&
    (lesson.lesson_type == null || typeof lesson.lesson_type === "string") &&
    (lesson.homework === undefined ||
      (Array.isArray(lesson.homework) &&
        lesson.homework.every(
          (item) =>
            !!item &&
            typeof item === "object" &&
            typeof item.id === "number" &&
            typeof item.text === "string",
        )))
  );
}

function toLesson(lesson: ScheduleLesson): Lesson {
  return {
    id: lesson.id,
    lessonId: lesson.lesson_id,
    homework: lesson.homework,
    lessonType: lesson.lesson_type ?? undefined,
    room: lesson.location_short ?? lesson.location,
    teacher: lesson.teacher_name ?? "",
    time: `${lesson.start_time} — ${lesson.end_time}`,
    title: lesson.title,
  };
}

type ScheduleTime = Readonly<{
  past: ScheduleLesson[];
  current: ScheduleLesson | null;
  upcoming: ScheduleLesson[];
}>;

function isScheduleTime(value: unknown): value is ScheduleTime {
  if (!value || typeof value !== "object") return false;
  const time = value as Record<string, unknown>;
  return (
    Array.isArray(time.past) && time.past.every(isScheduleLesson) &&
    (time.current === null || isScheduleLesson(time.current)) &&
    Array.isArray(time.upcoming) && time.upcoming.every(isScheduleLesson)
  );
}

export function formatScheduleDay(date: Date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");

  return `${day}.${month}.${date.getFullYear()}`;
}

export async function getAvailableGroups(signal: AbortSignal) {
  const response = await fetch(`${SCHEDULE_API_BASE_PATH}/groups`, {
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    throw new Error("Не удалось загрузить список групп.");
  }

  const data = await readJson(response);

  if (!Array.isArray(data) || !data.every(isGroup)) {
    throw new Error("Сервис вернул список групп в неизвестном формате.");
  }

  return data;
}

export async function getScheduleForDay(
  groupId: number,
  day: string,
  signal: AbortSignal,
  withHomework: boolean,
  withTime = false,
): Promise<DaySchedule> {
  const params = new URLSearchParams({
    day,
    with_hw: String(withHomework),
    with_time: String(withTime),
  });
  const response = await fetch(
    `${SCHEDULE_API_BASE_PATH}/v2/${groupId}?${params}`,
    {
      cache: "no-store",
      signal,
    },
  );

  if (response.status === 404) {
    return { lessons: [], dayCancellation: null, banners: [], time: null };
  }
  if (!response.ok) {
    throw new Error("Не удалось загрузить расписание.");
  }

  const data = await readJson(response);

  if (!data || typeof data !== "object") {
    throw new Error("Сервис вернул расписание в неизвестном формате.");
  }
  const schedule = data as Record<string, unknown>;
  if (
    !Array.isArray(schedule.lessons) || !schedule.lessons.every(isScheduleLesson) ||
    (schedule.day_cancellation !== null && (
      typeof schedule.day_cancellation !== "object" ||
      !("reason" in schedule.day_cancellation) ||
      typeof schedule.day_cancellation.reason !== "string"
    )) ||
    !Array.isArray(schedule.banners) || !schedule.banners.every(isScheduleBanner) ||
    (schedule.time != null && !isScheduleTime(schedule.time))
  ) {
    throw new Error("Сервис вернул расписание в неизвестном формате.");
  }
  return {
    lessons: schedule.lessons.map(toLesson),
    dayCancellation: schedule.day_cancellation as DaySchedule["dayCancellation"],
    banners: schedule.banners,
    time: schedule.time == null ? null : {
      past: schedule.time.past.map(toLesson),
      current: schedule.time.current === null ? null : toLesson(schedule.time.current),
      upcoming: schedule.time.upcoming.map(toLesson),
    },
  };
}
