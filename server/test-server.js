import express from 'express';

const app = express();
const PORT = 3000;

// Basic route
app.get('/', (req, res) => {
  res.send('ES Modules Test server is running!');
});

// Start the server
app.listen(PORT, () => {
  console.log(`Test server running on http://localhost:${PORT}`);
});
