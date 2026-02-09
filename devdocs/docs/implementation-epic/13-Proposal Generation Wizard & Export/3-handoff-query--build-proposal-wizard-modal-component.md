I have the following user query that I want you to help me with. Please implement the requested functionality following best practices.

Create multi-step wizard modal for proposal generation:

- Create frontend/src/components/DesignCanvas/ProposalWizard.tsx with 3 steps (Configure, Preview, Download)
- Use existing `Dialog` component from `c:\Users\SSTECH\developments\apps\solarepc-pro\frontend\src\components\ui\dialog.tsx`
- Step 1: Proposal title input, section checkboxes (5 options matching backend schema)
- Step 2: Loading state with task polling, PDF preview placeholder (iframe or message)
- Step 3: Download buttons for PDF and CSV with proper file handling
- Add step navigation, error states, and retry functionality
- Include loading overlays and progress indicators