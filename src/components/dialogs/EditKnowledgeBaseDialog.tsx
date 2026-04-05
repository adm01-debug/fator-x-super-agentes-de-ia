import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { updateKnowledgeBase } from '@/services/knowledgeService';
import { editKnowledgeBaseSchema } from '@/lib/validations/dialogSchemas';
import { toast } from 'sonner';

interface KnowledgeBase {
  id: string;
  name: string;
  description: string | null;
  vector_db: string | null;
  embedding_model: string | null;
  status: string | null;
}

interface EditKnowledgeBaseDialogProps {
  kb: KnowledgeBase | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated?: () => void;
}

export function EditKnowledgeBaseDialog({ kb, open, onOpenChange, onUpdated }: EditKnowledgeBaseDialogProps) {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [vectorDb, setVectorDb] = useState('pgvector');
  const [embeddingModel, setEmbeddingModel] = useState<'text-embedding-3-large' | 'text-embedding-3-small'>('text-embedding-3-large');
  const [status, setStatus] = useState<'active' | 'inactive' | 'indexing'>('active');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (kb) {
      setName(kb.name);
      setDescription(kb.description || '');
      setVectorDb(kb.vector_db || 'pgvector');
      setEmbeddingModel((kb.embedding_model as typeof embeddingModel) || 'text-embedding-3-large');
      setStatus((kb.status as typeof status) || 'active');
    }
  }, [kb]);

  const handleSave = async () => {
    if (!kb) return;
    const result = editKnowledgeBaseSchema.safeParse({ name, description: description || undefined, embeddingModel, status });
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
      await updateKnowledgeBase(kb.id, {
        name: result.data.name,
        description: result.data.description ?? '',
        embedding_model: result.data.embeddingModel,
      });
      toast.success('Base atualizada!');
      onOpenChange(false);
      onUpdated?.();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao atualizar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Editar Base de Conhecimento</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Nome *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} className={`bg-secondary/50 ${errors.name ? 'border-destructive' : ''}`} />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Descrição</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} className="bg-secondary/50" rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Vector DB</Label>
              <Select value={vectorDb} onValueChange={setVectorDb}>
                <SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pgvector">pgvector</SelectItem>
                  <SelectItem value="pinecone">Pinecone</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Embedding Model</Label>
              <Select value={embeddingModel} onValueChange={(v) => setEmbeddingModel(v as typeof embeddingModel)}>
                <SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="text-embedding-3-large">text-embedding-3-large</SelectItem>
                  <SelectItem value="text-embedding-3-small">text-embedding-3-small</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
              <SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="inactive">Inativo</SelectItem>
                <SelectItem value="indexing">Indexando</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleSave} disabled={loading} className="w-full nexus-gradient-bg text-primary-foreground">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Salvar Alterações
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}