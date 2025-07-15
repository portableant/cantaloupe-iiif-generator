// Import required modules
const fs = require('fs');
const path = require('path');

// Define the path to the 'docs' directory (one level up from current file)
const docsDirectory = path.join(__dirname, '..', 'docs');
// Output directory is the same as docsDirectory
const outputDirectory = docsDirectory;
// Name of the output HTML file
const outputFileName = 'index.html';

const repositoryUrl = 'https://github.com/portableant/cantaloupe-iiif-generator/'; // URL of the GitHub repository
/**
 * Generates an HTML string for a list of files with pagination and manifest details.
 * @param {string[]} files - Array of file names in the directory.
 * @param {string} directoryPath - Path to the directory containing the files.
 * @returns {string} - Complete HTML string for the index page.
 */
function generateHtmlContent(files, directoryPath) {
    let listItems = '';
    files.forEach(file => {
        // Skip certain files from the listing
        if (file.toUpperCase() === 'CNAME' || file === 'styles.css') return;

        const filePath = path.join(directoryPath, file);
        const stats = fs.statSync(filePath); // Get file stats

        // Format the created date for display
        const createdDate = stats.birthtime
            ? new Date(stats.birthtime).toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-')
            : '';
        // Format file size for display (if not a directory)
        const fileSize = !stats.isDirectory()
            ? `${(stats.size / 1024).toFixed(1)} KB`
            : '';

        // Variables for manifest details
        let hasAnnotations = false;
        let manifestTitle = '';
        let annotationCount = 0;

        // If the file is a JSON manifest, try to extract title and annotation info
        if (!stats.isDirectory() && file.endsWith('.json')) {
            try {
                const content = fs.readFileSync(path.join(directoryPath, file), 'utf8');
                const json = JSON.parse(content);

                // Count annotations at the manifest level (IIIF v3)
                if (json && typeof json === 'object' && Array.isArray(json.annotations)) {
                    annotationCount = json.annotations.reduce((sum, page) => {
                        if (Array.isArray(page.items)) {
                            return sum + page.items.length;
                        }
                        return sum;
                    }, 0);
                    hasAnnotations = annotationCount > 0;
                } else if (Array.isArray(json.items)) {
                    // Check for annotations in items (e.g., canvases)
                    json.items.forEach(item => {
                        if (Array.isArray(item.annotations)) {
                            annotationCount += item.annotations.reduce((sum, page) => {
                                if (Array.isArray(page.items)) {
                                    return sum + page.items.length;
                                }
                                return sum;
                            }, 0);
                        }
                    });
                    hasAnnotations = annotationCount > 0;
                }

                // Extract manifest title (IIIF v3: label, v2: label or title)
                if (json) {
                    if (json.label) {
                        // IIIF v3: label is an object with language keys
                        if (typeof json.label === 'object' && !Array.isArray(json.label)) {
                            // Prefer English, fallback to any available language
                            manifestTitle = json.label.en?.[0] || Object.values(json.label)[0]?.[0] || '';
                        } else if (typeof json.label === 'string') {
                            manifestTitle = json.label;
                        }
                    } else if (json.title) {
                        manifestTitle = json.title;
                    }
                }
            } catch (e) {
                // Ignore parse errors, treat as no annotations/title
                hasAnnotations = false;
                manifestTitle = '';
                annotationCount = 0;
            }
        }

        // Render directory or file as a list item
        if (stats.isDirectory()) {
            listItems += `<li class="px-4 py-2"><a href="./${file}/" class="fw-bold text-decoration-none">${file}/</a> <span class="text-muted small ms-2">Created: ${createdDate}</span></li>`;
        } else {
            listItems += `<li class="d-flex justify-content-between align-items-center px-4 py-2">
            <span>
            ${manifestTitle ? `<span class="ms-2"><a href="./${file}" class="fw-semibold link-dark" title="View manifest">${manifestTitle}</a></span>` : ''}
            <span class="text-muted small ms-2">Created: ${createdDate}</span>
            <span class="text-muted small ms-2">Size: ${fileSize}</span>
            ${hasAnnotations ? `<span class="badge bg-primary text-white ms-2">Annotations: ${annotationCount}</span>` : ''}
            </span>
            <a href="https://samvera-labs.github.io/clover-iiif/docs/viewer/demo?iiif-content=https://manifests.museologi.st/${file}" class="btn btn-dark btn-sm ms-2" target="_blank" rel="noopener">Demo</a>
            </li>`;
        }
    });

    // Pagination logic
    const itemsPerPage = 12;
    const totalItems = files.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    // Split listItems into paginated lists
    let paginatedLists = [];
    for (let i = 0; i < totalPages; i++) {
        const start = i * itemsPerPage;
        const end = start + itemsPerPage;
        // Split listItems by </li> and rejoin for each page
        const pageItems = listItems
            .split('</li>')
            .slice(start, end)
            .filter(Boolean)
            .map(item => item + '</li>')
            .join('\n');
        paginatedLists.push(pageItems);
    }

    // Generate pagination controls if needed
    let paginationControls = '';
    if (totalPages > 1) {
        paginationControls = `
        <nav>
            <ul class="pagination justify-content-center">
                <li class="page-item disabled" id="prevPage">
                    <button class="page-link" tabindex="-1">Previous</button>
                </li>
                ${Array.from({ length: totalPages }, (_, i) => `
                    <li class="page-item${i === 0 ? ' active' : ''}">
                        <button class="page-link" onclick="showPage(${i})">${i + 1}</button>
                    </li>
                `).join('')}
                <li class="page-item${totalPages === 1 ? ' disabled' : ''}" id="nextPage">
                    <button class="page-link">Next</button>
                </li>
            </ul>
        </nav>
        `;
    }

    // Return the complete HTML page as a string
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Available Manifests</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600&display=swap" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="styles.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css">
</head>
<body>
    <div class="container py-4">
        <header class="mb-4">
            <h1 class="display-5">Available Manifests</h1>
        </header>
        <main>
            <p>Welcome to the manifest index.</p>
            <p>Below is a list of available simple manifests and links to the file and a demo using clover.</p>
            <ul id="manifestList" class="file-list">
                ${paginatedLists[0] || '<li class="empty-state">No manifests found at this time.</li>'}
            </ul>
            ${paginationControls}
        </main>
        <footer class="footer-classy mt-5 text-muted">
            <div>
                &copy; 2025 Daniel Pett 
                <a class="text-dark" href="${repositoryUrl}" target="_blank" rel="noopener" title="GitHub repo for this project">
                    <i class="fab fa-github"></i> GitHub Repo
                </a>
            </div>
        </footer>
    </div>
    <script>
        // Store paginated lists and page state for client-side pagination
        const paginatedLists = ${JSON.stringify(paginatedLists)};
        let currentPage = 0;
        const totalPages = ${totalPages};

        // Show a specific page of the manifest list
        function showPage(page) {
            if (page < 0 || page >= totalPages) return;
            currentPage = page;
            document.getElementById('manifestList').innerHTML = paginatedLists[page] || '';
            // Update pagination controls
            const pagination = document.querySelectorAll('.pagination .page-item');
            pagination.forEach((item, idx) => {
                if (item.classList.contains('active')) item.classList.remove('active');
                if (idx === page + 1) item.classList.add('active'); // +1 for prev button
            });
            // Enable/disable prev/next buttons
            document.getElementById('prevPage').classList.toggle('disabled', page === 0);
            document.getElementById('nextPage').classList.toggle('disabled', page === totalPages - 1);
        }

        // Set up event listeners for pagination controls after DOM loads
        document.addEventListener('DOMContentLoaded', function() {
            // Previous page button
            document.getElementById('prevPage')?.addEventListener('click', function() {
                if (currentPage > 0) showPage(currentPage - 1);
            });
            // Next page button
            document.getElementById('nextPage')?.addEventListener('click', function() {
                if (currentPage < totalPages - 1) showPage(currentPage + 1);
            });
            // Page number buttons
            document.querySelectorAll('.pagination .page-link').forEach((btn, idx) => {
                if (btn.textContent.match(/^\\d+$/)) {
                    btn.addEventListener('click', function() {
                        showPage(Number(btn.textContent) - 1);
                    });
                }
            });
        });
    </script>
</body>
</html>`;
}

/**
 * Recursively get all files in a directory and its subdirectories.
 * @param {string} dir - Directory to search.
 * @param {string[]} fileList - Accumulator for file paths.
 * @param {string} baseDir - Base directory for relative paths.
 * @returns {string[]} - Array of relative file paths.
 */
function getFilesRecursively(dir, fileList = [], baseDir = dir) {
    const files = fs.readdirSync(dir);

    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stats = fs.statSync(filePath);

        if (stats.isDirectory()) {
            // Recursively list files in subdirectories
            getFilesRecursively(filePath, fileList, baseDir);
        } else {
            // Get path relative to the base 'docs' directory
            const relativePath = path.relative(baseDir, filePath);
            fileList.push(relativePath);
        }
    });
    return fileList;
}

// Main execution block
try {
    // Ensure the docs directory exists
    if (!fs.existsSync(docsDirectory)) {
        console.error(`Error: The 'docs' directory not found at ${docsDirectory}`);
        process.exit(1);
    }

    // Read files directly in the docs directory (non-recursive for simple index)
    // For recursive listing, use getFilesRecursively instead
    // const files = getFilesRecursively(docsDirectory);
    const filesInDocs = fs.readdirSync(docsDirectory);

    // Exclude index.html itself from the listing
    const filteredFiles = filesInDocs.filter(file => file !== outputFileName);

    // Generate the HTML content for the index page
    const htmlContent = generateHtmlContent(filteredFiles, docsDirectory);
    const outputPath = path.join(outputDirectory, outputFileName);

    // Write the generated HTML to the output file
    fs.writeFileSync(outputPath, htmlContent.trim());
    console.log(`Successfully created ${outputPath}`);

} catch (error) {
    // Handle errors gracefully
    console.error('An error occurred:', error.message);
}