chrome.commands.onCommand.addListener(async (command) => {
  if (command === "send-url") {
    console.log('Keyboard shortcut triggered:', command);
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        console.log('Sending URL:', tab.url);
        await sendUrlToServer(tab.url);
        await downloadPageWithAssets(tab.id, tab.url, tab.title);
      }
    } catch (error) {
      console.error('Error sending URL:', error);
    }
  }
});

async function sendUrlToServer(url) {
  try {
    const response = await fetch('http://localhost:3000/save-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'pocketz-api-key-2024'
      },
      body: JSON.stringify({ url })
    });
    
    if (response.ok) {
      console.log('URL sent successfully:', url);
    } else {
      console.error('Failed to send URL:', response.status);
    }
  } catch (error) {
    console.error('Network error:', error);
  }
}

async function downloadPageWithAssets(tabId, url, title) {
  try {
    const timestampNs = Date.now() * 1000000 + (performance.now() % 1) * 1000000;
    const sanitizedTitle = title.replace(/[^a-z0-9]/gi, '_').substring(0, 30);
    const subdirectory = `pocketz_${timestampNs}`;
    
    console.log('Extracting assets from page...');
    
    // Extract assets from the page
    const result = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      function: extractPageAssets
    });
    
    const assets = result[0].result;
    console.log('Found assets:', assets);
    
    // Download the main HTML page
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
  } catch (error) {
    console.error('Error downloading page with assets:', error);
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
  
  return assets;
}