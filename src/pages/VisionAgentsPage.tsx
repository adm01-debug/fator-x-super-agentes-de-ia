import { useState, useRef } from 'react';
import { Eye, Upload, Image as ImageIcon, Sparkles, FileSearch, Crop, Tag } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/shared/PageHeader';
import { toast } from 'sonner';

type Detection = { label: string; confidence: number; bbox: [number, number, number, number] };

export default function VisionAgentsPage() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<{
    caption: string;
    tags: string[];
    ocr: string;
    detections: Detection[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [prompt, setPrompt] = useState(
    'Descreva a imagem em detalhes e extraia todo texto visível.',
  );
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = (file: File) => {
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    setAnalysis(null);
  };

  const analyze = async () => {
    if (!imageUrl) return;
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1400));
    setAnalysis({
      caption:
        'Captura de tela de um dashboard de analytics mostrando gráficos de barras coloridos com métricas de vendas mensais. O canto superior direito exibe um menu de navegação e um avatar de usuário.',
      tags: ['dashboard', 'analytics', 'gráfico', 'interface', 'dados', 'vendas', 'métrica'],
      ocr: 'Vendas Mensais\nJaneiro: R$ 142.580\nFevereiro: R$ 168.920\nMarço: R$ 201.450\nTotal Q1: R$ 512.950',
      detections: [
        { label: 'chart', confidence: 0.97, bbox: [80, 120, 480, 380] },
        { label: 'text', confidence: 0.94, bbox: [40, 40, 320, 80] },
        { label: 'button', confidence: 0.89, bbox: [560, 50, 640, 90] },
        { label: 'avatar', confidence: 0.92, bbox: [680, 30, 740, 90] },
      ],
    });
    setLoading(false);
    toast.success('Imagem analisada');
  };

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto animate-page-enter">
      <PageHeader
        title="Vision Agents"
        description="Agentes que enxergam — caption, OCR, detecção de objetos, segmentação de UI. Powered by GPT-4o Vision e Gemini Pro Vision."
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-4">
        <Card>
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <ImageIcon className="h-4 w-4" />
              Imagem
            </CardTitle>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
            />
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload className="h-3.5 w-3.5 mr-1" />
              Upload
            </Button>
          </CardHeader>
          <CardContent>
            {!imageUrl ? (
              <div
                onClick={() => fileRef.current?.click()}
                className="aspect-video border-2 border-dashed border-border/50 rounded-md flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    (e.currentTarget as HTMLElement).click();
                  }
                }}
              >
                <Upload className="h-10 w-10 text-muted-foreground/40 mb-2" />
                <div className="text-sm text-muted-foreground">Clique ou arraste uma imagem</div>
                <div className="text-[11px] text-muted-foreground/70 mt-1">
                  JPG, PNG, WebP até 10MB
                </div>
              </div>
            ) : (
              <div className="relative rounded-md overflow-hidden border border-border/40">
                <img src={imageUrl} alt="Análise" className="w-full h-auto" />
                {analysis?.detections.map((d, i) => (
                  <div
                    key={i}
                    className="absolute border-2 border-primary/80 bg-primary/10"
                    style={{
                      left: `${(d.bbox[0] / 800) * 100}%`,
                      top: `${(d.bbox[1] / 450) * 100}%`,
                      width: `${((d.bbox[2] - d.bbox[0]) / 800) * 100}%`,
                      height: `${((d.bbox[3] - d.bbox[1]) / 450) * 100}%`,
                    }}
                  >
                    <span className="absolute -top-5 left-0 text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded font-mono">
                      {d.label} {(d.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            )}
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Pergunta sobre a imagem..."
              className="mt-3 min-h-[80px]"
            />
            <Button onClick={analyze} disabled={!imageUrl || loading} className="w-full mt-3">
              <Sparkles className="h-4 w-4 mr-2" />
              {loading ? 'Analisando...' : 'Analisar com Vision'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Resultado
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!analysis && (
              <div className="text-center text-sm text-muted-foreground py-12">
                Faça upload e analise uma imagem
              </div>
            )}
            {analysis && (
              <Tabs defaultValue="caption">
                <TabsList className="w-full">
                  <TabsTrigger value="caption" className="flex-1">
                    <FileSearch className="h-3 w-3 mr-1" />
                    Caption
                  </TabsTrigger>
                  <TabsTrigger value="ocr" className="flex-1">
                    OCR
                  </TabsTrigger>
                  <TabsTrigger value="objects" className="flex-1">
                    <Crop className="h-3 w-3 mr-1" />
                    Objetos
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="caption" className="space-y-3">
                  <div className="text-sm leading-relaxed">{analysis.caption}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {analysis.tags.map((t) => (
                      <Badge key={t} variant="outline" className="text-[10px]">
                        <Tag className="h-2.5 w-2.5 mr-0.5" />
                        {t}
                      </Badge>
                    ))}
                  </div>
                </TabsContent>
                <TabsContent value="ocr">
                  <pre className="text-xs bg-muted/30 p-3 rounded font-mono whitespace-pre-wrap">
                    {analysis.ocr}
                  </pre>
                </TabsContent>
                <TabsContent value="objects">
                  <div className="space-y-1.5">
                    {analysis.detections.map((d, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-2 bg-muted/30 rounded text-xs"
                      >
                        <span className="font-medium">{d.label}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary"
                              style={{ width: `${d.confidence * 100}%` }}
                            />
                          </div>
                          <span className="font-mono text-muted-foreground w-10 text-right">
                            {(d.confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
