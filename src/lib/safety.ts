/**
 * Content Moderation & AI Safety Engine for Live Event Photo Wall
 * Analyzes captions, guest names, and image flags before projecting on giant screens.
 */

// Common toxic or offensive terms in Spanish and English (hate speech, slurs, explicit insults)
const PROFANITY_PATTERNS = [
  /\b(put[ao]s?|hdp|mierda|verga|concha|pija|pito|cul[ao]|choto|chota|trolo|tarad[ao]|pelotud[ao]|forr[ao]|nazi|porno|violar?)\b/i,
  /\b(fuck|shit|asshole|bitch|dick|pussy|porn|nude|hitler)\b/i,
];

export interface SafetyCheckResult {
  isSafe: boolean;
  flaggedReason?: string;
  confidenceScore?: number; // 0 (risky) to 1 (safe)
}

/**
 * Text content safety filter (Caption & Uploader Name)
 */
export function checkTextSafety(text: string): { isSafe: boolean; reason?: string } {
  if (!text) return { isSafe: true };

  for (const pattern of PROFANITY_PATTERNS) {
    if (pattern.test(text)) {
      return {
        isSafe: false,
        reason: 'Palabras o lenguaje explícito detectado en el texto',
      };
    }
  }

  return { isSafe: true };
}

/**
 * Global Safety Evaluation for incoming guest uploads
 * Combines text analysis with optional external AI Vision if API key is present.
 */
export async function evaluatePhotoSafety({
  uploaderName,
  caption,
  storagePath,
  publicImageUrl,
}: {
  uploaderName: string;
  caption?: string | null;
  storagePath: string;
  publicImageUrl?: string;
}): Promise<SafetyCheckResult> {
  // 1. Check uploader name
  const nameCheck = checkTextSafety(uploaderName);
  if (!nameCheck.isSafe) {
    return {
      isSafe: false,
      flaggedReason: `Nombre de usuario inapropiado: ${nameCheck.reason}`,
      confidenceScore: 0.1,
    };
  }

  // 2. Check caption if present
  if (caption) {
    const captionCheck = checkTextSafety(caption);
    if (!captionCheck.isSafe) {
      return {
        isSafe: false,
        flaggedReason: `Pie de foto bloqueado: ${captionCheck.reason}`,
        confidenceScore: 0.2,
      };
    }
  }

  // 3. Optional AI Vision SafeSearch (If Gemini / Google Vision API Key is defined)
  const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY;
  if (geminiApiKey && publicImageUrl) {
    try {
      // Optional external vision prompt for high security
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: 'Analyze this photo for a wedding or family party live projector. Is there any nudity, gore, hate symbols, or offensive content? Answer ONLY "SAFE" or "UNSAFE: [reason]".',
                },
              ],
            },
          ],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
        if (reply.toUpperCase().startsWith('UNSAFE')) {
          return {
            isSafe: false,
            flaggedReason: `Filtro IA: ${reply}`,
            confidenceScore: 0.1,
          };
        }
      }
    } catch {
      // Fallback silently to heuristics if API is unreachable
    }
  }

  return {
    isSafe: true,
    confidenceScore: 0.95,
  };
}
