I have the following user query that I want you to help me with. Please implement the requested functionality following best practices.

Create comprehensive tests for wizard component and hooks:

- Create frontend/src/components/DesignCanvas/**tests**/ProposalWizard.test.tsx testing all three steps, navigation, error states
- Create frontend/src/hooks/**tests**/useProposal.test.tsx testing mutations, polling logic, error handling
- Mock API responses and task status transitions (PENDING → STARTED → SUCCESS/FAILURE)
- Test CSV download functionality and file handling
- Follow testing patterns from <traycer-file absPath="c:\Users\SSTECH\developments\apps\solarepc-pro\frontend\src\components\DesignCanvas_*tests*_\ResultsBottomSheet.test.tsx">frontend/src/components/DesignCanvas/**tests**/ResultsBottomSheet.test.tsx</traycer-file>