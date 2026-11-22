// GPT Image models always return base64 image data (no response_format /
// url option like the older DALL-E models).
export const IMAGE_MODEL = "gpt-image-2";

export async function generateImage(
  apiKey: string,
  prompt: string,
  size: "1024x1024" | "1024x1536" | "1536x1024" = "1024x1536",
  options: { model?: string; signal?: AbortSignal } = {}
): Promise<Buffer> {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: options.model ?? IMAGE_MODEL,
      prompt,
      size,
      n: 1,
    }),
    signal: options.signal,
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(`OpenAI Images API error: ${json?.error?.message ?? JSON.stringify(json)}`);
  }

  const b64 = json?.data?.[0]?.b64_json;
  if (typeof b64 !== "string" || b64.length === 0) {
    throw new Error("OpenAI no devolvió una imagen.");
  }

  return Buffer.from(b64, "base64");
}
