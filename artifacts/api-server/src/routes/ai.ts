import { Router, type IRouter, type Request, type Response } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { generateImageBuffer } from "@workspace/integrations-openai-ai-server/image";

const router: IRouter = Router();

function jsonError(res: Response, err: unknown, fallback: object) {
  console.error("[ai-route]", err);
  res.json(fallback);
}

router.post("/restaurant-chat", async (req: Request, res: Response) => {
  try {
    const { customerMessage, restaurantData, locale } = req.body as {
      customerMessage: string;
      restaurantData: string;
      locale?: "ar" | "en";
    };
    const lang = locale === "en" ? "English" : "Arabic";
    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 512,
      messages: [
        {
          role: "system",
          content: `You are a helpful AI assistant for a restaurant. Restaurant info: ${restaurantData}. Reply in ${lang}. Be concise and friendly. If the user asks about job applications reply with showApplications:true in your JSON, if about branches reply showBranches:true.`,
        },
        { role: "user", content: customerMessage },
      ],
      response_format: { type: "json_schema", json_schema: {
        name: "chat_response",
        schema: {
          type: "object",
          properties: {
            smartReply: { type: "string" },
            showApplications: { type: "boolean" },
            showBranches: { type: "boolean" },
          },
          required: ["smartReply"],
          additionalProperties: false,
        },
        strict: true,
      }},
    });
    const content = completion.choices[0]?.message?.content ?? "{}";
    res.json(JSON.parse(content));
  } catch (err) {
    jsonError(res, err, { smartReply: "عفواً، واجهتني مشكلة فنية. حاول مرة ثانية.", showApplications: false, showBranches: false });
  }
});

router.post("/analyze-menu-health", async (req: Request, res: Response) => {
  try {
    const { menuItems, restaurantName } = req.body as { menuItems: unknown[]; restaurantName: string };
    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `Analyze the menu health for restaurant "${restaurantName}". Menu: ${JSON.stringify(menuItems)}. Return JSON: { healthScore: number (0-100), insights: string[], recommendations: string[] }`,
        },
      ],
      response_format: { type: "json_schema", json_schema: {
        name: "menu_health",
        schema: {
          type: "object",
          properties: {
            healthScore: { type: "number" },
            insights: { type: "array", items: { type: "string" } },
            recommendations: { type: "array", items: { type: "string" } },
          },
          required: ["healthScore", "insights", "recommendations"],
          additionalProperties: false,
        },
        strict: true,
      }},
    });
    res.json(JSON.parse(completion.choices[0]?.message?.content ?? "{}"));
  } catch (err) {
    jsonError(res, err, { healthScore: 0, insights: [], recommendations: [] });
  }
});

router.post("/analyze-reviews", async (req: Request, res: Response) => {
  try {
    const { reviews, restaurantName } = req.body as { reviews: unknown[]; restaurantName: string };
    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `Analyze reviews for "${restaurantName}". Reviews: ${JSON.stringify(reviews)}. Return JSON: { positiveThemes: string[], negativeThemes: string[], actionableInsight: string, sentimentScore: number (0-1) }`,
        },
      ],
      response_format: { type: "json_schema", json_schema: {
        name: "review_analysis",
        schema: {
          type: "object",
          properties: {
            positiveThemes: { type: "array", items: { type: "string" } },
            negativeThemes: { type: "array", items: { type: "string" } },
            actionableInsight: { type: "string" },
            sentimentScore: { type: "number" },
          },
          required: ["positiveThemes", "negativeThemes", "actionableInsight", "sentimentScore"],
          additionalProperties: false,
        },
        strict: true,
      }},
    });
    res.json(JSON.parse(completion.choices[0]?.message?.content ?? "{}"));
  } catch (err) {
    jsonError(res, err, { positiveThemes: [], negativeThemes: [], actionableInsight: "", sentimentScore: 0.5 });
  }
});

