'use client';

import { Voxel, ModelTemplate } from '@/lib/voxel-types';

/**
 * Downloads a model template as a JSON file.
 */
export function exportModelLocally(name: string, voxels: Omit<Voxel, 'id' | 'worldId'>[]) {
    const template: ModelTemplate = {
        name,
        version: '2.0',
        voxels
    };
    
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(template));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `${name.replace(/\s+/g, '_').toLowerCase()}.rpv2`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

/**
 * Parses a local file into a ModelTemplate.
 */
export async function importModelLocally(file: File): Promise<ModelTemplate> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target?.result as string);
                resolve(json as ModelTemplate);
            } catch (e) {
                reject(new Error("Invalid model file format."));
            }
        };
        reader.onerror = (error) => reject(error);
        reader.readAsText(file);
    });
}
