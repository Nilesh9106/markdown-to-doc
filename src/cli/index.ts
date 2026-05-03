#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import process from "node:process";
import { MarkdownToDocError } from "../errors/MarkdownToDocError.js";
import { markdownToDocx } from "../markdown-to-doc.js";
import type { MarkdownToDocxOptions } from "../types/markdown-to-doc.types.js";

interface CliArguments {
  configPath?: string;
  help: boolean;
  inputPath?: string;
  outputPath?: string;
  stdin: boolean;
  version: boolean;
}

const HELP_TEXT = `markdown-to-doc

Convert Markdown files into DOCX from the command line.

Usage:
  markdown-to-doc <input.md> [-o output.docx] [--config options.json]
  markdown-to-doc --stdin -o output.docx [--config options.json]
  markdown-to-doc --help
  markdown-to-doc --version

Options:
  -o, --output <file>   Write the DOCX file to this path
  --config <file>       Load MarkdownToDocxOptions from a JSON file
  --stdin               Read markdown from stdin instead of a file
  -h, --help            Show this help message
  -v, --version         Show the current package version

Notes:
  - When the input is a file, the output defaults to the same path with a .docx extension.
  - When using --stdin, --output is required.
  - CLI config supports JSON-serializable options only. Function-based options such as assets.resolveImage are library-only.
`;

async function main(): Promise<void> {
  try {
    const args = parseArgs(process.argv.slice(2));

    if (args.help) {
      process.stdout.write(`${HELP_TEXT}\n`);
      return;
    }

    if (args.version) {
      process.stdout.write(`${await readPackageVersion()}\n`);
      return;
    }

    const inputPath = args.inputPath ? resolve(args.inputPath) : undefined;
    const configPath = args.configPath ? resolve(args.configPath) : undefined;
    const outputPath = resolveOutputPath(inputPath, args.outputPath);
    const markdown = args.stdin
      ? await readMarkdownFromStdin()
      : await readMarkdownFromFile(inputPath);
    const config = configPath ? await readConfig(configPath) : {};
    const options = mergeCliOptions(config, inputPath, configPath);
    const buffer = await markdownToDocx(markdown, options);

    await writeFile(outputPath, buffer);
    process.stdout.write(`Wrote ${outputPath}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown CLI error.";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}

function parseArgs(argv: string[]): CliArguments {
  const args: CliArguments = {
    help: false,
    stdin: false,
    version: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === undefined) {
      continue;
    }

    if (arg === "-h" || arg === "--help") {
      args.help = true;
      continue;
    }

    if (arg === "-v" || arg === "--version") {
      args.version = true;
      continue;
    }

    if (arg === "--stdin") {
      args.stdin = true;
      continue;
    }

    if (arg === "-o" || arg === "--output") {
      const value = argv[index + 1];

      if (!value || value.startsWith("-")) {
        throw new MarkdownToDocError(`Missing value for ${arg}.`);
      }

      args.outputPath = value;
      index += 1;
      continue;
    }

    if (arg === "--config") {
      const value = argv[index + 1];

      if (!value || value.startsWith("-")) {
        throw new MarkdownToDocError("Missing value for --config.");
      }

      args.configPath = value;
      index += 1;
      continue;
    }

    if (arg.startsWith("-")) {
      throw new MarkdownToDocError(`Unknown option: ${arg}`);
    }

    if (args.inputPath) {
      throw new MarkdownToDocError("Only one input markdown file can be provided.");
    }

    args.inputPath = arg;
  }

  if (args.help || args.version) {
    return args;
  }

  if (args.stdin && args.inputPath) {
    throw new MarkdownToDocError("Use either an input file or --stdin, not both.");
  }

  if (!args.stdin && !args.inputPath) {
    throw new MarkdownToDocError("Provide an input markdown file or use --stdin.");
  }

  if (args.stdin && !args.outputPath) {
    throw new MarkdownToDocError("--output is required when using --stdin.");
  }

  return args;
}

async function readPackageVersion(): Promise<string> {
  const packageJsonPath = new URL("../../package.json", import.meta.url);
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as { version?: unknown };

  if (typeof packageJson.version !== "string" || packageJson.version.length === 0) {
    throw new MarkdownToDocError("Unable to determine the package version.");
  }

  return packageJson.version;
}

async function readMarkdownFromFile(inputPath: string | undefined): Promise<string> {
  if (!inputPath) {
    throw new MarkdownToDocError("Input markdown file is required.");
  }

  return readFile(inputPath, "utf8");
}

async function readMarkdownFromStdin(): Promise<string> {
  process.stdin.setEncoding("utf8");

  let markdown = "";

  for await (const chunk of process.stdin) {
    markdown += chunk;
  }

  return markdown;
}

function resolveOutputPath(inputPath: string | undefined, outputPath: string | undefined): string {
  if (outputPath) {
    return resolve(outputPath);
  }

  if (!inputPath) {
    throw new MarkdownToDocError("Unable to determine the output path.");
  }

  const extension = extname(inputPath);
  return extension.length === 0
    ? `${inputPath}.docx`
    : `${inputPath.slice(0, -extension.length)}.docx`;
}

async function readConfig(configPath: string): Promise<MarkdownToDocxOptions> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(await readFile(configPath, "utf8"));
  } catch (error) {
    throw new MarkdownToDocError(`Failed to read CLI config at ${configPath}.`, { cause: error });
  }

  if (!isRecord(parsed)) {
    throw new MarkdownToDocError("CLI config must be a JSON object.");
  }

  validateCliConfig(parsed);

  return parsed as MarkdownToDocxOptions;
}

function validateCliConfig(config: Record<string, unknown>): void {
  const assets = asRecord(config.assets);

  if (assets?.resolveImage !== undefined) {
    throw new MarkdownToDocError(
      "CLI config does not support assets.resolveImage. Use the library API for function-based image resolution.",
    );
  }

  assertSerializableImage("cover.logo", asRecord(config.cover)?.logo);
  assertSerializableImage("cover.image", asRecord(config.cover)?.image);

  const header = asRecord(config.header);
  const footer = asRecord(config.footer);

  assertSlotImage("header.left", header?.left);
  assertSlotImage("header.center", header?.center);
  assertSlotImage("header.right", header?.right);
  assertSlotImage("footer.left", footer?.left);
  assertSlotImage("footer.center", footer?.center);
  assertSlotImage("footer.right", footer?.right);
}

function assertSlotImage(label: string, slot: unknown): void {
  const slotRecord = asRecord(slot);

  if (slotRecord?.type !== "image") {
    return;
  }

  assertSerializableImage(`${label}.source`, slotRecord.source);
}

function assertSerializableImage(label: string, image: unknown): void {
  const imageRecord = asRecord(image);

  if (imageRecord?.kind === "buffer") {
    throw new MarkdownToDocError(
      `CLI config does not support ${label} with kind "buffer". Use "path" or "base64", or call the library API directly.`,
    );
  }
}

function mergeCliOptions(
  config: MarkdownToDocxOptions,
  inputPath: string | undefined,
  configPath: string | undefined,
): MarkdownToDocxOptions {
  const configDir = configPath ? dirname(configPath) : process.cwd();
  const defaultBaseDir = inputPath ? dirname(inputPath) : configDir;
  const configuredBaseDir = config.assets?.baseDir
    ? resolve(configDir, config.assets.baseDir)
    : defaultBaseDir;

  return {
    ...config,
    assets: {
      ...config.assets,
      baseDir: configuredBaseDir,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

void main();
