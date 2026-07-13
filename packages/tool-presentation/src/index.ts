export type ToolActivityState = "running" | "done" | "error";

type ToolCopy = {
  running: string;
  done: string;
  failed: string;
  powerup?: string;
};

const POWERUP_AGENTS: Record<string, string> = {
  web3: "Web3",
  "google-health": "Google Health",
};

const TOOL_COPY: Record<string, ToolCopy> = {
  get_goals: {
    running: "Checking your goals…",
    done: "Checked your goals",
    failed: "Couldn’t read your goals",
  },
  create_goal: {
    running: "Creating your goal…",
    done: "Created your goal",
    failed: "Couldn’t create the goal",
  },
  update_goal: {
    running: "Updating your goal…",
    done: "Updated your goal",
    failed: "Couldn’t update the goal",
  },
  delete_goal: {
    running: "Deleting the goal…",
    done: "Deleted the goal",
    failed: "Couldn’t delete the goal",
  },
  create_project: {
    running: "Creating the project…",
    done: "Created the project",
    failed: "Couldn’t create the project",
  },
  update_project: {
    running: "Renaming the project…",
    done: "Renamed the project",
    failed: "Couldn’t rename the project",
  },
  delete_project: {
    running: "Deleting the project…",
    done: "Deleted the project",
    failed: "Couldn’t delete the project",
  },
  list_tasks: {
    running: "Looking through your tasks…",
    done: "Looked through your tasks",
    failed: "Couldn’t read your tasks",
  },
  create_task: {
    running: "Adding your task…",
    done: "Added your task",
    failed: "Couldn’t add the task",
  },
  complete_task: {
    running: "Marking it done…",
    done: "Marked it done",
    failed: "Couldn’t complete the task",
  },
  update_task: {
    running: "Updating the task…",
    done: "Updated the task",
    failed: "Couldn’t update the task",
  },
  delete_task: {
    running: "Deleting the task…",
    done: "Deleted the task",
    failed: "Couldn’t delete the task",
  },
  create_wallet: {
    running: "Creating your wallet…",
    done: "Created your wallet",
    failed: "Couldn’t create the wallet",
    powerup: "Web3",
  },
  get_wallet_balance: {
    running: "Checking your wallet…",
    done: "Checked your wallet",
    failed: "Couldn’t read your wallet",
    powerup: "Web3",
  },
  send_tokens: {
    running: "Sending tokens…",
    done: "Sent the tokens",
    failed: "Couldn’t send the tokens",
    powerup: "Web3",
  },
  get_health_context: {
    running: "Checking your health profile…",
    done: "Checked your health profile",
    failed: "Couldn’t read your health profile",
    powerup: "Google Health",
  },
  query_health_data: {
    running: "Reading your health data…",
    done: "Read your health data",
    failed: "Couldn’t read your health data",
    powerup: "Google Health",
  },
};

function taskCopy(input: unknown): ToolCopy {
  const agent =
    typeof input === "object" && input !== null && "agent" in input
      ? String((input as { agent?: unknown }).agent ?? "")
      : "";
  const powerup = POWERUP_AGENTS[agent];
  if (powerup) {
    return {
      running: "At work…",
      done: "Finished",
      failed: "Hit a snag",
      powerup,
    };
  }
  if (agent === "goals") {
    return {
      running: "Working on your goals…",
      done: "Worked on your goals",
      failed: "Couldn’t finish the goals work",
    };
  }
  return {
    running: "Working on it…",
    done: "Finished a side task",
    failed: "Couldn’t finish the side task",
  };
}

export function getToolCopy(
  name: string,
  state: ToolActivityState,
  input?: unknown,
) {
  const readable = name.replace(/_/g, " ");
  const fallback: ToolCopy = {
    running: `Working on ${readable}…`,
    done: `Finished ${readable}`,
    failed: `Couldn’t finish ${readable}`,
  };
  const copy =
    name === "task" ? taskCopy(input) : (TOOL_COPY[name] ?? fallback);
  return {
    label:
      state === "running"
        ? copy.running
        : state === "error"
          ? copy.failed
          : copy.done,
    powerup: copy.powerup ?? null,
  };
}
