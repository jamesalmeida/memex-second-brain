# Memex Second Brain - Database Setup

## 🚀 Import Database Schema

Now that you have your Supabase project created and credentials in `.env`, let's set up the database schema.

### Step 1: Open Supabase Dashboard

1. Go to [supabase.com](https://supabase.com)
2. Open your project
3. Click **"SQL Editor"** in the left sidebar

### Step 2: Import Schema

1. In the SQL Editor, click **"New Query"**
2. Copy and paste the entire contents of `supabase/schema.sql`
3. Click **"Run"** (or press Ctrl+Enter)

### Step 3: Verify Setup

After running the schema, you should see these tables created:
- ✅ `items`
- ✅ `item_metadata`
- ✅ `item_type_metadata`
- ✅ `spaces`
- ✅ `item_spaces`
- ✅ `item_chats`
- ✅ `space_chats`
- ✅ `chat_messages`
- ✅ `offline_queue`

### Step 4: Test Connection

1. Go to **"Table Editor"** in Supabase dashboard
2. You should see all the tables listed
3. Click on **"items"** table to verify it was created correctly

### Step 5: Enable Authentication (Optional)

If you want to use Google OAuth later:

1. Go to **"Authentication"** → **"Providers"**
2. Enable **"Google"**
3. Add your Google OAuth credentials

## 📋 Schema Overview

The schema includes:

- **Users**: Managed by Supabase Auth
- **Items**: Your saved content (bookmarks, articles, etc.)
- **Spaces**: Organizational folders/projects
- **Metadata**: Platform-specific data (YouTube, Twitter, etc.)
- **Chats**: AI conversations about items/spaces
- **Offline Queue**: Sync pending operations

## 🔒 Security

Row Level Security (RLS) is enabled on all tables, ensuring users can only access their own data.

## 🛠️ Troubleshooting

**If the schema fails to import:**
1. Check for syntax errors in the SQL
2. Make sure you're running it as a single query
3. Verify your Supabase project is fully initialized (wait 2-3 minutes after creation)

**If tables don't appear:**
1. Refresh the Table Editor page
2. Check the SQL Editor logs for any errors
3. Try running smaller parts of the schema individually

## 🎯 Next Steps

Once your schema is imported:
1. ✅ Test the app still loads (it should!)
2. 🔄 Enable authentication in the app
3. 📱 Start building the actual features (Home screen, etc.)

**Ready to import the schema?** Let me know when you've run it and I can help you verify everything is working correctly!
