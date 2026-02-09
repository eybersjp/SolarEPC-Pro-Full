I have the following user query that I want you to help me with. Please implement the requested functionality following best practices.

Build the version creation modal component:

- Create frontend/src/components/DesignCanvas/SaveVersionModal.tsx using Dialog from `c:\Users\SSTECH\developments\apps\solarepc-pro\frontend\src\components\ui\dialog.tsx`
- Add form with version name input (required) and notes textarea (optional)
- Integrate `useCreateVersionMutation` hook for saving
- Add validation for version name (min 1 char, max 255 chars)
- Show loading state during save and success/error toast notifications
- Follow the modal pattern from `ProposalWizard` in `c:\Users\SSTECH\developments\apps\solarepc-pro\frontend\src\components\DesignCanvas\ProposalWizard.tsx`