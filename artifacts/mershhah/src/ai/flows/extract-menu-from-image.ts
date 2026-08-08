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
          name: { type: "string", description: "اسم الصنف بالعربي أو الإنجليزي" },
          description: { type: "string", description: "وصف مختصر للصنف" },
          category: {
            type: "string",
            description: "التصنيف الرئيسي. اختر من: main (رئيسي), appetizer (مقبلات), drink (مشروبات), dessert (حلويات), side (أطباق جانبية), soup (شوربات), salad (سلطات), sandwich (ساندويتشات), pizza (بيتزا), burger (برجر), seafood (مأكولات بحرية), grilled (مشويات), rice (أرز), pasta (معكرونة), breakfast (إفطار), coffee (قهوة), juice (عصائر), kids (أطفال)"
          },
          sizes: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string", description: "اسم الحجم: صغير Small, وسط Medium, كبير Large, عائلي Family, أو اسم مخصص" },
                price: { type: "number", description: "السعر بالريال السعودي" },
              },
              required: ["name", "price"],
              additionalProperties: false,
            },
            description: "الأحجام والأسعار. إذا سعر واحد فقط استخدم حجم 'أساسي' أو 'Default'",
          },
          calories: { type: "number", description: "السعرات الحرارية لكل حصة. إذا غير موجودة اكتب null" },
          allergens: {
            type: "array",
            items: { type: "string" },
            description: "المواد المسببة للحساسية: مكسرات, حليب, بيض, قمح, سمك, محار, صويا, سمسم, غلوتين, فول سوداني",
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
      document_annotation_prompt: `استخرج جميع أصناف القائمة من صورة/ملف قائمة الطعام هذه. لكل صنف:
1. الاسم (بالعربي أو الإنجليزي)
2. الوصف المختصر
3. التصنيف الرئيسي (رئيسي، مقبلات، مشروبات، حلويات، أطباق جانبية، شوربات، سلطات، ساندويتشات، بيتزا، برجر، مأكولات بحرية، مشويات، أرز، معكرونة، إفطار، قهوة، عصائر، أطفال)
4. الأحجام والأسعار (إذا سعر واحد استخدم 'أساسي')
5. السعرات الحرارية (إذا غير موجودة اتركها فاضية)
6. المواد المسببة للحساسية (إذا غير موجودة اتركها فاضية)

تأكد من إخراج جميع الأصناف الموجودة في الصورة. إذا كان هناك أصناف بأسعار مختلفة حسب الحجم، اذكر كل حجم وسعره.`,
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
