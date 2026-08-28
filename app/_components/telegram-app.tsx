"use client";

import { useCallback, useEffect, useState } from "react";
import Script from "next/script";
import type { Group } from "@/app/_data/schedule";
import { getAvailableGroups } from "@/app/_lib/schedule-api";
import {
  impactOccurred,
  prepareTelegramWebApp,
  readStoredGroup,
  saveStoredGroup,
} from "@/app/_lib/telegram-web-app";
import { AppShell } from "@/app/_components/app-shell";
import { GroupSelector } from "@/app/_components/group-selector";

type ScriptStatus = "error" | "loading" | "ready";
type AppScreen = "group-selection" | "schedule";

function findGroup(groups: readonly Group[], groupId: string | null) {
  return groups.find((group) => String(group.id) === groupId);
}

export function TelegramApp() {
  const [scriptStatus, setScriptStatus] = useState<ScriptStatus>("loading");
  const [screen, setScreen] = useState<AppScreen>("group-selection");
  const [selectedGroup, setSelectedGroup] = useState<Group>();
  const [groups, setGroups] = useState<readonly Group[]>([]);
  const [groupsError, setGroupsError] = useState<string>();
  const [isStorageChecked, setIsStorageChecked] = useState(false);
  const [isSavingGroup, setIsSavingGroup] = useState(false);
  const [storageError, setStorageError] = useState<string>();

  const handleScriptReady = useCallback(() => {
    prepareTelegramWebApp();
    setScriptStatus("ready");
  }, []);

  useEffect(() => {
    if (scriptStatus !== "ready") {
      return;
    }

    let isActive = true;
    const controller = new AbortController();

    const loadStoredGroup = async () => {
      const [groupsResult, groupId] = await Promise.all([
        getAvailableGroups(controller.signal).then(
          (availableGroups) => ({ availableGroups }),
          () => ({ availableGroups: undefined }),
        ),
        readStoredGroup(),
      ]);

      if (!isActive) {
        return;
      }

      if (!groupsResult.availableGroups) {
        setGroupsError("Не удалось загрузить список групп.");
        setIsStorageChecked(true);
        return;
      }

      setGroups(groupsResult.availableGroups);

      if (groupsResult.availableGroups.length === 0) {
        setGroupsError("Доступных групп пока нет.");
        setIsStorageChecked(true);
        return;
      }

      const group = findGroup(groupsResult.availableGroups, groupId);

      if (group) {
        setSelectedGroup(group);
        setScreen("schedule");
      } else {
        setScreen("group-selection");
      }

      setIsStorageChecked(true);
    };

    void loadStoredGroup();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [scriptStatus]);

  const handleGroupSelect = async (group: Group) => {
    setIsSavingGroup(true);
    setStorageError(undefined);
    impactOccurred("medium");

    const hasSaved = await saveStoredGroup(String(group.id));

    setIsSavingGroup(false);

    if (!hasSaved) {
      setStorageError("Не удалось сохранить группу. Попробуйте ещё раз.");
      return;
    }

    setSelectedGroup(group);
    setScreen("schedule");
  };

  return (
    <>
      <Script
        onError={() => setScriptStatus("error")}
        onLoad={handleScriptReady}
        onReady={handleScriptReady}
        src="https://telegram.org/js/telegram-web-app.js?63"
        strategy="afterInteractive"
      />
      {scriptStatus === "ready" && isStorageChecked && screen === "group-selection" ? (
        <GroupSelector
          groups={groups}
          isSaving={isSavingGroup}
          message={storageError ?? groupsError}
          messageTone="error"
          onSelect={handleGroupSelect}
        />
      ) : null}
      {scriptStatus === "ready" && isStorageChecked && screen === "schedule" && selectedGroup ? (
        <AppShell groupId={selectedGroup.id} groupName={selectedGroup.name} />
      ) : null}
    </>
  );
}
