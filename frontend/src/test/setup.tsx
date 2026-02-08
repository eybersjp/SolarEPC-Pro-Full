import '@testing-library/jest-dom/vitest'
import { beforeAll, afterEach, afterAll, vi } from 'vitest'
import { server } from './mocks/server'

// Establish API mocking before all tests.
beforeAll(() => server.listen())

// Reset any request handlers that we may add during the tests,
// so they don't affect other tests.
afterEach(() => {
    server.resetHandlers()
    vi.clearAllMocks()
})

// Clean up after the tests are finished.
afterAll(() => server.close())

// Mock Leaflet
vi.mock('react-leaflet', () => ({
    MapContainer: ({ children }: any) => <div data-testid="map-container">{children}</div>,
    TileLayer: () => <div data-testid="tile-layer" />,
    Polygon: (props: any) => <div data-testid="polygon" {...props} />,
    Polyline: (props: any) => <div data-testid="polyline" {...props} />,
    Marker: (props: any) => <div data-testid="marker" {...props} />,
    useMap: () => ({
        addLayer: vi.fn(),
        removeLayer: vi.fn(),
        project: vi.fn((latlng: { lat: number, lng: number }) => ({ x: latlng.lng, y: latlng.lat })),
        unproject: vi.fn((point: { x: number, y: number }) => ({ lat: point.y, lng: point.x })),
        getBounds: vi.fn(() => ({
            getSouthWest: () => ({ lat: 0, lng: 0 }),
            getNorthEast: () => ({ lat: 10, lng: 10 }),
        })),
        getSize: vi.fn(() => ({ x: 100, y: 100 })),
        on: vi.fn(),
        off: vi.fn(),
    }),
    useMapEvents: vi.fn(),
}))

vi.mock('leaflet', () => {
    const L = {
        Icon: {
            Default: {
                prototype: {
                    _getIconUrl: vi.fn(),
                },
            },
        },
        latLng: vi.fn((lat: number, lng: number) => ({ lat, lng })),
        polygon: vi.fn(() => ({
            addTo: vi.fn(),
            on: vi.fn(),
        })),
        divIcon: vi.fn(() => ({})),
        DomEvent: {
            stopPropagation: vi.fn(),
        },
    };
    return {
        ...L,
        default: L,
    };
})

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
}))

vi.mock('firebase/auth', () => ({
    getAuth: vi.fn(() => ({
        currentUser: {
            getIdToken: vi.fn(() => Promise.resolve('mock-token')),
        },
    })),
}))

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(), // deprecated
        removeListener: vi.fn(), // deprecated
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })),
})

// Mock pointer capture methods for Radix UI
window.HTMLElement.prototype.hasPointerCapture = vi.fn();
window.HTMLElement.prototype.setPointerCapture = vi.fn();
window.HTMLElement.prototype.releasePointerCapture = vi.fn();
window.Element.prototype.hasPointerCapture = vi.fn();
window.Element.prototype.setPointerCapture = vi.fn();
window.Element.prototype.releasePointerCapture = vi.fn();
window.HTMLElement.prototype.scrollIntoView = vi.fn();
window.Element.prototype.scrollIntoView = vi.fn();
