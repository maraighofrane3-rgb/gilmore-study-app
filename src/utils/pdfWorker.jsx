import * as pdfjsLib from 'pdfjs-dist';

// ✅ Updated to match your installed version (6.2.108)
// Note: v6 uses .mjs extension for the worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/6.2.108/pdf.worker.min.mjs';

export const extractTextFromPDF = async (file) => {
  try {
    console.log('Starting PDF extraction for:', file.name);
    
    if (file.size > 50 * 1024 * 1024) {
      throw new Error(`PDF file is too large. Maximum size is 50MB.`);
    }

    const arrayBuffer = await file.arrayBuffer();
    // ✅ Use { data: arrayBuffer } for better compatibility with v6
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullContent = '';

    console.log(`PDF loaded, pages: ${pdf.numPages}`);

    // ✅ Safety limit: Extract max 100 pages to prevent browser crash on huge files
    const maxPages = Math.min(pdf.numPages, 100);

    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      console.log(`Extracting page ${pageNum} of ${maxPages}`);
      const page = await pdf.getPage(pageNum);
      
      // Extract text
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      
      fullContent += `\n\n--- Page ${pageNum} ---\n\n`;
      fullContent += pageText + '\n';
    }

    if (pdf.numPages > maxPages) {
      fullContent += `\n\n[Note: PDF has ${pdf.numPages} pages total. Only the first ${maxPages} pages were extracted to prevent performance issues.]`;
    }

    const trimmedText = fullContent.trim();
    
    if (trimmedText.length === 0) {
      throw new Error('No text could be extracted from this PDF. It may be a scanned document or image-based PDF. Try using the image rendering function instead.');
    }

    return trimmedText;
  } catch (error) {
    console.error('PDF extraction error:', error);
    throw error;
  }
};

// ✅ NEW FUNCTION: Render PDF pages as images (preserves images, diagrams & formatting)
export const renderPDFAsImages = async (file) => {
  try {
    console.log('Starting PDF rendering for:', file.name);
    
    if (file.size > 50 * 1024 * 1024) {
      throw new Error(`PDF file is too large. Maximum size is 50MB.`);
    }

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    console.log(`PDF loaded, pages: ${pdf.numPages}`);
    
    let htmlContent = '<div class="pdf-pages">';

    // ✅ Safety limit: Render max 50 pages to prevent memory overload
    const maxPages = Math.min(pdf.numPages, 50);

    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      console.log(`Rendering page ${pageNum} of ${maxPages}`);
      
      const page = await pdf.getPage(pageNum);
      
      // Set scale for good quality (1.5 is a good balance of clarity and file size)
      const scale = 1.5;
      const viewport = page.getViewport({ scale });
      
      // Create canvas
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      // Render page to canvas
      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise;
      
      // Convert canvas to base64 image
      const imageData = canvas.toDataURL('image/png');
      
      // Add to HTML content
      htmlContent += `
        <div class="pdf-page" style="margin-bottom: 2rem; page-break-after: always;">
          <div style="text-align: center; margin-bottom: 0.5rem; color: #6b5b4f; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.1em;">
            Page ${pageNum}
          </div>
          <img src="${imageData}" alt="Page ${pageNum}" style="max-width: 100%; height: auto; border: 1px solid #d4c5b5; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" />
        </div>
      `;
      
      // Clean up canvas from memory
      canvas.remove();
    }

    if (pdf.numPages > maxPages) {
      htmlContent += `<div style="text-align: center; color: #8b5e3c; padding: 1rem; font-style: italic;">[Note: PDF has ${pdf.numPages} pages total. Only the first ${maxPages} pages were rendered to prevent browser performance issues.]</div>`;
    }

    htmlContent += '</div>';
    
    return htmlContent;
  } catch (error) {
    console.error('PDF rendering error:', error);
    throw error;
  }
};
// 📕 Render the FIRST page of a PDF as a JPEG cover image (returns a Blob)
export async function extractCoverFromPDF(file, maxWidth = 600) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1);

  // Scale so the cover is ~600px wide (good quality, small file)
  const baseViewport = page.getViewport({ scale: 1 });
  const scale = maxWidth / baseViewport.width;
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext('2d');

  await page.render({ canvasContext: ctx, viewport }).promise;

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Could not create cover image'))),
      'image/jpeg',
      0.85
    );
  });

  return blob;
};