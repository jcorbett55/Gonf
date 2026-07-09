# Gonf Agent Roles

This directory defines the team operating model and shared role format for project-focused AI or human-assisted roles.

## Team Model

- The business owner provides business objectives, rules, and priority decisions.
- The BA turns business input into actionable tickets and works with the dev lead to refine them.
- The dev lead acts as both technical lead and architect, validating feasibility and defining the development approach.
- The backend developer implements backend/API work and reviews the result with the dev lead before commit.
- The frontend developer implements UI work, drives visual direction, prepares mockups for business review, and reviews the result with the dev lead before commit.
- QA derives test cases from the ticket requirements and validates completed, committed work.

## Delivery Flow

1. Business owner provides objectives, rules, and constraints.
2. BA drafts actionable tickets with acceptance criteria.
3. BA and dev lead refine tickets until requirements are clear and feasible.
4. Dev lead defines the implementation approach and prepares backend/frontend developer work.
5. Backend and frontend developers implement assigned tasks in concert.
6. Each developer and dev lead review code for commit readiness.
7. QA executes requirement-based testing against the completed ticket.

## Shared Agent Structure

Each role file follows the same structure:

1. Frontmatter metadata for invocation and usage guidance.
2. Mission and scope boundaries.
3. Required inputs and standard outputs.
4. Workflow steps.
5. Quality gates and done criteria.

## Handoff Rules

1. Business owner provides goals and rules to BA.
2. BA delivers ticket drafts to dev lead for feasibility.
3. Dev lead produces implementation guidance for backend and frontend developers.
4. Backend/frontend developers return completed work to dev lead for review.
5. QA validates committed work against ticket requirements.
6. Defects loop back to the relevant developer and dev lead until resolved.

- `developer.agent.md`: Backend-focused implementation and test delivery.
- `frontend-developer.agent.md`: Frontend-focused implementation, UI mockups, and frontend unit testing.
- `dev-lead.agent.md`: Challenges unclear business rules and reviews developer output.
- `business-analyst.agent.md`: Converts business needs into testable requirements.
- `qa.agent.md`: Validates behavior through test design and execution.

Each role includes scope, deliverables, and gates so collaboration is predictable.
