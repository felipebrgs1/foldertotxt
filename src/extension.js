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
function activate(context) {
    let disposable = vscode.commands.registerCommand('extension.listJsFiles', async () => {
        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                vscode.window.showErrorMessage('Nenhuma pasta aberta no workspace');
                return;
            }
            const rootPath = workspaceFolders[0].uri.fsPath;
            const files = [];
            // Função recursiva para buscar arquivos
            const findFiles = (dirPath) => {
                const items = fs.readdirSync(dirPath);
                for (const item of items) {
                    const fullPath = path.join(dirPath, item);
                    const stat = fs.statSync(fullPath);
                    if (stat.isDirectory()) {
                        // Ignora node_modules e .git
                        if (item !== 'node_modules' && item !== '.git') {
                            findFiles(fullPath);
                        }
                    }
                    else if (stat.isFile()) {
                        // Verifica as extensões
                        const ext = path.extname(item);
                        if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
                            files.push(fullPath);
                        }
                    }
                }
            };
            findFiles(rootPath);
            // Cria o arquivo de saída
            const outputPath = path.join(rootPath, 'javascript-files.txt');
            const content = files
                .map((file) => path.relative(rootPath, file))
                .join('\n');
            fs.writeFileSync(outputPath, content);
            vscode.window.showInformationMessage(`Lista de arquivos criada em: javascript-files.txt\nTotal de arquivos: ${files.length}`);
        }
        catch (error) {
            vscode.window.showErrorMessage(`Erro: ${error}`);
        }
    });
    context.subscriptions.push(disposable);
}
function deactivate() { }
//# sourceMappingURL=extension.js.map