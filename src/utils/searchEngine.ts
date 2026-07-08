import * as cheerio from 'cheerio';

export const performWebSearch = async (query: string): Promise<string> => {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    
    // Some headers to mimic a normal browser and avoid instant blocks
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
    };

    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      throw new Error(`Search request failed with status: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    
    const results: string[] = [];
    
    // Extract snippets from DuckDuckGo HTML results
    $('.result__snippet').each((index, element) => {
      if (index < 3) { // Only take top 3 results to save context window
        results.push($(element).text().trim());
      }
    });

    if (results.length === 0) {
      return "İnternet aramasında belirgin bir sonuç bulunamadı.";
    }

    // Combine results into a readable context
    return results.map((r, i) => `[Kaynak ${i + 1}]: ${r}`).join('\n');
    
  } catch (error) {
    console.error("Web Search Error:", error);
    return "Arama motoruna bağlanılamadı.";
  }
};
