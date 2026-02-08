import { useState, useEffect, useCallback, useRef } from 'react';
import { isFirebaseConfigured } from '../config/firebase';
import { GAME } from '../config/constants';
import {
  updatePresence,
  subscribeOnlineCount,
  subscribePresenceForUsers,
} from '../services/firestoreService';
import type { UserPresence } from '../domain/types';

interface UsePresenceReturn {
  onlineCount: number;
  friendPresence: Map<string, UserPresence>;
  setFriendIds: (ids: string[]) => void;
}

/**
 * Hook for managing user presence (heartbeat) and online count.
 *
 * - Sends heartbeat every PRESENCE_HEARTBEAT_MS
 * - Subscribes to total online count
 * - Subscribes to presence for specific friend IDs
 * - Gracefully returns zeros when Firebase is not configured
 */
export function usePresence(userId: string | null): UsePresenceReturn {
  const [onlineCount, setOnlineCount] = useState(0);
  const [friendPresence, setFriendPresence] = useState<Map<string, UserPresence>>(new Map());
  const friendIdsRef = useRef<string[]>([]);
  const friendUnsubRef = useRef<(() => void) | null>(null);

  // Heartbeat + online count subscription
  useEffect(() => {
    if (!isFirebaseConfigured() || !userId) return;

    // Initial heartbeat
    updatePresence(userId).catch(() => {});

    // Periodic heartbeat
    const heartbeatId = setInterval(() => {
      updatePresence(userId).catch(() => {});
    }, GAME.PRESENCE_HEARTBEAT_MS);

    // Subscribe to online count
    const unsubCount = subscribeOnlineCount((count) => {
      setOnlineCount(count);
    });

    return () => {
      clearInterval(heartbeatId);
      unsubCount();
    };
  }, [userId]);

  // Subscribe to friend presence when friendIds change
  const resubscribeFriends = useCallback(() => {
    if (!isFirebaseConfigured()) return;

    // Clean up previous subscription
    if (friendUnsubRef.current) {
      friendUnsubRef.current();
      friendUnsubRef.current = null;
    }

    const ids = friendIdsRef.current;
    if (ids.length === 0) {
      setFriendPresence(new Map());
      return;
    }

    friendUnsubRef.current = subscribePresenceForUsers(ids, (map) => {
      setFriendPresence(map);
    });
  }, []);

  // Cleanup friend subscription on unmount
  useEffect(() => {
    return () => {
      if (friendUnsubRef.current) {
        friendUnsubRef.current();
        friendUnsubRef.current = null;
      }
    };
  }, []);

  const setFriendIds = useCallback((ids: string[]) => {
    friendIdsRef.current = ids;
    resubscribeFriends();
  }, [resubscribeFriends]);

  return { onlineCount, friendPresence, setFriendIds };
}
