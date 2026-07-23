export type ExtractMenuFromImageInput = { imageDataUri: string };
export type ExtractMenuFromImageOutput = { items: any[] };

const MISTRAL_API_KEY = import.meta.env.VITE_MISTRAL_API_KEY as string;

const annotationSchema = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "Menu item name in Arabic or English" },
          description: { type: "string", description: "Brief description of the item" },
          category: { type: "string", description: "Category like: main, appetizer, drink, dessert, side, soup, salad, sandwich" },
          sizes: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string", description: "Size name like: وسط, كبير, صغير, Regular, Large" },
                price: { type: "number", description: "Price in Saudi Riyals" },
              },
              required: ["name", "price"],
              additionalProperties: false,
            },
            description: "Different sizes with prices. If only one price, use size 'Default' or 'أساسي'",
          },
          calories: { type: "number", description: "Calories per serving, null if not visible" },
          allergens: {
            type: "array",
            items: { type: "string" },
            description: "Allergens like: نواة, حليب, بيض, قمح, سمك, محار, صويا, سمسم, غلوتين",
          },
        },
        required: ["name", "description", "category", "sizes"],
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
  additionalProperties: false,
};

export async function extractMenuFromImage(input: ExtractMenuFromImageInput): Promise<ExtractMenuFromImageOutput> {
  if (!MISTRAL_API_KEY) {
    throw new Error("MISTRAL_API_KEY is not configured. Add VITE_MISTRAL_API_KEY to .env");
  }

  const isPdf = input.imageDataUri.startsWith("data:application/pdf");
  const document = isPdf
    ? { type: "document_url", document_url: input.imageDataUri }
    : { type: "image_url", image_url: input.imageDataUri };

  const ocrResponse = await fetch("https://api.mistral.ai/v1/ocr", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${MISTRAL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "mistral-ocr-latest",
      document,
      document_annotation_prompt: "Extract all menu items from this restaurant menu image/document. For each item, identify the name, description, category, sizes with prices, calories if visible, and allergens if mentioned. Return structured JSON.",
      document_annotation_format: {
        type: "json_schema",
        json_schema: {
          schema: annotationSchema,
          name: "menu_extraction",
          strict: true,
        },
      },
    }),
  });

  if (!ocrResponse.ok) {
    const errorText = await ocrResponse.text().catch(() => "unknown");
    console.error("[extract-menu]", `Mistral OCR error: ${ocrResponse.status}`, errorText);
    throw new Error(`OCR failed (${ocrResponse.status}): ${errorText}`);
  }

  const ocrData = await ocrResponse.json() as { document_annotation?: string };

  if (ocrData.document_annotation) {
    const parsed = JSON.parse(ocrData.document_annotation);
    console.log("[extract-menu]", "Extracted items:", parsed.items?.length ?? 0);
    return parsed;
  }

  console.error("[extract-menu]", "No document_annotation in response:", ocrData);
  return { items: [] };
}