router.post("/dashboard-assistant", async (req: Request, res: Response) => {
  try {
    const { question, currentPage, menuItems, locale } = req.body as {
      question: string;
      currentPage: string;
      menuItems?: unknown[];
      locale?: "ar" | "en";
    };
    const lang = locale === "en" ? "English" : "Arabic";
    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 1024,
      messages: [
        {
          role: "system",
          content: `You are a restaurant dashboard assistant. Current page: ${currentPage}. Menu items available: ${JSON.stringify(menuItems ?? [])}. Reply in ${lang}.`,
        },
        { role: "user", content: question },
      ],
      response_format: { type: "json_schema", json_schema: {
        name: "assistant_response",
        schema: {
          type: "object",
          properties: {
            answer: { type: "string" },
            generatedImage: { type: "string" },
            suggestedAction: {
              type: "object",
              properties: {
                actionLabel: { type: "string" },
                actionType: { type: "string" },
                actionPayload: { type: "object", additionalProperties: true },
              },
              required: ["actionLabel", "actionType", "actionPayload"],
              additionalProperties: false,
            },
          },
          required: ["answer"],
          additionalProperties: false,
        },
        strict: true,
      }},
    });
    res.json(JSON.parse(completion.choices[0]?.message?.content ?? '{"answer":""}'));
  } catch (err) {
    jsonError(res, err, { answer: "عذراً، حدث خطأ. حاول مرة أخرى." });
  }
});

router.post("/extract-menu-from-image", async (req: Request, res: Response) => {
  try {
    const { imageDataUri } = req.body as { imageDataUri: string };

    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) {
      throw new Error("MISTRAL_API_KEY is not set");
    }

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

    const isPdf = imageDataUri.startsWith("data:application/pdf");
    const document = isPdf
      ? { type: "document_url", document_url: imageDataUri }
      : { type: "image_url", image_url: imageDataUri };

    const ocrResponse = await fetch("https://api.mistral.ai/v1/ocr", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
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
      const errorText = await ocrResponse.text();
      console.error("[ocr-route]", `Mistral OCR error: ${ocrResponse.status}`, errorText);
      throw new Error(`Mistral OCR failed: ${ocrResponse.status}`);
    }

    const ocrData = await ocrResponse.json() as { document_annotation?: string; pages?: unknown[] };
    console.log("[ocr-route]", "Mistral OCR response keys:", Object.keys(ocrData));

    if (ocrData.document_annotation) {
      const parsed = JSON.parse(ocrData.document_annotation);
      console.log("[ocr-route]", "Extracted items count:", parsed.items?.length ?? 0);
      res.json(parsed);
    } else {
      console.error("[ocr-route]", "No document_annotation in response. Response:", JSON.stringify(ocrData).substring(0, 500));
      res.json({ items: [] });
    }
  } catch (err) {
    jsonError(res, err, { items: [] });
  }
});

router.post("/generate-menu-descriptions", async (req: Request, res: Response) => {
  try {
    const { items } = req.body as { items: unknown[] };
    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 2048,
      messages: [
        {
          role: "user",
          content: `Generate appealing Arabic descriptions for these menu items: ${JSON.stringify(items)}. Return JSON: { items: array with same structure but improved/added description field }`,
        },
      ],
      response_format: { type: "json_schema", json_schema: {
        name: "menu_descriptions",
        schema: {
          type: "object",
          properties: {
            items: { type: "array", items: { type: "object", additionalProperties: true } },
          },
          required: ["items"],
          additionalProperties: false,
        },
        strict: true,
      }},
    });
    res.json(JSON.parse(completion.choices[0]?.message?.content ?? '{"items":[]}'));
  } catch (err) {
    jsonError(res, err, { items: [] });
  }
});

router.post("/summarize-feedback", async (req: Request, res: Response) => {
  try {
    const { chatMessages } = req.body as { chatMessages: Array<{ text: string; timestamp: string }> };
    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `Summarize customer feedback from these chat messages: ${JSON.stringify(chatMessages)}. Return JSON: { summary: string, frequentTopics: string[], customerSentiment: string, peakHours: string }`,
        },
      ],
      response_format: { type: "json_schema", json_schema: {
        name: "feedback_summary",
        schema: {
          type: "object",
          properties: {
            summary: { type: "string" },
            frequentTopics: { type: "array", items: { type: "string" } },
            customerSentiment: { type: "string" },
            peakHours: { type: "string" },
          },
          required: ["summary", "frequentTopics", "customerSentiment", "peakHours"],
          additionalProperties: false,
        },
        strict: true,
      }},
    });
    res.json(JSON.parse(completion.choices[0]?.message?.content ?? "{}"));
  } catch (err) {
    jsonError(res, err, { summary: "", frequentTopics: [], customerSentiment: "محايد", peakHours: "" });
  }
});

