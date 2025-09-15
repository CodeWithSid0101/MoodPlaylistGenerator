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
  
  // Event listeners
  refreshBtn.addEventListener('click', loadUsers);
  exportBtn.addEventListener('click', exportUsersToCsv);
  statusFilter.addEventListener('change', filterUsers);
  searchInput.addEventListener('input', filterUsers);
  
  // Functions
  async function loadUsers() {
    try {
      showEmptyState('Loading user data...');
      
      const response = await fetch(`${API_URL}/users`);
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
    
    totalUsersEl.textContent = total;
    pendingUsersEl.textContent = pending;
    approvedUsersEl.textContent = approved;
  }
  
  function filterUsers() {
    const statusValue = statusFilter.value;
    const searchValue = searchInput.value.toLowerCase();
    
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
    if (filteredUsers.length === 0) {
      showEmptyState('No users match your filters');
      return;
    }
    
    usersTableBody.innerHTML = '';
    
    filteredUsers.forEach(user => {
      const row = document.createElement('tr');
      
      // Format date
      const date = new Date(user.registeredAt);
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
  
  function showEmptyState(message) {
    usersTableBody.innerHTML = `
      <tr class="empty-state">
        <td colspan="5">${message}</td>
      </tr>
    `;
  }
  
  async function handleActionClick(e) {
    const btn = e.currentTarget;
    const userId = btn.dataset.id;
    const action = btn.dataset.action;
    
    try {
      let response;
      let user;
      
      // Find the user in our local state for reference
      const userIndex = users.findIndex(u => u.id === userId);
      if (userIndex === -1) {
        throw new Error('User not found in local state');
      }
      user = users[userIndex];
      
      switch (action) {
        case 'approve':
          // Call the API to update user status
          response = await fetch(`${API_URL}/users/${userId}/status`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: 'approved' })
          });
          
          if (!response.ok) {
            throw new Error(`Failed to approve user: ${response.statusText}`);
          }
          
          const approveResult = await response.json();
          users[userIndex].status = 'approved';
          showNotification(`User ${user.username} approved successfully`, 'success');
          break;
          
        case 'reject':
          // Call the API to update user status
          response = await fetch(`${API_URL}/users/${userId}/status`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: 'rejected' })
          });
          if (!response.ok) {
            throw new Error(`Failed to reject user: ${response.statusText}`);
          }
          const result = await response.json();
          users[userIndex].status = 'rejected';
          showNotification(`User ${user.username} rejected successfully`, 'success');
          break;
          
        case 'delete':
          // Call the API to delete user
          response = await fetch(`${API_URL}/users/${userId}`, {
            method: 'DELETE'
          });
          
          if (!response.ok) {
            throw new Error(`Failed to delete user: ${response.statusText}`);
          }
          
          users = users.filter(u => u.id !== userId);
          showNotification(`User ${user.username} deleted successfully`, 'success');
          break;
          
        default:
          throw new Error('Invalid action');
      }
      
      // Update UI
      updateStats();
      filterUsers();
      
    } catch (error) {
      console.error(`Error performing ${action}:`, error);
      showNotification(`Failed to ${action} user: ${error.message}`, 'error');
    }
  }
  
  function exportUsersToCsv() {
    try {
      // Create CSV content
      const headers = ['Username', 'Email', 'Registration Date', 'Status'];
      const csvRows = [
        headers.join(','),
        ...filteredUsers.map(user => {
          const date = new Date(user.registeredAt).toISOString().split('T')[0];
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
  }
});
