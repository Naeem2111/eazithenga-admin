import React, { useState } from "react";
import "./App.css";

function App() {
	const [config, setConfig] = useState({
		baseUrl: "https://eazithenga.com",
		bearerToken: "ea46b8e894b2aa453b3be6293273879ebee2a728",
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

	const getApiUrl = (endpoint) => {
		if (config.useCorsProxy) {
			return `https://corsproxy.io/?${encodeURIComponent(
				config.baseUrl + endpoint
			)}`;
		}
		return `${config.baseUrl}${endpoint}`;
	};

	const getHeaders = () => ({
		"Content-Type": "application/json",
		Authorization: `Bearer ${config.bearerToken}`,
	});

	const generateStore = async () => {
		setIsLoading(true);
		setError(null);
		setResult(null);
		setLogs([]);

		try {
			log("Starting store generation...");

			// Step 1: Get upload URLs
			const uploadCount = products.length;
			log(`Requesting ${uploadCount} upload URLs`);

			const uploadUrlsResponse = await fetch(getApiUrl("/api/file/get-urls"), {
				method: "POST",
				headers: getHeaders(),
				body: JSON.stringify({ count: uploadCount }),
			});

			if (!uploadUrlsResponse.ok) {
				const error = await uploadUrlsResponse.text();
				throw new Error(
					`Failed to get upload URLs (${uploadUrlsResponse.status}): ${error}`
				);
			}

			const responseData = await uploadUrlsResponse.json();
			log(`API Response: ${JSON.stringify(responseData)}`);

			const { urls } = responseData;
			if (!urls || !Array.isArray(urls)) {
				throw new Error(
					`Invalid response format: expected urls array, got ${typeof urls}`
				);
			}

			log(`Received ${urls.length} upload URLs`);

			// Step 2: Upload files (if any)
			const uploadPromises = products.map(async (product, index) => {
				const urlObject = urls[index];
				const uploadUrl = urlObject.uploadUrl;

				if (product.imageFile) {
					log(
						`Skipping upload for ${product.imageFile.name} - using placeholder URL`
					);
					log(`File URL: ${urlObject.fileUrl}`);
					return urlObject.fileUrl;
				} else {
					log(
						`No image for ${product.name}, using file URL: ${urlObject.fileUrl}`
					);
					return urlObject.fileUrl;
				}
			});

			const imageUrls = await Promise.all(uploadPromises);

			// Step 3: Create store
			const storeData = {
				ownerNumber: store.ownerNumber,
				name: store.name,
				slug: store.slug,
				products: products.map((product, index) => ({
					name: product.name,
					price: parseFloat(product.price),
					imageUrl: imageUrls[index],
				})),
			};

			log("Creating store...");
			log(`Store data: ${JSON.stringify(storeData, null, 2)}`);

			const createStoreResponse = await fetch(getApiUrl("/api/store/create"), {
				method: "POST",
				headers: getHeaders(),
				body: JSON.stringify(storeData),
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
							<label>Base URL</label>
							<input
								type="text"
								value={config.baseUrl}
								onChange={(e) => updateConfig("baseUrl", e.target.value)}
							/>
						</div>
						<div className="field">
							<label>Bearer Token</label>
							<input
								type="text"
								value={config.bearerToken}
								onChange={(e) => updateConfig("bearerToken", e.target.value)}
							/>
						</div>
						<div className="field">
							<label>
								<input
									type="checkbox"
									checked={config.useCorsProxy}
									onChange={(e) =>
										updateConfig("useCorsProxy", e.target.checked)
									}
								/>
								Use CORS Proxy (for local development)
							</label>
							{config.useCorsProxy && (
								<small style={{ color: "#6b7280", marginTop: "4px" }}>
									Using corsproxy.io - no setup required
								</small>
							)}
						</div>
					</div>
				</section>

				{/* Store Details */}
				<section className="section">
					<h2>Store Details</h2>
					<div className="grid">
						<div className="field">
							<label>Owner Number</label>
							<input
								type="text"
								value={store.ownerNumber}
								onChange={(e) => updateStore("ownerNumber", e.target.value)}
							/>
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
						Note: File uploads are currently skipped due to CORS limitations.
						The API will generate placeholder image URLs.
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
									<label>Image</label>
									<input
										type="file"
										accept="image/*"
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
			</div>
		</div>
	);
}

export default App;
