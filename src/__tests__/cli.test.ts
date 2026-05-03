import { afterEach, describe, expect, it } from "bun:test";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import JSZip from "jszip";

const repoRoot = resolve(import.meta.dir, "../..");
const tempDirectories: string[] = [];

interface CliResult {
  code: number | null;
  stderr: string;
  stdout: string;
}

afterEach(async () => {
  await Promise.all(
    tempDirectories.splice(0).map((directory) =>
      rm(directory, {
        force: true,
        recursive: true,
      }),
    ),
  );
});

async function createTempDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "markdown-to-doc-cli-"));
  tempDirectories.push(directory);
  return directory;
}

async function runCli(args: string[], stdin?: string): Promise<CliResult> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, ["run", "./src/cli/index.ts", ...args], {
      cwd: repoRoot,
      env: process.env,
      stdio: "pipe",
    });

    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolvePromise({ code, stderr, stdout });
    });

    if (stdin !== undefined) {
      child.stdin.end(stdin);
      return;
    }

    child.stdin.end();
  });
}

async function readDocxText(docxPath: string, filePath: string): Promise<string> {
  const zip = await JSZip.loadAsync(await readFile(docxPath));
  const file = zip.file(filePath);

  if (!file) {
    throw new Error(`Missing DOCX entry: ${filePath}`);
  }

  return file.async("text");
}

describe("CLI", () => {
  it("converts a markdown file and writes the default output path", async () => {
    const directory = await createTempDirectory();
    const inputPath = join(directory, "report.md");

    await Bun.write(inputPath, "# Hello from CLI");

    const result = await runCli([inputPath]);
    const outputPath = join(directory, "report.docx");
    const documentXml = await readDocxText(outputPath, "word/document.xml");

    expect(result.code).toBe(0);
    expect(result.stdout).toContain(outputPath);
    expect(documentXml).toContain("Hello from CLI");
  });

  it("converts markdown from stdin when an explicit output path is provided", async () => {
    const directory = await createTempDirectory();
    const outputPath = join(directory, "stdin-output.docx");

    const result = await runCli(["--stdin", "--output", outputPath], "# Streamed Input");
    const documentXml = await readDocxText(outputPath, "word/document.xml");

    expect(result.code).toBe(0);
    expect(documentXml).toContain("Streamed Input");
  });

  it("renders syntax-highlighted code blocks through the CLI", async () => {
    const directory = await createTempDirectory();
    const inputPath = join(directory, "snippet.md");

    await Bun.write(
      inputPath,
      ["# CLI code sample", "", "```json", '{ "status": "ok", "count": 2 }', "```"].join("\n"),
    );

    const result = await runCli([inputPath]);
    const outputPath = join(directory, "snippet.docx");
    const documentXml = await readDocxText(outputPath, "word/document.xml");

    expect(result.code).toBe(0);
    expect(documentXml).toContain(">JSON<");
    expect(documentXml).toContain("&quot;status&quot;");
    expect(documentXml).toContain("&quot;ok&quot;");
    expect(documentXml).toContain(">2<");
    expect(documentXml).toContain('w:color w:val="0369A1"');
    expect(documentXml).toContain('w:color w:val="0F766E"');
    expect(documentXml).toContain('w:color w:val="B45309"');
  });

  it("applies JSON config values during conversion", async () => {
    const directory = await createTempDirectory();
    const inputPath = join(directory, "configurable.md");
    const outputPath = join(directory, "configured.docx");
    const configPath = join(directory, "options.json");

    await Bun.write(inputPath, "# Body");
    await Bun.write(
      configPath,
      JSON.stringify({
        cover: {
          show: true,
          title: "Configured Cover",
        },
      }),
    );

    const result = await runCli([inputPath, "--output", outputPath, "--config", configPath]);
    const documentXml = await readDocxText(outputPath, "word/document.xml");

    expect(result.code).toBe(0);
    expect(documentXml).toContain("Configured Cover");
    expect(documentXml).toContain("Body");
  });

  it("fails when stdin and an input file are provided together", async () => {
    const directory = await createTempDirectory();
    const inputPath = join(directory, "invalid.md");

    await Bun.write(inputPath, "# Invalid");

    const result = await runCli([inputPath, "--stdin", "--output", join(directory, "out.docx")]);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("Use either an input file or --stdin, not both.");
  });

  it("rejects CLI config fields that require the library API", async () => {
    const directory = await createTempDirectory();
    const inputPath = join(directory, "input.md");
    const configPath = join(directory, "invalid-config.json");

    await Bun.write(inputPath, "# Invalid Config");
    await Bun.write(
      configPath,
      JSON.stringify({
        cover: {
          logo: {
            kind: "buffer",
            value: [1, 2, 3],
          },
        },
      }),
    );

    const result = await runCli([inputPath, "--config", configPath]);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('kind "buffer"');
  });
});
