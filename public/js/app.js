// Global variables
let currentUser = null;
let authToken = localStorage.getItem('authToken');
let currentAudio = null;

// Helper functions
function $(selector) { 
    return document.querySelector(selector); 
}

function $all(selector) { 
    return document.querySelectorAll(selector); 
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Initializing Spotify Playlist Generator...');
    initializeApp();
    setupEventListeners();
    checkAuthStatus();
    handleRouting();
});

// Initialize app
function initializeApp() {
    try {
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');
    const success = urlParams.get('success');
    
    if (error) {
        showAlert(getErrorMessage(error), 'danger');
        cleanUrl();
    }
    
    if (success) {
        showAlert(getSuccessMessage(success), 'success');
        cleanUrl();
    }
    } catch (error) {
        console.error('Error initializing app:', error);
    }
}

// Clean URL parameters
function cleanUrl() {
                try {
        window.history.replaceState({}, document.title, window.location.pathname);
                } catch (error) {
        console.warn('Could not clean URL:', error);
                }
            }

// Setup event listeners
function setupEventListeners() {
    try {
        setupFormListeners();
        window.addEventListener('popstate', handleRouting);
        document.addEventListener('keydown', handleKeyboardNavigation);
    } catch (error) {
        console.error('Error setting up event listeners:', error);
    }
}

// Setup form listeners
function setupFormListeners() {
    const forms = {
        'login-form': handleLogin,
        'register-form': handleRegister,
        'admin-login-form': handleAdminLogin,
        'create-playlist-form': handleCreatePlaylist
    };
    
    Object.entries(forms).forEach(([formId, handler]) => {
    try {
    const form = document.getElementById(formId);
            if (form) {
                form.addEventListener('submit', handler);
    }
        } catch (error) {
            console.warn(`Error setting up form listener for ${formId}:`, error);
        }
    });
    }

// Handle keyboard navigation
function handleKeyboardNavigation(e) {
    if (e.key === 'Escape') {
    try {
            const alerts = document.querySelectorAll('.alert');
            alerts.forEach(alert => {
                const closeBtn = alert.querySelector('.btn-close');
                if (closeBtn) {
    try {
                        closeBtn.click();
    } catch (error) {
                        alert.remove();
    }
}
            });
    } catch (error) {
            console.warn('Error handling keyboard navigation:', error);
    }
}
}

// Handle routing
function handleRouting() {
    try {
        const path = window.location.pathname.toLowerCase();
        let section = 'home';
        
        if (path.includes('login')) {
            section = 'login';
        } else if (path.includes('register')) {
            section = 'register';
        } else if (path.includes('admin-login')) {
            section = 'admin-login';
        } else if (path.includes('dashboard')) {
            section = 'dashboard';
        } else if (path.includes('admin')) {
            section = 'admin';
        }
        showSection(section);
    } catch (error) {
        console.error('Error handling routing:', error);
    }
}

// Check authentication status
async function checkAuthStatus() {
    if (!authToken) {
        updateUIForLoggedOutUser();
        return;
    }
    try {
        const response = await makeApiCall('/api/auth/me', { method: 'GET' });
        if (response && response.success) {
            currentUser = response.user;
            updateUIForLoggedInUser();
            
            const currentPath = window.location.pathname.toLowerCase();
            const authPages = ['/', '/home', '/login', '/register'];
            
            if (authPages.includes(currentPath)) {
                showSection(currentUser.isAdmin ? 'admin' : 'dashboard');
            }
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        handleAuthError();
    }
}

// Handle authentication errors
function handleAuthError() {
    try {
        authToken = null;
        currentUser = null;
        localStorage.removeItem('authToken');
        updateUIForLoggedOutUser();
        
        const currentPath = window.location.pathname.toLowerCase();
        const protectedPages = ['/dashboard', '/admin'];
        
        if (protectedPages.some(page => currentPath.includes(page))) {
            showSection('home');
        }
    } catch (error) {
        console.error('Error handling auth error:', error);
    }
}

// Make API calls with proper error handling
async function makeApiCall(endpoint, options = {}) {
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json'
        }
    };
    
    if (authToken) {
        defaultOptions.headers['Authorization'] = `Bearer ${authToken}`;
    }
    
    const finalOptions = { ...defaultOptions, ...options };
    
    if (options.headers) {
        finalOptions.headers = { ...defaultOptions.headers, ...options.headers };
    }
    
    try {
        const response = await fetch(endpoint, finalOptions);
        
        if (!response.ok) {
            let errorData;
            try {
                errorData = await response.json();
            } catch (parseError) {
                errorData = { error: `HTTP ${response.status}` };
            }
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        if (error.message.includes('401') || error.message.includes('Token')) {
            handleAuthError();
        }
        throw error;
    }
}

