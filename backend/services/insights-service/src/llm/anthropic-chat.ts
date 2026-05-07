import Anthropic from "@anthropic-ai/sdk";
import type { ChatMessage } from "./types.js";

export function parseChatBody(raw: unknown): {
  system?: string;
  messages: ChatMessage[];
  max_tokens?: number;
} {
  if (!raw || typeof raw !== "object") {
    const err = new Error("Body JSON atteso");
    (err as Error & { statusCode?: number }).statusCode = 400;
    throw err;
  }
  const o = raw as Record<string, unknown>;
  const messages = o.messages;
  if (!Array.isArray(messages)) {
    const err = new Error("messages deve essere un array");
    (err as Error & { statusCode?: number }).statusCode = 400;
    throw err;
  }
  const out: ChatMessage[] = [];
  for (const m of messages) {
    if (!m || typeof m !== "object") {
      const err = new Error("Ogni elemento di messages deve essere un oggetto");
      (err as Error & { statusCode?: number }).statusCode = 400;
      throw err;
    }
    const mr = m as Record<string, unknown>;
    const role = mr.role;
    const content = mr.content;
    if (role !== "user" && role !== "assistant") {
      const err = new Error(
        'Ogni message.role deve essere "user" o "assistant"',
      );
      (err as Error & { statusCode?: number }).statusCode = 400;
      throw err;
    }
    if (typeof content !== "string" || !content.trim()) {
      const err = new Error("Ogni message.content deve essere una stringa non vuota");
      (err as Error & { statusCode?: number }).statusCode = 400;
      throw err;
    }
    out.push({ role, content: content.trim() });
  }
  if (out.length === 0) {
    const err = new Error("messages deve contenere almeno un messaggio");
    (err as Error & { statusCode?: number }).statusCode = 400;
    throw err;
  }

  let system: string | undefined;
  if (o.system !== undefined) {
    if (typeof o.system !== "string") {
      const err = new Error("system deve essere una stringa");
      (err as Error & { statusCode?: number }).statusCode = 400;
      throw err;
    }
    system = o.system.trim() || undefined;
  }

  let max_tokens: number | undefined;
  if (o.max_tokens !== undefined) {
    if (
      typeof o.max_tokens !== "number" ||
      !Number.isFinite(o.max_tokens) ||
      o.max_tokens < 1
    ) {
      const err = new Error("max_tokens deve essere un numero positivo");
      (err as Error & { statusCode?: number }).statusCode = 400;
      throw err;
    }
    max_tokens = Math.min(Math.floor(o.max_tokens), 8192);
  }

  return { system, messages: out, max_tokens };
}

const DEFAULT_MODEL = "claude-sonnet-4-20250514";

export function getAnthropicStatus() {
  const provider = (process.env.LLM_PROVIDER ?? "").toLowerCase().trim();
  const model = process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL;
  const apiKeyConfigured = Boolean(process.env.ANTHROPIC_API_KEY?.trim());
  const chatAvailable = provider === "anthropic" && apiKeyConfigured;
  return {
    llm_provider: provider || null,
    anthropic: {
      model,
      api_key_configured: apiKeyConfigured,
    },
    chat_available: chatAvailable,
  } as const;
}

function extractText(msg: Anthropic.Messages.Message): string {
  let out = "";
  for (const block of msg.content) {
    if (block.type === "text") {
      out += block.text;
    }
  }
  return out;
}

export async function anthropicChat(params: {
  system?: string;
  messages: ChatMessage[];
  max_tokens?: number;
}): Promise<{
  text: string;
  model: string;
  input_tokens: number | null;
  output_tokens: number | null;
}> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    const err = new Error("ANTHROPIC_API_KEY non configurata");
    (err as Error & { statusCode?: number }).statusCode = 503;
    throw err;
  }

  const prov = (process.env.LLM_PROVIDER ?? "").toLowerCase().trim();
  if (prov !== "anthropic") {
    const err = new Error(
      "LLM_PROVIDER deve essere «anthropic» per usare questo endpoint",
    );
    (err as Error & { statusCode?: number }).statusCode = 503;
    throw err;
  }

  const model = process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL;
  const client = new Anthropic({ apiKey });
  const maxTokens = params.max_tokens ?? 4096;

  if (params.messages.length === 0) {
    const err = new Error("messages non può essere vuoto");
    (err as Error & { statusCode?: number }).statusCode = 400;
    throw err;
  }

  try {
    const msg = await client.messages.create({
      model,
      max_tokens: maxTokens,
      ...(params.system ? { system: params.system } : {}),
      messages: params.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    return {
      text: extractText(msg),
      model: msg.model,
      input_tokens: msg.usage?.input_tokens ?? null,
      output_tokens: msg.usage?.output_tokens ?? null,
    };
  } catch (e: unknown) {
    const err = new Error(
      e instanceof Error ? e.message : "Errore chiamata Anthropic",
    );
    (err as Error & { statusCode?: number }).statusCode = 502;
    throw err;
  }
}
