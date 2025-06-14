<p align="center">
  <img src="icons/icon128.png" alt="Bear Peek Icon" width="96" height="96">
</p>

# Bear Peek - Chrome Extension

Bear Peek is a powerful Chrome extension for extracting and analyzing web content with AI assistance.

## ✨ Key Features

- 🔍 **Smart Content Extraction**: Automatically detect and extract main content from any webpage
- 🧠 **AI Analysis**: Integration with AI services for content summarization and analysis
- 📊 **Detailed Insights**: Display statistics like word count, reading time, and key topics
- 🎯 **Context Menu**: Right-click to analyze selected text
- ⚙️ **Flexible Customization**: Configure language, summary length, and auto-extraction settings
- 💾 **Local Storage**: Save analysis results for later access

## 🚀 Installation

### From Chrome Web Store (Coming Soon)
1. Visit the Chrome Web Store
2. Search for "Bear Peek"
3. Click "Add to Chrome"

### Developer Mode Installation
1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/bear-peek.git
   cd bear-peek
   ```

2. Open Chrome and navigate to `chrome://extensions/`

3. Enable "Developer mode" in the top right corner

4. Click "Load unpacked" and select the `bear-peek` folder

5. The extension will appear in your extensions list and be ready to use

## 📖 Usage Guide

### Basic Content Extraction
1. Open any webpage with content
2. Click the Bear Peek icon in the browser toolbar
3. Click the "Extract Content" button
4. View the extracted content and analysis results

### Using Context Menu
1. Select text on any webpage
2. Right-click and choose "Analyze with Bear Peek"
3. Receive a notification when analysis is complete

### Extension Settings
1. Click the "Settings" button in the popup
2. Configure:
   - Analysis language
   - Summary length (short/medium/long)
   - Enable/disable auto-extraction
   - API key for AI services (if required)

## 🏗️ Project Structure

```
bear-peek/
├── manifest.json          # Extension configuration
├── popup/                 # Popup UI files
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── content-scripts/       # Scripts running on web pages
│   └── content.js
├── background/           # Background service worker
│   └── background.js
├── icons/               # Extension icons (16x16, 48x48, 128x128)
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── assets/              # Additional resources
└── lib/                 # Third-party libraries (if any)
```

## 🛠️ Development

### Prerequisites
- Chrome Browser (version 88+)
- Text editor (VS Code recommended)
- Basic knowledge of JavaScript, HTML, CSS

### Development Guidelines
- Follow Chrome Extension Manifest V3 standards
- Use ES6+ features
- Implement comprehensive error handling
- Follow security best practices
- Never hardcode API keys
- Use chrome.storage for sensitive data

### Testing
1. Load extension in Developer mode
2. Test on various websites
3. Check console for errors
4. Test edge cases (pages without content, protected pages, etc.)
5. Verify permissions work correctly

### Code Style
- Use 'use strict'
- JSDoc comments for functions
- Meaningful variable names
- Proper error handling with try-catch
- IIFE to avoid global namespace pollution

## 🔧 AI Integration

The extension supports integration with various AI services:

### OpenAI GPT
```javascript
// In background.js, replace the performContentAnalysis function
async function performContentAnalysis(content, url, title) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: [{
                role: 'user',
                content: `Summarize this content: ${content}`
            }]
        })
    });
    // Handle response...
}
```

### Claude API
```javascript
// Similar integration with Claude API
async function performContentAnalysis(content, url, title) {
    // Implement Claude API integration
}
```

## 📋 Permissions Used

- `storage`: Store settings and extracted content
- `activeTab`: Access current tab to extract content
- `scripting`: Inject content scripts for content extraction
- `contextMenus`: Create "Analyze with Bear Peek" context menu
- `notifications`: Display notifications when analysis is complete
- `host_permissions`: Access all websites for content extraction

## 🐛 Troubleshooting

### Extension Not Working
1. Check Console (F12) for errors
2. Verify extension is enabled in chrome://extensions/
3. Reload extension if necessary

### Cannot Extract Content
1. Check if the webpage has content
2. Some pages may block content scripts
3. Protected pages (chrome://, extension pages) cannot be accessed

### Settings Not Saving
1. Check storage permissions
2. Clear extension data and try again
3. Check for JavaScript errors

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Create a Pull Request

## 📝 Changelog

### v1.0.0 (Coming Soon)
- Initial release
- Basic content extraction
- AI analysis integration
- Context menu support
- Settings management

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

## 🙏 Acknowledgments

- Chrome Extension documentation
- AI service providers
- Open source community
