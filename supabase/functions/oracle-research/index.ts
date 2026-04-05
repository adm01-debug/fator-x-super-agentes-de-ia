/**
 * ═══════════════════════════════════════════════════════════════
 * Nexus Agents Studio — Oracle Deep Research
 * ═══════════════════════════════════════════════════════════════
 * Iterative deep research: search → analyze → find gaps → search more → synthesize.
 * Up to 10 iterations producing a comprehensive report with citations.
 * The DIFFERENTIATOR #2 of Nexus — no competitor has this integrated.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  handleCorsPreflight, jsonResponse, errorResponse,
  authenticateRequest,
  checkRateLimit, createRateLimitResponse, getRateLimitIdentifier, RATE_LIMITS,
  parseBody, z,
} from "../_shared/mod.ts";

const ResearchInput = z.object({
  query: z.string().min(10).max(5000),
  max_iterations: z.number().int().min(1).max(10).default(5),
  depth: z.enum(['quick', 'standard', 'deep']).default('standard'),
  synthesis_model: z.string().default('claude-sonnet-4-6'),
  include_internal: z.boolean().default(true),
  language: z.enum(['pt', 'en', 'es']).default('pt'),
});

interface ResearchStep {
  iteration: number;
  action: string;
  query: string;
  findings: string;
  sources: string[];
  gaps_identified: string[];
  timestamp: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCorsPreflight(req);

  try {
    const auth = await authenticateRequest(req);
    if (auth.error) return auth.error;
    const { user, supabase } = auth;

    const identifier = getRateLimitIdentifier(req, user.id);
    const rateCheck = checkRateLimit(identifier, RATE_LIMITS.oracle);
    if (!rateCheck.allowed) return createRateLimitResponse(rateCheck);

    const parsed = await parseBody(req, ResearchInput);
    if (parsed.error) return parsed.error;
    const { query, max_iterations, depth, synthesis_model, include_internal, language } = parsed.data;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authHeader = req.headers.get('Authorization')!;
    const startTime = Date.now();
    const steps: ResearchStep[] = [];
    let allFindings = '';
    let allSources: string[] = [];
    let totalTokens = 0;
    let totalCost = 0;

    // ═══ Research Loop ═══
    let currentQuery = query;
    for (let i = 0; i < max_iterations; i++) {
      const iterStart = Date.now();

      // Step 1: Generate search queries from current understanding
      const planResp = await fetch(`${supabaseUrl}/functions/v1/llm-gateway`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': authHeader, 'apikey': anonKey },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          messages: [
            { role: 'system', content: `You are a research planner. Given a research query and previous findings, generate 3 specific search queries to fill knowledge gaps. Return ONLY a JSON array of strings. Language: ${language}` },
            { role: 'user', content: `Main query: "${currentQuery}"\n\nPrevious findings:\n${allFindings.slice(-2000) || 'None yet'}\n\nGenerate 3 search queries:` },
          ],
          temperature: 0.3, max_tokens: 500,
        }),
      });
      const planData = await planResp.json();
      totalTokens += (planData as Record<string, Record<string, number>>).usage?.total_tokens || 0;

      let searchQueries: string[];
      try {
        const content = String((planData as Record<string, string>).content || '[]');
        searchQueries = JSON.parse(content.replace(/```json\n?|```/g, '').trim());
      } catch {
        searchQueries = [currentQuery];
      }

      // Step 2: Search (via DuckDuckGo MCP or web search)
      const searchResults: string[] = [];
      for (const sq of searchQueries.slice(0, 3)) {
        try {
          const searchResp = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(sq)}&format=json&no_html=1`);
          const searchData = await searchResp.json();
          const abstract = String((searchData as Record<string, string>).Abstract || '');
          const relatedTopics = ((searchData as Record<string, Array<Record<string, string>>>).RelatedTopics || [])
            .slice(0, 3)
            .map(t => t.Text || '')
            .filter(Boolean);

          if (abstract) searchResults.push(abstract);
          searchResults.push(...relatedTopics);
          allSources.push(String((searchData as Record<string, string>).AbstractURL || sq));
        } catch { /* skip failed searches */ }
      }

      // Step 3: Analyze findings and identify gaps
      const analyzeResp = await fetch(`${supabaseUrl}/functions/v1/llm-gateway`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': authHeader, 'apikey': anonKey },
        body: JSON.stringify({
          model: depth === 'deep' ? synthesis_model : 'claude-haiku-4-5-20251001',
          messages: [
            { role: 'system', content: `Analyze search results for the research query. Summarize key findings. Identify 2-3 remaining gaps. Language: ${language}. Return JSON: {"findings": "...", "gaps": ["...", "..."]}` },
            { role: 'user', content: `Query: "${query}"\nSearch results:\n${searchResults.join('\n\n').slice(0, 3000)}` },
          ],
          temperature: 0.3, max_tokens: 1500,
        }),
      });
      const analyzeData = await analyzeResp.json();
      totalTokens += (analyzeData as Record<string, Record<string, number>>).usage?.total_tokens || 0;

      let findings = '';
      let gaps: string[] = [];
      try {
        const content = String((analyzeData as Record<string, string>).content || '{}');
        const parsed = JSON.parse(content.replace(/```json\n?|```/g, '').trim());
        findings = parsed.findings || content;
        gaps = parsed.gaps || [];
      } catch {
        findings = String((analyzeData as Record<string, string>).content || '');
      }

      allFindings += `\n\n--- Iteration ${i + 1} ---\n${findings}`;

      steps.push({
        iteration: i + 1,
        action: 'search_and_analyze',
        query: searchQueries.join(' | '),
        findings,
        sources: allSources.slice(-5),
        gaps_identified: gaps,
        timestamp: Date.now() - iterStart,
      });

      // If no gaps found or depth is quick, stop
      if (gaps.length === 0 || depth === 'quick') break;
      currentQuery = gaps[0]; // Focus next iteration on biggest gap
    }

    // ═══ Final Synthesis ═══
    const synthesisResp = await fetch(`${supabaseUrl}/functions/v1/llm-gateway`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': authHeader, 'apikey': anonKey },
      body: JSON.stringify({
        model: synthesis_model,
        messages: [
          { role: 'system', content: `You are an expert researcher. Synthesize all findings into a comprehensive, well-structured report in ${language === 'pt' ? 'Portuguese' : language === 'es' ? 'Spanish' : 'English'}. Include sections with headers. Cite sources where possible. Be thorough and analytical.` },
          { role: 'user', content: `Research query: "${query}"\n\nAll findings from ${steps.length} iterations:\n${allFindings}\n\nSources found: ${[...new Set(allSources)].join(', ')}\n\nWrite a comprehensive report:` },
        ],
        temperature: 0.5, max_tokens: 8000,
      }),
    });
    const synthesisData = await synthesisResp.json();
    totalTokens += (synthesisData as Record<string, Record<string, number>>).usage?.total_tokens || 0;

    const report = String((synthesisData as Record<string, string>).content || 'Report generation failed');
    const totalLatency = Date.now() - startTime;

    // Save to oracle_history
    await supabase.from('oracle_history').insert({
      query,
      mode: 'deep_research',
      result: { report, steps, sources: [...new Set(allSources)] },
      total_tokens: totalTokens,
      total_cost: totalCost,
      latency_ms: totalLatency,
    });

    return jsonResponse(req, {
      report,
      iterations: steps.length,
      sources: [...new Set(allSources)],
      total_tokens: totalTokens,
      latency_ms: totalLatency,
      depth,
      steps,
    });

  } catch (error) {
    return errorResponse(req, error instanceof Error ? error.message : 'Research failed', 500);
  }
});
