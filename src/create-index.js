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

        if (stats.isDirectory()) {
            listItems += `<li><a href="./${file}/">${file}/</a></li>`; // Link to directory
        } else {
            listItems += `<li><a href="./${file}">${file}</a> | <a href="https://uv-v4.netlify.app/#?manifest=https://manifests.museologi.st/${file}">Universal Viewer Image</a></li>`; // Link to file
        }
    });

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Available Manifests</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="styles.css"> </head>
<body>
    <div class="container">
        <header>
            <h1>Available Manifests</h1>
        </header>
        <main>
            <ul class="file-list">
                ${listItems || '<li class="empty-state">No manifests found at this time.</li>'}
            </ul>
        </main>
        <footer>
            <p>&copy; 2025 Daniel Pett</p>
        </footer>
    </div>
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