// Get form data safely
function getFormData(formId) {
    try {
        const form = document.getElementById(formId);
        if (!form) {
            console.warn(`Form with ID '${formId}' not found`);
            return {};
        }
        
        const data = {};
        const inputs = form.querySelectorAll('input, select, textarea');
        
        inputs.forEach(input => {
            let fieldName = input.name || input.id;
            
            if (fieldName.includes('-')) {
                const parts = fieldName.split('-');
                if (parts.length > 1) {
                    fieldName = parts.slice(1).join('-');
                }
            }
            
            if (input.type === 'checkbox') {
                data[fieldName] = input.checked;
            } else if (input.type === 'radio') {
                if (input.checked) {
                    data[fieldName] = input.value;
                }
            } else {
                data[fieldName] = input.value;
            }
        });
        
        return data;
    } catch (error) {
        console.error('Error getting form data:', error);
        return {};
    }
}

// Clear form safely
function clearForm(formId) {
    try {
        const form = document.getElementById(formId);
        if (form) {
            form.reset();
            clearFormErrors(formId);
        }
    } catch (error) {
        console.warn('Error clearing form:', error);
    }
}

// Clear form errors
function clearFormErrors(formId) {
    try {
        const form = document.getElementById(formId);
        if (!form) return;
        
        const errorElements = form.querySelectorAll('.invalid-feedback');
        errorElements.forEach(el => {
            el.textContent = '';
            el.style.display = 'none';
        });
        
        const inputs = form.querySelectorAll('.is-invalid');
        inputs.forEach(input => {
            input.classList.remove('is-invalid');
        });
    } catch (error) {
        console.warn('Error clearing form errors:', error);
    }
}

// Show form errors
function showFormErrors(formId, errors) {
    if (!Array.isArray(errors)) return;
    
    try {
        const formPrefix = formId.replace('-form', '');
        
        errors.forEach(error => {
            if (!error.field || !error.message) return;
            
            const input = document.getElementById(`${formPrefix}-${error.field}`);
            const errorElement = document.getElementById(`${formPrefix}-${error.field}-error`);
            
            if (input) {
                input.classList.add('is-invalid');
            }
            
            if (errorElement) {
                errorElement.textContent = error.message;
                errorElement.style.display = 'block';
            }
        });
    } catch (error) {
        console.error('Error showing form errors:', error);
    }
}

// Validate email
function isValidEmail(email) {
    if (!email || typeof email !== 'string') return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
}

// Handle login
async function handleLogin(e) {
    e.preventDefault();
    
    try {
        const formData = getFormData('login-form');
        
        if (!validateLoginForm(formData)) return;
        
        showLoading(true);
        
        const response = await makeApiCall('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({
                email: formData.email,
                password: formData.password
            })
        });
        
        if (response && response.success) {
            authToken = response.token;
            localStorage.setItem('authToken', authToken);
            currentUser = response.user;
            
            showAlert(response.message || 'Login successful!', 'success');
            updateUIForLoggedInUser();
            showSection('dashboard');
            clearForm('login-form');
        }
    } catch (error) {
        showAlert(error.message || 'Login failed', 'danger');
    } finally {
        showLoading(false);
    }
}

// Validate login form
function validateLoginForm(data) {
    clearFormErrors('login-form');
    
    const errors = [];
    
    if (!data.email || !data.email.trim()) {
        errors.push({ field: 'email', message: 'Email is required' });
    } else if (!isValidEmail(data.email)) {
        errors.push({ field: 'email', message: 'Please enter a valid email' });
    }
    
    if (!data.password) {
        errors.push({ field: 'password', message: 'Password is required' });
    }
    
    if (errors.length > 0) {
        showFormErrors('login-form', errors);
        return false;
    }
    
    return true;
}

