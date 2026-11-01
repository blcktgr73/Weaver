import { formatNotice, type Notice } from '@palab/weaver-markdown';

/**
 * An error whose text can be shown in any language: it carries a catalog notice. `message` is the
 * English text, so a plain `catch` that prints it still says something readable.
 */
export class NoticeError extends Error {
  constructor(readonly notice: Notice) {
    super(formatNotice(notice, 'en'));
  }
}

/** The notice of an error: its own when it carries one, otherwise its text as it is. */
export function errorNotice(error: unknown): Notice {
  return error instanceof NoticeError ? error.notice : { code: 'github.err.raw', args: { detail: (error as Error).message } };
}
