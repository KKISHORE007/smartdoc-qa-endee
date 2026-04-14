import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import Tesseract from 'tesseract.js';
import officeparser from 'officeparser';
import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

/**
 * Safely convert any value to a string.
 * Handles officeparser v6 objects which have a .toText() method.
 */
function ensureString(data) {
    if (typeof data === 'string') return data;
    if (Buffer.isBuffer(data)) return data.toString('utf-8');
    if (data === null || data === undefined) return '';
    // officeparser v6 returns { type, metadata, content, toText() }
    if (typeof data === 'object' && typeof data.toText === 'function') {
        return data.toText();
    }
    return String(data);
}

/**
 * Reads a document file and extracts text content.
 * Supports: PDF, DOCX, DOC, TXT, CSV, XLSX, XLS, PPTX, PPT, images (PNG, JPG, JPEG, BMP, TIFF, WEBP)
 * Always returns a string.
 */
export async function readDocument(filePath, originalName) {
    const ext = path.extname(originalName || filePath).toLowerCase();

    let result;
    switch (ext) {
        case '.pdf':
            result = await readPdf(filePath);
            break;
        case '.docx':
            result = await readDocx(filePath);
            break;
        case '.doc':
            result = await readDocWithOfficeParser(filePath);
            break;
        case '.txt':
        case '.csv':
        case '.md':
        case '.json':
        case '.xml':
        case '.html':
        case '.htm':
        case '.log':
        case '.py':
        case '.js':
        case '.ts':
        case '.java':
        case '.c':
        case '.cpp':
        case '.css':
            result = await readTextFile(filePath);
            break;
        case '.xlsx':
        case '.xls':
            result = await readExcel(filePath);
            break;
        case '.pptx':
        case '.ppt':
            result = await readPptWithOfficeParser(filePath);
            break;
        case '.png':
        case '.jpg':
        case '.jpeg':
        case '.bmp':
        case '.tiff':
        case '.tif':
        case '.webp':
        case '.gif':
            result = await readImage(filePath, originalName);
            break;
        default:
            // Try officeparser as fallback for other office formats
            try {
                result = await readWithOfficeParser(filePath);
            } catch {
                throw new Error(`Unsupported file type: ${ext}`);
            }
            break;
    }

    // Always guarantee a string return
    return ensureString(result);
}

async function readPdf(filePath) {
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    return data.text;
}

async function readDocx(filePath) {
    const buffer = fs.readFileSync(filePath);
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
}

async function readDocWithOfficeParser(filePath) {
    const data = await officeparser.parseOffice(filePath);
    return ensureString(data);
}

async function readTextFile(filePath) {
    return fs.readFileSync(filePath, 'utf-8');
}

async function readExcel(filePath) {
    // Use xlsx library for reliable spreadsheet parsing
    try {
        const workbook = XLSX.readFile(filePath);
        const textParts = [];
        for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName];
            const csv = XLSX.utils.sheet_to_csv(sheet);
            textParts.push(`--- Sheet: ${sheetName} ---\n${csv}`);
        }
        return textParts.join('\n\n');
    } catch {
        // Fallback to officeparser
        const data = await officeparser.parseOffice(filePath);
        return ensureString(data);
    }
}

async function readPptWithOfficeParser(filePath) {
    const data = await officeparser.parseOffice(filePath);
    return ensureString(data);
}

async function readImage(filePath, originalName) {
    try {
        // Attempt Groq Vision for rich visual understanding
        const groqKey = process.env.GROQ_API_KEY;
        if (groqKey) {
            const { Groq } = await import('groq-sdk');
            const groq = new Groq({ apiKey: groqKey });
            
            const ext = path.extname(originalName || filePath).toLowerCase().replace('.', '');
            const mimeType = ext === 'png' ? 'png' : ext === 'webp' ? 'webp' : 'jpeg';
            const base64Image = fs.readFileSync(filePath, { encoding: 'base64' });
            
            const completion = await groq.chat.completions.create({
                messages: [
                    {
                        role: "user",
                        content: [
                            { type: "text", text: `Analyze this image thoroughly and extract ALL content.

If this image contains a TABLE or TIMETABLE or SCHEDULE:
- Reproduce the ENTIRE table in a structured text format preserving ALL rows and columns.
- Use this format: "Row: [row header] | Column1: [value] | Column2: [value] | ..."
- Do NOT skip any cell. Every single cell value must be transcribed.

If this image contains regular text, transcribe ALL visible text exactly as written.

If this image is a photograph/diagram, describe every visible element in detail.

Be extremely thorough - do not summarize or abbreviate. Transcribe EVERYTHING.` },
                            {
                                type: "image_url",
                                image_url: {
                                    url: `data:image/${mimeType};base64,${base64Image}`,
                                },
                            },
                        ],
                    },
                ],
                model: "meta-llama/llama-4-scout-17b-16e-instruct",
                temperature: 0.1,
                max_tokens: 4096,
            });
            
            const visionText = completion.choices[0]?.message?.content;
            if (visionText) {
                return "[AI Vision Description]: " + visionText;
            }
        }
    } catch (err) {
        console.warn('Groq Vision API failed or unavailable. Falling back to Tesseract OCR.', err.message);
    }

    // Fallback: Tesseract OCR with improved config for tables
    const { data: { text } } = await Tesseract.recognize(filePath, 'eng', {
        logger: (m) => {
            if (m.status === 'recognizing text') {
                // Progress tracking could be sent via SSE
            }
        },
        // PSM 6 = Assume a single uniform block of text (better for tables)
        // PSM 4 = Assume a single column of text of variable sizes
        tessedit_pageseg_mode: '6',
    });

    // For table-like images, add a notice about OCR limitations
    const lineCount = text.split('\n').filter(l => l.trim()).length;
    if (lineCount > 10) {
        return `[OCR Extracted Text - Note: Table structure may not be perfectly preserved]\n\n${text}`;
    }
    return text;
}

async function readWithOfficeParser(filePath) {
    const data = await officeparser.parseOffice(filePath);
    return ensureString(data);
}

/**
 * Chunk text into smaller pieces for embeddings / context
 */
export function chunkText(text, chunkSize = 800, overlap = 100) {
    const chunks = [];
    const words = text.split(/\s+/);
    let i = 0;
    while (i < words.length) {
        const chunk = words.slice(i, i + chunkSize).join(' ');
        if (chunk.trim()) {
            chunks.push(chunk.trim());
        }
        i += chunkSize - overlap;
    }
    return chunks;
}
