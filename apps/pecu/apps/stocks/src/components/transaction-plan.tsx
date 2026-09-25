import { CheckIcon, CircleAlertIcon, Loader2Icon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type {
  PlanStep,
  TransactionPlan as Plan,
} from "../../../../src/transaction-plan-contract";
import {
  planLayout,
  routeDescription,
  type Orientation,
  type PlanLayout,
  type PlanRoute,
} from "../lib/plan-layout";
import type { ConfirmationState } from "./ai-elements/confirmation";
import { CopyButton } from "./copy-button";

const statusText = {
  waiting: "Waiting",
  submitted: "Submitted, waiting for the receipt",
  confirmed: "Confirmed on Base",
  failed: "Failed",
  skipped: "Not sent",
} satisfies Record<NonNullable<PlanStep["status"]>, string>;

/** Layer count at which the across layout no longer fits and the card switches to down. */
const MAX_ACROSS_LAYERS = 5;

function shortAddress(value: string) {
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function percent(value: number, total: number) {
  return `${((value / total) * 100).toFixed(3)}%`;
}

/** Motion delays are keyed by layer in CSS; deeper layers share the last delay. */
function layer(value: number) {
  return Math.min(value, 7);
}

function RouteMap({
  layout,
  orientation,
  done,
  active,
}: {
  layout: PlanLayout;
  orientation: Orientation;
  done: ReadonlySet<number>;
  active: number | null;
}) {
  return (
    <div
      className={`pecu-plan-map is-${orientation}`}
      style={{ aspectRatio: `${layout.width} / ${layout.height}`, maxWidth: layout.width }}
      aria-hidden="true"
    >
      <svg className="pecu-plan-edges" viewBox={`0 0 ${layout.width} ${layout.height}`} focusable="false">
        {layout.edges.map((edge) => (
          <g
            className="pecu-plan-edge"
            data-active={active === edge.step || undefined}
            data-done={done.has(edge.step) || undefined}
            data-layer={layer(edge.layer)}
            data-step={edge.step}
            key={edge.key}
          >
            <path className="pecu-plan-track" d={edge.path} pathLength={100} />
            <path className="pecu-plan-flow" d={edge.path} pathLength={100} />
          </g>
        ))}
      </svg>
      {layout.edges.map((edge) => (
        <span
          className="pecu-plan-chip"
          data-active={active === edge.step || undefined}
          data-layer={layer(edge.layer)}
          data-step={edge.step}
          key={edge.key}
          style={{ left: percent(edge.mid.x, layout.width), top: percent(edge.mid.y, layout.height) }}
        >
          <span className="pecu-plan-chip-step mono">{edge.step + 1}</span>
          {edge.label ? <span>{edge.label}</span> : null}
        </span>
      ))}
      {layout.nodes.map((node) => (
        <span
          className={`pecu-plan-node is-${node.kind}${node.created ? " is-created" : ""}`}
          data-layer={layer(node.layer)}
          key={node.id}
          style={{ left: percent(node.x, layout.width), top: percent(node.y, layout.height) }}
          title={node.label.length > 14 ? node.label : undefined}
        >
          <strong>{node.label}</strong>
          {node.detail ? <small>{node.detail}</small> : null}
        </span>
      ))}
    </div>
  );
}

function Route({ route, steps, active }: { route: PlanRoute; steps: readonly PlanStep[]; active: number | null }) {
  const across = planLayout(route, "across");
  const down = planLayout(route, "down");
  const done = new Set(steps.flatMap((step, index) => (step.status === "confirmed" ? [index] : [])));
  // A wide fan (a basket of many stocks) reads better across even on a phone.
  const switches = down.width <= across.width;
  return (
    <div
      className="pecu-plan-route"
      data-layers={switches ? Math.min(across.layers, MAX_ACROSS_LAYERS + 1) : undefined}
      role="img"
      aria-label={routeDescription(route)}
    >
      <RouteMap layout={across} orientation="across" done={done} active={active} />
      {switches ? <RouteMap layout={down} orientation="down" done={done} active={active} /> : null}
    </div>
  );
}

function Bead({ step, index }: { step: PlanStep; index: number }) {
  return (
    <span className="pecu-plan-bead" aria-hidden="true">
      {step.status === "confirmed" ? (
        <CheckIcon size={15} strokeWidth={2.5} />
      ) : step.status === "submitted" ? (
        <Loader2Icon className="animate-spin" size={15} />
      ) : step.status === "failed" ? (
        <CircleAlertIcon size={15} />
      ) : (
        <span className="mono">{index + 1}</span>
      )}
    </span>
  );
}

/**
 * Every transaction a preview will sign, in order, with the route value
 * takes between tokens and pools. Edges and steps share their number, and
 * pointing at a step highlights the part of the route it moves.
 */
export function TransactionPlan({ plan, state }: { plan: Plan; state: ConfirmationState }) {
  const [active, setActive] = useState<number | null>(null);
  const [offscreen, setOffscreen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = root.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setOffscreen(!entry?.isIntersecting));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <div className="pecu-plan" data-offscreen={offscreen || undefined} data-state={state} ref={root}>
      {plan.route ? <Route route={plan.route} steps={plan.steps} active={active} /> : null}
      <ol className="pecu-plan-steps" aria-label="Transactions">
        {plan.steps.map((step, index) => (
          <li
            className="pecu-plan-step"
            data-active={active === index || undefined}
            data-kind={step.kind}
            data-status={step.status}
            data-step={index}
            key={index}
            onPointerEnter={() => setActive(index)}
            onPointerLeave={() => setActive(null)}
          >
            <Bead index={index} step={step} />
            <div className="pecu-plan-step-body">
              <span className="pecu-plan-step-title">{step.title}</span>
              <span className="pecu-plan-step-meta">
                {step.kind === "approval" ? <span>Permission only</span> : null}
                <span className="pecu-plan-contract">
                  {step.contractName ?? "Contract"}
                  <span className="pecu-plan-address">
                    <span className="mono" title={step.contract}>{shortAddress(step.contract)}</span>
                    <CopyButton
                      className="pecu-preview-copy"
                      label={`Copy ${(step.contractName ?? "contract").toLowerCase()} address`}
                      text={step.contract}
                    />
                  </span>
                </span>
                {step.value ? <span>Sends <span className="mono">{step.value}</span></span> : null}
              </span>
              {step.status ? (
                <span className="pecu-plan-step-status">
                  {statusText[step.status]}
                  {step.hash ? (
                    <>
                      {" · "}
                      <a href={`https://basescan.org/tx/${step.hash}`} rel="noreferrer" target="_blank">
                        View on Basescan
                      </a>
                    </>
                  ) : null}
                </span>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
