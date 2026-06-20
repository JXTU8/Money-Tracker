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

    const prompt = `You are a nutrition estimation assistant. Look at this food photo and estimate:
- food_name: a short name for the dish/food (max 5 words)
- calories: your best-guess total calorie estimate for the visible portion, as an integer (kcal)
- note: one short caveat about estimate accuracy, max 12 words

Respond with ONLY raw JSON, no markdown formatting, in exactly this shape:
{"food_name": "...", "calories": 000, "note": "..."}`;

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
          generationConfig: { temperature: 0.2, maxOutputTokens: 200 },
        }),
      }
    );

    const data = await resp.json();
    if (!resp.ok) {
      throw new Error(data?.error?.message || `Gemini API error (${resp.status})`);
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const cleaned = text.replace(/```json|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
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
