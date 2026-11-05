export type ScheduleBanner = Readonly<{
  id: number;
  text: string;
}>;

export function isScheduleBanner(value: unknown): value is ScheduleBanner {
  if (!value || typeof value !== "object") return false;
  const banner = value as Record<string, unknown>;
  return typeof banner.id === "number" && typeof banner.text === "string";
}
