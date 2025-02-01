import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

class FileNode extends vscode.TreeItem {
  public children: FileNode[] | undefined;
  public isSelected: boolean = false;
  public parent: FileNode | undefined;

  constructor(
    public readonly uri: vscode.Uri,
    parent?: FileNode,
    children?: FileNode[],
  ) {
    super(
      FileNode.getLabel(uri, false),
      children === undefined
        ? vscode.TreeItemCollapsibleState.None
        : vscode.TreeItemCollapsibleState.Expanded,
    );

    this.children = children;
    this.parent = parent;
    this.resourceUri = uri;

    this.command = {
      command: 'extension.toggleSelection',
      title: 'Toggle Selection',
      arguments: [this],
    };

    this.updateAppearance();
  }

  private static getLabel(uri: vscode.Uri, isSelected: boolean): string {
    const prefix = isSelected ? '[x] ' : '[ ] ';
    return prefix + path.basename(uri.fsPath);
  }

  public toggle(provider: FileTreeProvider): void {
    this.isSelected = !this.isSelected;

    if (this.children) {
      this.propagateSelectionToChildren(this.isSelected);
    }

    this.updateParentSelection();
    this.updateAppearance();
    provider.refresh(this);
  }

  private propagateSelectionToChildren(selected: boolean): void {
    if (this.children) {
      for (const child of this.children) {
        child.isSelected = selected;
        child.updateAppearance();
        if (child.children) {
          child.propagateSelectionToChildren(selected);
        }
      }
    }
  }

  private updateParentSelection(): void {
    if (this.parent) {
      const allChildren = this.parent.children || [];
      const allSelected = allChildren.every((child) => child.isSelected);
      const anySelected = allChildren.some((child) => child.isSelected);

      if (allSelected) {
        this.parent.isSelected = true;
      } else if (!anySelected) {
        this.parent.isSelected = false;
      }

      this.parent.updateAppearance();
      this.parent.updateParentSelection();
    }
  }

  public updateAppearance(): void {
    this.label = FileNode.getLabel(this.uri, this.isSelected);
    if (this.children) {
      this.iconPath = new vscode.ThemeIcon('folder');
      this.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
    } else {
      this.iconPath = new vscode.ThemeIcon('file');
    }
  }
}

class FileTreeProvider
  implements vscode.TreeDataProvider<FileNode | vscode.TreeItem>
{
  private _onDidChangeTreeData: vscode.EventEmitter<
    FileNode | undefined | void
  > = new vscode.EventEmitter<FileNode | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<FileNode | undefined | void> =
    this._onDidChangeTreeData.event;

  private rootNodes: FileNode[] = [];
  private allowedExtensions = ['.js', '.ts', '.jsx', '.tsx', '.vue'];
  private footerNode: vscode.TreeItem;

  constructor(private workspaceRoot: string) {
    this.rootNodes = this.buildFileTree(this.workspaceRoot);
    this.footerNode = this.createFooterButton();
  }

  private createFooterButton(): vscode.TreeItem {
    const button = new vscode.TreeItem('Concatenar Arquivos Selecionados');
    button.command = {
      command: 'extension.concatenateSelectedFiles',
      title: 'Concatenar',
    };
    button.iconPath = new vscode.ThemeIcon(
      'zap',
      new vscode.ThemeColor('myExtension.buttonGreen'),
    );

    return button;
  }

  public refresh(node?: FileNode): void {
    this._onDidChangeTreeData.fire(node);
  }

  getTreeItem(element: FileNode | vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: FileNode): Thenable<FileNode[] | vscode.TreeItem[]> {
    if (!this.workspaceRoot) {
      vscode.window.showInformationMessage('Nenhum workspace aberto');
      return Promise.resolve([]);
    }

    if (element) {
      return Promise.resolve(element.children || []);
    } else {
      return Promise.resolve([...this.rootNodes, this.footerNode]);
    }
  }

  private buildFileTree(dir: string, parent?: FileNode): FileNode[] {
    const nodes: FileNode[] = [];
    let items: string[] = [];

    try {
      items = fs.readdirSync(dir);
    } catch (err) {
      return nodes;
    }

    for (const item of items) {
      const fullPath = path.join(dir, item);
      let stat: fs.Stats;

      try {
        stat = fs.statSync(fullPath);
      } catch (err) {
        continue;
      }

      if (stat.isDirectory()) {
        const nodeUri = vscode.Uri.file(fullPath);
        const parentNode = new FileNode(nodeUri, parent);
        const children = this.buildFileTree(fullPath, parentNode);

        if (children.length > 0) {
          parentNode.children = children;
          nodes.push(parentNode);
        }
      } else if (stat.isFile()) {
        const ext = path.extname(item).toLowerCase();
        if (this.allowedExtensions.includes(ext)) {
          nodes.push(new FileNode(vscode.Uri.file(fullPath), parent));
        }
      }
    }

    return nodes.sort((a, b) => {
      const aIsDir = !!a.children;
      const bIsDir = !!b.children;
      if (aIsDir && !bIsDir) {
        return -1;
      }
      if (!aIsDir && bIsDir) {
        return 1;
      }
      return path
        .basename(a.uri.fsPath)
        .localeCompare(path.basename(b.uri.fsPath));
    });
  }

  public getSelectedFiles(): vscode.Uri[] {
    const result: vscode.Uri[] = [];

    const traverse = (node: FileNode) => {
      if (node.isSelected) {
        if (!node.children) {
          result.push(node.uri);
        } else {
          node.children.forEach((child) => traverse(child));
        }
      } else if (node.children) {
        node.children.forEach((child) => traverse(child));
      }
    };

    this.rootNodes.forEach((node) => traverse(node));
    return result;
  }
}

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
