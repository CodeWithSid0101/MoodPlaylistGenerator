import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cache for templates
const templateCache = new Map();

async function loadTemplate(templatePath) {
  if (templateCache.has(templatePath)) {
    return templateCache.get(templatePath);
  }
  
  try {
    const fullPath = path.join(__dirname, '..', '..', 'public', templatePath);
    const content = await fs.readFile(fullPath, 'utf-8');
    templateCache.set(templatePath, content);
    return content;
  } catch (error) {
    console.error(`Error loading template ${templatePath}:`, error);
    throw error;
  }
}

function injectNonce(html, nonce) {
  if (!html || !nonce) return html;
  
  // Replace all script tags with nonce
  return html
    .replace(/<script\s*(?![^>]*?nonce=)([^>]*)>/g, (match, attrs) => {
      return `<script nonce="${nonce}" ${attrs}>`;
    })
    .replace(/<link\s+(?=[^>]*?rel=["']?stylesheet["']?)(?![^>]*?nonce=)([^>]*)>/g, (match, attrs) => {
      return `<link nonce="${nonce}" ${attrs}>`;
    });
}

export function nonceMiddleware() {
  return async (req, res, next) => {
    // Store original send function
    const originalSend = res.send;
    
    // Override send to inject nonce into HTML responses
    res.send = function(body) {
      // Only process HTML responses
      if (typeof body === 'string' && res.get('Content-Type')?.includes('text/html')) {
        // Get the nonce from res.locals (set by our earlier middleware)
        const nonce = res.locals.nonce;
        if (nonce) {
          // Inject nonce into the HTML
          body = injectNonce(body, nonce);
        }
      }
      
      // Call the original send function
      return originalSend.call(this, body);
    };
    
    // Handle template rendering
    res.renderWithNonce = async (templatePath, data = {}) => {
      try {
        // Load the template
        let html = await loadTemplate(templatePath);
        
        // Inject nonce
        html = injectNonce(html, res.locals.nonce);
        
        // Send the response
        res.set('Content-Type', 'text/html');
        return res.send(html);
      } catch (error) {
        console.error('Error rendering template:', error);
        return res.status(500).send('Internal Server Error');
      }
    };
    
    next();
  };
}
