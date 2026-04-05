import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Loader2 } from 'lucide-react';
import { createKnowledgeBaseWithWorkspace } from '@/services/knowledgeService';
import { createKnowledgeBaseSchema } from '@/lib/validations/dialogSchemas';
import { toast } from 'sonner';

interface CreateKnowledgeBaseDialogProps {
  onCreated?: () => void;
}

export function CreateKnowledgeBaseDialog({ onCreated }: CreateKnowledgeBaseDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [vectorDb, setVectorDb] = useState<'pgvector' | 'pinecone'>('pgvector');
  const [embeddingModel, setEmbeddingModel] = useState<'text-embedding-3-large' | 'text-embedding-3-small'>('text-embedding-3-large');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleCreate = async () => {
    const result = createKnowledgeBaseSchema.safeParse({ name, description: description || undefined, vectorDb, embeddingModel });
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
      await createKnowledgeBaseWithWorkspace({
        name: result.data.name,
        description: result.data.description ?? '',
        embedding_model: result.data.embeddingModel,
      });
      toast.success('Base de conhecimento criada!');
      setOpen(false);
      setName(''); setDescription('');
      onCreated?.();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao criar base');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="nexus-gradient-bg text-primary-foreground gap-2 hover:opacity-90">
          <Plus className="h-4 w-4" /> Nova base
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Nova Base de Conhecimento</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Nome *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Documentação Técnica" className={`bg-secondary/50 ${errors.name ? 'border-destructive' : ''}`} />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Descrição</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Para que serve esta base..." className="bg-secondary/50" rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Vector DB</Label>
              <Select value={vectorDb} onValueChange={(v) => setVectorDb(v as typeof vectorDb)}>
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
          <Button onClick={handleCreate} disabled={loading} className="w-full nexus-gradient-bg text-primary-foreground">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Criar Base
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}