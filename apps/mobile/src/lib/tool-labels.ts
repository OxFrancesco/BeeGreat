/** User-facing language for agent tool calls — never show tool internals. */

interface ToolCopy {
  running: string;
  done: string;
  failed: string;
  symbol: string;
}

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
};

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

export function getToolCopy(name: string, state: ToolActivityState) {
  const copy = TOOL_COPY[name] ?? fallbackCopy(name);
  return {
    label: state === 'running' ? copy.running : state === 'error' ? copy.failed : copy.done,
    symbol: state === 'error' ? 'exclamationmark.triangle' : copy.symbol,
  };
}
