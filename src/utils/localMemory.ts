import RNFS from 'react-native-fs';

const MEMORY_DIR = `${RNFS.DocumentDirectoryPath}/local_memory`;

/**
 * Initializes the memory directory
 */
const initMemory = async () => {
  const exists = await RNFS.exists(MEMORY_DIR);
  if (!exists) {
    await RNFS.mkdir(MEMORY_DIR);
  }
};

/**
 * Saves a chunk of text to the local SSD memory, indexed by URL or topic.
 * Uses zero RAM to persist.
 */
export const saveToMemory = async (key: string, content: string): Promise<void> => {
  try {
    await initMemory();
    // Create a safe filename from the key (e.g. URL)
    const safeKey = key.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const filePath = `${MEMORY_DIR}/${safeKey}.txt`;
    await RNFS.writeFile(filePath, content, 'utf8');
  } catch (e) {
    console.error("Memory save error:", e);
  }
};

/**
 * Basic tokenizer for memory matching
 */
function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^\w\sğüşöçiı]/g, '').split(/\s+/).filter(w => w.length > 2);
}

/**
 * Searches all files in local memory for relevant chunks using SSD directly.
 * Reads sequentially, keeping RAM usage near zero.
 */
export const searchMemory = async (query: string): Promise<string> => {
  try {
    await initMemory();
    const files = await RNFS.readDir(MEMORY_DIR);
    if (files.length === 0) return "Hafızada hiçbir veri bulunamadı.";

    const queryTokens = tokenize(query);
    let bestMatch = "";
    let highestScore = 0;

    for (const file of files) {
      if (file.isFile() && file.name.endsWith('.txt')) {
        const content = await RNFS.readFile(file.path, 'utf8');
        
        // Simple TF scoring per file chunk
        const chunkTokens = tokenize(content);
        let score = 0;
        
        queryTokens.forEach(qToken => {
          if (chunkTokens.includes(qToken)) score += 3;
          const partialMatches = chunkTokens.filter(cToken => cToken.includes(qToken) || qToken.includes(cToken));
          score += partialMatches.length * 1;
        });

        if (score > highestScore) {
          highestScore = score;
          // Return a 1000 character snippet around the best match or just the start
          bestMatch = content.substring(0, 1000); 
        }
      }
    }

    if (highestScore > 0) {
      return bestMatch + "... (Yerel disk hafızasından alındı)";
    }
    return "Hafızada bu konuyla ilgili bir bilgi bulunamadı.";
  } catch (e) {
    console.error("Memory search error:", e);
    return "Hafıza tarama hatası.";
  }
};
