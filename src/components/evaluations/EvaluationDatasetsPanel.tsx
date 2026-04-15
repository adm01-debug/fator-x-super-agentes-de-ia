import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { listEvaluationDatasets, listTestCases, createEvaluationDataset, createTestCase, deleteTestCase, updateDatasetCaseCount } from '@/services/evaluationsService';
import { getWorkspaceId } from '@/lib/agentService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

import { Database, Plus, Loader2, Trash2, FileText, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

export function EvaluationDatasetsPanel() {
  const queryClient = useQueryClient();
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(null);
  const [newDsOpen, setNewDsOpen] = useState(false);
  const [newCaseOpen, setNewCaseOpen] = useState(false);
  const [dsName, setDsName] = useState('');
  const [dsDesc, setDsDesc] = useState('');
  const [caseInput, setCaseInput] = useState('');
  const [caseExpected, setCaseExpected] = useState('');
  const [caseTags, setCaseTags] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: datasets = [], isLoading } = useQuery({
    queryKey: ['evaluation_datasets'],
    queryFn: listEvaluationDatasets,
  });

  const { data: testCases = [], isLoading: loadingCases } = useQuery({
    queryKey: ['test_cases', selectedDatasetId],
    queryFn: () => selectedDatasetId ? listTestCases(selectedDatasetId) : Promise.resolve([]),
    enabled: !!selectedDatasetId,
  });

  const handleCreateDataset = async () => {
    if (!dsName.trim()) { toast.error('Nome é obrigatório'); return; }
    setSaving(true);
    try {
      const wsId = await getWorkspaceId();
      await createEvaluationDataset({
        name: dsName.trim(),
        description: dsDesc.trim(),
        workspace_id: wsId,
      });
      toast.success('Dataset criado!');
      setNewDsOpen(false);
      setDsName(''); setDsDesc('');
      queryClient.invalidateQueries({ queryKey: ['evaluation_datasets'] });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro inesperado');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateTestCase = async () => {
    if (!caseInput.trim() || !selectedDatasetId) { toast.error('Input é obrigatório'); return; }
    setSaving(true);
    try {
      await createTestCase({
        dataset_id: selectedDatasetId,
        input: caseInput.trim(),
        expected_output: caseExpected.trim() || undefined,
        tags: caseTags.trim() ? caseTags.split(',').map(t => t.trim()) : [],
      });
      await updateDatasetCaseCount(selectedDatasetId);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro'); setSaving(false); return;
    }

    toast.success('Test case adicionado!');
    setNewCaseOpen(false);
    setCaseInput(''); setCaseExpected(''); setCaseTags('');
    setSaving(false);
    queryClient.invalidateQueries({ queryKey: ['test_cases', selectedDatasetId] });
    queryClient.invalidateQueries({ queryKey: ['evaluation_datasets'] });
  };

  const handleDeleteTestCase = async (id: string) => {
    try {
      await deleteTestCase(id);
      toast.success('Test case removido');
      queryClient.invalidateQueries({ queryKey: ['test_cases', selectedDatasetId] });
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Erro'); }
  };

  const handleDeleteDataset = async (id: string) => {
    try {
      const { supabaseExternal } = await import('@/integrations/supabase/externalClient');
      await supabaseExternal.from('test_cases').delete().eq('dataset_id', id);
      await supabaseExternal.from('evaluation_datasets').delete().eq('id', id);
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Erro'); return; }
    if (selectedDatasetId === id) setSelectedDatasetId(null);
    toast.success('Dataset removido');
    queryClient.invalidateQueries({ queryKey: ['evaluation_datasets'] });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-heading font-semibold text-foreground">Datasets de avaliação</h3>
        <Dialog open={newDsOpen} onOpenChange={setNewDsOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs"><Plus className="h-3 w-3" /> Novo dataset</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[420px]">
            <DialogHeader><DialogTitle>Novo Dataset</DialogTitle></DialogHeader>
            <div className="space-y-3 mt-2">
              <div className="space-y-1"><Label className="text-xs">Nome *</Label><Input value={dsName} onChange={e => setDsName(e.target.value)} className="bg-secondary/50" placeholder="Ex: Factualidade v1" /></div>
              <div className="space-y-1"><Label className="text-xs">Descrição</Label><Input value={dsDesc} onChange={e => setDsDesc(e.target.value)} className="bg-secondary/50" /></div>
              <Button onClick={handleCreateDataset} disabled={saving} className="w-full nexus-gradient-bg text-primary-foreground">
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Criar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-4">
          {/* Datasets list */}
          <div className="space-y-2">
            {datasets.length === 0 ? (
              <div className="text-center py-8">
                <Database className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Nenhum dataset criado</p>
              </div>
            ) : (
              datasets.map((ds) => (
                <div
                  key={ds.id}
                  className={`nexus-card cursor-pointer p-3 group ${selectedDatasetId === ds.id ? 'border-primary/40 nexus-glow-sm' : ''}`}
                  onClick={() => setSelectedDatasetId(ds.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{ds.name}</p>
                      <p className="text-[11px] text-muted-foreground">{ds.case_count ?? 0} cases</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100" onClick={e => e.stopPropagation()}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader><AlertDialogTitle>Excluir dataset?</AlertDialogTitle><AlertDialogDescription>Todos os test cases serão removidos.</AlertDialogDescription></AlertDialogHeader>
                          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteDataset(ds.id)} className="bg-destructive text-destructive-foreground">Excluir</AlertDialogAction></AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Test cases */}
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-heading font-semibold text-muted-foreground uppercase tracking-wider">
                Test Cases {selectedDatasetId && <Badge variant="outline" className="text-[11px] ml-1">{testCases.length}</Badge>}
              </h4>
              {selectedDatasetId && (
                <Dialog open={newCaseOpen} onOpenChange={setNewCaseOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1 text-xs h-7"><Plus className="h-3 w-3" /> Adicionar</Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[480px]">
                    <DialogHeader><DialogTitle>Novo Test Case</DialogTitle></DialogHeader>
                    <div className="space-y-3 mt-2">
                      <div className="space-y-1"><Label className="text-xs">Input *</Label><Textarea value={caseInput} onChange={e => setCaseInput(e.target.value)} className="bg-secondary/50" rows={3} placeholder="Pergunta ou prompt de teste" /></div>
                      <div className="space-y-1"><Label className="text-xs">Output esperado</Label><Textarea value={caseExpected} onChange={e => setCaseExpected(e.target.value)} className="bg-secondary/50" rows={3} placeholder="Resposta correta esperada" /></div>
                      <div className="space-y-1"><Label className="text-xs">Tags (separadas por vírgula)</Label><Input value={caseTags} onChange={e => setCaseTags(e.target.value)} className="bg-secondary/50" placeholder="factualidade, safety" /></div>
                      <Button onClick={handleCreateTestCase} disabled={saving} className="w-full nexus-gradient-bg text-primary-foreground">
                        {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Adicionar
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            {!selectedDatasetId ? (
              <div className="text-center py-12"><p className="text-xs text-muted-foreground">Selecione um dataset à esquerda</p></div>
            ) : loadingCases ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : testCases.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Nenhum test case. Adicione casos para avaliar agentes.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {testCases.map((tc) => (
                  <div key={tc.id} className="nexus-card p-3 group">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex flex-wrap gap-1">
                        {(tc.tags ?? []).map(tag => <Badge key={tag} variant="secondary" className="text-[11px]">{tag}</Badge>)}
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 shrink-0">
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader><AlertDialogTitle>Excluir test case?</AlertDialogTitle></AlertDialogHeader>
                          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteTestCase(tc.id)} className="bg-destructive text-destructive-foreground">Excluir</AlertDialogAction></AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                    <div className="space-y-1.5">
                      <div><p className="text-[11px] font-semibold text-muted-foreground uppercase">Input</p><p className="text-xs text-foreground">{tc.input}</p></div>
                      {tc.expected_output && <div><p className="text-[11px] font-semibold text-muted-foreground uppercase">Expected</p><p className="text-xs text-foreground">{tc.expected_output}</p></div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
