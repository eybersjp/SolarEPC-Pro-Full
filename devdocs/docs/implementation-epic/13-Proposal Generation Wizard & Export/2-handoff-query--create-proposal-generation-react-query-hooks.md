I have the following user query that I want you to help me with. Please implement the requested functionality following best practices.

Implement custom hooks for proposal generation workflow:

- Create frontend/src/hooks/useProposal.ts with hooks: `useGenerateProposalMutation`, `useTaskStatusQuery`, `useExportCSV`
- Implement task polling logic in `useTaskStatusQuery` (poll every 2s when status is PENDING/STARTED)
- Add error handling and retry logic following patterns from `c:\Users\SSTECH\developments\apps\solarepc-pro\frontend\src\hooks\useSiteDesigns.ts`
- Include proper cache invalidation and toast notifications