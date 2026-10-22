// fal.ai 文生图：按平台出背景图，服务端转 base64 避免前端 CORS
import "dotenv/config";

const ENDPOINT = "https://fal.run/fal-ai/flux/schnell";
const SIZES = {
  xiaohongshu: [1024, 1280],
  moments: [1024, 1024],
  "wechat-mp": [1024, 576],
  poster: [1024, 1360],
};

const SCENE = {
  xiaohongshu:
    "a Chinese university student studying online at a wooden desk with a slim modern laptop, cozy dorm room, warm morning window light, notebook and earbuds nearby, three-quarter view, shallow depth of field, clean composition with empty space on the left for text",
  moments:
    "a slim modern laptop on a cafe table with a cup of coffee and a small notebook, soft afternoon light, lifestyle photography, clean background with negative space",
  "wechat-mp":
    "wide hero shot of a slim modern laptop on a clean minimal desk, soft gradient grey background, studio lighting, generous empty space on the left for headline",
  poster:
    "premium product photo of a slim modern laptop on a stone pedestal, dramatic studio lighting, dark neutral background, lots of empty space above for headline",
};

const NEGATIVE =
  "text, watermark, logo, brand logo, distorted screen, extra fingers, deformed hands, low quality, cluttered";

export async function generateBackground({ platform = "xiaohongshu", title = "", body = "" }) {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error("未配置 FAL_KEY");

  const [width, height] = SIZES[platform] || SIZES.xiaohongshu;
  const scene = SCENE[platform] || SCENE.xiaohongshu;
  const context = `${title}。${body}`.slice(0, 120);
  const prompt = `photorealistic lifestyle photograph: ${scene}. Context: ${context}. Natural colors, realistic materials, high detail, no text anywhere.`;

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      negative_prompt: NEGATIVE,
      image_size: { width, height },
      num_inference_steps: 4,
      num_images: 1,
      enable_safety_checker: true,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`fal ${res.status}: ${text.slice(0, 240)}`);
  }
  const data = await res.json();
  const url = data.images?.[0]?.url;
  if (!url) throw new Error("fal 未返回图片");

  const img = await fetch(url);
  if (!img.ok) throw new Error(`下载生成图失败 ${img.status}`);
  const buf = Buffer.from(await img.arrayBuffer());
  const type = img.headers.get("content-type") || "image/jpeg";

  return {
    dataUrl: `data:${type};base64,${buf.toString("base64")}`,
    width,
    height,
    prompt,
  };
}
