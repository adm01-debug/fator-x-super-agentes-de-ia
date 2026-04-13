import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Sparkles, Loader2, ChevronDown, ChevronUp, Settings2,
} from 'lucide-react';
import { useOracleStore, ORACLE_MODES, ORACLE_PRESETS } from '@/stores/oracleStore';
import { PresetSelector } from './PresetSelector';

const CHAIRMAN_MODELS = [
  { value: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  { value: 'openai/gpt-5', label: 'GPT-5' },
  { value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { value: 'openai/gpt-5-mini', label: 'GPT-5 Mini' },
];

export function OracleInputArea() {
  const store = useOracleStore();
  const [showPresets, setShowPresets] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const currentPreset = ORACLE_PRESETS.find((p) => p.id === store.selectedPreset);
  const modeConfig = ORACLE_MODES[store.mode];

  return (
    <div className="nexus-card space-y-4">
      {/* Mode & Preset selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPresets(!showPresets)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary/50 border border-border/50 hover:bg-secondary transition-colors"
          >
            <span className="text-sm">{currentPreset?.icon || '🏛️'}</span>
            <span className="text-xs font-medium text-foreground">
              {currentPreset?.name.replace(/^[^\s]+\s/, '') || 'Conselho Executivo'}
            </span>
            {showPresets ? (
              <ChevronUp className="h-3 w-3 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            )}
          </button>
          <Badge variant="outline" className="text-[11px]">
            {modeConfig.icon} {modeConfig.label}
          </Badge>
          <Badge variant="outline" className="text-[11px] text-muted-foreground">
            {currentPreset?.members.length || 3} modelos
          </Badge>
        </div>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <Settings2 className="h-3.5 w-3.5" />
          Avançado
        </button>
      </div>

      {/* Preset selector (collapsible) */}
      {showPresets && (
        <div className="overflow-hidden">
          <PresetSelector
            selectedPreset={store.selectedPreset}
            onSelect={(id) => {
              store.setSelectedPreset(id);
              setShowPresets(false);
            }}
          />
        </div>
      )}

      {/* Advanced settings (collapsible) */}
      {showAdvanced && (
        <div className="overflow-hidden">
          <div className="p-3 rounded-lg bg-secondary/30 border border-border/30 space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[11px]">Chairman (Sintetizador)</Label>
                <Select value={store.chairmanModel} onValueChange={store.setChairmanModel}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHAIRMAN_MODELS.map((m) => (
                      <SelectItem key={m.value} value={m.value} className="text-xs">
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px]">Seleção Chairman</Label>
                <Select
                  value={store.chairmanSelection}
                  onValueChange={(v) => store.setChairmanSelection(v as 'auto' | 'manual')}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
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
                <p className="text-[11px] text-muted-foreground">
                  Mostra raciocínio passo-a-passo de cada modelo
                </p>
              </div>
              <Switch checked={store.enableThinking} onCheckedChange={store.setEnableThinking} />
            </div>
          </div>
        </div>
      )}

      {/* Query input */}
      <Textarea
        placeholder="Faça sua pergunta ao conselho de IAs..."
        value={store.query}
        onChange={(e) => store.setQuery(e.target.value)}
        className="min-h-[100px] bg-secondary/50 border-border/50 text-sm"
      />

      {/* Submit */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">{modeConfig.stages.join(' → ')}</p>
        <Button
          onClick={store.submitQuery}
          disabled={store.isRunning || !store.query.trim()}
          className="nexus-gradient-bg text-primary-foreground gap-2"
        >
          {store.isRunning ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {store.isRunning ? 'Consultando...' : '🔮 Convocar Conselho'}
        </Button>
      </div>
    </div>
  );
}
