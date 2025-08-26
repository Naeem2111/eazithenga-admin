import React, { useState } from "react";
import "./App.css";

function App() {
	const [config, setConfig] = useState({
		remoteApiUrl: "https://eazithenga.com",
		bearerToken:
			process.env.REACT_APP_BEARER_TOKEN ||
			"ea46b8e894b2aa453b3be6293273879ebee2a728",
		useCorsProxy: true,
	});

	const [store, setStore] = useState({
		ownerNumber: "27794343222",
		name: "Test Store",
		slug: "teststore",
	});

	const [products, setProducts] = useState([
		{ name: "Product 1", price: 24.98, imageFile: null },
	]);

	const [isLoading, setIsLoading] = useState(false);
	const [result, setResult] = useState(null);
	const [error, setError] = useState(null);
	const [logs, setLogs] = useState([]);

	const log = (message) => {
		console.log(message);
		setLogs((prev) => [
			...prev,
			{ time: new Date().toLocaleTimeString(), message },
		]);
	};

	const updateConfig = (field, value) => {
		setConfig((prev) => ({ ...prev, [field]: value }));
	};

	const updateStore = (field, value) => {
		setStore((prev) => ({ ...prev, [field]: value }));
	};

	const updateProduct = (index, field, value) => {
		setProducts((prev) =>
			prev.map((product, i) =>
				i === index ? { ...product, [field]: value } : product
			)
		);
	};

	const addProduct = () => {
		setProducts((prev) => [...prev, { name: "", price: 0, imageFile: null }]);
	};

	const removeProduct = (index) => {
		setProducts((prev) => prev.filter((_, i) => i !== index));
	};

	const getHeaders = () => ({
		"Content-Type": "application/json",
		Authorization: `Bearer ${config.bearerToken}`,
	});

	const generateStore = async () => {
		// Validate phone number format
		if (!store.ownerNumber || !store.ownerNumber.match(/^27[0-9]{9}$/)) {
			setError(
				"Phone number must start with '27' followed by 9 digits (e.g., 27794343222)"
			);
			return;
		}

		setIsLoading(true);
		setError(null);
		setResult(null);
		setLogs([]);

		try {
			log("Starting store generation...");

			// Step 1: Get S3 pre-signed URLs
			log("Getting S3 pre-signed URLs...");
			log(`Remote API URL: ${config.remoteApiUrl}`);
			log(`Bearer token: ${config.bearerToken.substring(0, 10)}...`);

			const uploadCount = products.filter((p) => p.imageFile).length;

			let storeProducts = [];
			let urls = [];

			if (uploadCount > 0) {
				// Use CORS proxy for remote API calls to avoid CORS issues
				const apiUrl = config.useCorsProxy
					? `https://corsproxy.io/?${encodeURIComponent(
							config.remoteApiUrl + "/api/file/get-urls"
					  )}`
					: config.remoteApiUrl + "/api/file/get-urls";

				log(`Requesting S3 URLs from: ${apiUrl}`);
				log(`Request payload: ${JSON.stringify({ count: uploadCount })}`);

				try {
					const uploadUrlsResponse = await fetch(apiUrl, {
						method: "POST",
						headers: getHeaders(),
						body: JSON.stringify({ count: uploadCount }),
					});

					if (!uploadUrlsResponse.ok) {
						const errorText = await uploadUrlsResponse.text();
						log(
							`❌ API response error: ${uploadUrlsResponse.status} - ${errorText}`
						);
						throw new Error(
							`Failed to get upload URLs: ${uploadUrlsResponse.status} - ${errorText}`
						);
					}

					const responseData = await uploadUrlsResponse.json();
					log(`✅ API response: ${JSON.stringify(responseData)}`);

					const responseUrls = responseData.urls;
					if (!responseUrls || !Array.isArray(responseUrls)) {
						throw new Error(
							`Invalid response format: expected urls array, got ${typeof responseUrls}`
						);
					}

					urls = responseUrls;
					log(`Received ${urls.length} S3 upload URLs`);
				} catch (fetchError) {
					log(`❌ Fetch error: ${fetchError.message}`);
					log(`Error type: ${fetchError.name}`);
					throw fetchError;
				}

				// Step 2: Upload files to S3
				// Always use the Vercel API endpoint for S3 uploads
				log("Uploading via Vercel API...");

				const uploadPromises = products.map(async (product, index) => {
					if (product.imageFile) {
						log(`Uploading ${product.imageFile.name} to S3`);

						try {
							// Always use Vercel API for S3 uploads
							const formData = new FormData();
							formData.append("image", product.imageFile);
							formData.append("s3UploadUrl", urls[index].uploadUrl);
							formData.append("xObject", urls[index].xObject || "default");

							const uploadResponse = await fetch("/api/s3-upload", {
								method: "POST",
								body: formData,
							});

							if (uploadResponse.ok) {
								const result = await uploadResponse.json();
								log(`✅ Successfully uploaded ${product.imageFile.name} to S3`);
								return urls[index].fileUrl;
							} else {
								const errorText = await uploadResponse.text();
								log(
									`❌ S3 upload failed: ${uploadResponse.status} - ${errorText}`
								);
								throw new Error(`S3 upload failed: ${uploadResponse.status}`);
							}
						} catch (uploadError) {
							log(`❌ S3 upload error: ${uploadError.message}`);
							throw uploadError;
						}
					} else {
						log(`No image file for ${product.name}, skipping upload`);
						return null;
					}
				});

				const imageUrls = await Promise.all(uploadPromises);

				// Update storeProducts with S3 URLs
				storeProducts = products
					.map((product, index) => {
						if (product.imageFile) {
							return {
								name: product.name,
								price: parseFloat(product.price),
								imageUrl: imageUrls[index],
							};
						} else {
							return null;
						}
					})
					.filter(Boolean);
			} else {
				// No images to upload, create store without images
				storeProducts = products.map((product) => ({
					name: product.name,
					price: parseFloat(product.price),
					imageUrl: null,
				}));
			}

			// Step 3: Create store
			log("Creating store...");

			if (storeProducts.length === 0) {
				throw new Error("No products with valid images to create store");
			}

			log(
				`Creating store with: ${JSON.stringify(
					{
						ownerNumber: store.ownerNumber,
						name: store.name,
						slug: store.slug,
						products: storeProducts,
					},
					null,
					2
				)}`
			);

			// Store creation goes to the real Eazithenga API
			const storeCreationUrl = config.useCorsProxy
				? `https://corsproxy.io/?${encodeURIComponent(
						config.remoteApiUrl + "/api/store/create"
				  )}`
				: config.remoteApiUrl + "/api/store/create";

			log(`Creating store via: ${storeCreationUrl}`);

			const createStoreResponse = await fetch(storeCreationUrl, {
				method: "POST",
				headers: getHeaders(),
				body: JSON.stringify({
					ownerNumber: store.ownerNumber,
					name: store.name,
					slug: store.slug,
					products: storeProducts,
				}),
			});

			if (!createStoreResponse.ok) {
				const error = await createStoreResponse.text();
				throw new Error(
					`Failed to create store (${createStoreResponse.status}): ${error}`
				);
			}

			const storeResult = await createStoreResponse.json();
			log("Store created successfully!");

			setResult(storeResult);
		} catch (err) {
			log(`ERROR: ${err.message}`);
			setError(err.message);
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="app">
			<div className="container">
				<h1>Eazithenga Store Generator</h1>

				{/* API Configuration */}
				<section className="section">
					<h2>API Configuration</h2>
					<div className="grid">
						<div className="field">
							<label>Remote API URL (for store creation)</label>
							<input
								type="text"
								value={config.remoteApiUrl}
								onChange={(e) => updateConfig("remoteApiUrl", e.target.value)}
							/>
							<small style={{ color: "#6b7280", marginTop: "4px" }}>
								For Eazithenga API calls (eazithenga.com)
							</small>
						</div>
						<div className="field" style={{ display: "none" }}>
							<label>
								<input type="checkbox" checked={true} disabled={true} />
								Use CORS Proxy (for remote API calls)
							</label>
							<small style={{ color: "#6b7280", marginTop: "4px" }}>
								Using corsproxy.io - no setup required
							</small>
						</div>
					</div>
				</section>

				{/* Store Details */}
				<section className="section">
					<h2>Store Details</h2>
					<div className="grid">
						<div className="field">
							<label>Owner Number *</label>
							<input
								type="text"
								value={store.ownerNumber}
								onChange={(e) => updateStore("ownerNumber", e.target.value)}
								required
								pattern="^27[0-9]{9}$"
								title="Phone number must start with '27' followed by 9 digits (e.g., 27794343222)"
								style={{
									borderColor:
										store.ownerNumber &&
										!store.ownerNumber.match(/^27[0-9]{9}$/)
											? "#ef4444"
											: undefined,
								}}
							/>
							{store.ownerNumber &&
								!store.ownerNumber.match(/^27[0-9]{9}$/) && (
									<small style={{ color: "#ef4444", marginTop: "4px" }}>
										Phone number must start with "27" followed by 9 digits
									</small>
								)}
						</div>
						<div className="field">
							<label>Store Name</label>
							<input
								type="text"
								value={store.name}
								onChange={(e) => updateStore("name", e.target.value)}
							/>
						</div>
						<div className="field">
							<label>Store Slug</label>
							<input
								type="text"
								value={store.slug}
								onChange={(e) => updateStore("slug", e.target.value)}
							/>
						</div>
					</div>
				</section>

				{/* Products */}
				<section className="section">
					<h2>Products</h2>
					<p
						style={{
							marginBottom: "20px",
							color: "#6b7280",
							fontSize: "0.9rem",
						}}
					>
						Note: File uploads now support JPG files with x-object header.
						Images are uploaded directly to S3 pre-signed URLs.
					</p>

					{products.map((product, index) => (
						<div key={index} className="product-card">
							<div className="grid">
								<div className="field">
									<label>Product Name</label>
									<input
										type="text"
										value={product.name}
										onChange={(e) =>
											updateProduct(index, "name", e.target.value)
										}
									/>
								</div>
								<div className="field">
									<label>Price</label>
									<input
										type="number"
										step="0.01"
										value={product.price}
										onChange={(e) =>
											updateProduct(index, "price", e.target.value)
										}
									/>
								</div>
								<div className="field">
									<label>Image (JPG only)</label>
									<input
										type="file"
										accept=".jpg,.jpeg"
										onChange={(e) =>
											updateProduct(index, "imageFile", e.target.files[0])
										}
									/>
								</div>
								{products.length > 1 && (
									<button
										type="button"
										className="btn-remove"
										onClick={() => removeProduct(index)}
									>
										Remove
									</button>
								)}
							</div>
						</div>
					))}
					<button type="button" className="btn-add" onClick={addProduct}>
						Add Product
					</button>
				</section>

				{/* Generate Button */}
				<section className="section">
					<button
						className="btn-generate"
						onClick={generateStore}
						disabled={isLoading}
					>
						{isLoading ? "Generating..." : "Generate Store"}
					</button>
				</section>

				{/* Debug Logs */}
				{logs.length > 0 && (
					<section className="section logs">
						<h3>Debug Logs</h3>
						<div className="log-container">
							{logs.map((log, index) => (
								<div key={index} className="log-entry">
									<span className="log-time">{log.time}</span>
									<span className="log-message">{log.message}</span>
								</div>
							))}
						</div>
					</section>
				)}

				{/* Results */}
				{error && (
					<section className="section error">
						<h3>Error</h3>
						<pre>{error}</pre>
					</section>
				)}

				{result && (
					<section className="section success">
						<h3>Success!</h3>
						<pre>{JSON.stringify(result, null, 2)}</pre>
					</section>
				)}
			</div>
		</div>
	);
}

export default App;