router.post("/generate-daily-pulse", async (req: Request, res: Response) => {
  try {
    const { restaurantName, mostDiscussedItem, peakActivityHour, totalInteractions } = req.body as {
      restaurantName: string;
      mostDiscussedItem: string;
      peakActivityHour: string;
      totalInteractions: number;
    };
    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 512,
      messages: [
        {
          role: "user",
          content: `Generate a daily pulse report in Arabic for restaurant "${restaurantName}". Most discussed item: ${mostDiscussedItem}. Peak hour: ${peakActivityHour}. Total interactions: ${totalInteractions}. Return JSON: { pulseSummary: string, singleActionableRecommendation: string }`,
        },
      ],
      response_format: { type: "json_schema", json_schema: {
        name: "daily_pulse",
        schema: {
          type: "object",
          properties: {
            pulseSummary: { type: "string" },
            singleActionableRecommendation: { type: "string" },
          },
          required: ["pulseSummary", "singleActionableRecommendation"],
          additionalProperties: false,
        },
        strict: true,
      }},
    });
    res.json(JSON.parse(completion.choices[0]?.message?.content ?? "{}"));
  } catch (err) {
    jsonError(res, err, { pulseSummary: "", singleActionableRecommendation: "" });
  }
});

router.post("/generate-reply-templates", async (req: Request, res: Response) => {
  try {
    const { scenario, restaurantName } = req.body as { scenario: string; restaurantName: string };
    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `Generate Arabic customer reply templates for restaurant "${restaurantName}" for this scenario: "${scenario}". Return JSON: { shortReply: string, empatheticReply: string, deEscalationReply: string }`,
        },
      ],
      response_format: { type: "json_schema", json_schema: {
        name: "reply_templates",
        schema: {
          type: "object",
          properties: {
            shortReply: { type: "string" },
            empatheticReply: { type: "string" },
            deEscalationReply: { type: "string" },
          },
          required: ["shortReply", "empatheticReply", "deEscalationReply"],
          additionalProperties: false,
        },
        strict: true,
      }},
    });
    res.json(JSON.parse(completion.choices[0]?.message?.content ?? "{}"));
  } catch (err) {
    jsonError(res, err, { shortReply: "", empatheticReply: "", deEscalationReply: "" });
  }
});

router.post("/generate-smart-offers", async (req: Request, res: Response) => {
  try {
    const { menuItems, restaurantName } = req.body as { menuItems: unknown[]; restaurantName: string };
    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `Suggest smart promotional offers for restaurant "${restaurantName}" based on these menu items: ${JSON.stringify(menuItems)}. Return JSON: { offers: [ { title: string, description: string, discount: string, targetItems: string[] } ] }`,
        },
      ],
      response_format: { type: "json_schema", json_schema: {
        name: "smart_offers",
        schema: {
          type: "object",
          properties: {
            offers: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  discount: { type: "string" },
                  targetItems: { type: "array", items: { type: "string" } },
                },
                required: ["title", "description", "discount", "targetItems"],
                additionalProperties: false,
              },
            },
          },
          required: ["offers"],
          additionalProperties: false,
        },
        strict: true,
      }},
    });
    res.json(JSON.parse(completion.choices[0]?.message?.content ?? '{"offers":[]}'));
  } catch (err) {
    jsonError(res, err, { offers: [] });
  }
});

router.post("/generate-tool-ideas", async (req: Request, res: Response) => {
  try {
    const { restaurantType, currentTools } = req.body as { restaurantType: string; currentTools?: string[] };
    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 512,
      messages: [
        {
          role: "user",
          content: `Suggest useful digital tool ideas for a "${restaurantType}" restaurant${currentTools?.length ? `. They already have: ${currentTools.join(", ")}` : ""}. Return JSON: { ideas: string[] } (5-8 concise Arabic ideas)`,
        },
      ],
      response_format: { type: "json_schema", json_schema: {
        name: "tool_ideas",
        schema: {
          type: "object",
          properties: {
            ideas: { type: "array", items: { type: "string" } },
          },
          required: ["ideas"],
          additionalProperties: false,
        },
        strict: true,
      }},
    });
    res.json(JSON.parse(completion.choices[0]?.message?.content ?? '{"ideas":[]}'));
  } catch (err) {
    jsonError(res, err, { ideas: [] });
  }
});

