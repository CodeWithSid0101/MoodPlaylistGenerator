import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Log current directory and file paths
console.log('Current working directory:', process.cwd());
console.log('__filename:', fileURLToPath(import.meta.url));
console.log('__dirname:', dirname(fileURLToPath(import.meta.url)));

// Try to import users route
try {
  const usersPath = new URL('./routes/users.js', import.meta.url).pathname;
  console.log('Attempting to import from:', usersPath);
  const usersModule = await import(usersPath);
  console.log('Successfully imported users module');
} catch (error) {
  console.error('Failed to import users module:', error);
}

// Try to import weather route
try {
  const weatherPath = new URL('./routes/weather.js', import.meta.url).pathname;
  console.log('Attempting to import from:', weatherPath);
  const weatherModule = await import(weatherPath);
  console.log('Successfully imported weather module');
} catch (error) {
  console.error('Failed to import weather module:', error);
}
