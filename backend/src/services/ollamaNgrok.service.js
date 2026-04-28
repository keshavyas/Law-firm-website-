import axios from 'axios';
import { AppError } from '../utils/errors.js';

function resolveNgrokGenerateUrl() {
  let base = (process.env.NGROK_URL || '').trim();
  if (!base) return null;
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

export async function generateSummaryViaNgrok({ model = 'phi', prompt, timeoutMs = 45000 }) {
  const url = resolveNgrokGenerateUrl();
  if (!url) {
    throw new AppError('NGROK_URL is not configured', 500, 'CONFIG_ERROR');
  }
  if (!prompt || !prompt.trim()) {
    throw new AppError('Prompt is required', 500, 'INTERNAL_ERROR');
  }

  try {
    const res = await axios.post(
      url,
      { model, prompt, stream: false },
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

