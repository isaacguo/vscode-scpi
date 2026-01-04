import * as vscode from 'vscode';
import { ParserService } from '../parser';
import { COMMON_COMMANDS, ROOT_COMMANDS, ScpiCommand } from '../scpi';

export class ScpiCompletionItemProvider implements vscode.CompletionItemProvider {
    public provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position
    ): vscode.ProviderResult<vscode.CompletionItem[]> {
        const tree = ParserService.getInstance().getTree(document);
        if (!tree) {
            return [];
        }

        const items: vscode.CompletionItem[] = [];

        // Always suggest Common Commands if starting with *
        // Or if generic context
        
        const linePrefix = document.lineAt(position).text.substr(0, position.character);
        
        if (linePrefix.endsWith('*')) {
            // Suggest *IDN, *RST, etc.
            for (const key in COMMON_COMMANDS) {
                const cmd = COMMON_COMMANDS[key];
                const item = new vscode.CompletionItem(cmd.name, vscode.CompletionItemKind.Keyword);
                item.detail = cmd.description;
                // remove the * from insert text as it is already typed
                item.insertText = cmd.name.substring(1); 
                items.push(item);
            }
            return items;
        }

        // Handle : separated commands
        // If we are in a command header, we need to find the parent chain
        // Simplistic approach: split by : and traverse data
        
        // This is where AST traversal is better but regex is easier for partial matches
        // Let's use AST for context if possible.
        
        // If node type is 'mnemonic' or 'command_header', we can see siblings/parents.
        
        // Suggest Root commands
        if (linePrefix.trim() === '' || linePrefix.endsWith(';') || linePrefix.endsWith(':')) {
            // If ends with :, we might be inside a path
            // For now, let's suggest root commands if we can't determine context
             for (const key in ROOT_COMMANDS) {
                const cmd = ROOT_COMMANDS[key];
                const label = cmd.name;
                const item = new vscode.CompletionItem(label, vscode.CompletionItemKind.Module);
                item.detail = cmd.description;
                // If typed :, don't insert : again
                if (linePrefix.endsWith(':')) {
                    item.insertText = label.startsWith(':') ? label.substring(1) : label;
                }
                items.push(item);
            }
        }
        
        // Subsystem navigation
        // If we typed :MEASure:, we want VOLTage, etc.
        // We can parse the current line up to cursor to find the path.
        const currentCommandMatch = linePrefix.match(/(:[a-zA-Z0-9_]+)+:?$/);
        if (currentCommandMatch) {
            const pathParts = currentCommandMatch[0].split(':').filter(p => p.length > 0);
            
            let currentLevel = ROOT_COMMANDS;
            let targetCmd: ScpiCommand | undefined;
            
            // Traverse down
            // The last part might be partial
            const isPartial = !linePrefix.endsWith(':');
            const traversalParts = isPartial ? pathParts.slice(0, -1) : pathParts;

            for (const part of traversalParts) {
                const key = ':' + part; // Assuming keys in data have :
                // Find matching key (SCPI is case insensitive and short/long form)
                // Using strict match for now or startsWith
                 const foundKey = Object.keys(currentLevel).find(k => k.toUpperCase() === key.toUpperCase() || k.toUpperCase().startsWith(key.toUpperCase())); // Simplified
                 if (foundKey) {
                     targetCmd = currentLevel[foundKey];
                     if (targetCmd.children) {
                         currentLevel = targetCmd.children;
                     } else {
                         currentLevel = {};
                     }
                 } else {
                     currentLevel = {};
                 }
            }

            if (Object.keys(currentLevel).length > 0) {
                 for (const key in currentLevel) {
                    const cmd = currentLevel[key];
                    const item = new vscode.CompletionItem(cmd.name, vscode.CompletionItemKind.Function);
                    item.detail = cmd.description;
                    if (linePrefix.endsWith(':')) {
                        item.insertText = cmd.name.startsWith(':') ? cmd.name.substring(1) : cmd.name;
                    }
                    items.push(item);
                }
            }
        }

        return items;
    }
}

