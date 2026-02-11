export const mockTender = {
    id: 'tender-1',
    name: 'Test Tender',
    client_name: 'Test Client',
    target_capacity_kw: 1000,
    latitude: 37.7749,
    longitude: -122.4194,
    status: 'active' as const,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
}

export const mockTenderWithDesigns = {
    ...mockTender,
    designs: [
        {
            id: 'design-1',
            name: 'Design 1',
            status: 'draft' as const,
            created_at: new Date().toISOString(),
        }
    ]
}
