import pdfParse from 'pdf-parse';
import { pipeline } from '@xenova/transformers';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const ENDEE_BASE_URL = 'http://localhost:8080/api/v1';
const INDEX_NAME = 'smartdoc_index';
const DIMENSION = 384;

let embedder;

async function getEmbedder() {
    if (!embedder) {
        embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    }
    return embedder;
}

export async function createIndexIfNotExists() {
    try {
        await axios.post(`${ENDEE_BASE_URL}/indexes`, {
            name: INDEX_NAME,
            dimension: DIMENSION,
            space_type: 'cosine'
        });
        console.log(`Index '${INDEX_NAME}' created!`);
    } catch (error) {
        // usually 400 or 409 if exists
        console.log(`Index note: ${error.response?.data?.message || error.message}`);
    }
}

export async function extractTextFromPdf(buffer) {
    const data = await pdfParse(buffer);
    const chunks = [];
    const text = data.text;
    
    // Simplistic chunking (you might want to split by pages if you have the data, 
    // but pdf-parse combines everything by default. We'll split word by word).
    const words = text.split(/\s+/);
    let currentChunk = "";
    
    for (let word of words) {
        currentChunk += word + " ";
        if (currentChunk.length >= 500) {
            chunks.push({ text: currentChunk.trim(), page: 1 }); // Page info is lost in pure pdf-parse unfortunately
            currentChunk = "";
        }
    }
    if (currentChunk.trim()) {
        chunks.push({ text: currentChunk.trim(), page: 1 });
    }
    return chunks;
}

export async function ingestPdf(buffer, filename) {
    await createIndexIfNotExists();
    const chunks = await extractTextFromPdf(buffer);
    const texts = chunks.map(c => c.text);
    
    const extractor = await getEmbedder();
    const output = await extractor(texts, { pooling: 'mean', normalize: true });
    // output is a tensor, we need to convert to array of arrays
    const embeddings = output.tolist();

    const vectors = chunks.map((chunk, i) => ({
        id: uuidv4(),
        vector: embeddings[i],
        meta: { text: chunk.text, source: filename, page: chunk.page }
    }));

    const batchSize = 100;
    for (let i = 0; i < vectors.length; i += batchSize) {
        const batch = vectors.slice(i, i + batchSize);
        await axios.post(`${ENDEE_BASE_URL}/indexes/${INDEX_NAME}/upsert`, {
            vectors: batch
        });
        console.log(`Uploaded batch ${Math.floor(i / batchSize) + 1}`);
    }
    console.log(`Done! ${filename} ingested.`);
    return chunks.length;
}
