export const performWebSearch = async (query: string): Promise<string> => {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0'
    ];
    const randomUA = userAgents[Math.floor(Math.random() * userAgents.length)];

    // Some headers to mimic a normal browser
    const headers = {
      'User-Agent': randomUA,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1'
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(url, { headers, signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`Search request failed with status: ${response.status}`);
    }

    const html = await response.text();
    
    const results: string[] = [];
    
    // Regex to match DuckDuckGo Lite snippets and their href
    const snippetRegex = /<a[^>]*class=["']result[-_]*snippet["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    let count = 0;

    while ((match = snippetRegex.exec(html)) !== null && count < 3) {
      let url = match[1];
      // Decode duckduckgo redirect URL
      const uddgMatch = url.match(/uddg=([^&]+)/);
      if (uddgMatch) {
        url = decodeURIComponent(uddgMatch[1]);
      } else if (url.startsWith('//')) {
        url = 'https:' + url;
      } else if (url.startsWith('/')) {
        url = 'https://duckduckgo.com' + url;
      }

      // Strip inner HTML tags to get pure text
      let pureText = match[2].replace(/<[^>]*>?/gm, '').trim();
      pureText = pureText.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
      
      if (pureText.length > 10) {
        results.push(`[Kaynak ${count + 1}] (${url}): ${pureText}`);
        count++;
      }
    }

    if (results.length === 0) {
      if (query.includes('site:')) {
        // Fallback: Remove all 'site:xxx.com' constraints and search the whole web
        const fallbackQuery = query.replace(/site:\S+/g, '').replace(/\s+OR\s+/g, ' ').trim();
        console.log(`Fallback search triggered for: ${fallbackQuery}`);
        return await performWebSearch(fallbackQuery);
      }
      return "İnternet aramasında belirgin bir sonuç bulunamadı.";
    }

    return results.join('\n');
    
  } catch (error) {
    console.error("Web Search Error:", error);
    return "Arama motoruna bağlanılamadı.";
  }
};
