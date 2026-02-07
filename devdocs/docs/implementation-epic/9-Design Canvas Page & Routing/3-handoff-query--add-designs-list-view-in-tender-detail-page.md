I have the following user query that I want you to help me with. Please implement the requested functionality following best practices.

Create the designs list view in the tender detail page:

- Update `c:\Users\SSTECH\developments\apps\solarepc-pro\frontend\src\app\tenders[id]\page.tsx` to add a "Designs" tab
- Create design list component showing all site designs for the tender (use `useSiteDesignsQuery` hook)
- Add "Create New Design" button that navigates to the design canvas
- Show design cards with: name, created date, total modules, system size
- Show empty state when no designs exist
- Handle navigation to design canvas when clicking a design card