export type ScheduleException = Readonly<{
  id: number;
  date: string;
  scope: "day" | "lesson";
  lesson_id: number | null;
  reason: string;
}>;

export function isScheduleException(value: unknown): value is ScheduleException {
  if (!value || typeof value !== "object") return false;
  const exception = value as Record<string, unknown>;
  return (
    typeof exception.id === "number" &&
    typeof exception.date === "string" &&
    typeof exception.reason === "string" &&
    ((exception.scope === "day" && exception.lesson_id === null) ||
      (exception.scope === "lesson" && typeof exception.lesson_id === "number"))
  );
}
