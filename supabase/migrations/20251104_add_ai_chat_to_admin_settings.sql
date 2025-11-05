-- Add AI chat settings to admin_settings table
-- Move AI chat model selection to be global (controlled by admin) instead of per-user

-- Add columns for AI chat and metadata model configuration
ALTER TABLE public.admin_settings
ADD COLUMN IF NOT EXISTS ai_chat_model TEXT DEFAULT 'gpt-4o-mini',
ADD COLUMN IF NOT EXISTS ai_metadata_model TEXT DEFAULT 'gpt-4o-mini',
ADD COLUMN IF NOT EXISTS ai_available_models JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS ai_last_models_fetch TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.admin_settings.ai_chat_model IS 'Global AI chat model used for all chat conversations (applies to all users)';
COMMENT ON COLUMN public.admin_settings.ai_metadata_model IS 'Global AI model used for metadata extraction and cleaning (applies to all users)';
COMMENT ON COLUMN public.admin_settings.ai_available_models IS 'Cached list of available OpenAI models (JSON array of model objects)';
COMMENT ON COLUMN public.admin_settings.ai_last_models_fetch IS 'Timestamp of last successful fetch of available models from OpenAI API';
