import * as vscode from 'vscode';
import { TextDecoder, TextEncoder } from 'util';

interface RawNotebookCell {
    kind: vscode.NotebookCellKind;
    value: string;
    languageId: string;
}

interface RawNotebook {
    cells: RawNotebookCell[];
    metadata?: { [key: string]: unknown };
}

export class ScpiNotebookSerializer implements vscode.NotebookSerializer {
    async deserializeNotebook(
        content: Uint8Array,
        _token: vscode.CancellationToken
    ): Promise<vscode.NotebookData> {
        const contents = new TextDecoder().decode(content);

        let raw: RawNotebook;
        try {
            raw = JSON.parse(contents) as RawNotebook;
        } catch {
            // If parsing fails, assume it's a legacy text SCPI file
            // Create a single cell with the content
            raw = { 
                cells: [
                    {
                        kind: vscode.NotebookCellKind.Code,
                        value: contents,
                        languageId: 'scpi'
                    }
                ]
            };
        }

        const cells = raw.cells ? raw.cells.map(
            item => new vscode.NotebookCellData(item.kind, item.value, item.languageId)
        ) : [];

        const data = new vscode.NotebookData(cells);
        if (raw.metadata) {
            data.metadata = raw.metadata;
        }
        return data;
    }

    async serializeNotebook(
        data: vscode.NotebookData,
        _token: vscode.CancellationToken
    ): Promise<Uint8Array> {
        const contents: RawNotebook = {
            cells: data.cells.map(cell => ({
                kind: cell.kind,
                value: cell.value,
                languageId: cell.languageId
            })),
            metadata: data.metadata
        };

        return new TextEncoder().encode(JSON.stringify(contents, null, 2));
    }
}

