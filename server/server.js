const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

app.post('/save-url', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    const timestamp = new Date().toISOString();
    const markdownEntry = `- [${timestamp}] ${url}\n`;
    
    const filePath = path.join(__dirname, 'urls.md');
    
    try {
      await fs.access(filePath);
      await fs.appendFile(filePath, markdownEntry);
    } catch (error) {
      if (error.code === 'ENOENT') {
        const header = '# Saved URLs\n\n';
        await fs.writeFile(filePath, header + markdownEntry);
      } else {
        throw error;
      }
    }
    
    console.log(`URL saved: ${url}`);
    res.json({ success: true, message: 'URL saved successfully' });
  } catch (error) {
    console.error('Error saving URL:', error);
    res.status(500).json({ error: 'Failed to save URL' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});