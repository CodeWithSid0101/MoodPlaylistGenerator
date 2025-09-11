// Admin Dashboard Script
document.addEventListener('DOMContentLoaded', () => {
    const pendingApprovals = document.getElementById('pending-approvals');
    const logoutBtn = document.getElementById('logout-btn');
    const statusMessage = document.getElementById('status-message');

    // Check if user is authenticated
    const checkAuth = () => {
        const token = localStorage.getItem('admin_token');
        if (!token) {
            window.location.href = '/admin/login.html';
            return false;
        }
        return true;
    };

    // Show status message
    const showStatus = (message, type = 'info') => {
        statusMessage.textContent = message;
        statusMessage.className = `alert alert-${type}`;
        statusMessage.style.display = 'block';
        
        // Hide after 5 seconds
        setTimeout(() => {
            statusMessage.style.display = 'none';
        }, 5000);
    };

    // Load pending approvals
    const loadPendingApprovals = async () => {
        try {
            const response = await fetch('/api/admin/pending-approvals', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load pending approvals');
            }

            const data = await response.json();
            renderPendingApprovals(data);
        } catch (error) {
            showStatus(error.message, 'error');
        }
    };

    // Render pending approvals
    const renderPendingApprovals = (users) => {
        if (!users || users.length === 0) {
            pendingApprovals.innerHTML = '<p>No pending approvals</p>';
            return;
        }

        pendingApprovals.innerHTML = users.map(user => `
            <div class="approval-item">
                <div class="user-info">
                    <h4>${user.username}</h4>
                    <p>${user.email}</p>
                    <small>Registered: ${new Date(user.createdAt).toLocaleDateString()}</small>
                </div>
                <div class="approval-actions">
                    <button class="btn btn-approve" data-user-id="${user.id}">Approve</button>
                    <button class="btn btn-reject" data-user-id="${user.id}">Reject</button>
                </div>
            </div>
        `).join('');

        // Add event listeners to buttons
        document.querySelectorAll('.btn-approve').forEach(btn => {
            btn.addEventListener('click', () => handleApproval(btn.dataset.userId, true));
        });

        document.querySelectorAll('.btn-reject').forEach(btn => {
            btn.addEventListener('click', () => handleApproval(btn.dataset.userId, false));
        });
    };

    // Handle user approval/rejection
    const handleApproval = async (userId, approved) => {
        try {
            const response = await fetch(`/api/admin/approve-user/${userId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
                },
                body: JSON.stringify({ approved })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to update user status');
            }

            showStatus(`User ${approved ? 'approved' : 'rejected'} successfully`, 'success');
            loadPendingApprovals();
        } catch (error) {
            showStatus(error.message, 'error');
        }
    };

    // Handle logout
    const handleLogout = () => {
        localStorage.removeItem('admin_token');
        window.location.href = '/admin/login.html';
    };

    // Event listeners
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    // Initialize
    if (checkAuth()) {
        loadPendingApprovals();
    }
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
