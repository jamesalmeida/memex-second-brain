-- Fix RLS policies for item_spaces, item_metadata, and item_type_metadata tables
-- These tables need proper INSERT policies with WITH CHECK clauses

-- Drop existing policies that might conflict
DROP POLICY IF EXISTS "Users can manage their item-space relationships" ON public.item_spaces;
DROP POLICY IF EXISTS "Users can insert metadata for their items" ON public.item_metadata;
DROP POLICY IF EXISTS "Users can insert type metadata for their items" ON public.item_type_metadata;

-- Item Spaces: Create separate INSERT, UPDATE, and DELETE policies
-- Keep the existing SELECT policy
CREATE POLICY "Users can insert their item-space relationships" ON public.item_spaces
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

CREATE POLICY "Users can update their item-space relationships" ON public.item_spaces
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.items
            WHERE items.id = item_spaces.item_id
            AND items.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete their item-space relationships" ON public.item_spaces
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.items
            WHERE items.id = item_spaces.item_id
            AND items.user_id = auth.uid()
        )
    );

-- Fix Item Metadata INSERT policy
-- The existing one might not be working properly
DROP POLICY IF EXISTS "Users can insert metadata for their items" ON public.item_metadata;
CREATE POLICY "Users can insert metadata for their items" ON public.item_metadata
    FOR INSERT WITH CHECK (
        item_id IN (
            SELECT id FROM public.items
            WHERE user_id = auth.uid()
        )
    );

-- Also add DELETE policy for item_metadata
CREATE POLICY "Users can delete metadata for their items" ON public.item_metadata
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.items
            WHERE items.id = item_metadata.item_id
            AND items.user_id = auth.uid()
        )
    );

-- Fix Item Type Metadata INSERT policy
DROP POLICY IF EXISTS "Users can insert type metadata for their items" ON public.item_type_metadata;
CREATE POLICY "Users can insert type metadata for their items" ON public.item_type_metadata
    FOR INSERT WITH CHECK (
        item_id IN (
            SELECT id FROM public.items
            WHERE user_id = auth.uid()
        )
    );

-- Also add DELETE policy for item_type_metadata
CREATE POLICY "Users can delete type metadata for their items" ON public.item_type_metadata
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.items
            WHERE items.id = item_type_metadata.item_id
            AND items.user_id = auth.uid()
        )
    );

-- Add missing columns to spaces table if they don't exist
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