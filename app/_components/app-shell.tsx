"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type WheelEvent,
} from "react";
import type { Lesson } from "@/app/_data/schedule";
import {
  formatScheduleDay,
  getScheduleForDay,
} from "@/app/_lib/schedule-api";
import { impactOccurred } from "@/app/_lib/telegram-web-app";

const DAYS_IN_WEEK = 7;
const MOUSE_DRAG_THRESHOLD = 8;
const SCROLL_END_DELAY = 120;
const WHEEL_SCROLL_MULTIPLIER = 0.45;

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
});

const monthFormatter = new Intl.DateTimeFormat("ru-RU", { month: "long" });
const weekdayFormatter = new Intl.DateTimeFormat("ru-RU", { weekday: "long" });
const shortWeekdayFormatter = new Intl.DateTimeFormat("ru-RU", {
  weekday: "short",
});

type SwipeDirection = -1 | 1;

type ScheduleState = Readonly<{
  selectedDate: Date;
  visibleWeekStart: Date;
}>;

type ScheduleAction =
  | Readonly<{ type: "change-day"; direction: SwipeDirection }>
  | Readonly<{ type: "change-week"; direction: SwipeDirection }>
  | Readonly<{ type: "select-date"; date: Date }>;

type ScheduleData =
  | Readonly<{ day: string; status: "error" }>
  | Readonly<{
      day: string;
      lessons: readonly Lesson[];
      status: "success";
    }>;

function getStartOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, amount: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + amount);

  return nextDate;
}

function getStartOfWeek(date: Date) {
  const day = date.getDay() || DAYS_IN_WEEK;

  return addDays(date, 1 - day);
}

function isSameDay(firstDate: Date, secondDate: Date) {
  return (
    firstDate.getFullYear() === secondDate.getFullYear() &&
    firstDate.getMonth() === secondDate.getMonth() &&
    firstDate.getDate() === secondDate.getDate()
  );
}

function capitalize(value: string) {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}

function getWeekDays(firstDay: Date) {
  return Array.from({ length: DAYS_IN_WEEK }, (_, index) => {
    const date = addDays(firstDay, index);

    return {
      date,
      day: date.getDate(),
      fullWeekday: capitalize(weekdayFormatter.format(date)),
      shortWeekday: shortWeekdayFormatter
        .format(date)
        .replace(".", "")
        .toUpperCase(),
    };
  });
}

function getCalendarTitle(weekDays: readonly { date: Date }[]) {
  const firstDay = weekDays.at(0)?.date;
  const lastDay = weekDays.at(-1)?.date;

  if (!firstDay || !lastDay) {
    return "";
  }

  const firstMonth = monthFormatter.format(firstDay);
  const lastMonth = monthFormatter.format(lastDay);

  return firstMonth === lastMonth
    ? capitalize(firstMonth)
    : `${capitalize(firstMonth)} — ${capitalize(lastMonth)}`;
}

function createInitialScheduleState(): ScheduleState {
  const selectedDate = getStartOfDay(new Date());

  return {
    selectedDate,
    visibleWeekStart: getStartOfWeek(selectedDate),
  };
}

function scheduleReducer(
  state: ScheduleState,
  action: ScheduleAction,
): ScheduleState {
  switch (action.type) {
    case "select-date":
      return { ...state, selectedDate: getStartOfDay(action.date) };
    case "change-day": {
      const selectedDate = addDays(state.selectedDate, action.direction);

      return {
        selectedDate,
        visibleWeekStart: getStartOfWeek(selectedDate),
      };
    }
    case "change-week":
      return {
        ...state,
        visibleWeekStart: addDays(
          state.visibleWeekStart,
          action.direction * DAYS_IN_WEEK,
        ),
      };
  }
}

type AppShellProps = Readonly<{
  groupId: number;
  groupName: string;
  onChangeGroup: () => void;
}>;

type HorizontalPagerProps = Readonly<{
  ariaLabel: string;
  children: ReactNode;
  className: string;
  pageKey: string;
  onPageChange: (direction: SwipeDirection) => void;
}>;

