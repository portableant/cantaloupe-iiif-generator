// src/generateCantaloupeIIIFManifests.js

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// --- Configuration ---
const DIRECTUS_API_URL = 'https://directus.museologi.st'; // Your Directus API URL
const CANTALOUPE_IIIF_URL = 'https://iiif.museologi.st/iiif/3'; // Your Cantaloupe IIIF endpoint for v3
const PUBLIC_MANIFEST_BASE_URL = 'https://manifests.museologi.st'; // Where your static manifests will be served
const OUTPUT_DIR = path.join(__dirname, '../docs'); // Output directory for static manifests
const DIRECTUS_COLLECTION_NAME = 'iiif_images'; // The Directus collection holding your items with image files
const FILE_FIELD_NAME = 'image'; // The field in your Directus collection that links to a directus_files entry
// const ACCESS_TOKEN = process.env.DIRECTUS_ACCESS_TOKEN || ''; // Optional: for private Directus collections

// --- Main Manifest Generation Logic ---

async function fetchDirectusData() {
    try {
        const headers = {};
        // if (ACCESS_TOKEN) {
        //     headers['Authorization'] = `Bearer ${ACCESS_TOKEN}`;
        // }

        // Fetch items, ensuring we pull the full file details for the linked image field(s).
        // The `fields` parameter is crucial here for Directus's relational data.
        const fieldsToFetch = [
            'id',
            'image.*',
            'title',
            'description',
            'annotations',
            'license',
            'source_collection',
            'date_created'
        ].join(',');

        const response = await axios.get(`${DIRECTUS_API_URL}/items/${DIRECTUS_COLLECTION_NAME}`, {
            params: {
                fields: fieldsToFetch,
                filter: { status: { _eq: 'published' } } 
            },
            headers: headers
        });
        return response.data.data;
    } catch (error) {
        console.error('Error fetching data from Directus:', error.message);
        if (axios.isAxiosError(error) && error.response) {
            console.error('Directus Response Status:', error.response.status);
            console.error('Directus Response Data:', error.response.data);
        }
        process.exit(1);
    }
}
/**
 * Fetches the IIIF Image API info.json from Cantaloupe for a given filename.
 * @param {string} cantaloupeImageIdentifier The filename or identifier for the image (e.g., "my_image.jpg").
 * @returns {Promise<object|null>} The parsed info.json object, or null if not found.
 */
async function fetchCantaloupeInfoJson(cantaloupeImageIdentifier) {
    const url = `${CANTALOUPE_IIIF_URL}/${cantaloupeImageIdentifier}/info.json`;
    try {
        const response = await axios.get(url);
        console.log(`Fetched Cantaloupe info.json for: ${cantaloupeImageIdentifier}`);
        return response.data;
    } catch (error) {
        console.warn(`Could not fetch Cantaloupe info.json for ${cantaloupeImageIdentifier}: ${error.message}`);
        return null;
    }
}


/**
 * Creates a IIIF Presentation 3.0 Manifest from a Directus item.
 * @param {object} item The Directus item data.
 * @returns {Promise<object|null>} A IIIFManifest object or null if no valid images are found.
 */