// Handle registration
async function handleRegister(e) {
    e.preventDefault();
    
    try {
        const formData = getFormData('register-form');
        
        if (!validateRegistrationForm(formData)) return;
        
        showLoading(true);
        
        const response = await makeApiCall('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({
                name: formData.name,
                email: formData.email,
                password: formData.password,
                confirmPassword: formData['confirm-password']
            })
        });
        
        if (response && response.success) {
            authToken = response.token;
            localStorage.setItem('authToken', authToken);
            currentUser = response.user;
            
            showAlert(response.message || 'Registration successful!', 'success');
            updateUIForLoggedInUser();
            showSection('dashboard');
            clearForm('register-form');
        }
    } catch (error) {
        showAlert(error.message || 'Registration failed', 'danger');
    } finally {
        showLoading(false);
    }
}

// Validate registration form
function validateRegistrationForm(data) {
    clearFormErrors('register-form');
    
    const errors = [];
    
    if (!data.name || !data.name.trim()) {
        errors.push({ field: 'name', message: 'Name is required' });
    } else if (data.name.trim().length < 2) {
        errors.push({ field: 'name', message: 'Name must be at least 2 characters' });
    }
    
    if (!data.email || !data.email.trim()) {
        errors.push({ field: 'email', message: 'Email is required' });
    } else if (!isValidEmail(data.email)) {
        errors.push({ field: 'email', message: 'Please enter a valid email' });
    }
    
    if (!data.password) {
        errors.push({ field: 'password', message: 'Password is required' });
    } else if (data.password.length < 6) {
        errors.push({ field: 'password', message: 'Password must be at least 6 characters' });
    }
    
    if (!data['confirm-password']) {
        errors.push({ field: 'confirm-password', message: 'Please confirm your password' });
    } else if (data.password !== data['confirm-password']) {
        errors.push({ field: 'confirm-password', message: 'Passwords do not match' });
    }
    
    if (errors.length > 0) {
        showFormErrors('register-form', errors);
        return false;
    }
    
    return true;
}

// Handle admin login
async function handleAdminLogin(e) {
    e.preventDefault();
    
    try {
        const formData = getFormData('admin-login-form');
        
        if (!validateAdminLoginForm(formData)) return;
        
        showLoading(true);
        
        const response = await makeApiCall('/api/auth/admin-login', {
            method: 'POST',
            body: JSON.stringify({
                email: formData.email,
                password: formData.password
            })
        });
        
        if (response && response.success) {
            authToken = response.token;
            localStorage.setItem('authToken', authToken);
            currentUser = response.user;
            
            showAlert(response.message || 'Admin login successful!', 'success');
            updateUIForLoggedInUser();
            showSection('admin');
            clearForm('admin-login-form');
        }
    } catch (error) {
        showAlert(error.message || 'Admin login failed', 'danger');
    } finally {
        showLoading(false);
    }
}

// Validate admin login form
function validateAdminLoginForm(data) {
    clearFormErrors('admin-login-form');
    
    const errors = [];
    
    if (!data.email || !data.email.trim()) {
        errors.push({ field: 'email', message: 'Email is required' });
    } else if (!isValidEmail(data.email)) {
        errors.push({ field: 'email', message: 'Please enter a valid email' });
    }
    
    if (!data.password) {
        errors.push({ field: 'password', message: 'Password is required' });
    }
    
    if (errors.length > 0) {
        showFormErrors('admin-login-form', errors);
        return false;
    }
    
    return true;
}

// Handle create playlist
async function handleCreatePlaylist(e) {
    e.preventDefault();
    
    try {
        const formData = getFormData('create-playlist-form');
        
        const processedData = {
            name: formData.name,
            prompt: formData.prompt,
            mood: formData.mood || 'custom',
            targetLength: parseInt(formData.length) || 20,
            isPublic: formData.public === true,
            genres: formData.genres ? formData.genres.split(',').map(g => g.trim()).filter(g => g) : []
        };

        if (!validatePlaylistForm(processedData)) return;

        showLoading(true);

        const response = await makeApiCall('/api/playlists', {
            method: 'POST',
            body: JSON.stringify(processedData)
        });

        if (response && response.success) {
            showAlert('Playlist created! Generating tracks...', 'info');
            clearForm('create-playlist-form');

            // Generate tracks
            await generatePlaylistTracks(response.playlist.id);

            // Refresh playlists
            loadUserPlaylists();
        }
    } catch (error) {
        showAlert(error.message || 'Failed to create playlist', 'danger');
    } finally {
        showLoading(false);
    }
}

