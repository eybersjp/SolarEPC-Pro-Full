I have the following user query that I want you to help me with. Please implement the requested functionality following best practices.

Build the Equipment Configuration UI in the right panel:

- Create frontend/src/components/DesignCanvas/EquipmentSelector.tsx with searchable dropdowns for modules and inverters using shadcn Select component
- Display selected equipment specifications (wattage, dimensions, efficiency for modules; capacity, voltage range for inverters)
- Integrate with `useEquipmentModulesQuery()` and `useEquipmentInvertersQuery()` hooks
- Update `c:\Users\SSTECH\developments\apps\solarepc-pro\frontend\src\components\DesignCanvas\RightPanel.tsx` to include EquipmentSelector component
- Equipment selection triggers immediate save via `useUpdateSiteDesignMutation` with equipment IDs
- Add loading states and error handling for equipment fetching