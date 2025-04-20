import dotenv from "dotenv";
dotenv.config();

import { HNSWLib } from "@langchain/community/vectorstores/hnswlib";
import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/hf_transformers";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { TextLoader } from "langchain/document_loaders/fs/text";
import fs from "fs";
import path from "path";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import express from "express";
import bodyParser from "body-parser";
import cors from "cors";

const vectorStorePath = "./vectorstore";

// Initialize Express app
const app = express();
app.use(bodyParser.json());
app.use(cors());

// Create VectorStore if it doesn't exist
async function createVectorStore() {
  console.log("Creating new vector store...");

  const directory = "scraped_pages";
  const filenames = fs.readdirSync(directory).filter(file => file.endsWith(".txt"));

  let docs = [];
  for (const file of filenames) {
    const loader = new TextLoader(path.join(directory, file));
    const loaded = await loader.load();
    docs.push(...loaded);
  }

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });

  const chunkedDocs = await splitter.splitDocuments(docs);

  const embeddings = new HuggingFaceTransformersEmbeddings({
    modelName: "Xenova/all-MiniLM-L6-v2",
  });

  const store = await HNSWLib.fromDocuments(chunkedDocs, embeddings);
  await store.save(vectorStorePath);
  return store;
}

// Load or create the vector store
async function loadOrCreateVectorStore() {
  const embeddings = new HuggingFaceTransformersEmbeddings({
    modelName: "Xenova/all-MiniLM-L6-v2",
  });

  if (!fs.existsSync(vectorStorePath)) {
    return await createVectorStore();
  }

  console.log("Loading existing vectorstore...");
  return await HNSWLib.load(vectorStorePath, embeddings);
}

// Get answer from the vector store
async function getAnswer(query) {
  const vectorStore = await loadOrCreateVectorStore();

  const relevantDocs = await vectorStore.similaritySearch(query, 5);
  const combinedText = relevantDocs.map(doc => doc.pageContent).join("\n");
  console.log(combinedText);

  const llm = new ChatGoogleGenerativeAI({
    model: "gemini-1.5-pro",
    temperature: 0,
    maxRetries: 2,
    apiKey: process.env.GEMINI_API_KEY, // 👈 Using env variable
  });

  const res = await llm.invoke([
    [
      "system",
      "You are an intelligent assistant. Use the information provided in the context to answer the question. If the answer cannot be determined from the context alone, say 'I don't know' instead of making up an answer.",
    ],
    ["human", `Context: ${combinedText}\nQuestion: ${query}\nAnswer:`],
  ]);
  console.log(res.content);

  return res.content.trim();
}

// POST endpoint to get answer
app.post('/ask', async (req, res) => {
  try {
    const { question } = req.body;
    if (!question) {
      return res.status(400).json({ error: "Question is required" });
    }

    const answer = await getAnswer(question);
    return res.json({ answer });
  } catch (error) {
    console.error("Error processing the request:", error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

// Start the server
const port = 3000;
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
