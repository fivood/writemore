/**
 * 使用 Gemini Nano Banana 2.1 (gemini-nano-banana-2.1) 生成极简留白复古木刻版画小品
 */
import fs from 'node:fs';
import path from 'node:path';

function loadApiKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY.trim();
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const raw = fs.readFileSync(envPath, 'utf-8');
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*(?:VITE_)?GEMINI_API_KEY\s*=\s*(.+)\s*$/);
      if (m) return m[1].replace(/^['"]|['"]$/g, '').trim();
    }
  }
  return '';
}

const STYLE_ANCHOR = [
  'Minimalist mid-century vintage linocut spot illustration isolated on a 100% pure solid flat #FFFFFF white background edge-to-edge.',
  'STRICT RULES: Pure #FFFFFF white background everywhere, NO paper texture, NO corner vignette, NO dark corners, NO shading on background, NO outer border, NO rectangular frame, NO enclosing box, NO text, NO letters, NO numbers.',
  'Very simple, sparse, uncluttered composition with at least 65% empty pure white negative space.',
  'Clean bold dark espresso-sepia ink lines (#3E2B1F) with a tiny touch of muted warm taupe (#8C6F52), minimal hatching, poetic and airy like a small New Yorker magazine spot drawing.',
].join(' ');

const PLATES = [
  {
    name: 'lexicon-plate',
    aspectRatio: '16:9',
    prompt: `${STYLE_ANCHOR} Subject: three simple small geometric polyhedron blocks floating gently along a single thin sweeping curved ribbon line across wide empty pure white space.`,
  },
  {
    name: 'freehand-plate',
    aspectRatio: '4:3',
    prompt: `${STYLE_ANCHOR} Subject: one simple minimalist origami paper bird silhouette gliding near a clean crescent moon and two gentle curved breeze lines, floating centered in wide pure white space.`,
  },
  {
    name: 'scene-plate',
    aspectRatio: '1:1',
    prompt: `${STYLE_ANCHOR} Subject: a single minimalist arched doorway silhouette casting one clean diagonal shadow shape, floating freely in pure white space with no frame.`,
  },
  {
    name: 'character-plate',
    aspectRatio: '1:1',
    prompt: `${STYLE_ANCHOR} Subject: a single minimalist continuous-line modernist abstract silhouette of two overlapping human profiles in clean bold espresso-brown ink, floating centered in pure white space with no frame.`,
  },
  {
    name: 'challenge-plate',
    aspectRatio: '1:1',
    prompt: `${STYLE_ANCHOR} Subject: a single clean vintage keyhole silhouette containing one tiny four-point star inside, floating centered in wide pure white space with no border or frame.`,
  },
];

async function generateOne(apiKey, item, outDir) {
  console.log(`Generating ${item.name} (${item.aspectRatio})...`);
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'Content-Type': 'application/json',
      'Api-Revision': '2026-05-20',
    },
    body: JSON.stringify({
      model: 'gemini-nano-banana-2.1',
      input: item.prompt,
      store: false,
      response_format: {
        type: 'image',
        aspect_ratio: item.aspectRatio,
        image_size: '1K',
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`HTTP ${res.status} on ${item.name}: ${errText}`);
  }

  const data = await res.json();
  let b64 = data?.output_image?.data;

  if (!b64 && Array.isArray(data?.steps)) {
    for (let i = data.steps.length - 1; i >= 0 && !b64; i--) {
      const step = data.steps[i];
      if (step?.type === 'model_output' && Array.isArray(step.content)) {
        for (const part of step.content) {
          if (part?.type === 'image' && part.data) {
            b64 = part.data;
            break;
          }
        }
      }
    }
  }

  if (!b64) {
    throw new Error(`No image data found in response for ${item.name}`);
  }

  const outPath = path.join(outDir, `${item.name}.png`);
  fs.writeFileSync(outPath, Buffer.from(b64, 'base64'));
  console.log(`✓ Saved ${outPath}`);
}

async function main() {
  const apiKey = loadApiKey();
  if (!apiKey) {
    console.error('Missing GEMINI_API_KEY in environment or .env.local');
    process.exit(2);
  }

  const outDir = path.resolve(process.cwd(), 'public', 'editorial');
  fs.mkdirSync(outDir, { recursive: true });

  await Promise.all(PLATES.map(item => generateOne(apiKey, item, outDir)));
  console.log('All 5 minimalist editorial plates generated successfully!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
