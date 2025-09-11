// Store the nonce for later use
window.appNonce = document.currentScript.getAttribute('nonce');

// Function to load scripts with nonce
function loadScript(src, callback) {
  const script = document.createElement('script');
  script.src = src;
  script.nonce = window.appNonce;
  script.async = true;
  
  script.onload = function() {
    if (typeof callback === 'function') callback();
  };
  
  script.onerror = function() {
    console.error('Failed to load script:', src);
    if (typeof callback === 'function') callback(new Error(`Failed to load script: ${src}`));
  };
  
  document.head.appendChild(script);
}

// Function to show error message
function showError() {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-message';
  errorDiv.style.padding = '1rem';
  errorDiv.style.margin = '1rem';
  errorDiv.style.border = '1px solid #ff6b6b';
  errorDiv.style.borderRadius = '4px';
  errorDiv.style.backgroundColor = '#fff5f5';
  errorDiv.innerHTML = `
    <h3 style="color: #e03131; margin-top: 0;">Error Loading Admin Interface</h3>
    <p>Failed to load the admin interface. Please try refreshing the page.</p>
    <p>If the problem persists, please contact support.</p>
    <button id="refresh-button" style="background: #4dabf7; 
           color: white; 
           border: none; 
           padding: 0.5rem 1rem; 
           border-radius: 4px; 
           cursor: pointer; 
           margin-top: 0.5rem;">
      <i class="fas fa-sync-alt"></i> Refresh Page
    </button>
  `;
  document.body.prepend(errorDiv);
  
  // Add event listener for the refresh button
  const refreshButton = document.getElementById('refresh-button');
  if (refreshButton) {
    refreshButton.addEventListener('click', () => window.location.reload());
  }
}

// Load admin script
loadScript('/admin/admin-clean.js', function(err) {
  if (err) {
    showError();
  }
});
