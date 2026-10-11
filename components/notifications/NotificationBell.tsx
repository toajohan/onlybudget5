"use client";

import { Bell } from "lucide-react";
import { cn } from "@/lib/cn";
import { useNotifications } from "./NotificationsProvider";

/** Bell button with the unread counter; opens the notification panel (where notifications are switched on). */
export function NotificationBell({ className }: { className?: string }) {
  const { unreadCount, openPanel } = useNotifications();

  return (
    <button
      type="button"
      onClick={openPanel}
      aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} non lue${unreadCount > 1 ? "s" : ""}` : "Notifications"}
      className={cn("relative flex shrink-0 cursor-pointer items-center justify-center", className)}
    >
      <Bell className="h-[22px] w-[22px]" />
      {unreadCount > 0 && (
        <span
          aria-hidden="true"
          className="absolute -top-1 -right-1 flex h-[19px] min-w-[19px] items-center justify-center rounded-full bg-danger px-1 text-[11px] leading-none font-bold text-black ring-2 ring-[#0a0a0a]"
        >
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </button>
  );
}
