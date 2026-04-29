import axios from 'axios';
import { AppError } from '../utils/errors.js';

function resolveNgrokGenerateUrl() {
  let base = (process.env.OLLAMA_URL || process.env.NGROK_URL || 'http://localhost:11434').trim();
  if (base.endsWith('/')) base = base.slice(0, -1);
  if (!base.endsWith('/api/generate')) base += '/api/generate';
  return base;
}

function toOllamaError(err) {
  // Axios errors: https://axios-http.com/docs/handling_errors
  if (err?.code === 'ECONNABORTED') {
    return new AppError('Ollama request timed out', 504, 'OLLAMA_TIMEOUT');
  }
  if (err?.response) {
    const status = err.response.status || 502;
    const body =
      typeof err.response.data === 'string'
        ? err.response.data
        : JSON.stringify(err.response.data || {});
    return new AppError(`Ollama returned ${status}: ${body.slice(0, 300)}`, 502, 'OLLAMA_BAD_RESPONSE');
  }
  return new AppError(`Ollama unreachable: ${err?.message || 'unknown error'}`, 503, 'OLLAMA_UNAVAILABLE');
}

const DEFAULT_OLLAMA_TIMEOUT_MS = Number.parseInt(process.env.OLLAMA_CALL_TIMEOUT_MS || '90000', 10);
const DEFAULT_NUM_PREDICT = Number.parseInt(process.env.OLLAMA_NUM_PREDICT || '420', 10);

export async function generateSummaryViaNgrok({ model = process.env.AI_MODEL || 'phi', prompt, timeoutMs = DEFAULT_OLLAMA_TIMEOUT_MS }) {
  const url = resolveNgrokGenerateUrl();
  if (!prompt || !prompt.trim()) {
    throw new AppError('Prompt is required', 500, 'INTERNAL_ERROR');
  }

  try {
    const res = await axios.post(
      url,
      {
        model,
        prompt,
        stream: false,
        options: {
          num_predict: DEFAULT_NUM_PREDICT,
          temperature: 0.2,
          top_p: 0.9,
        },
      },
      {
        timeout: timeoutMs,
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        validateStatus: () => true,
      }
    );

    if (res.status < 200 || res.status >= 300) {
      const body = typeof res.data === 'string' ? res.data : JSON.stringify(res.data || {});
      throw new AppError(`Ollama returned ${res.status}: ${body.slice(0, 300)}`, 502, 'OLLAMA_BAD_RESPONSE');
    }

    const responseText = (res.data?.response || '').trim();
    if (!responseText) throw new AppError('Ollama returned an empty response', 502, 'OLLAMA_EMPTY_RESPONSE');
    return responseText;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw toOllamaError(err);
  }
}

