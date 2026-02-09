import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { DesignsList } from '../DesignsList';
import { renderWithProviders } from '@/test/utils';
import { createMockSiteDesign } from '@/test/fixtures/siteDesign';
import { format } from 'date-fns';

describe('DesignsList', () => {
    const tenderId = 'tender-123';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render skeleton cards while loading', () => {
        const { container } = renderWithProviders(
            <DesignsList designs={undefined} isLoading={true} tenderId={tenderId} />
        );

        // Find the grid container
        const grid = container.querySelector('.grid-cols-1');
        expect(grid).toBeInTheDocument();

        // Check for 3 cards
        const cards = container.querySelectorAll('.overflow-hidden');
        // Filter out any other elements that might have overflow-hidden if necessary, 
        // but here it should be the 3 cards.
        const skeletonCards = Array.from(cards).filter(el => el.querySelector('.animate-pulse'));
        expect(skeletonCards).toHaveLength(3);

        // Ensure no actual data is shown (e.g. "Modules" or "kWp")
        expect(screen.queryByText(/Modules/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/kWp/i)).not.toBeInTheDocument();
    });

    it('should render empty state when no designs exist', () => {
        renderWithProviders(
            <DesignsList designs={[]} isLoading={false} tenderId={tenderId} />
        );

        expect(screen.getByText(/No designs found/i)).toBeInTheDocument();
        expect(screen.getByText(/Create your first site design/i)).toBeInTheDocument();

        const createButton = screen.getByRole('link', { name: /Create New Design/i });
        expect(createButton).toHaveAttribute('href', `/tenders/${tenderId}/design/new`);
    });

    it('should navigate to create new design from empty state', () => {
        renderWithProviders(
            <DesignsList designs={[]} isLoading={false} tenderId={tenderId} />
        );

        const createButton = screen.getByRole('link', { name: /Create New Design/i });
        expect(createButton).toHaveAttribute('href', `/tenders/${tenderId}/design/new`);
    });

    it('should render design cards with correct data', () => {
        const mockDesigns = [
            createMockSiteDesign({
                id: 'design-1',
                name: 'Test Design 1',
                total_modules: 120,
                system_size_kwp: 66.5,
                created_at: '2024-01-15T10:00:00Z'
            }),
            createMockSiteDesign({
                id: 'design-2',
                name: 'Test Design 2',
                total_modules: 80,
                system_size_kwp: 44.2,
                created_at: '2024-01-16T10:00:00Z'
            })
        ];

        renderWithProviders(
            <DesignsList designs={mockDesigns} isLoading={false} tenderId={tenderId} />
        );

        expect(screen.getByText('Test Design 1')).toBeInTheDocument();
        expect(screen.getByText('120')).toBeInTheDocument();
        expect(screen.getByText('66.5 kWp')).toBeInTheDocument();
        expect(screen.getByText('Jan 15, 2024')).toBeInTheDocument();

        expect(screen.getByText('Test Design 2')).toBeInTheDocument();
        expect(screen.getByText('80')).toBeInTheDocument();
        expect(screen.getByText('44.2 kWp')).toBeInTheDocument();
        expect(screen.getByText('Jan 16, 2024')).toBeInTheDocument();
    });

    it('should format dates correctly using date-fns', () => {
        const design = createMockSiteDesign({
            created_at: '2024-05-20T12:00:00Z'
        });

        renderWithProviders(
            <DesignsList designs={[design]} isLoading={false} tenderId={tenderId} />
        );

        const formattedDate = format(new Date(design.created_at), "MMM d, yyyy");
        expect(screen.getByText(formattedDate)).toBeInTheDocument();
        expect(screen.getByText('May 20, 2024')).toBeInTheDocument();
    });

    it('should display system size with one decimal precision', () => {
        const design = createMockSiteDesign({
            system_size_kwp: 44.567
        });

        renderWithProviders(
            <DesignsList designs={[design]} isLoading={false} tenderId={tenderId} />
        );

        expect(screen.getByText('44.6 kWp')).toBeInTheDocument();
    });

    it('should navigate to design canvas when clicking Open Canvas button', () => {
        const design = createMockSiteDesign({ id: 'design-abc' });

        renderWithProviders(
            <DesignsList designs={[design]} isLoading={false} tenderId={tenderId} />
        );

        const openButton = screen.getByRole('link', { name: /Open Canvas/i });
        expect(openButton).toHaveAttribute('href', `/tenders/${tenderId}/design/design-abc`);
    });

    it('should render correct number of design cards', () => {
        const mockDesigns = Array.from({ length: 5 }, (_, i) =>
            createMockSiteDesign({ id: `design-${i}` })
        );

        renderWithProviders(
            <DesignsList designs={mockDesigns} isLoading={false} tenderId={tenderId} />
        );

        const cards = screen.getAllByRole('link', { name: /Open Canvas/i });
        expect(cards).toHaveLength(5);
    });

    it('should apply responsive grid classes', () => {
        const mockDesigns = [createMockSiteDesign()];

        const { container } = renderWithProviders(
            <DesignsList designs={mockDesigns} isLoading={false} tenderId={tenderId} />
        );

        const gridContainer = container.firstChild as HTMLElement;
        expect(gridContainer).toHaveClass('grid');
        expect(gridContainer).toHaveClass('grid-cols-1');
        expect(gridContainer).toHaveClass('md:grid-cols-2');
        expect(gridContainer).toHaveClass('lg:grid-cols-3');
        expect(gridContainer).toHaveClass('gap-4');
    });

    it('should handle designs with zero modules gracefully', () => {
        const design = createMockSiteDesign({
            total_modules: 0,
            system_size_kwp: 0
        });

        renderWithProviders(
            <DesignsList designs={[design]} isLoading={false} tenderId={tenderId} />
        );

        expect(screen.getByText('0')).toBeInTheDocument();
        expect(screen.getByText('0.0 kWp')).toBeInTheDocument();
    });

    it('should handle very long design names', () => {
        const longName = "Very Long Design Name That Should Be Truncated Because It Exceeds Maximum Width";
        const design = createMockSiteDesign({ name: longName });

        renderWithProviders(
            <DesignsList designs={[design]} isLoading={false} tenderId={tenderId} />
        );

        const nameElement = screen.getByText(longName);
        expect(nameElement).toBeInTheDocument();
        expect(nameElement).toHaveClass('truncate');
    });

    it('should render single design correctly', () => {
        const design = createMockSiteDesign();

        renderWithProviders(
            <DesignsList designs={[design]} isLoading={false} tenderId={tenderId} />
        );

        expect(screen.getAllByRole('link', { name: /Open Canvas/i })).toHaveLength(1);
    });

    it('should have accessible card structure', () => {
        const design = createMockSiteDesign({ name: 'Accessible Design' });

        renderWithProviders(
            <DesignsList designs={[design]} isLoading={false} tenderId={tenderId} />
        );

        const title = screen.getByText('Accessible Design');
        expect(title.tagName).toBe('H3'); // CardTitle usually renders h3 or similar
        expect(title).toHaveClass('font-semibold');
    });

    it('should apply hover classes to cards', () => {
        const design = createMockSiteDesign();

        const { container } = renderWithProviders(
            <DesignsList designs={[design]} isLoading={false} tenderId={tenderId} />
        );

        // find the card element - it's the one with 'group' class
        const card = container.querySelector('.group');
        expect(card).toHaveClass('hover:shadow-md');
        expect(card).toHaveClass('transition-shadow');

        const button = screen.getByRole('link', { name: /Open Canvas/i });
        expect(button).toHaveClass('group-hover:bg-primary');
    });
});
