import * as cheerio from 'cheerio';

/**
 * Scrapes a website and extracts its raw text content.
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

    const html = await response.text();
    const $ = cheerio.load(html);

    // Remove unwanted elements
    $('script, style, noscript, iframe, img, svg, nav, footer, header').remove();

    // Extract text from paragraphs and headings
    let extractedText = '';
    $('h1, h2, h3, p, li').each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > 20) {
        extractedText += text + '\n\n';
      }
    });

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
