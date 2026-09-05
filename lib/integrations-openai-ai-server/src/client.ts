import OpenAI from "openai";

function createClient(): OpenAI {
  if (!process.env.AI_INTEGRATIONS_OPENAI_BASE_URL) {
    throw new Error(
      "AI_INTEGRATIONS_OPENAI_BASE_URL must be set. Did you forget to provision the OpenAI AI integration?",
    );
  }

  if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
    throw new Error(
      "AI_INTEGRATIONS_OPENAI_API_KEY must be set. Did you forget to provision the OpenAI AI integration?",
    );
  }

  return new OpenAI({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  });
}

let client: OpenAI | undefined;

// Deployments that never configure the OpenAI integration (no key needed
// yet, or intentionally not using it) must still be able to import this
// module - only the routes that actually call `openai.*` should fail, not
// every route sharing this process just because the module loaded.
export const openai: OpenAI = new Proxy({} as OpenAI, {
  get(_target, prop, receiver) {
    if (!client) client = createClient();
    return Reflect.get(client as object, prop, receiver);
  },
});
