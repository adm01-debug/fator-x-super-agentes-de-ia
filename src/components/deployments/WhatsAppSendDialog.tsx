/**
 * WhatsAppSendDialog — Send outbound WhatsApp messages from deployments.
 * Uses whatsappOutboundService for multi-provider support.
 */
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Send, Loader2, CheckCircle2 } from 'lucide-react';
import { sendWhatsAppMessage } from '@/services/whatsappOutboundService';
import { toast } from 'sonner';

export function WhatsAppSendDialog() {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    if (!phone.trim() || !text.trim()) return;
    setSending(true);
    try {
      await sendWhatsAppMessage({ to: phone, text });
      setSent(true);
      toast.success('Mensagem enviada!');
      setTimeout(() => {
        setSent(false);
        setPhone('');
        setText('');
        setOpen(false);
      }, 1500);
    } catch (e) {
      toast.error(`Erro: ${e instanceof Error ? e.message : 'Falha ao enviar'}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs">
          <MessageSquare className="h-3.5 w-3.5" />
          Enviar WhatsApp
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-nexus-emerald" />
            Enviar Mensagem WhatsApp
            <Badge variant="outline" className="text-[10px]">
              Multi-provider
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Número (E.164)</span>
            <Input
              placeholder="+5511999887766"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Mensagem</span>
            <Textarea
              placeholder="Digite sua mensagem..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="text-sm min-h-[80px]"
            />
          </div>

          <Button
            className="w-full gap-2"
            onClick={handleSend}
            disabled={sending || !phone.trim() || !text.trim()}
          >
            {sent ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {sent ? 'Enviado!' : sending ? 'Enviando...' : 'Enviar Mensagem'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
