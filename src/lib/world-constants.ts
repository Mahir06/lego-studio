
// World size is reduced to 20x20 to ensure the initial
// ground plane can be created within Firestore's batch write limit of 500 documents.
export const WORLD_WIDTH = 20;
export const WORLD_DEPTH = 20;
export const WORLD_HEIGHT = 64; // Height in layers of plates
