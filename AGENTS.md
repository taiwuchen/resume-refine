# Test
- use resume.docx to upload

## Analysis, Suggestions, and Chat Plan

Track implementation of stable resume analysis, suggestion states, and chat-assisted edits here. This section is the source of truth for the plan.

### Product Goal

Repeated analysis of the same effective resume version and same job description should return the same known analysis by default. Resume edits should create a new effective resume version, mark prior analysis stale, and allow the user to re-analyze the current version.

Target product state: **Ready to apply for this job**, not "perfect resume".

### Product Principles

- Same effective resume version plus same job description returns the same known analysis by default.
- Users must intentionally request a new AI pass when they want variation.
- Suggestions are the source of truth for accepted, dismissed, regenerated, and open decisions.
- Chat explains, compares, and drafts edits, but does not silently mutate the resume.
- Chat-generated edits must become structured suggestions or confirmed edits.
- Resume edits make previous analysis stale for the new version.
- Readiness should combine deterministic checks with LLM-generated advice.

### Core Data Concepts

- `document_id`: identity of the uploaded resume.
- `resume_version_id`: identity of the effective editable resume state.
- `resume_hash`: normalized effective resume text hash.
- `job_description_hash`: normalized job description hash.
- `analysis_id`: identity of a stored analysis pass.
- `analysis_fingerprint`: hash of `resume_hash + job_description_hash + prompt_version + model + scoring_version`.
- `suggestion_id`: identity of a structured suggestion.
- `issue_key`: stable key for recognizing repeated issues.

### Backend Checklist

- [x] Add resume version model.
- [x] Add analysis pass model.
- [x] Add suggestion state model.
- [ ] Add chat message linkage to `resume_version_id`, `analysis_id`, and optional `suggestion_id`.
- [x] Compute normalized resume text hashes.
- [x] Compute normalized job description hashes.
- [x] Add analysis fingerprint lookup before calling the LLM.
- [x] Return existing analysis for unchanged inputs.
- [x] Add explicit behavior for **Generate another pass**.
- [ ] Persist accepted and dismissed suggestion states.
- [x] Mark analysis stale when resume text changes.
- [ ] Include prior accepted and dismissed decisions in future analysis context.
- [ ] Add deterministic readiness checks.
- [ ] Merge deterministic readiness checks with LLM suggestions.
- [x] Update analyzer prompt to return structured categories, severity, reason, and issue keys.
- [x] Update chat prompt to handle suggestion-aware explanation and rewrite generation.
- [x] Add structured chat response support for suggestion drafts.

### Frontend Checklist

- [x] Add resume version state to the session reducer.
- [x] Add active analysis state.
- [x] Add stale analysis state.
- [x] Add active suggestion state.
- [x] Add suggestion state transitions for open, accepted, dismissed, and regenerated.
- [x] Show readiness score and issue counts.
- [x] Group suggestions by severity.
- [x] Add **Ask about this** to suggestion cards.
- [x] Switch to chat tab with active suggestion context.
- [x] Show **Already analyzed this version** when cached analysis is reused.
- [x] Add **Generate another pass** as an explicit secondary action.
- [x] Show **Resume changed since last analysis** after edits.
- [x] Add chat actions for **Use as suggestion**, **Apply edit**, and **Discard**.
- [x] Ensure chat-generated edits flow through the same apply path as normal suggestions.

### Prompt Checklist

- [x] Add prompt versioning.
- [x] Update analysis prompt to emit structured JSON with stable fields.
- [x] Add categories such as impact, keywords, clarity, length, formatting, and relevance.
- [x] Add severity levels: critical, recommended, optional.
- [x] Ask for stable `issue_key` values.
- [ ] Include previous accepted and dismissed suggestions during new-pass analysis.
- [x] Instruct chat not to claim edits were applied unless the app confirms them.
- [x] Instruct chat to return structured edit drafts when the user asks for resume changes.

### Testing Checklist

- [x] Same resume version plus same job description returns the same stored analysis.
- [x] Same input with **Generate another pass** creates a new analysis pass.
- [x] Text edits create a new resume version.
- [ ] Formatting-only changes do not invalidate analysis when normalized text is unchanged.
- [x] Applying a suggestion marks the prior analysis stale.
- [ ] Dismissed suggestions are not repeated blindly in a new pass.
- [x] Chat can explain an active suggestion.
- [ ] Chat can generate a structured rewrite draft.
- [x] Chat-generated rewrites can become suggestions.
- [x] Applying a chat-generated rewrite updates resume version state.
- [x] Export uses the same effective resume state that analysis and chat reference.

### Suggested Implementation Order

1. Add analysis fingerprinting and cached return behavior.
2. Add suggestion states.
3. Add stale-analysis UX after applying changes.
4. Connect chat to the active suggestion.
5. Add chat-generated suggestion drafts.
6. Add resume versioning as the durable source of truth for edits.
7. Add deterministic readiness scoring.
8. Add support for explicit new analysis passes.
9. Add tests around repeated analysis, stale analysis, and chat-to-suggestion flows.

### Open Decisions

- Should resume versions be persisted immediately after every accepted suggestion, or batched into a draft version?
- Should manual edits create a new version on every save or only when re-analysis starts?
- Should **Generate another pass** replace the active analysis or show multiple passes side by side?
- How strict should `issue_key` stability be across edited paragraphs?
- Should readiness score be hidden until deterministic checks exist, or introduced with LLM-only scoring first?
