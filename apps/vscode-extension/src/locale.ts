import * as vscode from 'vscode';
import { Locale, pickLocale } from '@palab/weaver-markdown';

/** The language Weaver shows: the `weaver.language` setting, or VS Code's display language on `auto`. */
export function currentLocale(): Locale {
  const setting = vscode.workspace.getConfiguration('weaver').get<string>('language');
  return pickLocale(setting, vscode.env.language);
}
