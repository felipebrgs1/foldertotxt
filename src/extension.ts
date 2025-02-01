// extension.ts
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { FileTreeProvider } from './fileTreeProvider';
import { FileNode } from './fileNode';

export function activate(context: vscode.ExtensionContext) {
  if (
    !vscode.workspace.workspaceFolders ||
    vscode.workspace.workspaceFolders.length === 0
  ) {
    vscode.window.showErrorMessage(
      'Abra uma pasta no workspace para usar esta extensão.',
    );
    return;
  }

  const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
  const fileTreeProvider = new FileTreeProvider(workspaceRoot);

  const treeView = vscode.window.createTreeView('fileTreeView', {
    treeDataProvider: fileTreeProvider,
    showCollapseAll: true,
  });

  const toggleSelectionCommand = vscode.commands.registerCommand(
    'extension.toggleSelection',
    (node: FileNode) => {
      node.toggle(fileTreeProvider);
    },
  );

  const concatenateCommand = vscode.commands.registerCommand(
    'extension.concatenateSelectedFiles',
    async () => {
      try {
        const selectedUris = fileTreeProvider.getSelectedFiles();

        if (selectedUris.length === 0) {
          vscode.window.showInformationMessage(
            'Nenhum arquivo foi selecionado.',
          );
          return;
        }

        const defaultUri = vscode.Uri.file(
          path.join(workspaceRoot, 'concatenated-code.txt'),
        );
        const saveUri = await vscode.window.showSaveDialog({
          defaultUri: defaultUri,
          filters: {
            'Text files': ['txt'],
            'All files': ['*'],
          },
        });

        if (!saveUri) {
          return;
        }

        let allContent = '';
        for (const uri of selectedUris) {
          const relativePath = path.relative(workspaceRoot, uri.fsPath);
          const content = fs.readFileSync(uri.fsPath, 'utf8');
          allContent += `\n// Arquivo: ${relativePath}\n`;
          allContent += content;
          allContent += '\n\n' + '-'.repeat(80) + '\n\n';
        }

        fs.writeFileSync(saveUri.fsPath, allContent);

        vscode.window.showInformationMessage(
          `Arquivos concatenados com sucesso!\nTotal de arquivos: ${selectedUris.length}`,
        );

        const document = await vscode.workspace.openTextDocument(saveUri);
        await vscode.window.showTextDocument(document);
      } catch (error) {
        vscode.window.showErrorMessage(`Erro ao concatenar arquivos: ${error}`);
      }
    },
  );

  context.subscriptions.push(toggleSelectionCommand);
  context.subscriptions.push(concatenateCommand);
  context.subscriptions.push(treeView);
}

export function deactivate() {}
