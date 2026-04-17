
Próximo da fila: **#8 Voice/Realtime Agents** (OpenAI Realtime API style, P1, esforço médio).

Estado atual: zero infra de voz. Sem captura de áudio, sem TTS/STT, sem sessões realtime.

## Plano

**Backend:**
1. Migration: tabela `voice_sessions` (id, user_id, workspace_id, agent_id, status: active/ended, started_at, ended_at, duration_ms, transcript jsonb [{role, text, ts}], audio_in_seconds, audio_out_seconds, cost_cents). RLS por user_id + workspace.
2. Edge function `voice-transcribe`: recebe áudio base64 (webm/wav, ≤10MB) + valida JWT/Zod → chama Lovable AI `google/gemini-2.5-flash` com input multimodal de áudio → retorna texto. Persiste turno no transcript.
3. Edge function `voice-synthesize`: recebe texto (≤2KB) → chama Lovable AI `google/gemini-2.5-flash` para gerar resposta + usa Web Speech API no cliente (TTS nativo do browser, zero custo extra) OU Gemini TTS quando disponível. Retorna texto da resposta + metadata.
4. Edge function `voice-session`: cria/encerra sessão, calcula custo agregado, persiste.

**Service `voiceAgentService.ts`:**
- startSession(agentId), endSession(id), transcribeAudio(blob), synthesizeReply(text), listSessions(), getSession(id).

**Frontend — nova `VoiceAgentsPage.tsx` em `/voice-agents`:**
- Hero: seletor de agente + botão grande "🎙 Iniciar conversa".
- Painel ativo: visualizador de waveform (canvas + AnalyserNode), indicador "ouvindo / processando / falando", transcript ao vivo com bubbles.
- Captura via `MediaRecorder` (webm/opus), VAD simples (silêncio 1.5s = enviar turno).
- TTS via `SpeechSynthesisUtterance` (voz pt-BR quando disponível).
- Histórico de sessões: duração, custo, link para replay (transcript completo).
- Métricas: total de minutos, custo acumulado.

**Integração:**
- Rota `/voice-agents` em `App.tsx`.
- Item no sidebar (ícone `Mic`).

**Validação:** `tsc` clean, fluxo end-to-end: gravar → transcrever → resposta → TTS → persistir.

**Arquivos:**
- migration `voice_sessions`
- `supabase/functions/voice-transcribe/index.ts` (novo)
- `supabase/functions/voice-synthesize/index.ts` (novo)
- `supabase/functions/voice-session/index.ts` (novo)
- `src/services/voiceAgentService.ts` (novo)
- `src/pages/VoiceAgentsPage.tsx` (novo)
- `src/components/voice/VoiceWaveform.tsx` (novo)
- `src/App.tsx` (rota)
- `src/components/layout/AppSidebar.tsx` (item menu)

**Nota:** TTS browser-side é zero custo e funciona offline; STT real via Gemini multimodal. Trocar por OpenAI Realtime WebRTC fica para iteração futura quando houver budget de baixa latência.
