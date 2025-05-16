/**
 * MCP Dashboard JavaScript
 * Provides client-side functionality for the MCP dashboard
 */

// DOM ready handler
document.addEventListener('DOMContentLoaded', function() {
  // Initialize tooltips
  const tooltips = document.querySelectorAll('[data-bs-toggle="tooltip"]');
  tooltips.forEach(tooltip => {
    new bootstrap.Tooltip(tooltip);
  });
  
  // Check if timeout advisory should be shown
  const timeoutAdvisory = document.getElementById('timeout-advisory');
  if (timeoutAdvisory) {
    const dismissedAdvisory = localStorage.getItem('timeout-advisory-dismissed');
    if (dismissedAdvisory) {
      timeoutAdvisory.style.display = 'none';
    }
  }
});

/**
 * Dismiss the timeout advisory and remember the choice
 */
function dismissTimeoutAlert() {
  localStorage.setItem('timeout-advisory-dismissed', 'true');
}

/**
 * Show an alert message
 * @param {string} message - The message to display (can include HTML)
 * @param {string} type - The alert type (success, danger, warning, info)
 * @param {number} [duration=5000] - How long to show the alert in milliseconds (0 for no auto-dismiss)
 */
function showAlert(message, type = 'info', duration = 5000) {
  const alertsContainer = document.getElementById('alerts-container');
  
  const alert = document.createElement('div');
  alert.className = `alert alert-${type} alert-dismissible fade show`;
  alert.role = 'alert';
  alert.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `;
  
  alertsContainer.appendChild(alert);
  
  // Auto-dismiss after specified duration (if not 0)
  if (duration > 0) {
    setTimeout(() => {
      alert.classList.remove('show');
      setTimeout(() => alert.remove(), 150);
    }, duration);
  }
}

/**
 * Check the health of an adapter
 * @param {string} adapterName - The name of the adapter to check
 */
function checkAdapterHealth(adapterName) {
  // Show checking status
  const errorCell = document.getElementById(`adapter-error-${adapterName}`);
  if (errorCell) {
    errorCell.innerHTML = `
      <div class="d-flex align-items-center">
        <div class="spinner-border spinner-border-sm text-primary me-2" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        <span>Checking...</span>
      </div>
    `;
  }
  
  fetch('/health')
    .then(response => {
      if (!response.ok) {
        throw new Error(`Health check failed: ${response.statusText}`);
      }
      return response.json();
    })
    .then(data => {
      if (data.adapters && data.adapters[adapterName]) {
        const adapterStatus = data.adapters[adapterName];
        const statusText = adapterStatus.status === 'ok' ? 'success' : 'warning';
        
        // Update the error cell
        if (errorCell) {
          if (adapterStatus.lastError) {
            errorCell.innerHTML = `<span class="text-danger">${adapterStatus.lastError}</span>`;
          } else {
            errorCell.innerHTML = '<span class="text-muted">None</span>';
          }
        }
        
        // Create detailed status message
        let statusDetails = '';
        if (adapterStatus.responseTime) {
          statusDetails += `<li>Response Time: ${adapterStatus.responseTime}ms</li>`;
        }
        if (adapterStatus.defaultTimeout) {
          statusDetails += `<li>Default Timeout: ${adapterStatus.defaultTimeout}ms</li>`;
        }
        
        // Show detailed alert
        showAlert(`
          <h5>Adapter ${adapterName} Status: ${adapterStatus.status === 'ok' ? 'OK' : 'ERROR'}</h5>
          ${statusDetails ? `<ul>${statusDetails}</ul>` : ''}
          ${adapterStatus.lastError ? 
            `<div class="alert alert-danger mt-2 mb-0">Last Error: ${adapterStatus.lastError}</div>` : 
            ''}
        `, statusText);
        
        // Update the status in the table
        const statusCell = document.querySelector(`#adapter-row-${adapterName} td:nth-child(2)`);
        if (statusCell) {
          statusCell.innerHTML = adapterStatus.status === 'ok' ? 
            '<span class="badge bg-success">Connected</span>' : 
            '<span class="badge bg-danger">Disconnected</span>';
        }
      } else {
        if (errorCell) {
          errorCell.innerHTML = '<span class="text-warning">Status unknown</span>';
        }
        showAlert(`No status data for adapter ${adapterName}`, 'warning');
      }
    })
    .catch(error => {
      if (errorCell) {
        errorCell.innerHTML = `<span class="text-danger">${error.message}</span>`;
      }
      showAlert(`Error checking adapter health: ${error.message}`, 'danger');
    });
}

/**
 * Load and display active sessions
 */
