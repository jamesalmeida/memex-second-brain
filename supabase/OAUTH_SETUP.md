# Google OAuth Setup for Memex

## 🚀 Quick Setup (Recommended for MVP)

### Step 1: Enable Google OAuth in Supabase

1. **Go to Supabase Dashboard**
   - Open your project: [supabase.com](https://supabase.com)
   - Navigate to **Authentication** → **Providers**

2. **Enable Google Provider**
   - Click **"Google"**
   - Toggle **"Enable sign in with Google"**
   - Add your **Google OAuth credentials** (see Step 2)

### Step 2: Get Google OAuth Credentials

**Option A: Use Test Credentials (Easiest for MVP)**
```
Client ID: 20637643488-50nnr7kqb41jb2ggujkeh64s9saa8sqc.apps.googleusercontent.com
Client Secret: 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
```

**Option B: Create Your Own (Recommended for Production)**
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URIs:
   - `https://your-project.supabase.co/auth/v1/callback`

### Step 3: Configure Redirect URLs

In Supabase, under **Authentication** → **URL Configuration**:
- **Site URL**: `https://your-project.supabase.co`
- **Redirect URLs**: Add `memex://` (your app scheme)

### Step 4: Test the Flow

1. **Restart your app:**
   ```bash
   npx expo start --clear
   ```

2. **Tap "Continue with Google"**

3. **Expected flow:**
   - Browser opens → Google sign-in → Redirect back to app
   - Should automatically sign you in

## 🔧 Troubleshooting

### Issue: "Invalid OAuth state"
- **Fix**: Clear app data and try again
- **Check**: Make sure redirect URLs are correct

### Issue: "App not installed" error
- **Fix**: Make sure app scheme is registered
- **Check**: `memex://` should work on your device

### Issue: Stuck on loading
- **Check terminal logs** for error messages
- **Verify** Supabase credentials in `.env`
- **Test** connection: `supabase status`

## 📋 Current Configuration

Your app is configured with:
- ✅ **App Scheme**: `memex://`
- ✅ **Supabase URL**: `https://dnhzfzzoocatumcmvpzg.supabase.co`
- ✅ **Redirect URL**: `memex://`
- ✅ **PKCE Flow**: Enabled for security

## 🎯 Next Steps

Once Google OAuth works:
1. ✅ **Test authentication** flow
2. 🔄 **Build Home screen** with items grid
3. 📱 **Add capture functionality**
4. 🏷️ **Create spaces management**

**Ready to test Google OAuth?** The setup should work immediately! 🎉
