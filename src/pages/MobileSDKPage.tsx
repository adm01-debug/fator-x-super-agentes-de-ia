import { useState } from "react";
import { Smartphone, Apple, Code2, Copy, Download, Smartphone as Phone, Tablet, Watch } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/PageHeader";
import { toast } from "sonner";

const SDK_VERSIONS = [
  { platform: "iOS", version: "1.4.2", lang: "Swift 5.9", min: "iOS 15+", icon: Apple, downloads: "12.4k" },
  { platform: "Android", version: "1.4.2", lang: "Kotlin 1.9", min: "API 24+", icon: Smartphone, downloads: "18.7k" },
  { platform: "React Native", version: "1.4.0", lang: "TS", min: "RN 0.72+", icon: Code2, downloads: "8.2k" },
  { platform: "Flutter", version: "1.3.8", lang: "Dart 3.2", min: "Flutter 3.16+", icon: Code2, downloads: "5.1k" },
];

const SNIPPETS: Record<string, string> = {
  iOS: `import NexusAgents

let client = NexusClient(apiKey: "nx_xxx")
let agent = client.agent(id: "agt_001")

let response = try await agent.chat("Olá!")
print(response.text)`,
  Android: `import app.fatorx.nexus.NexusClient

val client = NexusClient(apiKey = "nx_xxx")
val agent = client.agent("agt_001")

val response = agent.chat("Olá!")
println(response.text)`,
  "React Native": `import { NexusClient } from '@fatorx/nexus-rn';

const client = new NexusClient({ apiKey: 'nx_xxx' });
const agent = client.agent('agt_001');

const response = await agent.chat('Olá!');
console.log(response.text);`,
  Flutter: `import 'package:nexus_agents/nexus_agents.dart';

final client = NexusClient(apiKey: 'nx_xxx');
final agent = client.agent('agt_001');

final response = await agent.chat('Olá!');
print(response.text);`,
};

export default function MobileSDKPage() {
  const [selected, setSelected] = useState("iOS");
  const snippet = SNIPPETS[selected];

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto animate-page-enter">
      <PageHeader
        title="Mobile SDK"
        description="SDKs nativos para iOS, Android, React Native e Flutter — embarque agentes Nexus em qualquer app mobile."
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {SDK_VERSIONS.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.platform}
              onClick={() => setSelected(s.platform)}
              className={`p-4 rounded-lg border-2 text-left transition-all ${selected === s.platform ? "border-primary bg-primary/8 shadow-md" : "border-border/40 hover:border-border"}`}
            >
              <Icon className="h-6 w-6 mb-2 text-primary" />
              <div className="text-sm font-semibold">{s.platform}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">v{s.version} · {s.lang}</div>
              <div className="text-[10px] text-muted-foreground/70 mt-1">{s.min} · {s.downloads} downloads</div>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
        <Card>
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2"><Code2 className="h-4 w-4" />Quickstart {selected}</CardTitle>
            <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(snippet); toast.success("Snippet copiado"); }}>
              <Copy className="h-3.5 w-3.5 mr-1" />Copiar
            </Button>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="install">
              <TabsList>
                <TabsTrigger value="install">1. Instalação</TabsTrigger>
                <TabsTrigger value="init">2. Init</TabsTrigger>
                <TabsTrigger value="chat">3. Chat</TabsTrigger>
                <TabsTrigger value="streaming">4. Streaming</TabsTrigger>
              </TabsList>
              <TabsContent value="install">
                <pre className="text-xs bg-muted/30 p-4 rounded font-mono overflow-x-auto">
{selected === "iOS" && `# Package.swift
.package(url: "https://github.com/fatorx/nexus-ios", from: "1.4.2")`}
{selected === "Android" && `// build.gradle
implementation("app.fatorx:nexus-agents:1.4.2")`}
{selected === "React Native" && `npm install @fatorx/nexus-rn
# ou
yarn add @fatorx/nexus-rn`}
{selected === "Flutter" && `# pubspec.yaml
dependencies:
  nexus_agents: ^1.3.8`}
                </pre>
              </TabsContent>
              <TabsContent value="init">
                <pre className="text-xs bg-muted/30 p-4 rounded font-mono overflow-x-auto">{snippet}</pre>
              </TabsContent>
              <TabsContent value="chat">
                <pre className="text-xs bg-muted/30 p-4 rounded font-mono overflow-x-auto">{snippet}</pre>
              </TabsContent>
              <TabsContent value="streaming">
                <pre className="text-xs bg-muted/30 p-4 rounded font-mono overflow-x-auto">
{`for await chunk in agent.streamChat("Olá!") {
  print(chunk.delta)
}`}
                </pre>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Recursos suportados</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-xs">
              {[
                { name: "Chat (sync + streaming)", on: true },
                { name: "Voice (mic + speaker)", on: true },
                { name: "Vision (câmera + galeria)", on: true },
                { name: "Tool calls", on: true },
                { name: "Push notifications", on: true },
                { name: "Offline cache", on: true },
                { name: "Biometric auth", on: true },
                { name: "WatchOS / Wear OS", on: false },
              ].map((f) => (
                <div key={f.name} className="flex items-center justify-between">
                  <span>{f.name}</span>
                  <Badge variant={f.on ? "default" : "outline"} className="text-[10px]">{f.on ? "✓" : "Em breve"}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Form factors</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-3 gap-2 text-center">
              <div className="p-3 rounded-md bg-primary/8"><Phone className="h-5 w-5 mx-auto text-primary" /><div className="text-[10px] mt-1">Phone</div></div>
              <div className="p-3 rounded-md bg-primary/8"><Tablet className="h-5 w-5 mx-auto text-primary" /><div className="text-[10px] mt-1">Tablet</div></div>
              <div className="p-3 rounded-md bg-muted/30"><Watch className="h-5 w-5 mx-auto text-muted-foreground" /><div className="text-[10px] mt-1">Watch</div></div>
            </CardContent>
          </Card>

          <Button className="w-full" variant="outline"><Download className="h-4 w-4 mr-2" />Baixar exemplo completo</Button>
        </div>
      </div>
    </div>
  );
}
