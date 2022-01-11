import crypto from "crypto";
import fs from "fs";
import { writeFile, readFile } from "fs/promises";
import express from "express";
import multer from "multer";
import morgan from "morgan";
// import path from 'path';
// import cors from "cors";
import moment from "moment";
import preprocess from "./preprocess.mjs";

const app = express();
// Add logging middleware
var accessLogStream = fs.createWriteStream("access.log", { flags: "a" });
app.use(morgan("combined", { stream: accessLogStream }));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// const corsOri = ["http://localhost:3000"];
// app.use(cors({ origin: corsOri }));
// app.use("/data", express.static("data"));
const port = 8787;

// Directory for all user datasets
const dataPath = "/www/data/";
// const dataPath = "./data/";
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

const isUserDataset = (id) => {
    if (id.length !== 12 + 1 + 4) return false;
    const s = id.split("-");
    if (s.length !== 2 || s[0].length !== 12 || s[1].length !== 4) return false;
    return true;
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

app.post("/remove", (req, res) => {
    const id = req.body.id;
    // Check if it is an user dataset
    // Note: don't remove a demo dataset
    console.log("Removing dataset: ", id);
    if (isUserDataset(id)) {
        const p = dataPath + id;
        fs.access(p, (err) => {
            if (err) {
                console.error(p + " does not exist!");
                res.send("0");
            } else {
                fs.rmdir(dataPath + id, { recursive: true }, (err) => {
                    if (err) {
                        console.error("Error removing " + p);
                        res.send("0");
                    } else {
                        res.send("1");
                    }
                });
            }
        });
    } else {
        res.send("0");
    }
});

// app.get("/status", (req, res) => {
//     readFile(dataPath + req.query.id + "/status").then((s) => {
//         res.send(s);
//     });
// });

app.listen(port, () => {
    console.log(`CorGIE server listening at ${port}`);
});
