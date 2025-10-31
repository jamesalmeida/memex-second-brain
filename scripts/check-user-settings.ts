/**
 * Diagnostic script to check user_settings table and row
 *
 * Run this with: npx ts-node scripts/check-user-settings.ts
 * Or add to package.json and run: npm run check-settings
 */

import { createClient } from '@supabase/supabase-js';

// Load environment variables
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase credentials in environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkUserSettings() {
  console.log('🔍 Checking user_settings table...\n');

  // Get current session
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  if (sessionError || !session) {
    console.error('❌ Not logged in. Please log in first.');
    process.exit(1);
  }

  const userId = session.user.id;
  console.log(`✅ Logged in as: ${session.user.email}`);
  console.log(`   User ID: ${userId}\n`);

  // Check if user_settings table exists and has correct columns
  console.log('🔍 Checking table structure...');
  const { data: tableInfo, error: tableError } = await supabase
    .from('user_settings')
    .select('*')
    .limit(0);

  if (tableError) {
    console.error('❌ Error accessing user_settings table:', tableError.message);
    console.log('\n💡 The table might not exist. Run the migration:');
    console.log('   supabase migration up --file supabase/migrations/20251028_create_user_settings.sql');
    process.exit(1);
  }

  console.log('✅ user_settings table exists\n');

  // Check if user has a row
  console.log('🔍 Checking for user settings row...');
  const { data: settings, error: settingsError } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (settingsError) {
    console.error('❌ Error fetching user settings:', settingsError.message);
    process.exit(1);
  }

  if (!settings) {
    console.log('❌ No settings row found for this user\n');
    console.log('💡 Creating default settings row...');

    const { data: newSettings, error: insertError } = await supabase
      .from('user_settings')
      .insert({
        user_id: userId,
        theme_dark_mode: false,
        ai_chat_model: 'gpt-4o-mini',
        ai_metadata_model: 'gpt-4o-mini',
        ai_auto_transcripts: false,
        ai_auto_image_descriptions: false,
        ui_x_video_muted: true,
        ui_autoplay_x_videos: true,
        ui_radial_actions: ['chat', 'share', 'archive'],
      })
      .select()
      .single();

    if (insertError) {
      console.error('❌ Error creating settings row:', insertError.message);
      process.exit(1);
    }

    console.log('✅ Created default settings row:\n');
    console.log(JSON.stringify(newSettings, null, 2));
  } else {
    console.log('✅ Settings row found:\n');
    console.log(JSON.stringify(settings, null, 2));

    // Check for auto-generate columns
    console.log('\n🔍 Checking auto-generate settings:');
    console.log(`   ai_auto_transcripts: ${settings.ai_auto_transcripts ?? 'MISSING COLUMN'}`);
    console.log(`   ai_auto_image_descriptions: ${settings.ai_auto_image_descriptions ?? 'MISSING COLUMN'}`);

    if (settings.ai_auto_transcripts === undefined || settings.ai_auto_image_descriptions === undefined) {
      console.log('\n❌ Columns are missing! Run the migration:');
      console.log('   supabase migration up --file supabase/migrations/20251028_create_user_settings.sql');
    } else {
      console.log('\n✅ All columns exist and working correctly!');
    }
  }
}

checkUserSettings().catch(console.error);
