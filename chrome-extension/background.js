chrome.commands.onCommand.addListener(async (command) => {
  if (command === "send-url") {
    console.log('Keyboard shortcut triggered:', command);
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        console.log('Sending URL:', tab.url);
        const directoryName = await downloadPageWithAssets(tab.id, tab.url, tab.title);
        await sendUrlToServer(tab.url, directoryName);
      }
    } catch (error) {
      console.error('Error sending URL:', error);
    }
  }
});

async function sendUrlToServer(url, directoryName) {
  try {
    const response = await fetch('http://localhost:3000/save-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'pocketz-api-key-2024'
      },
      body: JSON.stringify({ url, directoryName })
    });
    
    if (response.ok) {
      console.log('URL and directory sent successfully:', url, directoryName);
    } else {
      console.error('Failed to send URL:', response.status);
    }
  } catch (error) {
    console.error('Network error:', error);
  }
}

async function downloadPageWithAssets(tabId, url, title) {
  try {
    const subdirectory = generateDirectoryName(url, title);
    
    console.log('Extracting page text first (before any navigation)...');
    
    // Extract page text content FIRST, before clicking any PDF links
    let pageText = null;
    try {
      const textResult = await chrome.scripting.executeScript({
        target: { tabId: tabId },
        function: extractPageText
      });
      pageText = textResult[0].result;
      console.log('Successfully extracted page text');
    } catch (error) {
      console.warn('Failed to extract page text:', error);
    }
    
    console.log('Now extracting assets from page...');
    
    // Extract assets from the page (this may click PDFs and change the page)
    let assets = [];
    let pdfClicked = false;
    
    try {
      const result = await chrome.scripting.executeScript({
        target: { tabId: tabId },
        function: extractPageAssets
      });
      
      assets = result[0].result || [];
      console.log('Found assets:', assets);
      
      // Wait a bit if PDFs were clicked to allow downloads to start
      pdfClicked = assets.some(asset => asset.clicked);
      if (pdfClicked) {
        console.log('PDF download links clicked, waiting 3 seconds...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    } catch (error) {
      console.warn('Failed to extract assets (frame may have been removed):', error);
      // Continue without assets if frame was removed
    }
    
    // Send page text to server to save as index.md
    if (pageText) {
      await sendPageTextToServer(pageText, subdirectory);
    }
    
    // Download the main HTML page
    const sanitizedTitle = title ? title.replace(/[^a-z0-9]/gi, '_').substring(0, 30) : 'page';
    await chrome.downloads.download({
      url: url,
      filename: `${subdirectory}/${sanitizedTitle}.html`,
      saveAs: false
    });
    
    // Download all assets
    for (const asset of assets) {
      if (asset.url && asset.url.startsWith('http')) {
        try {
          const assetName = asset.url.split('/').pop() || 'asset';
          const assetPath = `${subdirectory}/assets/${assetName}`;
          
          await chrome.downloads.download({
            url: asset.url,
            filename: assetPath,
            saveAs: false
          });
          
          console.log('Downloaded asset:', assetPath);
        } catch (error) {
          console.warn('Failed to download asset:', asset.url, error);
        }
      }
    }
    
    console.log('Page and assets download completed');
    return subdirectory;
  } catch (error) {
    console.error('Error downloading page with assets:', error);
    return null;
  }
}

function extractPageAssets() {
  const assets = [];
  
  // Extract images
  document.querySelectorAll('img[src]').forEach(img => {
    if (img.src && img.src.startsWith('http')) {
      assets.push({ type: 'image', url: img.src });
    }
  });
  
  // Extract CSS files
  document.querySelectorAll('link[rel="stylesheet"][href]').forEach(link => {
    if (link.href && link.href.startsWith('http')) {
      assets.push({ type: 'css', url: link.href });
    }
  });
  
  // Extract JS files
  document.querySelectorAll('script[src]').forEach(script => {
    if (script.src && script.src.startsWith('http')) {
      assets.push({ type: 'js', url: script.src });
    }
  });
  
  // Look for PDF download links and click them
  const pdfLinks = document.querySelectorAll([
    'a[href*=".pdf"]',
    'a[data-test="download-pdf"]',
    'a[data-track-type*="pdf"]',
    '.c-pdf-download__link',
    'a[download][href*=".pdf"]'
  ].join(','));
  
  pdfLinks.forEach(link => {
    if (link.href && (link.href.includes('.pdf') || link.dataset.articlePdf)) {
      console.log('Found PDF download link, clicking:', link.href);
      // Click the link to trigger download
      link.click();
      
      // Also add to assets list for tracking
      const fullUrl = link.href.startsWith('http') ? link.href : new URL(link.href, window.location.origin).href;
      assets.push({ type: 'pdf', url: fullUrl, clicked: true });
    }
  });
  
  return assets;
}

function extractPageText() {
  // Get the page title
  const title = document.title;
  
  // Get the main content - try common content selectors
  const contentSelectors = [
    'main',
    'article', 
    '.content',
    '.article-content',
    '.post-content',
    '#content',
    'body'
  ];
  
  let content = '';
  for (const selector of contentSelectors) {
    const element = document.querySelector(selector);
    if (element) {
      content = element.innerText;
      break;
    }
  }
  
  // If no specific content found, get all text from body
  if (!content) {
    content = document.body.innerText;
  }
  
  // Clean up the text
  content = content
    .replace(/\n\s*\n\s*\n/g, '\n\n')  // Remove excessive line breaks
    .trim();
  
  // Truncate if too long (keep first 100KB of text)
  if (content.length > 100000) {
    content = content.substring(0, 100000) + '\n\n[Content truncated - original was too large]';
  }
  
  return {
    title: title,
    content: content,
    url: window.location.href
  };
}

async function sendPageTextToServer(pageData, directoryName) {
  try {
    const response = await fetch('http://localhost:3000/save-text', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'pocketz-api-key-2024'
      },
      body: JSON.stringify({ 
        title: pageData.title,
        content: pageData.content,
        url: pageData.url,
        directoryName: directoryName
      })
    });
    
    if (response.ok) {
      console.log('Page text sent successfully');
    } else {
      console.error('Failed to send page text:', response.status);
    }
  } catch (error) {
    console.error('Network error sending page text:', error);
  }
}

