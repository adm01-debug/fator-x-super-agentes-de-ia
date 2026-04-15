/**
 * Nexus Agents Studio — DangerousActionDialog
 * Confirmation modal for destructive/irreversible actions.
 *
 * Enforces:
 *  - Required written reason (minimum N chars)
 *  - Optional password re-check (when requirePassword=true)
 *  - Type-to-confirm for extra-dangerous ops (when confirmText is set)
 *  - Automatic audit log emission on confirm
 *
 * Usage:
 *   <DangerousActionDialog
 *     title="Excluir agente"
 *     description="Esta ação não pode ser desfeita."
 *     resourceType="agent"
 *     resourceId={agent.id}
 *     resourceName={agent.name}
 *     action="delete"
 *     confirmText={agent.name}
 *     onConfirm={async (ctx) => { await deleteAgent(agent.id); }}
 *     trigger={<Button><Trash2 /></Button>}
 *   />
 */
import { useState, type ReactNode } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { logAudit, type AuditAction } from '@/services/auditLogService';

export interface DangerousActionContext {
  reason: string;
  password?: string;
}

interface DangerousActionDialogProps {
  /** Button/trigger element that opens the dialog */
  trigger: ReactNode;
  /** Dialog title */
  title: string;
  /** Dialog description shown below title */
  description?: ReactNode;
  /** Audit log action type */
  action: AuditAction;
  /** Resource type for the audit log (e.g. "agent", "knowledge_base") */
  resourceType: string;
  /** Resource id (if applicable) */
  resourceId?: string;
  /** Human-readable resource name */
  resourceName?: string;
  /** Callback executed after confirmation + validation */
  onConfirm: (ctx: DangerousActionContext) => Promise<void> | void;
  /** If set, user must type this exact string to confirm */
  confirmText?: string;
  /** Require password re-entry (default false) */
  requirePassword?: boolean;
  /** Minimum chars for reason field (default 8) */
  minReasonLength?: number;
  /** Override confirm button label */
  confirmLabel?: string;
  /** Extra metadata to attach to the audit log entry */
  metadata?: Record<string, unknown>;
}

export function DangerousActionDialog({
  trigger,
  title,
  description,
  action,
  resourceType,
  resourceId,
  resourceName,
  onConfirm,
  confirmText,
  requirePassword = false,
  minReasonLength = 8,
  confirmLabel = 'Confirmar',
  metadata,
}: DangerousActionDialogProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [password, setPassword] = useState('');
  const [typedConfirm, setTypedConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const reasonOk = reason.trim().length >= minReasonLength;
  const confirmTextOk = !confirmText || typedConfirm.trim() === confirmText;
  const passwordOk = !requirePassword || password.length >= 6;
  const canConfirm = reasonOk && confirmTextOk && passwordOk;

  const resetState = () => {
    setReason('');
    setPassword('');
    setTypedConfirm('');
    setLoading(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (!loading) {
      setOpen(next);
      if (!next) resetState();
    }
  };

  const handleConfirm = async () => {
    if (!canConfirm) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    // Optional password re-check — re-authenticates the user to validate
    // the password before proceeding with the destructive action.
    if (requirePassword) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const email = user?.email;
      if (!email) {
        toast.error('Não foi possível validar usuário');
        return;
      }
      setLoading(true);
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (authError) {
        toast.error('Senha incorreta');
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    try {
      await onConfirm({ reason: reason.trim(), password: requirePassword ? password : undefined });
      await logAudit({
        action,
        resource_type: resourceType,
        resource_id: resourceId,
        resource_name: resourceName,
        reason: reason.trim(),
        status: 'success',
        metadata: {
          ...metadata,
          confirm_text_used: !!confirmText,
          password_required: requirePassword,
        },
      });
      toast.success(`${title} concluída`);
      setOpen(false);
      resetState();
    } catch (e) {
      await logAudit({
        action,
        resource_type: resourceType,
        resource_id: resourceId,
        resource_name: resourceName,
        reason: reason.trim(),
        status: 'failed',
        metadata: {
          ...metadata,
          error: e instanceof Error ? e.message : String(e),
        },
      });
      toast.error(e instanceof Error ? e.message : 'Falha ao executar ação');
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            {title}
          </AlertDialogTitle>
          {description && (
            <AlertDialogDescription asChild>
              <div className="text-sm text-muted-foreground space-y-2">{description}</div>
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>

        <div className="space-y-4 py-2">
          {resourceName && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-xs">
              <span className="text-muted-foreground">Recurso: </span>
              <span className="font-mono font-medium">{resourceName}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="danger-reason" className="text-xs">
              Motivo <span className="text-destructive">*</span>
              <span className="text-muted-foreground ml-1">(mín. {minReasonLength} caracteres)</span>
            </Label>
            <Textarea
              id="danger-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explique por que esta ação é necessária..."
              rows={3}
              className="bg-secondary/50 text-sm resize-none"
              disabled={loading}
            />
            {reason.length > 0 && !reasonOk && (
              <p className="text-[11px] text-destructive">
                Faltam {minReasonLength - reason.trim().length} caracteres
              </p>
            )}
          </div>

          {confirmText && (
            <div className="space-y-2">
              <Label htmlFor="danger-confirm-text" className="text-xs">
                Digite <code className="px-1 py-0.5 rounded bg-secondary font-mono text-[11px]">{confirmText}</code>{' '}
                para confirmar <span className="text-destructive">*</span>
              </Label>
              <Input
                id="danger-confirm-text"
                value={typedConfirm}
                onChange={(e) => setTypedConfirm(e.target.value)}
                placeholder={confirmText}
                className="bg-secondary/50 font-mono text-sm"
                disabled={loading}
                autoComplete="off"
              />
            </div>
          )}

          {requirePassword && (
            <div className="space-y-2">
              <Label htmlFor="danger-password" className="text-xs">
                Senha <span className="text-destructive">*</span>
              </Label>
              <Input
                id="danger-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Sua senha atual"
                className="bg-secondary/50 text-sm"
                disabled={loading}
                autoComplete="current-password"
              />
            </div>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!canConfirm || loading}
            className="gap-1.5"
          >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {confirmLabel}
          </Button>
          {/* Hidden native confirm to satisfy AlertDialogAction API surface */}
          <AlertDialogAction className="hidden" />
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
