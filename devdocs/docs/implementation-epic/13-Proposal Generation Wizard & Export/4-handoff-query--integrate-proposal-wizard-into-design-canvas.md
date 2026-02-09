I have the following user query that I want you to help me with. Please implement the requested functionality following best practices.

Connect wizard to design canvas toolbar and add session persistence:

- Update `c:\Users\SSTECH\developments\apps\solarepc-pro\frontend\src\components\DesignCanvas\Toolbar.tsx` to open ProposalWizard on "Generate Proposal" button click
- Add wizard state management (open/close, current step, form data) using React state or Zustand store
- Implement session persistence for wizard state (localStorage) so users can close and reopen
- Pass designId prop to wizard component
- Add proper cleanup on wizard close/completion