// src/generateCantaloupeIIIFManifests.js

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// --- Configuration ---
const DIRECTUS_API_URL = 'https://directus.museologi.st'; // Your Directus API URL
const CANTALOUPE_IIIF_URL = 'https://iiif.museologi.st/iiif/3'; // Your Cantaloupe IIIF endpoint for v3
const PUBLIC_MANIFEST_BASE_URL = 'https://manifests.museologi.st'; // Where your static manifests will be served
const OUTPUT_DIR = path.join(__dirname, '../docs'); // Output directory for static manifests
const DIRECTUS_COLLECTION_NAME = 'Historic_England_Raf'; // The Directus collection holding your items with image files
const FILE_FIELD_NAME = 'filename'; // The field in your Directus collection that links to a directus_files entry
//const ACCESS_TOKEN = process.env.DIRECTUS_ACCESS_TOKEN || ''; // Optional: for private Directus collections

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
            'filename',
           // 'title',
           // 'description',
            //'creator', // Example metadata field
            'date_created'
        ].join(',');

        const response = await axios.get(`${DIRECTUS_API_URL}/items/${DIRECTUS_COLLECTION_NAME}`, {
            params: {
                fields: fieldsToFetch,
                // filter: { status: { _eq: 'published' } } // Example filter
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
 * Creates a IIIF Presentation 3.0 Manifest from a Directus item.
 * @param {object} item The Directus item data.
 * @returns {object|null} A IIIFManifest object or null if no valid images are found.
 */
function createIIIFManifest(item) {
    // Normalize the image data to an array of file objects
    let itemImages = [];
    const linkedImageData = item[FILE_FIELD_NAME];

    if (linkedImageData) {
        if (Array.isArray(linkedImageData)) {
            itemImages = linkedImageData;
        } else {
            itemImages = [linkedImageData];
        }
    }

    if (itemImages.length === 0) {
        console.warn(`Item "${item.title || item.id}" has no associated image files in the '${FILE_FIELD_NAME}' field. Skipping manifest generation.`);
        return null;
    }

    const manifestId = `${PUBLIC_MANIFEST_BASE_URL}/${item.id}.json`;
    const canvases = [];
    const thumbnailServices = [];

    itemImages.forEach((imageFile, index) => {
        // Cantaloupe IIIF Image API 3.0 URL pattern: /{identifier}/info.json
        const cantaloupeImageServiceId = `${CANTALOUPE_IIIF_URL}/${item.filename}`;
        const canvasId = `${manifestId}/canvas/p${index + 1}`;
        const annotationPageId = `${canvasId}/annotationpage/1`;
        const annotationId = `${annotationPageId}/annotation/1`;

        // if (!imageFile.width || !imageFile.height) {
        //     console.warn(`Warning: Image ${imageFile.filename_disk} for item ${item.id} is missing width/height. Skipping this image in manifest.`);
        //     return; // Skip this image if dimensions are missing
        // }

        canvases.push({
            id: canvasId,
            type: 'Canvas',
            height: imageFile.height,
            width: imageFile.width,
            label: imageFile.title ? { en: [imageFile.title] } : undefined, // Canvas label from file title
            items: [
                {
                    id: annotationPageId,
                    type: 'AnnotationPage',
                    items: [
                        {
                            id: annotationId,
                            type: 'Annotation',
                            motivation: 'identifying',
                            body: {
                                id: `${cantaloupeImageServiceId}/full/max/0/default.jpg`, // Example image request URL
                                type: 'Image',
                                format: imageFile.type || 'image/jpeg', // Fallback format
                                width: imageFile.width,
                                height: imageFile.height,
                                service: [
                                    {
                                        id: cantaloupeImageServiceId,
                                        type: 'ImageService3',
                                        profile: 'http://iiif.io/api/image/3/level2.json' // Cantaloupe usually supports level 2
                                    }
                                ]
                            },
                            target: canvasId
                        }
                    ]
                }
            ]
        });

        // Add a thumbnail for the manifest (e.g., the first image's service)
        if (index === 0) {
            thumbnailServices.push({
                id: `${cantaloupeImageServiceId}/full/256,/0/default.jpg`, // Example thumbnail request
                type: 'Image',
                service: [
                    {
                        id: cantaloupeImageServiceId,
                        type: 'ImageService3',
                        profile: 'http://iiif.io/api/image/3/level2.json'
                    }
                ]
            });
        }
    });

    if (canvases.length === 0) {
        return null; // No valid canvases generated
    }

    // Add metadata from Directus item
    const metadata = [];
    if (item.creator) {
        metadata.push({ label: { en: ['Creator'] }, value: { en: [item.creator] } });
    }
    if (item.date_created) {
        metadata.push({ label: { en: ['Date Created'] }, value: { en: [item.date_created] } });
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
        const manifest = createIIIFManifest(item);
        if (manifest) {
            const fname = path.parse(item.filename).name;
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