/**
 * Hook to track new chat messages across all accepted friendships.
 * Shows a toast notification when a new message arrives and that chat is not open.
 * Tracks unread counts per friendship.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import type { Friendship, ChatMessage } from '../domain/types';
import { subscribeMessages } from '../services/firestoreService';
import type { Unsubscribe } from 'firebase/firestore';

interface UseChatNotificationsOptions {
  userId: string;
  friendships: Friendship[];
  openChatFriendshipId: string | null;
  onNewMessage?: (friendshipId: string, message: ChatMessage) => void;
}

interface UseChatNotificationsResult {
  /** Map of friendshipId → unread count */
  unreadCounts: Map<string, number>;
  /** Mark all messages in a friendship as read */
  markRead: (friendshipId: string) => void;
}

export function useChatNotifications({
  userId,
  friendships,
  openChatFriendshipId,
  onNewMessage,
}: UseChatNotificationsOptions): UseChatNotificationsResult {
  const [unreadCounts, setUnreadCounts] = useState<Map<string, number>>(new Map());

  // Track the latest known message ID per friendship to detect new messages
  const latestMsgIdRef = useRef<Map<string, string>>(new Map());
  // Track initial load (don't notify for messages that were already there)
  const initialLoadRef = useRef<Set<string>>(new Set());
  // Stable ref for onNewMessage callback
  const onNewMessageRef = useRef(onNewMessage);
  onNewMessageRef.current = onNewMessage;
  // Ref for openChatFriendshipId to avoid stale closures
  const openChatRef = useRef(openChatFriendshipId);
  openChatRef.current = openChatFriendshipId;

  // Only subscribe to accepted friendships
  const acceptedFriendships = friendships.filter((f) => f.status === 'accepted');

  useEffect(() => {
    const unsubs: Unsubscribe[] = [];

    for (const fs of acceptedFriendships) {
      const unsub = subscribeMessages(fs.id, (messages: ChatMessage[]) => {
        if (messages.length === 0) return;

        const latestMsg = messages[messages.length - 1];
        const prevLatestId = latestMsgIdRef.current.get(fs.id);

        // First load for this friendship — just record the latest ID
        if (!initialLoadRef.current.has(fs.id)) {
          initialLoadRef.current.add(fs.id);
          latestMsgIdRef.current.set(fs.id, latestMsg.id);
          return;
        }

        // Check if there's a new message
        if (latestMsg.id !== prevLatestId) {
          latestMsgIdRef.current.set(fs.id, latestMsg.id);

          // Only notify for messages from others (not our own)
          if (latestMsg.senderId !== userId) {
            // If this chat is currently open, don't add to unread
            if (openChatRef.current === fs.id) {
              return;
            }

            // Increment unread count
            setUnreadCounts((prev) => {
              const next = new Map(prev);
              next.set(fs.id, (prev.get(fs.id) ?? 0) + 1);
              return next;
            });

            // Fire callback for toast
            onNewMessageRef.current?.(fs.id, latestMsg);
          }
        }
      });

      unsubs.push(unsub);
    }

    return () => {
      unsubs.forEach((u) => u());
    };
    // Re-subscribe when the set of accepted friendship IDs changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acceptedFriendships.map((f) => f.id).join(','), userId]);

  // Auto-clear unread when opening a chat
  useEffect(() => {
    if (openChatFriendshipId) {
      setUnreadCounts((prev) => {
        if (!prev.has(openChatFriendshipId) || prev.get(openChatFriendshipId) === 0) return prev;
        const next = new Map(prev);
        next.delete(openChatFriendshipId);
        return next;
      });
    }
  }, [openChatFriendshipId]);

  const markRead = useCallback((friendshipId: string) => {
    setUnreadCounts((prev) => {
      if (!prev.has(friendshipId)) return prev;
      const next = new Map(prev);
      next.delete(friendshipId);
      return next;
    });
  }, []);

  return { unreadCounts, markRead };
}
