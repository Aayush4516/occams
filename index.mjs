// index.mjs
import cors from "cors"; // ⬅️ add this at the top with other imports
import { HNSWLib } from "@langchain/community/vectorstores/hnswlib";
import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/hf_transformers";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { TextLoader } from "langchain/document_loaders/fs/text";
import fs from "fs";
import path from "path";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import dotenv from "dotenv";

// Enable CORS
app.use(cors());

dotenv.config();

const vectorStorePath = "./vectorstore";

async function createVectorStore() {
  console.log("Creating new vector store...");

  const directory = "/home/shtlp_0018/Desktop/occam_advisory/scraped_pages";
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

async function getAnswer(query) {
  const vectorStore = await loadOrCreateVectorStore();

  const relevantDocs = await vectorStore.similaritySearch(query, 5);
  const combinedText = relevantDocs.map(doc => doc.pageContent).join("\n");
  console.log(combinedText)


  const prompt = `
You are an intelligent assistant. Use the information provided in the context to answer the question.
If the answer cannot be determined from the context alone, say "I don't know" instead of making up an answer.

Context:
${combinedText}

Question:
${query}

Answer:
`;


const llm = new ChatGoogleGenerativeAI({
  model: "gemini-1.5-pro",
  temperature: 0,
  maxRetries: 2,
  apiKey:'AIzaSyBukOFijRF9iPXojny2G4d9HYtFF7-BxDw'
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

// Run chatbot
const result = await getAnswer("what is occam");
console.log("Answer:\n", result);