function HorizontalPager({
  ariaLabel,
  children,
  className,
  pageKey,
  onPageChange,
}: HorizontalPagerProps) {
  const pagerRef = useRef<HTMLDivElement>(null);
  const scrollEndTimeout = useRef<number | undefined>(undefined);
  const pointerStart = useRef<{ pointerId: number; scrollLeft: number; x: number } | null>(
    null,
  );
  const hasDragged = useRef(false);
  const shouldIgnoreClick = useRef(false);
  const isPageChangePending = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  const clearScrollEndTimeout = useCallback(() => {
    if (scrollEndTimeout.current) {
      window.clearTimeout(scrollEndTimeout.current);
      scrollEndTimeout.current = undefined;
    }
  }, []);

  const releasePageChangeLock = useCallback(() => {
    isPageChangePending.current = false;
    scrollEndTimeout.current = undefined;
  }, []);

  const deferPageChangeLockRelease = useCallback(() => {
    clearScrollEndTimeout();
    scrollEndTimeout.current = window.setTimeout(
      releasePageChangeLock,
      SCROLL_END_DELAY,
    );
  }, [clearScrollEndTimeout, releasePageChangeLock]);

  useLayoutEffect(() => {
    const pager = pagerRef.current;

    if (!pager) {
      return;
    }

    pager.scrollLeft = pager.clientWidth;

    if (isPageChangePending.current) {
      deferPageChangeLockRelease();
    }
  }, [deferPageChangeLockRelease, pageKey]);

  useEffect(() => {
    return () => {
      clearScrollEndTimeout();
    };
  }, [clearScrollEndTimeout]);

  const settlePage = () => {
    const pager = pagerRef.current;

    if (!pager || isPageChangePending.current) {
      return;
    }

    const pageWidth = pager.clientWidth;

    if (!pageWidth) {
      return;
    }

    if (pager.scrollLeft < pageWidth * 0.5) {
      isPageChangePending.current = true;
      onPageChange(-1);
      return;
    }

    if (pager.scrollLeft > pageWidth * 1.5) {
      isPageChangePending.current = true;
      onPageChange(1);
    }
  };

  const handleScroll = () => {
    if (isPageChangePending.current) {
      const pager = pagerRef.current;

      if (pager) {
        pager.scrollLeft = pager.clientWidth;
      }

      deferPageChangeLockRelease();
      return;
    }

    clearScrollEndTimeout();
    scrollEndTimeout.current = window.setTimeout(settlePage, SCROLL_END_DELAY);
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (
      event.pointerType !== "mouse" ||
      event.button !== 0 ||
      !event.isPrimary
    ) {
      return;
    }

    pointerStart.current = {
      pointerId: event.pointerId,
      scrollLeft: event.currentTarget.scrollLeft,
      x: event.clientX,
    };
    hasDragged.current = false;
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = pointerStart.current;

    if (!start || start.pointerId !== event.pointerId) {
      return;
    }

    const distance = event.clientX - start.x;

    if (Math.abs(distance) > MOUSE_DRAG_THRESHOLD) {
      if (!hasDragged.current) {
        event.currentTarget.setPointerCapture(event.pointerId);
      }

      hasDragged.current = true;
      setIsDragging(true);
      event.preventDefault();
    }

    if (!hasDragged.current) {
      return;
    }

    event.currentTarget.scrollLeft = start.scrollLeft - distance;
  };

  const finishPointerDrag = (event: PointerEvent<HTMLDivElement>) => {
    const start = pointerStart.current;

    if (!start || start.pointerId !== event.pointerId) {
      return;
    }

    pointerStart.current = null;
    setIsDragging(false);

    if (hasDragged.current) {
      shouldIgnoreClick.current = true;
      window.setTimeout(() => {
        shouldIgnoreClick.current = false;
      }, 0);
    }
  };

  const handlePointerCancel = () => {
    pointerStart.current = null;
    setIsDragging(false);
  };

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (!event.shiftKey || event.deltaY === 0) {
      return;
    }

    event.preventDefault();
    event.currentTarget.scrollLeft += event.deltaY * WHEEL_SCROLL_MULTIPLIER;
  };

  return (
    <div
      aria-label={ariaLabel}
      className={`horizontal-pager ${className}`}
      data-dragging={isDragging || undefined}
      onClickCapture={(event) => {
        if (!shouldIgnoreClick.current) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
      }}
      onPointerCancel={handlePointerCancel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishPointerDrag}
      onScroll={handleScroll}
      onWheel={handleWheel}
      ref={pagerRef}
      role="region"
    >
      {children}
    </div>
  );
}

