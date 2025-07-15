const fs = require('fs');
const path = require('path');

const docsDirectory = path.join(__dirname, '..', 'docs'); // Go up one directory, then into 'docs'
const outputDirectory = docsDirectory; // Output index.html directly in 'docs'
const outputFileName = 'index.html';

/**
 * Generates an HTML string for a list of files.
 * @param {string[]} files - An array of file names.
 * @param {string} directoryPath - The base directory path for relative links.
 * @returns {string} The HTML string.
 */
function generateHtmlContent(files, directoryPath) {
    let listItems = '';
    files.forEach(file => {
        if (file.toUpperCase() === 'CNAME' || file === 'styles.css') return;
        const filePath = path.join(directoryPath, file);
        const stats = fs.statSync(filePath); // Get file stats to check if it's a directory
        const createdDate = stats.birthtime
            ? new Date(stats.birthtime).toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-')
            : '';
        const fileSize = !stats.isDirectory()
            ? `${(stats.size / 1024).toFixed(1)} KB`
            : '';

        // Check for annotations element if it's a file and ends with .json
        let hasAnnotations = false;
        let manifestTitle = '';
        let annotationCount = 0;
        if (!stats.isDirectory() && file.endsWith('.json')) {
            try {
                const content = fs.readFileSync(path.join(directoryPath, file), 'utf8');
                const json = JSON.parse(content);
                // Count annotations at the manifest level
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
                // Get the title element (IIIF v3: label, v2: label or title)
                if (json) {
                    if (json.label) {
                        // IIIF v3: label is an object with language keys
                        if (typeof json.label === 'object' && !Array.isArray(json.label)) {
                            // Try 'en' first, then any available language
                            manifestTitle = json.label.en?.[0] || Object.values(json.label)[0]?.[0] || '';
                        } else if (typeof json.label === 'string') {
                            manifestTitle = json.label;
                        }
                    } else if (json.title) {
                        manifestTitle = json.title;
                    }
                }
            } catch (e) {
                hasAnnotations = false;
                manifestTitle = '';
                annotationCount = 0;
                // Ignore parse errors, treat as no annotations/title
            }
        }

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

    // Generate paginated lists
    let paginatedLists = [];
    for (let i = 0; i < totalPages; i++) {
        const start = i * itemsPerPage;
        const end = start + itemsPerPage;
        const pageItems = listItems
            .split('</li>')
            .slice(start, end)
            .filter(Boolean)
            .map(item => item + '</li>')
            .join('\n');
        paginatedLists.push(pageItems);
    }

    // Generate pagination controls
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

    // HTML output with Bootstrap pagination and JS
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
                <a class="text-dark" href="https://github.com/portableant/cantaloupe-iiif-generator/" target="_blank" rel="noopener" title="GitHub repo for this project">
                    <i class="fab fa-github"></i> GitHub Repo
                </a>
            </div>
        </footer>
    </div>
    <script>
        const paginatedLists = ${JSON.stringify(paginatedLists)};
        let currentPage = 0;
        const totalPages = ${totalPages};

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
            // Enable/disable prev/next
            document.getElementById('prevPage').classList.toggle('disabled', page === 0);
            document.getElementById('nextPage').classList.toggle('disabled', page === totalPages - 1);
        }

        document.addEventListener('DOMContentLoaded', function() {
            // Add event listeners for prev/next
            document.getElementById('prevPage')?.addEventListener('click', function() {
                if (currentPage > 0) showPage(currentPage - 1);
            });
            document.getElementById('nextPage')?.addEventListener('click', function() {
                if (currentPage < totalPages - 1) showPage(currentPage + 1);
            });
            // Add event listeners for page number buttons
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

// Function to get files recursively (optional, but good for real docs sites)
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

// Main execution
try {
    // Ensure the docs directory exists
    if (!fs.existsSync(docsDirectory)) {
        console.error(`Error: The 'docs' directory not found at ${docsDirectory}`);
        process.exit(1);
    }

    // Read files directly in the docs directory (non-recursive for simpler index)
    // For a recursive listing, uncomment the line below and comment out the next one:
    // const files = getFilesRecursively(docsDirectory);
    const filesInDocs = fs.readdirSync(docsDirectory);

    // Filter out the index.html itself if it already exists and is being overwritten
    const filteredFiles = filesInDocs.filter(file => file !== outputFileName);

    const htmlContent = generateHtmlContent(filteredFiles, docsDirectory);
    const outputPath = path.join(outputDirectory, outputFileName);

    fs.writeFileSync(outputPath, htmlContent.trim());
    console.log(`Successfully created ${outputPath}`);

} catch (error) {
    console.error('An error occurred:', error.message);
}