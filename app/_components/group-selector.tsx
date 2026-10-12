"use client";

import type { Group } from "@/app/_data/schedule";
import { withAppBasePath } from "@/app/_config/app";
import { TgsAnimation } from "@/app/_components/tgs-animation";

type GroupSelectorProps = Readonly<{
  groups: readonly Group[];
  message?: string;
  messageTone?: "error" | "info";
  isSaving: boolean;
  showHomework: boolean;
  onShowHomeworkChange: (value: boolean) => void;
  onSelect: (group: Group) => void;
}>;

export function GroupSelector({
  groups,
  message,
  messageTone = "info",
  isSaving,
  showHomework,
  onShowHomeworkChange,
  onSelect,
}: GroupSelectorProps) {
  return (
    <main className="group-selector">
      <section aria-labelledby="group-selector-title" className="group-selector-content">
        <TgsAnimation
          ariaLabel=""
          className="group-selector-animation"
          src={withAppBasePath("/group-selector-duck.tgs")}
        />
        <div className="group-selector-details">
          <h1 id="group-selector-title">Выбери группу</h1>
          <p>Расписание будет сохранено для выбранной группы</p>
          <label className="homework-toggle">
            <span>Отображать дз</span>
            <input checked={showHomework} onChange={(event) => onShowHomeworkChange(event.currentTarget.checked)} type="checkbox" />
          </label>
          <ul aria-label="Доступные группы" className="group-list">
            {groups.map((group) => (
              <li key={group.id}>
                <button
                  disabled={isSaving}
                  onClick={() => onSelect(group)}
                  type="button"
                >
                  {group.name}
                </button>
              </li>
            ))}
          </ul>
          {message ? (
            <p className={`group-selector-message is-${messageTone}`}>{message}</p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
