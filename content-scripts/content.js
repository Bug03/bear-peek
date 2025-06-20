/**
 * Bear Peek Extension - Smart Content Script
 * Specialized for extracting clean article content from news websites
 */

'use strict';

console.log('Bear Peek smart content script loaded on:', window.location.href);

// Prevent double injection
if (window.bearPeekLoaded) {
    console.log('Bear Peek already loaded, skipping...');
} else {
    window.bearPeekLoaded = true;
    
    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        console.log('Content script received message:', request);
        
        if (request.action === 'extractContent') {
            try {
                const content = extractArticleContent();
                sendResponse({ success: true, data: content });
            } catch (error) {
                console.error('Content extraction error:', error);
                sendResponse({ success: false, error: error.message });
            }
        } else {
            sendResponse({ success: false, error: 'Unknown action' });
        }
    });
}

/**
 * Smart article content extraction
 */
function extractArticleContent() {
    console.log('Starting smart content extraction...');
    
    // Get the domain to apply specific rules
    const domain = window.location.hostname.toLowerCase();
    
    // Extract title
    const title = extractTitle();
    
    // Extract main content
    const content = extractMainContent(domain);
    
    // Extract metadata
    const metadata = extractMetadata();
    
    const result = {
        content: content,
        metadata: {
            ...metadata,
            title: title,
            url: window.location.href,
            domain: domain,
            contentLength: content.length,
            extractedAt: new Date().toISOString()
        }
    };
    
    console.log('Extraction result:', {
        titleLength: title.length,
        contentLength: content.length,
        domain: domain
    });
    
    return result;
}

/**
 * Extract article title with multiple fallback strategies
 */
function extractTitle() {
    // Try different title selectors in order of preference
    const titleSelectors = [
        'h1.article-title',
        'h1.post-title',
        'h1.entry-title',
        'h1[class*="title"]',
        '.article-header h1',
        '.post-header h1',
        'article h1',
        'h1',
        '[class*="headline"] h1',
        '[class*="title"] h1'
    ];
    
    for (const selector of titleSelectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent.trim()) {
            console.log('Found title with selector:', selector);
            return element.textContent.trim();
        }
    }
    
    // Fallback to page title
    return document.title || 'Untitled Article';
}

/**
 * Extract main article content with domain-specific and generic strategies
 */
function extractMainContent(domain) {
    let content = '';
    
    // Domain-specific extraction rules
    if (domain.includes('cafef.vn')) {
        content = extractCafefContent();
    } else if (domain.includes('vnexpress.net')) {
        content = extractVnExpressContent();
    } else if (domain.includes('tuoitre.vn')) {
        content = extractTuoitreContent();
    } else if (domain.includes('dantri.com.vn')) {
        content = extractDantriContent();
    } else if (domain.includes('thanhnien.vn')) {
        content = extractThanhnienContent();
    }
    
    // If domain-specific extraction failed, use generic method
    if (!content || content.length < 200) {
        console.log('Domain-specific extraction failed, using generic method');
        content = extractGenericContent();
    }
    
    // Clean and format the content
    return cleanContent(content);
}

/**
 * Extract content from CafeF.vn
 */
function extractCafefContent() {
    const selectors = [
        '.edittor-content',
        '.article-content',
        '.detail-content',
        '.content-detail',
        '#detail-content'
    ];
    
    for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
            console.log('CafeF content found with selector:', selector);
            return extractTextFromElement(element);
        }
    }
    
    return '';
}

/**
 * Extract content from VnExpress.net
 */
function extractVnExpressContent() {
    const selectors = [
        '.fck_detail',
        '.content_detail',
        '.Normal',
        'article .content'
    ];
    
    for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
            console.log('VnExpress content found with selector:', selector);
            return extractTextFromElement(element);
        }
    }
    
    return '';
}

/**
 * Extract content from Tuoitre.vn
 */
function extractTuoitreContent() {
    const selectors = [
        '.detail-content',
        '.article-content',
        '#main-detail-body'
    ];
    
    for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
            console.log('Tuoitre content found with selector:', selector);
            return extractTextFromElement(element);
        }
    }
    
    return '';
}

/**
 * Extract content from Dantri.com.vn
 */
function extractDantriContent() {
    const selectors = [
        '.singular-content',
        '.detail-content',
        'article .content'
    ];
    
    for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
            console.log('Dantri content found with selector:', selector);
            return extractTextFromElement(element);
        }
    }
    
    return '';
}

/**
 * Extract content from Thanhnien.vn
 */
function extractThanhnienContent() {
    const selectors = [
        '.detail-content',
        '.article-body',
        '#detail-content'
    ];
    
    for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
            console.log('Thanhnien content found with selector:', selector);
            return extractTextFromElement(element);
        }
    }
    
    return '';
}

/**
 * Generic content extraction for unknown sites
 */
function extractGenericContent() {
    const contentSelectors = [
        // Semantic HTML5 elements
        'article',
        'main',
        '[role="main"]',
        
        // Common article containers
        '.article-content',
        '.post-content',
        '.entry-content',
        '.content',
        '.article-body',
        '.post-body',
        '.entry-body',
        '.story-body',
        '.article-text',
        '.post-text',
        
        // Generic content containers
        '#content',
        '#main-content',
        '.main-content',
        '#article',
        '.article',
        '#post',
        '.post'
    ];
    
    for (const selector of contentSelectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent.trim().length > 200) {
            console.log('Generic content found with selector:', selector);
            return extractTextFromElement(element);
        }
    }
    
    // Last resort: try to find the largest text block
    return findLargestTextBlock();
}

