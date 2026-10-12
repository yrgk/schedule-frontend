import type { Group, Lesson } from "@/app/_data/schedule";
import { withAppBasePath } from "@/app/_config/app";

type ScheduleLesson = Readonly<{
  end_time: string;
  homework?: string[];
  lesson_type?: string | null;
  location: string;
  location_short: string;
  start_time: string;
  teacher_name: string;
  title: string;
}>;

function isGroup(value: unknown): value is Group {
  if (!value || typeof value !== "object") {
    return false;
  }

  const group = value as Record<string, unknown>;

  return typeof group.id === "number" && typeof group.name === "string";
}

function isScheduleLesson(value: unknown): value is ScheduleLesson {
  if (!value || typeof value !== "object") {
    return false;
  }

  const lesson = value as Record<string, unknown>;

  return (
    typeof lesson.start_time === "string" &&
    typeof lesson.end_time === "string" &&
    typeof lesson.title === "string" &&
    typeof lesson.teacher_name === "string" &&
    typeof lesson.location_short === "string" &&
    typeof lesson.location === "string" &&
    (lesson.lesson_type == null || typeof lesson.lesson_type === "string") &&
    (lesson.homework === undefined || (Array.isArray(lesson.homework) && lesson.homework.every((item) => typeof item === "string")))
  );
}

function toLesson(lesson: ScheduleLesson): Lesson {
  return {
    homework: lesson.homework,
    lessonType: lesson.lesson_type ?? undefined,
    room: lesson.location_short,
    teacher: lesson.teacher_name,
    time: `${lesson.start_time} — ${lesson.end_time}`,
    title: lesson.title,
  };
}

export function formatScheduleDay(date: Date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");

  return `${day}.${month}.${date.getFullYear()}`;
}

export async function getAvailableGroups(signal: AbortSignal) {
  const response = await fetch(withAppBasePath("/api/schedule/groups"), {
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    throw new Error("Не удалось загрузить список групп.");
  }

  const data: unknown = await response.json();

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
) {
  const params = new URLSearchParams({ day });
  if (withHomework) params.set("with_hw", "true");
  const response = await fetch(
    `${withAppBasePath(`/api/schedule/${groupId}`)}?${params}`,
    {
      cache: "no-store",
      signal,
    },
  );

  if (!response.ok) {
    throw new Error("Не удалось загрузить расписание.");
  }

  const data: unknown = await response.json();

  if (!Array.isArray(data) || !data.every(isScheduleLesson)) {
    throw new Error("Сервис вернул расписание в неизвестном формате.");
  }

  return data.map(toLesson);
}
