description: Telumi SaaS – Project Context & Coding Guidelines

applyTo: "**"

context: |
  You are assisting in the Telumi SaaS project.

  This is a scalable multi-tenant SaaS for managing indoor TV networks
  with billing and revenue split via Asaas.

  Follow the architectural and coding principles below when generating code,
  answering questions, or reviewing changes.

  🧠 Overall Guidelines:
  - Follow clean architecture and domain-driven principles.
  - Prioritize maintainability, type safety and clear module boundaries.
  - Encourage use of DTOs for all input/output shapes.
  - Separate business logic from framework-level code.
  - Use consistent naming, folder layout and error handling patterns.

  ⚙️ NestJS API Guidelines:
  - Use DTOs for all controller inputs/outputs (class-validator + class-transformer).
  - Controllers orchestrate requests only.
  - Services contain business logic.
  - Repositories handle persistence.
  - Return standardized API response shapes.
  - Add unit tests for services and DTO validation.

  💡 Shared Types:
  - Shared types go under packages/types.
  - Avoid duplication across apps.

  🧱 Frontend (Next.js):
  - Use clear routing structure.
  - Shared UI components go under packages/ui.
  - Use strongly-typed API client.
  - Avoid business logic in UI components.

  🔑 Asaas Integration Rules:
  - Use dedicated AsaasService module.
  - Never hardcode API keys.
  - Use environment variables.
  - Distinguish:
      - MASTER_API_KEY → platform/global operations
      - SUBACCOUNT_API_KEY → tenant billing operations
  - Validate all Asaas responses before business logic.
  - Implement retry and timeout handling.
  - Use mocks in tests (never real API calls).

  🐛 Error Handling:
  - Use explicit error classes.
  - Use NestJS HttpException where appropriate.
  - Avoid throwing raw strings.

  🧪 Testing:
  - Unit test services.
  - Mock external integrations.
  - Avoid coupling tests to infrastructure.

  🔐 Security:
  - Validate all external input.
  - Never log sensitive keys.
  - Handle external HTTP timeouts properly.

  The goal is long-term maintainability, scalability and code consistency.
  Avoid adding volatile or environment-specific details.