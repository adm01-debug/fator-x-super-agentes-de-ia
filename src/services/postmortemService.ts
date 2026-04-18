import { supabase } from "@/integrations/supabase/client";

export type PostmortemSeverity = "SEV1" | "SEV2" | "SEV3" | "SEV4";
export type PostmortemStatus = "draft" | "review" | "published";
export type PostmortemSource = "incident_run" | "game_day" | "dr_drill" | "manual";
export type ActionPriority = "P0" | "P1" | "P2";
export type ActionStatus = "open" | "in_progress" | "done" | "cancelled";

export interface TimelineEvent {
  at: string;
  event: string;
  detail?: string;
}

export interface Postmortem {
  id: string;
  workspace_id: string;
  title: string;
  incident_source: PostmortemSource;
  source_id: string | null;
  severity: PostmortemSeverity;
  status: PostmortemStatus;
  summary: string | null;
  timeline: TimelineEvent[];
  root_cause: string | null;
  contributing_factors: string[];
  what_went_well: string[];
  what_went_wrong: string[];
  lessons_learned: string | null;
  author_id: string;
  reviewer_id: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ActionItem {
  id: string;
  postmortem_id: string;
  description: string;
  owner_id: string | null;
  owner_name: string | null;
  due_date: string | null;
  priority: ActionPriority;
  status: ActionStatus;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function listPostmortems(workspaceId: string): Promise<Postmortem[]> {
  const { data, error } = await supabase
    .from("postmortems")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as unknown as Postmortem[];
}

export async function getPostmortem(id: string): Promise<Postmortem | null> {
  const { data, error } = await supabase.from("postmortems").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as unknown as Postmortem | null;
}

export async function createManualPostmortem(input: {
  workspace_id: string;
  title: string;
  severity: PostmortemSeverity;
  summary?: string;
}): Promise<string> {
  const { data: u } = await supabase.auth.getUser();
  const author_id = u?.user?.id;
  if (!author_id) throw new Error("auth required");
  const { data, error } = await supabase
    .from("postmortems")
    .insert({
      workspace_id: input.workspace_id,
      title: input.title,
      severity: input.severity,
      summary: input.summary ?? null,
      incident_source: "manual",
      author_id,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function updatePostmortem(id: string, patch: Partial<Postmortem>): Promise<void> {
  const { error } = await supabase.from("postmortems").update(patch as never).eq("id", id);
  if (error) throw error;
}

export async function deletePostmortem(id: string): Promise<void> {
  const { error } = await supabase.from("postmortems").delete().eq("id", id);
  if (error) throw error;
}

export async function generateFromIncident(incidentRunId: string): Promise<string> {
  const { data, error } = await supabase.rpc("generate_postmortem_from_incident", {
    p_incident_run_id: incidentRunId,
  });
  if (error) throw error;
  return data as string;
}

export async function generateFromGameday(gameDayId: string): Promise<string> {
  const { data, error } = await supabase.rpc("generate_postmortem_from_gameday", {
    p_game_day_id: gameDayId,
  });
  if (error) throw error;
  return data as string;
}

export async function publishPostmortem(id: string): Promise<{ status: string; published_at: string; action_items: number }> {
  const { data, error } = await supabase.rpc("publish_postmortem", { p_postmortem_id: id });
  if (error) throw error;
  return data as { status: string; published_at: string; action_items: number };
}

export async function listActionItems(postmortemId: string): Promise<ActionItem[]> {
  const { data, error } = await supabase
    .from("postmortem_action_items")
    .select("*")
    .eq("postmortem_id", postmortemId)
    .order("priority", { ascending: true })
    .order("due_date", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data || []) as unknown as ActionItem[];
}

export async function createActionItem(item: Omit<ActionItem, "id" | "created_at" | "updated_at" | "completed_at">): Promise<ActionItem> {
  const { data, error } = await supabase
    .from("postmortem_action_items")
    .insert(item as never)
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as ActionItem;
}

export async function updateActionItem(id: string, patch: Partial<ActionItem>): Promise<void> {
  const next: Partial<ActionItem> = { ...patch };
  if (patch.status === "done" && !patch.completed_at) {
    next.completed_at = new Date().toISOString();
  }
  const { error } = await supabase.from("postmortem_action_items").update(next as never).eq("id", id);
  if (error) throw error;
}

export async function deleteActionItem(id: string): Promise<void> {
  const { error } = await supabase.from("postmortem_action_items").delete().eq("id", id);
  if (error) throw error;
}

// Recent sources for "Generate from..." picker
export async function listRecentIncidentRuns(workspaceId: string, limit = 20) {
  const { data, error } = await supabase
    .from("incident_runs")
    .select("id, started_at, status, triggered_by, playbook_id")
    .eq("workspace_id", workspaceId)
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function listRecentGameDays(workspaceId: string, limit = 20) {
  const { data, error } = await supabase
    .from("game_days")
    .select("id, title, scenario, status, started_at, ended_at")
    .eq("workspace_id", workspaceId)
    .in("status", ["completed", "cancelled"])
    .order("started_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}
