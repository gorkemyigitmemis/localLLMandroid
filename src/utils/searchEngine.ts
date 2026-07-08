export const performWebSearch = async (query: string): Promise<string> => {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    
    // Some headers to mimic a normal browser
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
    };

    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      throw new Error(`Search request failed with status: ${response.status}`);
    }

    const html = await response.text();
    
    const results: string[] = [];
    
    // Regex to match DuckDuckGo Lite snippets (result-snippet or result__snippet)
    const snippetRegex = /class=["']result[-_]*snippet["'][^>]*>([\s\S]*?)<\/(?:td|div|span|a)>/gi;
    let match;
    let count = 0;

    while ((match = snippetRegex.exec(html)) !== null && count < 3) {
      // Strip inner HTML tags to get pure text
      let pureText = match[1].replace(/<[^>]*>?/gm, '').trim();
      // Decode common HTML entities
      pureText = pureText.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
      if (pureText.length > 10) {
        results.push(pureText);
        count++;
      }
    }

    if (results.length === 0) {
      return "İnternet aramasında belirgin bir sonuç bulunamadı.";
    }

    return results.map((r, i) => `[Kaynak ${i + 1}]: ${r}`).join('\n');
    
  } catch (error) {
    console.error("Web Search Error:", error);
    return "Arama motoruna bağlanılamadı.";
  }
};
