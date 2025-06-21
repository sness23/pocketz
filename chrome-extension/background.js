chrome.commands.onCommand.addListener(async (command) => {
  if (command === "send-url") {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        await sendUrlToServer(tab.url);
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