/**
 * Bear Peek Extension - Popup Script
 * Handles popup UI interactions and communication with content scripts and background
 */

'use strict';

(function() {
    // DOM elements
    const elements = {
        extractBtn: document.getElementById('extractBtn'),
        settingsBtn: document.getElementById('settingsBtn'),
        closeBtn: document.getElementById('closeBtn'),
        statusIndicator: document.getElementById('statusIndicator'),
        statusText: document.getElementById('statusText'),
        contentSection: document.getElementById('contentSection'),
        contentPreview: document.getElementById('contentPreview'),
        loadingSection: document.getElementById('loadingSection')
    };

    // Application state
    const state = {
        isLoading: false,
        currentTab: null,
        extractedContent: null
    };

    /**
     * Initialize the popup when DOM is loaded
     */
    function init() {
        setupEventListeners();
        getCurrentTab();
        loadUserSettings();
        updateStatus('ready', 'Ready');
    }

    /**
     * Setup all event listeners
     */
    function setupEventListeners() {
        elements.extractBtn.addEventListener('click', handleExtractContent);
        elements.settingsBtn.addEventListener('click', handleOpenSettings);
        elements.closeBtn.addEventListener('click', handleCloseContent);
        
        // Listen for messages from background script
        chrome.runtime.onMessage.addListener(handleRuntimeMessage);
    }

    /**
     * Get current active tab information
     */
    async function getCurrentTab() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            state.currentTab = tab;
            
            // Check if we can inject scripts on this tab
            if (!canInjectScript(tab.url)) {
                updateStatus('error', 'Cannot access this page');
                elements.extractBtn.disabled = true;
            }
        } catch (error) {
            console.error('Failed to get current tab:', error);
            updateStatus('error', 'Tab access failed');
        }
    }

    /**
     * Check if we can inject content scripts on the given URL
     */
    function canInjectScript(url) {
        const protectedPages = [
            'chrome://',
            'chrome-extension://',
            'moz-extension://',
            'edge://',
            'opera://',
            'brave://',
            'file://'
        ];
        
        return !protectedPages.some(prefix => url.startsWith(prefix));
    }

    /**
     * Handle extract content button click
     */
    async function handleExtractContent() {
        if (state.isLoading || !state.currentTab) return;
        
        try {
            setLoadingState(true);
            updateStatus('loading', 'Extracting content...');
            
            // Inject content script and extract content
            const results = await chrome.scripting.executeScript({
                target: { tabId: state.currentTab.id },
                func: extractPageContent
            });
            
            if (results && results[0] && results[0].result) {
                const content = results[0].result;
                state.extractedContent = content;
                displayExtractedContent(content);
                updateStatus('success', 'Content extracted');
                
                // Send content to background for processing
                chrome.runtime.sendMessage({
                    action: 'processContent',
                    data: {
                        content: content,
                        url: state.currentTab.url,
                        title: state.currentTab.title
                    }
                });
            } else {
                throw new Error('No content extracted');
            }
        } catch (error) {
            console.error('Content extraction failed:', error);
            updateStatus('error', 'Extraction failed');
            showError('Failed to extract content from this page');
        } finally {
            setLoadingState(false);
        }
    }

    /**
     * Content extraction function (injected into page)
     * This function runs in the context of the web page
     */
    function extractPageContent() {
        /**
         * Clean extracted text by removing extra whitespace and unwanted characters
         */
        function cleanText(text) {
            return text
                .replace(/\s+/g, ' ')
                .replace(/[\r\n\t]/g, ' ')
                .trim()
                .substring(0, 5000); // Limit content length
        }

        /**
         * Extract content using multiple fallback strategies
         */
        function extractContent() {
            const selectors = [
                'article',
                '[role="main"]',
                'main',
                '.post-content',
                '.entry-content',
                '.content',
                '.article-content',
                '.blog-post',
                '#content'
            ];
            
            // Try each selector
            for (const selector of selectors) {
                const element = document.querySelector(selector);
                if (element && element.innerText && element.innerText.length > 100) {
                    return cleanText(element.innerText);
                }
            }
            
            // Fallback to body content, but try to exclude navigation and footer
            const body = document.body.cloneNode(true);
            
            // Remove common navigation and footer elements
            const unwantedSelectors = [
                'nav', 'header', 'footer', 
                '.navigation', '.nav', '.menu',
                '.sidebar', '.ads', '.advertisement',
                '.social', '.share', '.comments'
            ];
            
            unwantedSelectors.forEach(selector => {
                const elements = body.querySelectorAll(selector);
                elements.forEach(el => el.remove());
            });
            
            return cleanText(body.innerText);
        }

        try {
            const content = extractContent();
            const metadata = {
                title: document.title,
                url: window.location.href,
                description: document.querySelector('meta[name="description"]')?.content || '',
                contentLength: content.length,
                extractedAt: new Date().toISOString()
            };

            return {
                content: content,
                metadata: metadata
            };
        } catch (error) {
            console.error('Content extraction error:', error);
            return null;
        }
    }

    /**
     * Display extracted content in the popup
     */
    function displayExtractedContent(data) {
        const { content, metadata } = data;
        
        // Show content section
        elements.contentSection.style.display = 'block';
        
        // Create content preview
        const preview = content.length > 500 
            ? content.substring(0, 500) + '...'
            : content;
        
        elements.contentPreview.innerHTML = `
            <div class="content-meta">
                <strong>Title:</strong> ${escapeHtml(metadata.title)}<br>
                <strong>Length:</strong> ${metadata.contentLength} characters<br>
                <strong>URL:</strong> <small>${escapeHtml(metadata.url)}</small>
            </div>
            <hr style="margin: 12px 0; border: none; border-top: 1px solid var(--border-color);">
            <div class="content-text">${escapeHtml(preview)}</div>
        `;
        
        // Scroll to content section
        elements.contentSection.scrollIntoView({ behavior: 'smooth' });
    }

    /**
     * Handle close content button click
     */
    function handleCloseContent() {
        elements.contentSection.style.display = 'none';
        state.extractedContent = null;
        updateStatus('ready', 'Ready');
    }

    /**
     * Handle settings button click
     */
    function handleOpenSettings() {
        // TODO: Implement settings modal or redirect to options page
        console.log('Settings clicked - implement settings UI');
        
        // For now, just show a simple alert
        chrome.tabs.create({
            url: chrome.runtime.getURL('options.html')
        });
    }

    /**
     * Handle messages from background script
     */
    function handleRuntimeMessage(request, sender, sendResponse) {
        switch (request.action) {
            case 'contentProcessed':
                if (request.success) {
                    updateStatus('success', 'Content processed');
                } else {
                    updateStatus('error', 'Processing failed');
                }
                break;
            
            case 'updateStatus':
                updateStatus(request.type, request.message);
                break;
                
            default:
                console.log('Unknown message:', request);
        }
        
        // Always send response to prevent errors
        sendResponse({ received: true });
    }

    /**
     * Update status indicator
     */
    function updateStatus(type, message) {
        elements.statusText.textContent = message;
        elements.statusIndicator.className = `status-indicator ${type}`;
    }

    /**
     * Set loading state
     */
    function setLoadingState(isLoading) {
        state.isLoading = isLoading;
        elements.extractBtn.disabled = isLoading;
        elements.loadingSection.style.display = isLoading ? 'flex' : 'none';
        
        if (isLoading) {
            elements.extractBtn.innerHTML = '<span class="spinner"></span> Extracting...';
        } else {
            elements.extractBtn.innerHTML = '<span class="btn-icon">📄</span> Extract Content';
        }
    }

    /**
     * Show error message
     */
    function showError(message) {
        // Simple error display - could be enhanced with a modal
        console.error('Bear Peek Error:', message);
        
        // You could implement a toast notification here
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-toast';
        errorDiv.textContent = message;
        errorDiv.style.cssText = `
            position: fixed;
            top: 10px;
            left: 10px;
            right: 10px;
            background: var(--error-color);
            color: white;
            padding: 8px 12px;
            border-radius: var(--radius-md);
            font-size: 12px;
            z-index: 1000;
        `;
        
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
            errorDiv.remove();
        }, 3000);
    }

    /**
     * Load user settings from storage
     */
    async function loadUserSettings() {
        try {
            const settings = await chrome.storage.sync.get([
                'language',
                'summaryLength',
                'autoExtract'
            ]);
            
            // Apply settings if needed
            console.log('User settings loaded:', settings);
        } catch (error) {
            console.error('Failed to load settings:', error);
        }
    }

    /**
     * Escape HTML to prevent XSS
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Handle errors globally
     */
    window.addEventListener('error', (event) => {
        console.error('Popup error:', event.error);
        updateStatus('error', 'An error occurred');
    });

    // Initialize when DOM is loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})(); 