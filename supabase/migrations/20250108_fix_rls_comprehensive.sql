-- Comprehensive fix for RLS policies
-- This script will drop ALL existing policies and recreate them properly

-- First, let's check and add missing columns if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'spaces' 
                   AND column_name = 'description') THEN
        ALTER TABLE public.spaces ADD COLUMN description TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'spaces' 
                   AND column_name = 'item_count') THEN
        ALTER TABLE public.spaces ADD COLUMN item_count INTEGER DEFAULT 0;
    END IF;
END $$;

-- ============================================
-- ITEM_SPACES TABLE - Drop ALL existing policies
-- ============================================
DROP POLICY IF EXISTS "Users can view their item-space relationships" ON public.item_spaces;
DROP POLICY IF EXISTS "Users can manage their item-space relationships" ON public.item_spaces;
DROP POLICY IF EXISTS "Users can insert their item-space relationships" ON public.item_spaces;
DROP POLICY IF EXISTS "Users can update their item-space relationships" ON public.item_spaces;
DROP POLICY IF EXISTS "Users can delete their item-space relationships" ON public.item_spaces;

-- Create new policies for item_spaces
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

-- ============================================
-- ITEM_METADATA TABLE - Drop ALL existing policies
-- ============================================
DROP POLICY IF EXISTS "Users can view metadata for their items" ON public.item_metadata;
DROP POLICY IF EXISTS "Users can insert metadata for their items" ON public.item_metadata;
DROP POLICY IF EXISTS "Users can update metadata for their items" ON public.item_metadata;
DROP POLICY IF EXISTS "Users can delete metadata for their items" ON public.item_metadata;

-- Create new policies for item_metadata
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

-- ============================================
-- ITEM_TYPE_METADATA TABLE - Drop ALL existing policies
-- ============================================
DROP POLICY IF EXISTS "Users can view type metadata for their items" ON public.item_type_metadata;
DROP POLICY IF EXISTS "Users can insert type metadata for their items" ON public.item_type_metadata;
DROP POLICY IF EXISTS "Users can update type metadata for their items" ON public.item_type_metadata;
DROP POLICY IF EXISTS "Users can delete type metadata for their items" ON public.item_type_metadata;

-- Create new policies for item_type_metadata
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

-- ============================================
-- VERIFICATION: List all policies
-- ============================================
-- You can run this query to verify all policies are created:
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- AND tablename IN ('item_spaces', 'item_metadata', 'item_type_metadata')
-- ORDER BY tablename, policyname;