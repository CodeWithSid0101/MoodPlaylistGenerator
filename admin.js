// Admin Dashboard Functionality
document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const refreshBtn = document.getElementById('refresh-btn');
  const exportBtn = document.getElementById('export-btn');
  const statusFilter = document.getElementById('status-filter');
  const searchInput = document.getElementById('search-input');
  const usersTableBody = document.getElementById('users-table-body');
  const totalUsersEl = document.getElementById('total-users');
  const pendingUsersEl = document.getElementById('pending-users');
  const approvedUsersEl = document.getElementById('approved-users');
  
  // API URL - dynamically determine based on environment
  const API_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:3000/api'
    : `${window.location.origin}/api`;
  
  // State
  let users = [];
  let filteredUsers = [];
  
  // Initialize
  loadUsers();
  
  // Make functions globally accessible
  window.loadUsers = loadUsers;
  window.loadPendingUsers = loadUsers; // Alias for backward compatibility
  window.exportUsersToCsv = exportUsersToCsv;
  window.handleActionClick = handleActionClick;
  
  // Event listeners
  if (refreshBtn) refreshBtn.addEventListener('click', loadUsers);
  if (exportBtn) exportBtn.addEventListener('click', exportUsersToCsv);
  if (statusFilter) statusFilter.addEventListener('change', filterUsers);
  if (searchInput) searchInput.addEventListener('input', filterUsers);
  
  // Functions
  async function loadUsers() {
    try {
      showEmptyState('Loading user data...');
      
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Please log in first');
        return;
      }
      
      const response = await fetch(`${API_URL}/admin/pending-users`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
});

      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      
      const data = await response.json();
      users = data.users || [];
      
      updateStats();
      filterUsers();
      
      showNotification('User data loaded successfully', 'success');
    } catch (error) {
      console.error('Error loading users:', error);
      showEmptyState('Failed to load user data. Please try again.');
      showNotification('Error loading user data', 'error');
    }
  }
  
  function updateStats() {
    const total = users.length;
    const pending = users.filter(user => user.status === 'pending').length;
    const approved = users.filter(user => user.status === 'approved').length;
    
    if (totalUsersEl) totalUsersEl.textContent = total;
    if (pendingUsersEl) pendingUsersEl.textContent = pending;
    if (approvedUsersEl) approvedUsersEl.textContent = approved;
  }
  
  function filterUsers() {
    const statusValue = statusFilter ? statusFilter.value : 'all';
    const searchValue = searchInput ? searchInput.value.toLowerCase() : '';
    
    filteredUsers = users.filter(user => {
      // Status filter
      if (statusValue !== 'all' && user.status !== statusValue) {
        return false;
      }
      
      // Search filter
      if (searchValue) {
        const username = user.username.toLowerCase();
        const email = user.email.toLowerCase();
        return username.includes(searchValue) || email.includes(searchValue);
      }
      
      return true;
    });
    
    renderUsers();
  }
  
  function renderUsers() {
    if (!usersTableBody) return;
    
    if (filteredUsers.length === 0) {
      showEmptyState('No users match your filters');
      return;
    }
    
    usersTableBody.innerHTML = '';
    
    filteredUsers.forEach(user => {
      const row = document.createElement('tr');
      
      // Format date
      const date = new Date(user.created_at);
      const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      row.innerHTML = `
        <td>${user.username}</td>
        <td>${user.email}</td>
        <td>${formattedDate}</td>
        <td>
          <span class="status-badge status-${user.status}">${user.status}</span>
        </td>
        <td>
          ${user.status === 'pending' ? `
            <button class="action-btn approve-btn" data-id="${user.id}" data-action="approve">
              <i class="fas fa-check-circle"></i>
            </button>
            <button class="action-btn reject-btn" data-id="${user.id}" data-action="reject">
              <i class="fas fa-times-circle"></i>
            </button>
          ` : ''}
          <button class="action-btn delete-btn" data-id="${user.id}" data-action="delete">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      `;
      
      // Add event listeners to action buttons
      row.querySelectorAll('.action-btn').forEach(btn => {
        btn.addEventListener('click', handleActionClick);
      });
      
      usersTableBody.appendChild(row);
    });
  }
  
  async function handleActionClick(e) {
    const userId = e.target.closest('.action-btn').dataset.id;
    const action = e.target.closest('.action-btn').dataset.action;
    
    if (action === 'approve' || action === 'reject') {
      await handleUserApproval(userId, action);
    } else if (action === 'delete') {
      await handleUserDelete(userId);
    }
  }
  
  async function handleUserApproval(userId, action) {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/admin/approve-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ userId, action })
      });
      
      const data = await response.json();
      
      if (data.success) {
        showNotification(`User ${action}d successfully`, 'success');
        loadUsers();
      } else {
        showNotification(data.message, 'error');
      }
    } catch (error) {
      console.error('Error updating user:', error);
      showNotification('Error updating user status', 'error');
    }
  }
  
  async function handleUserDelete(userId) {
    if (!confirm('Are you sure you want to delete this user?')) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/admin/delete-user/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        showNotification('User deleted successfully', 'success');
        loadUsers();
      } else {
        showNotification(data.message, 'error');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      showNotification('Error deleting user', 'error');
    }
  }
  
  function showEmptyState(message) {
    if (!usersTableBody) return;
    usersTableBody.innerHTML = `
      <tr class="empty-state">
        <td colspan="5">${message}</td>
      </tr>
    `;
  }
  
  function exportUsersToCsv() {
    try {
      // Create CSV content
      const headers = ['Username', 'Email', 'Registration Date', 'Status'];
      const csvRows = [
        headers.join(','),
        ...filteredUsers.map(user => {
          const date = new Date(user.created_at).toISOString().split('T')[0];
          return [
            `"${user.username}"`,
            `"${user.email}"`,
            `"${date}"`,
            `"${user.status}"`
          ].join(',');
        })
      ];
      
      const csvContent = csvRows.join('\n');
      
      // Create download link
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      
      link.setAttribute('href', url);
      link.setAttribute('download', `spotify-users-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.display = 'none';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      showNotification('CSV file exported successfully', 'success');
    } catch (error) {
      console.error('Error exporting CSV:', error);
      showNotification('Failed to export CSV file', 'error');
    }
  }
  
  function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    if (notification) {
      notification.textContent = message;
      notification.className = `admin-notification ${type}`;
      
      // Show notification
      setTimeout(() => {
        notification.classList.add('show');
      }, 10);
      
      // Hide notification after 3 seconds
      setTimeout(() => {
        notification.classList.remove('show');
      }, 3000);
    } else {
      // Fallback to alert if notification element doesn't exist
      if (type === 'error') {
        alert('Error: ' + message);
      } else {
        alert(message);
      }
    }
  }
});