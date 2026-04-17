import { supabase } from "@/integrations/supabase/client";

export interface VoiceTurn {
  role: "user" | "assistant";
  text: string;
  ts: string;
}

export interface VoiceSession {
  id: string;
  user_id: string;
  workspace_id: string | null;
  agent_id: string | null;
  status: "active" | "ended" | "error";
  started_at: string;
  ended_at: string | null;
  duration_ms: number;
  transcript: VoiceTurn[];
  audio_in_seconds: number;
  audio_out_seconds: number;
  cost_cents: number;
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export async function startSession(agentId: string | null): Promise<VoiceSession> {
  const { data, error } = await supabase.functions.invoke("voice-session", { body: { action: "start", agent_id: agentId } });
  if (error) throw error;
  return data as VoiceSession;
}

export async function endSession(sessionId: string): Promise<VoiceSession> {
  const { data, error } = await supabase.functions.invoke("voice-session", { body: { action: "end", session_id: sessionId } });
  if (error) throw error;
  return data as VoiceSession;
}

export async function transcribeAudio(blob: Blob, sessionId: string): Promise<{ text: string; duration_seconds: number }> {
  const audio_base64 = await blobToBase64(blob);
  const { data, error } = await supabase.functions.invoke("voice-transcribe", {
    body: { audio_base64, mime_type: blob.type || "audio/webm", session_id: sessionId },
  });
  if (error) throw error;
  return data as { text: string; duration_seconds: number };
}

export async function synthesizeReply(userText: string, sessionId: string, agentId: string | null): Promise<{ reply: string; cost_cents: number }> {
  const { data, error } = await supabase.functions.invoke("voice-synthesize", {
    body: { user_text: userText, session_id: sessionId, agent_id: agentId },
  });
  if (error) throw error;
  return data as { reply: string; cost_cents: number };
}

export async function listSessions(limit = 50): Promise<VoiceSession[]> {
  const { data, error } = await supabase
    .from("voice_sessions")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as any[]) as VoiceSession[];
}

export async function getSession(id: string): Promise<VoiceSession | null> {
  const { data, error } = await supabase.from("voice_sessions").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as VoiceSession | null;
}

export async function deleteSession(id: string): Promise<void> {
  const { error } = await supabase.from("voice_sessions").delete().eq("id", id);
  if (error) throw error;
}

export function speakText(text: string, lang = "pt-BR"): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return resolve();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = lang;
    utter.rate = 1.05;
    const voices = window.speechSynthesis.getVoices();
    const ptVoice = voices.find((v) => v.lang.startsWith("pt"));
    if (ptVoice) utter.voice = ptVoice;
    utter.onend = () => resolve();
    utter.onerror = () => resolve();
    window.speechSynthesis.speak(utter);
  });
}

export function stopSpeaking() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}
