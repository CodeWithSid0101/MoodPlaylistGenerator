# Git Commands to Add Files to GitHub

## Step 1: Add all files to staging
```bash
git add .
```

## Step 2: Commit the changes
```bash
git commit -m "Complete Spotify Playlist Generator - Fixed all errors and added full functionality

- ✅ Fixed authentication (login/register/admin)
- ✅ Added Spotify integration with OAuth
- ✅ Complete playlist generation with AI recommendations
- ✅ Admin dashboard with user management
- ✅ Enhanced UI with Bootstrap and responsive design
- ✅ Proper error handling and validation
- ✅ Ready for Render deployment
- ✅ MongoDB integration with proper models
- ✅ JWT authentication with secure middleware"
```

## Step 3: Add GitHub remote (if not already added)
```bash
# Replace 'yourusername' and 'your-repo-name' with actual values
git remote add origin https://github.com/yourusername/your-repo-name.git
```

## Step 4: Push to GitHub
```bash
git branch -M main
git push -u origin main
```

## Alternative: If remote already exists, just push
```bash
git push origin main
```

## Step 5: Verify the push
```bash
git status
git log --oneline -5
```

---

## Quick One-Liner (if remote already configured):
```bash
git add . && git commit -m "Complete Spotify Playlist Generator with all features" && git push origin main
```

---

## If you need to force push (use with caution):
```bash
git push -f origin main
```

## To check your remote URL:
```bash
git remote -v
```