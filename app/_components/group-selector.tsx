"use client";

import type { Group } from "@/app/_data/schedule";
import { TgsAnimation } from "@/app/_components/tgs-animation";

type GroupSelectorProps = Readonly<{
  groups: readonly Group[];
  message?: string;
  messageTone?: "error" | "info";
  isSaving: boolean;
  onSelect: (group: Group) => void;
}>;

export function GroupSelector({
  groups,
  message,
  messageTone = "info",
  isSaving,
  onSelect,
}: GroupSelectorProps) {
  return (
    <main className="group-selector">
      <section aria-labelledby="group-selector-title" className="group-selector-content">
        <TgsAnimation
          ariaLabel=""
          className="group-selector-animation"
          src="/group-selector-duck.tgs"
        />
        <div className="group-selector-details">
          <h1 id="group-selector-title">Выбери группу</h1>
          <p>Расписание будет сохранено для выбранной группы</p>
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