// Validate playlist form
function validatePlaylistForm(data) {
    clearFormErrors('create-playlist-form');

    const errors = [];

    if (!data.name || !data.name.trim()) {
        errors.push({ field: 'name', message: 'Playlist name is required' });
    } else if (data.name.trim().length > 100) {
        errors.push({ field: 'name', message: 'Playlist name cannot exceed 100 characters' });
    }

    if (!data.prompt || !data.prompt.trim()) {
        errors.push({ field: 'prompt', message: 'Playlist description is required' });
    } else if (data.prompt.trim().length < 5) {
        errors.push({ field: 'prompt', message: 'Description must be at least 5 characters' });
    } else if (data.prompt.trim().length > 500) {
        errors.push({ field: 'prompt', message: 'Description cannot exceed 500 characters' });
    }

    if (data.targetLength < 5 || data.targetLength > 100) {
        errors.push({ field: 'length', message: 'Number of songs must be between 5 and 100' });
    }

    if (errors.length > 0) {
        showFormErrors('create-playlist-form', errors);
        return false;
    }

    return true;
}

// Generate playlist tracks
async function generatePlaylistTracks(playlistId) {
    try {
        const response = await makeApiCall(`/api/playlists/${playlistId}/generate`, {
            method: 'POST'
        });

        if (response && response.success) {
            showAlert('Playlist tracks generated successfully!', 'success');
        }
    } catch (error) {
        console.error('Generate tracks error:', error);
        showAlert(error.message || 'Failed to generate tracks. You can try again later.', 'warning');
    }
}

// Connect to Spotify
async function connectSpotify() {
    if (!authToken) {
        showAlert('Please login first', 'warning');
        return;
    }

    try {
        const response = await makeApiCall('/api/spotify/auth', { method: 'GET' });

        if (response && response.success) {
            window.location.href = response.authUrl;
        }
    } catch (error) {
        showAlert(error.message || 'Failed to connect to Spotify', 'danger');
    }
}

// Disconnect Spotify
async function disconnectSpotify() {
    if (!authToken) return;

    try {
        const response = await makeApiCall('/api/spotify/disconnect', { method: 'DELETE' });

        if (response && response.success) {
            showAlert(response.message || 'Spotify disconnected', 'info');
            if (currentUser) {
                currentUser.spotifyConnected = false;
            }
            updateSpotifyStatus();
        }
    } catch (error) {
        showAlert(error.message || 'Failed to disconnect Spotify', 'danger');
    }
}

// Load user playlists
async function loadUserPlaylists() {
    if (!authToken) return;

    const container = $('#playlists-container');
    if (!container) return;

    try {
        container.innerHTML = `
            <div class="col-12 text-center py-4">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading playlists...</span>
                </div>
            </div>
        `;

        const response = await makeApiCall('/api/playlists', { method: 'GET' });

        if (response && response.success) {
            displayPlaylists(response.playlists);
        }
    } catch (error) {
        console.error('Load playlists error:', error);

        container.innerHTML = `
            <div class="col-12 text-center py-4">
                <p class="text-muted">Failed to load playlists</p>
                <button class="btn btn-outline-primary" onclick="loadUserPlaylists()">Try Again</button>
            </div>
        `;
    }
}

