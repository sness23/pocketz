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
const INDEX_FILE = '/home/sness/data/vaults/pocketz/index.md';

app.use(cors());
app.use(express.json({ limit: '50mb' }));

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
        const movedPDFs = await moveDownloadedFiles(directoryName);
        await updateObsidianIndex(url, directoryName, movedPDFs);
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

app.post('/save-text', async (req, res) => {
  try {
    const { title, content, url, directoryName } = req.body;
    const apiKey = req.headers['x-api-key'];
    
    if (!apiKey || apiKey !== API_KEY) {
      return res.status(401).json({ error: 'Invalid or missing API key' });
    }
    
    if (!content || !directoryName) {
      return res.status(400).json({ error: 'Content and directory name are required' });
    }

    const targetDir = path.join(VAULT_DIR, directoryName);
    const indexFile = path.join(targetDir, `${directoryName}.md`);
    
    // Ensure directory exists
    await fs.mkdir(targetDir, { recursive: true });
    
    // Create markdown content
    const markdownContent = `# ${title || 'Saved Page'}\n\n**URL:** ${url}\n\n**Saved:** ${new Date().toISOString()}\n\n---\n\n${content}`;
    
    // Write the descriptively named markdown file
    await fs.writeFile(indexFile, markdownContent);
    
    console.log(`Page text saved to: ${indexFile}`);
    res.json({ success: true, message: 'Page text saved successfully' });
  } catch (error) {
    console.error('Error saving page text:', error);
    res.status(500).json({ error: 'Failed to save page text' });
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
    const movedPDFs = await movePDFsToPapersFolder(sourcePath, directoryName);
    
    // Then move the main directory
    await execAsync(`mv "${sourcePath}" "${targetPath}"`);
    
    console.log(`Moved ${sourcePath} -> ${targetPath}`);
    return movedPDFs;
  } catch (error) {
    console.error(`Failed to move ${sourcePath}:`, error.message);
    throw error;
  }
}

async function movePDFsToPapersFolder(sourcePath, directoryName) {
  const movedPDFs = [];
  
  try {
    // Find all PDF files in the source directory and subdirectories
    const { stdout } = await execAsync(`find "${sourcePath}" -name "*.pdf" -type f`);
    
    if (stdout.trim()) {
      const pdfFiles = stdout.trim().split('\n');
      
      for (const pdfFile of pdfFiles) {
        const fileName = path.basename(pdfFile);
        const targetFileName = `${directoryName}_${fileName}`;
        const targetPdfPath = path.join(PAPERS_DIR, targetFileName);
        
        // Move PDF to papers folder with directory prefix to avoid conflicts
        await execAsync(`mv "${pdfFile}" "${targetPdfPath}"`);
        console.log(`Moved PDF: ${fileName} -> papers/${targetFileName}`);
        
        movedPDFs.push(targetFileName);
      }
    }
  } catch (error) {
    // If no PDFs found or other error, just log it but don't fail
    console.log('No PDFs found or error moving PDFs:', error.message);
  }
  
  return movedPDFs;
}

async function updateObsidianIndex(url, directoryName, movedPDFs) {
  try {
    const timestamp = new Date().toISOString();
    const date = timestamp.split('T')[0];
    
    // Extract title from URL for better readability
    const urlParts = url.split('/');
    const articleId = urlParts[urlParts.length - 1] || 'unknown';
    
    let indexEntry = `\n## ${date} - ${articleId}\n\n`;
    indexEntry += `**URL:** ${url}\n\n`;
    indexEntry += `**Assets:** [[${directoryName}/${directoryName}]]\n\n`;
    indexEntry += `---\n`;
    
    // Append to index file, create if it doesn't exist
    try {
      await fs.access(INDEX_FILE);
    } catch (error) {
      if (error.code === 'ENOENT') {
        const header = '# Pocketz Archive Index\n\nThis file contains links to all saved articles and papers.\n\n';
        await fs.writeFile(INDEX_FILE, header);
      }
    }
    
    await fs.appendFile(INDEX_FILE, indexEntry);
    console.log(`Updated Obsidian index with entry for ${articleId}`);
  } catch (error) {
    console.error('Error updating Obsidian index:', error);
  }
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});