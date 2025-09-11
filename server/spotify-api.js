/**
 * Spotify API Integration Utility
 * 
 * This module handles integration with the Spotify Developer Dashboard API
 * for managing users in the application.
 */

import axios from 'axios';
import { createWriteStream } from 'fs';
import { format } from 'util';

// Set up logging
const logFile = createWriteStream('spotify-api.log', { flags: 'a' });
const logStdout = process.stdout;

function log(...args) {
  const message = format(...args) + '\n';
  logFile.write(message);
  logStdout.write(`[Spotify API] ${message}`);
}

// Configuration
const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';
const SPOTIFY_ACCOUNTS_BASE = 'https://accounts.spotify.com';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';

// Log configuration
log('Initializing Spotify API client');
log(`Token URL: ${SPOTIFY_TOKEN_URL}`);

// These credentials would be stored securely in environment variables
let clientId = process.env.SPOTIFY_CLIENT_ID;
let clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
let accessToken = null;
let tokenExpiry = null;

/**
 * Set Spotify API credentials
 * @param {string} id - Spotify Client ID
 * @param {string} secret - Spotify Client Secret
 */
function setCredentials(id, secret) {
  clientId = id;
  clientSecret = secret;
}

/**
 * Get a client credentials access token
 * @returns {Promise<string>} Access token
 */
async function getAccessToken() {
  log('=== getAccessToken() called ===');
  
  // Check if credentials are set
  if (!clientId || !clientSecret) {
    const errorMsg = 'Spotify API credentials are not configured. Please set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET environment variables.';
    log(errorMsg);
    throw new Error(errorMsg);
  }
  
  log('Client ID:', clientId ? 'Set' : 'MISSING');
  log('Client Secret:', clientSecret ? 'Set' : 'MISSING');
  
  // Check if we have a valid token
  if (accessToken && tokenExpiry) {
    const now = Date.now();
    const expiresIn = Math.floor((tokenExpiry - now) / 1000);
    log(`Token expires in: ${expiresIn} seconds`);
    
    if (now < tokenExpiry) {
      log('Using cached access token');
      return accessToken;
    }
    log('Token expired, requesting new one...');
  }
  
  try {
    if (!clientId || !clientSecret) {
      const errorMsg = 'Missing Spotify API credentials. Please set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET environment variables.';
      log(errorMsg);
      throw new Error(errorMsg);
    }

    // Encode client ID and secret for Basic Auth
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    
    log('Requesting new access token from:', SPOTIFY_TOKEN_URL);
    
    const requestData = new URLSearchParams();
    requestData.append('grant_type', 'client_credentials');
    
    log('Sending request with data:', requestData.toString());
    
    // Request new token
    const startTime = Date.now();
    const authString = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    
    log('Sending token request to Spotify API');
    
    const response = await axios({
      method: 'post',
      url: SPOTIFY_TOKEN_URL,
      data: 'grant_type=client_credentials',
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 10000 // 10 second timeout
    });
    
    const responseTime = Date.now() - startTime;
    
    if (!response.data.access_token) {
      throw new Error('No access token in response');
    }
    
    // Store the token and calculate expiry time
    accessToken = response.data.access_token;
    const expiresIn = response.data.expires_in || 3600; // Default to 1 hour if not provided
    tokenExpiry = Date.now() + (expiresIn * 1000);
    
    log('Successfully obtained access token');
    log(`  - Token starts with: ${accessToken.substring(0, 10)}...`);
    log(`  - Expires in: ${expiresIn} seconds`);
    log(`  - Request took: ${responseTime}ms`);
    
    return accessToken;
  } catch (error) {
    const errorDetails = {
      message: error.message,
      stack: error.stack,
      code: error.code,
      config: error.config ? {
        url: error.config.url,
        method: error.config.method,
        headers: error.config.headers ? {
          ...error.config.headers,
          // Redact sensitive information
          Authorization: error.config.headers?.Authorization ? '***REDACTED***' : undefined
        } : undefined,
        data: error.config.data,
        timeout: error.config.timeout
      } : undefined,
      response: error.response ? {
        status: error.response.status,
        statusText: error.response.statusText,
        headers: error.response.headers,
        data: error.response.data
      } : undefined
    };
    
    log('Error getting Spotify access token:', JSON.stringify(errorDetails, null, 2));
    
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      log('Error response data:', error.response.data);
      log('Error response status:', error.response.status);
      log('Error response headers:', error.response.headers);
      
      if (error.response.status === 400) {
        throw new Error('Bad request. Please check your request parameters.');
      } else if (error.response.status === 401) {
        throw new Error('Authentication failed. Please check your Spotify API credentials.');
      } else if (error.response.status === 403) {
        throw new Error('Insufficient permissions. Please check your Spotify API scopes.');
      } else if (error.response.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      } else {
        throw new Error(`Spotify API error: ${error.response.status} - ${error.response.statusText}`);
      }
    } else if (error.request) {
      // The request was made but no response was received
      log('No response received:', error.request);
      throw new Error('No response from Spotify API. Please check your network connection.');
    } else {
      // Something happened in setting up the request that triggered an Error
      log('Request setup error:', error.message);
      throw new Error(`Failed to make request to Spotify API: ${error.message}`);
    }
  }
}

/**
 * Add a user to the Spotify Developer Dashboard
 * @param {Object} user - User object with email and username
 * @returns {Promise<Object>} Result of the operation
 */
async function addUserToDashboard(user) {
  try {
    const token = await getAccessToken();
    // In a real implementation, you would call the Spotify API here
    console.log(`[SPOTIFY API] Adding user to dashboard: ${user.username} (${user.email})`);
    
    return {
      success: true,
      message: 'User queued for addition to Spotify Developer Dashboard',
      user: {
        email: user.email,
        username: user.username,
        added_at: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Error adding user to Spotify dashboard:', error);
    throw new Error('Failed to add user to Spotify Developer Dashboard');
  }
}

/**
 * Remove a user from the Spotify Developer Dashboard
 * @param {string} email - User's email
 * @returns {Promise<Object>} Result of the operation
 */
async function removeUserFromDashboard(email) {
  try {
    const token = await getAccessToken();
    // In a real implementation, you would call the Spotify API here
    console.log(`[SPOTIFY API] Removing user from dashboard: ${email}`);
    
    return {
      success: true,
      message: 'User queued for removal from Spotify Developer Dashboard',
      email
    };
  } catch (error) {
    console.error('Error removing user from Spotify dashboard:', error);
    throw new Error('Failed to remove user from Spotify Developer Dashboard');
  }
}

/**
 * Get all users in the Spotify Developer Dashboard
 * @returns {Promise<Array>} List of users
 */
async function getDashboardUsers() {
  try {
    const token = await getAccessToken();
    // In a real implementation, you would call the Spotify API here
    console.log('[SPOTIFY API] Getting dashboard users');
    
    // For now, return an empty array
    return [];
  } catch (error) {
    console.error('Error getting dashboard users:', error);
    throw error;
  }
}

// Export all functions
export {
  setCredentials,
  getAccessToken,
  addUserToDashboard,
  removeUserFromDashboard,
  getDashboardUsers,
  log
};
