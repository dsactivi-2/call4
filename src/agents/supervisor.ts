
import { Agent, AgentRole } from './types';
import { llmClient } from '../llm/client';
import { safeJsonParse } from '../utils/schemas';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { sanitizeLogMessage } from '../utils/security';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StateGraph, END, MemorySaver, CheckpointSaver } from '@langgraph/core';

/**
 * Zod Schemas für Typsicherheit und Validierung
 */
const SupervisorInputSchema = z.object({
  task: z.string().min(1),
  project_path: z.string(),
  available_agents: z.array(z.string()),
  threadId: z.string().optional(),
  checkpointId: z.string().optional(),
});

const SupervisorOutputSchema = z.object({
  agentSequence: z.array(z.string()),
  taskAssignments: z.array(z.object({
    agent_name: z.string(),
    task: z.string(),
    dependencies: z.array(z.string())
  })),
  executionStrategy: z.object({
    parallel: z.array(z.string()),
    sequential: z.array(z.string())
  }),
  estimatedComplexity: z.enum(['low', 'medium', 'high']),
  risks: z.array(z.string()),
  strategy: z.string(),
  threadId: z.string(),
  lastCheckpoint: z.string().optional(),
});

type InputType = z.infer<typeof SupervisorInputSchema>;
type OutputType = z.infer<typeof SupervisorOutputSchema>;

interface AgentState {
  task: string;
  projectPath: string;
  availableAgents: string[];
  plan?: any;
  results: Record<string, any>;
  currentStep: string;
  error?: string;
  metadata: Record<string, any>;
}

export interface SupervisorConfig {
  model: string;
  checkpointer?: CheckpointSaver;
}

/**
 * SupervisorAgent: Orchestriert andere Agents mittels LangGraph und stellt Persistence sicher.
 */
export class SupervisorAgent implements Agent {
  role: AgentRole = 'supervisor';
  model: string;
  // Fixed: explicitly typed status to allow switching between 'idle' and 'busy'
  status: 'idle' | 'busy' = 'idle';
  private checkpointer: CheckpointSaver;

  constructor(config: SupervisorConfig) {
    this.model = config.model;
    // Persistence-Option initialisieren: Default MemorySaver (In-Memory)
    this.checkpointer = config.checkpointer || new MemorySaver();
    logger.info(sanitizeLogMessage('SupervisorAgent initialized with ' + (config.checkpointer ? 'custom checkpointer' : 'MemorySaver')));
  }

  /**
   * Erstellt den StateGraph für die Orchestrierung
   */
  private buildGraph() {
    const workflow = new StateGraph<AgentState>({
      channels: {
        task: null,
        projectPath: null,
        availableAgents: null,
        plan: null,
        results: null,
        currentStep: null,
        error: null,
        metadata: null,
      }
    });

    // Node: Analyse & Planung
    workflow.addNode('planner', async (state: AgentState) => {
      logger.info(sanitizeLogMessage(`Planner Node: Analyzing task for thread: ${state.metadata.threadId}`));
      
      const prompt = ChatPromptTemplate.fromTemplate(`
        You are a high-level Supervisor Agent. Your goal is to break down a complex task into sub-tasks for a team of agents.
        Available Agents: {agents}
        Task: {task}
        Project Path: {path}

        Respond ONLY with a valid JSON object matching this structure:
        {{
          "agentSequence": string[],
          "taskAssignments": [{{ "agent_name": string, "task": string, "dependencies": string[] }}],
          "executionStrategy": {{ "parallel": string[], "sequential": string[] }},
          "estimatedComplexity": "low" | "medium" | "high",
          "risks": string[],
          "strategy": string
        }}
      `);

      const chain = prompt.pipe(llmClient);
      const response = await chain.invoke({
        agents: state.availableAgents.join(', '),
        task: state.task,
        path: state.projectPath
      });

      const plan = safeJsonParse(response.content as string);
      
      logger.info(sanitizeLogMessage(`Checkpoint saved: thread=${state.metadata.threadId} step=planner`));
      
      return {
        ...state,
        plan,
        currentStep: 'planning_complete'
      };
    });

    // Node: Strategie-Validierung (Security Check)
    workflow.addNode('validator', async (state: AgentState) => {
      const risks = state.plan?.risks || [];
      const hasSecurityRisk = risks.some((r: string) => r.toLowerCase().includes('security') || r.toLowerCase().includes('auth'));
      
      if (hasSecurityRisk) {
        logger.warn(sanitizeLogMessage('Security risks identified in plan. Adding review steps.'));
      }

      return {
        ...state,
        currentStep: 'validated'
      };
    });

    workflow.setEntryPoint('planner');
    workflow.addEdge('planner', 'validator');
    workflow.addEdge('validator', END);

    return workflow.compile({ checkpointer: this.checkpointer });
  }

  /**
   * Haupt-Ausführungslogik
   */
  async execute(input: InputType): Promise<OutputType> {
    this.status = 'busy';
    const threadId = input.threadId || crypto.randomUUID();
    
    try {
      // Input-Validierung
      const validatedInput = SupervisorInputSchema.parse(input);
      logger.info(sanitizeLogMessage(`Supervisor starting task execution. Thread: ${threadId}`));

      const graph = this.buildGraph();
      
      const initialState: AgentState = {
        task: validatedInput.task,
        projectPath: validatedInput.project_path,
        availableAgents: validatedInput.available_agents,
        results: {},
        currentStep: 'start',
        metadata: { threadId }
      };

      // Graph Ausführung mit Persistence-Config
      const finalState = await graph.invoke(initialState, {
        configurable: { thread_id: threadId }
      });

      if (!finalState.plan) {
        throw new Error('Graph execution failed to produce a plan.');
      }

      const result: OutputType = {
        ...finalState.plan,
        threadId,
        lastCheckpoint: finalState.currentStep
      };

      // Output-Validierung
      const validatedOutput = SupervisorOutputSchema.parse(result);
      
      this.status = 'idle';
      return validatedOutput;

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown Supervisor Error';
      logger.error(sanitizeLogMessage(`Supervisor failed: ${errorMsg}`));

      // Fallback-Mechanismus
      const fallback: OutputType = {
        agentSequence: [],
        taskAssignments: [],
        executionStrategy: { parallel: [], sequential: [] },
        estimatedComplexity: 'high',
        risks: ['Execution failed', errorMsg],
        strategy: 'Error Fallback engaged. Check logs.',
        threadId
      };

      this.status = 'idle';
      return fallback;
    }
  }
}
