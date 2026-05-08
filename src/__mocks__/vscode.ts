// Minimal vscode mock for Jest tests.
// Only stub what the scanners and renderers actually use.

const vscode = {
  workspace: {
    fs: {
      readFile: jest.fn(),
      writeFile: jest.fn(),
      createDirectory: jest.fn(),
      stat: jest.fn(),
    },
    findFiles: jest.fn(),
    workspaceFolders: undefined as unknown,
  },
  Uri: {
    file: (path: string) => ({ fsPath: path, scheme: 'file', path }),
    joinPath: (base: { fsPath: string }, ...parts: string[]) => ({
      fsPath: [base.fsPath, ...parts].join('/'),
      scheme: 'file',
      path: [base.fsPath, ...parts].join('/'),
    }),
  },
  FileSystemError: class FileSystemError extends Error {},
  window: {
    showErrorMessage: jest.fn(),
    showInformationMessage: jest.fn(),
  },
  lm: {
    selectChatModels: jest.fn(),
  },
  LanguageModelChatMessage: {
    User: (content: string) => ({ role: 'user', content }),
  },
  chat: {
    createChatParticipant: jest.fn(),
  },
  ThemeIcon: class ThemeIcon {
    constructor(public id: string) {}
  },
  CancellationTokenSource: class {
    token = { isCancellationRequested: false };
    cancel() {}
    dispose() {}
  },
};

module.exports = vscode;
