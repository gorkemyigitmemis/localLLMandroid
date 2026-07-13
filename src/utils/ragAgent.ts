/**
 * Scrapes a website and extracts its raw text content without Node.js dependencies.
 */
export async function scrapeWebsite(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }

    let html = await response.text();
    
    // 1. Remove scripts, styles, and SVG tags completely
    html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ');
    html = html.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ');
    html = html.replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, ' ');
    html = html.replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, ' ');
    html = html.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, ' ');
    
    // 2. Strip all remaining HTML tags
    let extractedText = html.replace(/<[^>]+>/g, ' ');
    
    // 3. Decode common HTML entities
    extractedText = extractedText
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'");

    // 4. Clean up whitespace (remove excessive newlines and spaces)
    extractedText = extractedText.replace(/\s{3,}/g, '\n\n').trim();

    return extractedText;
  } catch (error) {
    console.error("Scraping error:", error);
    return "Error: Could not read the website.";
  }
}

/**
 * Basic tokenizer for JS text search
 */
function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^\w\sğüşöçiı]/g, '').split(/\s+/).filter(w => w.length > 2);
}

/**
 * Zero-RAM RAG (Retrieval-Augmented Generation)
 * Uses a lightweight Term Frequency (TF) approach to find the most relevant chunks.
 */
export function chunkAndRetrieve(text: string, query: string, topK: number = 3): string {
  // 1. Chunking: Split by double newlines or large paragraphs
  let chunks = text.split('\n\n').map(c => c.trim()).filter(c => c.length > 50);
  
  // If chunks are too small, group them into larger ~500 character blocks
  const groupedChunks: string[] = [];
  let currentChunk = '';
  for (const c of chunks) {
    if (currentChunk.length + c.length > 800) {
      groupedChunks.push(currentChunk);
      currentChunk = c;
    } else {
      currentChunk += (currentChunk ? ' ' : '') + c;
    }
  }
  if (currentChunk) groupedChunks.push(currentChunk);

  chunks = groupedChunks;

  // 2. Query tokenization
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return chunks.slice(0, topK).join('\n\n'); // Fallback

  // 3. Scoring (Basic TF-IDF proxy)
  const scoredChunks = chunks.map(chunk => {
    const chunkTokens = tokenize(chunk);
    let score = 0;
    
    queryTokens.forEach(qToken => {
      // Exact match bonus
      if (chunkTokens.includes(qToken)) score += 3;
      
      // Partial match (substring)
      const partialMatches = chunkTokens.filter(cToken => cToken.includes(qToken) || qToken.includes(cToken));
      score += partialMatches.length * 1;
    });

    return { chunk, score };
  });

  // 4. Sort and retrieve
  scoredChunks.sort((a, b) => b.score - a.score);
  
  // Return the topK chunks that have at least some relevance, or the very beginning if no score
  const bestChunks = scoredChunks.filter(c => c.score > 0).slice(0, topK);
  
  if (bestChunks.length === 0) {
    return chunks.slice(0, topK).join('\n\n'); // Return first chunks if nothing specifically matched
  }

  return bestChunks.map(c => c.chunk).join('\n\n');
}
