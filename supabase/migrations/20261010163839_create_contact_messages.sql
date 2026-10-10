/*
# Store contact form submissions

1. Plain-English explanation
   Visitors to the site's Contact & Disclaimer page can send a message. This
   migration creates a table that records every submitted message so none are
   ever lost, even if the email delivery step fails. Messages are emailed to
   the site owner by the contact-form edge function; this table is the durable
   backup.

2. New Tables
   - `contact_messages`
     - `id` (uuid, primary key, auto-generated)
     - `name` (text, optional — the visitor's name, may be blank)
     - `email` (text, optional — the visitor's email for replies, may be blank)
     - `message` (text, required — the message body)
     - `email_status` (text, tracks delivery: 'pending', 'sent', or 'failed')
     - `created_at` (timestamp with time zone, defaults to now)

3. Security
   - Row Level Security is ENABLED on `contact_messages`.
   - The public (anonymous visitors) may INSERT a message — that is the form.
   - Nobody may SELECT, UPDATE, or DELETE through the public key: messages are
     private and can only be viewed with the project's secret admin key.
*/

CREATE TABLE IF NOT EXISTS contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  email text,
  message text NOT NULL,
  email_status text NOT NULL DEFAULT 'pending'
    CHECK (email_status IN ('pending', 'sent', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can submit contact messages" ON contact_messages;
CREATE POLICY "Public can submit contact messages"
ON contact_messages FOR INSERT
TO anon, authenticated
WITH CHECK (true);
