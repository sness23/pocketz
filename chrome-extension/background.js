chrome.commands.onCommand.addListener(async (command) => {
  if (command === "send-url") {
    console.log('Keyboard shortcut triggered:', command);
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        console.log('Sending URL:', tab.url);
        await sendUrlToServer(tab.url);
        await downloadPage(tab.url, tab.title);
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

async function downloadPage(url, title) {
  try {
    const sanitizedTitle = title.replace(/[^a-z0-9]/gi, '_').substring(0, 50);
    const filename = `${sanitizedTitle}.html`;
    
    console.log('Downloading page:', filename);
    
    await chrome.downloads.download({
      url: url,
      filename: filename,
      saveAs: false
    });
    
    console.log('Page download initiated');
  } catch (error) {
    console.error('Error downloading page:', error);
  }
}