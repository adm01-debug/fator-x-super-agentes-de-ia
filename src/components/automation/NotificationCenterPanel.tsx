import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Bell, Mail, MessageSquare, Hash, Smartphone, Globe, Send, Loader2 } from 'lucide-react';
import {
  listNotifications,
  getNotificationStats,
  sendNotificationViaEF,
  NOTIFICATION_PRESETS,
  type NotificationPayload,
  type NotificationStats,
  type NotificationChannel,
} from '@/services/notificationEngineService';
import { useToast } from '@/hooks/use-toast';

const CHANNEL_ICONS: Record<string, typeof Bell> = {
  email: Mail, whatsapp: MessageSquare, slack: Hash, push: Smartphone, sms: Send, in_app: Bell, webhook: Globe,
};
const STATUS_COLORS: Record<string, string> = {
  pending: 'text-yellow-400', sent: 'text-blue-400', delivered: 'text-green-400',
  read: 'text-emerald-400', failed: 'text-red-400', cancelled: 'text-gray-400',
};

const CHANNELS: NotificationChannel[] = ['email', 'whatsapp', 'slack', 'push', 'sms', 'in_app', 'webhook'];

export function NotificationCenterPanel() {
  const [notifications, setNotifications] = useState<NotificationPayload[]>([]);
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [testOpen, setTestOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [testChannel, setTestChannel] = useState<NotificationChannel>('email');
  const [testRecipient, setTestRecipient] = useState('');
  const [testSubject, setTestSubject] = useState('Teste — Nexus');
  const [testMessage, setTestMessage] = useState('Este é um envio de teste a partir do Centro de Automação do Nexus.');
  const { toast } = useToast();

  const loadAll = async () => {
    try {
      const [n, s] = await Promise.all([listNotifications({}, 50), getNotificationStats()]);
      setNotifications(n);
      setStats(s);
    } catch {
      toast({ title: 'Erro ao carregar notificações', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleSendTest = async () => {
    if (!testRecipient.trim() || !testMessage.trim()) {
      toast({ title: 'Destinatário e mensagem são obrigatórios', variant: 'destructive' });
      return;
    }
    setSending(true);
    try {
      const result = await sendNotificationViaEF({
        channel: testChannel,
        recipient: testRecipient.trim(),
        subject: testSubject.trim() || undefined,
        message: testMessage.trim(),
        priority: 'normal',
        metadata: { source: 'notification-center-panel-test' },
      });
      toast({
        title: 'Notificação de teste enviada',
        description: `${testChannel} → ${testRecipient} (${result.status ?? 'ok'})`,
      });
      setTestOpen(false);
      await loadAll();
    } catch (e) {
      toast({
        title: 'Falha no envio de teste',
        description: e instanceof Error ? e.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1">
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
      </div>

      <div className="flex justify-end">
        <Dialog open={testOpen} onOpenChange={setTestOpen}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs border-[#222244] hover:bg-[#1a1a3e] hover:border-[#4D96FF]"
            >
              <Send className="h-3.5 w-3.5" />
              Enviar Teste
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-[#111122] border-[#222244] max-w-lg">
            <DialogHeader>
              <DialogTitle>Enviar Notificação de Teste</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="test-channel">Canal</Label>
                <Select value={testChannel} onValueChange={(v) => setTestChannel(v as NotificationChannel)}>
                  <SelectTrigger id="test-channel" className="bg-[#0a0a1a] border-[#222244]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#111122] border-[#222244]">
                    {CHANNELS.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="test-recipient">Destinatário</Label>
                <Input
                  id="test-recipient"
                  value={testRecipient}
                  onChange={(e) => setTestRecipient(e.target.value)}
                  placeholder={
                    testChannel === 'email' ? 'usuario@empresa.com' :
                    testChannel === 'whatsapp' || testChannel === 'sms' ? '+5511999999999' :
                    testChannel === 'slack' ? '#canal ou @user' :
                    'identificador'
                  }
                  className="bg-[#0a0a1a] border-[#222244]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="test-subject">Assunto</Label>
                <Input
                  id="test-subject"
                  value={testSubject}
                  onChange={(e) => setTestSubject(e.target.value)}
                  className="bg-[#0a0a1a] border-[#222244]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="test-message">Mensagem</Label>
                <Textarea
                  id="test-message"
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  rows={4}
                  className="bg-[#0a0a1a] border-[#222244] resize-none"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setTestOpen(false)}
                disabled={sending}
                className="border-[#222244]"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSendTest}
                disabled={sending}
                className="bg-[#4D96FF] hover:bg-[#4D96FF]/90 text-white gap-1.5"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Enviar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
