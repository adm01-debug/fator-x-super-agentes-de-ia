import { useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { InfoHint } from "@/components/shared/InfoHint";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mic, Volume2, FileText, ImageIcon, PackageOpen, Loader2, Download, Play, Copy, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type AnyData = Record<string, unknown>;

type ToolResult = { data: AnyData | null; loading: boolean; error: string | null };

function useEdgeFunction() {
  const [result, setResult] = useState<ToolResult>({ data: null, loading: false, error: null });
  const invoke = async (fnName: string, body: AnyData) => {
    setResult({ data: null, loading: true, error: null });
    try {
      const { data, error } = await supabase.functions.invoke(fnName, { body });
      if (error) throw error;
      setResult({ data, loading: false, error: null });
      return data;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      setResult({ data: null, loading: false, error: msg });
      toast.error('Erro', { description: msg });
      return null;
    }
  };
  return { ...result, invoke };
}

function AudioTranscribeTab() {
  const { data, loading, invoke } = useEdgeFunction();
  const [audioUrl, setAudioUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const handleTranscribe = () => {
    if (!audioUrl.trim()) { toast.error('URL do áudio é obrigatória'); return; }
    invoke('audio-transcribe', { action: 'transcribe', audio_url: audioUrl });
  };
  const copyText = (text: string) => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>URL do Áudio</Label>
            <Input placeholder="https://example.com/audio.mp3" value={audioUrl} onChange={e => setAudioUrl(e.target.value)} />
            <p className="text-xs text-muted-foreground">Suporta MP3, WAV, FLAC, OGG</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleTranscribe} disabled={loading} className="flex-1">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mic className="h-4 w-4 mr-2" />}
              Transcrever (Whisper)
            </Button>
            <Button onClick={() => { if (!audioUrl.trim()) { toast.error('URL obrigatória'); return; } invoke('audio-transcribe', { action: 'classify', audio_url: audioUrl }); }} disabled={loading} variant="outline">
              Classificar
            </Button>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 p-4 min-h-[200px]">
          <div className="flex items-center justify-between mb-2">
            <Label className="text-xs text-muted-foreground">Resultado</Label>
            {data && <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => copyText(JSON.stringify(data, null, 2))}>{copied ? <CheckCircle className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}{copied ? 'Copiado' : 'Copiar'}</Button>}
          </div>
          {loading && <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}
          {data && !loading && (
            <div className="space-y-2">
              {data.text && <div className="p-3 rounded bg-background border text-sm whitespace-pre-wrap">{String(data.text)}</div>}
              {data.categories && <div className="space-y-1">{(data.categories as Array<{ label: string; score: number }>)?.map((c, i) => (<div key={i} className="flex items-center justify-between text-sm"><span>{c.label}</span><Badge variant="outline">{(c.score * 100).toFixed(1)}%</Badge></div>))}</div>}
              {data.latency_ms && <p className="text-xs text-muted-foreground">Latência: {String(data.latency_ms)}ms</p>}
            </div>
          )}
          {!data && !loading && <p className="text-sm text-muted-foreground text-center mt-8">Resultado aparecerá aqui</p>}
        </div>
      </div>
    </div>
  );
}

function TextToSpeechTab() {
  const { data, loading, invoke } = useEdgeFunction();
  const [text, setText] = useState('');
  const [language, setLanguage] = useState('pt');
  const handleSynthesize = async () => {
    if (!text.trim()) { toast.error('Texto é obrigatório'); return; }
    const result = await invoke('text-to-speech', { action: 'synthesize', text, language, return_format: 'base64' });
    if (result?.audio_base64) toast.success('Áudio gerado!');
  };
  const playAudio = () => { if (!data?.audio_base64) return; new Audio(`data:audio/wav;base64,${data.audio_base64}`).play(); };
  const downloadAudio = () => { if (!data?.audio_base64) return; const l = document.createElement('a'); l.href = `data:audio/wav;base64,${data.audio_base64}`; l.download = 'tts.wav'; l.click(); };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-4">
          <div className="space-y-2"><Label>Texto</Label><Textarea placeholder="Digite o texto..." value={text} onChange={e => setText(e.target.value)} rows={6} /></div>
          <div className="space-y-2">
            <Label>Idioma</Label>
            <Select value={language} onValueChange={setLanguage}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pt">🇧🇷 Português</SelectItem><SelectItem value="en">🇺🇸 English</SelectItem><SelectItem value="es">🇪🇸 Español</SelectItem></SelectContent></Select>
          </div>
          <Button onClick={handleSynthesize} disabled={loading} className="w-full">{loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Volume2 className="h-4 w-4 mr-2" />}Gerar Áudio</Button>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 p-4 min-h-[200px] flex flex-col items-center justify-center gap-4">
          {loading && <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />}
          {data?.audio_base64 && !loading && (<><Volume2 className="h-12 w-12 text-primary" /><p className="text-sm font-medium">Áudio gerado!</p><div className="flex gap-2"><Button onClick={playAudio} size="sm"><Play className="h-3.5 w-3.5 mr-1" /> Play</Button><Button onClick={downloadAudio} size="sm" variant="outline"><Download className="h-3.5 w-3.5 mr-1" /> Download</Button></div></>)}
          {!data && !loading && <p className="text-sm text-muted-foreground">Áudio aparecerá aqui</p>}
        </div>
      </div>
    </div>
  );
}

