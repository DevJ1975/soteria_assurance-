/** Test double for `@anthropic-ai/sdk` (default export `Anthropic`). */

export interface TextBlock {
  type: 'text';
  text: string;
}

interface MessageResponse {
  model: string;
  content: TextBlock[];
  usage: { input_tokens: number; output_tokens: number };
}

let createImpl: () => Promise<MessageResponse> = async () => ({
  model: 'claude-sonnet-4-6',
  content: [{ type: 'text', text: '' }],
  usage: { input_tokens: 0, output_tokens: 0 },
});

/** Test helper: control what `messages.create` resolves to (or rejects with). */
export function __setCreate(impl: () => Promise<MessageResponse>): void {
  createImpl = impl;
}

export default class Anthropic {
  public messages: { create: (...args: unknown[]) => Promise<MessageResponse> };
  public constructor(_opts: unknown) {
    this.messages = { create: () => createImpl() };
  }
}
