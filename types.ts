
export interface TranscriptionEntry {
  role: 'user' | 'agent' | 'system';
  text: string;
  timestamp: Date;
}

export interface ToolExecution {
  id: string;
  name: string;
  args: any;
  status: 'executing' | 'completed' | 'error';
  result?: any;
}

export type AgentCategory = 'Recruitment' | 'Sales' | 'Housing' | 'Support' | 'Finance' | 'Retention' | 'General' | string; // Expanded categories
export type AgentVoice = 'Fenrir' | 'Kore' | 'Puck' | 'Charon' | 'Zephyr';

export interface Agent {
  id: string;
  name: string;
  category: AgentCategory;
  systemPrompt: string;
  voiceName: AgentVoice;
  avatarColor: string;
  skills: string[];
  rawConfig?: string;
}

export interface Campaign {
  id: string;
  name: string;
  assignedNumber: string;
  agentId: string;
  status: 'Aktivna' | 'Pauzirana' | 'Završena';
}

export interface Candidate {
  id: string;
  name: string;
  experience: string;
  phone: string;
  status: 'Novo' | 'Pozvano' | 'Intervjuisano' | 'Odbijeno' | 'Prihvaćeno';
  campaignId?: string;
}

export enum ConnectionStatus {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR'
}
