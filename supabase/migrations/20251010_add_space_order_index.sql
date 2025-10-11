-- Add order_index to spaces table for custom space ordering
ALTER TABLE public.spaces
ADD COLUMN IF NOT EXISTS order_index INTEGER;

-- Create index for better query performance when sorting by order_index
CREATE INDEX IF NOT EXISTS idx_spaces_user_order
ON public.spaces(user_id, order_index);

-- Add comment for documentation
COMMENT ON COLUMN public.spaces.order_index IS 'Custom ordering index for spaces (lower numbers appear first)';
