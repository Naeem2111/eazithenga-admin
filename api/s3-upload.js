export default async function handler(req, res) {
	if (req.method !== "POST") {
		return res.status(405).json({ error: "Method not allowed" });
	}

	try {
		// Get the raw body data
		const chunks = [];
		req.on("data", (chunk) => chunks.push(chunk));

		await new Promise((resolve, reject) => {
			req.on("end", resolve);
			req.on("error", reject);
		});

		const rawBody = Buffer.concat(chunks);

		// Parse multipart form data manually (simplified for serverless)
		const boundary = req.headers["content-type"]?.split("boundary=")[1];
		if (!boundary) {
			return res.status(400).json({ error: "No multipart boundary found" });
		}

		// Extract form fields and file data
		const parts = rawBody.toString("binary").split("--" + boundary);
		let s3UploadUrl = "";
		let xObject = "";
		let fileData = null;
		let fileName = "";

		for (const part of parts) {
			if (part.includes("Content-Disposition: form-data")) {
				if (part.includes('name="s3UploadUrl"')) {
					s3UploadUrl = part.split("\r\n\r\n")[1]?.split("\r\n")[0] || "";
				} else if (part.includes('name="xObject"')) {
					xObject = part.split("\r\n\r\n")[1]?.split("\r\n")[0] || "";
				} else if (part.includes('name="image"')) {
					// Extract file data
					const filePart = part.split("\r\n\r\n")[1];
					if (filePart) {
						fileData = Buffer.from(filePart, "binary");
						fileName = "uploaded_image.jpg"; // Default name
					}
				}
			}
		}

		if (!s3UploadUrl) {
			return res.status(400).json({ error: "S3 upload URL not provided" });
		}

		if (!fileData) {
			return res.status(400).json({ error: "No image file provided" });
		}

		console.log(`Uploading ${fileName} to S3: ${s3UploadUrl}`);

		// Upload file to S3 using the pre-signed URL
		const s3Response = await fetch(s3UploadUrl, {
			method: "PUT",
			headers: {
				"x-object": xObject || "default",
				"Content-Type": "image/jpeg",
			},
			body: fileData,
		});

		if (s3Response.ok) {
			console.log(`✅ Successfully uploaded ${fileName} to S3`);
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
		res.status(500).json({ error: "S3 upload failed: " + error.message });
	}
}