async function createIIIFManifest(item) {
   
    console.log(item[FILE_FIELD_NAME]['filename_disk']);
    const linkedImageData = item[FILE_FIELD_NAME]['filename_disk'];

    if (!linkedImageData) {
        console.warn(`Item "${item.title || item.id}" has no associated image file in the '${FILE_FIELD_NAME}' field. Skipping manifest generation.`);
        return null;
    }

    const manifestId = `${PUBLIC_MANIFEST_BASE_URL}/${path.parse(linkedImageData).name}.json`;
    const canvases = [];
    const thumbnailServices = [];

    // Since we only have a single image, process it directly
    const cantaloupeImageIdentifier = linkedImageData; // Use the filename as the identifier for Cantaloupe
    const cantaloupeImageServiceBaseUrl = `${CANTALOUPE_IIIF_URL}/${cantaloupeImageIdentifier}`;

    // Fetch info.json to get width and height
    const infoJson = await fetchCantaloupeInfoJson(cantaloupeImageIdentifier);

    let imageWidth = 0;
    let imageHeight = 0;

    if (infoJson && infoJson.width && infoJson.height) {
        imageWidth = infoJson.width;
        imageHeight = infoJson.height;
        console.log(`Found dimensions for ${cantaloupeImageIdentifier}: ${imageWidth}x${imageHeight}`);
    } else {
        console.warn(`Could not determine dimensions for ${cantaloupeImageIdentifier}. Canvas will have 0x0 dimensions.`);
    }

    const canvasId = `${manifestId}/canvas/p1`;
    const annotationPageId = `${canvasId}/annotationpage/1`;
    const annotationId = `${annotationPageId}/annotation/1`;

    canvases.push({
        id: canvasId,
        type: 'Canvas',
        height: imageHeight,
        width: imageWidth,
        label: item[FILE_FIELD_NAME].title ? { en: [item[FILE_FIELD_NAME].title] } : undefined,
        description: item.description ? { en: [item.description] } : undefined,
        items: [
            {
                id: annotationPageId,
                type: 'AnnotationPage',
                items: [
                    {
                        id: annotationId,
                        type: 'Annotation',
                        motivation: 'painting',
                        body: {
                            id: `${cantaloupeImageServiceBaseUrl}/full/max/0/default.jpg`,
                            type: 'Image',
                            format: item[FILE_FIELD_NAME].type || 'image/jpeg',
                            width: imageWidth,
                            height: imageHeight,
                            service: [
                                {
                                    id: cantaloupeImageServiceBaseUrl,
                                    type: 'ImageService3',
                                    profile: 'http://iiif.io/api/image/3/level2.json'
                                }
                            ]
                        },
                        target: canvasId
                    }
                ]
            }
        ]
    });

    if (item.annotations) {
        // Push annotations into the last canvas object after 'items'
        const lastCanvas = canvases[canvases.length - 1];
        if (lastCanvas) {
            lastCanvas.annotations = Array.isArray(item.annotations) ? item.annotations : [item.annotations];
        }
    }
    // Add a thumbnail for the manifest (from the single image)
    thumbnailServices.push({
        id: `${cantaloupeImageServiceBaseUrl}/full/256,/0/default.jpg`,
        type: 'Image',
        service: [
            {
                id: cantaloupeImageServiceBaseUrl,
                type: 'ImageService3',
                profile: 'http://iiif.io/api/image/3/level2.json'
            }
        ]
    });

    if (canvases.length === 0) {
        return null; // No valid canvases generated
    }

    // Add metadata from Directus item
    const metadata = [];
   
    if (item.description) {
        metadata.push({ label: { en: ['Summary'] }, value: { en: [item.description] } });
    }
    if (item.creator) {
        metadata.push({ label: { en: ['Creator'] }, value: { en: [item.creator] } });
    }
    if (item.date_created) {
        metadata.push({ label: { en: ['Date Created'] }, value: { en: [item.date_created] } });
    }
    if (item.license && item.license.length > 0) {
        metadata.push({ label: { en: ['License'] }, value: { en: [item.license] } });
    }
    if (item.source) {
        metadata.push({ label: { en: ['Source'] }, value: { en: [item.source] } });
    }  
    if (item.attribution) {
        metadata.push({ label: { en: ['Attribution'] }, value: { en: [item.attribution] } });
    }  
    if (item.rights) {
        metadata.push({ label: { en: ['Rights'] }, value: { en: [item.rights] } });
    }
    // You can add more metadata fields here based on your Directus item schema

    const manifest = {
        '@context': 'http://iiif.io/api/presentation/3/context.json',
        id: manifestId,
        type: 'Manifest',
        label: { en: [item.title || `Item ${item.id}`] },
        summary: item.description ? { en: [item.description] } : undefined,
        items: canvases,
        thumbnail: thumbnailServices.length > 0 ? thumbnailServices : undefined,
        metadata: metadata.length > 0 ? metadata : undefined,
        // Add other properties as needed, e.g., rights, homepage, etc.
    };

    return manifest;
}

async function generateStaticManifests() {
    console.log('Starting IIIF manifest generation from Directus for Cantaloupe...');

    // Create output directory if it doesn't exist
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        console.log(`Created output directory: ${OUTPUT_DIR}`);
    } else {
        console.log(`Output directory already exists: ${OUTPUT_DIR}`);
    }

    const directusItems = await fetchDirectusData();

    console.log(`Fetched ${directusItems.length} items from Directus collection: ${DIRECTUS_COLLECTION_NAME}.`);
    let generatedCount = 0;
    for (const item of directusItems) {
        // Await the manifest creation as it now involves async calls to Cantaloupe
        const manifest = await createIIIFManifest(item);
        if (manifest) {
            const fname = path.parse(item.image.filename_disk).name;
            const fileName = `${fname}.json`;
            const filePath = path.join(OUTPUT_DIR, fileName);

            try {
                fs.writeFileSync(filePath, JSON.stringify(manifest, null, 2), 'utf8');
                console.log(`Generated manifest for item ${item.id}: ${filePath}`);
                generatedCount++;
            } catch (error) {
                console.error(`Error writing manifest for item ${item.id}:`, error);
            }
        }
    }

    console.log(`IIIF manifest generation complete. Generated ${generatedCount} manifests.`);
}

// --- Execution ---
generateStaticManifests();