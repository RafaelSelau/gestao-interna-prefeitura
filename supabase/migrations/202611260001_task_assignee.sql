-- Add optional employee assignment to the existing personal task table.
-- Tasks remain owned by their creator; this does not broaden task visibility.
ALTER TABLE public.personal_tasks
  ADD COLUMN IF NOT EXISTS assigned_user_id BIGINT
  REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_personal_tasks_assigned_user
  ON public.personal_tasks(assigned_user_id)
  WHERE assigned_user_id IS NOT NULL;

-- Task forms need a minimal directory of active employees. Expose only these
-- columns; credentials, usernames, and profile contact details remain private.
GRANT SELECT (id, display_name, active) ON public.users TO authenticated;
DROP POLICY IF EXISTS users_task_assignees_read ON public.users;
CREATE POLICY users_task_assignees_read ON public.users FOR SELECT TO authenticated
  USING (public.sigam_api_request() AND active = 1);
