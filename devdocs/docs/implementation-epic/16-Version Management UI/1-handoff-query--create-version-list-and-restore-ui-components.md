I have the following user query that I want you to help me with. Please implement the requested functionality following best practices.

Build version listing and restore functionality:

- Create frontend/src/components/DesignCanvas/VersionList.tsx component
- Display versions in a list/dropdown showing: version name, created date, created by, notes preview, total modules, system size
- Integrate `useVersionsQuery` hook for fetching versions
- Add restore button for each version that triggers confirmation modal
- Create restore confirmation modal using Dialog component
- Integrate `useRestoreVersionMutation` with proper error handling
- Add loading states during restore operation
- Show toast notification after successful restore: "Restored to version: [name]"
- Reference `DesignsList` component in `c:\Users\SSTECH\developments\apps\solarepc-pro\frontend\src\components\SiteDesigns\DesignsList.tsx` for list UI patterns