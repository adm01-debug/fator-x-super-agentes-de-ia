import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ArrowLeft, FolderOpen, FileText, Hash, Plus, Loader2, Trash2, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

interface KnowledgeBaseDetailProps {
  kbId: string;
  kbName: string;
  onBack: () => void;
}

export function KnowledgeBaseDetail({ kbId, kbName, onBack }: KnowledgeBaseDetailProps) {
  const queryClient = useQueryClient();
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [newCollOpen, setNewCollOpen] = useState(false);
  const [newDocOpen, setNewDocOpen] = useState(false);
  const [collName, setCollName] = useState('');
  const [collDesc, setCollDesc] = useState('');
  const [docTitle, setDocTitle] = useState('');
  const [docContent, setDocContent] = useState('');
  const [docSourceUrl, setDocSourceUrl] = useState('');
  const [saving, setSaving] = useState(false);

  // Collections
  const { data: collections = [], isLoading: loadingColls } = useQuery({
    queryKey: ['collections', kbId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('collections')
        .select('*')
        .eq('knowledge_base_id', kbId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Documents for selected collection
  const { data: documents = [], isLoading: loadingDocs } = useQuery({
    queryKey: ['documents', selectedCollectionId],
    queryFn: async () => {
      if (!selectedCollectionId) return [];
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('collection_id', selectedCollectionId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!selectedCollectionId,
  });

  // Chunks for selected collection documents
  const selectedDocIds = documents.map(d => d.id);
  const { data: chunks = [], isLoading: loadingChunks } = useQuery({
    queryKey: ['chunks', selectedDocIds],
    queryFn: async () => {
      if (selectedDocIds.length === 0) return [];
      const { data, error } = await supabase
        .from('chunks')
        .select('*')
        .in('document_id', selectedDocIds)
        .order('chunk_index', { ascending: true })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
    enabled: selectedDocIds.length > 0,
  });

  const handleCreateCollection = async () => {
    if (!collName.trim()) { toast.error('Nome é obrigatório'); return; }
    setSaving(true);
    const { error } = await supabase.from('collections').insert({
      name: collName.trim(),
      description: collDesc.trim(),
      knowledge_base_id: kbId,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Collection criada!');
    setNewCollOpen(false);
    setCollName(''); setCollDesc('');
    queryClient.invalidateQueries({ queryKey: ['collections', kbId] });
  };

  const handleCreateDocument = async () => {
    if (!docTitle.trim() || !selectedCollectionId) { toast.error('Título é obrigatório'); return; }
    setSaving(true);
    const { data: doc, error } = await supabase.from('documents').insert({
      title: docTitle.trim(),
      collection_id: selectedCollectionId,
      source_url: docSourceUrl.trim() || null,
      source_type: docSourceUrl.trim() ? 'url' : 'manual',
      status: 'pending',
    }).select('id').single();

    if (error || !doc) { toast.error(error?.message || 'Erro'); setSaving(false); return; }

    // If manual content provided, call rag-ingest for chunking + embeddings
    if (docContent.trim()) {
      toast.info('Gerando embeddings...');
      const { data: ingestResult, error: ingestError } = await supabase.functions.invoke('rag-ingest', {
        body: { document_id: doc.id, content: docContent.trim(), chunk_size: 1000, chunk_overlap: 200 },
      });
      if (ingestError) {
        toast.warning(`Documento salvo mas embeddings falharam: ${ingestError.message}`);
      } else {
        toast.success(`${ingestResult?.chunks_created || 0} chunks criados, ${ingestResult?.embeddings_generated || 0} embeddings gerados`);
      }
    }

    // Update KB counts
    const { count: docCount } = await supabase.from('documents').select('id', { count: 'exact', head: true }).eq('collection_id', selectedCollectionId);
    const collDocIds = documents.map(d => d.id).concat(doc.id);
    const { count: chunkCount } = await supabase.from('chunks').select('id', { count: 'exact', head: true }).in('document_id', collDocIds);

    await supabase.from('knowledge_bases').update({
      document_count: docCount ?? 0,
      chunk_count: chunkCount ?? 0,
    }).eq('id', kbId);

    setSaving(false);
    toast.success('Documento adicionado!');
    setNewDocOpen(false);
    setDocTitle(''); setDocContent(''); setDocSourceUrl('');
    queryClient.invalidateQueries({ queryKey: ['documents', selectedCollectionId] });
    queryClient.invalidateQueries({ queryKey: ['chunks'] });
  };

  const handleDeleteCollection = async (id: string) => {
    const { error } = await supabase.from('collections').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    if (selectedCollectionId === id) setSelectedCollectionId(null);
    toast.success('Collection removida');
    queryClient.invalidateQueries({ queryKey: ['collections', kbId] });
  };

  const handleDeleteDocument = async (id: string) => {
    await supabase.from('chunks').delete().eq('document_id', id);
    const { error } = await supabase.from('documents').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Documento removido');
    queryClient.invalidateQueries({ queryKey: ['documents', selectedCollectionId] });
    queryClient.invalidateQueries({ queryKey: ['chunks'] });
  };

  const selectedCollection = collections.find(c => c.id === selectedCollectionId);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
        <h2 className="text-lg font-heading font-semibold text-foreground">{kbName}</h2>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Collections panel */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-heading font-semibold text-muted-foreground uppercase tracking-wider">Collections</h3>
            <Dialog open={newCollOpen} onOpenChange={setNewCollOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1 text-xs h-7"><Plus className="h-3 w-3" /> Nova</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[400px]">
                <DialogHeader><DialogTitle>Nova Collection</DialogTitle></DialogHeader>
                <div className="space-y-3 mt-2">
                  <div className="space-y-1"><Label className="text-xs">Nome *</Label><Input value={collName} onChange={e => setCollName(e.target.value)} className="bg-secondary/50" placeholder="Ex: FAQs" /></div>
                  <div className="space-y-1"><Label className="text-xs">Descrição</Label><Input value={collDesc} onChange={e => setCollDesc(e.target.value)} className="bg-secondary/50" /></div>
                  <Button onClick={handleCreateCollection} disabled={saving} className="w-full nexus-gradient-bg text-primary-foreground">
                    {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Criar
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {loadingColls ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : collections.length === 0 ? (
            <div className="text-center py-8">
              <FolderOpen className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Nenhuma collection. Crie uma para organizar documentos.</p>
            </div>
          ) : (
            collections.map((coll, i) => (
              <motion.div
                key={coll.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className={`nexus-card cursor-pointer p-3 group ${selectedCollectionId === coll.id ? 'border-primary/40 nexus-glow-sm' : ''}`}
                onClick={() => setSelectedCollectionId(coll.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <FolderOpen className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-sm font-medium text-foreground truncate">{coll.name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100" onClick={e => e.stopPropagation()}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Excluir collection?</AlertDialogTitle><AlertDialogDescription>Todos os documentos e chunks serão removidos.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteCollection(coll.id)} className="bg-destructive text-destructive-foreground">Excluir</AlertDialogAction></AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                  </div>
                </div>
                {coll.description && <p className="text-[10px] text-muted-foreground mt-1 truncate">{coll.description}</p>}
              </motion.div>
            ))
          )}
        </div>

        {/* Documents panel */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-heading font-semibold text-muted-foreground uppercase tracking-wider">
              Documentos {selectedCollection ? `— ${selectedCollection.name}` : ''}
            </h3>
            {selectedCollectionId && (
              <Dialog open={newDocOpen} onOpenChange={setNewDocOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1 text-xs h-7"><Plus className="h-3 w-3" /> Adicionar</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[480px]">
                  <DialogHeader><DialogTitle>Novo Documento</DialogTitle></DialogHeader>
                  <div className="space-y-3 mt-2">
                    <div className="space-y-1"><Label className="text-xs">Título *</Label><Input value={docTitle} onChange={e => setDocTitle(e.target.value)} className="bg-secondary/50" placeholder="Ex: Guia de uso" /></div>
                    <div className="space-y-1"><Label className="text-xs">URL da fonte (opcional)</Label><Input value={docSourceUrl} onChange={e => setDocSourceUrl(e.target.value)} className="bg-secondary/50" placeholder="https://..." /></div>
                    <div className="space-y-1"><Label className="text-xs">Conteúdo (opcional — cria chunk automático)</Label><Textarea value={docContent} onChange={e => setDocContent(e.target.value)} className="bg-secondary/50" rows={5} placeholder="Cole o texto do documento aqui..." /></div>
                    <Button onClick={handleCreateDocument} disabled={saving} className="w-full nexus-gradient-bg text-primary-foreground">
                      {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Adicionar documento
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {!selectedCollectionId ? (
            <div className="text-center py-8"><p className="text-xs text-muted-foreground">Selecione uma collection à esquerda</p></div>
          ) : loadingDocs ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : documents.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Nenhum documento nesta collection.</p>
            </div>
          ) : (
            documents.map((doc, i) => (
              <motion.div key={doc.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className="nexus-card p-3 group">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 text-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{doc.title}</p>
                      <p className="text-[10px] text-muted-foreground">{doc.source_type} • {doc.status}</p>
                    </div>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100">
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader><AlertDialogTitle>Excluir documento?</AlertDialogTitle><AlertDialogDescription>Chunks associados serão removidos.</AlertDialogDescription></AlertDialogHeader>
                      <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteDocument(doc.id)} className="bg-destructive text-destructive-foreground">Excluir</AlertDialogAction></AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
                {doc.source_url && <p className="text-[10px] text-muted-foreground mt-1 truncate">{doc.source_url}</p>}
              </motion.div>
            ))
          )}
        </div>

        {/* Chunks panel */}
        <div className="space-y-3">
          <h3 className="text-xs font-heading font-semibold text-muted-foreground uppercase tracking-wider">
            Chunks <Badge variant="outline" className="text-[9px] ml-1">{chunks.length}</Badge>
          </h3>

          {!selectedCollectionId ? (
            <div className="text-center py-8"><p className="text-xs text-muted-foreground">Selecione uma collection</p></div>
          ) : loadingChunks ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : chunks.length === 0 ? (
            <div className="text-center py-8">
              <Hash className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Nenhum chunk encontrado.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {chunks.map((chunk, i) => (
                <motion.div key={chunk.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }} className="nexus-card p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <Badge variant="outline" className="text-[9px]">#{chunk.chunk_index}</Badge>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground">{chunk.token_count ?? 0} tokens</span>
                      <Badge variant={chunk.embedding_status === 'completed' ? 'default' : 'secondary'} className="text-[9px]">
                        {chunk.embedding_status}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-3">{chunk.content}</p>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
