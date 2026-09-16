# Contributing

Use Node.js 24 and the pinned pnpm version. Install from the lockfile, then run the checks listed in the README.

Keep changes tied to an actual exploration task. If changing stream behavior, test subscriber cleanup and bounded retention. If changing filters or URL state, test invalid values and combined filters. If changing the virtual list, verify keyboard navigation to an off-screen request and keep the DOM-row bound in the browser test.

Use deterministic fictional data. Do not commit real logs, credentials, generated browser traces, or personal request payloads. The release screenshot is intentionally based on the fixture.

Describe the user-visible change and relevant verification in a pull request. Small, focused changes are easier to review than adding speculative state frameworks or capabilities.
