export const ADMIN_ACCESS_COOKIE = "schedule_admin_access";
export const ADMIN_GROUP_COOKIE = "schedule_admin_group";
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 24 * 14;

export function getScheduleApiUrl(path: string) {
  const baseUrl = process.env.SCHEDULE_API_BASE_URL?.replace(/\/$/, "");

  if (!baseUrl) {
    throw new Error("SCHEDULE_API_BASE_URL is not configured");
  }

  return `${baseUrl}${path}`;
}
