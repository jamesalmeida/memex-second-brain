-- Fix RLS policies for Memex Second Brain
-- Run this in your Supabase SQL Editor to resolve sync errors

-- ============================================
-- STEP 1: Check current policies
-- ============================================
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('item_spaces', 'item_metadata', 'item_type_metadata', 'items', 'spaces')
ORDER BY tablename, policyname;

-- ============================================
-- STEP 2: Drop ALL existing policies that might conflict
-- ============================================
DROP POLICY IF EXISTS "Users can view their item-space relationships" ON public.item_spaces;
DROP POLICY IF EXISTS "Users can manage their item-space relationships" ON public.item_spaces;
DROP POLICY IF EXISTS "Users can insert their item-space relationships" ON public.item_spaces;
DROP POLICY IF EXISTS "Users can update their item-space relationships" ON public.item_spaces;
DROP POLICY IF EXISTS "Users can delete their item-space relationships" ON public.item_spaces;
DROP POLICY IF EXISTS "item_spaces_select_policy" ON public.item_spaces;
DROP POLICY IF EXISTS "item_spaces_insert_policy" ON public.item_spaces;
DROP POLICY IF EXISTS "item_spaces_update_policy" ON public.item_spaces;
DROP POLICY IF EXISTS "item_spaces_delete_policy" ON public.item_spaces;

DROP POLICY IF EXISTS "Users can view metadata for their items" ON public.item_metadata;
DROP POLICY IF EXISTS "Users can insert metadata for their items" ON public.item_metadata;
DROP POLICY IF EXISTS "Users can update metadata for their items" ON public.item_metadata;
DROP POLICY IF EXISTS "Users can delete metadata for their items" ON public.item_metadata;
DROP POLICY IF EXISTS "item_metadata_select_policy" ON public.item_metadata;
DROP POLICY IF EXISTS "item_metadata_insert_policy" ON public.item_metadata;
DROP POLICY IF EXISTS "item_metadata_update_policy" ON public.item_metadata;
DROP POLICY IF EXISTS "item_metadata_delete_policy" ON public.item_metadata;

DROP POLICY IF EXISTS "Users can view type metadata for their items" ON public.item_type_metadata;
DROP POLICY IF EXISTS "Users can insert type metadata for their items" ON public.item_type_metadata;
DROP POLICY IF EXISTS "Users can update type metadata for their items" ON public.item_type_metadata;
DROP POLICY IF EXISTS "Users can delete type metadata for their items" ON public.item_type_metadata;
DROP POLICY IF EXISTS "item_type_metadata_select_policy" ON public.item_type_metadata;
DROP POLICY IF EXISTS "item_type_metadata_insert_policy" ON public.item_type_metadata;
DROP POLICY IF EXISTS "item_type_metadata_update_policy" ON public.item_type_metadata;
DROP POLICY IF EXISTS "item_type_metadata_delete_policy" ON public.item_type_metadata;

-- ============================================
-- STEP 3: Ensure RLS is enabled on all tables
-- ============================================
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_type_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_transcripts ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 4: Create proper RLS policies
-- ============================================

-- ITEMS table policies
CREATE POLICY "items_select_policy" ON public.items
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "items_insert_policy" ON public.items
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "items_update_policy" ON public.items
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "items_delete_policy" ON public.items
    FOR DELETE USING (auth.uid() = user_id);

-- SPACES table policies
CREATE POLICY "spaces_select_policy" ON public.spaces
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "spaces_insert_policy" ON public.spaces
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "spaces_update_policy" ON public.spaces
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "spaces_delete_policy" ON public.spaces
    FOR DELETE USING (auth.uid() = user_id);

-- ITEM_SPACES table policies
CREATE POLICY "item_spaces_select_policy" ON public.item_spaces
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.items
            WHERE items.id = item_spaces.item_id
            AND items.user_id = auth.uid()
        )
    );

CREATE POLICY "item_spaces_insert_policy" ON public.item_spaces
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.items
            WHERE items.id = item_spaces.item_id
            AND items.user_id = auth.uid()
        )
        AND
        EXISTS (
            SELECT 1 FROM public.spaces
            WHERE spaces.id = item_spaces.space_id
            AND spaces.user_id = auth.uid()
        )
    );

CREATE POLICY "item_spaces_update_policy" ON public.item_spaces
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.items
            WHERE items.id = item_spaces.item_id
            AND items.user_id = auth.uid()
        )
    );

CREATE POLICY "item_spaces_delete_policy" ON public.item_spaces
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.items
            WHERE items.id = item_spaces.item_id
            AND items.user_id = auth.uid()
        )
    );

-- ITEM_METADATA table policies
CREATE POLICY "item_metadata_select_policy" ON public.item_metadata
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.items
            WHERE items.id = item_metadata.item_id
            AND items.user_id = auth.uid()
        )
    );

CREATE POLICY "item_metadata_insert_policy" ON public.item_metadata
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.items
            WHERE items.id = item_metadata.item_id
            AND items.user_id = auth.uid()
        )
    );

CREATE POLICY "item_metadata_update_policy" ON public.item_metadata
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.items
            WHERE items.id = item_metadata.item_id
            AND items.user_id = auth.uid()
        )
    );

CREATE POLICY "item_metadata_delete_policy" ON public.item_metadata
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.items
            WHERE items.id = item_metadata.item_id
            AND items.user_id = auth.uid()
        )
    );

-- ITEM_TYPE_METADATA table policies
CREATE POLICY "item_type_metadata_select_policy" ON public.item_type_metadata
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.items
            WHERE items.id = item_type_metadata.item_id
            AND items.user_id = auth.uid()
        )
    );

CREATE POLICY "item_type_metadata_insert_policy" ON public.item_type_metadata
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.items
            WHERE items.id = item_type_metadata.item_id
            AND items.user_id = auth.uid()
        )
    );

CREATE POLICY "item_type_metadata_update_policy" ON public.item_type_metadata
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.items
            WHERE items.id = item_type_metadata.item_id
            AND items.user_id = auth.uid()
        )
    );

CREATE POLICY "item_type_metadata_delete_policy" ON public.item_type_metadata
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.items
            WHERE items.id = item_type_metadata.item_id
            AND items.user_id = auth.uid()
        )
    );

-- VIDEO_TRANSCRIPTS table policies
CREATE POLICY "video_transcripts_select_policy" ON public.video_transcripts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.items
            WHERE items.id = video_transcripts.item_id
            AND items.user_id = auth.uid()
        )
    );

CREATE POLICY "video_transcripts_insert_policy" ON public.video_transcripts
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.items
            WHERE items.id = video_transcripts.item_id
            AND items.user_id = auth.uid()
        )
    );

CREATE POLICY "video_transcripts_update_policy" ON public.video_transcripts
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.items
            WHERE items.id = video_transcripts.item_id
            AND items.user_id = auth.uid()
        )
    );

CREATE POLICY "video_transcripts_delete_policy" ON public.video_transcripts
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.items
            WHERE items.id = video_transcripts.item_id
            AND items.user_id = auth.uid()
        )
    );

-- ============================================
-- STEP 5: Verify the policies were created
-- ============================================
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('item_spaces', 'item_metadata', 'item_type_metadata', 'items', 'spaces', 'video_transcripts')
ORDER BY tablename, policyname;
