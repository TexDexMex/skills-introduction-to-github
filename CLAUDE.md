# CLAUDE.md - AI Assistant Guide

## Repository Overview

This is a **GitHub Skills** course repository called "Introduction to GitHub". It serves as an interactive, self-paced tutorial that teaches beginners the fundamentals of GitHub through hands-on exercises.

**License**: MIT License (Copyright GitHub, Inc.)

## Repository Purpose

The repository functions as a **template repository** that users fork/copy to learn GitHub basics. When learners interact with it (create branches, make commits, open PRs), GitHub Actions workflows automatically progress them through the course steps.

### What Learners Accomplish

1. Create a branch (`my-first-branch`)
2. Commit a file (`PROFILE.md`)
3. Open a pull request
4. Merge the pull request

## Codebase Structure

```
skills-introduction-to-github/
├── .github/
│   ├── steps/                    # Course step content (Markdown)
│   │   ├── -step.txt            # Current step tracker (contains number 0-4)
│   │   ├── 0-welcome.md         # Welcome step placeholder
│   │   ├── 1-create-a-branch.md # Step 1 instructions
│   │   ├── 2-commit-a-file.md   # Step 2 instructions
│   │   ├── 3-open-a-pull-request.md # Step 3 instructions
│   │   ├── 4-merge-your-pull-request.md # Step 4 instructions
│   │   └── X-finish.md          # Completion message
│   ├── workflows/               # GitHub Actions automation
│   │   ├── 0-welcome.yml        # Triggers on repo creation
│   │   ├── 1-create-a-branch.yml # Triggers on branch creation
│   │   ├── 2-commit-a-file.yml  # Triggers on commit
│   │   ├── 3-open-a-pull-request.yml # Triggers on PR open
│   │   └── 4-merge-your-pull-request.yml # Triggers on PR merge
│   └── dependabot.yml           # Monthly GitHub Actions updates
├── images/                      # Tutorial screenshots (PNG files)
├── .gitignore                   # Standard ignore patterns
├── LICENSE                      # MIT License
└── README.md                    # Dynamic course content (updated by workflows)
```

## Key Mechanisms

### Step Progression System

1. **Step Tracker**: `.github/steps/-step.txt` contains the current step number (0-4)
2. **Workflow Triggers**: Each workflow listens for specific events:
   - `0-welcome.yml`: Push to `main` branch
   - `1-create-a-branch.yml`: Branch creation (specifically `my-first-branch`)
   - `2-commit-a-file.yml`: Commits to `my-first-branch`
   - `3-open-a-pull-request.yml`: Pull request opened
   - `4-merge-your-pull-request.yml`: Pull request merged

3. **Step Update Action**: Workflows use `skills/action-update-step@v2` to:
   - Update the step number in `-step.txt`
   - Replace README.md content with the next step's instructions

### Workflow Pattern

All workflows follow this pattern:
```yaml
jobs:
  get_current_step:
    # Reads current step from -step.txt

  on_<action>:
    needs: get_current_step
    if: >-
      ${{ !github.event.repository.is_template
          && needs.get_current_step.outputs.current_step == N }}
    # Updates to next step using skills/action-update-step@v2
```

## Development Conventions

### For Course Maintainers

- Step content lives in `.github/steps/` as Markdown files
- Workflow files must check `is_template` to avoid running on the source repo
- Branch name `my-first-branch` is hardcoded in workflows
- README.md is dynamically generated - edit step files instead

### For AI Assistants

When working with this repository:

1. **Do not modify workflow logic** unless explicitly requested - the step progression system is carefully designed

2. **README.md is auto-generated** - changes should be made to step files in `.github/steps/`

3. **Preserve the step numbering convention**:
   - Steps are numbered 0-4
   - `-step.txt` must contain only a single digit
   - `X-finish.md` is the completion step

4. **Images are instructional screenshots** - they show GitHub UI elements for the tutorial

5. **Key hardcoded values**:
   - Branch name: `my-first-branch`
   - File to create: `PROFILE.md`
   - PR title suggestion: `Add my first file`

## Commands

This repository contains no runnable code. It's purely documentation and GitHub Actions workflows.

### Testing Workflows

Workflows can be manually triggered via `workflow_dispatch` for testing purposes.

## Important Files

| File | Purpose |
|------|---------|
| `.github/steps/-step.txt` | Current step number (0-4) |
| `README.md` | Dynamic course content shown to learners |
| `.github/steps/*.md` | Source content for each step |
| `.github/workflows/*.yml` | Automation for step progression |

## External Dependencies

- `actions/checkout@v4` - Repository checkout
- `skills/action-update-step@v2` - Step progression action (from GitHub Skills org)

## Notes for Modifications

- When adding new steps, create both a step file and corresponding workflow
- Ensure workflow conditions match the step number
- Test changes by creating a repository from the template
- The `fetch-depth: 0` in checkouts is needed to access all branches
