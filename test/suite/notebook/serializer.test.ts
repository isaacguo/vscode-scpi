import * as assert from 'assert';
import * as vscode from 'vscode';
import { ScpiNotebookSerializer } from '../../../src/notebook/serializer';
import { TextEncoder } from 'util';

suite('Notebook Serializer Test Suite', () => {
    test('Deserialize empty/text file', async () => {
        const serializer = new ScpiNotebookSerializer();
        const content = new Uint8Array([]);
        const token = new vscode.CancellationTokenSource().token;
        
        const notebookData = await serializer.deserializeNotebook(content, token);
        // Should create 1 cell for non-JSON content (legacy support)
        assert.strictEqual(notebookData.cells.length, 1);
        assert.strictEqual(notebookData.cells[0].value, '');
        assert.strictEqual(notebookData.cells[0].languageId, 'scpi');
    });

    test('Deserialize text content as cell', async () => {
        const serializer = new ScpiNotebookSerializer();
        const text = "*IDN?";
        const content = new TextEncoder().encode(text);
        const token = new vscode.CancellationTokenSource().token;
        
        const notebookData = await serializer.deserializeNotebook(content, token);
        assert.strictEqual(notebookData.cells.length, 1);
        assert.strictEqual(notebookData.cells[0].value, '*IDN?');
    });

    test('Serialize and Deserialize round trip', async () => {
        const serializer = new ScpiNotebookSerializer();
        const cells = [
            new vscode.NotebookCellData(vscode.NotebookCellKind.Code, '*IDN?', 'scpi'),
            new vscode.NotebookCellData(vscode.NotebookCellKind.Markup, '# Test Cell', 'markdown')
        ];
        const metadata = { custom: { connection: 'test' } };
        const notebookData = new vscode.NotebookData(cells);
        notebookData.metadata = metadata;

        const token = new vscode.CancellationTokenSource().token;
        const bytes = await serializer.serializeNotebook(notebookData, token);
        
        const deserialized = await serializer.deserializeNotebook(bytes, token);
        
        assert.strictEqual(deserialized.cells.length, 2);
        assert.strictEqual(deserialized.cells[0].value, '*IDN?');
        assert.strictEqual(deserialized.cells[0].kind, vscode.NotebookCellKind.Code);
        assert.strictEqual(deserialized.cells[1].value, '# Test Cell');
        assert.strictEqual(deserialized.cells[1].kind, vscode.NotebookCellKind.Markup);
        // Compare metadata excluding undefined properties if any
        assert.deepStrictEqual(deserialized.metadata, metadata);
    });
});
