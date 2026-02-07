I have the following user query that I want you to help me with. Please implement the requested functionality following best practices.

Create frontend API integration and hooks for equipment:

- Add equipment API methods in `c:\Users\SSTECH\developments\apps\solarepc-pro\frontend\src\lib\api.ts` (GET /api/equipment/modules, GET /api/equipment/inverters)
- Add equipment types to `c:\Users\SSTECH\developments\apps\solarepc-pro\frontend\src\types\index.ts` (EquipmentModule, EquipmentInverter interfaces matching backend schemas)
- Create frontend/src/hooks/useEquipment.ts with React Query hooks: `useEquipmentModulesQuery()`, `useEquipmentInvertersQuery()`
- Add equipment query keys to `c:\Users\SSTECH\developments\apps\solarepc-pro\frontend\src\lib\queryKeys.ts`