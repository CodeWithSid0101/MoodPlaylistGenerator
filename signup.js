// Signup page functionality
document.addEventListener('DOMContentLoaded', () => {
  const signupForm = document.getElementById('signup-form');
  const signupMessage = document.getElementById('signup-message');
  const signupBtn = document.getElementById('signup-btn');

  // Firebase configuration - would be needed for actual implementation
  // For this demo, we'll simulate the registration process

  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(signupForm);
    const data = {
      username: formData.get('username'),
      email: formData.get('email')
    };

    // Basic validation
    if (!data.username || !data.email) {
      showMessage('Please fill in all fields.', 'error');
      return;
    }

    if (!isValidEmail(data.email)) {
      showMessage('Please enter a valid email address.', 'error');
      return;
    }

    try {
      // Add enhanced loading state
      signupBtn.disabled = true;
      signupBtn.classList.add('btn-loading');
      signupBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Validating...';

      // Add slight delay for better UX
      await new Promise(resolve => setTimeout(resolve, 500));

      signupBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting Registration...';

      // Simulate API call
      const result = await simulateApiCall(data);

      // Show success with enhanced feedback
      signupBtn.innerHTML = '<i class="fas fa-check"></i> Registration Successful!';
      signupBtn.style.background = 'linear-gradient(135deg, #1db954 0%, #1ed760 100%)';

      showMessage(`Registration successful! Welcome ${data.username}. Your request is pending admin approval.`, 'success');

      // Reset form with animation
      setTimeout(() => {
        signupForm.reset();

        // Add success animation to form
        signupForm.style.transform = 'scale(0.98)';
        setTimeout(() => {
          signupForm.style.transform = 'scale(1)';
        }, 200);
      }, 1000);

      // Show redirect countdown
      let countdown = 3;
      const countdownInterval = setInterval(() => {
        showMessage(`Registration successful! Redirecting to login in ${countdown}...`, 'success');
        countdown--;
        if (countdown < 0) {
          clearInterval(countdownInterval);
          window.location.href = 'index.html';
        }
      }, 1000);

      // Store user data in localStorage for demo purposes
      localStorage.setItem('spotify_dev_username', data.username);
      localStorage.setItem('spotify_dev_email', data.email);
      localStorage.setItem('spotify_dev_registered', 'true');

    } catch (error) {
      signupBtn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Registration Failed';
      signupBtn.style.background = 'linear-gradient(135deg, #ff5252 0%, #ff1744 100%)';
      showMessage(`❌ Registration failed: ${error.message}`, 'error');
      
      // Reset button after error
      setTimeout(() => {
        signupBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Registration';
        signupBtn.style.background = 'linear-gradient(135deg, #1db954 0%, #1ed760 100%)';
      }, 3000);
    } finally {
      // Re-enable the submit button
      setTimeout(() => {
        signupBtn.disabled = false;
        signupBtn.classList.remove('btn-loading');
      }, 1000);
    }
  });
  
  // Helper function to validate email format
  function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
  
  // Helper function to show messages
  function showMessage(text, type) {
    signupMessage.textContent = text;
    signupMessage.className = 'signup-message ' + type;
    
    // Ensure the message is visible
    setTimeout(() => {
      signupMessage.style.opacity = '1';
      signupMessage.style.transform = 'translateY(0)';
    }, 10);
    
    // Auto-hide success messages after 5 seconds
    if (type === 'success') {
      setTimeout(() => {
        signupMessage.style.opacity = '0';
        signupMessage.style.transform = 'translateY(20px)';
      }, 5000);
    }
  }
  
  // Send registration data to the server with enhanced error handling
  async function simulateApiCall(data) {
    try {
      // Determine the API URL based on environment
      const apiUrl = window.location.hostname === 'localhost' 
        ? 'http://localhost:3000/api/register'
        : `${window.location.origin}/api/register`;
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        // Enhanced error messages based on status codes
        let errorMessage = result.message || 'Registration failed';
        
        switch (response.status) {
          case 409:
            errorMessage = 'This email is already registered. Please use a different email or try logging in.';
            break;
          case 400:
            errorMessage = 'Invalid registration data. Please check your information and try again.';
            break;
          case 500:
            errorMessage = 'Server error. Please try again later.';
            break;
          case 429:
            errorMessage = 'Too many registration attempts. Please wait a moment and try again.';
            break;
        }
        
        throw new Error(errorMessage);
      }
      
      return result;
    } catch (error) {
      console.error('API call failed:', error);
      
      // Network error handling
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('Network error. Please check your internet connection and try again.');
      }
      
      throw error;
    }
  }
  
  // Add enhanced interactions
  document.addEventListener('DOMContentLoaded', () => {
    // Add pulse animation to logo on page load
    const logoCircle = document.querySelector('.logo-circle');
    if (logoCircle) {
      logoCircle.classList.add('pulse');
    }
    
    // Add focus animations to form inputs
    const inputs = document.querySelectorAll('input');
    inputs.forEach(input => {
      input.addEventListener('focus', () => {
        input.parentElement.style.transform = 'translateY(-2px)';
        input.parentElement.style.transition = 'transform 0.2s ease';
      });
      
      input.addEventListener('blur', () => {
        input.parentElement.style.transform = 'translateY(0)';
      });
      
      // Add typing animation
      input.addEventListener('input', () => {
        if (input.value.length > 0) {
          input.style.borderColor = '#1db954';
          input.style.boxShadow = '0 0 0 3px rgba(29, 185, 84, 0.1)';
        } else {
          input.style.borderColor = '';
          input.style.boxShadow = '';
        }
      });
    });
    
    // Add hover effects to form groups
    const formGroups = document.querySelectorAll('.form-group');
    formGroups.forEach(group => {
      group.addEventListener('mouseenter', () => {
        group.style.transform = 'translateX(5px)';
        group.style.transition = 'transform 0.2s ease';
      });
      
      group.addEventListener('mouseleave', () => {
        group.style.transform = 'translateX(0)';
      });
    });
  });
});
