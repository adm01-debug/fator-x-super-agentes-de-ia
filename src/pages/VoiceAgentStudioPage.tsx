import { useState, useRef, useEffect } from "react";
import { Mic, MicOff, Phone, PhoneOff, Volume2, Settings2, Activity, Waves } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PageHeader } from "@/components/shared/PageHeader";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

type Turn = { role: "user" | "agent"; text: string; ms: number; ts: string };

export default function VoiceAgentStudioPage() {
  const [connected, setConnected] = useState(false);
  const [recording, setRecording] = useState(false);
  const [vadEnabled, setVadEnabled] = useState(true);
  const [bargeIn, setBargeIn] = useState(true);
  const [voice, setVoice] = useState("alloy");
  const [latencyMs, setLatencyMs] = useState(380);
  const [vadThreshold, setVadThreshold] = useState([0.5]);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [audioLevel, setAudioLevel] = useState(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;
      setRecording(true);

      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setAudioLevel(avg / 255);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (e) {
      console.error(e);
    }
  };

  const stopRecording = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioCtxRef.current?.close();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setRecording(false);
    setAudioLevel(0);
  };

  useEffect(() => () => { stopRecording(); }, []);

  const toggleConnection = () => {
    if (connected) {
      stopRecording();
      setConnected(false);
    } else {
      setConnected(true);
      startRecording();
      setTurns([
        { role: "agent", text: "Olá! Sou o agente de voz. Como posso ajudar?", ms: 320, ts: new Date().toISOString() },
      ]);
    }
  };

  const simulateTurn = () => {
    const userTurn: Turn = { role: "user", text: "Quero saber sobre meus pedidos.", ms: 0, ts: new Date().toISOString() };
    setTurns((t) => [...t, userTurn]);
    setTimeout(() => {
      setTurns((t) => [...t, { role: "agent", text: "Claro! Encontrei 3 pedidos recentes. O mais recente é de 14/04, total de R$ 245,00.", ms: latencyMs, ts: new Date().toISOString() }]);
    }, latencyMs);
  };

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto animate-page-enter">
      <PageHeader
        title="Voice Agent Studio"
        description="Pipeline realtime STT ↔ LLM ↔ TTS com WebRTC, VAD e barge-in. Interface inspirada em Vapi/Retell."
        icon={Mic}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card className="border-primary/20">
            <CardContent className="p-8">
              <div className="flex flex-col items-center gap-6">
                <div className="relative">
                  <div
                    className={`w-32 h-32 rounded-full border-4 flex items-center justify-center transition-all ${connected ? "border-primary bg-primary/10 shadow-[0_0_40px_hsl(var(--primary)/0.4)]" : "border-border bg-muted/30"}`}
                    style={{ transform: `scale(${1 + audioLevel * 0.3})` }}
                  >
                    {connected ? <Mic className="h-14 w-14 text-primary" /> : <MicOff className="h-14 w-14 text-muted-foreground" />}
                  </div>
                  {connected && <div className="absolute -top-1 -right-1"><Badge className="bg-nexus-green text-white border-0">LIVE</Badge></div>}
                </div>

                <div className="text-center space-y-1">
                  <div className="text-sm font-medium">{connected ? "Conectado" : "Desconectado"}</div>
                  <div className="text-xs text-muted-foreground">Latência: <span className="text-foreground font-semibold">{latencyMs}ms</span> · VAD: {vadEnabled ? "on" : "off"} · Barge-in: {bargeIn ? "on" : "off"}</div>
                </div>

                <div className="flex gap-3">
                  <Button size="lg" variant={connected ? "destructive" : "default"} onClick={toggleConnection}>
                    {connected ? <><PhoneOff className="h-4 w-4 mr-2" />Encerrar</> : <><Phone className="h-4 w-4 mr-2" />Iniciar chamada</>}
                  </Button>
                  {connected && <Button size="lg" variant="outline" onClick={simulateTurn}><Waves className="h-4 w-4 mr-2" />Simular turno</Button>}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4" />Transcrição em tempo real</CardTitle></CardHeader>
            <CardContent>
              <ScrollArea className="h-[280px]">
                <div className="space-y-2">
                  {turns.length === 0 && <div className="text-center text-sm text-muted-foreground py-12">Aguardando início da chamada...</div>}
                  {turns.map((t, i) => (
                    <div key={i} className={`flex ${t.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] rounded-lg px-3 py-2 ${t.role === "user" ? "bg-primary/15 text-foreground" : "bg-muted/40 text-foreground"}`}>
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">{t.role === "user" ? "Você" : "Agente"} {t.ms > 0 && `· ${t.ms}ms`}</div>
                        <div className="text-sm">{t.text}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Settings2 className="h-4 w-4" />Configuração</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label className="text-xs">Voz TTS</Label>
              <Select value={voice} onValueChange={setVoice}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="alloy">Alloy (neutra)</SelectItem>
                  <SelectItem value="nova">Nova (feminina)</SelectItem>
                  <SelectItem value="echo">Echo (masculina)</SelectItem>
                  <SelectItem value="onyx">Onyx (grave)</SelectItem>
                  <SelectItem value="shimmer">Shimmer (suave)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Modelo STT</Label>
              <Select defaultValue="whisper-1">
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="whisper-1">Whisper v1</SelectItem>
                  <SelectItem value="whisper-large-v3">Whisper Large v3</SelectItem>
                  <SelectItem value="deepgram-nova-2">Deepgram Nova 2</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs"><Label>Threshold VAD</Label><span className="text-muted-foreground">{vadThreshold[0].toFixed(2)}</span></div>
              <Slider value={vadThreshold} onValueChange={setVadThreshold} min={0} max={1} step={0.05} />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs"><Label>Latência alvo (ms)</Label><span className="text-muted-foreground">{latencyMs}</span></div>
              <Slider value={[latencyMs]} onValueChange={(v) => setLatencyMs(v[0])} min={200} max={1500} step={50} />
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-xs">Voice Activity Detection</Label>
              <Switch checked={vadEnabled} onCheckedChange={setVadEnabled} />
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-xs">Barge-in (interrupção)</Label>
              <Switch checked={bargeIn} onCheckedChange={setBargeIn} />
            </div>

            <div className="pt-3 border-t border-border/40">
              <div className="text-xs text-muted-foreground mb-2 flex items-center gap-2"><Volume2 className="h-3 w-3" />Nível de áudio</div>
              <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-nexus-green to-nexus-amber transition-all" style={{ width: `${audioLevel * 100}%` }} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
