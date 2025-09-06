/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI } from "@google/genai";
import type { GenerateContentResponse, Part } from "@google/genai";
import type { GeneratedImage } from "../App";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable is not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

// --- Helper Functions ---

function dataUrlToPart(dataUrl: string): Part | null {
    const match = dataUrl.match(/^data:(image\/\w+);base64,(.*)$/);
    if (!match) return null;
    const [, mimeType, base64Data] = match;
    return { inlineData: { mimeType, data: base64Data } };
}

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

interface AdFormData {
    aspectRatio: string;
    productType: string;
    productTitle: string;
    flavor: string;
    companyName: string;
    tagline: string;
    brandColors: string;
}

/**
 * Parses the text response from the research model to extract individual prompts.
 * @param text The raw text response from the model.
 * @returns An array of 10 prompt strings.
 */
function parsePromptsFromText(text: string): string[] {
    const prompts = text.split(/PROMPT \d+:/)
        .map(p => p.trim())
        .filter(p => p.length > 0);

    if (prompts.length < 10) {
        console.error("Failed to parse 10 prompts, found:", prompts.length, "Raw response:", text);
        throw new Error("The AI failed to generate enough creative concepts. Please try again.");
    }
    return prompts.slice(0, 10);
}


async function generateSingleAd(
    productImagePart: Part,
    logoImagePart: Part | null,
    creativePrompt: string,
    options: AdFormData
): Promise<string> {
    const logoInstruction = logoImagePart 
        ? "Incorporate the company logo from the second image subtly and professionally."
        : "No logo was provided, so do not add one.";
        
    const textPrompt = `
TASK: Create a professional advertisement using the provided product image.
CONCEPT: ${creativePrompt}
INSTRUCTIONS:
1. Place the product from the first image into the scene described by the concept.
2. ${logoInstruction}
3. The final ad's aspect ratio must be: ${options.aspectRatio}.
4. Adhere to the brand colors: ${options.brandColors}.
5. If a tagline is provided, incorporate it stylishly: "${options.tagline}".
`;

    const parts: Part[] = [{ text: textPrompt }, productImagePart];
    if (logoImagePart) {
        parts.push(logoImagePart);
    }

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            contents: { parts },
        });
        return processGeminiResponse(response);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
        throw new Error(`AI model failed: ${errorMessage}`);
    }
}

/**
 * Researches ad concepts and generates a 10-image campaign.
 * @param onProgressUpdate Callback to update UI with each generated image.
 */
export async function researchAndGenerateAds(
    productImageDataUrl: string,
    logoImageDataUrl: string | null,
    options: AdFormData,
    onProgressUpdate: (index: number, result: GeneratedImage) => void
): Promise<void> {

    // --- 1. RESEARCH PHASE ---
    const researchPrompt = `
You are a world-class creative director. Your task is to research popular advertising styles for a product and generate 10 unique, creative concepts for an ad campaign.

PRODUCT DETAILS:
- Product Type: ${options.productType}
- Product Title: ${options.productTitle}
- Flavor: ${options.flavor}
- Company Name: ${options.companyName}
- Target Vibe/Colors: ${options.brandColors}

Based on your research of current market trends for this type of product, generate exactly 10 distinct visual prompts for an image generation AI.

Each prompt must be detailed and describe a complete scene.

IMPORTANT: Format your response ONLY with the prompts. Each prompt must start with "PROMPT [number]:". Do not include any other text, greetings, or explanations.

EXAMPLE:
PROMPT 1: A dynamic action shot of the [product] splashing into a crystal clear wave on a sunny beach, with fresh [flavor] fruits scattered on the sand.
PROMPT 2: A minimalist studio shot of the [product] on a pedestal made of ice, with soft, cool-toned lighting highlighting condensation on the can.
...and so on for 10 prompts.
`;
    
    let creativePrompts: string[];
    try {
        const researchResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: researchPrompt,
            config: {
                tools: [{ googleSearch: {} }],
            },
        });
        creativePrompts = parsePromptsFromText(researchResponse.text);
    } catch (error) {
        console.error("Error during research phase:", error);
        throw new Error("The AI failed during the research phase. Please check your inputs and try again.");
    }

    // --- 2. GENERATION PHASE ---
    const productImagePart = dataUrlToPart(productImageDataUrl);
    if (!productImagePart) {
        throw new Error("Invalid product image data URL.");
    }
    const logoImagePart = logoImageDataUrl ? dataUrlToPart(logoImageDataUrl) : null;

    // Run all 10 generations in parallel
    await Promise.all(creativePrompts.map(async (prompt, index) => {
        try {
            const resultUrl = await generateSingleAd(productImagePart, logoImagePart, prompt, options);
            onProgressUpdate(index, { status: 'done', url: resultUrl });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            console.error(`Failed to generate ad for prompt ${index + 1}:`, error);
            onProgressUpdate(index, { status: 'error', error: errorMessage });
        }
    }));
}
