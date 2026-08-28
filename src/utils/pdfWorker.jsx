import * as pdfjsLib from 'pdfjs-dist';

// ✅ Updated to match your installed version (6.2.108)
// Note: v6 uses .mjs extension for the worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/6.2.108/pdf.worker.min.mjs';

export const extractTextFromPDF = async (file) => {
  try {
    console.log('Starting PDF extraction for:', file.name);
    
    // Check file size (limit to 50MB)
    if (file.size > 50 * 1024 * 1024) {
      throw new Error(`PDF file is too large. Maximum size is 50MB. Your file is ${(file.size / (1024 * 1024)).toFixed(2)}MB.`);
    }

    const arrayBuffer = await file.arrayBuffer();
    console.log('PDF loaded, size:', (arrayBuffer.byteLength / (1024 * 1024)).toFixed(2), 'MB');
    
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    console.log('PDF parsed, pages:', pdf.numPages);
    
    let fullText = '';
    // Extract from first 50 pages to prevent browser crash
    const maxPages = Math.min(pdf.numPages, 50);
    
    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      console.log('Extracting page', pageNum, 'of', maxPages);
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += `\n\n--- Page ${pageNum} ---\n${pageText}`;
    }
    
    if (pdf.numPages > maxPages) {
      fullText += `\n\n[Note: PDF has ${pdf.numPages} pages total. Only first ${maxPages} pages were extracted.]`;
    }
    
    const trimmedText = fullText.trim();
    console.log('Extraction complete. Total characters:', trimmedText.length);
    
    if (trimmedText.length === 0) {
      throw new Error('No text could be extracted from this PDF. It may be a scanned document or image-based PDF.');
    }
    
    return trimmedText;
  } catch (error) {
    console.error('PDF extraction error:', error);
    throw error;
  }
};