export function AppShell({ groupId, groupName, onChangeGroup }: AppShellProps) {
  const [schedule, dispatch] = useReducer(
    scheduleReducer,
    undefined,
    createInitialScheduleState,
  );
  const selectedScheduleDay = formatScheduleDay(schedule.selectedDate);
  const [scheduleData, setScheduleData] = useState<ScheduleData>();
  const calendarPages = useMemo(
    () =>
      [-1, 0, 1].map((offset) =>
        getWeekDays(addDays(schedule.visibleWeekStart, offset * DAYS_IN_WEEK)),
      ),
    [schedule.visibleWeekStart],
  );
  const weekDays = calendarPages[1];

  useEffect(() => {
    const controller = new AbortController();

    void getScheduleForDay(groupId, selectedScheduleDay, controller.signal)
      .then((dayLessons) => {
        if (controller.signal.aborted) {
          return;
        }

        setScheduleData({
          day: selectedScheduleDay,
          lessons: dayLessons,
          status: "success",
        });
      })
      .catch(() => {
        if (controller.signal.aborted) {
          return;
        }

        setScheduleData({
          day: selectedScheduleDay,
          status: "error",
        });
      });

    return () => {
      controller.abort();
    };
  }, [groupId, selectedScheduleDay]);

  const selectDate = (date: Date) => {
    dispatch({ type: "select-date", date });
  };

  const changeDay = (direction: SwipeDirection) => {
    dispatch({ type: "change-day", direction });
  };

  const changeWeek = (direction: SwipeDirection) => {
    impactOccurred("light");
    dispatch({ type: "change-week", direction });
  };

  const handleDayKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      dispatch({ type: "change-day", direction: -1 });
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      dispatch({ type: "change-day", direction: 1 });
    }
  };

  const handleDayClick = (date: Date) => {
    impactOccurred("light");
    selectDate(date);
  };

  return (
    <main className="schedule-page">
      <h1 className="visually-hidden">Расписание занятий</h1>

      <section className="calendar" aria-labelledby="calendar-title">
        <header className="calendar-header">
          <button
            aria-label="Предыдущая неделя"
            className="calendar-navigation-button"
            onClick={() => changeWeek(-1)}
            type="button"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <h2 id="calendar-title">{getCalendarTitle(weekDays)}</h2>
          <button
            aria-label="Следующая неделя"
            className="calendar-navigation-button"
            onClick={() => changeWeek(1)}
            type="button"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </header>
        <button
          aria-label={`Выбрать другую группу. Текущая группа: ${groupName}`}
          className="group-name"
          onClick={onChangeGroup}
          type="button"
        >
          <span>{groupName}</span>
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
        <HorizontalPager
          ariaLabel="Недели календаря"
          className="calendar-pager"
          pageKey={schedule.visibleWeekStart.toISOString()}
          onPageChange={changeWeek}
        >
          {calendarPages.map((days, pageIndex) => {
            const isCurrentPage = pageIndex === 1;

            return (
              <div
                aria-hidden={!isCurrentPage}
                className="horizontal-pager-page"
                inert={!isCurrentPage}
                key={days[0]?.date.toISOString()}
              >
                <ol className="calendar-days">
                  {days.map(({ date, day, fullWeekday, shortWeekday }) => {
                    const isSelected = isSameDay(date, schedule.selectedDate);
                    const label = `${fullWeekday}, ${dateFormatter.format(date)}`;

                    return (
                      <li key={date.toISOString()}>
                        <button
                          aria-current={isSelected ? "date" : undefined}
                          aria-label={label}
                          className={`calendar-day${isSelected ? " is-selected" : ""}`}
                          onClick={() => handleDayClick(date)}
                          onKeyDown={handleDayKeyDown}
                          type="button"
                        >
                          <span>{shortWeekday}</span>
                          <strong>{day}</strong>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </div>
            );
          })}
        </HorizontalPager>
      </section>

      <section aria-labelledby="lessons-title" className="lessons">
        <header className="section-heading">
          <h2 id="lessons-title">
            Расписание на {dateFormatter.format(schedule.selectedDate)}
          </h2>
          <span>{capitalize(weekdayFormatter.format(schedule.selectedDate))}</span>
        </header>
        <HorizontalPager
          ariaLabel="Расписание по дням"
          className="lessons-pager"
          pageKey={schedule.selectedDate.toISOString()}
          onPageChange={changeDay}
        >
          {[-1, 0, 1].map((offset) => {
            const date = addDays(schedule.selectedDate, offset);
            const isCurrentPage = offset === 0;
            const isLoadedDay =
              isCurrentPage && scheduleData?.day === selectedScheduleDay;

            return (
              <div
                aria-hidden={!isCurrentPage}
                aria-busy={isCurrentPage && !isLoadedDay}
                className="horizontal-pager-page"
                inert={!isCurrentPage}
                key={date.toISOString()}
              >
                {!isLoadedDay ? (
                  <p className="lesson-status" role="status">
                    Загружаем расписание…
                  </p>
                ) : null}
                {isLoadedDay && scheduleData.status === "error" ? (
                  <p className="lesson-status">Занятий нет.</p>
                ) : null}
                {isLoadedDay && scheduleData.status === "success" ? (
                  scheduleData.lessons.length > 0 ? (
                    <ol className="lesson-list">
                      {scheduleData.lessons.map((lesson) => (
                        <li key={`${lesson.time}-${lesson.room}-${lesson.title}`}>
                          <article className="lesson-card">
                            <div className="lesson-card-top">
                              <time>{lesson.time}</time>
                              <span>{lesson.room}</span>
                            </div>
                            <h3>{lesson.title}</h3>
                          </article>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="lesson-status">Занятий нет.</p>
                  )
                ) : null}
              </div>
            );
          })}
        </HorizontalPager>
      </section>
    </main>
  );
}
