import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
  let disposable = vscode.commands.registerCommand(
    'extension.concatenateJsFiles',
    async () => {
      try {
        const workspaceFolders = vscode.workspace.workspaceFolders;

        if (!workspaceFolders) {
          vscode.window.showErrorMessage('Nenhuma pasta aberta no workspace');
          return;
        }

        // Selecionar pastas para processar
        const folderUris = await vscode.window.showOpenDialog({
          canSelectFiles: false,
          canSelectFolders: true,
          canSelectMany: true,
          openLabel: 'Selecionar pastas para incluir',
          defaultUri: workspaceFolders[0].uri,
        });

        if (!folderUris || folderUris.length === 0) {
          vscode.window.showInformationMessage('Nenhuma pasta selecionada');
          return;
        }

        const files: string[] = [];
        const allowedExtensions = ['.js', '.ts', '.jsx', '.tsx', '.vue'];

        // Processar cada pasta selecionada
        for (const folderUri of folderUris) {
          const processDirectory = (dirPath: string) => {
            const items = fs.readdirSync(dirPath);

            for (const item of items) {
              const fullPath = path.join(dirPath, item);
              const stat = fs.statSync(fullPath);

              if (stat.isFile()) {
                const ext = path.extname(item).toLowerCase();
                if (allowedExtensions.includes(ext)) {
                  files.push(fullPath);
                }
              } else if (stat.isDirectory()) {
                processDirectory(fullPath);
              }
            }
          };

          processDirectory(folderUri.fsPath);
        }

        if (files.length === 0) {
          vscode.window.showInformationMessage(
            'Nenhum arquivo encontrado nas pastas selecionadas',
          );
          return;
        }

        // Concatenar conteúdo dos arquivos
        let allContent = '';
        const rootPath = workspaceFolders[0].uri.fsPath;

        for (const file of files) {
          const relativePath = path.relative(rootPath, file);
          const content = fs.readFileSync(file, 'utf8');

          allContent += `\n// Arquivo: ${relativePath}\n`;
          allContent += content;
          allContent += '\n\n' + '-'.repeat(80) + '\n\n';
        }

        // Criar arquivo de saída
        const outputPath = path.join(rootPath, 'concatenated-code.txt');
        fs.writeFileSync(outputPath, allContent);

        vscode.window.showInformationMessage(
          `Arquivos concatenados em: concatenated-code.txt\nTotal de arquivos: ${files.length}`,
        );
      } catch (error) {
        vscode.window.showErrorMessage(`Erro: ${error}`);
      }
    },
  );

  context.subscriptions.push(disposable);
}

export function deactivate() {}
