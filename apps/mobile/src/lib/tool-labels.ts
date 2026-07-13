/** User-facing language for agent tool calls — never show tool internals. */

interface ToolCopy {
  running: string;
  done: string;
  failed: string;
  symbol: string;
  /** Set when the activity belongs to a power-up; the UI styles it distinctly. */
  powerup?: string;
}

/** Display names for power-up specialists, keyed by subagent name. */
const POWERUP_AGENTS: Record<string, string> = {
  web3: 'Web3',
  'google-health': 'Google Health',
};

const TOOL_COPY: Record<string, ToolCopy> = {
  get_goals: {
    running: 'Checking your goals…',
    done: 'Checked your goals',
    failed: 'Couldn\u2019t read your goals',
    symbol: 'scope',
  },
  create_goal: {
    running: 'Creating your goal…',
    done: 'Created your goal',
    failed: 'Couldn\u2019t create the goal',
    symbol: 'plus.circle',
  },
  update_goal: {
    running: 'Updating your goal…',
    done: 'Updated your goal',
    failed: 'Couldn\u2019t update the goal',
    symbol: 'pencil',
  },
  delete_goal: {
    running: 'Deleting the goal…',
    done: 'Deleted the goal',
    failed: 'Couldn\u2019t delete the goal',
    symbol: 'trash',
  },
  create_project: {
    running: 'Creating the project…',
    done: 'Created the project',
    failed: 'Couldn\u2019t create the project',
    symbol: 'plus.circle',
  },
  update_project: {
    running: 'Renaming the project…',
    done: 'Renamed the project',
    failed: 'Couldn\u2019t rename the project',
    symbol: 'pencil',
  },
  delete_project: {
    running: 'Deleting the project…',
    done: 'Deleted the project',
    failed: 'Couldn\u2019t delete the project',
    symbol: 'trash',
  },
  list_tasks: {
    running: 'Looking through your tasks…',
    done: 'Looked through your tasks',
    failed: 'Couldn\u2019t read your tasks',
    symbol: 'checklist',
  },
  create_task: {
    running: 'Adding your task…',
    done: 'Added your task',
    failed: 'Couldn\u2019t add the task',
    symbol: 'plus.circle',
  },
  complete_task: {
    running: 'Marking it done…',
    done: 'Marked it done',
    failed: 'Couldn\u2019t complete the task',
    symbol: 'checkmark.circle',
  },
  update_task: {
    running: 'Updating the task…',
    done: 'Updated the task',
    failed: 'Couldn\u2019t update the task',
    symbol: 'pencil',
  },
  delete_task: {
    running: 'Deleting the task…',
    done: 'Deleted the task',
    failed: 'Couldn\u2019t delete the task',
    symbol: 'trash',
  },
  // Web3 power-up (wallet specialist tools).
  create_wallet: {
    running: 'Creating your wallet…',
    done: 'Created your wallet',
    failed: 'Couldn\u2019t create the wallet',
    symbol: 'wallet.pass',
    powerup: 'Web3',
  },
  get_wallet_balance: {
    running: 'Checking your wallet…',
    done: 'Checked your wallet',
    failed: 'Couldn\u2019t read your wallet',
    symbol: 'wallet.pass',
    powerup: 'Web3',
  },
  send_tokens: {
    running: 'Sending tokens…',
    done: 'Sent the tokens',
    failed: 'Couldn\u2019t send the tokens',
    symbol: 'paperplane',
    powerup: 'Web3',
  },
  // Google Health power-up (read-only health specialist tools).
  get_health_context: {
    running: 'Checking your health profile…',
    done: 'Checked your health profile',
    failed: 'Couldn’t read your health profile',
    symbol: 'heart.text.square',
    powerup: 'Google Health',
  },
  query_health_data: {
    running: 'Reading your health data…',
    done: 'Read your health data',
    failed: 'Couldn’t read your health data',
    symbol: 'heart.text.square',
    powerup: 'Google Health',
  },
};

/**
 * Bee delegates to specialists via the built-in `task` tool; the input's
 * `agent` field says which one. Power-up specialists get their power-up
 * branding, the goals specialist stays in the app's plain voice.
 */
function taskCopy(input: unknown): ToolCopy {
  const agent =
    typeof input === 'object' && input !== null && 'agent' in input
      ? String((input as { agent?: unknown }).agent ?? '')
      : '';
  const powerup = POWERUP_AGENTS[agent];
  if (powerup) {
    return {
      running: 'At work…',
      done: 'Finished',
      failed: 'Hit a snag',
      symbol: 'bolt.fill',
      powerup,
    };
  }
  if (agent === 'goals') {
    return {
      running: 'Working on your goals…',
      done: 'Worked on your goals',
      failed: 'Couldn\u2019t finish the goals work',
      symbol: 'scope',
    };
  }
  return {
    running: 'Working on it…',
    done: 'Finished a side task',
    failed: 'Couldn\u2019t finish the side task',
    symbol: 'sparkles',
  };
}

function fallbackCopy(name: string): ToolCopy {
  const readable = name.replace(/_/g, ' ');
  return {
    running: `Working on ${readable}…`,
    done: `Finished ${readable}`,
    failed: `Couldn\u2019t finish ${readable}`,
    symbol: 'sparkles',
  };
}

export type ToolActivityState = 'running' | 'done' | 'error';

export function getToolCopy(
  name: string,
  state: ToolActivityState,
  input?: unknown,
) {
  const copy =
    name === 'task' ? taskCopy(input) : (TOOL_COPY[name] ?? fallbackCopy(name));
  return {
    label:
      state === 'running'
        ? copy.running
        : state === 'error'
          ? copy.failed
          : copy.done,
    symbol: state === 'error' ? 'exclamationmark.triangle' : copy.symbol,
    powerup: copy.powerup ?? null,
  };
}
