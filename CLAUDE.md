# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Pocketz is a URL capturing system consisting of two main components:

1. **Chrome Extension** (`chrome-extension/`): Captures URLs from browser tabs using keyboard shortcut (Ctrl+Shift+O)
2. **Node.js Server** (`server/`): Receives and stores URLs in a markdown file

The extension sends URLs to `https://pocketz.doi.bio/save-url` with API key authentication. URLs are stored in `server/urls.md` with timestamps.

## Architecture

- **Chrome Extension**: Manifest V3 extension with background service worker handling keyboard commands
- **Express Server**: Simple REST API with CORS support that appends URLs to a markdown file
- **Authentication**: Uses hardcoded API key `pocketz-api-key-2024` in headers
- **Storage**: URLs stored in `server/urls.md` as timestamped markdown list

## Development Commands

### Server Development
```bash
cd server
npm install           # Install dependencies
npm start            # Start production server (port 3000)
npm run dev          # Start development server with nodemon
```

### Chrome Extension
- Load `chrome-extension/` directory as unpacked extension in Chrome
- No build process required - files are used directly

## Key Files

- `chrome-extension/background.js`: Handles keyboard commands and API requests
- `chrome-extension/manifest.json`: Extension configuration and permissions
- `server/server.js`: Express server with single `/save-url` endpoint
- `server/urls.md`: URL storage file (auto-created)

## API

**POST** `/save-url`
- Headers: `X-API-Key: pocketz-api-key-2024`
- Body: `{ "url": "https://example.com" }`
- Response: `{ "success": true, "message": "URL saved successfully" }`