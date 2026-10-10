/*
  # Contact form submission throttle

  1. New Tables
    - `contact_submission_throttle`
      - `id` (uuid, primary key)
      - `ip_hash` (text, not null) - SHA-256 hash of the caller IP, never the raw IP
      - `created_at` (timestamptz, default now())

  2. Security
    - RLS enabled with no policies: only the service-role edge function can
      read or write this table.
    - No privileges granted to anon or authenticated.
*/

CREATE TABLE IF NOT EXISTS public.contact_submission_throttle (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contact_submission_throttle ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.contact_submission_throttle FROM anon;
REVOKE ALL ON public.contact_submission_throttle FROM authenticated;

CREATE INDEX IF NOT EXISTS contact_submission_throttle_ip_time_idx
  ON public.contact_submission_throttle (ip_hash, created_at DESC);
