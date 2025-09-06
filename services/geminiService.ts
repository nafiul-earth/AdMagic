/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI } from "@google/genai";
import type { GenerateContentResponse } from "@google/genai";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable is not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });


// --- Prompts and Helper Functions ---

const PROMPTS_MAP: Record<string, string> = {
    'Luxury': "Create a high-end, luxurious advertisement featuring the subject from the image. Think of a commercial for a designer perfume, expensive watch, or luxury car. The mood should be sophisticated, elegant, and aspirational. The lighting should be professional and dramatic.",
    'Vintage': "Generate a vintage-style print ad, reminiscent of the 1950s or 1960s, using the subject from the image. The ad should have a retro color palette, typography, and a slightly aged, nostalgic feel. Include classic ad copy elements like a catchy slogan.",
    'Minimalist': "Transform the image into a clean, modern, minimalist advertisement. Think of a tech product ad (like Apple or Google). The background should be simple, with lots of negative space. The focus must be entirely on the subject, presented in a sleek and uncluttered way.",
    'Action': "Reimagine the subject from the image as the star of a high-energy action movie poster or a sports drink advertisement. The scene should be dynamic, with motion blur, dramatic lighting, and an intense, powerful mood. Make it look exciting and cinematic.",
    'Skincare': "Create a bright, clean, and fresh skincare or beauty product advertisement with the subject from the image. The lighting should be soft and flattering, emphasizing clear skin and a natural glow. The overall feeling should be serene, healthy, and pure.",
    'Streetwear': "Generate a cool, edgy streetwear fashion ad featuring the subject from the image. The setting should be urban, like a city street or skatepark. The style should be modern and trendy, with a confident, rebellious vibe. Think of brands like Supreme or Off-White."
};


/**
 * Creates a fallback prompt to use when the primary one is blocked.
 * @param style The ad style string (e.g., "Luxury").
 * @returns The fallback prompt string.
 */
function getFallbackPrompt(style: string): string {
    return `Create a high-quality advertisement featuring the subject of this image in a '${style}' style. The ad should look professional and visually compelling, capturing the essence of that style. Ensure the final output is a clear, photorealistic image.`;
}

/**
 * Processes the Gemini API response, extracting the image or throwing an error if none is found.
 * @param response The response from the generateContent call.
 * @returns A data URL string for the generated image.
 */
function processGeminiResponse(response: GenerateContentResponse): string {
    const imagePartFromResponse = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);

    if (imagePartFromResponse?.inlineData) {
        const { mimeType, data } = imagePartFromResponse.inlineData;
        return `data:${mimeType};base64,${data}`;
    }

    const textResponse = response.text;
    console.error("API did not return an image. Response:", textResponse);
    throw new Error(`The AI model responded with text instead of an image: "${textResponse || 'No text response received.'}"`);
}

/**
 * A wrapper for the Gemini API call that includes a retry mechanism for internal server errors.
 * @param imagePart The image part of the request payload.
 * @param textPart The text part of the request payload.
 * @returns The GenerateContentResponse from the API.
 */
async function callGeminiWithRetry(imagePart: object, textPart: object): Promise<GenerateContentResponse> {
    const maxRetries = 3;
    const initialDelay = 1000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await ai.models.generateContent({
                model: 'gemini-2.5-flash-image-preview',
                contents: { parts: [imagePart, textPart] },
            });
        } catch (error) {
            console.error(`Error calling Gemini API (Attempt ${attempt}/${maxRetries}):`, error);
            const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
            const isInternalError = errorMessage.includes('"code":500') || errorMessage.includes('INTERNAL');

            if (isInternalError && attempt < maxRetries) {
                const delay = initialDelay * Math.pow(2, attempt - 1);
                console.log(`Internal error detected. Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            throw error; // Re-throw if not a retriable error or if max retries are reached.
        }
    }
    // This should be unreachable due to the loop and throw logic above.
    throw new Error("Gemini API call failed after all retries.");
}


/**
 * Generates an ad-styled image from a source image and a style descriptor.
 * It includes a fallback mechanism for prompts that might be blocked.
 * @param imageDataUrl A data URL string of the source image (e.g., 'data:image/png;base64,...').
 * @param style The ad style to generate (e.g., 'Luxury', 'Vintage').
 * @returns A promise that resolves to a base64-encoded image data URL of the generated image.
 */
export async function generateAdImage(imageDataUrl: string, style: string): Promise<string> {
  const match = imageDataUrl.match(/^data:(image\/\w+);base64,(.*)$/);
  if (!match) {
    throw new Error("Invalid image data URL format. Expected 'data:image/...;base64,...'");
  }
  const [, mimeType, base64Data] = match;

    const imagePart = {
        inlineData: { mimeType, data: base64Data },
    };
    
    const prompt = PROMPTS_MAP[style];
    if (!prompt) {
        throw new Error(`Invalid ad style provided: ${style}`);
    }

    // --- First attempt with the original prompt ---
    try {
        console.log(`Attempting generation for "${style}" with original prompt...`);
        const textPart = { text: prompt };
        const response = await callGeminiWithRetry(imagePart, textPart);
        return processGeminiResponse(response);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
        const isNoImageError = errorMessage.includes("The AI model responded with text instead of an image");

        if (isNoImageError) {
            console.warn(`Original prompt for "${style}" was likely blocked. Trying a fallback prompt.`);
            
            // --- Second attempt with the fallback prompt ---
            try {
                const fallbackPrompt = getFallbackPrompt(style);
                console.log(`Attempting generation with fallback prompt for ${style}...`);
                const fallbackTextPart = { text: fallbackPrompt };
                const fallbackResponse = await callGeminiWithRetry(imagePart, fallbackTextPart);
                return processGeminiResponse(fallbackResponse);
            } catch (fallbackError) {
                console.error("Fallback prompt also failed.", fallbackError);
                const finalErrorMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
                throw new Error(`The AI model failed with both original and fallback prompts. Last error: ${finalErrorMessage}`);
            }
        } else {
            // This is for other errors, like a final internal server error after retries.
            console.error("An unrecoverable error occurred during image generation.", error);
            throw new Error(`The AI model failed to generate an image. Details: ${errorMessage}`);
        }
    }
}