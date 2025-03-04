/**
 * Obsidian Definition Highlights - Background Script
 * Handles communication with Obsidian via the Local REST API
 */

// Default settings
const DEFAULT_SETTINGS = {
  apiKey: '',
  apiPort: 27123,
  vaultName: '',
  refreshInterval: 30, // minutes
  highlightColor: '#ffeb3b50',
  enabled: true
};

// Initialize extension settings
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(['settings'], (result) => {
    if (!result.settings) {
      chrome.storage.sync.set({ settings: DEFAULT_SETTINGS });
    }
  });
});

// Function to fetch definitions from Obsidian
async function fetchDefinitions() {
  try {
    // Get current settings
    const { settings } = await chrome.storage.sync.get(['settings']);
    
    if (!settings.apiKey || !settings.vaultName) {
      console.warn('Obsidian API key or vault name not configured');
      return [];
    }
    
    // Fetch all notes from Obsidian
    const response = await fetch(`https://127.0.0.1:${settings.apiPort}/vault/notes`, {
      headers: {
        'Authorization': `Bearer ${settings.apiKey}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch notes: ${response.status} ${response.statusText}`);
    }
    
    const notes = await response.json();
    
    // Filter notes with type:definition in frontmatter or content
    const definitions = notes.filter(note => {
      // Check frontmatter if available
      if (note.frontmatter && note.frontmatter.type === 'definition') {
        return true;
      }
      
      // Check content for type:definition tag
      if (note.content && note.content.includes('type:definition')) {
        return true;
      }
      
      return false;
    });
    
    // Process each definition to extract summary
    const processedDefinitions = definitions.map(note => {
      // Extract first paragraph or specified summary as the definition preview
      let summary = '';
      if (note.content) {
        // Try to find a summary section first
        const summaryMatch = note.content.match(/^summary::(.*?)$/m);
        if (summaryMatch && summaryMatch[1]) {
          summary = summaryMatch[1].trim();
        } else {
          // Otherwise take the first paragraph, skipping frontmatter
          const contentWithoutFrontmatter = note.content.replace(/^---\n(.|\n)*?\n---\n/, '');
          const firstParagraph = contentWithoutFrontmatter.split('\n\n')[0];
          summary = firstParagraph.trim();
        }
      }
      
      return {
        id: note.path,
        title: note.basename || note.path.split('/').pop().replace('.md', ''),
        path: note.path,
        summary: summary,
        lastModified: note.mtime || Date.now()
      };
    });
    
    return processedDefinitions;
  } catch (error) {
    console.error('Error fetching definitions from Obsidian:', error);
    return [];
  }
}

// Function to update the cache of definitions
async function updateDefinitionsCache() {
  try {
    const definitions = await fetchDefinitions();
    await chrome.storage.local.set({
      'definitions': definitions,
      'lastUpdated': Date.now()
    });
    return definitions;
  } catch (error) {
    console.error('Error updating definitions cache:', error);
    return [];
  }
}

// Function to get definitions from cache or refresh if needed
async function getDefinitions() {
  try {
    const { settings } = await chrome.storage.sync.get(['settings']);
    const data = await chrome.storage.local.get(['definitions', 'lastUpdated']);
    
    // Calculate how old the cache is
    const cacheAge = Date.now() - (data.lastUpdated || 0);
    const maxCacheAge = settings.refreshInterval * 60 * 1000; // Convert minutes to milliseconds
    
    // Refresh cache if too old or empty
    if (cacheAge > maxCacheAge || !data.definitions || data.definitions.length === 0) {
      return await updateDefinitionsCache();
    }
    
    return data.definitions || [];
  } catch (error) {
    console.error('Error getting definitions:', error);
    return [];
  }
}

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Handle different message actions
  switch (request.action) {
    case 'getDefinitions':
      // Return definitions to content script
      getDefinitions().then(definitions => {
        sendResponse({ success: true, definitions });
      }).catch(error => {
        sendResponse({ success: false, error: error.message });
      });
      return true; // Indicate async response
      
    case 'refreshDefinitions':
      // Force refresh the definitions cache
      updateDefinitionsCache().then(definitions => {
        sendResponse({ success: true, definitions });
      }).catch(error => {
        sendResponse({ success: false, error: error.message });
      });
      return true; // Indicate async response
      
    case 'getSettings':
      // Return current settings
      chrome.storage.sync.get(['settings'], (result) => {
        sendResponse({ success: true, settings: result.settings || DEFAULT_SETTINGS });
      });
      return true; // Indicate async response
      
    case 'setSettings':
      // Update settings
      chrome.storage.sync.set({ settings: request.settings }, () => {
        sendResponse({ success: true });
      });
      return true; // Indicate async response
      
    default:
      sendResponse({ success: false, error: 'Unknown action' });
      return false;
  }
});

// Set up periodic refresh of definitions
setInterval(() => {
  chrome.storage.sync.get(['settings'], (result) => {
    const settings = result.settings || DEFAULT_SETTINGS;
    if (settings.enabled) {
      updateDefinitionsCache();
    }
  });
}, 60 * 60 * 1000); // Check every hour, but use setting to determine if refresh is needed
