import * as vscode from 'vscode';
import * as path from 'path';
import { FileTreeProvider } from './fileTreeProvider';

export class FileNode extends vscode.TreeItem {
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
