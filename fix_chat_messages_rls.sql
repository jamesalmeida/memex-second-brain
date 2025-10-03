-- Fix RLS policies for chat_messages table
-- The issue is that the INSERT policy is checking chat ownership correctly,
-- but we need to ensure it's working properly with the auth context

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view messages in their chats" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can insert messages in their chats" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can update messages in their chats" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can delete messages in their chats" ON public.chat_messages;

-- Recreate SELECT policy
CREATE POLICY "Users can view messages in their chats" ON public.chat_messages
    FOR SELECT USING (
        CASE
            WHEN chat_type = 'item' THEN
                EXISTS (
                    SELECT 1 FROM public.item_chats
                    WHERE item_chats.id = chat_messages.chat_id
                    AND item_chats.user_id = auth.uid()
                )
            WHEN chat_type = 'space' THEN
                EXISTS (
                    SELECT 1 FROM public.space_chats
                    WHERE space_chats.id = chat_messages.chat_id
                    AND space_chats.user_id = auth.uid()
                )
            ELSE false
        END
    );

-- Recreate INSERT policy with better error handling
CREATE POLICY "Users can insert messages in their chats" ON public.chat_messages
    FOR INSERT WITH CHECK (
        CASE
            WHEN chat_type = 'item' THEN
                EXISTS (
                    SELECT 1 FROM public.item_chats
                    WHERE item_chats.id = chat_messages.chat_id
                    AND item_chats.user_id = auth.uid()
                )
            WHEN chat_type = 'space' THEN
                EXISTS (
                    SELECT 1 FROM public.space_chats
                    WHERE space_chats.id = chat_messages.chat_id
                    AND space_chats.user_id = auth.uid()
                )
            ELSE false
        END
    );

-- Recreate UPDATE policy
CREATE POLICY "Users can update messages in their chats" ON public.chat_messages
    FOR UPDATE USING (
        CASE
            WHEN chat_type = 'item' THEN
                EXISTS (
                    SELECT 1 FROM public.item_chats
                    WHERE item_chats.id = chat_messages.chat_id
                    AND item_chats.user_id = auth.uid()
                )
            WHEN chat_type = 'space' THEN
                EXISTS (
                    SELECT 1 FROM public.space_chats
                    WHERE space_chats.id = chat_messages.chat_id
                    AND space_chats.user_id = auth.uid()
                )
            ELSE false
        END
    );

-- Recreate DELETE policy
CREATE POLICY "Users can delete messages in their chats" ON public.chat_messages
    FOR DELETE USING (
        CASE
            WHEN chat_type = 'item' THEN
                EXISTS (
                    SELECT 1 FROM public.item_chats
                    WHERE item_chats.id = chat_messages.chat_id
                    AND item_chats.user_id = auth.uid()
                )
            WHEN chat_type = 'space' THEN
                EXISTS (
                    SELECT 1 FROM public.space_chats
                    WHERE space_chats.id = chat_messages.chat_id
                    AND space_chats.user_id = auth.uid()
                )
            ELSE false
        END
    );