function loadSessions() {
  fetch('/api/sessions')
    .then(response => {
      if (!response.ok) {
        throw new Error(`Failed to fetch sessions: ${response.statusText}`);
      }
      return response.json();
    })
    .then(sessions => {
      const sessionsTable = document.getElementById('sessions-table');
      const sessionCount = document.getElementById('session-count');
      
      if (sessionsTable && sessions) {
        // Update session count
        if (sessionCount) {
          sessionCount.textContent = Object.keys(sessions).length;
        }
        
        // Clear loading message
        const tbody = sessionsTable.querySelector('tbody');
        tbody.innerHTML = '';
        
        // Add session rows
        if (Object.keys(sessions).length === 0) {
          const tr = document.createElement('tr');
          tr.innerHTML = '<td colspan="4" class="text-center">No active sessions</td>';
          tbody.appendChild(tr);
        } else {
          Object.entries(sessions).forEach(([sessionId, sessionData]) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
              <td><code>${sessionId}</code></td>
              <td>${new Date(sessionData.created).toLocaleString()}</td>
              <td>${new Date(sessionData.lastUpdated).toLocaleString()}</td>
              <td>
                <button class="btn btn-sm btn-primary me-1" onclick="viewSessionDetails('${sessionId}')" 
                        data-bs-toggle="tooltip" title="View Session Details">
                  <i class="bi bi-eye"></i> View
                </button>
              </td>
            `;
            tbody.appendChild(tr);
          });
        }
      }
    })
    .catch(error => {
      showAlert(`Error loading sessions: ${error.message}`, 'danger');
      const sessionCount = document.getElementById('session-count');
      if (sessionCount) {
        sessionCount.textContent = 'Error';
      }
    });
}

/**
 * View session details
 * @param {string} sessionId - The ID of the session to view
 */
function viewSessionDetails(sessionId) {
  fetch(`/api/sessions/${sessionId}`)
    .then(response => {
      if (!response.ok) {
        throw new Error(`Failed to fetch session: ${response.statusText}`);
      }
      return response.json();
    })
    .then(sessionData => {
      // Create a modal to display session details
      const modalId = `session-modal-${Date.now()}`;
      const modal = document.createElement('div');
      modal.className = 'modal fade';
      modal.id = modalId;
      modal.tabIndex = -1;
      modal.setAttribute('aria-hidden', 'true');
      
      modal.innerHTML = `
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Session Details: ${sessionId}</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
              <ul class="nav nav-tabs" id="sessionTabs" role="tablist">
                <li class="nav-item" role="presentation">
                  <button class="nav-link active" data-bs-toggle="tab" data-bs-target="#details-tab" 
                          type="button" role="tab">Details</button>
                </li>
                <li class="nav-item" role="presentation">
                  <button class="nav-link" data-bs-toggle="tab" data-bs-target="#state-tab" 
                          type="button" role="tab">State</button>
                </li>
              </ul>
              <div class="tab-content p-3">
                <div class="tab-pane fade show active" id="details-tab" role="tabpanel">
                  <p><strong>Created:</strong> ${new Date(sessionData.created).toLocaleString()}</p>
                  <p><strong>Last Updated:</strong> ${new Date(sessionData.lastUpdated).toLocaleString()}</p>
                  <p><strong>Active:</strong> ${sessionData.active ? 'Yes' : 'No'}</p>
                </div>
                <div class="tab-pane fade" id="state-tab" role="tabpanel">
                  <pre class="bg-light p-3 rounded">${formatJson(sessionData.state)}</pre>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
            </div>
          </div>
        </div>
      `;
      
      document.body.appendChild(modal);
      const modalInstance = new bootstrap.Modal(modal);
      modalInstance.show();
      
      // Remove modal from DOM when hidden
      modal.addEventListener('hidden.bs.modal', function() {
        document.body.removeChild(modal);
      });
    })
    .catch(error => {
      showAlert(`Error fetching session details: ${error.message}`, 'danger');
    });
}

/**
 * Execute an MCP command
 */
function executeCommand() {
  // Get form data
  const form = document.getElementById('command-form');
  const formData = new FormData(form);
  const commandName = document.querySelector('h1 code').textContent;
  const sessionId = formData.get('sessionId');
  const timeout = formData.get('timeout');
  const enableRetry = formData.get('enableRetry') === 'true';
  
  // Show loading indicator
  const resultContainer = document.getElementById('command-result');
  resultContainer.innerHTML = `
    <div class="d-flex justify-content-center align-items-center p-5">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
      <span class="ms-3">Executing command, please wait...</span>
    </div>
  `;
  
  // Build parameters object
  const parameters = {};
  
  // Process all form fields except sessionId, timeout, and enableRetry
  for (const [key, value] of formData.entries()) {
    if (key !== 'sessionId' && key !== 'timeout' && key !== 'enableRetry') {
      // Handle different parameter types
      try {
        if (value.startsWith('[') || value.startsWith('{')) {
          // Try to parse as JSON
          parameters[key] = JSON.parse(value);
        } else if (value === 'true' || value === 'false') {
          // Handle booleans
          parameters[key] = value === 'true';
        } else if (!isNaN(value) && value.trim() !== '') {
          // Handle numbers
          parameters[key] = Number(value);
        } else {
          // Handle strings
          parameters[key] = value;
        }
      } catch (e) {
        // If JSON parsing fails, use as string
        parameters[key] = value;
      }
    }
  }
  
  // Send request to API
  fetch('/api/execute', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      command: commandName,
      sessionId: sessionId,
      parameters: parameters,
      timeout: timeout,
      enableRetry: enableRetry
    })
  })
  .then(response => response.json())
  .then(data => {
    // Display the result
    if (data.status === 'error') {
      let errorMessage = data.error.message;
      let errorDetails = '';
      let retryInfo = '';
      
      // Add retry information if available
      if (data.dashboard && data.dashboard.retryAttempts) {
        retryInfo = `
          <div class="alert alert-warning mt-3">
            <strong>Retry Information:</strong> Failed after ${data.dashboard.retryAttempts} of ${data.dashboard.maxRetries} attempts.
          </div>
        `;
      }
      
      // Check for timeout errors
      if (data.error.code === 'TIMEOUT_ERROR' || errorMessage.includes('timed out')) {
        errorDetails = `
          <div class="card border-warning mt-3">
            <div class="card-header bg-warning text-white">
              <h5 class="mb-0">Timeout Suggestions</h5>
            </div>
            <div class="card-body">
              <p>The operation timed out. Consider the following:</p>
              <ul>
                <li>Increase the timeout value (current: ${timeout}ms)</li>
                <li>Enable auto-retry for automatic backoff</li>
                <li>Check if the requested resource is available</li>
                <li>Try again later if the service might be overloaded</li>
              </ul>
              
              <div class="d-grid gap-2 mt-3">
                <button class="btn btn-warning" onclick="retryWithLongerTimeout()">
                  Retry with 2x Longer Timeout
                </button>
              </div>
            </div>
          </div>
        `;
      }
      
      resultContainer.innerHTML = `
        <div class="alert alert-danger">
          <h5 class="alert-heading">Error</h5>
          <p>${errorMessage}</p>
          <hr>
          <pre>${formatJson(data.error)}</pre>
        </div>
        ${retryInfo}
        ${errorDetails}
      `;
    } else {
      let retryInfo = '';
      
      // Add retry success information if retried
      if (data.dashboard && data.dashboard.retryCount > 0) {
        retryInfo = `
          <div class="alert alert-info">
            <strong>Retry Information:</strong> Succeeded after ${data.dashboard.retryCount + 1} attempt(s).
          </div>
        `;
      }
      
      resultContainer.innerHTML = `
        <div class="alert alert-success">
          <h5 class="alert-heading">Success</h5>
          <p>Command executed successfully.</p>
        </div>
        ${retryInfo}
        <h6>Result:</h6>
        <pre class="bg-light p-3 rounded">${formatJson(data.result)}</pre>
      `;
    }
  })
  .catch(error => {
    showAlert(`Error executing command: ${error.message}`, 'danger');
    resultContainer.innerHTML = `
      <div class="alert alert-danger">
        <h5 class="alert-heading">Error</h5>
        <p>${error.message}</p>
      </div>
      <div class="alert alert-warning">
        <h5 class="alert-heading">Connection Problem</h5>
        <p>There was a problem connecting to the server. This could be due to:</p>
        <ul>
          <li>Network connectivity issues</li>
          <li>Server is not responding</li>
          <li>Request was too large or timed out at the network level</li>
        </ul>
      </div>
    `;
  });
}

/**
 * Retry the command with a longer timeout
 */
function retryWithLongerTimeout() {
  // Double the current timeout value
  const timeoutInput = document.getElementById('timeout');
  const currentTimeout = parseInt(timeoutInput.value, 10);
  timeoutInput.value = currentTimeout * 2;
  
  // Enable auto-retry
  document.getElementById('enableRetry').checked = true;
  
  // Execute the command again
  executeCommand();
}

/**
 * Format JSON with syntax highlighting
 * @param {Object} obj - The object to format
 * @returns {string} HTML-formatted JSON with syntax highlighting
 */
function formatJson(obj) {
  if (!obj) return 'null';
  
  // Convert to string with pretty printing
  const jsonString = JSON.stringify(obj, null, 2);
  
  // Add syntax highlighting
  return jsonString
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function(match) {
      let cls = 'json-number';
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = 'json-key';
        } else {
          cls = 'json-string';
        }
      } else if (/true|false/.test(match)) {
        cls = 'json-boolean';
      } else if (/null/.test(match)) {
        cls = 'json-null';
      }
      return '<span class="' + cls + '">' + match + '</span>';
    });
}
