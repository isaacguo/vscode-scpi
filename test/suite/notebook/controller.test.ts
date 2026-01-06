import * as assert from 'assert';
import * as vscode from 'vscode';
import { ScpiNotebookController } from '../../../src/notebook/controller';

suite('Notebook Controller Test Suite', () => {
    test('Controller instantiation', () => {
        const mockContext = {
            extensionPath: '/mock/path',
            subscriptions: []
        } as unknown as vscode.ExtensionContext;

        const controller = new ScpiNotebookController(mockContext);
        assert.ok(controller);
        assert.strictEqual(controller.controllerId, 'scpi-visa-controller');
        assert.strictEqual(controller.notebookType, 'scpi-notebook');
        
        controller.dispose();
    });
});

