# Deployment Guide for Render.com

This guide will help you deploy your Mood Playlist Generator to Render.com.

## Prerequisites

1. A Render.com account (free tier available)
2. Your code pushed to a Git repository (GitHub, GitLab, or Bitbucket)
3. Spotify Developer App credentials

## Deployment Steps

### 1. Prepare Your Repository

Make sure your code is pushed to a Git repository that Render.com can access.

### 2. Create a New Web Service on Render.com

1. Log in to [Render.com](https://render.com)
2. Click "New +" and select "Web Service"
3. Connect your Git repository
4. Configure the service:
   - **Name**: `mood-playlist-generator` (or your preferred name)
   - **Environment**: `Node`
   - **Region**: Choose the closest to your users
   - **Branch**: `main` (or your default branch)
   - **Root Directory**: Leave empty (uses repository root)
   - **Build Command**: `cd server && npm install`
   - **Start Command**: `cd server && npm start`

### 3. Set Environment Variables

In the Render.com dashboard, go to your service's "Environment" tab and add:

```
NODE_ENV=production
SPOTIFY_CLIENT_ID=your_spotify_client_id_here
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret_here
```

### 4. Update Spotify App Settings

1. Go to your [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Select your app
3. Click "Edit Settings"
4. Update the Redirect URIs to include your new Render.com URL:
   ```
   https://your-app-name.onrender.com/callback/index.html
   ```

### 5. Update Your Code

Update the `redirect_uri` in your `script.js` file to match your Render.com URL:

```javascript
const redirect_uri = 'https://your-app-name.onrender.com/callback/index.html';
```

Replace `your-app-name` with your actual Render.com service name.

### 6. Deploy

1. Click "Create Web Service" in Render.com
2. Render will automatically build and deploy your app
3. Once deployed, you'll get a URL like `https://your-app-name.onrender.com`

## Important Notes

- **Free Tier Limitations**: Render.com's free tier spins down after 15 minutes of inactivity
- **Cold Starts**: The first request after inactivity may take 30+ seconds
- **Persistent Storage**: The free tier doesn't include persistent storage, so user data will be lost on restarts
- **Custom Domains**: Available on paid plans

## Troubleshooting

### Common Issues:

1. **Build Fails**: Check that all dependencies are in `package.json`
2. **App Won't Start**: Verify the start command and PORT environment variable
3. **Static Files Not Loading**: Ensure the server serves static files correctly
4. **Spotify Redirect Issues**: Double-check the redirect URI in both Spotify settings and your code

### Logs:

Access logs in the Render.com dashboard under your service's "Logs" tab.

## Upgrading from Free Tier

For production use, consider upgrading to a paid plan for:
- Persistent storage
- No cold starts
- Custom domains
- Better performance
