# SolarEPC Pro Frontend

Foundational frontend infrastructure for SolarEPC Pro, built with Next.js, shadcn/ui, and React Query.

## Project Structure

- `src/app`: Next.js App Router pages and layouts.
- `src/components/ui`: Base UI components from shadcn/ui.
- `src/components/common`: Shared reusable components (EmptyState, LoadingSpinner, etc.).
- `src/lib/api.ts`: Centralized API client using Fetch API and Firebase Auth.
- `src/lib/hooks`: Custom React Query hooks for data fetching and mutations.
- `src/lib/queryKeys.ts`: Query key factory for consistent cache management.
- `src/types`: TypeScript interfaces for API responses and request bodies.

## Getting Started

1.  **Clone the repository.**
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Setup environment variables:**
    Copy `.env.local.example` to `.env.local` and fill in the required values.
4.  **Run the development server:**
    ```bash
    npm run dev
    ```

## Available Hooks

### Tenders
- `useTenders(filters)`: List all tenders.
- `useTender(id)`: Get a single tender.
- `useCreateTender()`: Create a new tender.
- `useUpdateTender()`: Update an existing tender.
- `useDeleteTender()`: Delete a tender.

### PV Designs
- `usePVDesigns(tenderId)`: List all designs for a tender.
- `usePVDesign(tenderId, designId)`: Get a single design with validation.
- `useCreatePVDesign()`: Create a new design.
- `useDeletePVDesign()`: Delete a design.

### Preconditions
- `usePreconditions(tenderId)`: Get preconditions and blockers.
- `useUpdatePreconditions()`: Update preconditions.

### BOQ
- `useBOQ(tenderId)`: Get BOQ items and summary totals.
- `useCreateBOQItem()`: Add a new BOQ item.
- `useUpdateBOQItem()`: Update an existing BOQ item (supports optimistic updates).
- `useDeleteBOQItem()`: Remove a BOQ item.
- `useExportBOQ()`: Export BOQ as CSV or JSON.

## Development Workflow

- Use `shadcn-ui` for new components.
- Always use the centralized `api.ts` for backend interactions.
- Prefer using custom hooks from `src/lib/hooks` for data management.
- Ensure all types are updated in `src/types/index.ts` to match backend Pydantic schemas.
