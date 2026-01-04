import * as vscode from 'vscode';
import { ParserService } from '../parser';

export class ScpiAIContext {
    public static getContextAtCursor(document: vscode.TextDocument, position: vscode.Position): any {
        const tree = ParserService.getInstance().getTree(document);
        if (!tree) {
            return null;
        }

        const point = { row: position.line, column: position.character };
        const node = tree.rootNode.descendantForPosition(point);

        // Walk up to find the command context
        let currentNode: any = node;
        const contextPath: string[] = [];
        
        while (currentNode) {
            if (currentNode.type === 'command_header' || currentNode.type === 'mnemonic') {
                contextPath.unshift(currentNode.text);
            }
            currentNode = currentNode.parent;
        }

        return {
            currentNodeType: node.type,
            currentNodeText: node.text,
            commandPath: contextPath.join(':'),
            position: position
        };
    }
}