router.post("/generate-weekly-content", async (req: Request, res: Response) => {
  try {
    const { restaurantName, restaurantType, optionalTheme } = req.body as {
      restaurantName: string;
      restaurantType: string;
      optionalTheme?: string;
    };
    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 2048,
      messages: [
        {
          role: "user",
          content: `Generate a 7-day social media content plan in Arabic for restaurant "${restaurantName}" (${restaurantType})${optionalTheme ? `, theme: ${optionalTheme}` : ""}. Return JSON: { posts: [ { day: string, casualCopy: string, formalCopy: string, hashtags: string, cta: string } ] }`,
        },
      ],
      response_format: { type: "json_schema", json_schema: {
        name: "weekly_content",
        schema: {
          type: "object",
          properties: {
            posts: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  day: { type: "string" },
                  casualCopy: { type: "string" },
                  formalCopy: { type: "string" },
                  hashtags: { type: "string" },
                  cta: { type: "string" },
                },
                required: ["day", "casualCopy", "formalCopy", "hashtags", "cta"],
                additionalProperties: false,
              },
            },
          },
          required: ["posts"],
          additionalProperties: false,
        },
        strict: true,
      }},
    });
    res.json(JSON.parse(completion.choices[0]?.message?.content ?? '{"posts":[]}'));
  } catch (err) {
    jsonError(res, err, { posts: [] });
  }
});

router.post("/suggest-color-palette", async (req: Request, res: Response) => {
  try {
    const { restaurantType, mood } = req.body as { restaurantType: string; mood?: string };
    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 256,
      messages: [
        {
          role: "user",
          content: `Suggest a color palette for a "${restaurantType}" restaurant${mood ? ` with a "${mood}" mood` : ""}. Return JSON: { primary: string (hex), secondary: string (hex), accent: string (hex) }`,
        },
      ],
      response_format: { type: "json_schema", json_schema: {
        name: "color_palette",
        schema: {
          type: "object",
          properties: {
            primary: { type: "string" },
            secondary: { type: "string" },
            accent: { type: "string" },
          },
          required: ["primary", "secondary", "accent"],
          additionalProperties: false,
        },
        strict: true,
      }},
    });
    res.json(JSON.parse(completion.choices[0]?.message?.content ?? '{"primary":"#1a1a1a","secondary":"#f5f5f5","accent":"#e63946"}'));
  } catch (err) {
    jsonError(res, err, { primary: "#1a1a1a", secondary: "#f5f5f5", accent: "#e63946" });
  }
});

router.post("/suggest-menu-combo", async (req: Request, res: Response) => {
  try {
    const { menuItems, peopleCount, budget, preferences } = req.body as {
      menuItems: unknown[];
      peopleCount: number;
      budget: number;
      preferences?: string;
    };
    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `Suggest the best menu combination in Arabic for ${peopleCount} people with a budget of ${budget} SAR${preferences ? `, preferences: ${preferences}` : ""}. Menu: ${JSON.stringify(menuItems)}. Return JSON: { suggestedItems: [ { name: string, quantity: number, reason: string } ], totalPrice: number, summary: string }`,
        },
      ],
      response_format: { type: "json_schema", json_schema: {
        name: "menu_combo",
        schema: {
          type: "object",
          properties: {
            suggestedItems: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  quantity: { type: "number" },
                  reason: { type: "string" },
                },
                required: ["name", "quantity", "reason"],
                additionalProperties: false,
              },
            },
            totalPrice: { type: "number" },
            summary: { type: "string" },
          },
          required: ["suggestedItems", "totalPrice", "summary"],
          additionalProperties: false,
        },
        strict: true,
      }},
    });
    res.json(JSON.parse(completion.choices[0]?.message?.content ?? '{"suggestedItems":[],"totalPrice":0,"summary":""}'));
  } catch (err) {
    jsonError(res, err, { suggestedItems: [], totalPrice: 0, summary: "" });
  }
});

router.post("/summarize-public-reviews", async (req: Request, res: Response) => {
  try {
    const { reviews } = req.body as { reviews: unknown[] };
    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 512,
      messages: [
        {
          role: "user",
          content: `Summarize these public reviews in Arabic in 2-3 sentences: ${JSON.stringify(reviews)}. Return JSON: { summary: string }`,
        },
      ],
      response_format: { type: "json_schema", json_schema: {
        name: "reviews_summary",
        schema: {
          type: "object",
          properties: {
            summary: { type: "string" },
          },
          required: ["summary"],
          additionalProperties: false,
        },
        strict: true,
      }},
    });
    res.json(JSON.parse(completion.choices[0]?.message?.content ?? '{"summary":""}'));
  } catch (err) {
    jsonError(res, err, { summary: "" });
  }
});

