# WoWAnalyzerCN

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. The
skill has multi-step workflows, checklists, and quality gates that produce better
results than an ad-hoc answer. When in doubt, invoke the skill. A false positive is
cheaper than a false negative.

Key routing rules:
- Bugs, errors, "why is this broken" → invoke /investigate
- Test the site, find bugs → invoke /qa
- Code review, check the diff → invoke /review
- Ship, deploy, create a PR → invoke /ship
- Security audit → invoke /cso