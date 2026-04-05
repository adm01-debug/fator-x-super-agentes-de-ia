import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserPlus, Loader2 } from 'lucide-react';
import { insertWorkspaceMember } from '@/services/teamsService';
import { getWorkspaceId } from '@/lib/agentService';
import { inviteMemberSchema } from '@/lib/validations/dialogSchemas';
import { toast } from 'sonner';

interface InviteMemberDialogProps {
  onInvited?: () => void;
}

export function InviteMemberDialog({ onInvited }: InviteMemberDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'admin' | 'editor' | 'viewer' | 'operator'>('editor');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleInvite = async () => {
    const result = inviteMemberSchema.safeParse({ email, name: name || undefined, role });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach(i => { fieldErrors[String(i.path[0])] = i.message; });
      setErrors(fieldErrors);
      toast.error(Object.values(fieldErrors)[0]);
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const wsId = await getWorkspaceId();
      await insertWorkspaceMember({
        workspace_id: wsId,
        email: result.data.email,
        name: result.data.name,
        role: result.data.role,
      });
      toast.success(`Convite enviado para ${result.data.email}!`);
      setOpen(false);
      setEmail(''); setName('');
      onInvited?.();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao convidar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="nexus-gradient-bg text-primary-foreground gap-2 hover:opacity-90">
          <UserPlus className="h-4 w-4" /> Convidar
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Convidar Membro</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Email *</Label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="membro@empresa.com" className={`bg-secondary/50 ${errors.email ? 'border-destructive' : ''}`} />
            {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Nome</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Nome do membro" className="bg-secondary/50" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Papel</Label>
            <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
              <SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="editor">Editor</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
                <SelectItem value="operator">Operator</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleInvite} disabled={loading} className="w-full nexus-gradient-bg text-primary-foreground">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Enviar Convite
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}