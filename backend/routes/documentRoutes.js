import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { readDocument, chunkText } from '../services/documentReader.js';

const router = express.Router();

// Configure multer for file uploads
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
});

// In-memory store for document data (per session)
const documentStore = {};

/**
 * POST /api/documents/upload
 * Upload a document file
 */
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const docId = Date.now().toString(36) + Math.random().toString(36).substr(2, 9);

        documentStore[docId] = {
            id: docId,
            originalName: req.file.originalname,
            filePath: req.file.path,
            mimeType: req.file.mimetype,
            size: req.file.size,
            uploadedAt: new Date().toISOString(),
            text: null,
            isRead: false,
        };

        res.json({
            success: true,
            document: {
                id: docId,
                name: req.file.originalname,
                size: req.file.size,
                type: req.file.mimetype,
            }
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Failed to upload file: ' + error.message });
    }
});

/**
 * POST /api/documents/:id/read  
 * Read/parse the document content
 */
router.post('/:id/read', async (req, res) => {
    try {
        const doc = documentStore[req.params.id];
        if (!doc) {
            return res.status(404).json({ error: 'Document not found' });
        }

        if (doc.isRead && doc.text) {
            const cachedText = String(doc.text);
            return res.json({
                success: true,
                document: {
                    id: doc.id,
                    name: doc.originalName,
                    textLength: cachedText.length,
                    preview: cachedText.substring(0, 500) + (cachedText.length > 500 ? '...' : ''),
                    text: cachedText,
                    alreadyRead: true,
                }
            });
        }

        let text = String(await readDocument(doc.filePath, doc.originalName));
        
        // Simple heuristic to detect if Tesseract extracted random garbage/noise from a complex image without real text
        const isGarbageText = (str) => {
            if (!str || str.length < 5) return true;
            let alphaCount = 0;
            let nonAlphaCount = 0;
            for (let i = 0; i < str.length; i++) {
                const c = str[i];
                if (/[a-zA-Z0-9]/.test(c)) alphaCount++;
                else if (c.trim() !== '') nonAlphaCount++;
            }
            if (alphaCount < 10) return true;
            // If the noise (non-alphanumeric) strictly overpowers letters, it's likely heavily jumbled OCR noise
            if (nonAlphaCount > alphaCount * 1.5) return true; 
            return false;
        };

        if (isGarbageText(text)) {
            text = `[SYSTEM MESSAGE]: The extracted text from the document/image named "${doc.originalName}" was unreadable or contained no real text (likely a complex picture or content-less file). Inform the user that the document text is unreadable. If they ask what the image is, politely instruct them to use the "Broad Search" feature so we can search the web for "${doc.originalName.replace(/\.[^/.]+$/, '')}".`;
        }

        doc.text = text;
        doc.isRead = true;

        res.json({
            success: true,
            document: {
                id: doc.id,
                name: doc.originalName,
                textLength: text.length,
                preview: text.substring(0, 500) + (text.length > 500 ? '...' : ''),
                text: text,
            }
        });
    } catch (error) {
        console.error('Read error:', error);
        res.status(500).json({ error: 'Failed to read document: ' + error.message });
    }
});

/**
 * GET /api/documents/:id
 * Get document info
 */
router.get('/:id', (req, res) => {
    const doc = documentStore[req.params.id];
    if (!doc) {
        return res.status(404).json({ error: 'Document not found' });
    }
    res.json({
        id: doc.id,
        name: doc.originalName,
        size: doc.size,
        type: doc.mimeType,
        isRead: doc.isRead,
        textLength: doc.text ? doc.text.length : 0,
        text: doc.text || '',
    });
});

/**
 * GET /api/documents/:id/download
 * Download/stream the document file
 */
router.get('/:id/download', (req, res) => {
    const doc = documentStore[req.params.id];
    if (!doc) {
        return res.status(404).json({ error: 'Document not found' });
    }
    
    // Check if file exists
    if (!fs.existsSync(doc.filePath)) {
         return res.status(404).json({ error: 'File on disk not found. It may have been cleaned up.' });
    }
    
    // Strictly set headers to force inline preview
    const mimeType = doc.mimeType || 'application/pdf';
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.originalName)}"`);
    res.setHeader('Content-Type', mimeType);

    // Pipe the stream directly so Express doesn't override headers based on the extensionless filename
    const fileStream = fs.createReadStream(doc.filePath);
    fileStream.pipe(res);
});

/**
 * DELETE /api/documents/:id
 * Remove a document
 */
router.delete('/:id', (req, res) => {
    const doc = documentStore[req.params.id];
    if (!doc) {
        return res.status(404).json({ error: 'Document not found' });
    }
    // Clean up file
    try {
        if (fs.existsSync(doc.filePath)) {
            fs.unlinkSync(doc.filePath);
        }
    } catch { /* ignore cleanup errors */ }

    delete documentStore[doc.id];
    res.json({ success: true });
});

// Export the store so chat routes can access document text
export { documentStore };
export default router;
