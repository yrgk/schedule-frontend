"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { Group } from "@/app/_data/schedule";
import { formatScheduleDay, getAvailableGroups } from "@/app/_lib/schedule-api";

type Homework = { id?: number; text: string };
type AdminLesson = {
  end_time: string;
  homework: Homework[];
  id?: number;
  lesson_id?: number;
  location_short: string;
  start_time: string;
  title: string;
};

type Session = { authenticated: boolean; groupId?: number };

function toAdminLesson(value: unknown): AdminLesson | undefined {
  if (!value || typeof value !== "object") return undefined;
  const lesson = value as Record<string, unknown>;
  if (
    typeof lesson.title !== "string" ||
    typeof lesson.start_time !== "string" ||
    typeof lesson.end_time !== "string" ||
    typeof lesson.location_short !== "string"
  ) return undefined;
  const homework = Array.isArray(lesson.homework)
    ? lesson.homework.flatMap((item) => {
        if (typeof item === "string") return [{ text: item }];
        if (item && typeof item === "object") {
          const task = item as Record<string, unknown>;
          if (typeof task.text === "string") {
            return [{ id: typeof task.id === "number" ? task.id : undefined, text: task.text }];
          }
        }
        return [];
      })
    : [];
  return {
    end_time: lesson.end_time,
    homework,
    id: typeof lesson.id === "number" ? lesson.id : undefined,
    lesson_id: typeof lesson.lesson_id === "number" ? lesson.lesson_id : undefined,
    location_short: lesson.location_short,
    start_time: lesson.start_time,
    title: lesson.title,
  };
}

