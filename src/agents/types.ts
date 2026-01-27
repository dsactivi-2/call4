
// src/agents/types.ts
/**
 * AgentRole definira moguće uloge agenata unutar supervizorskog sistema.
 */
export type AgentRole = 'supervisor' | 'planner' | 'executor' | 'coder' | 'qa' | 'designer';

/**
 * Agent interfejs za agente kojima upravlja SupervisorAgent.
 */
export interface Agent {
  role: AgentRole;
  model: string;
  status: 'idle' | 'busy';
  execute: (input: any) => Promise<any>;
}
