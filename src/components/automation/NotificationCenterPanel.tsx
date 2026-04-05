import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bell, Mail, MessageSquare, Hash, Smartphone, Globe, Send } from 'lucide-react';
import { listNotifications, getNotificationStats, NOTIFICATION_PRESETS, type NotificationPayload, type NotificationStats } from '@/services/notificationEngineService';
import { useToast } from '@/hooks/use-toast';

const CHANNEL_ICONS: Record<string, typeof Bell> = { email: Mail, whatsapp: MessageSquare, slack: Hash, push: Smartphone, sms: Send, in_app: Bell, webhook: Globe };
const STATUS_COLORS: Record<string, string> = { pending: 'text-yellow-400', sent: 'text-blue-400', delivered: 'text-green-400', read: 'text-emerald-400', failed: 'text-red-400', cancelled: 'text-gray-400' };

export function NotificationCenterPanel() {
  const [notifications, setNotifications] = useState<NotificationPayload[]>([]);
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    Promise.all([listNotifications({}, 50), getNotificationStats()])
      .then(([n, s]) => { setNotifications(n); setStats(s); })
      .catch(() => toast({ title: 'Erro ao carregar notificações', variant: 'destructive' }))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Enviadas', value: stats?.total_sent ?? 0, color: '#4D96FF' },
          { label: 'Entregues', value: stats?.total_delivered ?? 0, color: '#6BCB77' },
          { label: 'Lidas', value: stats?.total_read ?? 0, color: '#9B59B6' },
          { label: 'Taxa Entrega', value: `${(stats?.delivery_rate ?? 0).toFixed(1)}%`, color: '#FFD93D' },
        ].map((s, i) => (
          <Card key={i} className="bg-[#111122] border-[#222244]">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs text-gray-400">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-[#111122] border-[#222244]">
        <CardHeader className="pb-3"><CardTitle className="text-sm text-gray-400">Presets de Notificação — Promo Brindes</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Object.entries(NOTIFICATION_PRESETS).map(([key, preset]) => {
              const Icon = CHANNEL_ICONS[preset.channel] ?? Bell;
              return (
                <div key={key} className="p-3 rounded-lg bg-[#0a0a1a] border border-[#222244]">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon size={14} className="text-[#4D96FF]" />
                    <p className="font-medium text-sm">{preset.subject.replace(/\{\{.*?\}\}/g, '...')}</p>
                  </div>
                  <p className="text-xs text-gray-400 line-clamp-2">{preset.body.replace(/\{\{.*?\}\}/g, '...')}</p>
                  <div className="flex gap-2 mt-2">
                    <Badge variant="outline" className="text-[10px] border-[#222244]">{preset.channel}</Badge>
                    <Badge variant="outline" className="text-[10px] border-[#222244]">{preset.category}</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Carregando notificações...</div>
      ) : notifications.length === 0 ? (
        <Card className="bg-[#111122] border-[#222244]"><CardContent className="py-12 text-center text-gray-400"><Bell size={48} className="mx-auto mb-4 opacity-30" /><p>Nenhuma notificação enviada.</p></CardContent></Card>
      ) : (
        <div className="space-y-2">
          {notifications.slice(0, 20).map((n) => {
            const Icon = CHANNEL_ICONS[n.channel] ?? Bell;
            return (
              <Card key={n.id} className="bg-[#111122] border-[#222244]">
                <CardContent className="p-3 flex items-center gap-3">
                  <Icon size={16} className="text-[#4D96FF] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{n.subject}</p>
                    <p className="text-xs text-gray-400 truncate">{n.recipient_address}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`text-xs ${STATUS_COLORS[n.status] ?? 'text-gray-400'}`}>{n.status}</span>
                    <p className="text-[10px] text-gray-500">{n.sent_at ? new Date(n.sent_at).toLocaleString('pt-BR') : '—'}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