function messageFrom(response: Response, data: unknown) {
  if (data && typeof data === "object" && "detail" in data && typeof data.detail === "string") return data.detail;
  if (data && typeof data === "object" && "message" in data && typeof data.message === "string") return data.message;
  if (response.status === 401) return "Ключ не подошёл или сессия истекла.";
  return "Не удалось выполнить действие. Попробуйте ещё раз.";
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

export function AdminApp() {
  const [groups, setGroups] = useState<readonly Group[]>([]);
  const [session, setSession] = useState<Session>();
  const [groupId, setGroupId] = useState<number>();
  const [key, setKey] = useState("");
  const [date, setDate] = useState(() => new Date());
  const [lessons, setLessons] = useState<AdminLesson[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string>();
  const [drafts, setDrafts] = useState<Record<number, string>>({});

  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === session?.groupId),
    [groups, session?.groupId],
  );
  const day = formatScheduleDay(date);

  const loadSchedule = useCallback(async (activeGroupId: number, activeDay: string) => {
    setIsLoading(true);
    setMessage(undefined);
    try {
      const response = await fetch(`/api/schedule/${activeGroupId}?day=${encodeURIComponent(activeDay)}&with_hw=true`, { cache: "no-store" });
      const payload: unknown = await response.json().catch(() => undefined);
      if (!response.ok) throw new Error(messageFrom(response, payload));
      if (!Array.isArray(payload)) throw new Error("Сервис вернул расписание в неизвестном формате.");
      setLessons(payload.flatMap((item) => {
        const lesson = toAdminLesson(item);
        return lesson ? [lesson] : [];
      }));
    } catch (error) {
      setLessons([]);
      setMessage(error instanceof Error ? error.message : "Не удалось загрузить расписание.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([
      getAvailableGroups(controller.signal),
      fetch("/admin/api/session", { signal: controller.signal }).then((response) => response.json() as Promise<Session>),
    ]).then(([availableGroups, savedSession]) => {
      setGroups(availableGroups);
      setSession(savedSession);
      setGroupId(savedSession.groupId ?? availableGroups[0]?.id);
    }).catch(() => setMessage("Не удалось загрузить список групп.")).finally(() => setIsLoading(false));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (session?.authenticated && session.groupId) {
      void Promise.resolve().then(() => loadSchedule(session.groupId!, day));
    }
  }, [day, loadSchedule, session?.authenticated, session?.groupId]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!groupId || !key.trim()) return setMessage("Выберите группу и введите ключ.");
    setIsSubmitting(true);
    setMessage(undefined);
    try {
      const response = await fetch("/admin/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId, key }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) throw new Error(messageFrom(response, payload));
      setKey("");
      setSession(payload as Session);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось войти.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function logout() {
    await fetch("/admin/api/session", { method: "DELETE" });
    setSession({ authenticated: false });
    setLessons([]);
    setMessage(undefined);
  }

  async function createHomework(lesson: AdminLesson, lessonIndex: number) {
    const text = drafts[lessonIndex]?.trim();
    const lessonId = lesson.lesson_id ?? lesson.id;
    if (!text) return setMessage("Введите текст задания.");
    if (!lessonId) return setMessage("Сервер расписания не передал ID пары: добавить ДЗ пока нельзя.");
    setIsSubmitting(true);
    setMessage(undefined);
    try {
      const response = await fetch("/admin/api/homework", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, deadline: day, lesson_id: lessonId }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) throw new Error(messageFrom(response, payload));
      const task = payload as { id: number; text: string };
      setLessons((current) => current.map((currentLesson, index) => index === lessonIndex ? { ...currentLesson, homework: [...currentLesson.homework, task] } : currentLesson));
      setDrafts((current) => ({ ...current, [lessonIndex]: "" }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось добавить ДЗ.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function deleteHomework(homeworkId: number, lessonIndex: number) {
    setIsSubmitting(true);
    setMessage(undefined);
    try {
      const response = await fetch(`/admin/api/homework/${homeworkId}`, { method: "DELETE" });
      if (!response.ok) throw new Error(messageFrom(response, await response.json().catch(() => undefined)));
      setLessons((current) => current.map((lesson, index) => index === lessonIndex ? { ...lesson, homework: lesson.homework.filter((item) => item.id !== homeworkId) } : lesson));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось удалить ДЗ.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!session?.authenticated) return (
    <main className="min-h-dvh bg-slate-100 px-4 py-12 text-slate-900">
      <form onSubmit={login} className="mx-auto w-full max-w-sm rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h1 className="text-xl font-semibold">Админка ДЗ</h1>
        <p className="mt-2 text-sm leading-5 text-slate-500">Войдите ключом своей группы. Доступ сохранится на 14 дней.</p>
        <label className="mt-6 block text-sm font-medium">Группа<select value={groupId ?? ""} onChange={(event) => setGroupId(Number(event.target.value))} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5" required><option value="" disabled>Выберите группу</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
        <label className="mt-4 block text-sm font-medium">Ключ группы<input value={key} onChange={(event) => setKey(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" type="password" autoComplete="current-password" required /></label>
        {message && <p className="mt-4 text-sm text-red-600" role="alert">{message}</p>}
        <button disabled={isSubmitting || isLoading} className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white disabled:opacity-60">{isSubmitting ? "Входим…" : "Войти"}</button>
      </form>
    </main>
  );

  return (
    <main className="min-h-dvh bg-slate-100 p-4 text-slate-900 sm:p-8">
      <section className="mx-auto max-w-4xl">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-xl font-semibold">ДЗ · {selectedGroup?.name ?? "группа"}</h1><p className="text-sm text-slate-500">Добавляйте несколько заданий к каждой паре.</p></div><button onClick={logout} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">Выйти</button></header>
        <div className="mb-4 flex items-center gap-2"><button onClick={() => setDate((current) => addDays(current, -1))} className="rounded-lg border border-slate-300 bg-white px-3 py-2" aria-label="Предыдущий день">←</button><span className="min-w-32 text-center text-sm font-medium">{day}</span><button onClick={() => setDate((current) => addDays(current, 1))} className="rounded-lg border border-slate-300 bg-white px-3 py-2" aria-label="Следующий день">→</button></div>
        {message && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{message}</p>}
        <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200"><table className="w-full min-w-[42.5rem] border-collapse text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr><th className="w-32 px-4 py-3 font-medium">Время</th><th className="px-4 py-3 font-medium">Пара и ДЗ</th></tr></thead><tbody>{isLoading ? <tr><td colSpan={2} className="px-4 py-8 text-center text-slate-500">Загружаем…</td></tr> : lessons.length === 0 ? <tr><td colSpan={2} className="px-4 py-8 text-center text-slate-500">Пар на этот день нет.</td></tr> : lessons.map((lesson, lessonIndex) => <tr className="border-t border-slate-200 align-top" key={`${lesson.start_time}-${lessonIndex}`}><td className="px-4 py-4 tabular-nums text-slate-500">{lesson.start_time}<br />{lesson.end_time}</td><td className="px-4 py-4"><p className="font-medium">{lesson.title}</p><p className="mt-0.5 text-slate-500">{lesson.location_short}</p><ul className="mt-3 space-y-2">{lesson.homework.map((item, index) => <li className="flex items-start justify-between gap-3 rounded-md bg-slate-50 px-3 py-2" key={`${item.id ?? item.text}-${index}`}><span>{item.text}</span>{item.id ? <button onClick={() => void deleteHomework(item.id!, lessonIndex)} disabled={isSubmitting} className="shrink-0 text-sm text-red-600 disabled:opacity-50">Удалить</button> : <span className="shrink-0 text-xs text-slate-400">без ID</span>}</li>)}</ul><div className="mt-3 flex gap-2"><input value={drafts[lessonIndex] ?? ""} onChange={(event) => setDrafts((current) => ({ ...current, [lessonIndex]: event.target.value }))} className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2" placeholder="Текст задания" /><button onClick={() => void createHomework(lesson, lessonIndex)} disabled={isSubmitting} className="rounded-md bg-blue-600 px-3 py-2 text-white disabled:opacity-50">Добавить</button></div></td></tr>)}</tbody></table></div>
      </section>
    </main>
  );
}
