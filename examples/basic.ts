import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { markdownToDocx } from "../src/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outputPath = path.join(__dirname, "test-output.docx");
const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9l9l8AAAAASUVORK5CYII=",
  "base64",
);

const markdown = `
# Product Requirements Document

Stakeholder: Synchrony

## **Goals**

### **Business Goals**

* Reduce manual effort spent validating payment-side APIs by at least 60% within the first release cycle by replacing ad-hoc scripts and browser network-tab inspection with reusable, generated API tests.

* Improve confidence in payment-related calculations by enabling deterministic validation of critical financial outputs such as net worth, balances, category totals, and recurring expense summaries.

* Establish a scalable foundation for API test generation using OpenAPI specifications and project business context so future payment API coverage can be expanded with lower incremental effort.

### **User Goals**

* Allow product developers and QA engineers to describe validation needs in natural language and receive executable API tests without manually scripting every scenario.

* Help teams verify that UI-visible financial values are consistent with underlying API responses and derived calculations across multiple endpoints.

* Provide transparent validation outputs that show which APIs were called, how aggregates were computed, and where mismatches occurred.

### **Non-Goals**

* Replacing all existing API testing workflows across every project and domain in the organization during the initial phase.

* Building a full UI automation framework; this PRD focuses on API-level validation for payment-side workflows.

***

## **Core Features**

* **Epic: AI-Assisted Payment API Validation Platform** (Priority: High)

  * **Feature: OpenAPI-Driven Test Generation** — Generate deterministic API test definitions for payment-side workflows by mapping natural language validation requests to routes, parameters, schemas, and expected fields defined in OpenAPI specifications. This addresses the current reliance on manual scripts and dev-tools inspection highlighted in the "API Testing Strategy Test" meeting.

    **User Experience**

    * **Entry Point & First-Time Flow**: A product developer or QA engineer selects the payment API domain, uploads or connects the relevant OpenAPI specification, and enters a validation objective such as verifying net worth or balance consistency.

    * **Core Journey**: The system parses the OpenAPI spec, identifies relevant endpoints such as summary, transaction, schedule, and filter APIs, proposes a test plan, and generates executable test definitions for review and execution.

    * **Edge Cases**: If the OpenAPI spec is incomplete, inconsistent, or unavailable, the system highlights the missing schema details and marks the impacted test logic with **[AMBIGUITY: OpenAPI specification coverage or correctness for one or more payment endpoints is unclear]** rather than inventing unsupported request or response structures.

    * **Accessibility / UX Principles**: Generated test plans must be readable by both technical and non-technical stakeholders, use plain-language summaries, and clearly separate inferred logic from spec-defined logic.

    **Success Metrics (Feature-Level)**

    * **User-Centric**: At least 70% of pilot users can generate a first-pass payment API validation flow without writing custom scripts.

    * **Business**: Manual effort for creating payment API validation scenarios decreases by at least 50% for pilot teams.

    * **Technical**: At least 90% of generated tests for supported payment endpoints correctly map to valid routes and parameters from the OpenAPI spec.

    **Timeline**
    Phase 1 implementation across Sprint 1 and the following sprint, focused on payment-side APIs and core validation flows.

    **Dependencies**

    * Usable OpenAPI specifications for payment-side APIs.

    * Access to endpoint schemas for summary, transaction, schedule, and related payment APIs.

    * Alignment on business formulas such as net worth = assets - liabilities.

* **Epic: AI-Assisted Payment API Validation Platform** (Priority: High)

  * **Feature: Natural Language Validation Interface** — Enable users to define validation goals in natural language, such as verifying that total assets minus liabilities equals net worth or that category aggregates match summary API outputs, and convert those requests into deterministic API validation logic.

    **User Experience**

    * **Entry Point & First-Time Flow**: The user enters a plain-language validation request and optionally selects a business context source such as a wiki, meeting summary, or acceptance criteria.

    * **Core Journey**: The system interprets the request, identifies required APIs and calculations, generates the validation workflow, and returns a pass/fail result with discrepancy details after execution.

    * **Edge Cases**: If the request is too vague, the system preserves the request but flags the unclear portion with **[AMBIGUITY: Natural language validation intent does not specify the exact comparison rule, date range, or source endpoints]** and asks for clarification before final execution.

    * **Accessibility / UX Principles**: Inputs should support plain business language, outputs should explain calculations step by step, and failures should be actionable rather than opaque.

    **Success Metrics (Feature-Level)**

    * **User-Centric**: At least 80% of pilot validation requests are understandable to users without requiring API scripting knowledge.

    * **Business**: Teams can define new payment validation scenarios in less than 15 minutes on average.

    * **Technical**: Generated validation workflows produce deterministic outputs for repeated runs against unchanged data and environment conditions.

    **Timeline**
    Phase 1 implementation in parallel with OpenAPI-driven generation, with initial support for a constrained set of payment validation patterns.

    **Dependencies**

    * Natural language parsing layer tied to OpenAPI route discovery.

    * Business-rule definitions from project documentation and meeting artifacts.

    * Execution environment capable of running generated API validations.

* **Epic: AI-Assisted Payment API Validation Platform** (Priority: High)

  * **Feature: Multi-Source and Aggregate Validation** — Support validations that derive expected values from multiple APIs and compare them against summary or balance endpoints, including category aggregation, recurring expense checks, pagination-aware transaction totals, and filtered schedule validations.

    **User Experience**

    * **Entry Point & First-Time Flow**: The user selects a validation pattern such as net worth reconciliation, category aggregation, or recurring expense verification, then confirms the relevant endpoints and filters.

    * **Core Journey**: The system fetches data from multiple routes, applies aggregation logic such as grouping by category or summing filtered transactions across pages, and compares the derived result to the target API response.

    * **Edge Cases**: The system must handle paginated APIs, missing categories, inconsistent transaction schemas, and partial data loads. Where business logic for aggregation is not fully documented, it flags **[AMBIGUITY: Aggregation rules for one or more payment calculations are not fully defined in current documentation]**.

    * **Accessibility / UX Principles**: Validation reports should show source-by-source contributions so users can trace how a final aggregate was computed.

    **Success Metrics (Feature-Level)**

    * **User-Centric**: Users can understand the source of mismatches without manually reconstructing calculations from raw API responses.

    * **Business**: Critical payment calculations currently checked manually can be automated for at least three high-value scenarios in the first release.

    * **Technical**: The system correctly handles pagination and multi-endpoint aggregation for supported scenarios with less than 2% execution failure due to orchestration issues.

    **Timeline**
    Phase 1 for net worth and category aggregation; Phase 2 for recurring expenses and broader multi-source validations.

    **Dependencies**

    * Stable access to transaction, summary, schedule, and filter APIs.

    * Defined aggregation formulas and filtering rules.

    * Test data or environments with representative payment records.

* **Epic: AI-Assisted Payment API Validation Platform** (Priority: Medium)

  * **Feature: Business Context Integration** — Use project context from wikis, meetings, stories, and acceptance criteria to improve test generation quality, infer business formulas, and prioritize high-risk payment validations.

    **User Experience**

    * **Entry Point & First-Time Flow**: The user links relevant project artifacts such as the meeting summary for "API Testing Strategy Test" and any payment-related wiki pages or stories.

    * **Core Journey**: The system extracts business rules, domain terminology, and validation priorities from those artifacts, then uses them to enrich generated test cases and explain why a validation matters.

    * **Edge Cases**: If project artifacts conflict, the system preserves the conflict and flags **[AMBIGUITY: Business rules in project artifacts are inconsistent for one or more payment calculations]** instead of silently choosing one interpretation.

    * **Accessibility / UX Principles**: Context sources should be visible and traceable so users know which wiki, meeting, or story influenced a generated test.

    **Success Metrics (Feature-Level)**

    * **User-Centric**: Users can see and trust the source context behind generated validations.

    * **Business**: High-priority payment validations can be generated faster because business rules do not need to be re-entered manually.

    * **Technical**: Context extraction correctly links generated validations to at least one supporting artifact for all pilot scenarios.

    **Timeline**
    Phase 2 after core generation and execution flows are stable.

    **Dependencies**

    * Access to project artifacts including wikis, meeting summaries, stories, and acceptance criteria.

    * Context extraction and traceability layer.

* **Epic: AI-Assisted Payment API Validation Platform** (Priority: High)

  * **Feature: Postman Integration** — Use Postman as the primary execution and interoperability layer for generated payment API tests, including collection generation, script support, and evaluation of Postman agent/chat capabilities for advanced workflows.

    **User Experience**

    * **Entry Point & First-Time Flow**: The user chooses Postman as the execution target and exports or syncs generated tests into a Postman-compatible format.

    * **Core Journey**: The system creates or updates Postman collections for payment validations, supports execution through Postman-compatible workflows, and returns structured results back into the project context.

    * **Edge Cases**: If a required Postman capability is unavailable or insufficient for a complex validation flow, the system flags **[AMBIGUITY: Postman agent or scripting capability for a required validation pattern has not yet been confirmed]** and recommends fallback execution through generated scripts.

    * **Accessibility / UX Principles**: Exported artifacts should be understandable to teams already familiar with Postman and should minimize custom setup.

    **Success Metrics (Feature-Level)**

    * **User-Centric**: Pilot users can execute generated payment API tests in Postman with minimal manual modification.

    * **Business**: Existing Postman familiarity reduces onboarding time for the new validation workflow.

    * **Technical**: Generated collections and scripts are compatible with the supported Postman execution path for pilot scenarios.

    **Timeline**
    Phase 1 for export compatibility; Phase 2 for deeper agent/chat-assisted workflows.

    **Dependencies**

    * Postman collection and scripting compatibility.

    * Defined execution path for generated tests.

    * Evaluation of Postman agent/chat capabilities.

***

## **Milestones**

* **Phase 1 (2 sprints)** – Deliver OpenAPI-driven test generation, natural language validation for core payment scenarios, Postman-compatible export/execution, and support for net worth and category-based aggregate validation.

* **Phase 2 (1-2 sprints)** – Add business context integration from wikis, meetings, stories, and acceptance criteria; expand support for recurring expenses, schedule/filter validations, and richer discrepancy reporting.

* **Phase 3 (1 sprint)** – Evaluate broader automation maturity, improve deterministic orchestration for complex multi-route validations, and assess extensibility to alternative tools such as Requestly if needed.

## **Reference links and samples**

* Related standards and tooling: [OpenAPI Specification](https://swagger.io/specification/), [Postman Learning Center](https://learning.postman.com/), and internal wiki link example [Payment API overview](https://example.com/wiki/payment-apis).

### **Phase summary table**

| Phase | Focus | Duration |
| ----- | ----- | -------- |
| 1 | OpenAPI generation, NL validation, Postman export, net worth & categories | 2 sprints |
| 2 | Business context, recurring expenses, schedules/filters, reporting | 1–2 sprints |
| 3 | Orchestration maturity, multi-route complexity, optional tools | 1 sprint |

### **Illustrative figures**

![Sample diagram placeholder](https://picsum.photos/seed/markdown-doc/480/240)

![Small badge-style image](https://picsum.photos/seed/docx-badge/120/40)

## Problem statement

Current payment-side API validation relies heavily on manual scripts, browser network-tab inspection, and developer familiarity with specific endpoints. This approach is difficult to scale for complex financial checks such as net worth reconciliation, category aggregation, recurring expense validation, and multi-source consistency checks. The meeting "API Testing Strategy Test" confirmed that current PM-agent-driven approaches are not sufficiently deterministic for data- and calculation-heavy workflows, while OpenAPI-based approaches remain underused due to tooling and documentation issues.

## Goals and objectives

* Enable deterministic, automated validation of payment-side APIs using AI-assisted workflows.

* Allow users to define validation intent in natural language and convert that intent into executable API tests.

* Use OpenAPI specifications as the structural foundation for route discovery, parameter mapping, and schema-aware validation.

* Incorporate project business context from wikis, meetings, stories, and acceptance criteria to improve test relevance and coverage.

* Reduce manual effort and improve confidence in financial outputs exposed through APIs and reflected in the UI.

## In-scope

* Payment-side APIs related to balances, assets, liabilities, net worth, transaction lists, category summaries, recurring expenses, and schedule/filter flows.

* Deterministic validation of formulas such as net worth = assets - liabilities where supported by business context.

* Multi-endpoint validations that compare derived aggregates against summary or balance APIs.

* Postman-based generation or export of executable API tests.

* Use of meeting-derived context from "API Testing Strategy Test" and related project artifacts to inform validation logic.

## Out of scope

* Full organization-wide replacement of all API testing workflows across unrelated domains.

* End-to-end UI automation beyond API-level correctness checks.

* Rebuilding the entire Swagger/OpenAPI ecosystem beyond what is necessary to support payment-side validation.

* Broad support for every third-party API testing tool in the initial release.

## User roles and needs

* **Product Developer / QA Engineer**

  * Needs to verify that payment calculations and summaries are correct without manually scripting every API scenario.

  * Needs visibility into how expected values were derived from source APIs.

* **Tech Lead / Architect**

  * Needs a deterministic and extensible framework for API validation built on OpenAPI specs and reusable business rules.

  * Needs confidence that complex validations can be maintained as APIs evolve.

* **Product Manager / Stakeholder**

  * Needs assurance that critical financial values shown to users are validated against underlying API logic.

  * Needs traceable documentation of what is being validated and why.

## Functional requirements

### OpenAPI-driven test generation

* The system shall ingest OpenAPI specifications for supported payment-side APIs.

* The system shall identify relevant routes, parameters, request schemas, and response schemas needed for a requested validation.

* The system shall generate executable test definitions from OpenAPI-informed route mappings.

* The system shall preserve and surface missing or inconsistent spec details rather than fabricating unsupported assumptions.

### Natural language validation interface

* The system shall accept natural language validation requests describing expected relationships between payment API outputs.

* The system shall translate those requests into one or more API calls, transformation steps, and comparison rules.

* The system shall return deterministic pass/fail results with discrepancy details and calculation traces.

* The system shall request clarification when the validation intent lacks sufficient specificity for execution.

### Multi-source and aggregate validation

* The system shall support validations that combine data from multiple APIs to derive expected values.

* The system shall support aggregation patterns including sums, grouped category totals, filtered subsets, and recurring-expense calculations.

* The system shall handle pagination and filter parameters when computing derived values from transaction-heavy APIs.

* The system shall compare derived aggregates against target summary or balance endpoints and report mismatches clearly.

### Business context integration

* The system shall consume project context from wikis, meetings, stories, and acceptance criteria.

* The system shall use that context to infer formulas, domain terminology, and validation priorities.

* The system shall maintain traceability between generated validations and the source artifacts that informed them.

* The system shall flag conflicting business rules instead of silently resolving them.

### Postman integration

* The system shall generate or export payment API tests in a Postman-compatible format.

* The system shall support execution workflows aligned with Postman collections and scripts.

* The system shall evaluate and, where feasible, leverage Postman agent/chat capabilities for advanced validation workflows.

* The system should support future extensibility to alternative tools if Postman capabilities prove insufficient for some scenarios.

## Non-functional requirements

* **Determinism:** Repeated runs with the same inputs and environment should produce consistent validation logic and outcomes.

* **Traceability:** Every generated validation should show which APIs, parameters, formulas, and context artifacts were used.

* **Performance:** Core payment validation scenarios should complete within an operationally acceptable time window for team workflows.

* **Extensibility:** The architecture should support additional validation patterns and potential future tool integrations.

* **Observability:** Execution logs should capture route usage, parameter values, aggregation steps, and mismatch details.

## Constraints and assumptions

* Payment-side OpenAPI specifications must be available in a sufficiently usable form for route and schema discovery.

* Some existing Swagger/OpenAPI issues may need remediation before full automation is possible.

* Postman is the primary tool for the initial implementation phase.

* Business formulas such as net worth calculation must be explicitly defined or traceable from project context.

* Representative payment data and environments must be available for meaningful validation execution.

`;

const buffer = await markdownToDocx(markdown, {
  assets: {
    resolveImage: async ({ src }) => {
      if (src.startsWith("http://") || src.startsWith("https://")) {
        return {
          data: tinyPng,
          width: src.includes("badge") ? 120 : 480,
          height: src.includes("badge") ? 40 : 240,
        };
      }

      return null;
    },
  },
  toc: { show: true },
  header: {
    show: true,
    left: { type: "text", value: "Sample PRD" },
    right: { type: "text", value: "Confidential" },
    borderTop: true,
  },
  footer: {
    show: true,
    left: { type: "pageNumber", format: "currentOfTotal" },
    right: { type: "text", value: "markdown-to-doc" },
    borderTop: true,
  },
  cover: {
    show: true,
    title: "Markdown to DOCX Example",
    subtitle: "Generated from the public package API",
    projectName: "markdown-to-doc",
    date: "May 2026",
    image: { kind: "buffer", value: tinyPng },
    imageWidth: 440,
    imageHeight: 180,
  },
});

await writeFile(outputPath, buffer);
console.log(`Wrote ${outputPath}`);
