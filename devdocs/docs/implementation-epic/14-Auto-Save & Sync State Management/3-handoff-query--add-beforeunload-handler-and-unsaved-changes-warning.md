I have the following user query that I want you to help me with. Please implement the requested functionality following best practices.

Implement unsaved changes warning when leaving the page:

- Add beforeunload event handler in `c:\Users\SSTECH\developments\apps\solarepc-pro\frontend\src\app\tenders[id]\design[designId]\page.tsx`
- Show browser warning dialog if sync state is 'pending' or 'failed'
- Add custom modal warning when navigating away using Next.js router
- Update `c:\Users\SSTECH\developments\apps\solarepc-pro\frontend\src\components\DesignCanvas\Toolbar.tsx` to show warning when clicking "Back to Designs" button if there are unsaved changes