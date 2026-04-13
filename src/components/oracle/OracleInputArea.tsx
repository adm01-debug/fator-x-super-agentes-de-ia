import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sparkles, Loader2, Settings2, ChevronDown, ChevronUp,
} from "lucide-react";
import { ORACLE_MODES } from "@/stores/oracleStore";
import type { OracleMode } from "@/stores/types/oracleTypes";
import { PresetSelector } from "@/components/oracle/PresetSelector";

const CHAIRMAN_MODELS = [
  { value: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  { value: 'openai/gpt-5', label: 'GPT-5' },
  { value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { value: 'openai/gpt-5-mini', label: 'GPT-5 Mini' },
];

interface OracleInputAreaProps {
  query: string;
  mode: OracleMode;
  selectedPreset: string;
  isRunning: boolean;
  enableThinking: boolean;
  chairmanModel: string;
  chairmanSelection: 'auto' | 'manual';
  currentPresetName?: string;
  currentPresetIcon?: string;
  modeConfig: { icon: string; label: string; stages: string[] };
  memberCount: number;
  onQueryChange: (q: string) => void;
  onPresetSelect: (id: string) => void;
  onChairmanModelChange: (m: string) => void;
  onChairmanSelectionChange: (s: 'auto' | 'manual') => void;
  onThinkingChange: (v: boolean) => void;
  onSubmit: () => void;
}

export function OracleInputArea({
  query, mode, isRunning, enableThinking, chairmanModel, chairmanSelection,
  currentPresetName, currentPresetIcon, modeConfig, memberCount,
  onQueryChange, onPresetSelect, onChairmanModelChange,
  onChairmanSelectionChange, onThinkingChange, onSubmit,
}: OracleInputAreaProps) {
  const [showPresets, setShowPresets] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="nexus-card space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPresets(!showPresets)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary/50 border border-border/50 hover:bg-secondary transition-colors"
          >
            <span className="text-sm">{currentPresetIcon || '🏛️'}</span>
            <span className="text-xs font-medium text-foreground">
              {currentPresetName?.replace(/^[^\s]+\s/, '') || 'Conselho Executivo'}
            </span>
            {showPresets ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
          </button>
          <Badge variant="outline" className="text-[11px]">{modeConfig.icon} {modeConfig.label}</Badge>
          <Badge variant="outline" className="text-[11px] text-muted-foreground">{memberCount} modelos</Badge>
        </div>
        <button onClick={() => setShowAdvanced(!showAdvanced)} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
          <Settings2 className="h-3.5 w-3.5" /> Avançado
        </button>
      </div>

      {showPresets && (
        <PresetSelector selectedPreset={''} onSelect={(id) => { onPresetSelect(id); setShowPresets(false); }} />
      )}

      {showAdvanced && (
        <div className="p-3 rounded-lg bg-secondary/30 border border-border/30 space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[11px]">Chairman (Sintetizador)</Label>
              <Select value={chairmanModel} onValueChange={onChairmanModelChange}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CHAIRMAN_MODELS.map(m => <SelectItem key={m.value} value={m.value} className="text-xs">{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px]">Seleção Chairman</Label>
              <Select value={chairmanSelection} onValueChange={(v) => onChairmanSelectionChange(v as 'auto' | 'manual')}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto" className="text-xs">🤖 Auto (por domínio)</SelectItem>
                  <SelectItem value="manual" className="text-xs">✋ Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-[11px]">💭 Modo Thinking</Label>
              <p className="text-[11px] text-muted-foreground">Mostra raciocínio passo-a-passo de cada modelo</p>
            </div>
            <Switch checked={enableThinking} onCheckedChange={onThinkingChange} />
          </div>
        </div>
      )}

      <Textarea placeholder="Faça sua pergunta ao conselho de IAs..." value={query} onChange={e => onQueryChange(e.target.value)}
        className="min-h-[100px] bg-secondary/50 border-border/50 text-sm" />

      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">{modeConfig.stages.join(' → ')}</p>
        <Button onClick={onSubmit} disabled={isRunning || !query.trim()} className="nexus-gradient-bg text-primary-foreground gap-2">
          {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {isRunning ? 'Consultando...' : '🔮 Convocar Conselho'}
        </Button>
      </div>
    </div>
  );
}

import { useState } from "react";