function generateDirectoryName(url, title) {
  // Generate timestamp in YYYY-MM-DD_HHMMSS format
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, ''); // HHMMSS
  const timestamp = `${dateStr}_${timeStr}`;
  
  // Extract domain and article ID
  const { domain, articleId } = extractDomainAndArticle(url, title);
  
  // Format: YYYY-MM-DD_HHMMSS_domain_articleid
  return `${timestamp}_${domain}_${articleId}`;
}

function extractDomainAndArticle(url, title) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    
    // Domain mapping for common sites
    const domainMap = {
      'nature.com': 'nature',
      'www.nature.com': 'nature',
      'arxiv.org': 'arxiv',
      'www.arxiv.org': 'arxiv',
      'pubmed.ncbi.nlm.nih.gov': 'pubmed',
      'github.com': 'github',
      'www.github.com': 'github',
      'youtube.com': 'youtube',
      'www.youtube.com': 'youtube',
      'youtu.be': 'youtube',
      'news.mit.edu': 'mitnews',
      'www.pnas.org': 'pnas',
      'pnas.org': 'pnas',
      'biorxiv.org': 'biorxiv',
      'www.biorxiv.org': 'biorxiv',
      'medrxiv.org': 'medrxiv',
      'www.medrxiv.org': 'medrxiv',
      'static-content.springer.com': 'staticcontentspringercom'
    };
    
    const domain = domainMap[hostname] || hostname.replace(/^www\./, '').replace(/[^a-z0-9]/g, '');
    
    // Article ID extraction patterns
    const extractors = {
      nature: () => {
        const match = url.match(/articles\/([^/?#]+)/);
        return match ? match[1] : null;
      },
      arxiv: () => {
        const match = url.match(/abs\/(\d+\.\d+v?\d*)/);
        return match ? match[1] : null;
      },
      pubmed: () => {
        const match = url.match(/articles\/PMC(\d+)/) || url.match(/\/(\d+)\/?$/);
        return match ? match[1] : null;
      },
      github: () => {
        const match = url.match(/github\.com\/([^/]+)\/([^/?#]+)/);
        return match ? `${match[1]}_${match[2]}` : null;
      },
      youtube: () => {
        const match = url.match(/watch\?v=([^&]+)/) || url.match(/youtu\.be\/([^/?]+)/);
        return match ? match[1] : null;
      },
      mitnews: () => {
        const match = url.match(/\/([^/?#]+)$/);
        return match ? match[1] : null;
      },
      pnas: () => {
        const match = url.match(/doi\/[^/]+\/pnas\.([^/?#]+)/);
        return match ? match[1] : null;
      },
      biorxiv: () => {
        const match = url.match(/content\/[^/]+\/([^/?#]+)/);
        return match ? match[1] : null;
      },
      medrxiv: () => {
        const match = url.match(/content\/[^/]+\/([^/?#]+)/);
        return match ? match[1] : null;
      },
      staticcontentspringercom: () => {
        // Extract filename from path for Springer static content
        const pathParts = urlObj.pathname.split('/');
        const filename = pathParts[pathParts.length - 1];
        return filename || null;
      }
    };
    
    // Try domain-specific extractor
    let articleId = null;
    const extractor = extractors[domain];
    if (extractor) {
      articleId = extractor();
    }
    
    // Fallback strategies
    if (!articleId) {
      // Try to get last path segment
      const pathParts = urlObj.pathname.split('/').filter(Boolean);
      if (pathParts.length > 0) {
        articleId = pathParts[pathParts.length - 1];
      }
    }
    
    if (!articleId && title) {
      // Use sanitized title as fallback
      articleId = title.toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '_')
        .substring(0, 30);
    }
    
    if (!articleId) {
      // Final fallback: use 'page'
      articleId = 'page';
    }
    
    // Clean article ID
    articleId = articleId.replace(/[^a-zA-Z0-9._-]/g, '_');
    
    return { domain, articleId };
  } catch (error) {
    console.error('Error extracting domain and article:', error);
    // Fallback to timestamp-based naming
    const timestamp = Date.now();
    return { domain: 'unknown', articleId: `page_${timestamp}` };
  }
}