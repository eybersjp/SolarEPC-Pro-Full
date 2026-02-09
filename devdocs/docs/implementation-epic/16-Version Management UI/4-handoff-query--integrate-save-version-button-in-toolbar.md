I have the following user query that I want you to help me with. Please implement the requested functionality following best practices.

Add version creation functionality to the toolbar:

- Update `c:\Users\SSTECH\developments\apps\solarepc-pro\frontend\src\components\DesignCanvas\Toolbar.tsx` to add "Save as Version" button
- Integrate `SaveVersionModal` component with open/close state management
- Replace the existing "Save Copy" button with "Save as Version" button
- Add version indicator showing current version name (if design was loaded from a version)
- Update toolbar to show unsaved changes indicator (*) when modified since last version
- Follow existing button patterns and state management from the toolbar