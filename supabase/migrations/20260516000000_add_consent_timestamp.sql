-- Add consent timestamp to track when users agreed to the privacy policy
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;

-- Backfill existing beta users (voluntary early access, app was in use before this gate)
UPDATE public.users
  SET terms_accepted_at = NOW()
  WHERE terms_accepted_at IS NULL;

-- Update trigger to stamp consent timestamp at account creation.
-- New users see the "By continuing, you agree" notice on the login page
-- before clicking Continue or Continue with Google — this records that moment.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, display_name, terms_accepted_at)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
