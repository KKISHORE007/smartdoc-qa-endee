import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import documentRoutes from './routes/documentRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import mongoose from 'mongoose';

dotenv.config({ path: '../.env' }); // Adjust if .env is at monorepo root

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Set up minimal routes for now
app.use('/api/documents', documentRoutes);
app.use('/api/chat', chatRoutes);

// Optional: MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI;
if (MONGODB_URI) {
    mongoose.connect(MONGODB_URI)
        .then(() => console.log('✅ Connected to MongoDB'))
        .catch(err => console.error('❌ MongoDB connection error:', err));
} else {
    console.log('⚠️ No MONGODB_URI found; skipping MongoDB connection.');
}

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
