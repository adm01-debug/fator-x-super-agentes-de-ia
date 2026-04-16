/**
 * NotificationBell — Header notification icon with unread badge.
 * Uses useNotifications hook for real-time polling.
 */
import { useNotifications } from '@/hooks/useNotifications';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, Check, CheckCheck, Loader2 } from 'lucide-react';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';

export function NotificationBell() {
  const { notifications, unreadCount, loading, markOneRead, markAllAsRead } = useNotifications();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative h-8 w-8 p-0">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1 animate-bounce-in">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Notificações</span>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{unreadCount}</Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="text-[11px] h-6 gap-1" onClick={markAllAsRead}>
              <CheckCheck className="h-3 w-3" /> Marcar todas
            </Button>
          )}
        </div>

        <ScrollArea className="max-h-[300px]">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-8 text-center">
              <Bell className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Nenhuma notificação</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.slice(0, 20).map((n) => {
                const isUnread = n.status === 'sent' || n.status === 'delivered';
                return (
                  <div
                    key={n.id}
                    className={`px-4 py-3 hover:bg-muted/30 cursor-pointer transition-colors ${isUnread ? 'bg-primary/5' : ''}`}
                    onClick={() => isUnread && markOneRead(n.id)}
                  >
                    <div className="flex items-start gap-2">
                      {isUnread && <span className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs ${isUnread ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                          {n.subject || n.channel}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">{n.body}</p>
                        <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                          {n.created_at ? new Date(n.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}
                        </p>
                      </div>
                      {isUnread && (
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0">
                          <Check className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
