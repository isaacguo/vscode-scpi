import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
    vscode.window.showInformationMessage('Start all tests.');

    test('VSCode API should be available', () => {
        assert.ok(vscode);
        assert.ok(vscode.workspace);
        assert.ok(vscode.window);
    });

    test('Extension should be able to create documents', async () => {
        const doc = await vscode.workspace.openTextDocument({
            content: '*IDN?',
            language: 'scpi'
        });
        assert.ok(doc);
        assert.strictEqual(doc.languageId, 'scpi');
    });
});

