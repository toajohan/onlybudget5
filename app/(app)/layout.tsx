import { requireUser } from "@/lib/auth/session";
import { vapidPublicKey } from "@/lib/push";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { MobileNav } from "@/components/layout/MobileNav";
import { FeedbackProvider } from "@/components/feedback/FeedbackProvider";
import { NotificationsProvider } from "@/components/notifications/NotificationsProvider";
import { NotificationsPrompt } from "@/components/notifications/NotificationsPrompt";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <FeedbackProvider>
      <NotificationsProvider vapidPublicKey={vapidPublicKey()}>
        <div className="app-glow flex min-h-screen">
          <Sidebar role={user.role} name={user.name} avatarUrl={user.avatarUrl} />
          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar name={user.name} role={user.role} avatarUrl={user.avatarUrl} />
            <main className="flex-1 overflow-x-hidden px-4 pt-5 pb-32 md:px-10 md:pt-9 md:pb-10">
              <NotificationsPrompt />
              {children}
            </main>
            <MobileNav role={user.role} />
          </div>
        </div>
      </NotificationsProvider>
    </FeedbackProvider>
  );
}
