import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listCollectionsForKB,
  listDocuments,
  listChunksForDocuments,
  createCollectionForKB,
  deleteCollection,
  deleteDocument,
  createDocumentWithIngest,
  getDocumentCount,
  getChunkCountForCollection,
  updateKBCounts,
} from '@/services/knowledgeService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ArrowLeft, FolderOpen, FileText, Hash, Plus, Loader2, Trash2, ChevronRight } from 'lucide-react';
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

  const { data: collections = [], isLoading: loadingColls } = useQuery({
    queryKey: ['collections', kbId],
    queryFn: () => listCollectionsForKB(kbId),
  });

  const { data: documents = [], isLoading: loadingDocs } = useQuery({
    queryKey: ['documents', selectedCollectionId],
    queryFn: () => selectedCollectionId ? listDocuments(selectedCollectionId) : Promise.resolve([]),
    enabled: !!selectedCollectionId,
  });

  const selectedDocIds = documents.map(d => d.id);
  const { data: chunks = [], isLoading: loadingChunks } = useQuery({
    queryKey: ['chunks', selectedDocIds],
    queryFn: () => listChunksForDocuments(selectedDocIds),
    enabled: selectedDocIds.length > 0,
  });

  const handleCreateCollection = async () => {
    if (!collName.trim()) { toast.error('Nome é obrigatório'); return; }
    setSaving(true);
    try {
      await createCollectionForKB(kbId, collName.trim(), collDesc.trim());
      toast.success('Collection criada!');
      setNewCollOpen(false);
      setCollName(''); setCollDesc('');
      queryClient.invalidateQueries({ queryKey: ['collections', kbId] });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro');
    } finally { setSaving(false); }
  };

  const handleCreateDocument = async () => {
    if (!docTitle.trim() || !selectedCollectionId) { toast.error('Título é obrigatório'); return; }
    setSaving(true);
    try {
      const { ingestResult } = await createDocumentWithIngest(
        { title: docTitle.trim(), collection_id: selectedCollectionId, source_url: docSourceUrl.trim() || null, source_type: docSourceUrl.trim() ? 'url' : 'manual' },
        docContent,
      );
      if (ingestResult) {
        toast.success(`${(ingestResult as Record<string, number>)?.chunks_created || 0} chunks criados`);
      }

      const docCount = await getDocumentCount(selectedCollectionId);
      const allDocIds = [...documents.map(d => d.id)];
      const chunkCount = await getChunkCountForCollection(allDocIds);
      await updateKBCounts(kbId, docCount, chunkCount);

      toast.success('Documento adicionado!');
      setNewDocOpen(false);
      setDocTitle(''); setDocContent(''); setDocSourceUrl('');
      queryClient.invalidateQueries({ queryKey: ['documents', selectedCollectionId] });
      queryClient.invalidateQueries({ queryKey: ['chunks'] });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro');
    } finally { setSaving(false); }
  };

  const handleDeleteCollection = async (id: string) => {
    try {
      await deleteCollection(id);
      if (selectedCollectionId === id) setSelectedCollectionId(null);
      toast.success('Collection removida');
      queryClient.invalidateQueries({ queryKey: ['collections', kbId] });
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Erro'); }
  };

  const handleDeleteDocument = async (id: string) => {
    try {
      await deleteDocument(id);
      toast.success('Documento removido');
      queryClient.invalidateQueries({ queryKey: ['documents', selectedCollectionId] });
      queryClient.invalidateQueries({ queryKey: ['chunks'] });
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Erro'); }
  };

  const selectedCollection = collections.find(c => c.id === selectedCollectionId);

  return (
    <div className="space-y-4">
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
            collections.map((coll) => (
              <div
                key={coll.id}
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
                {coll.description && <p className="text-[11px] text-muted-foreground mt-1 truncate">{coll.description}</p>}
              </div>
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
            documents.map((doc) => (
              <div key={doc.id} className="nexus-card p-3 group">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 text-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{doc.title}</p>
                      <p className="text-[11px] text-muted-foreground">{doc.source_type} • {doc.status}</p>
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
                {doc.source_url && <p className="text-[11px] text-muted-foreground mt-1 truncate">{doc.source_url}</p>}
              </div>
            ))
          )}
        </div>

        {/* Chunks panel */}
        <div className="space-y-3">
          <h3 className="text-xs font-heading font-semibold text-muted-foreground uppercase tracking-wider">
            Chunks <Badge variant="outline" className="text-[11px] ml-1">{chunks.length}</Badge>
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
              {chunks.map((chunk) => (
                <div key={chunk.id} className="nexus-card p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <Badge variant="outline" className="text-[11px]">#{chunk.chunk_index}</Badge>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground">{chunk.token_count ?? 0} tokens</span>
                      <Badge variant={chunk.embedding_status === 'completed' ? 'default' : 'secondary'} className="text-[11px]">
                        {chunk.embedding_status}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-3">{chunk.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
