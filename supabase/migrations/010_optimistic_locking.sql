-- Add version_lock for optimistic locking on agents table
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS version_lock INTEGER DEFAULT 1;

-- Create function to check version before update
CREATE OR REPLACE FUNCTION public.check_agent_version_lock()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.version_lock != NEW.version_lock - 1 THEN
    RAISE EXCEPTION 'Concurrent modification detected. Please refresh and try again.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Only create trigger if it doesn't already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'agents_version_lock_check'
  ) THEN
    CREATE TRIGGER agents_version_lock_check
      BEFORE UPDATE ON public.agents
      FOR EACH ROW
      WHEN (NEW.version_lock IS NOT NULL)
      EXECUTE FUNCTION public.check_agent_version_lock();
  END IF;
END;
$$;
