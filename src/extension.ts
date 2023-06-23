import * as vscode from 'vscode';
import { Wizard } from "./wizard";

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json

	let disposable = vscode.commands.registerCommand('palette-extension.createCluster', () => {
		vscode.window.showInformationMessage('Welcone to Palette Virtual Cluster Creation Wizard!');
		Wizard.render();
	});

	context.subscriptions.push(disposable);
}

export function deactivate() {}
