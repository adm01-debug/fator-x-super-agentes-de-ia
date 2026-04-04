-- Enable realtime for alerts and workflow_runs
ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.workflow_runs;