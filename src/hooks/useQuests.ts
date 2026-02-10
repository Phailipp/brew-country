import { useState, useEffect, useRef } from 'react';
import type { AppEvent, QuestState, OverlaySettings } from '../domain/types';
import { QUEST_CATALOG } from '../domain/quests';
import { evaluateEvent } from '../domain/questEngine';
import { getQuestStateForUser, saveQuestStateForUser } from '../services/firestoreService';
import { appEvents } from '../domain/events';
import { useToast } from '../ui/Toast';

export function useQuests(userId: string, overlaySettings: OverlaySettings) {
  const [questState, setQuestState] = useState<QuestState>({ progress: {} });
  const settingsRef = useRef(overlaySettings);
  settingsRef.current = overlaySettings;
  const stateRef = useRef(questState);
  stateRef.current = questState;
  const { showToast } = useToast();
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;

  useEffect(() => {
    let mounted = true;
    getQuestStateForUser(userId)
      .then((state) => {
        if (!mounted) return;
        stateRef.current = state;
        setQuestState(state);
      })
      .catch(() => {
        if (!mounted) return;
        stateRef.current = { progress: {} };
        setQuestState({ progress: {} });
      });

    return () => {
      mounted = false;
    };
  }, [userId]);

  useEffect(() => {
    const handler = (event: AppEvent) => {
      const { newState, completions } = evaluateEvent(
        event,
        stateRef.current,
        QUEST_CATALOG,
        settingsRef.current
      );

      // Only update if something changed
      if (newState !== stateRef.current && JSON.stringify(newState) !== JSON.stringify(stateRef.current)) {
        stateRef.current = newState;
        setQuestState(newState);
        saveQuestStateForUser(userId, newState).catch(() => {});
      }

      // Fire toasts for completed quests
      for (const quest of completions) {
        showToastRef.current(quest.icon, `${quest.title} abgeschlossen!`);
      }
    };

    return appEvents.on(handler);
  }, [userId]);

  return { questState, catalog: QUEST_CATALOG };
}