function DocOCRTab() {
  const { data, loading, invoke } = useEdgeFunction();
  const [imageUrl, setImageUrl] = useState('');
  const [mode, setMode] = useState('ocr');
  const handleProcess = () => { if (!imageUrl.trim()) { toast.error('URL obrigatória'); return; } invoke('doc-ocr', { action: mode, image_url: imageUrl }); };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-4">
          <div className="space-y-2"><Label>URL da Imagem/Documento</Label><Input placeholder="https://example.com/doc.png" value={imageUrl} onChange={e => setImageUrl(e.target.value)} /></div>
          <div className="space-y-2"><Label>Modo</Label><Select value={mode} onValueChange={setMode}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ocr">📄 OCR</SelectItem><SelectItem value="vdu">📊 VDU</SelectItem><SelectItem value="table_extract">📋 Tabelas</SelectItem></SelectContent></Select></div>
          <Button onClick={handleProcess} disabled={loading} className="w-full">{loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileText className="h-4 w-4 mr-2" />}Processar</Button>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 p-4 min-h-[200px] overflow-auto max-h-[400px]">
          {loading && <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}
          {data && !loading && <pre className="text-sm whitespace-pre-wrap bg-background p-3 rounded border">{data.text ? String(data.text) : JSON.stringify(data, null, 2)}</pre>}
          {!data && !loading && <p className="text-sm text-muted-foreground text-center mt-8">Resultado aparecerá aqui</p>}
        </div>
      </div>
    </div>
  );
}

function ImageAnalysisTab() {
  const { data, loading, invoke } = useEdgeFunction();
  const [imageUrl, setImageUrl] = useState('');
  const [action, setAction] = useState('classify');
  const handleAnalyze = () => { if (!imageUrl.trim()) { toast.error('URL obrigatória'); return; } invoke('image-analysis', { action, image_url: imageUrl }); };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-4">
          <div className="space-y-2"><Label>URL da Imagem</Label><Input placeholder="https://example.com/image.jpg" value={imageUrl} onChange={e => setImageUrl(e.target.value)} /></div>
          <div className="space-y-2"><Label>Ação</Label><Select value={action} onValueChange={setAction}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="classify">🏷️ Classificar</SelectItem><SelectItem value="detect_objects">🔍 Detectar Objetos</SelectItem><SelectItem value="nsfw_check">🛡️ NSFW Check</SelectItem><SelectItem value="remove_bg">✂️ Remover Fundo</SelectItem></SelectContent></Select></div>
          <Button onClick={handleAnalyze} disabled={loading} className="w-full">{loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ImageIcon className="h-4 w-4 mr-2" />}Analisar</Button>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 p-4 min-h-[200px] overflow-auto max-h-[400px]">
          {loading && <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}
          {data && !loading && (
            <div className="space-y-2">
              {data.labels && <div className="space-y-1">{(data.labels as Array<{ label: string; score: number }>).map((l, i) => (<div key={i} className="flex items-center justify-between text-sm"><span>{l.label}</span><Badge variant="outline">{(l.score * 100).toFixed(1)}%</Badge></div>))}</div>}
              {data.is_nsfw !== undefined && <div className="p-3 rounded bg-background border"><p className="font-medium text-sm">{data.is_nsfw ? '⚠️ NSFW' : '✅ Seguro'}</p></div>}
              {data.image_base64 && <img src={`data:image/png;base64,${data.image_base64}`} alt="Resultado" className="rounded max-w-full" />}
              {!data.labels && !data.is_nsfw && !data.image_base64 && <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(data, null, 2)}</pre>}
            </div>
          )}
          {!data && !loading && <p className="text-sm text-muted-foreground text-center mt-8">Resultado aparecerá aqui</p>}
        </div>
      </div>
    </div>
  );
}

