---
name: extension-issue-workflow
description: Investigate and, when explicitly requested, implement and close GitHub Issues for this Chrome extension while preserving scope and external-change boundaries. Use for an Issue URL or number, Issue assessment, completion checks, or duplicate/new-issue decisions.
---

# Extension Issue workflow

Use the authoritative Issue source available in the current environment. If the Issue cannot be read, report the access failure and do not infer its requirements from a title, search result, or memory.

## Determine the mode

- For investigation, explanation, review, or duplicate assessment, read the Issue, relevant comments, current status, repository rules, and implementation evidence. Do not edit the repository or change the Issue.
- For an Open Issue with an explicit implementation request, implement only the stated scope, update required source-of-truth documents, run the relevant checks, and report the unmet parts separately.
- A Closed Issue is evidence to verify, not a new work queue. Do not reopen or append new work to it automatically.
- Creating, commenting, labeling, assigning, closing, reopening, or linking Issues is an external mutation and needs an explicit user request for that action. Implementation completion alone does not authorize a comment or close.

## Validate the request

Classify the Issue as actionable, already addressed, duplicate, contradictory to current rules, or insufficiently specified. If the completion condition is unclear or conflicts with the current source of truth, stop the dependent implementation and state the missing decision.

Keep new defects separate from the original Issue when their completion conditions differ. Do not create a new Issue merely because an additional problem was discovered; report it unless the user explicitly requests Issue creation.

## Complete an explicitly requested Issue

1. Confirm the requested scope, affected paths, compatibility constraints, and completion condition.
2. Protect unrelated worktree changes and make the smallest in-scope implementation.
3. Run the applicable `npm run typecheck`, `npm run build`, targeted tests, manifest checks, and `git diff --check`.
4. Re-read the Issue requirements against the resulting diff and generated extension output, then make the normal Japanese commit required by `AGENTS.md` when verification succeeds.
5. Only if the user explicitly requested external completion, prepare the exact comment/close action and perform it after local verification. Report the commit ID, remaining diff, and whether the change was pushed.
