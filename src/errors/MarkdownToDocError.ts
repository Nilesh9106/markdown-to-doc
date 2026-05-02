export class MarkdownToDocError extends Error {
  readonly status: number | undefined;

  constructor(message: string, options?: { status?: number | undefined; cause?: unknown }) {
    super(message);
    this.name = "MarkdownToDocError";
    this.status = options?.status;

    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}
