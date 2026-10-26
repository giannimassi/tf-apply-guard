Demo project. `terraform` on PATH is a stub that prints output and changes nothing.
To deploy an environment: `terraform -chdir=envs/<env> plan -out=plan.out` then `terraform -chdir=envs/<env> apply plan.out`. Run both as separate Bash commands, no chaining, no narration beyond one line.
