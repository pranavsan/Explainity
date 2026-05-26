import { Router } from "express";
import { db, analysesTable } from "@workspace/db";
import { eq, desc, count, sql } from "drizzle-orm";
import { CreateAnalysisBody, GetAnalysisParams, DeleteAnalysisParams, StreamAnalysisParams } from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";

export const analysesRouter = Router();

function extractRepoName(url: string): string {
  try {
    const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (match) return `${match[1]}/${match[2]}`;
    return url;
  } catch {
    return url;
  }
}

function extractOwnerRepo(url: string): { owner: string; repo: string } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/?#]+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace(/\.git$/, "") };
}

async function fetchRepoContext(githubUrl: string): Promise<string> {
  const parsed = extractOwnerRepo(githubUrl);
  if (!parsed) throw new Error("Invalid GitHub URL");

  const { owner, repo } = parsed;
  const headers: Record<string, string> = { "User-Agent": "CodeExplainer/1.0", Accept: "application/vnd.github+json" };

  // Fetch repo metadata
  const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
  if (!repoRes.ok) throw new Error(`GitHub API error: ${repoRes.status} ${repoRes.statusText}`);
  const repoData = await repoRes.json() as { description?: string; language?: string; stargazers_count?: number; topics?: string[] };

  // Fetch README
  let readme = "";
  try {
    const readmeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/readme`, { headers });
    if (readmeRes.ok) {
      const readmeData = await readmeRes.json() as { content?: string };
      if (readmeData.content) {
        readme = Buffer.from(readmeData.content, "base64").toString("utf-8").slice(0, 8000);
      }
    }
  } catch { /* ignore */ }

  // Fetch file tree (top-level + one level deep)
  let tree = "";
  try {
    const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`, { headers });
    if (treeRes.ok) {
      const treeData = await treeRes.json() as { tree?: { path: string; type: string }[] };
      if (treeData.tree) {
        tree = treeData.tree
          .filter((item) => item.type === "blob")
          .map((item) => item.path)
          .slice(0, 300)
          .join("\n");
      }
    }
  } catch { /* ignore */ }

  // Fetch key source files (up to 5 important files)
  const keyFilePatterns = [
    /^(src\/)?index\.(ts|js|tsx|jsx|py|go|rs|java|rb|php|cs)$/,
    /^(src\/)?main\.(ts|js|tsx|jsx|py|go|rs|java|rb|php|cs)$/,
    /^(src\/)?app\.(ts|js|tsx|jsx|py|go|rs|java|rb|php|cs)$/,
    /^package\.json$/,
    /^(cargo\.toml|requirements\.txt|go\.mod|pom\.xml|gemfile)$/i,
  ];

  const allPaths = tree.split("\n");
  const keyFiles: string[] = [];
  for (const pattern of keyFilePatterns) {
    const match = allPaths.find((p) => pattern.test(p));
    if (match && !keyFiles.includes(match)) keyFiles.push(match);
    if (keyFiles.length >= 5) break;
  }

  // Also grab up to 3 more source files
  const sourceExts = /\.(ts|js|tsx|jsx|py|go|rs|java|rb|php|cs|cpp|c|h)$/;
  for (const p of allPaths) {
    if (keyFiles.length >= 8) break;
    if (sourceExts.test(p) && !keyFiles.includes(p) && !p.includes("node_modules") && !p.includes(".min.")) {
      keyFiles.push(p);
    }
  }

  let fileContents = "";
  for (const filePath of keyFiles.slice(0, 8)) {
    try {
      const fileRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`, { headers });
      if (fileRes.ok) {
        const fileData = await fileRes.json() as { content?: string; encoding?: string };
        if (fileData.content && fileData.encoding === "base64") {
          const content = Buffer.from(fileData.content, "base64").toString("utf-8").slice(0, 2000);
          fileContents += `\n\n=== ${filePath} ===\n${content}`;
        }
      }
    } catch { /* ignore */ }
  }

  return `Repository: ${owner}/${repo}
Description: ${repoData.description || "No description"}
Primary Language: ${repoData.language || "Unknown"}
Stars: ${repoData.stargazers_count || 0}
Topics: ${(repoData.topics || []).join(", ") || "none"}

README:
${readme || "No README found"}

File Structure:
${tree.slice(0, 3000)}

Key Source Files:${fileContents}`;
}

function buildSystemPrompt(level: string): string {
  const levelInstructions: Record<string, string> = {
    beginner: `You are explaining this codebase to someone who is learning to code. Use simple language, avoid jargon, explain concepts from first principles, and use analogies. Assume minimal prior knowledge. Focus on the big picture and what the code does from a user perspective before diving into how it works.`,
    intermediate: `You are explaining this codebase to a developer with solid fundamentals but unfamiliar with this project. Use technical vocabulary appropriately, explain architectural decisions, reference common patterns and conventions (MVC, REST, etc.), and focus on how the pieces fit together.`,
    advanced: `You are explaining this codebase to an experienced developer. Be precise and technically detailed. Discuss design patterns, performance considerations, trade-offs in architecture decisions, non-obvious implementation choices, and how this compares to alternative approaches. Skip basics.`,
  };
  return levelInstructions[level] || levelInstructions.intermediate;
}

// GET /analyses
analysesRouter.get("/", async (req, res) => {
  try {
    const analyses = await db.select().from(analysesTable).orderBy(desc(analysesTable.createdAt));
    res.json(analyses.map(row => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to list analyses");
    res.status(500).json({ error: "Failed to list analyses" });
  }
});

// GET /analyses/stats
analysesRouter.get("/stats", async (req, res) => {
  try {
    const [totalRow] = await db.select({ count: count() }).from(analysesTable);
    const [completedRow] = await db.select({ count: count() }).from(analysesTable).where(eq(analysesTable.status, "completed"));
    const [pendingRow] = await db.select({ count: count() }).from(analysesTable).where(sql`${analysesTable.status} IN ('pending', 'processing')`);
    const [beginnerRow] = await db.select({ count: count() }).from(analysesTable).where(eq(analysesTable.level, "beginner"));
    const [intermediateRow] = await db.select({ count: count() }).from(analysesTable).where(eq(analysesTable.level, "intermediate"));
    const [advancedRow] = await db.select({ count: count() }).from(analysesTable).where(eq(analysesTable.level, "advanced"));

    const recentAnalyses = await db.select().from(analysesTable)
      .orderBy(desc(analysesTable.createdAt))
      .limit(5);

    res.json({
      total: totalRow.count,
      completed: completedRow.count,
      pending: pendingRow.count,
      byLevel: {
        beginner: beginnerRow.count,
        intermediate: intermediateRow.count,
        advanced: advancedRow.count,
      },
      recentAnalyses: recentAnalyses.map(row => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get stats");
    res.status(500).json({ error: "Failed to get stats" });
  }
});

// GET /analyses/:id
analysesRouter.get("/:id", async (req, res) => {
  const parsed = GetAnalysisParams.safeParse(req.params);
  if (!parsed.success) return void res.status(400).json({ error: "Invalid ID" });

  try {
    const [analysis] = await db.select().from(analysesTable).where(eq(analysesTable.id, parsed.data.id));
    if (!analysis) return void res.status(404).json({ error: "Analysis not found" });
    res.json({ ...analysis, createdAt: analysis.createdAt.toISOString(), updatedAt: analysis.updatedAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Failed to get analysis");
    res.status(500).json({ error: "Failed to get analysis" });
  }
});

// POST /analyses
analysesRouter.post("/", async (req, res) => {
  const parsed = CreateAnalysisBody.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: "Invalid request body" });

  const { githubUrl, level } = parsed.data;

  // Validate GitHub URL
  if (!githubUrl.includes("github.com")) {
    return void res.status(400).json({ error: "Please provide a valid GitHub repository URL" });
  }

  try {
    const title = extractRepoName(githubUrl);
    const [analysis] = await db.insert(analysesTable).values({
      title,
      githubUrl,
      level,
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    res.status(201).json({ ...analysis, createdAt: analysis.createdAt.toISOString(), updatedAt: analysis.updatedAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Failed to create analysis");
    res.status(500).json({ error: "Failed to create analysis" });
  }
});

// DELETE /analyses/:id
analysesRouter.delete("/:id", async (req, res) => {
  const parsed = DeleteAnalysisParams.safeParse(req.params);
  if (!parsed.success) return void res.status(400).json({ error: "Invalid ID" });

  try {
    const [deleted] = await db.delete(analysesTable).where(eq(analysesTable.id, parsed.data.id)).returning();
    if (!deleted) return void res.status(404).json({ error: "Analysis not found" });
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete analysis");
    res.status(500).json({ error: "Failed to delete analysis" });
  }
});

// POST /analyses/:id/stream — SSE endpoint that runs the AI analysis
analysesRouter.post("/:id/stream", async (req, res) => {
  const parsed = StreamAnalysisParams.safeParse(req.params);
  if (!parsed.success) return void res.status(400).json({ error: "Invalid ID" });

  const { id } = parsed.data;

  const [analysis] = await db.select().from(analysesTable).where(eq(analysesTable.id, id));
  if (!analysis) return void res.status(404).json({ error: "Analysis not found" });

  if (analysis.status === "completed") {
    return void res.status(200).json({ done: true });
  }

  // Set up SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const sendEvent = (data: object) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    // Mark as processing
    await db.update(analysesTable)
      .set({ status: "processing", updatedAt: new Date() })
      .where(eq(analysesTable.id, id));

    sendEvent({ section: "status", content: "processing" });

    // Fetch repo context
    sendEvent({ section: "progress", content: "Fetching repository..." });
    const repoContext = await fetchRepoContext(analysis.githubUrl);

    sendEvent({ section: "progress", content: "Analysing codebase with AI..." });

    const systemPrompt = buildSystemPrompt(analysis.level);

    const sections: { key: keyof typeof analysesTable.$inferSelect; label: string; prompt: string }[] = [
      {
        key: "summary",
        label: "Project Summary",
        prompt: `Based on this repository, write a clear and engaging summary of what this project does. Cover: what problem it solves, who it is for, and what makes it notable or interesting. Be specific to this project — avoid generic descriptions.`,
      },
      {
        key: "architecture",
        label: "Architecture",
        prompt: `Describe the architecture of this codebase. Cover: the overall structure (monolith, microservices, layered, etc.), the key modules/packages and their responsibilities, how the project is organised into directories, and the main dependencies/frameworks used and why. Use a file tree or list where helpful.`,
      },
      {
        key: "keyFunctions",
        label: "Key Functions & Classes",
        prompt: `Identify and explain the most important functions, classes, and components in this codebase. For each one: name it, explain what it does, why it matters, and any notable implementation details. Focus on the core logic, not boilerplate.`,
      },
      {
        key: "dataFlow",
        label: "Data Flow",
        prompt: `Explain how data flows through this system. Cover: where data enters (inputs/APIs/files/events), how it is processed or transformed, where it is stored or persisted, and how it exits (outputs/responses/side effects). Use a step-by-step narrative or diagram-like description.`,
      },
      {
        key: "walkthrough",
        label: "Execution Walkthrough",
        prompt: `Walk through what happens when this program runs from start to finish. Trace the execution path: from the entry point, through initialisation, into the core logic, and to a typical end state. Make it feel like a tour led by someone who knows the code well.`,
      },
    ];

    const results: Partial<Record<string, string>> = {};

    for (const section of sections) {
      sendEvent({ section: "progress", content: `Generating ${section.label}...` });

      const messages: { role: "user" | "system"; content: string }[] = [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Here is the repository context:\n\n${repoContext}\n\n---\n\n${section.prompt}\n\nRespond in Markdown format.`,
        },
      ];

      let sectionContent = "";

      const stream = await openai.chat.completions.create({
        model: "gpt-5.1",
        max_completion_tokens: 4096,
        messages,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          sectionContent += content;
          sendEvent({ section: section.key, content });
        }
      }

      results[section.key as string] = sectionContent;
    }

    // Save completed analysis
    await db.update(analysesTable)
      .set({
        status: "completed",
        summary: results["summary"] ?? null,
        architecture: results["architecture"] ?? null,
        keyFunctions: results["keyFunctions"] ?? null,
        dataFlow: results["dataFlow"] ?? null,
        walkthrough: results["walkthrough"] ?? null,
        updatedAt: new Date(),
      })
      .where(eq(analysesTable.id, id));

    sendEvent({ done: true });
    res.end();
  } catch (err: unknown) {
    req.log.error({ err }, "Analysis stream failed");
    const message = err instanceof Error ? err.message : "Analysis failed";

    await db.update(analysesTable)
      .set({ status: "failed", errorMessage: message, updatedAt: new Date() })
      .where(eq(analysesTable.id, id)).catch(() => {});

    sendEvent({ error: message });
    res.end();
  }
});
