"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isScheduleException, type ScheduleException } from "@/app/_lib/schedule-exceptions";
import { isScheduleBanner, type ScheduleBanner } from "@/app/_lib/schedule-banners";
import type { Group } from "@/app/_data/schedule";
import { formatScheduleDay, getAvailableGroups } from "@/app/_lib/schedule-api";

type Homework = { id?: number; text: string };
type AdminLesson = {
  end_time: string;
  homework: Homework[];
  id?: number;
  lesson_id?: number;
  location_short: string | null;
  start_time: string;
  title: string;
};

type ExceptionForm = {
  scope: "day" | "lesson";
  lessonId?: number;
  exceptionId?: number;
  reason: string;
};

type BannerForm = { id?: number; text: string };

type Session = { authenticated: boolean; groupId?: number };

function toAdminLesson(value: unknown): AdminLesson | undefined {
  if (!value || typeof value !== "object") return undefined;
  const lesson = value as Record<string, unknown>;
  if (
    typeof lesson.title !== "string" ||
    typeof lesson.start_time !== "string" ||
    typeof lesson.end_time !== "string" ||
    (lesson.location_short !== null && typeof lesson.location_short !== "string")
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
  const [exceptions, setExceptions] = useState<ScheduleException[]>([]);
  const [exceptionForm, setExceptionForm] = useState<ExceptionForm>();
  const [banners, setBanners] = useState<ScheduleBanner[]>([]);
  const [bannerForm, setBannerForm] = useState<BannerForm>();
  const [loadedDay, setLoadedDay] = useState<string>();
  const loadSequence = useRef(0);
  const [drafts, setDrafts] = useState<Record<number, string>>({});

  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === session?.groupId),
    [groups, session?.groupId],
  );
  const day = formatScheduleDay(date);
  const dayCancellation = exceptions.find((item) => item.scope === "day");
  const isScheduleLoading = isLoading || loadedDay !== day;

  const loadSchedule = useCallback(async (activeGroupId: number, activeDay: string, signal?: AbortSignal) => {
    const sequence = ++loadSequence.current;
    setIsLoading(true);
    setMessage(undefined);
    try {
      const response = await fetch(`/admin/api/schedule?day=${encodeURIComponent(activeDay)}`, { cache: "no-store", signal });
      const payload: unknown = await response.json().catch(() => undefined);
      if (!response.ok) throw new Error(messageFrom(response, payload));
      if (!payload || typeof payload !== "object") throw new Error("Сервис вернул расписание в неизвестном формате.");
      const schedule = payload as Record<string, unknown>;
      if (schedule.group_id !== activeGroupId) throw new Error("Ключ принадлежит другой группе. Войдите с ключом выбранной группы.");
      if (!Array.isArray(schedule.lessons) || !Array.isArray(schedule.exceptions) || !schedule.exceptions.every(isScheduleException) || !Array.isArray(schedule.banners) || !schedule.banners.every(isScheduleBanner)) throw new Error("Сервис вернул расписание в неизвестном формате.");
      if (signal?.aborted || sequence !== loadSequence.current) return;
      setExceptions(schedule.exceptions);
      setBanners(schedule.banners);
      setLoadedDay(activeDay);
      setLessons(schedule.lessons.flatMap((item) => {
        const lesson = toAdminLesson(item);
        return lesson ? [lesson] : [];
      }));
    } catch (error) {
      if (signal?.aborted || sequence !== loadSequence.current) return;
      setLessons([]);
      setExceptions([]);
      setBanners([]);
      setLoadedDay(undefined);
      setMessage(error instanceof Error ? error.message : "Не удалось загрузить расписание.");
    } finally {
      if (!signal?.aborted && sequence === loadSequence.current) setIsLoading(false);
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
    }).catch(() => {
      if (!controller.signal.aborted) setMessage("Не удалось загрузить список групп.");
    }).finally(() => {
      if (!controller.signal.aborted) setIsLoading(false);
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    if (session?.authenticated && session.groupId) {
      void Promise.resolve().then(() => {
        if (controller.signal.aborted) return;
        setExceptionForm(undefined);
        setBannerForm(undefined);
        setDrafts({});
        return loadSchedule(session.groupId!, day, controller.signal);
      });
    }
    return () => controller.abort();
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
    setExceptions([]);
    setBanners([]);
    setBannerForm(undefined);
    setExceptionForm(undefined);
    setLoadedDay(undefined);
    setMessage(undefined);
  }

  async function saveException(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!exceptionForm || !session?.groupId || isScheduleLoading) return;
    const reason = exceptionForm.reason.trim();
    if (!reason) return setMessage("Введите причину отмены.");
    setIsSubmitting(true);
    setMessage(undefined);
    try {
      const path = exceptionForm.exceptionId
        ? `/admin/api/schedule-exceptions/${exceptionForm.exceptionId}`
        : "/admin/api/schedule-exceptions";
      const response = await fetch(path, {
        method: exceptionForm.exceptionId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(exceptionForm.exceptionId ? { reason } : {
          date: day.split(".").reverse().join("-"),
          scope: exceptionForm.scope,
          lesson_id: exceptionForm.lessonId ?? null,
          reason,
        }),
      });
      const payload: unknown = await response.json().catch(() => undefined);
      if (!response.ok) throw new Error(messageFrom(response, payload));
      setExceptionForm(undefined);
      await loadSchedule(session.groupId, day);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось сохранить отмену.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function restoreException(exceptionId: number) {
    if (!session?.groupId || isScheduleLoading) return;
    setIsSubmitting(true);
    setMessage(undefined);
    try {
      const response = await fetch(`/admin/api/schedule-exceptions/${exceptionId}`, { method: "DELETE" });
      if (!response.ok) throw new Error(messageFrom(response, await response.json().catch(() => undefined)));
      setExceptionForm(undefined);
      await loadSchedule(session.groupId, day);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось восстановить занятия.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function saveBanner(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!bannerForm || !session?.groupId || isScheduleLoading) return;
    const text = bannerForm.text.trim();
    if (!text) return setMessage("Введите текст баннера.");
    setIsSubmitting(true);
    setMessage(undefined);
    try {
      const path = bannerForm.id
        ? `/admin/api/schedule-banners/${bannerForm.id}`
        : "/admin/api/schedule-banners";
      const response = await fetch(path, {
        method: bannerForm.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bannerForm.id ? { text } : {
          date: day.split(".").reverse().join("-"), text,
        }),
      });
      const payload: unknown = await response.json().catch(() => undefined);
      if (!response.ok) throw new Error(messageFrom(response, payload));
      setBannerForm(undefined);
      await loadSchedule(session.groupId, day);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось сохранить баннер.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function deleteBanner(bannerId: number) {
    if (!session?.groupId || isScheduleLoading) return;
    setIsSubmitting(true);
    setMessage(undefined);
    try {
      const response = await fetch(`/admin/api/schedule-banners/${bannerId}`, { method: "DELETE" });
      if (!response.ok) throw new Error(messageFrom(response, await response.json().catch(() => undefined)));
      setBannerForm(undefined);
      await loadSchedule(session.groupId, day);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось удалить баннер.");
    } finally {
      setIsSubmitting(false);
    }
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
        <h1 className="text-xl font-semibold">Админка расписания</h1>
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
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-xl font-semibold">Расписание · {selectedGroup?.name ?? "группа"}</h1><p className="text-sm text-slate-500">Управляйте домашними заданиями, отменами занятий и объявлениями.</p></div><button onClick={logout} disabled={isSubmitting} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">Выйти</button></header>
        <div className="mb-4 flex items-center gap-2"><button disabled={isSubmitting} onClick={() => setDate((current) => addDays(current, -1))} className="rounded-lg border border-slate-300 bg-white px-3 py-2" aria-label="Предыдущий день">←</button><span className="min-w-32 text-center text-sm font-medium">{day}</span><button disabled={isSubmitting} onClick={() => setDate((current) => addDays(current, 1))} className="rounded-lg border border-slate-300 bg-white px-3 py-2" aria-label="Следующий день">→</button></div>
        {message && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{message}</p>}
        {!isScheduleLoading && dayCancellation ? (
          <div className="mb-4 rounded-xl bg-amber-50 p-4 text-sm ring-1 ring-amber-200">
            <p className="font-medium">Занятия на весь день отменены</p>
            <p className="mt-1 whitespace-pre-wrap break-words">{dayCancellation.reason}</p>
            <p className="mt-2 text-slate-500">После восстановления дня отдельные отмены пар продолжат действовать.</p>
            <div className="mt-3 flex gap-4">
              <button onClick={() => void restoreException(dayCancellation.id)} disabled={isSubmitting} className="font-medium text-blue-600 disabled:opacity-50">Восстановить день</button>
              <button onClick={() => setExceptionForm({ scope: "day", exceptionId: dayCancellation.id, reason: dayCancellation.reason })} disabled={isSubmitting} className="text-slate-600 disabled:opacity-50">Изменить причину</button>
            </div>
          </div>
        ) : !isScheduleLoading ? (
          <button onClick={() => setExceptionForm({ scope: "day", reason: "" })} disabled={isSubmitting} className="mb-4 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-50">Отменить занятия на весь день</button>
        ) : null}
        {exceptionForm && !isScheduleLoading ? (
          <form onSubmit={saveException} className="mb-4 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <h2 className="font-medium">{exceptionForm.exceptionId ? "Изменить причину отмены" : exceptionForm.scope === "day" ? "Отмена занятий на весь день" : `Отмена пары: ${lessons.find((lesson) => (lesson.lesson_id ?? lesson.id) === exceptionForm.lessonId)?.title ?? "пара"}`}</h2>
            <label className="mt-3 block text-sm font-medium">Причина отмены<textarea value={exceptionForm.reason} onChange={(event) => setExceptionForm((current) => current ? { ...current, reason: event.target.value } : undefined)} maxLength={1000} required rows={3} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Например, день самостоятельной работы" /></label>
            <div className="mt-3 flex gap-3"><button disabled={isSubmitting} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{isSubmitting ? "Сохраняем…" : "Сохранить"}</button><button type="button" onClick={() => setExceptionForm(undefined)} disabled={isSubmitting} className="px-3 py-2 text-sm text-slate-500">Закрыть</button></div>
          </form>
        ) : null}
        {!isScheduleLoading ? (
          <section aria-labelledby="banners-title" className="mb-4 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="banners-title" className="font-medium">Баннеры дня</h2><button onClick={() => setBannerForm({ text: "" })} disabled={isSubmitting} className="text-sm font-medium text-blue-600 disabled:opacity-50">Добавить баннер</button></div>
            <p className="mt-2 text-sm text-slate-500">{dayCancellation ? "Баннеры скрыты от студентов, пока весь день отменён." : "Сообщения появятся над расписанием выбранного дня."}</p>
            {banners.length > 0 ? <ul className="mt-3 space-y-3">{banners.map((banner) => (
              <li key={banner.id} className="rounded-lg bg-slate-50 p-3">
                <p className="whitespace-pre-wrap break-words text-sm">{banner.text}</p>
                <div className="mt-2 flex gap-4 text-sm"><button onClick={() => setBannerForm({ id: banner.id, text: banner.text })} disabled={isSubmitting} className="text-blue-600 disabled:opacity-50">Изменить</button><button onClick={() => void deleteBanner(banner.id)} disabled={isSubmitting} className="text-red-600 disabled:opacity-50">Удалить</button></div>
              </li>
            ))}</ul> : null}
            {bannerForm ? (
              <form onSubmit={saveBanner} className="mt-4 border-t border-slate-200 pt-4">
                <h3 className="text-sm font-medium">{bannerForm.id ? "Изменить баннер" : "Новый баннер"}</h3>
                <label className="mt-3 block text-sm font-medium">Текст баннера<textarea value={bannerForm.text} onChange={(event) => setBannerForm((current) => current ? { ...current, text: event.target.value } : undefined)} maxLength={2000} required rows={3} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Опишите изменения в расписании или произошедшее" /></label>
                <div className="mt-3 flex gap-3"><button disabled={isSubmitting} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{isSubmitting ? "Сохраняем…" : "Сохранить баннер"}</button><button type="button" onClick={() => setBannerForm(undefined)} disabled={isSubmitting} className="px-3 py-2 text-sm text-slate-500">Закрыть</button></div>
              </form>
            ) : null}
          </section>
        ) : null}
        <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          <table className="w-full min-w-[42.5rem] border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-slate-500"><tr><th className="w-32 px-4 py-3 font-medium">Время</th><th className="px-4 py-3 font-medium">Пара и ДЗ</th></tr></thead>
            <tbody>{isScheduleLoading ? <tr><td colSpan={2} className="px-4 py-8 text-center text-slate-500">{isLoading ? "Загружаем…" : "Расписание недоступно."}</td></tr> : lessons.length === 0 ? <tr><td colSpan={2} className="px-4 py-8 text-center text-slate-500">Пар на этот день нет.</td></tr> : lessons.map((lesson, lessonIndex) => {
              const lessonId = lesson.lesson_id ?? lesson.id;
              const cancellation = exceptions.find((item) => item.scope === "lesson" && item.lesson_id === lessonId);
              return (
                <tr className={`border-t border-slate-200 align-top${dayCancellation || cancellation ? " bg-slate-50" : ""}`} key={`${lesson.start_time}-${lessonIndex}`}>
                  <td className="px-4 py-4 tabular-nums text-slate-500">{lesson.start_time}<br />{lesson.end_time}</td>
                  <td className="px-4 py-4">
                    <p className="font-medium">{lesson.title}{dayCancellation || cancellation ? <span className="ml-2 text-amber-700">Отменена</span> : null}</p>
                    <p className="mt-0.5 text-slate-500">{lesson.location_short}</p>
                    {cancellation ? <p className="mt-2 whitespace-pre-wrap break-words text-amber-700">{cancellation.reason}</p> : null}
                    <div className="mt-2 flex gap-4">
                      {cancellation ? <>
                        <button onClick={() => void restoreException(cancellation.id)} disabled={isSubmitting} className="text-blue-600 disabled:opacity-50">Снять отмену пары</button>
                        <button onClick={() => setExceptionForm({ scope: "lesson", lessonId, exceptionId: cancellation.id, reason: cancellation.reason })} disabled={isSubmitting} className="text-slate-500 disabled:opacity-50">Изменить причину</button>
                      </> : <button onClick={() => setExceptionForm({ scope: "lesson", lessonId, reason: "" })} disabled={isSubmitting || !!dayCancellation || !lessonId} className="text-red-600 disabled:opacity-50">Отменить пару</button>}
                    </div>
                    <ul className="mt-3 space-y-2">{lesson.homework.map((item, index) => <li className="flex items-start justify-between gap-3 rounded-md bg-slate-50 px-3 py-2" key={`${item.id ?? item.text}-${index}`}><span>{item.text}</span>{item.id ? <button onClick={() => void deleteHomework(item.id!, lessonIndex)} disabled={isSubmitting} className="shrink-0 text-sm text-red-600 disabled:opacity-50">Удалить</button> : <span className="shrink-0 text-xs text-slate-400">без ID</span>}</li>)}</ul>
                    <div className="mt-3 flex gap-2"><input value={drafts[lessonIndex] ?? ""} onChange={(event) => setDrafts((current) => ({ ...current, [lessonIndex]: event.target.value }))} className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2" placeholder="Текст задания" /><button onClick={() => void createHomework(lesson, lessonIndex)} disabled={isSubmitting} className="rounded-md bg-blue-600 px-3 py-2 text-white disabled:opacity-50">Добавить</button></div>
                  </td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
