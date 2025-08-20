# Pocketz Output Directory Naming Specification

## Current Implementation Analysis

**Current Format**: `pocketz_<nanosecond_timestamp>`
- Example: `pocketz_1755568277459700000`
- Generated using: `Date.now() * 1000000 + (performance.now() % 1) * 1000000`

### Issues with Current Naming
1. **No Context**: Directory names provide no information about content
2. **Not Human Readable**: Nanosecond timestamps are meaningless to users
3. **No Source Information**: Cannot identify the source website or domain
4. **No Content Type**: Cannot distinguish between different types of content
5. **Sorting Issues**: Timestamps don't sort chronologically as strings in some file managers

## Proposed Naming Schemes

### Option 1: Date + Time + Domain + Article ID (Recommended)
**Format**: `YYYY-MM-DD_HHMMSS_<domain>_<article_id>`

**Examples**:
- `2025-08-19_143027_nature_s41467-025-62755-1`
- `2025-08-19_143512_arxiv_2408.12345v1`
- `2025-08-19_144003_github_microsoft_typescript`
- `2025-08-19_144158_youtube_dQw4w9WgXcQ`

**Advantages**:
- Human readable date and time sorting
- Allows multiple downloads of same content (like Google Drive versioning)
- Clear source identification
- Article/content identification
- Precise audit trail of when content was captured
- Reasonable length (~50-60 chars)
- Works across different domains

### Option 2: Enhanced with Title Snippet
**Format**: `YYYY-MM-DD_HHMMSS_<domain>_<title_snippet>_<short_hash>`

**Examples**:
- `2025-08-19_143027_nature_viral_proteins_suppress_rice_a1b2c3d4`
- `2025-08-19_143512_arxiv_deep_learning_transformers_e5f6g7h8`

**Advantages**:
- Includes content context from title
- Hash prevents duplicates
- Still sortable by date

### Option 3: Alternative Timestamp Format
**Format**: `<YYYYMMDD-HHMMSS>_<domain>_<article_id>`

**Examples**:
- `20250819-143027_nature_s41467-025-62755-1`
- `20250819-143512_arxiv_2408.12345v1`

**Advantages**:
- Precise timing information
- Source and content identification
- Backward compatible timestamp format

### Option 4: UUID with Metadata
**Format**: `<domain>_<article_id>_<uuid8>`

**Examples**:
- `nature_s41467-025-62755-1_a1b2c3d4`
- `arxiv_2408.12345v1_e5f6g7h8`

**Advantages**:
- Content-first naming
- Guaranteed uniqueness
- Domain-centric organization

## Versioning Benefits

The inclusion of precise timestamps (HHMMSS) enables powerful versioning capabilities:

**Use Cases**:
- **Article Updates**: Track changes when papers are updated or corrected
- **Dynamic Content**: Capture evolving web content at different times
- **Comparative Analysis**: Compare different versions of the same content
- **Audit Trail**: Maintain complete history of when content was captured
- **Error Recovery**: Re-download if initial capture was incomplete

**Example Timeline**:
```
2025-08-19_143027_nature_s41467-025-62755-1/  # Initial download
2025-08-19_151430_nature_s41467-025-62755-1/  # Updated with corrections
2025-08-20_092145_nature_s41467-025-62755-1/  # Downloaded again for comparison
```

## Implementation Recommendations

### Primary Recommendation: Option 1
Use the date + time + domain + article format as it provides the best balance of:
- Human readability
- Chronological organization
- Source identification
- Content identification
- File system compatibility

### Extraction Strategy

**URL Pattern Matching**:
```javascript
const extractors = {
  // Academic journals
  nature: (url) => url.match(/articles\/([^/?]+)/)?.[1],
  arxiv: (url) => url.match(/abs\/(\d+\.\d+v?\d*)/)?.[1],
  pubmed: (url) => url.match(/articles\/PMC(\d+)/)?.[1] || url.match(/\/(\d+)\/?$/)?.[1],
  
  // Code repositories
  github: (url) => {
    const match = url.match(/github\.com\/([^/]+)\/([^/?#]+)/);
    return match ? `${match[1]}_${match[2]}` : null;
  },
  
  // Media platforms
  youtube: (url) => url.match(/watch\?v=([^&]+)/)?.[1] || url.match(/youtu\.be\/([^/?]+)/)?.[1],
  
  // Fallback: use path or title
  default: (url, title) => {
    const pathParts = new URL(url).pathname.split('/').filter(Boolean);
    const slug = pathParts[pathParts.length - 1] || 
                 title?.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 30) ||
                 'page';
    return slug;
  }
};
```

**Domain Mapping**:
```javascript
const domainMap = {
  'nature.com': 'nature',
  'arxiv.org': 'arxiv',
  'pubmed.ncbi.nlm.nih.gov': 'pubmed',
  'github.com': 'github',
  'youtube.com': 'youtube',
  'youtu.be': 'youtube',
  // Add more mappings as needed
};
```

### Fallback Strategy
1. Try to extract article ID using domain-specific patterns
2. If no ID found, use sanitized title (first 30 chars)
3. If no title, use last path segment
4. If all else fails, use timestamp as current implementation

### File System Considerations
- Replace invalid characters with underscores: `[^a-zA-Z0-9._-]` → `_`
- Limit total length to 100 characters for file system compatibility
- Avoid reserved names and ensure uniqueness with collision detection

### Migration Strategy
- Keep current timestamp-based system as fallback
- Add new naming scheme as opt-in feature initially
- Gradually migrate as patterns are refined
- Maintain backward compatibility with existing directories

## Implementation Changes Required

### Chrome Extension (`background.js`)
- Add domain detection logic
- Add article ID extraction patterns
- Add title sanitization
- Implement fallback chain

### Server (`server.js`)
- Update directory handling for new naming scheme
- Maintain compatibility with existing timestamps
- Update Obsidian index generation

### Configuration
- Make naming scheme configurable
- Allow custom domain patterns
- Enable/disable features per domain

## Testing Strategy
- Test with various URL patterns from different sources
- Verify file system compatibility across platforms
- Ensure uniqueness in high-volume scenarios
- Validate backward compatibility with existing directories