"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * Classe que representa um nó (arquivo ou pasta) na árvore.
 */
class FileNode extends vscode.TreeItem {
    uri;
    children;
    isSelected = false;
    constructor(uri, children) {
        // Se tiver filhos, é uma pasta (colapsável), caso contrário, é um arquivo (item final).
        super(path.basename(uri.fsPath), children && children.length > 0
            ? vscode.TreeItemCollapsibleState.Collapsed
            : vscode.TreeItemCollapsibleState.None);
        this.uri = uri;
        this.children = children;
        this.resourceUri = uri;
        // Se for arquivo (não tem filhos), associa um comando para alternar a seleção.
        if (!children) {
            this.command = {
                command: 'extension.toggleSelection',
                title: 'Toggle Selection',
                arguments: [this],
            };
        }
        this.updateIcon();
    }
    toggle() {
        this.isSelected = !this.isSelected;
        this.updateIcon();
    }
    updateIcon() {
        // Ícone: se selecionado, mostra "check", caso contrário, "circle-outline"
        this.iconPath = new vscode.ThemeIcon(this.isSelected ? 'check' : 'circle-outline');
    }
}
/**
 * Provedor de dados para a TreeView.
 */
class FileTreeProvider {
    workspaceRoot;
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    // Lista raiz de nós (pasta raiz do workspace)
    rootNodes = [];
    // Extensões permitidas
    allowedExtensions = ['.js', '.ts', '.jsx', '.tsx', '.vue'];
    constructor(workspaceRoot) {
        this.workspaceRoot = workspaceRoot;
        this.rootNodes = this.buildFileTree(this.workspaceRoot);
    }
    refresh() {
        this.rootNodes = this.buildFileTree(this.workspaceRoot);
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        // Atualiza o ícone de acordo com o estado de seleção
        element.updateIcon();
        return element;
    }
    getChildren(element) {
        if (!this.workspaceRoot) {
            vscode.window.showInformationMessage('Nenhum workspace aberto');
            return Promise.resolve([]);
        }
        if (element) {
            return Promise.resolve(element.children || []);
        }
        else {
            return Promise.resolve(this.rootNodes);
        }
    }
    /**
     * Cria recursivamente a árvore de arquivos (apenas arquivos com extensões permitidas).
     */
    buildFileTree(dir) {
        const nodes = [];
        let items = [];
        try {
            items = fs.readdirSync(dir);
        }
        catch (err) {
            return nodes;
        }
        for (const item of items) {
            const fullPath = path.join(dir, item);
            let stat;
            try {
                stat = fs.statSync(fullPath);
            }
            catch (err) {
                continue;
            }
            if (stat.isDirectory()) {
                const children = this.buildFileTree(fullPath);
                // Inclui a pasta mesmo que não tenha arquivos permitidos (pode conter subpastas com arquivos válidos)
                nodes.push(new FileNode(vscode.Uri.file(fullPath), children));
            }
            else if (stat.isFile()) {
                const ext = path.extname(item).toLowerCase();
                if (this.allowedExtensions.includes(ext)) {
                    nodes.push(new FileNode(vscode.Uri.file(fullPath)));
                }
            }
        }
        return nodes;
    }
    /**
     * Percorre a árvore e retorna os URIs dos arquivos selecionados.
     */
    getSelectedFiles() {
        const result = [];
        const traverse = (nodes) => {
            for (const node of nodes) {
                // Se for arquivo e estiver selecionado
                if (!node.children && node.isSelected) {
                    result.push(node.uri);
                }
                if (node.children) {
                    traverse(node.children);
                }
            }
        };
        traverse(this.rootNodes);
        return result;
    }
}
/**
 * Função de ativação da extensão.
 */
function activate(context) {
    if (!vscode.workspace.workspaceFolders ||
        vscode.workspace.workspaceFolders.length === 0) {
        vscode.window.showErrorMessage('Abra uma pasta no workspace para usar esta extensão.');
        return;
    }
    const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const fileTreeProvider = new FileTreeProvider(workspaceRoot);
    // Registra a view na sidebar (você pode configurar a localização no package.json)
    const treeView = vscode.window.createTreeView('fileTreeView', {
        treeDataProvider: fileTreeProvider,
        showCollapseAll: true,
    });
    // Comando para alternar a seleção de um arquivo
    const toggleSelectionCommand = vscode.commands.registerCommand('extension.toggleSelection', (node) => {
        node.toggle();
        fileTreeProvider.refresh();
    });
    // Comando para concatenar os arquivos selecionados
    const concatenateCommand = vscode.commands.registerCommand('extension.concatenateSelectedFiles', () => {
        try {
            const selectedUris = fileTreeProvider.getSelectedFiles();
            if (selectedUris.length === 0) {
                vscode.window.showInformationMessage('Nenhum arquivo foi selecionado.');
                return;
            }
            let allContent = '';
            // Para cada arquivo selecionado, lê o conteúdo e adiciona um cabeçalho com o caminho relativo.
            for (const uri of selectedUris) {
                const relativePath = path.relative(workspaceRoot, uri.fsPath);
                const content = fs.readFileSync(uri.fsPath, 'utf8');
                allContent += `\n// Arquivo: ${relativePath}\n`;
                allContent += content;
                allContent += '\n\n' + '-'.repeat(80) + '\n\n';
            }
            // Cria o arquivo de saída na raiz do workspace
            const outputPath = path.join(workspaceRoot, 'concatenated-code.txt');
            fs.writeFileSync(outputPath, allContent);
            vscode.window.showInformationMessage(`Arquivos concatenados em: concatenated-code.txt\nTotal de arquivos: ${selectedUris.length}`);
        }
        catch (error) {
            vscode.window.showErrorMessage(`Erro ao concatenar arquivos: ${error}`);
        }
    });
    // Adiciona os comandos à subscrição
    context.subscriptions.push(toggleSelectionCommand);
    context.subscriptions.push(concatenateCommand);
    context.subscriptions.push(treeView);
}
/**
 * Função de desativação da extensão.
 */
function deactivate() { }
//# sourceMappingURL=extension.js.map