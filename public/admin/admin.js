// Admin Dashboard Script
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Check if user is authenticated
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = '/index.html';
      return;
    }

    // Verify admin status
    const response = await fetch('/api/v1/users/me', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      window.location.href = '/index.html';
      return;
    }

    const user = await response.json();
    if (!user.data.user.isAdmin) {
      window.location.href = '/index.html';
      return;
    }

    // Load pending approvals
    await loadPendingApprovals();
    
    // Set up event listeners
    document.getElementById('logoutBtn').addEventListener('click', logout);

  } catch (error) {
    console.error('Error initializing admin dashboard:', error);
    showNotification('Error initializing admin dashboard', 'error');
  }
});

async function loadPendingApprovals() {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch('/api/v1/users/pending-approvals', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to load pending approvals');
    }

    const { data } = await response.json();
    const container = document.getElementById('approvalsContainer');
    
    if (!data.users || data.users.length === 0) {
      container.innerHTML = '<p>No pending approvals</p>';
      return;
    }

    container.innerHTML = data.users.map(user => `
      <div class="approval-item">
        <div class="user-info">
          <h4>${user.username}</h4>
          <p>${user.email}</p>
          <small>Registered: ${new Date(user.createdAt).toLocaleDateString()}</small>
        </div>
        <div class="approval-actions">
          <button class="btn-approve" data-user-id="${user.id}">Approve</button>
          <button class="btn-reject" data-user-id="${user.id}">Reject</button>
        </div>
      </div>
    `).join('');

    // Add event listeners to buttons
    document.querySelectorAll('.btn-approve').forEach(btn => {
      btn.addEventListener('click', (e) => handleApproval(e.target.dataset.userId, true));
    });

    document.querySelectorAll('.btn-reject').forEach(btn => {
      btn.addEventListener('click', (e) => handleApproval(e.target.dataset.userId, false));
    });

  } catch (error) {
    console.error('Error loading pending approvals:', error);
    showNotification('Failed to load pending approvals', 'error');
  }
}

async function handleApproval(userId, approved) {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`/api/v1/users/${userId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ approved })
    });

    if (!response.ok) {
      throw new Error(`Failed to ${approved ? 'approve' : 'reject'} user`);
    }

    showNotification(`User ${approved ? 'approved' : 'rejected'} successfully`, 'success');
    await loadPendingApprovals();
  } catch (error) {
    console.error(`Error ${approved ? 'approving' : 'rejecting'} user:`, error);
    showNotification(`Failed to ${approved ? 'approve' : 'reject'} user`, 'error');
  }
}

function logout() {
  localStorage.removeItem('token');
  window.location.href = '/index.html';
}

function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, 5000);
}
