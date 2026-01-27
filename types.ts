
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

export interface Agent {
  id: string;
  name: string;
  category: 'Recruitment' | 'Sales' | 'Housing' | 'Support' | 'Finance' | 'Retention' | string; // Expanded categories
  systemPrompt: string;
  voiceName: 'Fenrir' | 'Kore' | 'Puck' | 'Charon' | 'Zephyr';
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
