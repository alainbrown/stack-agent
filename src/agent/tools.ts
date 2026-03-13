import type { Tool } from '@anthropic-ai/sdk/resources/messages.js'
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages.js'
import {
  setDecision,
  type StackProgress,
  type ProgressCategory,
  type ComponentChoice,
} from './progress.js'

export interface ConversationToolResult {
  progress: StackProgress
  response: string
  signal?: 'present_plan'
}

export function conversationToolDefinitions(): Tool[] {
  return [
    {
      name: 'set_decision',
      description: 'Commits a stack decision for a given category.',
      input_schema: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            enum: ['frontend', 'backend', 'database', 'auth', 'payments', 'deployment', 'extras'],
            description: 'The stack category being decided.',
          },
          component: {
            type: 'string',
            description: 'The name of the chosen component or technology.',
          },
          reasoning: {
            type: 'string',
            description: 'Explanation for why this component was chosen.',
          },
          scaffoldTool: {
            type: 'string',
            description: 'Optional CLI scaffold tool to use (e.g. create-next-app).',
          },
          scaffoldArgs: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional arguments to pass to the scaffold tool.',
          },
        },
        required: ['category', 'component', 'reasoning'],
      },
    },
    {
      name: 'set_project_info',
      description: 'Sets the project name and description.',
      input_schema: {
        type: 'object',
        properties: {
          projectName: {
            type: 'string',
            description: 'The name of the project.',
          },
          description: {
            type: 'string',
            description: 'A short description of the project.',
          },
        },
        required: ['projectName', 'description'],
      },
    },
    {
      name: 'summarize_stage',
      description: 'Summarizes the conversation for a completed stage.',
      input_schema: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            description: 'The stage/category that was just completed.',
          },
          summary: {
            type: 'string',
            description: 'A concise summary of what was decided in this stage.',
          },
        },
        required: ['category', 'summary'],
      },
    },
    {
      name: 'present_plan',
      description: 'Signals that all decisions have been made and the plan is ready to present.',
      input_schema: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  ]
}

export function scaffoldToolDefinitions(): Tool[] {
  return [
    {
      name: 'run_scaffold',
      description: 'Runs an official scaffold CLI to bootstrap a project.',
      input_schema: {
        type: 'object',
        properties: {
          tool: {
            type: 'string',
            description: 'The scaffold CLI tool to run (e.g. create-next-app).',
          },
          args: {
            type: 'array',
            items: { type: 'string' },
            description: 'Arguments to pass to the scaffold tool.',
          },
        },
        required: ['tool', 'args'],
      },
    },
    {
      name: 'add_integration',
      description: 'Writes files, installs dependencies, and adds environment variables for an integration.',
      input_schema: {
        type: 'object',
        properties: {
          files: {
            type: 'object',
            additionalProperties: { type: 'string' },
            description: 'Map of file paths to file contents to write.',
          },
          dependencies: {
            type: 'object',
            additionalProperties: { type: 'string' },
            description: 'Map of package names to versions to install as runtime dependencies.',
          },
          devDependencies: {
            type: 'object',
            additionalProperties: { type: 'string' },
            description: 'Map of package names to versions to install as dev dependencies.',
          },
          envVars: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of environment variable names required by the integration.',
          },
        },
        required: ['files'],
      },
    },
  ]
}

export function executeConversationTool(
  name: string,
  input: Record<string, unknown>,
  progress: StackProgress,
  _messages: MessageParam[],
): ConversationToolResult {
  if (name === 'set_decision') {
    const category = input.category as ProgressCategory
    const choice: ComponentChoice = {
      component: input.component as string,
      reasoning: input.reasoning as string,
      ...(input.scaffoldTool !== undefined && { scaffoldTool: input.scaffoldTool as string }),
      ...(input.scaffoldArgs !== undefined && { scaffoldArgs: input.scaffoldArgs as string[] }),
    }
    const updatedProgress = setDecision(progress, category, choice)
    return {
      progress: updatedProgress,
      response: `Decision recorded: ${choice.component} for ${category}.`,
    }
  }

  if (name === 'set_project_info') {
    const updatedProgress: StackProgress = {
      ...progress,
      projectName: input.projectName as string,
      description: input.description as string,
    }
    return {
      progress: updatedProgress,
      response: `Project info set: "${input.projectName as string}".`,
    }
  }

  if (name === 'summarize_stage') {
    return {
      progress,
      response: input.summary as string,
    }
  }

  if (name === 'present_plan') {
    return {
      progress,
      response: 'Plan is ready to present.',
      signal: 'present_plan',
    }
  }

  return {
    progress,
    response: `Unknown tool: "${name}".`,
  }
}
