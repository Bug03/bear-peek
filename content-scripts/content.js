/**
 * Bear Peek Extension - Content Script
 * Runs on web pages to extract content and communicate with the extension
 */

'use strict';

// Namespace to avoid conflicts with page scripts
const BearPeek = (function() {
    // Check if already injected to prevent duplicates
    if (window.bearPeekInjected) {
        console.log('Bear Peek content script already injected');
        return;
    }
    window.bearPeekInjected = true;

    // Content script state
    const state = {
        isExtractingContent: false,
        lastExtractedContent: null,
        observer: null,
        extractedElements: new Set()
    };

    // Configuration
    const config = {
        contentSelectors: [
            'article',
            '[role="main"]',
            'main',
            '.post-content',
            '.entry-content',
            '.content',
            '.article-body',
            '.article-content',
            '.blog-post',
            '.story-body',
            '#content',
            '#main-content'
        ],
        excludeSelectors: [
            'nav',
            'header',
            'footer',
            '.navigation',
            '.nav',
            '.menu',
            '.sidebar',
            '.ads',
            '.advertisement',
            '.social',
            '.share',
            '.comments',
            '.related',
            'script',
            'style',
            'noscript'
        ],
        maxContentLength: 10000,
        minContentLength: 100
    };

    /**
     * Initialize the content script
     */
    function init() {
        console.log('Bear Peek content script initialized on:', window.location.href);
        
        // Listen for messages from popup/background
        chrome.runtime.onMessage.addListener(handleMessage);
        
        // Set up mutation observer for dynamic content
        setupMutationObserver();
        
        // Auto-extract content if enabled
        checkAutoExtract();
    }

    /**
     * Handle messages from popup/background scripts
     */
    function handleMessage(request, sender, sendResponse) {
        switch (request.action) {
            case 'extractContent':
                extractContent()
                    .then(content => sendResponse({ success: true, data: content }))
                    .catch(error => sendResponse({ success: false, error: error.message }));
                return true; // Async response
                
            case 'getPageInfo':
                sendResponse({
                    success: true,
                    data: getPageInfo()
                });
                break;
                
            case 'highlightContent':
                highlightExtractedContent(request.data);
                sendResponse({ success: true });
                break;
                
            case 'clearHighlights':
                clearHighlights();
                sendResponse({ success: true });
                break;
                
            default:
                sendResponse({ success: false, error: 'Unknown action' });
        }
    }

    /**
     * Extract content from the current page
     */
    async function extractContent() {
        if (state.isExtractingContent) {
            throw new Error('Content extraction already in progress');
        }

        state.isExtractingContent = true;

        try {
            // Wait for page to be ready
            await waitForPageReady();

            const extractedData = {
                content: extractMainContent(),
                metadata: extractMetadata(),
                extractedAt: new Date().toISOString(),
                url: window.location.href
            };

            // Validate extracted content
            if (!extractedData.content || extractedData.content.length < config.minContentLength) {
                throw new Error('Insufficient content extracted');
            }

            state.lastExtractedContent = extractedData;
            
            // Send to background for processing
            chrome.runtime.sendMessage({
                action: 'contentExtracted',
                data: extractedData
            });

            return extractedData;

        } catch (error) {
            console.error('Content extraction failed:', error);
            throw error;
        } finally {
            state.isExtractingContent = false;
        }
    }

    /**
     * Extract main content using multiple strategies
     */
    function extractMainContent() {
        let content = '';
        let extractedElement = null;

        // Strategy 1: Try semantic selectors
        for (const selector of config.contentSelectors) {
            const element = document.querySelector(selector);
            if (element && element.innerText && element.innerText.trim().length > config.minContentLength) {
                content = element.innerText;
                extractedElement = element;
                break;
            }
        }

        // Strategy 2: If no semantic content found, try to extract from body
        if (!content) {
            const bodyClone = document.body.cloneNode(true);
            
            // Remove unwanted elements
            config.excludeSelectors.forEach(selector => {
                const elements = bodyClone.querySelectorAll(selector);
                elements.forEach(el => el.remove());
            });

            content = bodyClone.innerText;
            extractedElement = document.body;
        }

        // Strategy 3: Try to find the largest text block
        if (!content || content.length < config.minContentLength) {
            const textBlocks = findLargestTextBlocks();
            if (textBlocks.length > 0) {
                content = textBlocks.map(block => block.text).join('\n\n');
                extractedElement = textBlocks[0].element;
            }
        }

        // Clean and limit content
        content = cleanText(content);
        
        if (content.length > config.maxContentLength) {
            content = content.substring(0, config.maxContentLength) + '...';
        }

        // Store extracted element for highlighting
        if (extractedElement) {
            state.extractedElements.add(extractedElement);
        }

        return content;
    }

    /**
     * Find the largest text blocks on the page
     */
    function findLargestTextBlocks() {
        const textBlocks = [];
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_ELEMENT,
            {
                acceptNode: function(node) {
                    // Skip excluded elements
                    if (config.excludeSelectors.some(selector => {
                        try {
                            return node.matches && node.matches(selector);
                        } catch (e) {
                            return false;
                        }
                    })) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    
                    return NodeFilter.FILTER_ACCEPT;
                }
            }
        );

        let node;
        while (node = walker.nextNode()) {
            const text = node.innerText;
            if (text && text.trim().length > config.minContentLength) {
                textBlocks.push({
                    element: node,
                    text: text.trim(),
                    length: text.trim().length
                });
            }
        }

        // Sort by length descending
        return textBlocks.sort((a, b) => b.length - a.length);
    }

    /**
     * Extract page metadata
     */
    function extractMetadata() {
        const metadata = {
            title: document.title,
            description: '',
            keywords: '',
            author: '',
            publishDate: '',
            language: document.documentElement.lang || 'en',
            ogTitle: '',
            ogDescription: '',
            ogImage: '',
            canonicalUrl: '',
            readingTime: 0
        };

        // Extract meta tags
        const metaTags = document.querySelectorAll('meta');
        metaTags.forEach(tag => {
            const name = tag.getAttribute('name') || tag.getAttribute('property');
            const content = tag.getAttribute('content');
            
            if (!name || !content) return;

            switch (name.toLowerCase()) {
                case 'description':
                    metadata.description = content;
                    break;
                case 'keywords':
                    metadata.keywords = content;
                    break;
                case 'author':
                    metadata.author = content;
                    break;
                case 'article:published_time':
                case 'pubdate':
                    metadata.publishDate = content;
                    break;
                case 'og:title':
                    metadata.ogTitle = content;
                    break;
                case 'og:description':
                    metadata.ogDescription = content;
                    break;
                case 'og:image':
                    metadata.ogImage = content;
                    break;
            }
        });

        // Extract canonical URL
        const canonical = document.querySelector('link[rel="canonical"]');
        if (canonical) {
            metadata.canonicalUrl = canonical.href;
        }

        // Calculate reading time (rough estimate)
        const wordCount = (state.lastExtractedContent?.content || '').split(/\s+/).length;
        metadata.readingTime = Math.ceil(wordCount / 200); // ~200 WPM

        return metadata;
    }

    /**
     * Get basic page information
     */
    function getPageInfo() {
        return {
            url: window.location.href,
            title: document.title,
            domain: window.location.hostname,
            readyState: document.readyState,
            contentLength: document.body.innerText.length,
            hasContent: document.body.innerText.trim().length > config.minContentLength
        };
    }

    /**
     * Clean extracted text
     */
    function cleanText(text) {
        if (!text) return '';
        
        return text
            // Normalize whitespace
            .replace(/\s+/g, ' ')
            // Remove excessive line breaks
            .replace(/\n\s*\n\s*\n/g, '\n\n')
            // Remove tabs
            .replace(/\t/g, ' ')
            // Remove special characters that might cause issues
            .replace(/[\x00-\x1F\x7F-\x9F]/g, '')
            // Trim
            .trim();
    }

    /**
     * Wait for page to be ready
     */
    function waitForPageReady() {
        return new Promise((resolve) => {
            if (document.readyState === 'complete') {
                resolve();
            } else {
                window.addEventListener('load', resolve, { once: true });
            }
        });
    }

    /**
     * Setup mutation observer for dynamic content
     */
    function setupMutationObserver() {
        if (state.observer) {
            state.observer.disconnect();
        }

        state.observer = new MutationObserver((mutations) => {
            let hasContentChanges = false;
            
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    hasContentChanges = true;
                }
            });

            if (hasContentChanges) {
                // Debounce content change notifications
                clearTimeout(state.contentChangeTimeout);
                state.contentChangeTimeout = setTimeout(() => {
                    chrome.runtime.sendMessage({
                        action: 'contentChanged',
                        data: { url: window.location.href }
                    });
                }, 1000);
            }
        });

        state.observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    /**
     * Check if auto-extract is enabled
     */
    async function checkAutoExtract() {
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'getSettings'
            });
            
            if (response.success && response.data.autoExtract) {
                // Auto-extract after a delay
                setTimeout(() => {
                    extractContent().catch(error => {
                        console.log('Auto-extract failed:', error.message);
                    });
                }, 2000);
            }
        } catch (error) {
            console.log('Could not check auto-extract setting:', error.message);
        }
    }

    /**
     * Highlight extracted content
     */
    function highlightExtractedContent(options = {}) {
        const { color = '#ffeb3b', opacity = 0.3 } = options;
        
        state.extractedElements.forEach(element => {
            element.style.backgroundColor = color;
            element.style.opacity = opacity;
            element.style.transition = 'background-color 0.3s ease';
            element.classList.add('bear-peek-highlighted');
        });
    }

    /**
     * Clear content highlights
     */
    function clearHighlights() {
        const highlighted = document.querySelectorAll('.bear-peek-highlighted');
        highlighted.forEach(element => {
            element.style.backgroundColor = '';
            element.style.opacity = '';
            element.classList.remove('bear-peek-highlighted');
        });
    }

    /**
     * Cleanup when page unloads
     */
    function cleanup() {
        if (state.observer) {
            state.observer.disconnect();
        }
        
        clearHighlights();
        clearTimeout(state.contentChangeTimeout);
        
        // Clear references
        state.extractedElements.clear();
        state.lastExtractedContent = null;
    }

    // Setup cleanup on page unload
    window.addEventListener('beforeunload', cleanup);

    // Public API
    return {
        init,
        extractContent,
        getPageInfo,
        highlightExtractedContent,
        clearHighlights
    };
})();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        BearPeek.init();
    });
} else {
    BearPeek.init();
}

// Handle errors
window.addEventListener('error', (event) => {
    console.error('Bear Peek content script error:', event.error);
});

console.log('Bear Peek content script loaded'); 