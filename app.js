import crypto from "crypto";
import fs from "fs";
import { writeFile, readFile } from "fs/promises";
import express from "express";
import https from "https";
import multer from "multer";
import morgan from "morgan";
// import path from 'path';
import cors from "cors";
import moment from "moment";
import preprocess from "./preprocess.mjs";

const app = express();
// Add logging middleware
var accessLogStream = fs.createWriteStream("access.log", { flags: "a" });
app.use(morgan("combined", { stream: accessLogStream }));

const corsOri = ["http://localhost:3000", "https://zipengliu.github.io"];
app.use(cors({ origin: corsOri }));
app.use("/data", express.static("data"));
const port = 8787;

// Directory for all user datasets
const dataPath = "./data/";
// const statusCode = {
//     0: "Processing files",
//     1: "Ready to go",
// };

// Setup the dist storage for uploaded files
// Mapping from form field name (on the frontend form) to filename on server disk
const fileNames = {
    graph: "graph.json",
    embedding: "node-embeddings.csv",
    umap: "umap.csv",
    features: "features.csv",
    featureMeta: "attr-meta.json",
    predRes: "prediction-results.json",
};
const fileFields = [
    { name: "graph", maxCount: 1 },
    { name: "embedding", maxCount: 1 },
    { name: "umap", maxCount: 1 },
    { name: "features", maxCount: 1 },
    { name: "featureMeta", maxCount: 1 },
    { name: "predRes", maxCount: 1 },
];
const generateID = (req, res, next) => {
    const uuid = crypto.randomBytes(2).toString("hex");
    req.timestamp = Date.now();
    const datasetId = moment().format("YYMMDDHHmmss") + "-" + uuid;
    console.log("datasetId: ", datasetId);
    req.datasetId = datasetId;
    req.datasetPath = dataPath + req.datasetId;
    fs.mkdirSync(req.datasetPath, { recursive: true });
    next();
};
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, req.datasetPath);
    },
    filename: function (req, file, cb) {
        cb(null, fileNames[file.fieldname]);
    },
});

const uploader = multer({ storage: storage });

app.get("/", (req, res) => {
    res.send("Hello World!");
});

app.post("/upload", generateID, uploader.fields(fileFields), (req, res) => {
    console.log(req.files);
    console.log(req.body);
    const { hops, name } = req.body;
    writeFile(req.datasetPath + "/status", "0").then(() => {
        preprocess(req.datasetPath, hops, { name, timestamp: req.timestamp });
    });

    res.send(req.datasetId);
});

app.get("/status", (req, res) => {
    readFile(dataPath + req.query.id + "/status").then((s) => {
        res.send(s);
    });
});

https
    .createServer(
        {
            key: fs.readFileSync("server.key"),
            cert: fs.readFileSync("server.cert"),
        },
        app
    )
    .listen(port, () => {
        console.log(`CorGIE server listening at ${port}`);
    });
