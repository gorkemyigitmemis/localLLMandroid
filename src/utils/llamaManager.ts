import { initLlama, LlamaContext } from 'llama.rn';
import RNFS from 'react-native-fs';

let globalLlamaContext: LlamaContext | null = null;
let isInitializing = false;

export const loadGlobalModel = async (modelPath?: string): Promise<LlamaContext | null> => {
  if (globalLlamaContext) return globalLlamaContext;
  if (isInitializing) return null; // Prevent concurrent multiple initializations

  isInitializing = true;
  try {
    let pathToLoad = modelPath;
    
    if (!pathToLoad) {
      // Check Document Directory for existing gguf
      const files = await RNFS.readDir(RNFS.DocumentDirectoryPath);
      const ggufFile = files.find(f => f.name.endsWith('.gguf'));
      if (ggufFile) {
        pathToLoad = ggufFile.path;
      }
    }

    if (pathToLoad) {
      globalLlamaContext = await initLlama({
        model: pathToLoad,
        use_mlock: true, // Keep in RAM
        n_ctx: 4096,     // Doubled context length to eliminate context overflow crashes
        n_gpu_layers: 1, // Enable Metal / GPU
      });
      return globalLlamaContext;
    }
    
    return null;
  } catch (error) {
    console.error("Global LLM Yükleme Hatası:", error);
    return null;
  } finally {
    isInitializing = false;
  }
};

export const getGlobalLlamaContext = (): LlamaContext | null => {
  return globalLlamaContext;
};

export const releaseGlobalModel = async () => {
  if (globalLlamaContext) {
    await globalLlamaContext.release();
    globalLlamaContext = null;
  }
};