router.post("/generate-menu-image", async (req: Request, res: Response) => {
  try {
    const { itemName, itemDescription, style, customInstructions } = req.body as {
      itemName: string;
      itemDescription?: string;
      style: string;
      customInstructions?: string;
    };
    const styleMap: Record<string, string> = {
      clean_white_background: "on a clean white background, professional food photography",
      realistic_restaurant_setting: "in a realistic restaurant setting, warm ambient lighting",
      dramatic_charcoal_sketch: "as a dramatic charcoal sketch illustration",
      vibrant_watercolor_art: "as vibrant watercolor art",
    };
    const styleDesc = styleMap[style] ?? style;
    const prompt = `A high-quality food photo of "${itemName}"${itemDescription ? ` (${itemDescription})` : ""}, ${styleDesc}${customInstructions ? `. ${customInstructions}` : ""}.`;
    const buffer = await generateImageBuffer(prompt, "1024x1024");
    res.json({ imageDataUri: `data:image/png;base64,${buffer.toString("base64")}` });
  } catch (err) {
    jsonError(res, err, { imageDataUri: "" });
  }
});

router.post("/generate-offer-image", async (req: Request, res: Response) => {
  try {
    const { offerTitle, offerDescription, style, includedItems } = req.body as {
      offerTitle: string;
      offerDescription?: string;
      style: string;
      includedItems?: Array<{ name: string; description?: string }>;
    };
    const styleMap: Record<string, string> = {
      modern_and_bold: "modern and bold graphic design with vibrant colors",
      elegant_and_minimalist: "elegant minimalist design with gold accents",
      fun_and_festive: "fun and festive design with bright playful elements",
    };
    const styleDesc = styleMap[style] ?? style;
    const itemsList = includedItems?.map((i) => i.name).join(", ");
    const prompt = `Promotional offer image for "${offerTitle}"${offerDescription ? `: ${offerDescription}` : ""}${itemsList ? `. Featured items: ${itemsList}` : ""}. Style: ${styleDesc}. Restaurant marketing material.`;
    const buffer = await generateImageBuffer(prompt, "1024x1024");
    res.json({ imageDataUri: `data:image/png;base64,${buffer.toString("base64")}` });
  } catch (err) {
    jsonError(res, err, { imageDataUri: "" });
  }
});

router.post("/redesign-menu-image", async (req: Request, res: Response) => {
  try {
    const { imageDataUri, itemName, instruction } = req.body as {
      imageDataUri: string;
      itemName: string;
      instruction?: string;
    };
    const prompt = `Redesign this food photo of "${itemName}" to be more appealing and professional${instruction ? `. Instruction: ${instruction}` : ""}. Keep the same subject but improve lighting, composition, and presentation.`;
    const buffer = await generateImageBuffer(prompt, "1024x1024");
    res.json({ imageDataUri: `data:image/png;base64,${buffer.toString("base64")}` });
  } catch (err) {
    jsonError(res, err, { imageDataUri: imageDataUri ?? "" });
  }
});

router.post("/search-places", async (req: Request, res: Response) => {
  try {
    const { query, location } = req.body as { query: string; location?: string };
    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 512,
      messages: [
        {
          role: "user",
          content: `Generate realistic mock search results for places matching query: "${query}"${location ? ` near ${location}` : ""}. Return JSON: { places: [ { placeId: string, name: string, address: string } ] } with 3-5 results.`,
        },
      ],
      response_format: { type: "json_schema", json_schema: {
        name: "search_places",
        schema: {
          type: "object",
          properties: {
            places: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  placeId: { type: "string" },
                  name: { type: "string" },
                  address: { type: "string" },
                },
                required: ["placeId", "name", "address"],
                additionalProperties: false,
              },
            },
          },
          required: ["places"],
          additionalProperties: false,
        },
        strict: true,
      }},
    });
    res.json(JSON.parse(completion.choices[0]?.message?.content ?? '{"places":[]}'));
  } catch (err) {
    jsonError(res, err, { places: [] });
  }
});

router.post("/fetch-place-details", async (req: Request, res: Response) => {
  try {
    const { placeId } = req.body as { placeId: string };
    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 256,
      messages: [
        {
          role: "user",
          content: `Generate realistic mock place details for placeId: "${placeId}". Return JSON: { name: string, address: string, phone: string, rating: number }`,
        },
      ],
      response_format: { type: "json_schema", json_schema: {
        name: "place_details",
        schema: {
          type: "object",
          properties: {
            name: { type: "string" },
            address: { type: "string" },
            phone: { type: "string" },
            rating: { type: "number" },
          },
          required: ["name", "address", "phone", "rating"],
          additionalProperties: false,
        },
        strict: true,
      }},
    });
    res.json(JSON.parse(completion.choices[0]?.message?.content ?? '{"name":"","address":"","phone":"","rating":0}'));
  } catch (err) {
    jsonError(res, err, { name: "", address: "", phone: "", rating: 0 });
  }
});

export default router;
