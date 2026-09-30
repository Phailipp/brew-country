import { useState, useEffect, useRef, useEffectEvent } from 'react';
import type { AppEvent, QuestState, OverlaySettings } from '../domain/types';
import { QUEST_CATALOG } from '../domain/quests';
import { evaluateEvent } from '../domain/questEngine';
import { getQuestStateForUser, saveQuestStateForUser } from '../services/firestoreService';
import { appEvents } from '../domain/events';
import { useToast } from '../ui/toastContext';
import { t, type Key } from '../i18n';

export function useQuests(userId: string, overlaySettings: OverlaySettings) {
  const [questState, setQuestState] = useState<QuestState>({ progress: {} });
  // Latest committed state for the (synchronous) event handler below
  const stateRef = useRef(questState);
  const { showToast } = useToast();

  useEffect(() => {
    // Dev-bypass users: skip Firestore, start with empty state immediately
    if (userId.startsWith('dev_')) return;

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

  const handleEvent = useEffectEvent((event: AppEvent) => {
      const { newState, completions } = evaluateEvent(
        event,
        stateRef.current,
        QUEST_CATALOG,
        overlaySettings
      );

      // Only update if something changed
      if (newState !== stateRef.current && JSON.stringify(newState) !== JSON.stringify(stateRef.current)) {
        stateRef.current = newState;
        setQuestState(newState);
        if (!userId.startsWith('dev_')) saveQuestStateForUser(userId, newState).catch(() => {});
      }

      // Fire toasts for completed quests
      for (const quest of completions) {
        showToast(quest.icon, t('toast.questDone', { title: t(`quests.catalog.${quest.id}.title` as Key) }), 'success');
      }
  });

  useEffect(() => appEvents.on(handleEvent), []);

  return { questState, catalog: QUEST_CATALOG };
}