/**
 * Extract clean text from an element, removing unwanted parts
 */
function extractTextFromElement(element) {
    // Clone the element to avoid modifying the original
    const clone = element.cloneNode(true);
    
    // Remove unwanted elements
    const unwantedSelectors = [
        // Navigation and UI elements
        'nav', 'header', 'footer', 'aside',
        '.navigation', '.nav', '.menu', '.sidebar',
        
        // Advertisements and promotional content
        '.ads', '.ad', '.advertisement', '.promo', '.promotion',
        '.banner', '.sponsored', '.affiliate',
        '[class*="ad-"]', '[id*="ad-"]', '[class*="ads-"]',
        
        // Social and sharing elements
        '.social', '.share', '.sharing', '.social-share',
        '.facebook', '.twitter', '.linkedin', '.pinterest',
        
        // Comments and related content
        '.comments', '.comment', '.related', '.related-posts',
        '.related-articles', '.more-news', '.other-news',
        
        // Meta information
        '.meta', '.byline', '.author-info', '.date-info',
        '.tags', '.categories', '.breadcrumb',
        
        // Scripts and styles
        'script', 'style', 'noscript',
        
        // Forms and interactive elements
        'form', 'input', 'button', 'select', 'textarea',
        
        // Specific Vietnamese news site elements
        '.box-tin-lien-quan', '.tin-lien-quan', '.box-category',
        '.box-author', '.author-detail', '.nguon-bai-viet',
        '.chia-se', '.binh-luan', '.tag-bai-viet'
    ];
    
    unwantedSelectors.forEach(selector => {
        try {
            const elements = clone.querySelectorAll(selector);
            elements.forEach(el => el.remove());
        } catch (e) {
            console.warn('Error removing elements with selector:', selector);
        }
    });
    
    // Extract text and clean it
    return clone.textContent || clone.innerText || '';
}

/**
 * Find the largest text block on the page (last resort)
 */
function findLargestTextBlock() {
    const allElements = document.querySelectorAll('p, div, span, article, section');
    let largestElement = null;
    let maxLength = 0;
    
    allElements.forEach(element => {
        const text = element.textContent.trim();
        if (text.length > maxLength && text.length > 200) {
            // Avoid elements that are likely to be navigation or ads
            const className = element.className.toLowerCase();
            const id = element.id.toLowerCase();
            
            if (!className.includes('nav') && 
                !className.includes('menu') && 
                !className.includes('sidebar') &&
                !className.includes('ad') &&
                !id.includes('nav') &&
                !id.includes('menu') &&
                !id.includes('ad')) {
                
                maxLength = text.length;
                largestElement = element;
            }
        }
    });
    
    if (largestElement) {
        console.log('Found largest text block:', largestElement.tagName, largestElement.className);
        return extractTextFromElement(largestElement);
    }
    
    return document.body.textContent || '';
}

/**
 * Clean and format the extracted content
 */
function cleanContent(content) {
    if (!content) return '';
    
    return content
        // Remove excessive whitespace
        .replace(/\s+/g, ' ')
        // Remove multiple line breaks
        .replace(/\n\s*\n\s*\n/g, '\n\n')
        // Remove tabs
        .replace(/\t/g, ' ')
        // Remove special characters that might cause issues
        .replace(/[\x00-\x1F\x7F-\x9F]/g, '')
        // Remove common Vietnamese news artifacts
        .replace(/^.*?Theo\s+VnExpress.*?\n/gi, '')
        .replace(/^.*?Nguồn:.*?\n/gi, '')
        .replace(/^.*?Tác giả:.*?\n/gi, '')
        .replace(/\(Ảnh:.*?\)/gi, '')
        .replace(/\[.*?\]/gi, '')
        // Trim and limit length
        .trim()
        .substring(0, 8000); // Increased limit for articles
}

/**
 * Extract metadata from the page
 */
function extractMetadata() {
    const metadata = {
        description: '',
        author: '',
        publishDate: '',
        keywords: '',
        ogImage: '',
        readingTime: 0
    };
    
    // Extract from meta tags
    const metaTags = document.querySelectorAll('meta');
    metaTags.forEach(tag => {
        const name = (tag.getAttribute('name') || tag.getAttribute('property') || '').toLowerCase();
        const content = tag.getAttribute('content');
        
        if (!content) return;
        
        switch (name) {
            case 'description':
            case 'og:description':
                if (!metadata.description) metadata.description = content;
                break;
            case 'author':
            case 'article:author':
                if (!metadata.author) metadata.author = content;
                break;
            case 'article:published_time':
            case 'pubdate':
            case 'date':
                if (!metadata.publishDate) metadata.publishDate = content;
                break;
            case 'keywords':
                if (!metadata.keywords) metadata.keywords = content;
                break;
            case 'og:image':
                if (!metadata.ogImage) metadata.ogImage = content;
                break;
        }
    });
    
    // Try to extract author from page content if not found in meta
    if (!metadata.author) {
        const authorSelectors = [
            '.author', '.byline', '.by-author', '[class*="author"]'
        ];
        
        for (const selector of authorSelectors) {
            const element = document.querySelector(selector);
            if (element && element.textContent.trim()) {
                metadata.author = element.textContent.trim();
                break;
            }
        }
    }
    
    return metadata;
}