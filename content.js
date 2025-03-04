/**
 * Obsidian Definition Highlights - Content Script
 * Highlights terms on webpages that match definitions in Obsidian
 */

// Global variables
let definitions = [];
let settings = {};
let markInstance = null;
let observer = null;
let debounceTimer = null;

// Initialize the extension
async function initialize() {
  try {
    // Get settings first
    const settingsResponse = await chrome.runtime.sendMessage({ action: 'getSettings' });
    if (!settingsResponse.success) {
      throw new Error('Failed to load settings');
    }
    
    settings = settingsResponse.settings;
    
    // Check if extension is enabled
    if (!settings.enabled) {
      console.log('Obsidian Definition Highlights is disabled');
      return;
    }
    
    // Get definitions from background script
    const definitionsResponse = await chrome.runtime.sendMessage({ action: 'getDefinitions' });
    if (!definitionsResponse.success) {
      throw new Error('Failed to load definitions');
    }
    
    definitions = definitionsResponse.definitions;
    
    // If we have definitions, set up the highlighting
    if (definitions && definitions.length > 0) {
      // Initial pass for highlighting
      highlightDefinitionTerms();
      
      // Set up observer for dynamic content
      setupMutationObserver();
    } else {
      console.log('No definitions found to highlight');
    }
  } catch (error) {
    console.error('Error initializing Obsidian Definition Highlights:', error);
  }
}

// Function to highlight definition terms on the page
function highlightDefinitionTerms() {
  // Get array of terms to highlight
  const terms = definitions.map(def => def.title);
  
  // If no terms, exit early
  if (!terms.length) return;
  
  // Create new Mark instance if not existing
  if (!markInstance) {
    markInstance = new Mark(document.body);
  }
  
  // Apply the highlighting
  markInstance.mark(terms, {
    className: 'obsidian-definition-highlight',
    separateWordSearch: false,
    accuracy: {
      value: 'exactly',
      limiters: [',', '.', ';', ':', '!', '?', '(', ')', '[', ']', '{', '}', '/', '\\', '-', '_', '=', '+', '&', '"', "'"]
    },
    each: (element) => {
      // For each highlighted element, attach the tooltip
      attachTooltip(element);
    }
  });
}

// Function to attach tooltips to highlighted terms
function attachTooltip(element) {
  const term = element.textContent;
  const definition = definitions.find(d => d.title.toLowerCase() === term.toLowerCase());
  
  if (!definition) return;
  
  // Configure the tooltip
  tippy(element, {
    content: createTooltipContent(definition),
    allowHTML: true,
    interactive: true,
    placement: 'bottom',
    theme: 'obsidian',
    maxWidth: 400,
    trigger: 'mouseenter focus',
    onShow(instance) {
      const content = instance.popper.querySelector('.tippy-content');
      content.style.padding = '10px';
    }
  });
  
  // Apply custom highlight style
  element.style.backgroundColor = settings.highlightColor || '#ffeb3b50';
  element.style.borderBottom = '1px dotted #666';
  element.style.cursor = 'help';
}

// Function to create the tooltip content
function createTooltipContent(definition) {
  const container = document.createElement('div');
  container.className = 'obsidian-definition-tooltip';
  
  // Title
  const title = document.createElement('h3');
  title.textContent = definition.title;
  title.style.margin = '0 0 8px 0';
  title.style.fontSize = '16px';
  title.style.borderBottom = '1px solid #ccc';
  title.style.paddingBottom = '4px';
  
  // Summary
  const summary = document.createElement('p');
  summary.textContent = definition.summary || 'No summary available';
  summary.style.margin = '0 0 12px 0';
  summary.style.fontSize = '14px';
  summary.style.lineHeight = '1.4';
  
  // Open in Obsidian link
  const link = document.createElement('a');
  link.textContent = 'Open in Obsidian';
  link.href = `obsidian://open?vault=${encodeURIComponent(settings.vaultName)}&file=${encodeURIComponent(definition.path)}`;
  link.style.display = 'inline-block';
  link.style.fontSize = '12px';
  link.style.color = '#7E6BEF';
  link.style.textDecoration = 'none';
  link.style.padding = '4px 8px';
  link.style.borderRadius = '4px';
  link.style.backgroundColor = '#F0EDFF';
  
  // Add hover effect
  link.addEventListener('mouseenter', () => {
    link.style.backgroundColor = '#E2DBFF';
  });
  link.addEventListener('mouseleave', () => {
    link.style.backgroundColor = '#F0EDFF';
  });
  
  // Assemble the tooltip
  container.appendChild(title);
  container.appendChild(summary);
  container.appendChild(link);
  
  return container;
}

// Function to set up mutation observer for dynamic content
function setupMutationObserver() {
  // If already observing, disconnect first
  if (observer) {
    observer.disconnect();
  }
  
  // Create new observer
  observer = new MutationObserver((mutations) => {
    // Use debounce to avoid running too often
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      for (const mutation of mutations) {
        if (mutation.addedNodes.length) {
          // Process added DOM nodes
          mutation.addedNodes.forEach(node => {
            // Only process element nodes
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Skip our own tooltips and highlights to avoid infinite loops
              if (node.classList?.contains('obsidian-definition-tooltip') || 
                  node.classList?.contains('obsidian-definition-highlight')) {
                return;
              }
              
              // Create a new Mark instance for this node
              const nodeMarker = new Mark(node);
              
              // Get array of terms to highlight
              const terms = definitions.map(def => def.title);
              
              // Apply highlighting to this node
              nodeMarker.mark(terms, {
                className: 'obsidian-definition-highlight',
                separateWordSearch: false,
                accuracy: {
                  value: 'exactly',
                  limiters: [',', '.', ';', ':', '!', '?', '(', ')', '[', ']', '{', '}', '/', '\\', '-', '_', '=', '+', '&', '"', "'"]
                },
                each: (element) => {
                  // For each highlighted element, attach the tooltip
                  attachTooltip(element);
                }
              });
            }
          });
        }
      }
    }, 300); // 300ms debounce
  });
  
  // Start observing
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// Start the extension when the page is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

// Handle messages from popup or background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'refreshHighlights':
      // Remove existing highlights
      if (markInstance) {
        markInstance.unmark();
      }
      
      // Get fresh data and re-highlight
      initialize();
      sendResponse({ success: true });
      break;
      
    case 'toggleEnabled':
      // Toggle the enabled state
      settings.enabled = request.enabled;
      
      if (settings.enabled) {
        // Re-initialize if enabling
        initialize();
      } else {
        // Remove highlights if disabling
        if (markInstance) {
          markInstance.unmark();
        }
        
        // Disconnect observer
        if (observer) {
          observer.disconnect();
          observer = null;
        }
      }
      
      sendResponse({ success: true });
      break;
      
    default:
      sendResponse({ success: false, error: 'Unknown action' });
  }
  return true;
});
