-- Prevent duplicate phone numbers at signup. No existing duplicates found
-- before adding this, so it's safe as a hard constraint (defense against a
-- race between the pre-check RPC below and the actual insert). NULLs
-- (admin accounts have no phone) remain distinct under a unique constraint,
-- so this doesn't block multiple admin-style rows with no phone.
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_phone_number_unique UNIQUE (phone_number);

-- Lets the registration form check "is this phone already registered?"
-- before submitting, without exposing any other profile data - RLS on
-- profiles restricts SELECT to the row's own owner, so an anonymous
-- visitor can't otherwise see whether a phone number is taken.
CREATE OR REPLACE FUNCTION public.is_phone_registered(p_phone text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE phone_number = p_phone);
$$;

GRANT EXECUTE ON FUNCTION public.is_phone_registered(text) TO anon, authenticated;

-- What kind of food/beverage business this is - drives the icon-based
-- picker on signup (restaurant/cafe/bakery/sweets/other).
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS business_type text;
