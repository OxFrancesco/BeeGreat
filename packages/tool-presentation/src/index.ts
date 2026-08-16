export { scrubIdentifiers } from "./scrub-identifiers";
export {
  GOOGLE_WORKSPACE_DISCLOSURE,
  GOOGLE_WORKSPACE_DISCLOSURE_VERSION,
  GOOGLE_WORKSPACE_SERVICES,
  type GoogleWorkspaceService,
} from "./google-workspace-disclosure";
export {
  parseBeeQuestion,
  renderBeeQuestion,
  resolveBeeQuestionAnswer,
  type BeeQuestion,
} from "./bee-question";
export {
  BEEUI_FENCE_OPEN,
  deriveBeeUiFollowUps,
  extractBeeUi,
  firstFocusPreviewSchema,
  parseBeeUiBlock,
  renderBeeUiMarkdown,
  uiComponentSchema,
  type BeeUiFollowUps,
  type BeeUiMarkdown,
  type FirstFocusPreview,
  type ParsedBeeUiComponent,
  type UIComponent,
  type UnsupportedComponent,
  type Web3Confirmation,
} from "./beeui";
export { endOfLocalDay, formatHighlightExpiry } from "./highlight-time";
export {
  humanizeWeb3Summary,
  projectTextWeb3Action,
  type TextWeb3Action,
  type TextWeb3Projection,
} from "./web3-text";
export {
  bookmarkHost,
  eoaFailureReason,
  generatedImageFileName,
  questionAnswer,
  type EoaFailureReason,
} from "./beeui-card-logic";
export { MOODS, type Mood, type MoodOption } from "./health-moods";
export {
  compareDrafts,
  formatSaveState,
  type JournalDraft,
  type JournalSaveState,
  type SaveStateLabels,
} from "./journal-draft";
export {
  BOOKMARK_KIND_LABELS,
  bookmarkKindGlyph,
  bookmarkKindLabel,
  bookmarkRelativeDate,
  bookmarkSourceLabel,
  type BookmarkKind,
  type BookmarkSourceLabelOptions,
} from "./bookmark-presentation";

export type ToolActivityState = "running" | "done" | "error";

type ToolCopy = {
  running: string;
  done: string;
  failed: string;
  powerup?: string;
  specialist?: string;
};

const POWERUP_AGENTS: Record<string, string> = {
  devin: "Devin",
  web3: "Web3",
  "google-health": "Google Health",
};

const BUILT_IN_SPECIALISTS: Record<string, string> = {
  imagine: "Imagine",
  "google-workspace": "Google Workspace",
};

