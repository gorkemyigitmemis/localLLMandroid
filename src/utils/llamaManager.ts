import { initLlama, LlamaContext } from 'llama.rn';
import RNFS from 'react-native-fs';
import { Platform } from 'react-native';

let globalLlamaContext: LlamaContext | null = null;
let isInitializing = false;

export const loadGlobalModel = async (modelPath?: string): Promise<LlamaContext | null> => {
  if (globalLlamaContext) return globalLlamaContext;
  if (isInitializing) return null; // Prevent concurrent multiple initializations

  isInitializing = true;
  try {
    let pathToLoad = modelPath;
    
    if (!pathToLoad) {
      const destPath = `${RNFS.DocumentDirectoryPath}/gemma-2-2b-it-Q4_K_M.gguf`;
      
      // Check Document Directory for existing gguf
      const exists = await RNFS.exists(destPath);
      
      if (!exists && Platform.OS === 'android') {
        console.log("Model not found in internal storage. Extracting from Android assets...");
        try {
          await RNFS.copyFileAssets('models/gemma-2-2b-it-Q4_K_M.gguf', destPath);
          console.log("Model extraction successful.");
          pathToLoad = destPath;
        } catch (e) {
          console.error("Failed to copy model from assets:", e);
        }
      } else if (exists) {
        pathToLoad = destPath;
      } else {
        // Fallback for iOS or if exact name not found: look for any .gguf
        const files = await RNFS.readDir(RNFS.DocumentDirectoryPath);
        const ggufFile = files.find(f => f.name.endsWith('.gguf'));
        if (ggufFile) {
          pathToLoad = ggufFile.path;
        }
      }
    }

    if (pathToLoad) {
      globalLlamaContext = await initLlama({
        model: pathToLoad,
        use_mlock: Platform.OS === 'ios', // Only use mlock on iOS to prevent Android permission crashes
        n_ctx: 2048,     // Reduced context to save RAM on Android emulators
        n_gpu_layers: Platform.OS === 'ios' ? 1 : 0, // Disable GPU on Android to prevent Vulkan/OpenCL crashes
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
