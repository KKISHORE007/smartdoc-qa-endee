import { pipeline, env, TextStreamer } from '@huggingface/transformers';

// Configuration for Transformers.js
env.allowLocalModels = false;
env.useBrowserCache = true;

let generator = null;

const MODEL_ID = 'onnx-community/Llama-3.2-1B-Instruct-q4f16';

/**
 * Check if the model files already exist in browser Cache Storage.
 * Transformers.js stores downloaded models in Cache API under origin.
 */
async function checkCacheForModel() {
  try {
    const cacheNames = await caches.keys();
    // Transformers.js uses cache names like 'transformers-cache'
    for (const name of cacheNames) {
      const cache = await caches.open(name);
      const keys = await cache.keys();
      // Look for model-specific files (ONNX weights, config, tokenizer)
      const modelFiles = keys.filter(req =>
        req.url.includes('Llama-3.2-1B-Instruct') ||
        req.url.includes('onnx-community')
      );
      if (modelFiles.length >= 3) {
        // Model config + tokenizer + at least one weight file = cached
        return {
          cached: true,
          fileCount: modelFiles.length,
          cacheName: name,
        };
      }
    }
    return { cached: false, fileCount: 0 };
  } catch (err) {
    console.warn('Cache check failed:', err);
    return { cached: false, fileCount: 0, error: err.message };
  }
}

/**
 * Load the model into memory (either from cache or by downloading).
 */
async function loadModel(isVerify = false) {
  if (generator) {
    self.postMessage({ status: 'ready', message: 'Second Brain is Online', fromCache: true });
    return;
  }

  try {
    self.postMessage({
      status: 'init',
      message: isVerify ? 'Verifying cached model...' : 'Connecting to Hugging Face Hub...',
    });

    generator = await pipeline('text-generation', MODEL_ID, {
      device: 'webgpu',
      progress_callback: (info) => {
        if (info.status === 'progress' || info.status === 'done') {
          self.postMessage({
            status: 'progress',
            progress: info.progress || 0,
            file: info.file || 'weights.onnx',
            loaded: info.loaded,
            total: info.total,
          });
        }
      },
    });

    self.postMessage({
      status: 'ready',
      message: 'Second Brain is Online (Offline Mode Enabled)',
      fromCache: false,
    });
  } catch (error) {
    console.warn('WebGPU fallback logic triggered:', error.message);
    try {
      generator = await pipeline('text-generation', MODEL_ID, {
        progress_callback: (info) => {
          if (info.status === 'progress') {
            self.postMessage({
              status: 'progress',
              progress: info.progress,
              file: info.file,
            });
          }
        },
      });
      self.postMessage({
        status: 'ready',
        message: 'Second Brain is Online (CPU Mode)',
        fromCache: false,
      });
    } catch (fallbackError) {
      self.postMessage({
        status: 'load-error',
        message: 'Failed to load model: ' + fallbackError.message,
      });
    }
  }
}

/**
 * Message handler — supports: check, load, verify, query
 */
self.onmessage = async (event) => {
  const { type, data } = event.data;

  // ── CHECK: Probe Cache API for existing model files ──
  if (type === 'check') {
    const result = await checkCacheForModel();
    self.postMessage({
      status: 'cache-check',
      cached: result.cached,
      fileCount: result.fileCount,
      cacheName: result.cacheName || null,
    });
    return;
  }

  // ── LOAD: Download + initialize model ──
  if (type === 'load') {
    await loadModel(false);
    return;
  }

  // ── VERIFY: Try to load from cache to confirm it works ──
  if (type === 'verify') {
    self.postMessage({ status: 'verifying', message: 'Verifying local model...' });
    await loadModel(true);
    return;
  }

  // ── QUERY: Run inference ──
  if (type === 'query') {
    if (!generator) {
      self.postMessage({ status: 'error', message: 'Model not loaded.' });
      return;
    }

    const { documentText, question, chatHistory } = data;

    if (!documentText || documentText.trim() === '') {
      self.postMessage({ status: 'complete', answer: 'SYSTEM NOTIFICATION: No document text was detected for this file. If you loaded this from an older history session, the text wasn\'t saved. Please upload or read the document again to populate the offline context.' });
      return;
    }

    // Custom System Prompt for Intelligent, Grounded results
    const messages = [
      {
        role: 'system',
        content: `You are SmartDoc AI. You analyze the following DOCUMENT CONTEXT to answer the user's input.

DOCUMENT CONTEXT:
${documentText.substring(0, 10000)}

INSTRUCTIONS:
1. If the user provides a keyword or a name, tell them everything the document says about it.
2. If the user asks a question, answer it clearly based ONLY on the document.
3. If the document does not contain the answer or the keyword, state that clearly without making up facts.`
      },
      ...chatHistory.slice(-3), // Last 3 message turns for context
      { role: 'user', content: question }
    ];

    try {
      self.postMessage({ status: 'thinking' });
      self.postMessage({ status: 'stream-start' });

      let streamedAnswer = '';
      const streamer = new TextStreamer(generator.tokenizer, {
        skip_prompt: true,
        skip_special_tokens: true,
        callback_function: (text) => {
          streamedAnswer += text;
          self.postMessage({ status: 'stream', text: streamedAnswer });
        }
      });

      const output = await generator(messages, {
        max_new_tokens: 1024,
        temperature: 0.1,
        do_sample: false, // Greedy decoding so it stops hallucinating outside knowledge
        streamer,
        return_full_text: false,
      });

      let answer = output[0].generated_text;
      if (Array.isArray(answer)) {
        answer = answer[answer.length - 1]?.content || JSON.stringify(answer);
      } else if (answer && typeof answer === 'object') {
        answer = answer.content || JSON.stringify(answer);
      }
      
      self.postMessage({ status: 'complete', answer });
    } catch (error) {
      self.postMessage({ status: 'error', message: 'Inference failed: ' + error.message });
    }
  }
};
