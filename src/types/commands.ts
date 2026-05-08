export type DocCommand = 'generate' | 'update' | 'audit' | 'endpoint' | 'auth';

export interface CommandContext {
  command: DocCommand;
  extraInstructions?: string;
}
