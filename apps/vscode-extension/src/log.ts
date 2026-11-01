import * as vscode from 'vscode';

let channel: vscode.OutputChannel | undefined;

/** One line in the "Weaver" output channel, to see what the Overview did when it seems not to respond. */
export function log(line: string): void {
  channel ??= vscode.window.createOutputChannel('Weaver');
  channel.appendLine(`${new Date().toISOString().slice(11, 23)} ${line}`);
}
