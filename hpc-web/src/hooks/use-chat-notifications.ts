"use client";

import * as React from "react";
import { useRealtimeEvents } from "@/hooks/use-realtime-events";
import {
  playChatChime,
  showChatBrowserNotification,
  getChannelDisplayName,
} from "@/lib/chat-chime";
import { toast } from "sonner";
import type { SerializedChatMessage } from "@/actions/chat/chat.action";

export interface UseChatNotificationsOptions {
  isChatTabActive: boolean;
  currentUserId?: string;
  onOpenChatTab?: () => void;
}

export function useChatNotifications({
  isChatTabActive,
  currentUserId,
  onOpenChatTab,
}: UseChatNotificationsOptions) {
  const [unreadCount, setUnreadCount] = React.useState<number>(0);
  const isChatTabActiveRef = React.useRef(isChatTabActive);
  isChatTabActiveRef.current = isChatTabActive;

  // Clear unread count when switching into chat tab
  React.useEffect(() => {
    if (isChatTabActive) {
      setUnreadCount(0);
    }
  }, [isChatTabActive]);

  // Request browser notification permission once on mount if available
  React.useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission().catch(() => {});
      }
    }
  }, []);

  useRealtimeEvents({
    onEvent: (event) => {
      const type = (event?.type || "").toUpperCase();
      if (type === "CHAT_MESSAGE_SENT" && event?.data) {
        const msg = event.data as SerializedChatMessage;

        // Skip our own outbound messages if sender matches
        if (currentUserId && msg.senderId === currentUserId) {
          return;
        }

        // If user is NOT currently looking at the Chat tab:
        // 1. Increment unread counter for the red badge on Chat tab
        // 2. Play Web Audio chime (with urgent/regular pitch)
        // 3. Show sonner toast notification with channel name and message
        // 4. Trigger native browser push notification
        if (!isChatTabActiveRef.current) {
          setUnreadCount((prev) => prev + 1);
          playChatChime(msg.isUrgent);

          const channelName = getChannelDisplayName(msg.channel);
          const snippet =
            msg.content.length > 70
              ? msg.content.slice(0, 70) + "..."
              : msg.content;

          toast(
            msg.isUrgent
              ? `🚨 [${channelName}] Urgent: ${msg.senderName}`
              : `💬 [${channelName}] ${msg.senderName}`,
            {
              description: snippet,
              duration: 5000,
              action: onOpenChatTab
                ? {
                    label: "Open Chat",
                    onClick: onOpenChatTab,
                  }
                : undefined,
            },
          );

          showChatBrowserNotification(
            `[${channelName}] ${msg.senderName}`,
            msg.content,
          );
        }
      }
    },
  });

  return {
    unreadCount,
    setUnreadCount,
    clearUnreadCount: () => setUnreadCount(0),
  };
}
