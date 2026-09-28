import type { ActionChannel, NextAction } from "../types";
import { RULES, type NextActionContext, type NextActionRule } from "./rules";

const MAX_ACTIONS = 3;

/** Evalúa las reglas, ordena por prioridad y resuelve el canal respetando la política de cumplimiento. */
export function suggestNextActions(ctx: NextActionContext, rules: readonly NextActionRule[] = RULES): NextAction[] {
  const applicable = rules.filter((rule) => rule.applies(ctx)).sort((a, b) => b.priority - a.priority);

  const exclusive = applicable.find((rule) => rule.exclusive);
  const selected = exclusive ? [exclusive] : dropSuperseded(applicable);

  return selected.slice(0, MAX_ACTIONS).map((rule) => {
    const outcome = rule.build(ctx);
    const channel = pickChannel(outcome.channels, ctx);
    const blocked = outcome.channels.length > 0 && channel === "none";
    return {
      ruleId: rule.id,
      priority: rule.priority,
      title: outcome.title,
      reason: blocked ? `${outcome.reason} No hay ningún canal permitido ahora mismo.` : outcome.reason,
      channel,
    };
  });
}

function dropSuperseded(rules: NextActionRule[]): NextActionRule[] {
  const superseded = new Set(rules.flatMap((rule) => rule.supersedes ?? []));
  return rules.filter((rule) => !superseded.has(rule.id));
}

function pickChannel(preferred: readonly ActionChannel[], ctx: NextActionContext): ActionChannel {
  const allowed: Record<Exclude<ActionChannel, "none">, boolean> = {
    call: ctx.policy.call.allowed,
    whatsapp: ctx.policy.whatsapp.allowed,
    email: ctx.policy.email.allowed,
  };
  return preferred.find((c): c is Exclude<ActionChannel, "none"> => c !== "none" && allowed[c]) ?? "none";
}
