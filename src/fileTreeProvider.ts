// fileTreeProvider.ts
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { FileNode } from './fileNode';

export class FileTreeProvider
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
