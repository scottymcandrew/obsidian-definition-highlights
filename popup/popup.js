/**
 * Obsidian Definition Highlights - Popup Script
 */

// DOM Elements
const enableToggle = document.getElementById('enableToggle');
const statusText = document.getElementById('statusText');
const definitionCount = document.getElementById('definitionCount');
const highlightCount = document.getElementById('highlightCount');
const refreshButton = document.getElementById('refreshButton');
const settingsButton = document.getElementById('settingsButton');
const lastUpdatedTime = document.getElementById('lastUpdatedTime');
const statusDot = document.getElementById('statusDot');
const connectionStatus = document.getElementById('connectionStatus');

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Get settings
    const { settings } = await chrome.storage.sync.get(['settings']);
    
    // Update UI based on enabled state
    if (settings) {
      enableToggle.checked = settings.enabled;
      statusText.textContent = settings.enabled ? 'Enabled' : 'Disabled';
    }
    
    // Get definitions
    const { definitions, lastUpdated } = await chrome.storage.local.get(['definitions', 'lastUpdated']);
    
    // Update definition count
    if (definitions) {
      definitionCount.textContent = definitions.length;
    }
    
    // Update last updated time
    if (lastUpdated) {
      const date = new Date(lastUpdated);
      lastUpdatedTime.textContent = date.toLocaleString();
    }
    
    // Get active tab to check highlight count
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab) {
      chrome.tabs.sendMessage(activeTab.id, { action: 'getHighlightCount' }, (response) => {
        if (response && response.success) {
          highlightCount.textContent = response.count;
        }
      });
    }
    
    // Check Obsidian connection
    checkObsidianConnection();
  } catch (error) {
    console.error('Error initializing popup:', error);
  }
});

// Toggle extension enabled state
enableToggle.addEventListener('change', async () => {
  try {
    // Get current settings
    const { settings } = await chrome.storage.sync.get(['settings']);
    
    // Update enabled state
    settings.enabled = enableToggle.checked;
    await chrome.storage.sync.set({ settings });
    
    // Update UI
    statusText.textContent = settings.enabled ? 'Enabled' : 'Disabled';
    
    // Notify active tab
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab) {
      chrome.tabs.sendMessage(activeTab.id, { 
        action: 'toggleEnabled', 
        enabled: settings.enabled 
      });
    }
  } catch (error) {
    console.error('Error toggling enabled state:', error);
  }
});

// Refresh definitions
refreshButton.addEventListener('click', async () => {
  try {
    // Show loading state
    refreshButton.textContent = 'Refreshing...';
    refreshButton.disabled = true;
    
    // Request refresh from background script
    const response = await chrome.runtime.sendMessage({ action: 'refreshDefinitions' });
    
    if (response && response.success) {
      // Update definition count
      definitionCount.textContent = response.definitions.length;
      
      // Update last updated time
      const date = new Date();
      lastUpdatedTime.textContent = date.toLocaleString();
      
      // Update highlights on active tab
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (activeTab) {
        chrome.tabs.sendMessage(activeTab.id, { action: 'refreshHighlights' }, (response) => {
          if (response && response.success) {
            // Update highlight count
            chrome.tabs.sendMessage(activeTab.id, { action: 'getHighlightCount' }, (countResponse) => {
              if (countResponse && countResponse.success) {
                highlightCount.textContent = countResponse.count;
              }
            });
          }
        });
      }
    }
    
    // Check Obsidian connection
    checkObsidianConnection();
  } catch (error) {
    console.error('Error refreshing definitions:', error);
  } finally {
    // Reset button state
    refreshButton.textContent = 'Refresh Definitions';
    refreshButton.disabled = false;
  }
});

// Open options page
settingsButton.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

// Check Obsidian connection
async function checkObsidianConnection() {
  try {
    // Get current settings
    const { settings } = await chrome.storage.sync.get(['settings']);
    
    if (!settings || !settings.apiKey || !settings.vaultName) {
      // Not configured
      statusDot.className = 'dot disconnected';
      connectionStatus.textContent = 'Obsidian not configured';
      return;
    }
    
    // Try to connect to Obsidian
    const response = await chrome.runtime.sendMessage({ 
      action: 'checkObsidianConnection'
    });
    
    if (response && response.success) {
      // Connected successfully
      statusDot.className = 'dot connected';
      connectionStatus.textContent = 'Connected to Obsidian';
    } else {
      // Failed to connect
      statusDot.className = 'dot disconnected';
      connectionStatus.textContent = 'Cannot connect to Obsidian';
    }
  } catch (error) {
    // Error checking connection
    statusDot.className = 'dot disconnected';
    connectionStatus.textContent = 'Connection error';
    console.error('Error checking Obsidian connection:', error);
  }
}
