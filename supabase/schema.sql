-- Memex Second Brain Database Schema
-- Based on PRD requirements

-- Enable Row Level Security
-- Note: ALTER DATABASE may not work in Supabase hosted environment

-- Users table (managed by Supabase Auth)
-- This table is automatically created by Supabase Auth

-- Items table
CREATE TABLE IF NOT EXISTS public.items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    url TEXT,
    content_type TEXT NOT NULL CHECK (content_type IN (
        'bookmark', 'youtube', 'x', 'github', 'instagram',
        'tiktok', 'reddit', 'amazon', 'linkedin', 'image',
        'pdf', 'video', 'audio', 'note', 'article', 'product',
        'book', 'course'
    )),
    content TEXT,
    "desc" TEXT,
    thumbnail_url TEXT,
    raw_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    is_archived BOOLEAN DEFAULT FALSE NOT NULL
);

-- Item Metadata table
CREATE TABLE IF NOT EXISTS public.item_metadata (
    item_id UUID PRIMARY KEY REFERENCES public.items(id) ON DELETE CASCADE,
    domain TEXT,
    author TEXT,
    username TEXT,
    profile_image TEXT,
    published_date DATE
);

-- Item Type Metadata table (for platform-specific data)
CREATE TABLE IF NOT EXISTS public.item_type_metadata (
    item_id UUID PRIMARY KEY REFERENCES public.items(id) ON DELETE CASCADE,
    content_type TEXT NOT NULL,
    data JSONB NOT NULL
);

-- Spaces table
CREATE TABLE IF NOT EXISTS public.spaces (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    "desc" TEXT,
    color TEXT NOT NULL DEFAULT '#007AFF',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Item Spaces junction table (many-to-many)
CREATE TABLE IF NOT EXISTS public.item_spaces (
    item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
    space_id UUID NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    PRIMARY KEY (item_id, space_id)
);

-- Item Chats table
CREATE TABLE IF NOT EXISTS public.item_chats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Space Chats table
CREATE TABLE IF NOT EXISTS public.space_chats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    space_id UUID NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Chat Messages table
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    chat_id UUID NOT NULL,
    chat_type TEXT NOT NULL CHECK (chat_type IN ('item', 'space')),
    role TEXT NOT NULL CHECK (role IN ('user', 'system', 'assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Offline Queue table
CREATE TABLE IF NOT EXISTS public.offline_queue (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL CHECK (action_type IN (
        'create_item', 'update_item', 'delete_item', 'create_capture'
    )),
    payload JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'synced', 'failed'))
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_items_user_id ON public.items(user_id);
CREATE INDEX IF NOT EXISTS idx_items_content_type ON public.items(content_type);
CREATE INDEX IF NOT EXISTS idx_items_created_at ON public.items(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_items_is_archived ON public.items(is_archived);

CREATE INDEX IF NOT EXISTS idx_spaces_user_id ON public.spaces(user_id);

CREATE INDEX IF NOT EXISTS idx_item_spaces_item_id ON public.item_spaces(item_id);
CREATE INDEX IF NOT EXISTS idx_item_spaces_space_id ON public.item_spaces(space_id);

CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_id ON public.chat_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON public.chat_messages(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_offline_queue_user_id ON public.offline_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_offline_queue_status ON public.offline_queue(status);

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_type_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.space_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offline_queue ENABLE ROW LEVEL SECURITY;

-- Items policies
CREATE POLICY "Users can view their own items" ON public.items
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own items" ON public.items
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own items" ON public.items
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own items" ON public.items
    FOR DELETE USING (auth.uid() = user_id);

-- Item Metadata policies
CREATE POLICY "Users can view metadata for their items" ON public.item_metadata
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.items
            WHERE items.id = item_metadata.item_id
            AND items.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert metadata for their items" ON public.item_metadata
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.items
            WHERE items.id = item_metadata.item_id
            AND items.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update metadata for their items" ON public.item_metadata
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.items
            WHERE items.id = item_metadata.item_id
            AND items.user_id = auth.uid()
        )
    );

-- Item Type Metadata policies
CREATE POLICY "Users can view type metadata for their items" ON public.item_type_metadata
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.items
            WHERE items.id = item_type_metadata.item_id
            AND items.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert type metadata for their items" ON public.item_type_metadata
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.items
            WHERE items.id = item_type_metadata.item_id
            AND items.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update type metadata for their items" ON public.item_type_metadata
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.items
            WHERE items.id = item_type_metadata.item_id
            AND items.user_id = auth.uid()
        )
    );

-- Spaces policies
CREATE POLICY "Users can view their own spaces" ON public.spaces
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own spaces" ON public.spaces
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own spaces" ON public.spaces
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own spaces" ON public.spaces
    FOR DELETE USING (auth.uid() = user_id);

-- Item Spaces policies
CREATE POLICY "Users can view their item-space relationships" ON public.item_spaces
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.items
            WHERE items.id = item_spaces.item_id
            AND items.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage their item-space relationships" ON public.item_spaces
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.items
            WHERE items.id = item_spaces.item_id
            AND items.user_id = auth.uid()
        )
    );

-- Chat policies
CREATE POLICY "Users can view their own chats" ON public.item_chats
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own item chats" ON public.item_chats
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own space chats" ON public.space_chats
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own space chats" ON public.space_chats
    FOR ALL USING (auth.uid() = user_id);

-- Chat Messages policies
CREATE POLICY "Users can view messages in their chats" ON public.chat_messages
    FOR SELECT USING (
        (chat_type = 'item' AND EXISTS (
            SELECT 1 FROM public.item_chats
            WHERE item_chats.id = chat_messages.chat_id
            AND item_chats.user_id = auth.uid()
        )) OR
        (chat_type = 'space' AND EXISTS (
            SELECT 1 FROM public.space_chats
            WHERE space_chats.id = chat_messages.chat_id
            AND space_chats.user_id = auth.uid()
        ))
    );

CREATE POLICY "Users can insert messages in their chats" ON public.chat_messages
    FOR INSERT WITH CHECK (
        (chat_type = 'item' AND EXISTS (
            SELECT 1 FROM public.item_chats
            WHERE item_chats.id = chat_messages.chat_id
            AND item_chats.user_id = auth.uid()
        )) OR
        (chat_type = 'space' AND EXISTS (
            SELECT 1 FROM public.space_chats
            WHERE space_chats.id = chat_messages.chat_id
            AND space_chats.user_id = auth.uid()
        ))
    );

-- Offline Queue policies
CREATE POLICY "Users can view their own offline queue" ON public.offline_queue
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own offline queue" ON public.offline_queue
    FOR ALL USING (auth.uid() = user_id);

-- Updated at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Updated at triggers
CREATE TRIGGER handle_updated_at_items
    BEFORE UPDATE ON public.items
    FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

CREATE TRIGGER handle_updated_at_spaces
    BEFORE UPDATE ON public.spaces
    FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();
