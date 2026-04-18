import { supabase } from "@/integrations/supabase/client";

export type ComplianceFramework = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  version: string | null;
};

export type ComplianceControl = {
  id: string;
  framework_id: string;
  code: string;
  category: string;
  title: string;
  description: string | null;
  evidence_type: string;
};

export type ComplianceReport = {
  id: string;
  workspace_id: string;
  framework_id: string;
  name: string;
  period_start: string;
  period_end: string;
  status: string;
  total_controls: number;
  passed_controls: number;
  failed_controls: number;
  na_controls: number;
  score: number | null;
  notes: string | null;
  generated_by: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ComplianceEvidence = {
  id: string;
  report_id: string;
  control_id: string;
  status: string;
  evidence_data: Record<string, unknown>;
  notes: string | null;
  collected_at: string;
};

export const complianceService = {
  async listFrameworks(): Promise<ComplianceFramework[]> {
    const { data, error } = await supabase
      .from("compliance_frameworks")
      .select("*")
      .order("code");
    if (error) throw error;
    return (data ?? []) as ComplianceFramework[];
  },

  async listControls(frameworkId: string): Promise<ComplianceControl[]> {
    const { data, error } = await supabase
      .from("compliance_controls")
      .select("*")
      .eq("framework_id", frameworkId)
      .order("code");
    if (error) throw error;
    return (data ?? []) as ComplianceControl[];
  },

  async listReports(workspaceId: string): Promise<ComplianceReport[]> {
    const { data, error } = await supabase
      .from("compliance_reports")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as ComplianceReport[];
  },

  async getReport(id: string): Promise<ComplianceReport | null> {
    const { data, error } = await supabase
      .from("compliance_reports")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data as ComplianceReport | null;
  },

  async listEvidence(reportId: string): Promise<ComplianceEvidence[]> {
    const { data, error } = await supabase
      .from("compliance_evidence")
      .select("*")
      .eq("report_id", reportId)
      .order("collected_at");
    if (error) throw error;
    return (data ?? []) as ComplianceEvidence[];
  },

  async generateReport(params: {
    workspaceId: string;
    frameworkCode: string;
    name: string;
    periodStart: string;
    periodEnd: string;
  }): Promise<string> {
    const { data, error } = await supabase.rpc("generate_compliance_report", {
      _workspace_id: params.workspaceId,
      _framework_code: params.frameworkCode,
      _name: params.name,
      _period_start: params.periodStart,
      _period_end: params.periodEnd,
    });
    if (error) throw error;
    return data as string;
  },

  async publishReport(id: string): Promise<void> {
    const { error } = await supabase.rpc("publish_compliance_report", {
      _report_id: id,
    });
    if (error) throw error;
  },

  async deleteReport(id: string): Promise<void> {
    const { error } = await supabase.from("compliance_reports").delete().eq("id", id);
    if (error) throw error;
  },
};
