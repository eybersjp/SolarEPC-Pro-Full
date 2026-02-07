import { GeoJSONPolygon } from "@/types";

export const createValidPolygon = (): GeoJSONPolygon => ({
    type: "Polygon",
    coordinates: [
        [
            [0, 0],
            [0, 10],
            [10, 10],
            [10, 0],
            [0, 0],
        ],
    ],
});

export const createInvalidPolygon = (issue: "unclosed" | "too_few_points"): GeoJSONPolygon => {
    if (issue === "unclosed") {
        return {
            type: "Polygon",
            coordinates: [
                [
                    [0, 0],
                    [0, 10],
                    [10, 10],
                    [10, 0],
                ],
            ],
        };
    }
    // too_few_points
    return {
        type: "Polygon",
        coordinates: [
            [
                [0, 0],
                [0, 10],
                [0, 0],
            ],
        ],
    };
};

export const createSelfIntersectingPolygon = (): GeoJSONPolygon => ({
    type: "Polygon",
    coordinates: [
        [
            [0, 0],
            [10, 10],
            [0, 10],
            [10, 0],
            [0, 0],
        ],
    ],
});
