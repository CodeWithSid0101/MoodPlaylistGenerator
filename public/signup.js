async function handleSignup(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value || document.getElementById('signupUsername').value;
    const email = document.getElementById('email').value || document.getElementById('signupEmail').value;
    const password = document.getElementById('password').value || document.getElementById('signupPassword').value;
    
    if (!username || !email || !password) {
        alert('Please fill in all fields');
        return;
    }
    
    try {
        const response = await fetch('/api/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('Account created successfully! Please wait for admin approval.');
            window.location.href = '/login.html';
        } else {
            alert(data.message);
        }
    } catch (error) {
        console.error('Signup error:', error);
        alert('Signup failed. Please try again.');
    }
}


// ... existing code...
