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
    
    const email = document.getElementById('loginEmail').value || document.getElementById('email').value;
    const password = document.getElementById('loginPassword').value || document.getElementById('password').value;
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        if (data.success) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            
            // Check if user is admin and redirect accordingly
            if (data.user.role === 'admin') {
                window.location.href = '/admin.html';  // Changed from '/admin/' to '/admin.html'
        } else {
                window.location.href = '/dashboard.html'; // or wherever regular users should go
        }
        } else {
            alert(data.message);
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('Login failed. Please try again.');
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

