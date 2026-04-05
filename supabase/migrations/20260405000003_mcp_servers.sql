-- ═══════════════════════════════════════════════════════════════
-- Nexus Agents Studio — MCP Servers Table
-- ETAPA 06: MCP Client infrastructure
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.mcp_servers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  transport TEXT DEFAULT 'streamable-http',  -- 'streamable-http', 'sse'
  auth_type TEXT DEFAULT 'none',             -- 'none', 'bearer', 'oauth2', 'api_key'
  auth_config JSONB DEFAULT '{}',
  status TEXT DEFAULT 'disconnected',        -- 'connected', 'disconnected', 'error'
  tools_discovered JSONB DEFAULT '[]',       -- Array of {name, description, inputSchema}
  resources_discovered JSONB DEFAULT '[]',
  error TEXT,
  is_active BOOLEAN DEFAULT true,
  last_connected_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mcp_servers_workspace ON public.mcp_servers(workspace_id);
CREATE INDEX IF NOT EXISTS idx_mcp_servers_active ON public.mcp_servers(is_active, status);

ALTER TABLE public.mcp_servers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own workspace MCP servers"
  ON public.mcp_servers FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role manages MCP servers"
  ON public.mcp_servers FOR ALL
  USING (auth.role() = 'service_role');

-- Seed: 5 popular MCP servers (pre-configured, inactive by default)
INSERT INTO public.mcp_servers (name, url, transport, status, tools_discovered, is_active) VALUES
  ('GitHub', 'https://api.github.com/mcp', 'streamable-http', 'disconnected', '[]', false),
  ('Google Drive', 'https://gdrive.mcp.claude.com/mcp', 'streamable-http', 'disconnected', '[]', false),
  ('Slack', 'https://slack.mcp.claude.com/mcp', 'streamable-http', 'disconnected', '[]', false),
  ('PostgreSQL', 'https://postgres.mcp.server/mcp', 'streamable-http', 'disconnected', '[]', false),
  ('Composio (500+ Apps)', 'https://mcp.composio.dev', 'streamable-http', 'disconnected', '[]', false)
ON CONFLICT DO NOTHING;