// Display playlists
function displayPlaylists(playlists) {
    const container = $('#playlists-container');
    if (!container) return;

    if (!playlists || playlists.length === 0) {
        container.innerHTML = `
            <div class="col-12 text-center py-5">
                <i class="fas fa-music fa-3x text-muted mb-3"></i>
                <h4 class="text-muted">No playlists yet</h4>
                <p class="text-muted">Create your first playlist above to get started!</p>
            </div>
        `;
        return;
    }

    container.innerHTML = playlists.map(playlist => `
        <div class="col-md-4 mb-4">
            <div class="card playlist-card h-100" onclick="viewPlaylist('${playlist._id}')" style="cursor: pointer;">
                <div class="card-body d-flex flex-column">
                    <h5 class="card-title">${escapeHtml(playlist.name)}</h5>
                    <p class="card-text flex-grow-1">${escapeHtml(playlist.description || playlist.prompt.substring(0, 100) + '...')}</p>
                    <div class="mt-auto">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <small class="text-muted">
                                <i class="fas fa-music"></i> ${playlist.actualLength || 0} songs
                            </small>
                            <span class="badge bg-primary">${escapeHtml(playlist.mood)}</span>
                        </div>
                        <div class="d-flex justify-content-between align-items-center">
                            <small class="text-muted">
                                ${new Date(playlist.createdAt).toLocaleDateString()}
                            </small>
                            <div>
                                ${playlist.spotifyPlaylistId ? 
                                    '<i class="fab fa-spotify text-success" title="Available on Spotify"></i>' : 
                                    '<i class="fas fa-clock text-warning" title="Not yet on Spotify"></i>'
                                }
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

// View playlist
async function viewPlaylist(playlistId) {
    try {
        showLoading(true);

        const response = await makeApiCall(`/api/playlists/${playlistId}`, { method: 'GET' });

        if (response && response.success) {
            showPlaylistModal(response.playlist);
        }
    } catch (error) {
        showAlert(error.message || 'Failed to load playlist', 'danger');
    } finally {
        showLoading(false);
    }
}

// Show playlist modal
function showPlaylistModal(playlist) {
    const modalHtml = `
        <div class="modal fade" id="playlistModal" tabindex="-1" aria-labelledby="playlistModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="playlistModalLabel">${escapeHtml(playlist.name)}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <div class="mb-3">
                            <strong>Description:</strong> 
                            <p>${escapeHtml(playlist.description || playlist.prompt)}</p>
                        </div>
                        <div class="mb-3">
                            <strong>Mood:</strong> <span class="badge bg-primary">${escapeHtml(playlist.mood)}</span>
                            <strong class="ms-3">Songs:</strong> ${playlist.actualLength || 0}
                            ${playlist.totalDuration ? `<strong class="ms-3">Duration:</strong> ${formatDuration(playlist.totalDuration)}` : ''}
                        </div>
                        
                        ${playlist.tracks && playlist.tracks.length > 0 ? `
                            <h6>Tracks:</h6>
                            <div class="track-list" style="max-height: 300px; overflow-y: auto;">
                                ${playlist.tracks.map((track, index) => `
                                    <div class="track-item d-flex justify-content-between align-items-center py-2 border-bottom">
                                        <div class="flex-grow-1">
                                            <div class="fw-bold">${escapeHtml(track.name)}</div>
                                            <div class="text-muted small">${escapeHtml(track.artist)}</div>
                                            ${track.album ? `<div class="text-muted small">${escapeHtml(track.album)}</div>` : ''}
                                        </div>
                                        <div class="text-end">
                                            ${track.preview_url ? `
                                                <button class="btn btn-sm btn-outline-primary me-2" onclick="playPreview('${track.preview_url}')" title="Play preview">
                                                    <i class="fas fa-play"></i>
                                                </button>
                                            ` : ''}
                                            ${track.external_urls?.spotify ? `
                                                <a href="${track.external_urls.spotify}" target="_blank" class="btn btn-sm btn-outline-success" title="Open in Spotify">
                                                    <i class="fab fa-spotify"></i>
                                                </a>
                                            ` : ''}
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        ` : '<p class="text-muted">No tracks generated yet.</p>'}
                    </div>
                    <div class="modal-footer">
                        ${!playlist.spotifyPlaylistId ? `
                            <button type="button" class="btn btn-success" onclick="createSpotifyPlaylist('${playlist._id}')">
                                <i class="fab fa-spotify me-2"></i>Save to Spotify
                            </button>
                        ` : `
                            <a href="${playlist.spotifyUrl}" target="_blank" class="btn btn-success">
                                <i class="fab fa-spotify me-2"></i>View on Spotify
                            </a>
                        `}
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Remove existing modal
    const existingModal = $('#playlistModal');
    if (existingModal) {
        existingModal.remove();
    }

    // Add modal to body
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Show modal
    const modal = new bootstrap.Modal($('#playlistModal'));
    modal.show();
}

// Create Spotify playlist
async function createSpotifyPlaylist(playlistId) {
    if (!authToken) {
        showAlert('Please login first', 'warning');
        return;
    }

    try {
        showLoading(true);

        const response = await makeApiCall('/api/spotify/create-playlist', {
            method: 'POST',
            body: JSON.stringify({ playlistId })
        });

        if (response && response.success) {
            showAlert(response.message || 'Playlist created on Spotify!', 'success');

            // Close modal
            const modalElement = $('#playlistModal');
            if (modalElement) {
                const modal = bootstrap.Modal.getInstance(modalElement);
                if (modal) modal.hide();
            }

            // Refresh playlists
            loadUserPlaylists();
        }
    } catch (error) {
        if (error.message.includes('401') || error.message.includes('Spotify authentication')) {
            showAlert('Please connect your Spotify account first', 'warning');
        } else {
            showAlert(error.message || 'Failed to create Spotify playlist', 'danger');
        }
    } finally {
        showLoading(false);
    }
}

// Play preview
function playPreview(previewUrl) {
    if (!previewUrl) return;

    // Stop current audio if playing
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }

    // Create and play new audio
    currentAudio = new Audio(previewUrl);
    currentAudio.volume = 0.5;

    currentAudio.play().catch(error => {
        console.error('Audio play error:', error);
        showAlert('Could not play preview', 'warning');
    });

    // Remove reference when finished
    currentAudio.addEventListener('ended', () => {
        currentAudio = null;
    });
}

// Show section
function showSection(sectionName) {
    try {
        // Hide all sections
        $all('.section').forEach(section => {
            section.classList.remove('active');
        });

        // Show target section
        const targetSection = $(`#${sectionName}-section`);
        if (targetSection) {
            targetSection.classList.add('active');
        }

        // Update URL
        const newUrl = sectionName === 'home' ? '/' : `/${sectionName}`;
        window.history.pushState({ section: sectionName }, '', newUrl);

        // Load section-specific data
        if (sectionName === 'dashboard' && currentUser) {
            loadDashboardData();
        } else if (sectionName === 'admin' && currentUser && currentUser.isAdmin) {
            loadAdminData();
        }
    } catch (error) {
        console.error('Error showing section:', error);
    }
}

// Load dashboard data
function loadDashboardData() {
    try {
        updateSpotifyStatus();
        loadUserPlaylists();
        loadUserStats();
    } catch (error) {
        console.error('Error loading dashboard data:', error);
    }
}

// Load user stats
async function loadUserStats() {
    const statsContainer = $('#user-stats');
    if (!statsContainer || !authToken) return;

    try {
        const response = await makeApiCall('/api/playlists', { method: 'GET' });

        if (response && response.success) {
            const playlists = response.playlists || [];
            const totalTracks = playlists.reduce((sum, p) => sum + (p.actualLength || 0), 0);
            const publicPlaylists = playlists.filter(p => p.isPublic).length;

            statsContainer.innerHTML = `
                <div class="row text-center">
                    <div class="col-6 mb-3">
                        <div class="bg-light p-3 rounded">
                            <h4 class="text-primary mb-0">${playlists.length}</h4>
                            <small class="text-muted">Playlists</small>
                        </div>
                    </div>
                    <div class="col-6 mb-3">
                        <div class="bg-light p-3 rounded">
                            <h4 class="text-success mb-0">${totalTracks}</h4>
                            <small class="text-muted">Total Songs</small>
                        </div>
                    </div>
                </div>
                <div class="text-center">
                    <small class="text-muted">
                        <i class="fas fa-globe"></i> ${publicPlaylists} public playlists
                    </small>
                </div>
            `;
        }
    } catch (error) {
        statsContainer.innerHTML = `
            <div class="text-center text-muted">
                <p>Could not load stats</p>
            </div>
        `;
    }
}

// Update Spotify status
function updateSpotifyStatus() {
    const spotifyStatus = $('#spotify-status');
    if (!spotifyStatus) return;

    try {
        if (currentUser && currentUser.spotifyConnected) {
            spotifyStatus.innerHTML = `
                <i class="fab fa-spotify me-2"></i>
                <strong>Spotify Connected!</strong> You can now generate and save playlists.
                <button class="btn btn-outline-danger btn-sm ms-3" onclick="disconnectSpotify()">
                    Disconnect
                </button>
            `;
            spotifyStatus.className = 'alert alert-success';
        } else {
            spotifyStatus.innerHTML = `
                <i class="fab fa-spotify me-2"></i>
                Connect your Spotify account to start generating playlists
                <button class="btn btn-success btn-sm ms-3" onclick="connectSpotify()">
                    Connect Spotify
                </button>
            `;
            spotifyStatus.className = 'alert alert-warning';
        }
    } catch (error) {
        console.error('Error updating Spotify status:', error);
    }
}

// Load admin data
async function loadAdminData() {
    if (!authToken || !currentUser?.isAdmin) return;

    const adminContent = $('#admin-content');
    if (!adminContent) return;

    try {
        const response = await makeApiCall('/api/admin/stats', { method: 'GET' });

        if (response && response.success) {
            displayAdminStats(response.stats);
        }
    } catch (error) {
        adminContent.innerHTML = `
            <div class="alert alert-danger">
                <h4>Error Loading Admin Data</h4>
                <p>${error.message || 'Failed to load admin statistics'}</p>
                <button class="btn btn-outline-danger" onclick="loadAdminData()">Try Again</button>
            </div>
        `;
    }
}

// Display admin stats
function displayAdminStats(stats) {
    const adminContent = $('#admin-content');
    if (!adminContent) return;

    try {
        adminContent.innerHTML = `
            <div class="row mb-4">
                <div class="col-md-3 mb-3">
                    <div class="card stats-card">
                        <div class="card-body text-center">
                            <h3 class="text-primary">${stats.totalUsers || 0}</h3>
                            <p class="mb-0">Total Users</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-3 mb-3">
                    <div class="card stats-card">
                        <div class="card-body text-center">
                            <h3 class="text-success">${stats.totalPlaylists || 0}</h3>
                            <p class="mb-0">Total Playlists</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-3 mb-3">
                    <div class="card stats-card">
                        <div class="card-body text-center">
                            <h3 class="text-info">${stats.activeUsers || 0}</h3>
                            <p class="mb-0">Active Users</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-3 mb-3">
                    <div class="card stats-card">
                        <div class="card-body text-center">
                            <h3 class="text-warning">${stats.spotifyConnectedUsers || 0}</h3>
                            <p class="mb-0">Spotify Connected</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="row">
                <div class="col-md-6 mb-4">
                    <div class="card">
                        <div class="card-header">
                            <h5>Recent Users</h5>
                        </div>
                        <div class="card-body">
                            ${stats.recentUsers && stats.recentUsers.length > 0 ? stats.recentUsers.map(user => `
                                <div class="d-flex justify-content-between align-items-center mb-2 p-2 border rounded">
                                    <div>
                                        <strong>${escapeHtml(user.name)}</strong><br>
                                        <small class="text-muted">${escapeHtml(user.email)}</small>
                                    </div>
                                    <span class="badge ${user.isActive ? 'bg-success' : 'bg-secondary'}">
                                        ${user.isActive ? 'Active' : 'Inactive'}
                                    </span>
                                </div>
                            `).join('') : '<p class="text-muted">No recent users</p>'}
                        </div>
                    </div>
                </div>
                
                <div class="col-md-6 mb-4">
                    <div class="card">
                        <div class="card-header">
                            <h5>Recent Playlists</h5>
                        </div>
                        <div class="card-body">
                            ${stats.recentPlaylists && stats.recentPlaylists.length > 0 ? stats.recentPlaylists.map(playlist => `
                                <div class="d-flex justify-content-between align-items-center mb-2 p-2 border rounded">
                                    <div>
                                        <strong>${escapeHtml(playlist.name)}</strong><br>
                                        <small class="text-muted">by ${escapeHtml(playlist.userId?.name || 'Unknown')}</small>
                                    </div>
                                    <span class="badge bg-primary">${playlist.actualLength || 0} songs</span>
                                </div>
                            `).join('') : '<p class="text-muted">No recent playlists</p>'}
                        </div>
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error displaying admin stats:', error);
    }
}

// Update UI for logged in user
function updateUIForLoggedInUser() {
    if (!currentUser) return;

    try {
        // Hide login/register nav items
        const elementsToHide = ['nav-login', 'nav-register'];
        elementsToHide.forEach(id => {
            const element = $(id);
            if (element) element.style.display = 'none';
        });

        // Show user nav items
        const elementsToShow = ['nav-dashboard', 'nav-user-menu'];
        elementsToShow.forEach(id => {
            const element = $(id);
            if (element) element.style.display = 'block';
        });

        // Show admin nav if admin
        if (currentUser.isAdmin) {
            const adminNav = $('#nav-admin');
            if (adminNav) adminNav.style.display = 'block';
        }

        // Update username
        const usernameElement = $('#nav-username');
        if (usernameElement) {
            usernameElement.textContent = currentUser.name;
        }
    } catch (error) {
        console.error('Error updating UI for logged in user:', error);
    }
}

// Update UI for logged out user
function updateUIForLoggedOutUser() {
    try {
        // Show login/register nav items
        const elementsToShow = ['nav-login', 'nav-register'];
        elementsToShow.forEach(id => {
            const element = $(id);
            if (element) element.style.display = 'block';
        });

        // Hide user nav items
        const elementsToHide = ['nav-dashboard', 'nav-admin', 'nav-user-menu'];
        elementsToHide.forEach(id => {
            const element = $(id);
            if (element) element.style.display = 'none';
        });
    } catch (error) {
        console.error('Error updating UI for logged out user:', error);
    }
}

// Logout
function logout() {
    try {
        // Stop any playing audio
        if (currentAudio) {
            currentAudio.pause();
            currentAudio = null;
        }

        authToken = null;
        currentUser = null;
        localStorage.removeItem('authToken');

        updateUIForLoggedOutUser();
        showSection('home');
        showAlert('Logged out successfully', 'info');
    } catch (error) {
        console.error('Error during logout:', error);
    }
}

// Show loading
function showLoading(show) {
    try {
        const spinner = $('#loading-spinner');
        if (spinner) {
            spinner.style.display = show ? 'flex' : 'none';
        }
    } catch (error) {
        console.error('Error showing loading:', error);
    }
}

// Show alert with better error handling
function showAlert(message, type = 'info') {
    try {
        const alertContainer = $('#alert-container');
        if (!alertContainer) return;

        const alertId = 'alert-' + Date.now();
        const alertHtml = `
            <div id="${alertId}" class="alert alert-${type} alert-dismissible fade show" role="alert">
                ${escapeHtml(message)}
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>
        `;

        alertContainer.insertAdjacentHTML('beforeend', alertHtml);

        // Auto remove after 5 seconds
        setTimeout(() => {
            const alertElement = $(alertId);
            if (alertElement) {
                alertElement.remove();
            }
        }, 5000);
    } catch (error) {
        console.error('Error showing alert:', error);
        // Fallback to console log
        console.log(`${type.toUpperCase()}: ${message}`);
    }
}

// Utility functions
function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.toString().replace(/[&<>"']/g, m => map[m]);
}

function formatDuration(ms) {
    if (!ms || ms <= 0) return '0m';
    
    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (hours > 0) {
        return `${hours}h ${remainingMinutes}m`;
    }
    return `${minutes}m`;
}

function getErrorMessage(error) {
    const messages = {
        'spotify_auth_denied': 'Spotify authorization was denied',
        'missing_auth_data': 'Missing authorization data',
        'user_not_found': 'User not found',
        'spotify_connection_failed': 'Failed to connect to Spotify',
        'authorization_failed': 'Authorization failed'
    };

    return messages[error] || 'An error occurred';
}

function getSuccessMessage(success) {
    const messages = {
        'spotify_connected': 'Spotify account connected successfully!'
    };

    return messages[success] || 'Operation successful';
}

// Export functions for global access
window.showSection = showSection;
window.connectSpotify = connectSpotify;
window.disconnectSpotify = disconnectSpotify;
window.logout = logout;
window.loadUserPlaylists = loadUserPlaylists;
window.loadAdminData = loadAdminData;
window.viewPlaylist = viewPlaylist;
window.createSpotifyPlaylist = createSpotifyPlaylist;
window.playPreview = playPreview;
