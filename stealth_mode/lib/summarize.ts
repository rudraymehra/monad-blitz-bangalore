// Deterministic mock summarizer so the demo never depends on an LLM key.
// If OPENAI_API_KEY is set, uses a real model; otherwise falls back to the mock.

export async function summarize(text: string): Promise<{ summary: string; model: string }> {
  const key = process.env.OPENAI_API_KEY;
  if (key) {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "Summarize the user's text in 2 concise sentences." },
            { role: "user", content: text },
          ],
          temperature: 0.2,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const summary = data?.choices?.[0]?.message?.content?.trim();
        if (summary) return { summary, model: "gpt-4o-mini" };
      }
    } catch {
      /* fall through to mock */
    }
  }
  return { summary: mockSummary(text), model: "mock-extractive-v1" };
}

// Tiny extractive summarizer: ranks sentences by word frequency, returns top 2.
function mockSummary(text: string): string {
  const clean = (text || "").replace(/\s+/g, " ").trim();
  if (!clean) return "(empty input)";
  const sentences = clean.match(/[^.!?]+[.!?]*/g)?.map((s) => s.trim()).filter(Boolean) ?? [clean];
  if (sentences.length <= 2) return clean.slice(0, 280);

  const freq: Record<string, number> = {};
  for (const w of clean.toLowerCase().match(/[a-z0-9']+/g) ?? []) {
    if (STOP.has(w)) continue;
    freq[w] = (freq[w] ?? 0) + 1;
  }
  const scored = sentences.map((s, i) => {
    let score = 0;
    for (const w of s.toLowerCase().match(/[a-z0-9']+/g) ?? []) score += freq[w] ?? 0;
    return { s, i, score: score / Math.max(1, s.length) };
  });
  const top = [...scored].sort((a, b) => b.score - a.score).slice(0, 2).sort((a, b) => a.i - b.i);
  return top.map((t) => t.s).join(" ");
}

const STOP = new Set(
  "the a an and or but of to in on for with at by from as is are was were be been it this that these those i you he she we they".split(
    " "
  )
);