function ProductMockupTab() {
  const { data, loading, invoke } = useEdgeFunction();
  const [imageUrl, setImageUrl] = useState('');
  const [action, setAction] = useState('generate_mockup');
  const [prompt, setPrompt] = useState('');
  const handleProcess = () => { if (!imageUrl.trim()) { toast.error('URL obrigatória'); return; } invoke('product-mockup', { action, image_url: imageUrl, ...(prompt && { prompt }) }); };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-4">
          <div className="space-y-2"><Label>URL da Imagem</Label><Input placeholder="https://example.com/product.jpg" value={imageUrl} onChange={e => setImageUrl(e.target.value)} /></div>
          <div className="space-y-2"><Label>Ação</Label><Select value={action} onValueChange={setAction}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="generate_mockup">🎨 Mockup</SelectItem><SelectItem value="upscale">🔍 Upscale</SelectItem><SelectItem value="inpaint">✏️ Inpaint</SelectItem><SelectItem value="segment">✂️ Segmentar</SelectItem></SelectContent></Select></div>
          {(action === 'generate_mockup' || action === 'inpaint') && <div className="space-y-2"><Label>Prompt</Label><Textarea placeholder="Descrição do cenário..." value={prompt} onChange={e => setPrompt(e.target.value)} rows={3} /></div>}
          <Button onClick={handleProcess} disabled={loading} className="w-full">{loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <PackageOpen className="h-4 w-4 mr-2" />}Processar</Button>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 p-4 min-h-[200px] flex flex-col items-center justify-center">
          {loading && <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />}
          {data?.image_base64 && !loading && (<div className="space-y-3 w-full"><img src={`data:image/png;base64,${data.image_base64}`} alt="Resultado" className="rounded max-w-full mx-auto" /><Button variant="outline" size="sm" className="w-full" onClick={() => { const l = document.createElement('a'); l.href = `data:image/png;base64,${data.image_base64}`; l.download = 'mockup.png'; l.click(); }}><Download className="h-3.5 w-3.5 mr-1" /> Download</Button></div>)}
          {data && !data.image_base64 && !loading && <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(data, null, 2)}</pre>}
          {!data && !loading && <p className="text-sm text-muted-foreground">Resultado aparecerá aqui</p>}
        </div>
      </div>
    </div>
  );
}

export default function AIStudioPage() {
  const [activeTab, setActiveTab] = useState('audio');
  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto animate-page-enter">
      <PageHeader title="🎨 AI Studio" description="Ferramentas de IA — Áudio, Visão, OCR, Geração de Imagens" gradient={false} />
      <InfoHint title="O que é o AI Studio?">
        O AI Studio reúne todas as ferramentas de IA: transcrição (Whisper), text-to-speech, OCR, análise de imagens e mockups de produtos. Todas usam HuggingFace Inference (gratuito).
      </InfoHint>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-secondary/50 border border-border/50 flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="audio" className="text-xs gap-1.5"><Mic className="h-3.5 w-3.5" /> Transcrição</TabsTrigger>
          <TabsTrigger value="tts" className="text-xs gap-1.5"><Volume2 className="h-3.5 w-3.5" /> TTS</TabsTrigger>
          <TabsTrigger value="ocr" className="text-xs gap-1.5"><FileText className="h-3.5 w-3.5" /> OCR</TabsTrigger>
          <TabsTrigger value="image" className="text-xs gap-1.5"><ImageIcon className="h-3.5 w-3.5" /> Imagem</TabsTrigger>
          <TabsTrigger value="mockup" className="text-xs gap-1.5"><PackageOpen className="h-3.5 w-3.5" /> Mockup</TabsTrigger>
        </TabsList>
        <TabsContent value="audio" className="mt-4"><AudioTranscribeTab /></TabsContent>
        <TabsContent value="tts" className="mt-4"><TextToSpeechTab /></TabsContent>
        <TabsContent value="ocr" className="mt-4"><DocOCRTab /></TabsContent>
        <TabsContent value="image" className="mt-4"><ImageAnalysisTab /></TabsContent>
        <TabsContent value="mockup" className="mt-4"><ProductMockupTab /></TabsContent>
      </Tabs>
    </div>
  );
}
