import type Movie from 'movie.d.ts'
import type { NextApiRequest, NextApiResponse } from 'next'
const fs = require('fs');
const pg = require('pg');
require('@tensorflow/tfjs-node');
const encoder = require('@tensorflow-models/universal-sentence-encoder');
import {UniversalSentenceEncoder} from "@tensorflow-models/universal-sentence-encoder";

const config = {
  user: process.env.PG_NAME,
  password: process.env.PG_PASSWORD,
  host: process.env.PG_HOST,
  port: process.env.PG_PORT,
  database: "defaultdb",
  ssl: {
      rejectUnauthorized: true,
      ca: fs.readFileSync('./ca.pem').toString(),
  },
};

// Initialize the global database client variable
let globalPGClient: pg.Client | null = null;

let globalTFModel: UniversalSentenceEncoder | null  = null;
async function getTFModel() {
   // If the model already exists, return it
   if (globalTFModel) {
      return globalTFModel;
   }

   // Otherwise, load and set the global variable to the new model
   globalTFModel = await encoder.load();
   return globalTFModel;
}
async function getPGClient() {
   // If the client already exists, return it
   if (globalPGClient) {
      return globalPGClient;
   }

   // Otherwise, create a new client and connect
   const client = new pg.Client(config);
   await client.connect();

   // Set the global variable to the new client
   globalPGClient = client;

   return client;
}


export default async function handler(
        req: NextApiRequest,
        res: NextApiResponse<Movie[]>
) {
   const model = await getTFModel();
   const embeddings = await model?.embed(req.body.search);
   const embeddingArray = embeddings?.arraySync()[0];
   const client = await getPGClient();

   try {
      const pgResponse = await client.query(`SELECT * FROM movie_plots ORDER BY embedding <-> '${JSON.stringify(embeddingArray)}' LIMIT 5;`);
      res.status(200).json(pgResponse.rows)
   } catch (err) {
      console.error(err);
   }
}