const TOOL_COPY: Record<string, ToolCopy> = {
  search_mind: {
    running: "Searching your Mind…",
    done: "Searched your Mind",
    failed: "Couldn’t search your Mind",
  },
  list_bookmarks: {
    running: "Checking your bookmarks…",
    done: "Checked your bookmarks",
    failed: "Couldn’t read your bookmarks",
  },
  get_bookmark: {
    running: "Reading the bookmark…",
    done: "Read the bookmark",
    failed: "Couldn’t read the bookmark",
  },
  save_bookmark: {
    running: "Saving the bookmark…",
    done: "Saved the bookmark",
    failed: "Couldn’t save the bookmark",
  },
  update_bookmark: {
    running: "Updating the bookmark…",
    done: "Updated the bookmark",
    failed: "Couldn’t update the bookmark",
  },
  delete_bookmark: {
    running: "Deleting the bookmark…",
    done: "Deleted the bookmark",
    failed: "Couldn’t delete the bookmark",
  },
  telegram_connection_status: {
    running: "Checking Telegram…",
    done: "Checked Telegram",
    failed: "Couldn’t check Telegram",
  },
  send_telegram_message: {
    running: "Sending to Telegram…",
    done: "Sent to Telegram",
    failed: "Couldn’t send to Telegram",
  },
  create_agent_job: {
    running: "Scheduling the Job…",
    done: "Scheduled the Job",
    failed: "Couldn’t schedule the Job",
  },
  list_agent_jobs: {
    running: "Checking your Jobs…",
    done: "Checked your Jobs",
    failed: "Couldn’t read your Jobs",
  },
  update_agent_job: {
    running: "Updating the Job…",
    done: "Updated the Job",
    failed: "Couldn’t update the Job",
  },
  pause_agent_job: {
    running: "Pausing the Job…",
    done: "Paused the Job",
    failed: "Couldn’t pause the Job",
  },
  resume_agent_job: {
    running: "Resuming the Job…",
    done: "Resumed the Job",
    failed: "Couldn’t resume the Job",
  },
  cancel_agent_job: {
    running: "Cancelling the Job…",
    done: "Cancelled the Job",
    failed: "Couldn’t cancel the Job",
  },
  run_now_agent_job: {
    running: "Starting the Job…",
    done: "Started the Job",
    failed: "Couldn’t start the Job",
  },
  complete_agent_job_run: {
    running: "Saving the Job result…",
    done: "Saved the Job result",
    failed: "Couldn’t save the Job result",
  },
  wait_for_agent_job_external: {
    running: "Tracking the on-chain action…",
    done: "Tracking the on-chain action",
    failed: "Couldn’t track the on-chain action",
  },
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
  get_wallets: {
    running: "Checking your wallets…",
    done: "Checked your wallets",
    failed: "Couldn’t read your wallets",
    powerup: "Web3",
  },
  get_wallet_balance: {
    running: "Checking your wallet…",
    done: "Checked your wallet",
    failed: "Couldn’t read your wallet",
    powerup: "Web3",
  },
  get_wallet_activity: {
    running: "Reading your wallet activity…",
    done: "Read your wallet activity",
    failed: "Couldn’t read the activity",
    powerup: "Web3",
  },
  fund_wallet: {
    running: "Requesting test funds…",
    done: "Requested test funds",
    failed: "Couldn’t fund the wallet",
    powerup: "Web3",
  },
  send_tokens: {
    running: "Sending tokens…",
    done: "Sent the tokens",
    failed: "Couldn’t send the tokens",
    powerup: "Web3",
  },
  prepare_send_tokens: {
    running: "Preparing the transfer…",
    done: "Prepared the transfer",
    failed: "Couldn’t prepare the transfer",
    powerup: "Web3",
  },
  quote_cross_chain_swap: {
    running: "Finding a cross-chain route…",
    done: "Found a cross-chain route",
    failed: "Couldn’t find a route",
    powerup: "Web3",
  },
  prepare_cross_chain_swap: {
    running: "Preparing the cross-chain swap…",
    done: "Prepared the cross-chain swap",
    failed: "Couldn’t prepare the swap",
    powerup: "Web3",
  },
  prepare_sugar_execution: {
    running: "Preparing the DeFi action…",
    done: "Prepared the DeFi action",
    failed: "Couldn’t prepare the action",
    powerup: "Web3",
  },
  check_web3_action: {
    running: "Checking the action status…",
    done: "Checked the action status",
    failed: "Couldn’t check the action",
    powerup: "Web3",
  },
  sugar_pools: {
    running: "Scanning liquidity pools…",
    done: "Scanned liquidity pools",
    failed: "Couldn’t read the pools",
    powerup: "Web3",
  },
  sugar_positions: {
    running: "Checking your positions…",
    done: "Checked your positions",
    failed: "Couldn’t read the positions",
    powerup: "Web3",
  },
  sugar_epochs_latest: {
    running: "Reading the latest epochs…",
    done: "Read the latest epochs",
    failed: "Couldn’t read the epochs",
    powerup: "Web3",
  },
  sugar_epochs: {
    running: "Reading epoch history…",
    done: "Read the epoch history",
    failed: "Couldn’t read the epochs",
    powerup: "Web3",
  },
  sugar_quote: {
    running: "Getting a swap quote…",
    done: "Got the swap quote",
    failed: "Couldn’t get a quote",
    powerup: "Web3",
  },
  sugar_swap: {
    running: "Building the swap plan…",
    done: "Built the swap plan",
    failed: "Couldn’t build the swap",
    powerup: "Web3",
  },
  sugar_deposit: {
    running: "Building the deposit plan…",
    done: "Built the deposit plan",
    failed: "Couldn’t build the deposit",
    powerup: "Web3",
  },
  sugar_withdraw: {
    running: "Building the withdrawal plan…",
    done: "Built the withdrawal plan",
    failed: "Couldn’t build the withdrawal",
    powerup: "Web3",
  },
  sugar_stake: {
    running: "Building the staking plan…",
    done: "Built the staking plan",
    failed: "Couldn’t build the staking plan",
    powerup: "Web3",
  },
  sugar_unstake: {
    running: "Building the unstaking plan…",
    done: "Built the unstaking plan",
    failed: "Couldn’t build the unstaking plan",
    powerup: "Web3",
  },
  sugar_claim_emissions: {
    running: "Building the rewards claim…",
    done: "Built the rewards claim",
    failed: "Couldn’t build the claim",
    powerup: "Web3",
  },
  sugar_claim_fees: {
    running: "Building the fee claim…",
    done: "Built the fee claim",
    failed: "Couldn’t build the claim",
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
  start_devin_task: {
    running: "Starting Devin in the cloud…",
    done: "Started the Devin task",
    failed: "Couldn’t start the Devin task",
    powerup: "Devin",
  },
  list_devin_tasks: {
    running: "Checking Devin’s cloud tasks…",
    done: "Checked Devin’s cloud tasks",
    failed: "Couldn’t check Devin’s tasks",
    powerup: "Devin",
  },
  inspect_devin_task: {
    running: "Reading Devin’s latest update…",
    done: "Read Devin’s latest update",
    failed: "Couldn’t read Devin’s update",
    powerup: "Devin",
  },
  follow_up_devin_task: {
    running: "Sending Devin a follow-up…",
    done: "Sent Devin the follow-up",
    failed: "Couldn’t send Devin the follow-up",
    powerup: "Devin",
  },
  generate_image: {
    running: "Creating your image…",
    done: "Created your image",
    failed: "Couldn’t create your image",
    specialist: "Imagine",
  },
  edit_image: {
    running: "Editing your image…",
    done: "Edited your image",
    failed: "Couldn’t edit your image",
    specialist: "Imagine",
  },
  generate_video: {
    running: "Creating your video…",
    done: "Created your video",
    failed: "Couldn’t create your video",
    specialist: "Imagine",
  },
  edit_video: {
    running: "Editing your video…",
    done: "Edited your video",
    failed: "Couldn’t edit your video",
    specialist: "Imagine",
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
  const specialist = BUILT_IN_SPECIALISTS[agent];
  if (specialist) {
    return {
      running: "At work…",
      done: "Finished",
      failed: "Hit a snag",
      specialist,
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
    specialist: copy.specialist ?? null,
  };
}
