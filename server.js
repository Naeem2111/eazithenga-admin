const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const cors = require("cors");

const app = express();
const PORT = 3001; // Different port from React frontend

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// Create temp-uploads directory if it doesn't exist
const tempUploadsDir = path.join(__dirname, "public", "temp-uploads");
if (!fs.existsSync(tempUploadsDir)) {
	fs.mkdirSync(tempUploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
	destination: function (req, file, cb) {
		cb(null, tempUploadsDir);
	},
	filename: function (req, file, cb) {
		const timestamp = Date.now();
		const originalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
		cb(null, `${timestamp}_${originalName}`);
	},
});

// Memory storage for S3 uploads (no disk storage needed)
const memoryStorage = multer.memoryStorage();

const upload = multer({
	storage: storage,
	fileFilter: function (req, file, cb) {
		// Only allow image files
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

// Separate multer instance for S3 uploads (uses memory storage)
const s3Upload = multer({
	storage: memoryStorage,
	fileFilter: function (req, file, cb) {
		// Only allow image files
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

// Routes
app.get("/", (req, res) => {
	res.json({ message: "Eazithenga Backend Server Running" });
});

// S3 upload proxy endpoint
app.post("/api/s3-upload", s3Upload.single("image"), async (req, res) => {
	try {
		if (!req.file) {
			return res.status(400).json({ error: "No image file provided" });
		}

		const { s3UploadUrl, xObject } = req.body;

		if (!s3UploadUrl) {
			return res.status(400).json({ error: "S3 upload URL not provided" });
		}

		console.log(`Uploading ${req.file.filename} to S3: ${s3UploadUrl}`);

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
			console.log(`✅ Successfully uploaded ${req.file.filename} to S3`);
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
});

// Temporary file upload endpoint (keep for debugging)
app.post("/api/temp-upload", upload.single("image"), (req, res) => {
	try {
		if (!req.file) {
			return res.status(400).json({ error: "No image file provided" });
		}

		const imageUrl = `http://localhost:${PORT}/temp-uploads/${req.file.filename}`;

		console.log(`File uploaded: ${req.file.filename}`);
		console.log(`Accessible at: ${imageUrl}`);

		res.json({
			tempImageUrl: imageUrl,
			filename: req.file.filename,
			size: req.file.size,
		});
	} catch (error) {
		console.error("Upload error:", error);
		res.status(500).json({ error: "Upload failed" });
	}
});

// Temporary file cleanup endpoint
app.post("/api/temp-cleanup", (req, res) => {
	try {
		const { imageUrl } = req.body;

		if (!imageUrl) {
			return res.status(400).json({ error: "Image URL not provided" });
		}

		// Extract filename from URL
		const filename = imageUrl.split("/temp-uploads/")[1];
		if (!filename) {
			return res.status(400).json({ error: "Invalid image URL format" });
		}

		const filepath = path.join(tempUploadsDir, filename);

		// Check if file exists
		if (fs.existsSync(filepath)) {
			fs.unlinkSync(filepath);
			console.log(`File cleaned up: ${filename}`);
			res.json({ message: "File cleaned up successfully" });
		} else {
			console.log(`File not found for cleanup: ${filename}`);
			res.json({ message: "File not found (already cleaned up)" });
		}
	} catch (error) {
		console.error("Cleanup error:", error);
		res.status(500).json({ error: "Cleanup failed" });
	}
});

// Get list of temporary files (for debugging)
app.get("/api/temp-files", (req, res) => {
	try {
		const files = fs.readdirSync(tempUploadsDir);
		const fileList = files.map((filename) => {
			const filepath = path.join(tempUploadsDir, filename);
			const stats = fs.statSync(filepath);
			return {
				filename,
				size: stats.size,
				created: stats.birthtime,
				url: `http://localhost:${PORT}/temp-uploads/${filename}`,
			};
		});

		res.json({ files: fileList });
	} catch (error) {
		console.error("Error reading temp files:", error);
		res.status(500).json({ error: "Failed to read temporary files" });
	}
});

// Store creation endpoint (mock implementation)
app.post("/api/store/create", (req, res) => {
	try {
		const { ownerNumber, name, slug, products } = req.body;

		console.log("Creating store with data:", {
			ownerNumber,
			name,
			slug,
			productCount: products.length,
			products: products.map((p) => ({
				name: p.name,
				price: p.price,
				imageUrl: p.imageUrl,
			})),
		});

		// Mock store creation - in real app, this would save to database
		const storeId = Date.now().toString();
		const store = {
			id: storeId,
			ownerNumber,
			name,
			slug,
			products,
			createdAt: new Date().toISOString(),
			status: "active",
		};

		console.log(`✅ Store created successfully with ID: ${storeId}`);

		res.json({
			success: true,
			store,
			message: "Store created successfully",
		});
	} catch (error) {
		console.error("Store creation error:", error);
		res.status(500).json({
			success: false,
			error: "Failed to create store",
		});
	}
});

// Error handling middleware
app.use((error, req, res, next) => {
	if (error instanceof multer.MulterError) {
		if (error.code === "LIMIT_FILE_SIZE") {
			return res.status(400).json({ error: "File too large (max 10MB)" });
		}
	}

	console.error("Server error:", error);
	res.status(500).json({ error: "Internal server error" });
});

// Start server
app.listen(PORT, () => {
	console.log(`🚀 Backend server running on http://localhost:${PORT}`);
	console.log(`📁 Temporary uploads directory: ${tempUploadsDir}`);
	console.log(`🔗 Frontend should connect to: http://localhost:${PORT}`);
});
