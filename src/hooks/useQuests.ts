import { useState, useEffect, useRef } from 'react';
import type { AppEvent, QuestState, OverlaySettings } from '../domain/types';
import { QUEST_CATALOG } from '../domain/quests';
import { evaluateEvent } from '../domain/questEngine';
import { getQuestState, saveQuestState } from '../storage/QuestStore';
import { appEvents } from '../domain/events';
import { useToast } from '../ui/Toast';

export function useQuests(overlaySettings: OverlaySettings) {
  const [questState, setQuestState] = useState<QuestState>(() => getQuestState());
  const settingsRef = useRef(overlaySettings);
  settingsRef.current = overlaySettings;
  const stateRef = useRef(questState);
  stateRef.current = questState;
  const { showToast } = useToast();
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;

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
        saveQuestState(newState);
      }

      // Fire toasts for completed quests
      for (const quest of completions) {
        showToastRef.current(quest.icon, `${quest.title} abgeschlossen!`);
      }
    };

    return appEvents.on(handler);
  }, []);

  return { questState, catalog: QUEST_CATALOG };
}
