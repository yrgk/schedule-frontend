"use client";

import { useEffect, useState } from "react";
import type { Group } from "@/app/_data/schedule";
import { getAvailableGroups } from "@/app/_lib/schedule-api";
import {
  readStoredGroup,
  saveStoredGroup,
} from "@/app/_lib/group-storage";
import { AppShell } from "@/app/_components/app-shell";
import { GroupSelector } from "@/app/_components/group-selector";

type AppScreen = "group-selection" | "schedule";

function findGroup(groups: readonly Group[], groupId: string | null) {
  return groups.find((group) => String(group.id) === groupId);
}

export function WebApp() {
  const [screen, setScreen] = useState<AppScreen>("group-selection");
  const [selectedGroup, setSelectedGroup] = useState<Group>();
  const [groups, setGroups] = useState<readonly Group[]>([]);
  const [groupsError, setGroupsError] = useState<string>();
  const [isReady, setIsReady] = useState(false);
  const [storageError, setStorageError] = useState<string>();

  useEffect(() => {
    let isActive = true;
    const controller = new AbortController();

    const loadStoredGroup = async () => {
      try {
        const availableGroups = await getAvailableGroups(controller.signal);

        if (!isActive) {
          return;
        }

        setGroups(availableGroups);

        if (availableGroups.length === 0) {
          setGroupsError("Доступных групп пока нет.");
          setIsReady(true);
          return;
        }

        const group = findGroup(availableGroups, readStoredGroup());

        if (group) {
          setSelectedGroup(group);
          setScreen("schedule");
        } else {
          setScreen("group-selection");
        }
      } catch {
        if (!controller.signal.aborted) {
          setGroupsError("Не удалось загрузить список групп.");
        }
      } finally {
        if (isActive) {
          setIsReady(true);
        }
      }
    };

    void loadStoredGroup();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, []);

  const handleGroupSelect = (group: Group) => {
    setStorageError(undefined);

    if (!saveStoredGroup(String(group.id))) {
      setStorageError("Не удалось сохранить группу в браузере. Попробуйте ещё раз.");
      return;
    }

    setSelectedGroup(group);
    setScreen("schedule");
  };

  const handleChangeGroup = () => {
    setStorageError(undefined);
    setScreen("group-selection");
  };

  if (!isReady) {
    return (
      <main aria-live="polite" className="app-loading" role="status">
        <span aria-hidden="true" className="lesson-loading-spinner" />
        <span className="visually-hidden">Загружаем группы...</span>
      </main>
    );
  }

  if (screen === "group-selection") {
    return (
      <GroupSelector
        groups={groups}
        isSaving={false}
        message={storageError ?? groupsError}
        messageTone="error"
        onSelect={handleGroupSelect}
      />
    );
  }

  if (selectedGroup) {
    return (
      <AppShell
        groupId={selectedGroup.id}
        groupName={selectedGroup.name}
        onChangeGroup={handleChangeGroup}
      />
    );
  }

  return null;
}
