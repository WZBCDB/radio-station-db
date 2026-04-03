-- Clear any existing free-text location values that aren't valid box letters
UPDATE public.media
SET location = NULL
WHERE location IS NOT NULL
  AND location !~ '^[A-X]$';

-- Add check constraint for box letter values
ALTER TABLE public.media
ADD CONSTRAINT media_location_box_letter
CHECK (location IS NULL OR location ~ '^[A-X]$');

-- Index for filtering by box
CREATE INDEX idx_media_location ON public.media(location)
WHERE location IS NOT NULL;
