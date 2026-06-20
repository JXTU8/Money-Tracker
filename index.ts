// supabase/functions/estimate-calories/index.ts
//
// Receives a low-res food photo (base64) from the app, sends it to
// Google's Gemini API (free tier — plenty for a few photos a day) to
// estimate the food and its calories, and returns JSON.
//
// The Gemini API key lives ONLY here as a server-side secret — it is
// never sent to the browser, unlike storing it client-side.
//
// Deploy with the Supabase CLI from your project root:
//   supabase functions deploy estimate-calories
//   supabase secrets set GEMINI_API_KEY=your_key_here
//
// Get a free key (no credit card) at https://aistudio.google.com/apikey

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { image, mimeType } = await req.json();
    if (!image) throw new Error("No image provided");

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) throw new Error("GEMINI_API_KEY is not configured on this function");

    const prompt = `You are a nutrition estimation assistant. The photo may show one of:
(a) a meal or food item directly, or
(b) a printed or handwritten receipt/bill listing purchased food or drink items (e.g. a restaurant or grocery receipt).

If it's a receipt, identify the food/drink items listed (ignore tax, totals, non-food items) and estimate the combined calories for those items. If it's a direct food photo, estimate calories for the visible food.

Respond with:
- food_name: a short summary of what was identified (max 6 words)
- calories: your best-guess total calorie estimate as an integer (kcal). If you genuinely cannot identify any food/drink items at all (e.g. blurry photo, no food-related content), set this to null instead of guessing.
- note: one short caveat about estimate accuracy, max 12 words

Respond with ONLY raw JSON, no markdown formatting, in exactly this shape:
{"food_name": "...", "calories": 000, "note": "..."}
If nothing usable was found, use exactly:
{"food_name": "", "calories": null, "note": "..."}`;

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inline_data: { mime_type: mimeType || "image/jpeg", data: image } },
            ],
          }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 500,
            // FIX: Gemini 2.5 Flash can spend part of its token budget on internal
            // "thinking" before answering. For a simple classification task that ate
            // the old 200-token cap and left an empty/truncated reply. Disable it.
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      }
    );

    const data = await resp.json();
    if (!resp.ok) {
      throw new Error(data?.error?.message || `Gemini API error (${resp.status})`);
    }
    if (data?.promptFeedback?.blockReason) {
      return new Response(JSON.stringify({ food_name: "", calories: null, note: "AI couldn't analyze this photo — please enter manually." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    // FIX: pull out the first {...} block instead of requiring the whole reply to be
    // pure JSON — forgives any stray preamble/trailing text the model adds.
    const match = text.match(/\{[\s\S]*\}/);
    const cleaned = (match ? match[0] : text).trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
      if (typeof parsed.calories !== "number") parsed.calories = parseInt(parsed.calories) || null;
    } catch {
      parsed = { food_name: "Unknown food", calories: null, note: "Could not parse AI response — please edit manually." };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
