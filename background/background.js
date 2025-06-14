/**
 * Bear Peek Extension - Background Service Worker
 * Handles extension lifecycle, message routing, and background processing
 */

'use strict';

// Extension state management
const extensionState = {
    isInitialized: false,
    activeProcesses: new Map(),
    userSettings: {}
};

/**
 * Initialize the extension on install/startup
 */
chrome.runtime.onInstalled.addListener(async (details) => {
    console.log('Bear Peek extension installed/updated:', details.reason);
    
    try {
        // Set up default settings
        await initializeDefaultSettings();
        
        // Create context menu items if needed
        await setupContextMenus();
        
        // Initialize extension state
        extensionState.isInitialized = true;
        
        console.log('Bear Peek extension initialized successfully');
    } catch (error) {
        console.error('Extension initialization failed:', error);
    }
});

/**
 * Handle extension startup
 */
chrome.runtime.onStartup.addListener(() => {
    console.log('Bear Peek extension started');
    extensionState.isInitialized = true;
});

/**
 * Handle messages from popup and content scripts
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Background received message:', request);
    
    // Handle async operations properly
    handleMessage(request, sender)
        .then(result => {
            sendResponse({ success: true, data: result });
        })
        .catch(error => {
            console.error('Message handling error:', error);
            sendResponse({ success: false, error: error.message });
        });
    
    // Return true to indicate async response
    return true;
});

/**
 * Main message handler
 */
async function handleMessage(request, sender) {
    const { action, data } = request;
    
    switch (action) {
        case 'processContent':
            return await processExtractedContent(data, sender);
            
        case 'getSettings':
            return await getUserSettings();
            
        case 'saveSettings':
            return await saveUserSettings(data);
            
        case 'ping':
            return { status: 'pong', timestamp: Date.now() };
            
        default:
            throw new Error(`Unknown action: ${action}`);
    }
}

/**
 * Process extracted content from content scripts
 */
async function processExtractedContent(data, sender) {
    const { content, url, title } = data;
    const processId = generateProcessId();
    
    try {
        // Store process in active processes
        extensionState.activeProcesses.set(processId, {
            content,
            url,
            title,
            startTime: Date.now(),
            status: 'processing'
        });
        
        // Notify popup of processing start
        notifyPopup('updateStatus', {
            type: 'loading',
            message: 'Processing content...'
        });
        
        // Here you would integrate with AI APIs or other processing services
        const processedResult = await performContentAnalysis(content, url, title);
        
        // Store processed result
        await storeProcessedContent(processId, processedResult);
        
        // Update process status
        extensionState.activeProcesses.set(processId, {
            ...extensionState.activeProcesses.get(processId),
            status: 'completed',
            result: processedResult,
            completedTime: Date.now()
        });
        
        // Notify popup of completion
        notifyPopup('contentProcessed', {
            success: true,
            processId: processId,
            result: processedResult
        });
        
        return { processId, result: processedResult };
        
    } catch (error) {
        console.error('Content processing failed:', error);
        
        // Update process status
        if (extensionState.activeProcesses.has(processId)) {
            extensionState.activeProcesses.set(processId, {
                ...extensionState.activeProcesses.get(processId),
                status: 'failed',
                error: error.message,
                failedTime: Date.now()
            });
        }
        
        // Notify popup of failure
        notifyPopup('contentProcessed', {
            success: false,
            error: error.message
        });
        
        throw error;
    }
}

/**
 * Perform content analysis (placeholder for AI integration)
 */
async function performContentAnalysis(content, url, title) {
    // Simulate processing time
    await delay(1000);
    
    // This is where you would integrate with AI APIs like:
    // - OpenAI GPT for summarization
    // - Claude for analysis
    // - Custom NLP services
    
    const analysis = {
        summary: generateBasicSummary(content),
        wordCount: content.split(/\s+/).length,
        readingTime: Math.ceil(content.split(/\s+/).length / 200), // ~200 WPM
        keyTopics: extractKeyTopics(content),
        sentiment: 'neutral', // Placeholder
        extractedAt: new Date().toISOString(),
        url: url,
        title: title
    };
    
    return analysis;
}

/**
 * Generate a basic summary (placeholder implementation)
 */
function generateBasicSummary(content) {
    // Simple extractive summary - take first few sentences
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20);
    const summaryLength = Math.min(3, sentences.length);
    
    return sentences.slice(0, summaryLength).join('. ').trim() + '.';
}

/**
 * Extract key topics (basic implementation)
 */
function extractKeyTopics(content) {
    // Simple keyword extraction
    const words = content.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(word => word.length > 4);
    
    const wordCount = {};
    words.forEach(word => {
        wordCount[word] = (wordCount[word] || 0) + 1;
    });
    
    // Get top 5 most frequent words
    return Object.entries(wordCount)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([word]) => word);
}

