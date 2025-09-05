const moodSelector = document.getElementById("mood");
const weatherDiv = document.getElementById("weather");
const playlistDiv = document.getElementById("playlist");
const generateBtn = document.getElementById("generate");

const apiKey = '81165c8839597701582170a90141d335'; // Your OpenWeatherMap API key

// Function to get user location using browser geolocation API
function getUserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject("Geolocation not supported by your browser");
    } else {
      navigator.geolocation.getCurrentPosition(
        position => resolve(position.coords),
        error => reject(error.message)
      );
    }
  });
}

generateBtn.addEventListener("click", async () => {
  try {
    // 1. Get user location
    const coords = await getUserLocation();
    const lat = coords.latitude;
    const lon = coords.longitude;

    console.log(`User location: lat=${lat}, lon=${lon}`);

    // 2. Fetch weather using lat/lon
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`
    );

    if (!res.ok) throw new Error("Failed to fetch weather");

    const data = await res.json();

    const weather = data.weather[0].main;
    const temp = data.main.temp;
    const city = data.name;

    weatherDiv.innerHTML = `📍 Weather in ${city}: <strong>${weather}</strong>, ${temp}°C`;

    // 3. Generate playlist by mood
    const mood = moodSelector.value;
    const songs = getSongsByMood(mood);

    playlistDiv.innerHTML = songs.length
      ? `<h3>🎧 Your Playlist:</h3>` +
        songs
          .map(song => `<div class="song">${song.title} - ${song.artist}</div>`)
          .join("")
      : "No songs found for this mood.";

  } catch (error) {
    console.error("Error:", error);
    weatherDiv.innerHTML = "❌ Could not get location or weather.";
    playlistDiv.innerHTML = "";
  }
});

function getSongsByMood(mood) {
  const db = {
    happy: [
      { title: "Happy", artist: "Pharrell Williams" },
      { title: "Walking on Sunshine", artist: "Katrina & The Waves" },
    ],
    sad: [
      { title: "Someone Like You", artist: "Adele" },
      { title: "Let Her Go", artist: "Passenger" },
    ],
    chill: [
      { title: "Sunset Lover", artist: "Petit Biscuit" },
      { title: "Weightless", artist: "Marconi Union" },
    ],
    angry: [
      { title: "Numb", artist: "Linkin Park" },
      { title: "Stronger", artist: "Kanye West" },
    ]
  };

  return db[mood] || [];
}
