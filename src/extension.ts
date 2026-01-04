import * as vscode from 'vscode';
import { ParserService } from './parser';
import { ScpiCompletionItemProvider } from './features/completion';
import { ScpiDiagnostics } from './features/diagnostics';
import { ScpiDocumentSymbolProvider } from './features/symbols';
import { ScpiAIContext } from './ai/context';

export async function activate(context: vscode.ExtensionContext) {
    console.log('SCPI extension is now active!');

    // Initialize Parser
    await ParserService.getInstance().init(context);

    // Register Completion Provider
    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider('scpi', new ScpiCompletionItemProvider(), ':', '*')
    );

    // Register Diagnostics
    new ScpiDiagnostics(context);

    // Register Document Symbol Provider
    context.subscriptions.push(
        vscode.languages.registerDocumentSymbolProvider('scpi', new ScpiDocumentSymbolProvider())
    );

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('scpi.getAIContext', async () => {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                const context = ScpiAIContext.getContextAtCursor(editor.document, editor.selection.active);
                console.log('AI Context:', context);
                vscode.window.showInformationMessage(`Current SCPI Context: ${JSON.stringify(context, null, 2)}`);
                return context;
            }
            return null;
        })
    );
}

export function deactivate() {}
