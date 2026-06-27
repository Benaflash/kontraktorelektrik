import { initializeApp } from "firebase/app";
import { getFirestore, doc, updateDoc } from "firebase/firestore";
import fs from "fs";

const config = JSON.parse(fs.readFileSync("firebase-applet-config.json"));
const app = initializeApp({
  projectId: config.projectId,
  appId: config.appId,
  apiKey: config.apiKey,
  authDomain: config.authDomain,
  storageBucket: config.storageBucket,
  messagingSenderId: config.messagingSenderId
});
const db = getFirestore(app, "ai-studio-dce0cccb-11f2-4cb5-842d-bba3d7dabbfb");

async function test() {
  try {
    // Try to update an existing FAQ, wait we need to create one first
    console.log("Testing...");
  } catch(e) {
    console.error("Error:", e.message);
  }
}
test();
