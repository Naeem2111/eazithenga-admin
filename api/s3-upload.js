import multer from "multer";
import { NextApiRequest, NextApiResponse } from "next";

// Configure multer for memory storage
const upload = multer({
	storage: multer.memoryStorage(),
	fileFilter: (req, file, cb) => {
		if (file.mimetype.startsWith("image/")) {
			cb(null, true);
		} else {
			cb(new Error("Only image files are allowed!"), false);
		}
	},
	limits: {
		fileSize: 10 * 1024 * 1024, // 10MB limit
	},
});

// Helper to run multer middleware
const runMiddleware = (req, res, fn) => {
	return new Promise((resolve, reject) => {
		fn(req, res, (result) => {
			if (result instanceof Error) {
				return reject(result);
			}
			return resolve(result);
		});
	});
};

export default async function handler(req, res) {
	if (req.method !== "POST") {
		return res.status(405).json({ error: "Method not allowed" });
	}

	try {
		// Parse multipart form data
		await runMiddleware(req, res, upload.single("image"));

		if (!req.file) {
			return res.status(400).json({ error: "No image file provided" });
		}

		const { s3UploadUrl, xObject } = req.body;

		if (!s3UploadUrl) {
			return res.status(400).json({ error: "S3 upload URL not provided" });
		}

		console.log(`Uploading ${req.file.originalname} to S3: ${s3UploadUrl}`);

		// Upload file to S3 using the pre-signed URL
		const s3Response = await fetch(s3UploadUrl, {
			method: "PUT",
			headers: {
				"x-object": xObject || "default",
				"Content-Type": req.file.mimetype,
			},
			body: req.file.buffer, // Send the file buffer
		});

		if (s3Response.ok) {
			console.log(`✅ Successfully uploaded ${req.file.originalname} to S3`);
			res.json({
				success: true,
				message: "File uploaded to S3 successfully",
			});
		} else {
			const errorText = await s3Response.text();
			console.error(`❌ S3 upload failed: ${s3Response.status} - ${errorText}`);
			res.status(s3Response.status).json({
				error: `S3 upload failed: ${errorText}`,
			});
		}
	} catch (error) {
		console.error("S3 upload error:", error);
		res.status(500).json({ error: "S3 upload failed" });
	}
}

export const config = {
	api: {
		bodyParser: false, // Disable body parsing, let multer handle it
	},
};