/**
 * Store processed content in local storage
 */
async function storeProcessedContent(processId, result) {
    try {
        const storageKey = `processed_${processId}`;
        await chrome.storage.local.set({
            [storageKey]: {
                ...result,
                processId: processId,
                storedAt: Date.now()
            }
        });
        
        // Clean up old stored content (keep only last 10)
        await cleanupOldContent();
        
    } catch (error) {
        console.error('Failed to store processed content:', error);
        throw error;
    }
}

/**
 * Clean up old stored content to prevent storage bloat
 */
async function cleanupOldContent() {
    try {
        const allStorage = await chrome.storage.local.get();
        const processedKeys = Object.keys(allStorage)
            .filter(key => key.startsWith('processed_'))
            .sort((a, b) => {
                const timeA = allStorage[a].storedAt || 0;
                const timeB = allStorage[b].storedAt || 0;
                return timeB - timeA; // Most recent first
            });
        
        // Keep only the 10 most recent
        if (processedKeys.length > 10) {
            const keysToRemove = processedKeys.slice(10);
            await chrome.storage.local.remove(keysToRemove);
            console.log(`Cleaned up ${keysToRemove.length} old processed content entries`);
        }
    } catch (error) {
        console.error('Failed to cleanup old content:', error);
    }
}

/**
 * Initialize default settings
 */
async function initializeDefaultSettings() {
    try {
        const existingSettings = await chrome.storage.sync.get([
            'language',
            'summaryLength',
            'autoExtract',
            'apiKey'
        ]);
        
        const defaultSettings = {
            language: 'english',
            summaryLength: 'medium',
            autoExtract: false,
            apiKey: '', // Users need to set their own API key
            ...existingSettings
        };
        
        await chrome.storage.sync.set(defaultSettings);
        extensionState.userSettings = defaultSettings;
        
        console.log('Default settings initialized:', defaultSettings);
    } catch (error) {
        console.error('Failed to initialize settings:', error);
        throw error;
    }
}

/**
 * Get user settings
 */
async function getUserSettings() {
    try {
        const settings = await chrome.storage.sync.get([
            'language',
            'summaryLength',
            'autoExtract',
            'apiKey'
        ]);
        
        extensionState.userSettings = settings;
        return settings;
    } catch (error) {
        console.error('Failed to get user settings:', error);
        throw error;
    }
}

/**
 * Save user settings
 */
async function saveUserSettings(settings) {
    try {
        await chrome.storage.sync.set(settings);
        extensionState.userSettings = { ...extensionState.userSettings, ...settings };
        
        console.log('Settings saved:', settings);
        return settings;
    } catch (error) {
        console.error('Failed to save settings:', error);
        throw error;
    }
}

/**
 * Setup context menus
 */
async function setupContextMenus() {
    try {
        // Remove existing menus
        await chrome.contextMenus.removeAll();
        
        // Create context menu for text selection
        chrome.contextMenus.create({
            id: 'bearPeekAnalyze',
            title: 'Analyze with Bear Peek',
            contexts: ['selection']
        });
        
        console.log('Context menus created');
    } catch (error) {
        console.error('Failed to setup context menus:', error);
    }
}

/**
 * Handle context menu clicks
 */
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === 'bearPeekAnalyze' && info.selectionText) {
        try {
            const result = await performContentAnalysis(
                info.selectionText,
                tab.url,
                `Selected text from ${tab.title}`
            );
            
            // Store the result
            const processId = generateProcessId();
            await storeProcessedContent(processId, result);
            
            // Notify user
            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icons/icon48.png',
                title: 'Bear Peek',
                message: 'Selected text analyzed successfully!'
            });
            
        } catch (error) {
            console.error('Context menu analysis failed:', error);
            
            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icons/icon48.png',
                title: 'Bear Peek Error',
                message: 'Failed to analyze selected text'
            });
        }
    }
});

/**
 * Notify popup of updates
 */
function notifyPopup(action, data) {
    chrome.runtime.sendMessage({
        action: action,
        ...data
    }).catch(error => {
        // Popup might be closed, which is normal
        console.log('Could not notify popup (probably closed):', error.message);
    });
}

/**
 * Generate unique process ID
 */
function generateProcessId() {
    return `process_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Utility function for delays
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Handle service worker lifecycle
 */
self.addEventListener('activate', (event) => {
    console.log('Bear Peek service worker activated');
});

/**
 * Clean up when extension is suspended
 */
chrome.runtime.onSuspend.addListener(() => {
    console.log('Bear Peek extension suspending, cleaning up...');
    
    // Clean up active processes
    extensionState.activeProcesses.clear();
    extensionState.isInitialized = false;
});

// Error handling for unhandled promise rejections
self.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection in background:', event.reason);
});

console.log('Bear Peek background service worker loaded'); 