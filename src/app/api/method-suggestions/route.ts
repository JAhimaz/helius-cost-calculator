import { NextResponse } from "next/server";
import { Pricing } from "@/lib/Pricing";
import { Plans } from "@/lib/Plans";
import { CHAT_SOURCES } from "@/lib/ChatSources";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type SuggestedMethod = {
  methodType: keyof typeof Pricing.credit_costs | string;
  methodName: string;
  callRate: number;
  callFrequency: "minute" | "day";
  mb?: number | null | undefined;
};

type NormalizedSuggestedMethod = {
  methodType: keyof typeof Pricing.credit_costs;
  methodName: string;
  callRate: number;
  callFrequency: "minute" | "day";
  mb: number | null;
};

const OPENAI_CHAT_API_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_RESPONSES_API_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-5-mini-2025-08-07";
const MAX_SOURCES = 6;
const MAX_SOURCE_CHARS = 1800;

const stripHtml = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const summarizeSources = async () => {
  const urls = CHAT_SOURCES.slice(0, MAX_SOURCES);
  if (urls.length === 0) return [];

  const results = await Promise.allSettled(
    urls.map(async (url) => {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Failed to fetch ${url}`);
      }
      const text = await response.text();
      const cleaned = stripHtml(text).slice(0, MAX_SOURCE_CHARS);
      return { url, text: cleaned };
    }),
  );

  return results
    .filter(
      (result): result is PromiseFulfilledResult<{ url: string; text: string }> =>
        result.status === "fulfilled" && result.value.text.length > 0,
    )
    .map((result) => result.value);
};

const buildMethodCatalog = () => {
  return Object.fromEntries(
    Object.entries(Pricing.credit_costs).map(([methodType, methods]) => [
      methodType,
      Object.keys(methods),
    ]),
  );
};

const buildPlanSummary = () =>
  Plans.map((plan) => ({
    name: plan.name,
    monthly_credits: plan.monthly_credits,
    price_per_month_usd: plan.price_per_month_usd,
    rate_limits: plan.rate_limits,
    included_features: plan.included_features,
    notes: plan.notes ?? null,
  }));

const normalizeKey = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const shouldPreferMinute = (messageText: string) =>
  /indexer|subscribe|subscription|stream|streaming|websocket|laserstream|real[- ]?time/i.test(
    messageText,
  );

const extractEntityCount = (messageText: string) => {
  const match = messageText.match(
    /\b(\d{1,6})\s*(wallets?|addresses?|accounts?|users?|collections?|mints?|tokens?)\b/i,
  );
  if (!match) return null;
  const value = Number.parseInt(match[1], 10);
  return Number.isFinite(value) && value > 0 ? value : null;
};

const getDefaultStreamingMb = () => {
  const streaming = Pricing.credit_costs.data_streaming;
  const key = Object.keys(streaming)[0];
  if (!key) return null;
  return streaming[key]?.mb ?? null;
};

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing OPENAI_API_KEY in environment." },
      { status: 500 },
    );
  }

  const { message, history = [], selectedMethods = [] } = (await request.json()) as {
    message?: string;
    history?: ChatMessage[];
    selectedMethods?: Array<{ methodType: string; methodName: string }>;
  };

  if (!message || typeof message !== "string") {
    return NextResponse.json({ error: "Message is required." }, { status: 400 });
  }

  const sources = await summarizeSources();
  const methodCatalog = buildMethodCatalog();
  const selectedSummary = selectedMethods.map((method) => ({
    methodType: method.methodType,
    methodName: method.methodName,
  }));
  const planSummary = buildPlanSummary();

  const systemPrompt = [
    "You are a concise assistant helping users select Helius API methods for cost estimation.",
    "Only recommend methods from the provided catalog.",
    "Use the provided sources to justify suggestions. If sources are empty, say so and rely on general knowledge.",
    "Return JSON only, with this exact shape:",
    `{"assistant_message": string, "suggested_methods": SuggestedMethod[], "sources_used": string[], "replace_existing_methods": boolean}`,
    "SuggestedMethod = { methodType, methodName, callRate, callFrequency, mb? }.",
    "Set callFrequency based on usage pattern: real-time streaming/indexing/subscription/websocket/laserstream = minute; scheduled or batch workflows = day.",
    "If user says subscribe/stream/indexer, prefer per minute.",
    "Derive callRate from explicit counts in the user's message (e.g. 'track 20 wallets' -> 20 calls per minute if streaming).",
    "If suggesting data_streaming and user did not provide a bandwidth estimate, assume 0.1 MB per call and say it is an estimate.",
    "If the user's follow-up changes the requirements, set replace_existing_methods to true so old suggestions can be replaced.",
    "If you need clarification or cannot recommend, set suggested_methods to an empty array and replace_existing_methods to false.",
    "Avoid recommending methods already selected.",
    "sources_used must include at least two distinct URLs if available; otherwise include all available URLs used.",
    "Do not include markdown, code fences, or extra keys.",
    "",
    "Method catalog (type -> method names):",
    JSON.stringify(methodCatalog),
    "",
    "Plans summary (for rate limits/features context):",
    JSON.stringify(planSummary),
    "",
    "Already selected methods:",
    JSON.stringify(selectedSummary),
    "",
    "Sources:",
    sources.length > 0
      ? sources.map((source, index) => `Source ${index + 1} (${source.url}): ${source.text}`).join("\n\n")
      : "No sources provided.",
  ].join("\n");

  const filteredHistory = Array.isArray(history)
    ? history
        .filter(
          (entry): entry is ChatMessage =>
            entry &&
            (entry.role === "user" || entry.role === "assistant") &&
            typeof entry.content === "string" &&
            entry.content.trim().length > 0,
        )
        .map((entry) => ({
          role: entry.role,
          content: entry.content,
        }))
    : [];

  const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;

  const messages = filteredHistory.length > 0 ? filteredHistory : [{ role: "user", content: message }];

  const isGpt5 = model.startsWith("gpt-5");
  const maxOutputTokens = isGpt5 ? 1200 : 700;
  const response = await fetch(isGpt5 ? OPENAI_RESPONSES_API_URL : OPENAI_CHAT_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(
      isGpt5
        ? {
            model,
            input: [{ role: "system", content: systemPrompt }, ...messages],
            text: { format: { type: "json_object" } },
            reasoning: { effort: "low" },
            max_output_tokens: maxOutputTokens,
          }
        : {
            model,
            temperature: 0.2,
            response_format: { type: "json_object" },
            messages: [{ role: "system", content: systemPrompt }, ...messages],
            max_completion_tokens: maxOutputTokens,
          },
    ),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return NextResponse.json(
      { error: "LLM request failed.", details: errorText },
      { status: 502 },
    );
  }

  const data = await response.json();
  const content = isGpt5
    ? (data?.output || [])
        .flatMap((outputItem: { content?: Array<{ type?: string; text?: string }> }) =>
          Array.isArray(outputItem?.content) ? outputItem.content : [],
        )
        .filter((contentItem: { type?: string }) => contentItem.type === "output_text")
        .map((contentItem: { text?: string }) => contentItem.text || "")
        .join("") ||
      data?.output_text ||
      data?.output?.[0]?.content?.[0]?.text
    : data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    if (process.env.NODE_ENV !== "production") {
      return NextResponse.json(
        { error: "Invalid LLM response.", debug: data },
        { status: 502 },
      );
    }
    return NextResponse.json({ error: "Invalid LLM response." }, { status: 502 });
  }

  let parsed: {
    assistant_message: string;
    suggested_methods: SuggestedMethod[];
    sources_used: string[];
    replace_existing_methods?: boolean;
  };

  try {
    parsed = JSON.parse(content);
  } catch (error) {
    return NextResponse.json({ error: "LLM returned non-JSON output." }, { status: 502 });
  }

  const validMethodNames = new Set<string>();
  const normalizedTypeMap = new Map<string, string>();
  const normalizedNameToType = new Map<string, Array<{ methodType: string; methodName: string }>>();
  const normalizedNameMapByType = new Map<string, Map<string, string>>();

  Object.entries(methodCatalog).forEach(([methodType, methodNames]) => {
    normalizedTypeMap.set(normalizeKey(methodType), methodType);
    const nameMap = new Map<string, string>();
    methodNames.forEach((methodName) => {
      validMethodNames.add(`${methodType}:${methodName}`);
      const normalizedName = normalizeKey(methodName);
      nameMap.set(normalizedName, methodName);
      const matches = normalizedNameToType.get(normalizedName) ?? [];
      matches.push({ methodType, methodName });
      normalizedNameToType.set(normalizedName, matches);
    });
    normalizedNameMapByType.set(methodType, nameMap);
  });

  const preferMinute = shouldPreferMinute(message);
  const extractedCount = extractEntityCount(message);
  const defaultStreamingMb = getDefaultStreamingMb();

  const normalizedSuggestions = Array.isArray(parsed.suggested_methods)
    ? parsed.suggested_methods
        .map((suggestion) => {
          if (!suggestion || typeof suggestion.methodName !== "string") return null;

          let resolvedType = suggestion.methodType ?? "";
          let resolvedName = suggestion.methodName;

          const normalizedType =
            typeof suggestion.methodType === "string"
              ? normalizeKey(suggestion.methodType)
              : "";
          const normalizedName = normalizeKey(suggestion.methodName);

          if (!validMethodNames.has(`${resolvedType}:${resolvedName}`)) {
            const mappedType = normalizedTypeMap.get(normalizedType);
            if (mappedType) {
              resolvedType = mappedType;
            }

            const nameMap = normalizedNameMapByType.get(resolvedType);
            const mappedName = nameMap?.get(normalizedName);
            if (mappedName) {
              resolvedName = mappedName;
            }

            if (!validMethodNames.has(`${resolvedType}:${resolvedName}`)) {
              const candidates = normalizedNameToType.get(normalizedName);
              if (candidates && candidates.length === 1) {
                resolvedType = candidates[0].methodType;
                resolvedName = candidates[0].methodName;
              }
            }
          }

          if (!validMethodNames.has(`${resolvedType}:${resolvedName}`)) {
            return null;
          }

          const callRate =
            typeof suggestion.callRate === "number" && suggestion.callRate > 0
              ? suggestion.callRate
              : extractedCount ?? 1;
          let callFrequency =
            suggestion.callFrequency === "minute" || suggestion.callFrequency === "day"
              ? suggestion.callFrequency
              : "day";
          if (preferMinute && callFrequency === "day") {
            callFrequency = "minute";
          }
          let mb =
            typeof suggestion.mb === "number" && suggestion.mb > 0 ? suggestion.mb : null;
          if (!mb && resolvedType === "data_streaming" && defaultStreamingMb) {
            mb = defaultStreamingMb;
          }

          return {
            methodType: resolvedType,
            methodName: resolvedName,
            callRate,
            callFrequency,
            mb,
          };
        })
        .filter((suggestion): suggestion is NormalizedSuggestedMethod => Boolean(suggestion))
    : [];

  return NextResponse.json({
    assistant_message: parsed.assistant_message || "No response provided.",
    suggested_methods: normalizedSuggestions,
    sources_used: Array.isArray(parsed.sources_used) ? parsed.sources_used : [],
    replace_existing_methods: Boolean(parsed.replace_existing_methods),
  });
}
