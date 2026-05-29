# ProjectFlow Seed Scenarios

Status: current as of 2026-05-29.

## Seeded Team

`POST /api/demo/reset` creates five demo users:

- Lin: project lead, product/backend.
- Mia: frontend and interaction owner.
- Chen: backend and testing owner.
- Noor: research and writing.
- Jay: demo owner and QA.

## Seeded Project

Project: AI Study Planner.

The project has two stages:

- Prototype Loop: active stage for the MVP execution loop.
- Review Prep: pending stage for final presentation material.

Seed data includes resources, five tasks, finalized assignment proposals for the first active tasks, one check-in cycle, one check-in response, one high-severity risk, action cards, and a timeline event.

## Blocker Scenario

Mia reports that the dashboard is ready but the export backend was missing. This creates the demo risk:

- Risk: Export gap threatens demo closeout.
- Evidence: frontend export button exists; backend route was missing.
- Recommendation: finish export endpoint and rerun the demo path.

This scenario is intentionally narrow: it exercises check-in, blocker capture, risk evidence, next action cards, and review export without depending on a real LLM provider.
