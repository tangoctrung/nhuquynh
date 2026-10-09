import {
  AI_VOICES,
  DEFAULT_TTS_MODEL,
  GEMINI_TTS_MODELS,
  MAX_SPEECH_CHARS,
  READING_LANGUAGE,
  getSpeechInstructions,
  type GeminiTtsModel,
} from "@/lib/audio/speech";

export const runtime = "nodejs";
export const maxDuration = 60;

type GeminiResponse = {
  steps?: Array<{
    type?: string;
    content?: Array<{ type?: string; data?: string; mime_type?: string }>;
  }>;
};

function getConfiguration() {
  return {
    apiKey: process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim(),
    model: process.env.GEMINI_TTS_MODEL?.trim() || DEFAULT_TTS_MODEL,
  };
}

function isSupportedModel(model: string): model is GeminiTtsModel {
  return GEMINI_TTS_MODELS.some((supported) => supported === model);
}

function jsonError(error: string, status: number) {
  return Response.json(
    { error },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export function GET() {
  const { apiKey, model } = getConfiguration();
  return Response.json(
    { configured: Boolean(apiKey) && isSupportedModel(model), model },
    {
      headers: { "Cache-Control": "no-store" },
    },
  );
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return jsonError("Yêu cầu không hợp lệ.", 403);
  if (Number(request.headers.get("content-length")) > 16000)
    return jsonError("Đoạn văn quá dài.", 413);

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError("Nội dung gửi lên không hợp lệ.", 400);
  }
  if (
    !body ||
    typeof body.text !== "string" ||
    !body.text.trim() ||
    body.text.length > MAX_SPEECH_CHARS ||
    body.language !== READING_LANGUAGE ||
    !["warm", "clear"].includes(body.tone) ||
    !AI_VOICES.includes(body.voice)
  ) {
    return jsonError(
      "Chọn giọng đọc và đoạn văn tiếng Việt hợp lệ.",
      400,
    );
  }

  const { apiKey, model } = getConfiguration();
  if (!apiKey)
    return jsonError(
      "Chưa cấu hình giọng Gemini. Cần thêm GEMINI_API_KEY trong .env hoặc .env.local.",
      503,
    );
  if (!isSupportedModel(model))
    return jsonError("GEMINI_TTS_MODEL chưa hợp lệ. Chọn gemini-3.8-flash-tts hoặc gemini-3.8-flash-lite-tts.", 503);
  if (body.model !== undefined && body.model !== model)
    return jsonError("Model giọng đọc đã thay đổi. Tải lại trang rồi thử lại.", 409);

  try {
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: [{
          type: "user_input",
          content: [{
            type: "text",
            text: body.text,
            annotations: [{ type: "speech_metadata", style: getSpeechInstructions(body.tone) }],
          }],
        }],
        response_format: { type: "audio", mime_type: "audio/wav" },
        generation_config: { speech_config: [{ voice: body.voice }] },
      }),
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(55000)]),
      cache: "no-store",
    });
    if (!response.ok) {
      if (response.status === 429)
        return jsonError(
          "Gemini đã chạm hạn mức tạo audio của project. Kiểm tra quota trong Google AI Studio trước khi thử lại.",
          429,
        );
      if (response.status === 401 || response.status === 403)
        return jsonError(
          "API key Gemini không hợp lệ hoặc project chưa có quyền dùng model TTS.",
          502,
        );
      if (response.status === 404)
        return jsonError("Model Gemini TTS chưa khả dụng cho project. Kiểm tra GEMINI_TTS_MODEL trong cấu hình.", 502);
      return jsonError(
        "Gemini chưa tạo được audio. Kiểm tra API key, model hoặc thử lại sau.",
        502,
      );
    }
    const result = await response.json().catch(() => null) as GeminiResponse | null;
    const parts = Array.isArray(result?.steps) ? result.steps
      .filter((step) => step?.type === "model_output")
      .flatMap((step) => Array.isArray(step.content) ? step.content : [])
      .filter((part) => part?.type === "audio") : [];
    const lastAudio = parts?.[parts.length - 1];
    if (typeof lastAudio?.data !== "string" || !lastAudio.data || !/^[A-Za-z0-9+/]+={0,2}$/.test(lastAudio.data)) {
      return jsonError("Gemini không trả về audio. Thử lại với đoạn truyện ngắn hơn.", 502);
    }
    const audio = Buffer.from(lastAudio.data, "base64");
    if (audio.length < 44 || audio.toString("ascii", 0, 4) !== "RIFF" || audio.toString("ascii", 8, 12) !== "WAVE") {
      return jsonError("Gemini trả về định dạng audio không hợp lệ. Thử lại sau.", 502);
    }
    return new Response(new Uint8Array(audio), {
      headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store" },
    });
  } catch {
    if (request.signal.aborted) return new Response(null, { status: 499 });
    return jsonError(
      "Không kết nối được Gemini hoặc tạo audio quá lâu. Thử lại sau.",
      504,
    );
  }
}
