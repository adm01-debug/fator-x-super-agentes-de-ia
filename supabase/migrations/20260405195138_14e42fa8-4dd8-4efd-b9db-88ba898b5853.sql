
-- Fix consent_records: change from public to authenticated role
DROP POLICY IF EXISTS "Users can manage own consents" ON public.consent_records;
DROP POLICY IF EXISTS "Users can update own consents" ON public.consent_records;
DROP POLICY IF EXISTS "Users can view own consents" ON public.consent_records;

CREATE POLICY "Users can manage own consents"
ON public.consent_records FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own consents"
ON public.consent_records FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can view own consents"
ON public.consent_records FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Fix data_deletion_requests: change from public to authenticated role
DROP POLICY IF EXISTS "Users can create deletion requests" ON public.data_deletion_requests;
DROP POLICY IF EXISTS "Users can view own deletion requests" ON public.data_deletion_requests;

CREATE POLICY "Users can create deletion requests"
ON public.data_deletion_requests FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own deletion requests"
ON public.data_deletion_requests FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
