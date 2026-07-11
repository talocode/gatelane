import { Command } from "commander";
import { PolicyEngine } from "../core/policy-engine.js";

export const policyCommand = new Command("policy")
  .description("Manage tool access policies");

policyCommand
  .command("allow <tool>")
  .description("Allow access to a tool")
  .option("--reason <reason>", "Reason for the policy")
  .action((tool, options) => {
    const engine = new PolicyEngine();
    const policy = engine.add({
      effect: "allow",
      tool,
      reason: options.reason,
    });
    console.log(` Allow policy created:`);
    console.log(`   ID: ${policy.id}`);
    console.log(`   Tool: ${tool}`);
    if (options.reason) console.log(`   Reason: ${options.reason}`);
  });

policyCommand
  .command("deny <tool>")
  .description("Deny access to a tool")
  .option("--reason <reason>", "Reason for the policy")
  .action((tool, options) => {
    const engine = new PolicyEngine();
    const policy = engine.add({
      effect: "deny",
      tool,
      reason: options.reason,
    });
    console.log(` Deny policy created:`);
    console.log(`   ID: ${policy.id}`);
    console.log(`   Tool: ${tool}`);
    if (options.reason) console.log(`   Reason: ${options.reason}`);
  });

policyCommand
  .command("list")
  .description("List all policies")
  .action(() => {
    const engine = new PolicyEngine();
    const policies = engine.list();
    if (policies.length === 0) {
      console.log(" No policies defined.");
      console.log(` Default: ${engine.getDefault().toUpperCase()} (use 'policy set-default <allow|deny>' to change)`);
      return;
    }
    for (const p of policies) {
      const target = p.tool || p.server || "all";
      console.log(` ${p.effect.toUpperCase()} ${target}`);
      console.log(`   ID: ${p.id}${p.reason ? ` | Reason: ${p.reason}` : ""}`);
    }
    console.log(` Default: ${engine.getDefault().toUpperCase()}`);
  });

policyCommand
  .command("set-default <effect>")
  .description("Set default policy (allow or deny) for unconfigured tools")
  .action((effect) => {
    if (effect !== "allow" && effect !== "deny") {
      console.error(" Error: effect must be 'allow' or 'deny'");
      return;
    }
    const engine = new PolicyEngine();
    engine.setDefault(effect);
    console.log(` Default policy set to: ${effect.toUpperCase()}`);
    console.log(" Tools without matching policies will now be", effect === "deny" ? "DENIED" : "ALLOWED");
  });

policyCommand
  .command("remove <id>")
  .description("Remove a policy by ID")
  .action((id) => {
    const engine = new PolicyEngine();
    engine.remove(id);
    console.log(` Policy '${id}' removed.`);
  });
