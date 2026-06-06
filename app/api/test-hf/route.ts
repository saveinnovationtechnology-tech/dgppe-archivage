// app/api/test-hf/route.ts

import { HfInference } from "@huggingface/inference";

export async function GET() {
  try {
    const hf = new HfInference(
      process.env.HUGGINGFACE_API_KEY
    );

    const result = await hf.featureExtraction({
      model: "sentence-transformers/paraphrase-multilingual-mpnet-base-v2",
      inputs: "Bonjour, ceci est un test d'embedding."
    });

    return Response.json({
      success: true,
      type: typeof result,
      length: Array.isArray(result) ? result.length : null,
      preview: Array.isArray(result)
        ? result.slice(0, 5)
        : result
    });

  } catch (error) {
    return Response.json({
      success: false,
      error: error instanceof Error
        ? error.message
        : String(error)
    });
  }
}