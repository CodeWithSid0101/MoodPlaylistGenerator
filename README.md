# MoodPlaylistGenerator

A Spotify-powered web application that generates personalized playlists based on your mood and preferences.

## Features

- **Mood-based Playlist Generation**: Create playlists that match your current mood
- **Spotify Integration**: Seamlessly connects with your Spotify account
- **User Management**: Registration and admin dashboard for user approval
- **Responsive Design**: Works on desktop and mobile devices

## Tech Stack

- **Backend**: Node.js, Express.js
- **Frontend**: HTML, CSS, JavaScript
- **API**: Spotify Web API
- **Deployment**: Render.com

## Quick Start

### Local Development

1. Clone the repository
2. Install dependencies:
   ```bash
   cd server
   npm install
   ```
3. Create a `.env` file in the server directory:
   ```
   SPOTIFY_CLIENT_ID=your_spotify_client_id
   SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
   NODE_ENV=development
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```
5. Open `http://localhost:3000` in your browser

### Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions on deploying to Render.com.

## Configuration

Before deploying, make sure to:

1. Update the `redirect_uri` in `script.js` to match your deployment URL
2. Configure your Spotify app settings with the correct redirect URI
3. Set up environment variables in your deployment platform

## Project Structure

```
├── server/              # Backend Node.js application
│   ├── server.js       # Main server file
│   ├── spotify-api.js  # Spotify API integration
│   └── package.json    # Server dependencies
├── admin/              # Admin dashboard
├── callback/           # Spotify OAuth callback
├── script.js           # Main frontend JavaScript
├── style.css           # Main styles
└── index.html          # Main application page
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is open source and available under the [MIT License](LICENSE).