/*
  # Restrict contact_messages writes to the edge function

  1. Security
    - Drop the permissive "Public can submit contact messages" INSERT policy
      (WITH CHECK (true) granted to anon/authenticated allowed unlimited,
      unvalidated direct inserts through the Data API).
    - Revoke all table privileges from anon and authenticated. The
      contact-form edge function authenticates with the service role key,
      which bypasses RLS and grants, so the legitimate write path is
      unaffected.
    - Add length constraints so the database enforces the same bounds the
      edge function applies.
*/

DROP POLICY IF EXISTS "Public can submit contact messages" ON public.contact_messages;

REVOKE ALL ON public.contact_messages FROM anon;
REVOKE ALL ON public.contact_messages FROM authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contact_messages_name_length_check'
  ) THEN
    ALTER TABLE public.contact_messages
      ADD CONSTRAINT contact_messages_name_length_check
      CHECK (name IS NULL OR char_length(name) <= 200);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contact_messages_email_length_check'
  ) THEN
    ALTER TABLE public.contact_messages
      ADD CONSTRAINT contact_messages_email_length_check
      CHECK (email IS NULL OR char_length(email) <= 320);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contact_messages_message_length_check'
  ) THEN
    ALTER TABLE public.contact_messages
      ADD CONSTRAINT contact_messages_message_length_check
      CHECK (char_length(message) > 0 AND char_length(message) <= 10000);
  END IF;
END $$;
