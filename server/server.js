const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

const app = express();
const PORT = 3000;
const API_KEY = 'pocketz-api-key-2024';
const DOWNLOADS_DIR = '/home/sness/down';
const VAULT_DIR = '/home/sness/data/vaults/pocketz';
const PAPERS_DIR = '/home/sness/data/vaults/pocketz/papers';

app.use(cors());
app.use(express.json());

app.post('/save-url', async (req, res) => {
  try {
    const { url, directoryName } = req.body;
    const apiKey = req.headers['x-api-key'];
    
    if (!apiKey || apiKey !== API_KEY) {
      return res.status(401).json({ error: 'Invalid or missing API key' });
    }
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    const timestamp = new Date().toISOString();
    const markdownEntry = directoryName 
      ? `- [${timestamp}] ${url} (saved to: ${directoryName})\n`
      : `- [${timestamp}] ${url}\n`;
    
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
    
    console.log(`URL saved: ${url}${directoryName ? ` (directory: ${directoryName})` : ''}`);
    
    // Move the downloaded directory if it exists
    if (directoryName) {
      try {
        await moveDownloadedFiles(directoryName);
        console.log(`Files moved to vault: ${directoryName}`);
      } catch (moveError) {
        console.error('Error moving files:', moveError);
        // Don't fail the whole request if file move fails
      }
    }
    
    res.json({ success: true, message: 'URL saved successfully' });
  } catch (error) {
    console.error('Error saving URL:', error);
    res.status(500).json({ error: 'Failed to save URL' });
  }
});

async function moveDownloadedFiles(directoryName) {
  const sourcePath = path.join(DOWNLOADS_DIR, directoryName);
  const targetPath = path.join(VAULT_DIR, directoryName);
  
  try {
    // Check if source directory exists
    await fs.access(sourcePath);
    
    // Ensure vault and papers directories exist
    await fs.mkdir(VAULT_DIR, { recursive: true });
    await fs.mkdir(PAPERS_DIR, { recursive: true });
    
    // First, find and move any PDF files to papers directory
    await movePDFsToPapersFolder(sourcePath, directoryName);
    
    // Then move the main directory
    await execAsync(`mv "${sourcePath}" "${targetPath}"`);
    
    console.log(`Moved ${sourcePath} -> ${targetPath}`);
  } catch (error) {
    console.error(`Failed to move ${sourcePath}:`, error.message);
    throw error;
  }
}

async function movePDFsToPapersFolder(sourcePath, directoryName) {
  try {
    // Find all PDF files in the source directory and subdirectories
    const { stdout } = await execAsync(`find "${sourcePath}" -name "*.pdf" -type f`);
    
    if (stdout.trim()) {
      const pdfFiles = stdout.trim().split('\n');
      
      for (const pdfFile of pdfFiles) {
        const fileName = path.basename(pdfFile);
        const targetPdfPath = path.join(PAPERS_DIR, `${directoryName}_${fileName}`);
        
        // Move PDF to papers folder with directory prefix to avoid conflicts
        await execAsync(`mv "${pdfFile}" "${targetPdfPath}"`);
        console.log(`Moved PDF: ${fileName} -> papers/${directoryName}_${fileName}`);
      }
    }
  } catch (error) {
    // If no PDFs found or other error, just log it but don't fail
    console.log('No PDFs found or error moving PDFs:', error.message);
  }
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});